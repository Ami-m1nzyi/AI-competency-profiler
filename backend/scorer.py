import json
from pathlib import Path

def load_question_map(current=None):
    if current is None:
        with open(Path(__file__).with_name("questions.json"), encoding="utf-8") as f:
            current = json.load(f)
    return {
        q["id"]: {
            "correct": q["correct"], "points": q["points"],
            "module_id": module["id"], "weight": module["weight"]
        }
        for module in current["modules"] for q in module["questions"]
    }

# Расчет баллов по модулям.
def calculate_scores(answers, questions=None):
    question_map = load_question_map(questions)
    # answers содержит ID вопросов и индексы выбранных вариантов.

    raw_scores = {
        "algo": 0,
        "coding": 0,
        "design": 0,
        "entrepreneur": 0,
        "teamwork": 0
    }
    max_scores = {
        "algo": 0,
        "coding": 0,
        "design": 0,
        "entrepreneur": 0,
        "teamwork": 0
    }

    for q_id, chosen in answers.items():
        if q_id not in question_map:
            continue
        q = question_map[q_id]
        mod = q["module_id"]
        max_scores[mod] += q["points"]
        if chosen == q["correct"]:
            raw_scores[mod] += q["points"]

    final_scores = {}
    for mod in raw_scores:
        if max_scores[mod] > 0:
            final_scores[mod] = round(raw_scores[mod] / max_scores[mod] * 100)
        else:
            final_scores[mod] = 0

    return final_scores

# Определение профиля.
def get_profile(scores):
    profile_map = {
        "coding":       "Разработчик (Developer)",
        "algo":         "Аналитик (Problem Solver)",
        "design":       "Дизайнер (UX/UI)",
        "entrepreneur": "Стартап-мышление (Startup Mindset)",
        "teamwork":     "Командный лидер (Leader)",
    }

    best_module = max(scores, key=lambda k: scores.get(k, 0))
    best_score  = scores.get(best_module, 0)

    # При низком максимальном балле профиль считается универсальным.
    if best_score < 45:
        return "Универсальный участник"

    return profile_map.get(best_module, "Универсальный участник")

# Рекомендации по профилю.
def get_recommendations(scores):
    recommendations = []

    if scores.get("algo", 0) >= 60:
        recommendations.append("Участвуй в олимпиадах по программированию")
    if scores.get("coding", 0) >= 60:
        recommendations.append("Попробуй роль Backend или Full-stack разработчика")
    if scores.get("design", 0) >= 60:
        recommendations.append("Развивай навыки UI/UX — Figma, прототипирование")
    if scores.get("entrepreneur", 0) >= 60:
        recommendations.append("Участвуй в хакатонах и стартап-конкурсах")
    if scores.get("teamwork", 0) >= 60:
        recommendations.append("Попробуй роль тимлида в следующем проекте")

    if not recommendations:
        recommendations.append("Попробуй углубиться в любое одно направление IT")

    return recommendations

def form_teams_without_ai(students, team_size=5):
    """
    students — список словарей с ключами:
        name, login, algo, coding, design, entrepreneur, teamwork, profile
    team_size — желаемый размер команды (4-5 человек)
    """
    if not students:
        return []

    for s in students:
        s["_total"] = s.get("algo", 0) + s.get("coding", 0) + s.get("design", 0) + \
                      s.get("entrepreneur", 0) + s.get("teamwork", 0)

    sorted_students = sorted(students, key=lambda s: s["_total"], reverse=True)

    num_teams = max(1, round(len(sorted_students) / team_size))
    teams = [[] for _ in range(num_teams)]

    # Распределяем студентов «змейкой», чтобы сбалансировать команды.
    forward = True
    idx = 0
    for student in sorted_students:
        teams[idx].append(student)
        if forward:
            idx += 1
            if idx == num_teams:
                idx -= 1
                forward = False
        else:
            idx -= 1
            if idx < 0:
                idx = 0
                forward = True

    result = []
    for i, team in enumerate(teams):
        members = []
        for s in team:
            members.append({
                "name": s.get("name"),
                "profile": s.get("profile"),
                "algo": s.get("algo"),
                "coding": s.get("coding"),
                "design": s.get("design"),
                "entrepreneur": s.get("entrepreneur"),
                "teamwork": s.get("teamwork"),
            })
        profiles_in_team = set(m["profile"] for m in members)
        result.append({
            "team_number": i + 1,
            "members": members,
            "description": f"Команда сбалансирована по общему баллу. Представлены роли: {', '.join(profiles_in_team)}."
        })

    return result
