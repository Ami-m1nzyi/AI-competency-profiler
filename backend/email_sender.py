import os
import smtplib
from email.mime.text import MIMEText
from email.mime.multipart import MIMEMultipart
from dotenv import load_dotenv

load_dotenv()

SENDER_EMAIL = os.environ.get("SENDER_EMAIL")
SENDER_PASSWORD = os.environ.get("SENDER_PASSWORD")

def send_ticket_resolved_email(to_email, user_name, subject, admin_reply):
    """Отправляет письмо студенту/преподавателю когда его тикет закрыт"""

    msg = MIMEMultipart()
    msg["From"] = SENDER_EMAIL
    msg["To"] = to_email
    msg["Subject"] = f"Ваш запрос решён: {subject}"

    body = f"""
Здравствуйте, {user_name}!

Ваш запрос в поддержку AI Competency Profiler был рассмотрен и решён.

Тема запроса: {subject}

Комментарий от администратора:
{admin_reply if admin_reply else "Запрос решён без дополнительных комментариев."}

Если у вас остались вопросы — напишите нам снова через раздел "Поддержка" в настройках.

С уважением,
Команда AI Competency Profiler
"""

    msg.attach(MIMEText(body, "plain", "utf-8"))

    try:
        with smtplib.SMTP("smtp.gmail.com", 587) as server:
            server.starttls()
            server.login(SENDER_EMAIL, SENDER_PASSWORD)
            server.send_message(msg)
        return True
    except Exception as e:
        print(f"Ошибка отправки письма: {e}")
        return False

def send_invite_email(to_email, token, role):
    msg = MIMEMultipart()
    msg["From"] = SENDER_EMAIL
    msg["To"] = to_email
    msg["Subject"] = "Приглашение в AI Competency Profiler"

    role_name = "преподавателя" if role == "teacher" else role

    body = f"""
Здравствуйте!

Вас пригласили зарегистрироваться в системе AI Competency Profiler в роли {role_name}.

Ваш код приглашения: {token}

Введите этот код при регистрации в поле "Код приглашения".
Код действует один раз и привязан именно к этому email.

С уважением,
Команда AI Competency Profiler
"""
    msg.attach(MIMEText(body, "plain", "utf-8"))

    with smtplib.SMTP("smtp.gmail.com", 587) as server:
        server.starttls()
        server.login(SENDER_EMAIL, SENDER_PASSWORD)
        server.send_message(msg)