import smtplib
from email.message import EmailMessage

from services.order_file_generator import value


def retouch_items(items):
    return [item for item in items if value(item, "retouch_type") != "Ingen"]


def first_retoucher(items):
    for item in retouch_items(items):
        retoucher = value(item, "retoucher")
        if retoucher and retoucher != "-":
            return retoucher
    return ""


def build_email(order, items, retoucher=None):
    selected_retoucher = retoucher or first_retoucher(items)
    greeting = f"Hej {selected_retoucher}," if selected_retoucher else "Hej,"
    subject = f"Retouchordre {value(order, 'order_number')} - {value(order, 'customer_name')}"
    lines = [
        greeting,
        "",
        "Der er en ny retouchordre klar.",
        "",
        f"Ordre ID: {value(order, 'order_number')}",
        f"Kunde: {value(order, 'customer_name')}",
        f"Mappe: {value(order, 'folder_path')}",
        "",
        "Billeder til retouch:",
    ]

    selected_items = retouch_items(items)
    if not selected_items:
        lines.append("Ingen billeder er markeret til retouch.")
    else:
        for item in selected_items:
            note = value(item, "notes", "-")
            lines.append(
                f"{value(item, 'image_filename')} - {value(item, 'retouch_type')} retouch - {note}"
            )

    lines.extend(["", "Se også retouch_list.txt i kundemappen.", "", "Venlig hilsen", "StudioFlow"])
    return {
        "retoucher": selected_retoucher,
        "subject": subject,
        "body": "\n".join(lines),
    }


def smtp_configured(settings):
    return bool(
        settings.get("smtp_host")
        and settings.get("smtp_port")
        and settings.get("smtp_sender_email")
    )


def send_email(settings, to_address, subject, body):
    message = EmailMessage()
    message["From"] = settings.get("smtp_sender_email", "")
    message["To"] = to_address
    message["Subject"] = subject
    message.set_content(body)

    host = settings.get("smtp_host")
    port = int(settings.get("smtp_port") or 25)
    username = settings.get("smtp_username")
    password = settings.get("smtp_password")

    with smtplib.SMTP(host, port, timeout=20) as smtp:
        if port == 587:
            smtp.starttls()
        if username and password:
            smtp.login(username, password)
        smtp.send_message(message)
