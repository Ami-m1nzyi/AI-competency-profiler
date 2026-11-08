import io
import json
import sys
from pathlib import Path

import pytest

sys.path.insert(0, str(Path(__file__).resolve().parents[1] / "backend"))


@pytest.fixture
def site(tmp_path, monkeypatch):
    for key in ("DATABASE_URL", "POSTGRES_URL", "VERCEL", "BLOB_READ_WRITE_TOKEN", "BLOB_STORE_ID"):
        monkeypatch.delenv(key, raising=False)
    monkeypatch.setenv("DATABASE_PATH", str(tmp_path / "test.db"))
    monkeypatch.setenv("SECRET_KEY", "isolated-test-session-key")
    import app
    import file_storage
    monkeypatch.setattr(file_storage, "UPLOAD_FOLDER", tmp_path / "uploads")
    monkeypatch.setattr(app, "_schema_ready", False)
    monkeypatch.setattr(app, "get_ai_recommendations", lambda *args: "Test recommendations")
    app.app.config.update(TESTING=True, SESSION_COOKIE_SECURE=False)
    yield app.app


def login(client, name="student1", password="1234", role="student"):
    response = client.post("/api/login", json={"login": name, "password": password, "role": role})
    assert response.status_code == 200
    return response.json


def test_requires_session_and_checks_roles(site):
    client = site.test_client()
    assert client.get("/api/health").json["status"] == "ok"
    assert client.get("/api/users").status_code == 401
    user = login(client)
    assert client.get("/api/users").status_code == 403
    assert client.get("/api/portfolio/999").status_code == 403
    assert client.post("/api/support", json={"user_id": user["id"] + 1, "subject": "x", "message": "y"}).status_code == 403
    assert client.post("/api/logout").status_code == 200
    assert client.get("/api/questions").status_code == 401


def test_rejects_cross_site_mutations(site):
    client = site.test_client()
    assert client.post("/api/login", json={}, headers={"Origin": "https://unrelated.example"}).status_code == 403


def test_registration_and_login_survive_new_client(site):
    client = site.test_client()
    body = {"email": "test@example.invalid", "password": "strong-test-pass", "role": "student",
            "first_name": "Test", "last_name": "Student", "group_number": "TEST", "group_name": "IT", "course_year": "1"}
    assert client.post("/api/register", json=body).status_code == 200
    assert client.post("/api/register", json=body).status_code == 400
    assert client.post("/api/register", json={**body, "role": "admin"}).status_code == 403
    assert login(site.test_client(), body["email"], body["password"])["role"] == "student"


def test_attempts_are_isolated_and_server_scored(site):
    import database
    client = site.test_client()
    user = login(client)
    first = client.get("/api/questions").json
    second = client.get("/api/questions").json
    assert first["attempt_id"] != second["attempt_id"]
    assert all("correct" not in q for m in first["modules"] for q in m["questions"])
    conn = database.get_connection()
    questions = json.loads(conn.execute("SELECT questions FROM test_attempts WHERE id = ?", (first["attempt_id"],)).fetchone()[0])
    conn.close()
    answers = {q["id"]: q["correct"] for module in questions["modules"] for q in module["questions"]}
    response = client.post("/api/submit", json={"user_id": user["id"], "attempt_id": first["attempt_id"],
                                               "answers": answers, "questions_snapshot": "forged"})
    assert response.status_code == 200
    assert set(response.json["scores"].values()) == {100}
    assert json.loads(response.json["questions_snapshot"]) == questions
    again = site.test_client()
    login(again)
    assert again.get(f'/api/results/my/{user["id"]}').json["algo"] == 100
    # A replay returns the original result without inserting it twice.
    assert client.post("/api/submit", json={"attempt_id": first["attempt_id"], "answers": answers}).json == response.json
    conn = database.get_connection()
    assert conn.execute("SELECT COUNT(*) FROM results WHERE user_id = ?", (user["id"],)).fetchone()[0] == 1
    conn.close()


def test_timeout_and_unknown_attempt(site):
    client = site.test_client()
    login(client)
    assert client.post("/api/submit", json={"attempt_id": "unknown", "answers": {}}).status_code == 400
    attempt = client.get("/api/questions").json
    assert client.post("/api/submit", json={"attempt_id": attempt["attempt_id"], "answers": {}}).status_code == 400
    result = client.post("/api/submit", json={"attempt_id": attempt["attempt_id"], "answers": {}, "timed_out": True})
    assert result.status_code == 200
    assert set(result.json["scores"].values()) == {0}


def test_private_upload_roundtrip_and_delete(site):
    client = site.test_client()
    user = login(client)
    content = b"%PDF-1.4 test document"
    uploaded = client.post("/api/portfolio", data={"user_id": str(user["id"]), "type": "certificate",
                           "title": "Test certificate", "file": (io.BytesIO(content), "test.pdf")})
    assert uploaded.status_code == 200
    item = client.get(f'/api/portfolio/{user["id"]}').json[0]
    url = "/api/portfolio/file/" + item["file_path"]
    assert client.get(url).data == content
    assert site.test_client().get(url).status_code == 401
    assert client.delete(f'/api/portfolio/{item["id"]}', json={"user_id": user["id"]}).status_code == 200
    assert client.get(url).status_code == 404


def test_admin_and_teacher_routes(site):
    client = site.test_client()
    admin = login(client, "admin", "admin123", "admin")
    assert client.get("/api/users").status_code == 200
    assert client.get(f'/api/activity/stats?user_id={admin["id"]}').status_code == 200
    assert client.get("/api/questions").status_code == 403
    teacher = site.test_client()
    user = login(teacher, "teacher1", "1234", "teacher")
    assert teacher.get("/api/results").status_code == 200
    assert teacher.get("/api/users").status_code == 403
    pinned = teacher.post("/api/teams/pin", json={"user_id": user["id"], "team": {"members": []}})
    assert pinned.status_code == 200
    assert teacher.delete(f'/api/teams/pin/{pinned.json["id"]}', json={"user_id": user["id"]}).status_code == 200
