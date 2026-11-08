import os
import json
import requests
from openai import OpenAI
from dotenv import load_dotenv

load_dotenv()

client = OpenAI(
    api_key=os.environ["OPENROUTER_API_KEY"],
    base_url="https://openrouter.ai/api/v1"
)
    



NORMAL_TIME = {
    "algo": 100,
    "coding": 100,
    "design": 100,
    "entrepreneur": 100,
    "teamwork": 100
}

MODULE_NAMES = {
    "algo": "Алгоритмическое мышление",
    "coding": "Кодинг",
    "design": "Дизайн-мышление",
    "entrepreneur": "Предпринимательство",
    "teamwork": "Командная работа"
}

def get_ai_recommendations(name, scores, profile, time_spent=None):
    scores_text = "\n".join([
        f"- {MODULE_NAMES[k]}: {v}%" for k, v in scores.items()
    ])

    time_text = ""
    if time_spent:
        slow_modules = []
        for mod, seconds in time_spent.items():
            normal = NORMAL_TIME.get(mod, 100)
            if seconds > normal * 1.5:
                slow_modules.append(MODULE_NAMES.get(mod, mod))

        if slow_modules:
            time_text = f"\nСтудент долго думал над модулями: {', '.join(slow_modules)}. Это может говорить о трудностях в этих областях."

    prompt = f"""
Ты — карьерный советник в сфере IT. Студент {name} прошёл тест на IT-компетенции.

Результаты:
{scores_text}
Профиль: {profile}
{time_text}

Дай персональные рекомендации на русском языке:
1. Что у студента получается хорошо (сильные стороны)
2. Что стоит развить (слабые стороны)
3. Какую IT-роль стоит рассмотреть
4. Конкретные ресурсы для обучения (курсы, книги, платформы)

Если были модули где студент долго думал — упомяни их отдельно и дай конкретный совет.
Пиши дружелюбно, как наставник. Ровно 150-200 слов — не больше и не меньше. Обязательно заверши мысль до конца. Не используй markdown, решётки, звёздочки — только обычный текст.
"""

    response = client.chat.completions.create(
        model="openrouter/auto",
        messages=[
            {"role": "user", "content": prompt}
        ],
        max_tokens=2000,
        temperature=0.7
    )

    return response.choices[0].message.content

def get_teams(students):
    students_text = "\n".join([
        f"- {r['name']} (профиль: {r['profile']}, алго: {r['algo']}%, кодинг: {r['coding']}%, дизайн: {r['design']}%, бизнес: {r['entrepreneur']}%, команда: {r['teamwork']}%)"
        for r in students
    ])

    prompt = f"""
Ты — HR-специалист. Распредели студентов на сбалансированные команды по 4-5 человек для хакатона.

Студенты и их компетенции:
{students_text}

Правила:
1. Каждая команда сбалансирована — разные профили в одной команде
2. В каждой команде желательно иметь разработчика, аналитика, и человека с сильной командной работой
3. Размер команды: 4-5 человек

Верни ТОЛЬКО валидный JSON без лишнего текста в таком формате:
{{
  "teams": [
    {{
      "members": [
        {{"name": "Имя Студента", "profile": "профиль", "algo": 75, "coding": 80, "design": 60, "entrepreneur": 70, "teamwork": 85, "role": "роль в команде"}},
        {{"name": "Имя Студента 2", "profile": "профиль", "algo": 70, "coding": 75, "design": 80, "entrepreneur": 65, "teamwork": 80, "role": "роль в команде"}}
      ],
      "description": "Обоснование почему эта команда хорошо сбалансирована"
    }}
  ]
}}

Пиши на русском языке в описании. Только JSON, никакого лишнего текста.
"""

    response = client.chat.completions.create(
        model="openrouter/auto",
        messages=[{"role": "user", "content": prompt}],
        max_tokens=2500,
        temperature=0.7
    )

    text = response.choices[0].message.content
    if not text:
        print(f"Ошибка: ИИ вернул пустой ответ. Response: {response}")
        return []

    text = text.replace("```json", "").replace("```", "").strip()

    try:
        result = json.loads(text)
        return result["teams"]
    except Exception as e:
        print(f"Ошибка парсинга команд: {e}")
        print(f"Текст: {text[:500]}")
        return []

def generate_questions():
    prompt = """
Сгенерируй тест из 25 вопросов для оценки IT-компетенций студентов.
5 вопросов на каждый модуль: algo, coding, design, entrepreneur, teamwork.

Верни ТОЛЬКО валидный JSON без лишнего текста в таком формате:
{
  "modules": [
    {
      "id": "algo",
      "label": "Алгоритмическое мышление",
      "weight": 0.20,
      "questions": [
        {
          "id": "algo_1",
          "text": "текст вопроса",
          "options": ["вариант А", "вариант Б", "вариант В", "вариант Г"],
          "correct": 0,
          "difficulty": "easy",
          "points": 10
        }
      ]
    }
  ]
}

Правила:
- difficulty: "easy" = 10 points, "medium" = 20 points
- Вопросы на русском языке
- correct — индекс правильного ответа (0, 1, 2 или 3)
- Модули: algo(weight 0.20), coding(0.20), design(0.20), entrepreneur(0.20), teamwork(0.20)
- Вопросы разнообразные, не повторяющиеся
- Только JSON, никакого лишнего текста
"""

    response = client.chat.completions.create(
        model="openrouter/auto",
        messages=[{"role": "user", "content": prompt}],
        max_tokens=6000,
        temperature=0.9
    )

    import json
    text = response.choices[0].message.content
    # Удаляем Markdown-обертку вокруг JSON.
    print("=== ОТВЕТ МОДЕЛИ ===")
    print(text[:500])
    print("===================")
    text = text.replace("```json", "").replace("```", "").strip()
    # Восстанавливаем обрезанный JSON.
    try:
        return json.loads(text)
    except:
        # Закрываем незавершенные массивы и объекты.
        text = text.rstrip()
        if not text.endswith('}'):
            text += ']}' * text.count('[') - text.count(']')
        
        text += '}' * text.count('{') - text.count('}')
    return json.loads(text)
