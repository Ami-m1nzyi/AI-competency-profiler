import sqlite3
from werkzeug.security import generate_password_hash, check_password_hash

DB_FILE = "profiler.db"

def get_connection():
    conn = sqlite3.connect(DB_FILE)
    conn.row_factory = sqlite3.Row
    return conn

def init_db():
    conn = get_connection()
    cur = conn.cursor()

    cur.execute("""
        CREATE TABLE IF NOT EXISTS users (
            id INTEGER PRIMARY KEY AUTOINCREMENT,
            name TEXT NOT NULL,
            login TEXT UNIQUE NOT NULL,
            password TEXT NOT NULL,
            role TEXT NOT NULL,
            first_name TEXT,
            last_name TEXT,
            middle_name TEXT,
            email TEXT,
            group_number TEXT,
            group_name TEXT,
            course_year TEXT
        )
    """)

    for col, coltype in [
        ("first_name", "TEXT"), ("last_name", "TEXT"), ("middle_name", "TEXT"),
        ("email", "TEXT"), ("group_number", "TEXT"), ("group_name", "TEXT"), ("course_year", "TEXT"),
    ]:
        try:
            cur.execute(f"ALTER TABLE users ADD COLUMN {col} {coltype}")
        except Exception:
            pass

    cur.execute("""
        CREATE TABLE IF NOT EXISTS results (
            id INTEGER PRIMARY KEY AUTOINCREMENT,
            user_id INTEGER NOT NULL,
            algo INTEGER,
            coding INTEGER,
            design INTEGER,
            entrepreneur INTEGER,
            teamwork INTEGER,
            profile TEXT,
            recommendations TEXT,
            questions_snapshot TEXT,
            answered_questions TEXT,
            time_taken TEXT,
            created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
            FOREIGN KEY (user_id) REFERENCES users(id)
        )
    """)

    for col, coltype in [
        ("recommendations", "TEXT"), ("questions_snapshot", "TEXT"),
        ("answered_questions", "TEXT"), ("time_taken", "TEXT"), ("created_at", "TIMESTAMP"),
    ]:
        try:
            cur.execute(f"ALTER TABLE results ADD COLUMN {col} {coltype}")
        except Exception:
            pass

    cur.execute("""
        CREATE TABLE IF NOT EXISTS portfolio (
            id INTEGER PRIMARY KEY AUTOINCREMENT,
            user_id INTEGER NOT NULL,
            type TEXT NOT NULL,
            title TEXT NOT NULL,
            description TEXT,
            link TEXT,
            file_path TEXT,
            file_name TEXT,
            file_data TEXT,
            created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
            FOREIGN KEY (user_id) REFERENCES users(id)
        )
    """)

    for col, coltype in [
        ("link", "TEXT"), ("file_path", "TEXT"), ("file_name", "TEXT"), ("file_data", "TEXT"),
    ]:
        try:
            cur.execute(f"ALTER TABLE portfolio ADD COLUMN {col} {coltype}")
        except Exception:
            pass

    cur.execute("""
        CREATE TABLE IF NOT EXISTS support_tickets (
            id INTEGER PRIMARY KEY AUTOINCREMENT,
            user_id INTEGER NOT NULL,
            subject TEXT NOT NULL,
            message TEXT NOT NULL,
            status TEXT DEFAULT 'open',
            created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
            FOREIGN KEY (user_id) REFERENCES users(id)
        )
    """)

    for col, coltype in [
        ("subject", "TEXT"), ("message", "TEXT"),
        ("status", "TEXT"), ("created_at", "TIMESTAMP"),
        ("admin_reply", "TEXT"),
    ]:
        try:
            cur.execute(f"ALTER TABLE support_tickets ADD COLUMN {col} {coltype}")
        except Exception:
            pass

    cur.execute("""
        CREATE TABLE IF NOT EXISTS pinned_teams (
            id INTEGER PRIMARY KEY AUTOINCREMENT,
            user_id INTEGER NOT NULL,
            team_data TEXT NOT NULL,
            created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
            FOREIGN KEY (user_id) REFERENCES users(id)
        )
    """)

    try:
        cur.execute("ALTER TABLE pinned_teams ADD COLUMN team_data TEXT")
    except Exception:
        pass

    cur.execute("""
        CREATE TABLE IF NOT EXISTS invite_tokens (
            id INTEGER PRIMARY KEY AUTOINCREMENT,
            token TEXT UNIQUE NOT NULL,
            email TEXT NOT NULL,
            role TEXT NOT NULL,
            used INTEGER DEFAULT 0,
            created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
        )
    """)

    conn.commit()
    create_default_users(cur, conn)
    conn.close()


def create_default_users(cur, conn):
    cur.execute("SELECT COUNT(*) FROM users")
    count = cur.fetchone()[0]
    if count > 0:
        return

    default_users = [
        ("Иванов Иван Иванович", "student1", "1234", "student",
         "Иван", "Иванов", "Иванович", "student1@student.university.kz",
         "23-ИВТ-1", "Информационные вычислительные технологии", "2"),
        ("Преподаватель Анна Сергеевна", "teacher1", "1234", "teacher",
         "Анна", "Преподаватель", "Сергеевна", "teacher1@university.kz",
         None, None, None),
        ("Администратор", "admin", "admin123", "admin",
         "Администратор", "", "", "admin@university.kz",
         None, None, None),
    ]
    for (name, login, password, role, first_name, last_name, middle_name,
         email, group_number, group_name, course_year) in default_users:
        hashed = generate_password_hash(password)
        cur.execute(
            """INSERT INTO users
               (name, login, password, role, first_name, last_name, middle_name,
                email, group_number, group_name, course_year)
               VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)""",
            (name, login, hashed, role, first_name, last_name, middle_name,
             email, group_number, group_name, course_year)
        )
    conn.commit()

def find_user(login):
    conn = get_connection()
    cur = conn.cursor()
    cur.execute("SELECT * FROM users WHERE login = ?", (login,))
    user = cur.fetchone()
    conn.close()
    return user

def verify_password(login, password):
    user = find_user(login)
    if not user:
        return None
    if check_password_hash(user["password"], password):
        return dict(user)
    return None

def save_result(user_id, scores, profile, recommendations="",
                questions_snapshot="", answered_questions="", time_taken=""):
    conn = get_connection()
    cur = conn.cursor()
    cur.execute("""
        INSERT INTO results (user_id, algo, coding, design, entrepreneur, teamwork,
                             profile, recommendations, questions_snapshot, answered_questions, time_taken)
        VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
    """, (
        user_id,
        scores.get("algo", 0), scores.get("coding", 0), scores.get("design", 0),
        scores.get("entrepreneur", 0), scores.get("teamwork", 0),
        profile, recommendations, questions_snapshot, answered_questions, time_taken
    ))
    conn.commit()
    conn.close()

def get_all_results():
    conn = get_connection()
    cur = conn.cursor()
    cur.execute("""
        SELECT u.id as user_id, u.name, u.login, u.group_number, u.group_name, u.course_year,
               r.algo, r.coding, r.design, r.entrepreneur, r.teamwork, r.profile,
               r.recommendations, r.time_taken, r.created_at
        FROM results r
        JOIN users u ON r.user_id = u.id
        WHERE r.id IN (
            SELECT id FROM results r2
            WHERE r2.user_id = r.user_id
            ORDER BY (r2.algo + r2.coding + r2.design + r2.entrepreneur + r2.teamwork) DESC
            LIMIT 1
        )
        ORDER BY u.name
    """)
    rows = [dict(row) for row in cur.fetchall()]
    conn.close()
    return rows

def get_all_users():
    conn = get_connection()
    cur = conn.cursor()
    cur.execute("SELECT id, name, login, role, group_number, group_name, course_year FROM users")
    rows = [dict(row) for row in cur.fetchall()]
    conn.close()
    return rows

def add_user(name, login, password, role,
             first_name=None, last_name=None, middle_name=None,
             email=None, group_number=None, group_name=None, course_year=None):
    conn = get_connection()
    cur = conn.cursor()
    try:
        hashed = generate_password_hash(password)
        cur.execute(
            """INSERT INTO users
               (name, login, password, role, first_name, last_name, middle_name,
                email, group_number, group_name, course_year)
               VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)""",
            (name, login, hashed, role, first_name, last_name, middle_name,
             email, group_number, group_name, course_year)
        )
        conn.commit()
        conn.close()
        return True
    except sqlite3.IntegrityError:
        conn.close()
        return False

# ПОРТФОЛИО

def add_portfolio_item(user_id, type_, title, description, link=None,
                       file_path=None, file_name=None, file_data=None):
    conn = get_connection()
    cur = conn.cursor()
    cur.execute("""
        INSERT INTO portfolio (user_id, type, title, description, link, file_path, file_name, file_data)
        VALUES (?, ?, ?, ?, ?, ?, ?, ?)
    """, (user_id, type_, title, description, link, file_path, file_name, file_data))
    item_id = cur.lastrowid
    conn.commit()
    conn.close()
    return item_id

def get_portfolio(user_id):
    conn = get_connection()
    cur = conn.cursor()
    cur.execute("""
        SELECT id, type, title, description, link, file_path, file_name, created_at
        FROM portfolio WHERE user_id = ? ORDER BY created_at DESC
    """, (user_id,))
    rows = [dict(r) for r in cur.fetchall()]
    conn.close()
    return rows

def get_portfolio_file(item_id):
    conn = get_connection()
    cur = conn.cursor()
    cur.execute("SELECT file_data, file_name FROM portfolio WHERE id = ?", (item_id,))
    row = cur.fetchone()
    conn.close()
    return dict(row) if row else None

def delete_portfolio_item(item_id, user_id):
    conn = get_connection()
    cur = conn.cursor()
    cur.execute("SELECT file_path FROM portfolio WHERE id = ? AND user_id = ?", (item_id, user_id))
    row = cur.fetchone()
    if not row:
        conn.close()
        return False, None
    file_path = row["file_path"]
    cur.execute("DELETE FROM portfolio WHERE id = ? AND user_id = ?", (item_id, user_id))
    conn.commit()
    conn.close()
    return True, file_path

# ПОДДЕРЖКА

def add_support_request(user_id, subject, message):
    conn = get_connection()
    cur = conn.cursor()
    cur.execute("""
        INSERT INTO support_tickets (user_id, subject, message)
        VALUES (?, ?, ?)
    """, (user_id, subject, message))
    req_id = cur.lastrowid
    conn.commit()
    conn.close()
    return req_id

def get_all_support_requests():
    conn = get_connection()
    cur = conn.cursor()
    cur.execute("""
        SELECT s.id, s.user_id, s.subject, s.message, s.status, s.created_at,
               u.name as user_name, u.role as user_role
        FROM support_tickets s
        JOIN users u ON s.user_id = u.id
        ORDER BY s.created_at DESC
    """)
    rows = [dict(row) for row in cur.fetchall()]
    conn.close()
    return rows

def get_ticket_with_user_email(ticket_id):
    conn = get_connection()
    cur = conn.cursor()
    cur.execute("""
        SELECT s.subject, u.email, u.name
        FROM support_tickets s
        JOIN users u ON s.user_id = u.id
        WHERE s.id = ?
    """, (ticket_id,))
    row = cur.fetchone()
    conn.close()
    return dict(row) if row else None

def update_support_status(request_id, status, admin_reply=""):
    conn = get_connection()
    cur = conn.cursor()
    cur.execute("UPDATE support_tickets SET status = ?, admin_reply = ? WHERE id = ?",
                (status, admin_reply, request_id))
    changed = cur.rowcount
    conn.commit()
    conn.close()
    return changed > 0

def update_user_credentials(user_id, new_login=None, new_password=None):
    conn = get_connection()
    cur = conn.cursor()
    try:
        if new_login:
            cur.execute("UPDATE users SET login = ? WHERE id = ?", (new_login, user_id))
        if new_password:
            hashed = generate_password_hash(new_password)
            cur.execute("UPDATE users SET password = ? WHERE id = ?", (hashed, user_id))
        conn.commit()
        conn.close()
        return True
    except sqlite3.IntegrityError:
        conn.close()
        return False
    
def change_password(user_id, new_password):
    conn = get_connection()
    cur = conn.cursor()
    hashed = generate_password_hash(new_password)
    cur.execute("UPDATE users SET password = ? WHERE id = ?", (hashed, user_id))
    conn.commit()
    conn.close()

# ЗАКРЕПЛЕННЫЕ КОМАНДЫ

def add_pinned_team(user_id, team_data):
    import json
    conn = get_connection()
    cur = conn.cursor()
    team_json = json.dumps(team_data, ensure_ascii=False)
    cur.execute("""
        INSERT INTO pinned_teams (user_id, team_data)
        VALUES (?, ?)
    """, (user_id, team_json))
    team_id = cur.lastrowid
    conn.commit()
    conn.close()
    return team_id

def get_pinned_teams(user_id):
    import json
    conn = get_connection()
    cur = conn.cursor()
    cur.execute("""
        SELECT id, team_data, created_at
        FROM pinned_teams
        WHERE user_id = ?
        ORDER BY created_at DESC
    """, (user_id,))
    rows = []
    for row in cur.fetchall():
        team_data = json.loads(row["team_data"])
        rows.append({
            "id": row["id"],
            "team": team_data,
            "created_at": row["created_at"]
        })
    conn.close()
    return rows

def delete_pinned_team(team_id, user_id):
    conn = get_connection()
    cur = conn.cursor()
    cur.execute("DELETE FROM pinned_teams WHERE id = ? AND user_id = ?", (team_id, user_id))
    changed = cur.rowcount
    conn.commit()
    conn.close()
    return changed > 0

# ТОКЕН ИНВАЙТ ДЛЯ ПРЕПОДАВАТЕЛЕЙ

import secrets

def create_invite_token(email, role="teacher"):
    conn = get_connection()
    cur = conn.cursor()
    token = secrets.token_hex(4).upper()
    cur.execute("""
        INSERT INTO invite_tokens (token, email, role)
        VALUES (?, ?, ?)
    """, (token, email, role))
    conn.commit()
    conn.close()
    return token

def verify_invite_token(token, email):
    conn = get_connection()
    cur = conn.cursor()
    cur.execute("""
        SELECT * FROM invite_tokens
        WHERE token = ? AND email = ? AND used = 0
    """, (token, email))
    row = cur.fetchone()
    conn.close()
    return dict(row) if row else None

def mark_token_used(token_id):
    conn = get_connection()
    cur = conn.cursor()
    cur.execute("UPDATE invite_tokens SET used = 1 WHERE id = ?", (token_id,))
    conn.commit()
    conn.close()

def get_all_invite_tokens():
    conn = get_connection()
    cur = conn.cursor()
    cur.execute("SELECT * FROM invite_tokens ORDER BY created_at DESC")
    rows = [dict(row) for row in cur.fetchall()]
    conn.close()
    return rows