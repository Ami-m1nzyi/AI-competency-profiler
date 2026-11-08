import requests
from datetime import datetime, timezone, date
from flask import Blueprint, request, jsonify
from database import get_connection
from db_adapter import ensure_column

activity_bp = Blueprint("activity", __name__, url_prefix="/api/activity")

EVENT_TYPES = {"visit", "bot_interaction", "ai_request", "schedule_view"}


def init_activity_table():
    conn = get_connection()
    conn.execute("""
        CREATE TABLE IF NOT EXISTS activity_events (
            id INTEGER PRIMARY KEY AUTOINCREMENT,
            user_id INTEGER,
            event_type TEXT NOT NULL,
            country TEXT,
            created_at TEXT NOT NULL
        )
    """)
    # Добавляем в users дату регистрации, если её ещё нет
    ensure_column(conn, "users", "created_at", "TEXT")
    conn.commit()
    conn.close()


def get_country():
    """Определяем страну по IP."""
    # Если сайт за Cloudflare, страна уже в заголовке
    country = request.headers.get("X-Vercel-IP-Country") or request.headers.get("CF-IPCountry")
    if country:
        return country

    ip = request.headers.get("X-Forwarded-For", request.remote_addr or "")
    ip = ip.split(",")[0].strip()
    if ip in ("", "::1") or ip.startswith(("127.", "192.168.", "10.")):
        return "Local"
    try:
        r = requests.get(
            f"http://ip-api.com/json/{ip}?fields=countryCode", timeout=2
        )
        return r.json().get("countryCode") or "Unknown"
    except Exception:
        return "Unknown"


def record_event(event_type, user_id=None):
    """Записывает событие. Можно вызывать из любых эндпоинтов."""
    if event_type not in EVENT_TYPES:
        return
    try:
        conn = get_connection()
        conn.execute(
            "INSERT INTO activity_events (user_id, event_type, country, created_at) "
            "VALUES (?, ?, ?, ?)",
            (user_id, event_type, get_country(),
             datetime.now(timezone.utc).isoformat()),
        )
        conn.commit()
        conn.close()
    except Exception as e:
        # статистика не должна ломать основную работу сайта
        print(f"Не удалось записать событие: {e}")


@activity_bp.route("/track", methods=["POST"])
def track():
    data = request.get_json(silent=True) or {}
    event_type = data.get("event_type")
    if event_type not in EVENT_TYPES:
        return jsonify({"error": "unknown event_type"}), 400
    record_event(event_type, data.get("user_id"))
    return jsonify({"ok": True}), 201


@activity_bp.route("/stats", methods=["GET"])
def stats():
    # ?user_id=1&from=2026-11-01&to=2026-11-07
    admin_id = request.args.get("user_id")
    if not admin_id:
        return jsonify({"error": "Укажите user_id"}), 400

    conn = get_connection()
    row = conn.execute(
        "SELECT role FROM users WHERE id = ?", (admin_id,)
    ).fetchone()
    if not row or row["role"] != "admin":
        conn.close()
        return jsonify({"error": "Доступ только для администратора"}), 403

    today = date.today().isoformat()
    date_from = request.args.get("from", today)
    date_to = request.args.get("to", today)
    try:
        days = (date.fromisoformat(date_to) - date.fromisoformat(date_from)).days + 1
    except ValueError:
        conn.close()
        return jsonify({"error": "Формат дат: ГГГГ-ММ-ДД"}), 400
    if days < 1:
        conn.close()
        return jsonify({"error": "'to' не может быть раньше 'from'"}), 400

    total_users = conn.execute("SELECT COUNT(*) FROM users").fetchone()[0]

    new_users = conn.execute(
        "SELECT COUNT(*) FROM users WHERE date(created_at) BETWEEN ? AND ?",
        (date_from, date_to),
    ).fetchone()[0]

    active_users = conn.execute(
        "SELECT COUNT(DISTINCT user_id) FROM activity_events "
        "WHERE user_id IS NOT NULL AND date(created_at) BETWEEN ? AND ?",
        (date_from, date_to),
    ).fetchone()[0]

    # сумма «уникальных пользователей за каждый день» / число дней
    daily = conn.execute(
        "SELECT COUNT(DISTINCT user_id) AS c FROM activity_events "
        "WHERE user_id IS NOT NULL AND date(created_at) BETWEEN ? AND ? "
        "GROUP BY date(created_at)",
        (date_from, date_to),
    ).fetchall()
    avg_active_per_day = round(sum(r["c"] for r in daily) / days, 2)

    by_type = {t: 0 for t in EVENT_TYPES}
    for r in conn.execute(
        "SELECT event_type, COUNT(*) AS c FROM activity_events "
        "WHERE date(created_at) BETWEEN ? AND ? GROUP BY event_type",
        (date_from, date_to),
    ):
        by_type[r["event_type"]] = r["c"]

    countries = {
        r["country"]: r["c"]
        for r in conn.execute(
            "SELECT COALESCE(country,'Unknown') AS country, COUNT(*) AS c "
            "FROM activity_events WHERE date(created_at) BETWEEN ? AND ? "
            "GROUP BY country ORDER BY c DESC",
            (date_from, date_to),
        )
    }
    conn.close()

    return jsonify({
        "period": {"from": date_from, "to": date_to, "days": days},
        "total_users": total_users,
        "new_users": new_users,
        "active_users": active_users,
        "avg_active_users_per_day": avg_active_per_day,
        "bot_interactions": by_type["bot_interaction"],
        "ai_requests": by_type["ai_request"],
        "schedule_views": by_type["schedule_view"],
        "visits_by_country": countries,
    })
