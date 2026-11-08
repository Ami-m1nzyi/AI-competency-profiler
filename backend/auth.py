"""Cookie sessions and server-side authorization for the public deployment."""
import os
import secrets
from datetime import timedelta
from urllib.parse import urlsplit

from flask import g, jsonify, request, session
from database import get_connection

ADMIN_ENDPOINTS = {
    "support_list", "support_update", "get_tickets", "update_ticket_status_alias",
    "create_invite", "list_invites", "users", "create_user", "update_credentials",
    "activity.stats",
}
TEACHER_ENDPOINTS = {
    "results", "generate_teams", "generate_teams_no_ai", "pin_team",
    "get_user_pinned_teams", "unpin_team",
}


def configure_auth(app):
    secret = os.getenv("SECRET_KEY")
    if not secret and os.getenv("VERCEL"):
        raise RuntimeError("SECRET_KEY must be configured on Vercel")
    app.config.update(
        SECRET_KEY=secret or secrets.token_hex(32),
        SESSION_COOKIE_HTTPONLY=True,
        SESSION_COOKIE_SECURE=bool(os.getenv("VERCEL")),
        SESSION_COOKIE_SAMESITE="Lax",
        PERMANENT_SESSION_LIFETIME=timedelta(hours=12),
    )

    @app.before_request
    def authorize_request():
        if not request.path.startswith("/api/"):
            return None
        if request.method not in ("GET", "HEAD", "OPTIONS"):
            origin = request.headers.get("Origin")
            expected_host = request.headers.get("X-Forwarded-Host", request.host).split(",")[0].strip()
            if origin and urlsplit(origin).netloc != expected_host:
                return jsonify(error="Запрос с другого сайта отклонён"), 403
        if request.endpoint in ("health", "login", "register"):
            return None
        user_id = session.get("user_id")
        if not user_id:
            return jsonify(error="Войдите в аккаунт"), 401
        conn = get_connection()
        try:
            user = conn.execute("SELECT id, role, name FROM users WHERE id = ?", (user_id,)).fetchone()
        finally:
            conn.close()
        if not user:
            session.clear()
            return jsonify(error="Войдите в аккаунт"), 401
        g.user = dict(user)
        if request.endpoint in ADMIN_ENDPOINTS and user["role"] != "admin":
            return jsonify(error="Доступ только для администратора"), 403
        if request.endpoint in TEACHER_ENDPOINTS and user["role"] not in ("teacher", "admin"):
            return jsonify(error="Доступ только для преподавателя"), 403
        if request.endpoint in ("get_questions", "submit") and user["role"] != "student":
            return jsonify(error="Тестирование доступно студентам"), 403
        if request.endpoint in ("my_results", "portfolio_get"):
            target = request.view_args["user_id"]
            if target != user_id and user["role"] not in ("teacher", "admin"):
                return jsonify(error="Нет доступа к данным другого пользователя"), 403
        if request.endpoint == "get_user_pinned_teams":
            if request.view_args["user_id"] != user_id and user["role"] != "admin":
                return jsonify(error="Нет доступа"), 403
        # Caller-supplied IDs are never an authentication mechanism.
        body = request.get_json(silent=True) or request.form or request.args
        supplied_id = body.get("user_id")
        if supplied_id is not None and str(supplied_id) != str(user_id):
            return jsonify(error="Нет доступа к данным другого пользователя"), 403
        return None

    @app.after_request
    def private_api_responses(response):
        if request.path.startswith("/api/"):
            response.headers["Cache-Control"] = "no-store"
        response.headers["X-Content-Type-Options"] = "nosniff"
        response.headers["Referrer-Policy"] = "same-origin"
        return response
