import os
import smtplib
from email.mime.text import MIMEText
from email.mime.multipart import MIMEMultipart

def send_email(to_email: str, subject: str, body: str) -> bool:
    """
    Sends an email using SMTP. Falls back to printing to stdout if SMTP is not configured.
    """
    smtp_server = os.getenv("SMTP_SERVER", "")
    smtp_port = int(os.getenv("SMTP_PORT", "587"))
    smtp_username = os.getenv("SMTP_USERNAME", "")
    smtp_password = os.getenv("SMTP_PASSWORD", "")
    from_email = os.getenv("FROM_EMAIL", "no-reply@srinirvanaplaza.com")

    print(f"\n[EMAIL ENGINE] Sending Email to: {to_email}")
    print(f"[EMAIL ENGINE] Subject: {subject}")
    print(f"[EMAIL ENGINE] Body:\n{body}\n")

    if not smtp_server or not smtp_username or not smtp_password:
        print("[EMAIL ENGINE] SMTP is not fully configured. Email was simulated in development mode.")
        return True

    try:
        msg = MIMEMultipart()
        msg["From"] = from_email
        msg["To"] = to_email
        msg["Subject"] = subject
        msg.attach(MIMEText(body, "plain"))

        server = smtplib.SMTP(smtp_server, smtp_port)
        server.starttls()
        server.login(smtp_username, smtp_password)
        server.sendmail(from_email, to_email, msg.as_string())
        server.quit()
        print("[EMAIL ENGINE] Email sent successfully via SMTP.")
        return True
    except Exception as exc:
        print(f"[EMAIL ENGINE] SMTP Error: {exc}")
        return False
