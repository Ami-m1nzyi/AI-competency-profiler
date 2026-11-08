import os
from pathlib import Path
from dotenv import load_dotenv

BASE_DIR = Path(__file__).resolve().parent
load_dotenv(BASE_DIR / ".env")

from flask import Flask, request, jsonify, send_from_directory, send_file, session, g
from scorer import calculate_scores, get_profile, get_recommendations, form_teams_without_ai, load_question_map
import json, uuid, io, threading, copy
from datetime import datetime, timezone

def load_questions():
    with open(BASE_DIR / "questions.json", "r", encoding="utf-8") as f:
        return json.load(f)

data = load_questions()

from ai_advisor import get_ai_recommendations, get_teams, generate_questions
from database import (init_db, verify_password, save_result, get_all_results,
                      add_user, get_all_users, get_connection,
                      add_portfolio_item, get_portfolio, get_portfolio_file, delete_portfolio_item,
                      add_support_request, get_all_support_requests, update_support_status, update_user_credentials, change_password,
                      add_pinned_team, get_pinned_teams, delete_pinned_team, get_ticket_with_user_email,
                      create_invite_token, verify_invite_token, mark_token_used, get_all_invite_tokens)
from email_sender import send_ticket_resolved_email
from activity import activity_bp, init_activity_table, record_event
from auth import configure_auth
from file_storage import MAX_FILE_SIZE, save_file, read_file, delete_file

app = Flask(__name__, static_folder="static", static_url_path="")
app.register_blueprint(activity_bp)
_schema_ready = False
_schema_lock = threading.Lock()


@app.before_request
def initialize_database():
    global _schema_ready
    if not request.path.startswith("/api/") or _schema_ready:
        return
    with _schema_lock:
        if not _schema_ready:
            init_db()
            init_activity_table()
            _schema_ready = True


configure_auth(app)


@app.route("/api/health")
def health():
    conn = get_connection()
    try:
        conn.execute("SELECT 1").fetchone()
    finally:
        conn.close()
    return jsonify(status="ok", database="postgres" if os.getenv("DATABASE_URL") else "sqlite")

TOTAL_QUESTIONS = 25

ALLOWED_EXTENSIONS = {
    "pdf", "doc", "docx", "ppt", "pptx", "xls", "xlsx",
    "png", "jpg", "jpeg", "gif", "webp", "zip", "rar"
}
app.config["MAX_CONTENT_LENGTH"] = MAX_FILE_SIZE + 128 * 1024


@app.errorhandler(413)
def upload_too_large(error):
    return jsonify(error="Файл слишком большой (максимум 4 МБ)"), 413

def allowed_file(filename):
    return "." in filename and filename.rsplit(".", 1)[1].lower() in ALLOWED_EXTENSIONS

@app.route("/")
def index():
    return send_from_directory(app.static_folder, "index.html")

# ВОПРОСЫ

@app.route("/api/questions")
def get_questions():
    import random
    with open(BASE_DIR / "questions_bank.json", encoding="utf-8") as source:
        bank = json.load(source)
    if os.getenv("GENERATE_AI_QUESTIONS") == "1":
        try:
            bank = generate_questions()
            record_event("ai_request", g.user["id"])
        except Exception:
            app.logger.warning("Question generation unavailable; using the question bank")
    result = {"modules": []}
    for mod in bank["modules"]:
        questions = mod["questions"]
        picked = copy.deepcopy(random.sample(questions, min(5, len(questions))))
        for i, q in enumerate(picked):
            q["id"] = f"{mod['id']}_{i+1}"
        result["modules"].append({**mod, "questions": picked})

    attempt_id = uuid.uuid4().hex
    conn = get_connection()
    try:
        conn.execute("INSERT INTO test_attempts (id, user_id, questions) VALUES (?, ?, ?)",
                     (attempt_id, g.user["id"], json.dumps(result, ensure_ascii=False)))
        conn.commit()
    finally:
        conn.close()
    public_result = copy.deepcopy(result)
    for module in public_result["modules"]:
        for question in module["questions"]:
            question.pop("correct", None)
    return jsonify(**public_result, attempt_id=attempt_id)

# РЕГИСТРАЦИЯ

@app.route("/api/register", methods=["POST"])
def register():
    body        = request.get_json()
    role        = body.get("role", "student")
    password    = body.get("password", "").strip()
    email       = body.get("email", "").strip()
    first_name  = body.get("first_name", "").strip()
    last_name   = body.get("last_name", "").strip()
    middle_name = body.get("middle_name", "").strip()

    if role not in ("student", "teacher"):
        return jsonify({"error": "Самостоятельная регистрация доступна только для студентов и преподавателей"}), 403

    invite_token = body.get("invite_token", "").strip()
    if role == "teacher":
        if not invite_token:
            return jsonify({"error": "Для регистрации преподавателя нужен код приглашения от администратора"}), 403

        token_info = verify_invite_token(invite_token, email)
        if not token_info:
            return jsonify({"error": "Неверный код приглашения или он уже использован"}), 403
    
    if not first_name or not last_name or not email:
        return jsonify({"error": "Заполните все обязательные поля"}), 400

    if len(password) < 4:
        return jsonify({"error": "Пароль должен быть не менее 4 символов"}), 400

    group_number = None
    group_name   = None
    course_year  = None
    if role == "student":
        group_number = body.get("group_number", "").strip().upper() 
        group_name   = body.get("group_name", "").strip()
        course_year  = body.get("course_year", "").strip()
        if not group_number or not group_name or not course_year:
            return jsonify({"error": "Заполните данные учебной группы и курс"}), 400

    name_parts = [last_name, first_name]
    if middle_name:
        name_parts.append(middle_name)
    full_name = " ".join(name_parts)
    login = email

    success = add_user(
        name=full_name, login=login, password=password, role=role,
        first_name=first_name, last_name=last_name, middle_name=middle_name,
        email=email, group_number=group_number, group_name=group_name, course_year=course_year,
    )

    if success:
        if role == "teacher":
            mark_token_used(token_info["id"])
        # записываем дату регистрации для статистики
        conn = get_connection()
        conn.execute("UPDATE users SET created_at = ? WHERE login = ?",
                     (datetime.now(timezone.utc).isoformat(), login))
        conn.commit()
        conn.close()
        return jsonify({"message": "Аккаунт создан! Теперь войдите в систему."})
    else:
        return jsonify({"error": "Этот email уже зарегистрирован"}), 400

# АВТОРИЗАЦИЯ

@app.route("/api/login", methods=["POST"])
def login():
    body          = request.get_json()
    login_val     = body.get("login", "")
    password      = body.get("password", "")
    selected_role = body.get("role", "")

    user = verify_password(login_val, password)
    if not user:
        return jsonify({"error": "Неверный логин или пароль"}), 401

    if selected_role and user["role"] != selected_role:
        return jsonify({"error": "Неверная роль для этого аккаунта"}), 403

    session.clear()
    session["user_id"] = user["id"]
    session.permanent = True
    record_event("visit", user["id"])

    return jsonify({
        "id":           user["id"],
        "name":         user["name"],
        "login":        user["login"],
        "role":         user["role"],
        "email":        user.get("email"),
        "group_number": user.get("group_number"),
        "group_name":   user.get("group_name"),
        "course_year":  user.get("course_year"),
    })

@app.route("/api/logout", methods=["POST"])
def logout():
    session.clear()
    return jsonify(ok=True)


@app.route("/api/change-password", methods=["POST"])
def change_pwd():
    body         = request.get_json()
    user_id      = body.get("user_id")
    old_password = body.get("old_password", "")
    new_password = body.get("new_password", "")

    if not user_id or not old_password or not new_password:
        return jsonify({"error": "Заполните все поля"}), 400

    if len(new_password) < 4:
        return jsonify({"error": "Пароль должен быть не менее 4 символов"}), 400

    conn = get_connection()
    cur = conn.cursor()
    cur.execute("SELECT password FROM users WHERE id = ?", (user_id,))
    row = cur.fetchone()
    conn.close()

    if not row:
        return jsonify({"error": "Пользователь не найден"}), 404

    from werkzeug.security import check_password_hash
    if not check_password_hash(row["password"], old_password):
        return jsonify({"error": "Старый пароль неверен"}), 401

    change_password(user_id, new_password)
    return jsonify({"message": "Пароль успешно изменён!"})

# Отправка ответов студента.

@app.route("/api/submit", methods=["POST"])
def submit():
    body               = request.get_json()
    user_id            = g.user["id"]
    name               = g.user["name"]
    answers            = body.get("answers", {})
    time_spent         = body.get("time_spent", None)
    attempt_id = body.get("attempt_id")
    conn = get_connection()
    try:
        attempt = conn.execute("SELECT questions, result FROM test_attempts WHERE id = ? AND user_id = ?",
                               (attempt_id, user_id)).fetchone()
    finally:
        conn.close()
    if not attempt:
        return jsonify(error="Начните новый тест: попытка не найдена"), 400
    if attempt["result"]:
        return jsonify(json.loads(attempt["result"]))
    questions_snapshot = attempt["questions"]
    question_set = json.loads(questions_snapshot)
    question_map = load_question_map(question_set)
    time_taken         = body.get("time_taken", "")
    timed_out          = body.get("timed_out") is True

    if not isinstance(answers, dict) or any(q_id not in question_map for q_id in answers):
        return jsonify(error="Ответы не соответствуют тесту"), 400
    if len(answers) < len(question_map) and not timed_out:
        unanswered = len(question_map) - len(answers)
        return jsonify({
            "error": f"Ответ не на все вопросы. Пропущено: {unanswered} из {TOTAL_QUESTIONS}"
        }), 400

    # At timeout every unanswered question contributes zero points. Keep the
    # original answers for review, without inventing a selected option.
    scoring_answers = (
        {question_id: answers.get(question_id) for question_id in question_map}
        if timed_out else answers
    )
    scores  = calculate_scores(scoring_answers, question_set)
    profile = get_profile(scores)
    basic_recommendations = get_recommendations(scores)

    try:
        ai_recommendations = get_ai_recommendations(name, scores, profile, time_spent)
        recommendation_source = "ai"
    except Exception as e:
        ai_recommendations = "\n".join(basic_recommendations)
        recommendation_source = "rules"
        app.logger.warning("AI recommendations unavailable; using rules-based recommendations")

    record_event("ai_request", user_id)

    if user_id:
        save_result(
            user_id, scores, profile, ai_recommendations,
            questions_snapshot=questions_snapshot,
            answered_questions=json.dumps(answers),
            time_taken=time_taken
        )

    response = {
        "scores":          scores,
        "profile":         profile,
        "recommendations": ai_recommendations,
        "time_taken":      time_taken,
        "questions_snapshot": questions_snapshot,
        "recommendation_source": recommendation_source,
    }
    conn = get_connection()
    try:
        conn.execute("UPDATE test_attempts SET result = ? WHERE id = ? AND user_id = ?",
                     (json.dumps(response, ensure_ascii=False), attempt_id, user_id))
        conn.commit()
    finally:
        conn.close()
    return jsonify(response)

# РЕЗУЛЬТАТЫ

@app.route("/api/results", methods=["GET"])
def results():
    rows = get_all_results()
    return jsonify(rows)

@app.route("/api/results/my/<int:user_id>", methods=["GET"])
def my_results(user_id):
    conn = get_connection()
    cur  = conn.cursor()
    cur.execute("""
        SELECT algo, coding, design, entrepreneur, teamwork, profile,
               recommendations, questions_snapshot, answered_questions, time_taken
        FROM results
        WHERE user_id = ?
        ORDER BY id DESC
        LIMIT 1
    """, (user_id,))
    row = cur.fetchone()
    conn.close()
    if not row:
        return jsonify({"error": "Результатов пока нет"}), 404
    return jsonify(dict(row))

# КОМАНДЫ

@app.route("/api/teams", methods=["GET"])
def generate_teams():
    rows = get_all_results()
    if not rows:
        return jsonify({"error": "Нет данных о студентах"}), 404
    try:
        teams = get_teams(rows)
        record_event("ai_request")
    except Exception as e:
        return jsonify({"error": f"Ошибка генерации: {e}"}), 500
    return jsonify({"teams": teams})

@app.route("/api/teams/no-ai", methods=["GET"])
def generate_teams_no_ai():
    rows = get_all_results()
    if not rows:
        return jsonify({"error": "Нет данных о студентах"}), 404
    teams = form_teams_without_ai(rows, team_size=5)
    return jsonify({"teams": teams})

@app.route("/api/teams/pin", methods=["POST"])
def pin_team():
    body    = request.get_json() or {}
    user_id = body.get("user_id")
    team    = body.get("team")

    if not user_id or not team:
        return jsonify({"error": "Укажите user_id и team"}), 400

    team_id = add_pinned_team(user_id, team)
    return jsonify({"id": team_id, "message": "Команда закреплена"})

@app.route("/api/teams/pinned/<int:user_id>", methods=["GET"])
def get_user_pinned_teams(user_id):
    pinned = get_pinned_teams(user_id)
    return jsonify({"pinned": pinned})

@app.route("/api/teams/pin/<int:team_id>", methods=["DELETE"])
def unpin_team(team_id):
    body    = request.get_json(silent=True) or {}
    user_id = body.get("user_id")

    if not user_id:
        return jsonify({"error": "Укажите user_id"}), 400

    ok = delete_pinned_team(team_id, user_id)
    if not ok:
        return jsonify({"error": "Команда не найдена или нет доступа"}), 404

    return jsonify({"message": "Команда откреплена"})

# ПОРТФОЛИО

@app.route("/api/portfolio/<int:user_id>", methods=["GET"])
def portfolio_get(user_id):
    items = get_portfolio(user_id)
    return jsonify(items)

@app.route("/api/portfolio", methods=["POST"])
def portfolio_add():
    user_id     = request.form.get("user_id")
    type_       = (request.form.get("type") or "").strip()
    title       = (request.form.get("title") or "").strip()
    description = (request.form.get("description") or "").strip()
    url         = (request.form.get("url") or "").strip()

    if not user_id or not type_ or not title:
        return jsonify({"error": "Укажите тип и название"}), 400

    if type_ not in ("certificate", "diploma", "article", "project"):
        return jsonify({"error": "Неверный тип"}), 400

    file_path = None
    file_name = None

    uploaded = request.files.get("file")
    if uploaded and uploaded.filename:
        if not allowed_file(uploaded.filename):
            return jsonify({"error": "Недопустимый формат файла. Разрешены: " + ", ".join(sorted(ALLOWED_EXTENSIONS))}), 400
        ext         = uploaded.filename.rsplit(".", 1)[1].lower()
        stored_name = f"{user_id}_{uuid.uuid4().hex}.{ext}"
        file_bytes = uploaded.read(MAX_FILE_SIZE + 1)
        if len(file_bytes) > MAX_FILE_SIZE:
            return jsonify(error="Файл слишком большой (максимум 4 МБ)"), 413
        save_file(stored_name, file_bytes)
        file_path = stored_name
        file_name = uploaded.filename
        url = ""

    item_id = add_portfolio_item(user_id, type_, title, description, url, file_path, file_name)
    return jsonify({"id": item_id, "message": "Добавлено"})

@app.route("/api/portfolio/add", methods=["POST"])
def portfolio_add_json():
    body        = request.get_json()
    user_id     = body.get("user_id")
    type_       = body.get("type", "project")
    title       = body.get("title", "")
    description = body.get("description", "")
    link        = body.get("link", body.get("url", ""))
    file_data   = body.get("file_data", None)
    file_name   = body.get("file_name", None)

    add_portfolio_item(user_id, type_, title, description, link, None, file_name, file_data)
    return jsonify({"message": "Добавлено в портфолио"})

@app.route("/api/portfolio/file/<path:filename>", methods=["GET"])
def portfolio_file(filename):
    conn = get_connection()
    try:
        item = conn.execute("SELECT user_id, file_name FROM portfolio WHERE file_path = ?", (filename,)).fetchone()
    finally:
        conn.close()
    if not item:
        return jsonify(error="Файл не найден"), 404
    if item["user_id"] != g.user["id"] and g.user["role"] not in ("teacher", "admin"):
        return jsonify(error="Нет доступа"), 403
    try:
        content = read_file(filename)
    except FileNotFoundError:
        return jsonify(error="Файл не найден"), 404
    return send_file(io.BytesIO(content), download_name=item["file_name"], as_attachment=True)

@app.route("/api/portfolio/file-data/<int:item_id>", methods=["GET"])
def get_portfolio_file_endpoint(item_id):
    conn = get_connection()
    try:
        owner = conn.execute("SELECT user_id FROM portfolio WHERE id = ?", (item_id,)).fetchone()
    finally:
        conn.close()
    if not owner:
        return jsonify(error="Файл не найден"), 404
    if owner["user_id"] != g.user["id"] and g.user["role"] not in ("teacher", "admin"):
        return jsonify(error="Нет доступа"), 403
    result = get_portfolio_file(item_id)
    if not result:
        return jsonify({"error": "Файл не найден"}), 404
    return jsonify(result)

@app.route("/api/portfolio/<int:item_id>", methods=["DELETE"])
def portfolio_delete(item_id):
    body    = request.get_json(silent=True) or {}
    user_id = body.get("user_id")

    if not user_id:
        return jsonify({"error": "Не указан пользователь"}), 400

    found, file_path = delete_portfolio_item(item_id, user_id)
    if not found:
        return jsonify({"error": "Не найдено или нет доступа"}), 404

    if file_path:
        try:
            delete_file(file_path)
        except Exception:
            app.logger.warning("Could not remove an unlinked portfolio file")

    return jsonify({"message": "Удалено"})

@app.route("/api/portfolio/delete/<int:item_id>", methods=["DELETE"])
def portfolio_delete_alias(item_id):
    user_id = request.args.get("user_id")
    delete_portfolio_item(item_id, user_id)
    return jsonify({"message": "Удалено"})

# ПОДДЕРЖКА

ALLOWED_SUPPORT_STATUSES = ("open", "in_progress", "completed")

@app.route("/api/support", methods=["POST"])
def support_create():
    body    = request.get_json() or {}
    user_id = body.get("user_id")
    subject = (body.get("subject") or "").strip()
    message = (body.get("message") or "").strip()

    if not user_id or not subject or not message:
        return jsonify({"error": "Укажите тему и текст запроса"}), 400

    req_id = add_support_request(user_id, subject, message)
    return jsonify({"id": req_id, "message": "Запрос отправлен"})

@app.route("/api/support", methods=["GET"])
def support_list():
    rows = get_all_support_requests()
    return jsonify(rows)

@app.route("/api/support/<int:request_id>", methods=["PATCH"])
def support_update(request_id):
    body        = request.get_json() or {}
    status      = body.get("status")
    admin_reply = body.get("admin_reply", "")

    if status not in ALLOWED_SUPPORT_STATUSES:
        return jsonify({"error": "Неверный статус"}), 400

    ok = update_support_status(request_id, status, admin_reply)
    if not ok:
        return jsonify({"error": "Запрос не найден"}), 404

    if status == "completed":
        ticket_info = get_ticket_with_user_email(request_id)
        if ticket_info and ticket_info.get("email"):
            send_ticket_resolved_email(
                ticket_info["email"], ticket_info["name"],
                ticket_info["subject"], admin_reply
            )

    return jsonify({"message": "Статус обновлён"})

# Совместимость с интерфейсом администратора (/api/tickets).
@app.route("/api/tickets", methods=["GET"])
def get_tickets():
    rows = get_all_support_requests()
    return jsonify(rows)

@app.route("/api/tickets/create", methods=["POST"])
def create_support_ticket():
    body      = request.get_json() or {}
    user_id   = body.get("user_id")
    subject   = (body.get("subject") or "").strip()
    message   = (body.get("message") or "").strip()

    if not user_id or not subject or not message:
        return jsonify({"error": "Укажите тему и текст запроса"}), 400

    req_id = add_support_request(user_id, subject, message)
    return jsonify({"id": req_id, "message": "Запрос отправлен"})

@app.route("/api/tickets/status/<int:ticket_id>", methods=["PATCH"])
def update_ticket_status_alias(ticket_id):
    body        = request.get_json() or {}
    status      = body.get("status", "")
    admin_reply = body.get("admin_reply", "")

    if status not in ALLOWED_SUPPORT_STATUSES:
        return jsonify({"error": "Неверный статус"}), 400

    ok = update_support_status(ticket_id, status, admin_reply)
    if not ok:
        return jsonify({"error": "Запрос не найден"}), 404

    if status == "completed":
        ticket_info = get_ticket_with_user_email(ticket_id)
        if ticket_info and ticket_info.get("email"):
            send_ticket_resolved_email(
                ticket_info["email"], ticket_info["name"],
                ticket_info["subject"], admin_reply
            )

    return jsonify({"message": "Статус обновлён"})

# Приглашения преподавателей.
@app.route("/api/invite/create", methods=["POST"])
def create_invite():
    body  = request.get_json()
    email = body.get("email", "").strip()
    role  = body.get("role", "teacher")

    if not email:
        return jsonify({"error": "Укажите email"}), 400
    if role != "teacher":
        return jsonify(error="Приглашения доступны для преподавателей"), 400

    token = create_invite_token(email, role)

    email_sent = False
    try:
        from email_sender import send_invite_email
        send_invite_email(email, token, role)
        email_sent = True
    except Exception as e:
        app.logger.warning("Invitation email could not be delivered")

    return jsonify({"message": "Приглашение отправлено" if email_sent else "Приглашение создано. Передайте код преподавателю.",
                    "token": token, "email_sent": email_sent})

@app.route("/api/invite/list", methods=["GET"])
def list_invites():
    rows = get_all_invite_tokens()
    return jsonify(rows)

# АДМИН — управление пользователями

@app.route("/api/users", methods=["GET"])
def users():
    rows = get_all_users()
    return jsonify(rows)

@app.route("/api/users/add", methods=["POST"])
def create_user():
    body     = request.get_json()
    name     = body.get("name", "")
    login    = body.get("login", "")
    password = body.get("password", "")
    role     = body.get("role", "student")

    if role not in ("student", "teacher", "admin"):
        return jsonify({"error": "Неверная роль"}), 400

    success = add_user(name, login, password, role)
    if success:
        return jsonify({"message": "Пользователь создан"})
    else:
        return jsonify({"error": "Логин уже занят"}), 400
    
@app.route("/api/users/<int:user_id>/credentials", methods=["PATCH"])
def update_credentials(user_id):
    body         = request.get_json() or {}
    new_login    = body.get("login", "").strip() or None
    new_password = body.get("password", "").strip() or None

    if not new_login and not new_password:
        return jsonify({"error": "Укажите новый логин или пароль"}), 400

    ok = update_user_credentials(user_id, new_login, new_password)
    if not ok:
        return jsonify({"error": "Логин уже занят"}), 400

    return jsonify({"message": "Данные обновлены"})

@app.route("/<path:path>")
def serve_react(path):
    full_path = os.path.join(app.static_folder, path)
    if os.path.exists(full_path):
        return send_from_directory(app.static_folder, path)
    return send_from_directory(app.static_folder, "index.html")

if __name__ == "__main__":
    app.run(debug=True)
