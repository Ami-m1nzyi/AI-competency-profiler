import random
from database import init_db, add_user, find_user, save_result, add_portfolio_item, add_support_request

random.seed(42)
init_db()

PASSWORD = "1234"  # общий пароль для всех демо-аккаунтов
DOMAIN = "student.university.kz"  # домен почты студентов

# Группы: номер группы, название группы, курс
GROUPS = {
    "A": ("ИС-203", "Информационные вычислительные технологии", "2"),
    "B": ("ИС-204", "Информационные вычислительные технологии", "2"),
    "C": ("CS-301", "Программная инженерия", "3"),
    "D": ("CS-302", "Программная инженерия", "3"),
    "E": ("CS-401", "Программная инженерия", "4"),
    "F": ("ИС-101", "Информационные вычислительные технологии", "1"),
}

# Студенты: (фамилия, имя, отчество, латинский логин, группа, сильная сторона)
# сильная сторона: algo / coding / design / entrepreneur / teamwork / None (универсал)
STUDENTS = [
    ("Сериков", "Айдос", "Ерланович", "a.serikov", "A", "coding"),
    ("Ибрагимова", "Аружан", "Бауыржановна", "a.ibragimova", "A", "design"),
    ("Касымов", "Нурсултан", "Маратович", "n.kasymov", "A", "algo"),
    ("Петрова", "Анна", "Сергеевна", "a.petrova", "A", "teamwork"),
    ("Жаксылыкова", "Динара", "Асхатовна", "d.zhaksylykova", "A", None),
    ("Оспанов", "Данияр", "Нурланович", "d.ospanov", "B", "coding"),
    ("Смирнов", "Дмитрий", "Алексеевич", "d.smirnov", "B", "entrepreneur"),
    ("Бекенова", "Айгерим", "Талгатовна", "a.bekenova", "B", "algo"),
    ("Ким", "Виктория", "Ивановна", "v.kim", "B", "design"),
    ("Нургалиев", "Арман", "Куанышевич", "a.nurgaliev", "B", "teamwork"),
    ("Аманжолова", "Мадина", "Серикбаевна", "m.amanzholova", "C", "coding"),
    ("Иванов", "Максим", "Андреевич", "m.ivanov", "C", "algo"),
    ("Тулегенов", "Ерлан", "Бахытович", "e.tulegenov", "C", "entrepreneur"),
    ("Соколова", "Екатерина", "Дмитриевна", "e.sokolova", "C", "design"),
    ("Мукашева", "Алия", "Ермековна", "a.mukasheva", "C", "teamwork"),
    ("Султанов", "Бекзат", "Аскарович", "b.sultanov", "D", "coding"),
    ("Шмидт", "Артур", "Владимирович", "a.schmidt", "D", "algo"),
    ("Оразбаева", "Томирис", "Нуржановна", "t.orazbaeva", "D", None),
    ("Козлов", "Никита", "Павлович", "n.kozlov", "D", "coding"),
    ("Кенжебаев", "Азамат", "Русланович", "a.kenzhebaev", "D", "entrepreneur"),
    ("Абдрахманова", "Аяулым", "Каировна", "a.abdrakhmanova", "E", "teamwork"),
    ("Пак", "Александр", "Игоревич", "a.pak", "E", "algo"),
    ("Есенов", "Тимур", "Даулетович", "t.esenov", "E", "coding"),
    ("Фёдорова", "Ольга", "Николаевна", "o.fedorova", "E", "design"),
    ("Байжанов", "Мирас", "Ержанович", "m.baizhanov", "E", "entrepreneur"),
    ("Ахметова", "Камила", "Дастановна", "k.akhmetova", "F", "design"),
    ("Ташимов", "Рустем", "Амирович", "r.tashimov", "F", "algo"),
    ("Волкова", "Мария", "Олеговна", "m.volkova", "F", None),
    ("Досымбеков", "Алихан", "Ермекович", "a.dosymbekov", "F", "teamwork"),
    ("Мусина", "Жания", "Айдаровна", "zh.musina", "F", "coding"),
]

# Профили
PROFILE_MAP = {
    "coding": "Разработчик (Developer)",
    "algo": "Аналитик (Problem Solver)",
    "design": "Дизайнер (UX/UI)",
    "entrepreneur": "Стартап-мышление (Startup Mindset)",
    "teamwork": "Командный лидер (Leader)",
}

# Короткие рекомендации для каждого профиля (вместо ответа ИИ)
RECOMMENDATIONS = {
    "Разработчик (Developer)": "Сильная сторона — программирование. Попробуйте роль Backend или Full-stack разработчика, участвуйте в open-source. Стоит подтянуть дизайн-мышление и предпринимательство. Ресурсы: Stepik, freeCodeCamp, книга «Чистый код».",
    "Аналитик (Problem Solver)": "Отличное алгоритмическое мышление. Рассмотрите роли Data Analyst или Backend-инженера, участвуйте в олимпиадах. Развивайте командную работу. Ресурсы: LeetCode, Codeforces, курсы по структурам данных.",
    "Дизайнер (UX/UI)": "Хорошее дизайн-мышление. Подойдут роли UX/UI-дизайнера и Product Designer. Освойте Figma и основы фронтенда. Ресурсы: Figma Community, курсы по UX-исследованиям.",
    "Стартап-мышление (Startup Mindset)": "Сильное предпринимательское мышление. Рассмотрите роли Product Manager и основателя стартапа, участвуйте в хакатонах. Подтяните технические навыки. Ресурсы: книга «Бизнес с нуля», акселераторы.",
    "Командный лидер (Leader)": "Сильная командная работа и коммуникация. Подойдут роли Team Lead и Scrum Master. Попробуйте возглавить проект на хакатоне. Ресурсы: книга «Scrum», курсы по управлению командами.",
    "Универсальный участник": "Пока баллы ровные и невысокие, это нормально для начала. Попробуйте разные направления IT и выберите одно для углубления. Ресурсы: Coursera, Stepik, ознакомительные курсы.",
}

MODULES = ["algo", "coding", "design", "entrepreneur", "teamwork"]

def make_scores(strong):
    if strong is None:
        return {m: random.randrange(20, 45, 5) for m in MODULES}
    scores = {m: random.randrange(25, 70, 5) for m in MODULES}
    scores[strong] = random.randrange(75, 101, 5)
    return scores

def get_profile(scores):
    best = max(scores, key=lambda k: scores[k])
    if scores[best] < 45:
        return "Универсальный участник"
    return PROFILE_MAP[best]

# Примеры записей портфолио: (тип, название, описание, ссылка)
PORTFOLIO = [
    ("certificate", "Python для начинающих", "Сертификат Stepik", "https://stepik.org"),
    ("project", "Сайт-визитка", "Проект на HTML/CSS/JS", "https://github.com"),
    ("diploma", "Диплом олимпиады по информатике", "Университетский этап", ""),
    ("article", "Статья про ИИ в образовании", "Публикация на студенческой конференции", ""),
    ("certificate", "Основы UX-дизайна", "Курс Coursera", "https://coursera.org"),
    ("project", "Telegram-бот для расписания", "Проект на Python", "https://github.com"),
]

# Создаём студентов
created = 0
for i, (last, first, middle, login, gkey, strong) in enumerate(STUDENTS):
    email = f"{login}@{DOMAIN}"
    group_number, group_name, course = GROUPS[gkey]
    full_name = f"{last} {first} {middle}"
    ok = add_user(full_name, email, PASSWORD, "student", first, last, middle, email, group_number, group_name, course)
    if not ok:
        continue
    created += 1
    user_id = find_user(email)["id"]
    scores = make_scores(strong)
    profile = get_profile(scores)
    time_taken = f"{random.randint(18, 58)} мин {random.randint(0, 59)} сек"
    save_result(user_id, scores, profile, RECOMMENDATIONS[profile], time_taken=time_taken)
    if i % 3 == 0:
        t, title, desc, link = PORTFOLIO[i % len(PORTFOLIO)]
        add_portfolio_item(user_id, t, title, desc, link)

# Создаём преподавателей
TEACHERS = [
    ("Нурпеисова", "Гульмира", "Асановна", "g.nurpeisova"),
    ("Кузнецов", "Андрей", "Викторович", "a.kuznetsov"),
]
for last, first, middle, login in TEACHERS:
    email = f"{login}@university.kz"
    add_user(f"{last} {first} {middle}", email, PASSWORD, "teacher", first, last, middle, email)

# Создаём пару обращений в поддержку
uid1 = find_user("a.serikov@" + DOMAIN)["id"]
uid2 = find_user("d.ospanov@" + DOMAIN)["id"]
add_support_request(uid1, "Не открывается тест", "После входа вкладка «Тестирование» долго загружается.")
add_support_request(uid2, "Забыл пароль", "Прошу сбросить пароль для моего аккаунта.")

print(f"Готово! Создано студентов: {created}")
print(f"Логин: email студента, пароль: {PASSWORD}")