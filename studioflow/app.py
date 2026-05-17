from datetime import datetime

from flask import Flask, flash, redirect, render_template, request, url_for

from database import DB_PATH, get_connection, init_db
from services import email_service, file_service, order_file_generator


STATUSES = [
    "Ny session",
    "I valg",
    "Ordre bekræftet",
    "Til retouch",
    "I retouch",
    "Klar til print",
    "Klar til levering",
    "Afsluttet",
    "Problem",
    "Annulleret",
]
PRODUCTS = ["Digital", "Print", "Ramme", "Canvas", "Album"]
SIZES = ["-", "10x15", "13x18", "20x30", "30x40", "50x70"]
FRAMES = ["Ingen ramme", "Hvid ramme", "Sort ramme", "Guld ramme"]
VARIANTS = ["Farve", "Sort/hvid", "Begge"]
RETOUCH_TYPES = ["Ingen", "Standard", "Ekstra"]
DEFAULT_RETOUCHERS = ["-", "Nadhif", "Marija"]


app = Flask(__name__)
app.secret_key = "studioflow-local-mvp"
init_db()


def now_text():
    return datetime.now().isoformat(timespec="seconds")


def today_text():
    return datetime.now().date().isoformat()


def normalize_optional(value):
    value = (value or "").strip()
    return value if value else None


def row_to_dict(row):
    return {key: row[key] for key in row.keys()}


def get_settings():
    with get_connection() as connection:
        rows = connection.execute("SELECT key, value FROM settings").fetchall()
    return {row["key"]: row["value"] for row in rows}


def save_settings(values):
    with get_connection() as connection:
        for key, value in values.items():
            connection.execute(
                "INSERT INTO settings (key, value) VALUES (?, ?) "
                "ON CONFLICT(key) DO UPDATE SET value = excluded.value",
                (key, value),
            )
        connection.commit()


def setting_enabled(settings, key):
    return settings.get(key) in {"1", "true", "yes", "ja", "on"}


def generate_order_number(connection, date_value):
    compact_date = date_value.replace("-", "")
    prefix = f"FG-{compact_date}-"
    row = connection.execute(
        "SELECT order_number FROM orders WHERE order_number LIKE ? ORDER BY order_number DESC LIMIT 1",
        (f"{prefix}%",),
    ).fetchone()
    next_number = 1
    if row:
        try:
            next_number = int(row["order_number"].rsplit("-", 1)[1]) + 1
        except (ValueError, IndexError):
            next_number = 1
    return f"{prefix}{next_number:03d}"


def find_or_create_customer(connection, name, phone, email, notes):
    query = "SELECT * FROM customers WHERE lower(name) = lower(?)"
    params = [name]
    if email:
        query += " AND lower(COALESCE(email, '')) = lower(?)"
        params.append(email)
    elif phone:
        query += " AND COALESCE(phone, '') = ?"
        params.append(phone)
    query += " ORDER BY id LIMIT 1"
    existing = connection.execute(query, params).fetchone()
    if existing:
        updates = {
            "phone": existing["phone"] or phone,
            "email": existing["email"] or email,
            "notes": existing["notes"] or notes,
        }
        connection.execute(
            "UPDATE customers SET phone = ?, email = ?, notes = ? WHERE id = ?",
            (updates["phone"], updates["email"], updates["notes"], existing["id"]),
        )
        return existing["id"]

    cursor = connection.execute(
        "INSERT INTO customers (name, phone, email, notes, created_at) VALUES (?, ?, ?, ?, ?)",
        (name, phone, email, notes, now_text()),
    )
    return cursor.lastrowid


def get_order(order_id):
    with get_connection() as connection:
        return connection.execute(
            """
            SELECT
                o.*,
                s.customer_id,
                s.session_date,
                s.session_type,
                s.photographer,
                s.folder_path,
                s.status AS session_status,
                c.name AS customer_name,
                c.phone,
                c.email,
                c.notes AS customer_notes
            FROM orders o
            JOIN sessions s ON s.id = o.session_id
            JOIN customers c ON c.id = s.customer_id
            WHERE o.id = ?
            """,
            (order_id,),
        ).fetchone()


def get_order_items(order_id):
    with get_connection() as connection:
        return connection.execute(
            "SELECT * FROM order_items WHERE order_id = ? ORDER BY id",
            (order_id,),
        ).fetchall()


def latest_email_log(order_id):
    with get_connection() as connection:
        return connection.execute(
            "SELECT * FROM email_log WHERE order_id = ? ORDER BY created_at DESC LIMIT 1",
            (order_id,),
        ).fetchone()


def sync_order_status(connection, order_id, status):
    order = connection.execute("SELECT session_id FROM orders WHERE id = ?", (order_id,)).fetchone()
    if not order:
        return
    connection.execute("UPDATE orders SET status = ? WHERE id = ?", (status, order_id))
    connection.execute("UPDATE sessions SET status = ? WHERE id = ?", (status, order["session_id"]))


def generate_files_for_order(order, items):
    settings = get_settings()
    is_valid, message = file_service.validate_writable_folder(
        order["folder_path"], settings.get("base_folder_path")
    )
    if not is_valid:
        with get_connection() as connection:
            sync_order_status(connection, order["id"], "Problem")
            connection.commit()
        return False, message, []

    contents = order_file_generator.build_all_files(order, items)
    results = file_service.write_generated_files(order["folder_path"], contents)
    return True, "Ordrefiler er genereret.", results


def validate_item_form(form):
    errors = []
    image_filename = (form.get("image_filename") or "").strip()
    product = (form.get("product") or "").strip()
    size = (form.get("size") or "").strip()
    frame = (form.get("frame") or "").strip()
    quantity_raw = (form.get("quantity") or "").strip()
    variant = (form.get("variant") or "").strip()
    retouch_type = (form.get("retouch_type") or "").strip()
    retoucher = (form.get("retoucher") or "").strip()
    notes = (form.get("notes") or "").strip()

    if not image_filename:
        errors.append("Billednummer / filnavn skal udfyldes.")
    if product not in PRODUCTS:
        errors.append("Produkt skal vælges.")
    try:
        quantity = int(quantity_raw)
        if quantity < 1:
            errors.append("Antal skal være mindst 1.")
    except ValueError:
        quantity = 0
        errors.append("Antal skal være et tal.")
    if variant not in VARIANTS:
        errors.append("Variant skal vælges.")
    if retouch_type not in RETOUCH_TYPES:
        errors.append("Retouch skal vælges.")
    if product in {"Print", "Ramme"} and (not size or size == "-"):
        errors.append("Størrelse skal vælges for Print og Ramme.")

    return errors, {
        "image_filename": image_filename,
        "product": product,
        "size": size,
        "frame": frame or "Ingen ramme",
        "quantity": quantity,
        "variant": variant,
        "retouch_type": retouch_type,
        "retoucher": retoucher or "-",
        "notes": notes,
    }


@app.context_processor
def inject_globals():
    settings = get_settings()
    retouchers = [
        retoucher.strip()
        for retoucher in settings.get("default_retouchers", "").split(",")
        if retoucher.strip()
    ]
    return {
        "STATUSES": STATUSES,
        "studio_name": settings.get("studio_name", "StudioFlow"),
        "retoucher_options": ["-"] + [item for item in retouchers if item != "-"],
    }


@app.template_filter("date_da")
def date_da(value):
    return order_file_generator.format_date(value)


@app.template_filter("status_class")
def status_class(value):
    mapping = {
        "Ny session": "new",
        "I valg": "selecting",
        "Ordre bekræftet": "confirmed",
        "Til retouch": "retouch",
        "I retouch": "retouching",
        "Klar til print": "print",
        "Klar til levering": "delivery",
        "Afsluttet": "done",
        "Problem": "problem",
        "Annulleret": "cancelled",
    }
    return mapping.get(value, "neutral")


@app.route("/")
def dashboard():
    summary_items = [
        ("Ny session", "Nye sessioner"),
        ("Ordre bekræftet", "Ordre bekræftet"),
        ("Til retouch", "Til retouch"),
        ("Klar til print", "Klar til print"),
        ("Klar til levering", "Klar til levering"),
        ("Problem", "Problem"),
    ]
    with get_connection() as connection:
        rows = connection.execute(
            "SELECT status, COUNT(*) AS count FROM orders GROUP BY status"
        ).fetchall()
        counts = {row["status"]: row["count"] for row in rows}
        orders = connection.execute(
            """
            SELECT
                o.id,
                o.order_number,
                o.status,
                s.session_date,
                s.photographer,
                s.folder_path,
                c.id AS customer_id,
                c.name AS customer_name,
                (
                    SELECT group_concat(DISTINCT oi.retoucher)
                    FROM order_items oi
                    WHERE oi.order_id = o.id
                      AND COALESCE(oi.retoucher, '') NOT IN ('', '-')
                ) AS retouchers
            FROM orders o
            JOIN sessions s ON s.id = o.session_id
            JOIN customers c ON c.id = s.customer_id
            ORDER BY s.session_date DESC, o.id DESC
            """
        ).fetchall()
    summary = [{"status": status, "label": label, "count": counts.get(status, 0)} for status, label in summary_items]
    return render_template("dashboard.html", summary=summary, orders=orders)


@app.route("/sessions/new", methods=["GET", "POST"])
def new_session():
    form_data = {"session_date": today_text()}
    if request.method == "POST":
        form_data = request.form.to_dict()
        name = (request.form.get("name") or "").strip()
        phone = normalize_optional(request.form.get("phone"))
        email = normalize_optional(request.form.get("email"))
        notes = normalize_optional(request.form.get("notes"))
        session_date = (request.form.get("session_date") or "").strip()
        session_type = normalize_optional(request.form.get("session_type"))
        photographer = normalize_optional(request.form.get("photographer"))
        folder_path = (request.form.get("folder_path") or "").strip()

        errors = []
        if not name:
            errors.append("Kundenavn skal udfyldes.")
        if not session_date:
            errors.append("Sessionsdato skal udfyldes.")
        if not folder_path:
            errors.append("Servermappe skal udfyldes.")

        if errors:
            for error in errors:
                flash(error, "error")
            return render_template("new_session.html", form_data=form_data)

        settings = get_settings()
        with get_connection() as connection:
            customer_id = find_or_create_customer(connection, name, phone, email, notes)
            order_number = generate_order_number(connection, session_date)

            if setting_enabled(settings, "enable_folder_creation"):
                try:
                    folder_path = file_service.create_order_folder_structure(
                        settings.get("base_folder_path"), session_date, order_number, name
                    )
                    flash("Mappestruktur er oprettet.", "success")
                except ValueError as exc:
                    flash(str(exc), "error")

            cursor = connection.execute(
                """
                INSERT INTO sessions
                    (customer_id, session_date, session_type, photographer, folder_path, status, created_at)
                VALUES (?, ?, ?, ?, ?, ?, ?)
                """,
                (customer_id, session_date, session_type, photographer, folder_path, "Ny session", now_text()),
            )
            session_id = cursor.lastrowid
            order_cursor = connection.execute(
                """
                INSERT INTO orders
                    (order_number, session_id, status, deadline, notes, created_at, confirmed_at)
                VALUES (?, ?, ?, ?, ?, ?, ?)
                """,
                (order_number, session_id, "Ny session", None, None, now_text(), None),
            )
            connection.commit()
            order_id = order_cursor.lastrowid

        flash(f"Session og ordre {order_number} er oprettet.", "success")
        return redirect(url_for("order_detail", order_id=order_id))

    return render_template("new_session.html", form_data=form_data)


@app.route("/orders/<int:order_id>")
def order_detail(order_id):
    order = get_order(order_id)
    if not order:
        flash("Ordren blev ikke fundet.", "error")
        return redirect(url_for("dashboard"))
    items = get_order_items(order_id)
    folder_found = file_service.path_exists(order["folder_path"])
    file_statuses = file_service.generated_file_status(order["folder_path"])
    email_log = latest_email_log(order_id)
    return render_template(
        "order_detail.html",
        order=order,
        items=items,
        folder_found=folder_found,
        file_statuses=file_statuses,
        email_log=email_log,
    )


@app.route("/orders/<int:order_id>/status", methods=["POST"])
def update_status(order_id):
    status = request.form.get("status")
    if status not in STATUSES:
        flash("Status er ugyldig.", "error")
        return redirect(url_for("dashboard"))
    with get_connection() as connection:
        sync_order_status(connection, order_id, status)
        connection.commit()
    flash("Status er opdateret.", "success")
    return redirect(request.referrer or url_for("dashboard"))


@app.route("/orders/<int:order_id>/items/new", methods=["GET", "POST"])
def new_item(order_id):
    order = get_order(order_id)
    if not order:
        flash("Ordren blev ikke fundet.", "error")
        return redirect(url_for("dashboard"))
    form_data = {"quantity": "1", "frame": "Ingen ramme", "size": "-", "retoucher": "-"}
    if request.method == "POST":
        errors, cleaned = validate_item_form(request.form)
        form_data = request.form.to_dict()
        if errors:
            for error in errors:
                flash(error, "error")
        else:
            with get_connection() as connection:
                connection.execute(
                    """
                    INSERT INTO order_items
                        (order_id, image_filename, product, size, frame, quantity, variant, retouch_type, retoucher, notes)
                    VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
                    """,
                    (
                        order_id,
                        cleaned["image_filename"],
                        cleaned["product"],
                        cleaned["size"],
                        cleaned["frame"],
                        cleaned["quantity"],
                        cleaned["variant"],
                        cleaned["retouch_type"],
                        cleaned["retoucher"],
                        cleaned["notes"],
                    ),
                )
                if order["status"] == "Ny session":
                    sync_order_status(connection, order_id, "I valg")
                connection.commit()
            flash("Billedet er tilføjet til ordren.", "success")
            return redirect(url_for("order_detail", order_id=order_id))
    return render_template(
        "add_item.html",
        order=order,
        item=None,
        form_data=form_data,
        products=PRODUCTS,
        sizes=SIZES,
        frames=FRAMES,
        variants=VARIANTS,
        retouch_types=RETOUCH_TYPES,
        page_title="Tilføj billede til ordre",
    )


@app.route("/orders/<int:order_id>/items/<int:item_id>/edit", methods=["GET", "POST"])
def edit_item(order_id, item_id):
    order = get_order(order_id)
    if not order:
        flash("Ordren blev ikke fundet.", "error")
        return redirect(url_for("dashboard"))
    with get_connection() as connection:
        item = connection.execute(
            "SELECT * FROM order_items WHERE id = ? AND order_id = ?",
            (item_id, order_id),
        ).fetchone()
    if not item:
        flash("Ordrelinjen blev ikke fundet.", "error")
        return redirect(url_for("order_detail", order_id=order_id))

    form_data = row_to_dict(item)
    if request.method == "POST":
        errors, cleaned = validate_item_form(request.form)
        form_data = request.form.to_dict()
        if errors:
            for error in errors:
                flash(error, "error")
        else:
            with get_connection() as connection:
                connection.execute(
                    """
                    UPDATE order_items
                    SET image_filename = ?, product = ?, size = ?, frame = ?, quantity = ?,
                        variant = ?, retouch_type = ?, retoucher = ?, notes = ?
                    WHERE id = ? AND order_id = ?
                    """,
                    (
                        cleaned["image_filename"],
                        cleaned["product"],
                        cleaned["size"],
                        cleaned["frame"],
                        cleaned["quantity"],
                        cleaned["variant"],
                        cleaned["retouch_type"],
                        cleaned["retoucher"],
                        cleaned["notes"],
                        item_id,
                        order_id,
                    ),
                )
                connection.commit()
            flash("Ordrelinjen er opdateret.", "success")
            return redirect(url_for("order_detail", order_id=order_id))

    return render_template(
        "add_item.html",
        order=order,
        item=item,
        form_data=form_data,
        products=PRODUCTS,
        sizes=SIZES,
        frames=FRAMES,
        variants=VARIANTS,
        retouch_types=RETOUCH_TYPES,
        page_title="Rediger billede i ordre",
    )


@app.route("/orders/<int:order_id>/confirm", methods=["GET", "POST"])
def confirm_order(order_id):
    order = get_order(order_id)
    if not order:
        flash("Ordren blev ikke fundet.", "error")
        return redirect(url_for("dashboard"))
    items = get_order_items(order_id)
    if request.method == "POST":
        errors = []
        if not order["customer_name"]:
            errors.append("Ordren mangler kunde.")
        if not order["folder_path"]:
            errors.append("Ordren mangler servermappe.")
        if not items:
            errors.append("Ordren skal have mindst ét billede.")
        if errors:
            for error in errors:
                flash(error, "error")
            return render_template("confirm_order.html", order=order, items=items)

        order_for_files = row_to_dict(order)
        order_for_files["status"] = "Ordre bekræftet"
        success, message, _results = generate_files_for_order(order_for_files, items)
        if not success:
            flash(message, "error")
            return redirect(url_for("order_detail", order_id=order_id))

        with get_connection() as connection:
            connection.execute(
                "UPDATE orders SET status = ?, confirmed_at = ? WHERE id = ?",
                ("Ordre bekræftet", now_text(), order_id),
            )
            connection.execute(
                "UPDATE sessions SET status = ? WHERE id = ?",
                ("Ordre bekræftet", order["session_id"]),
            )
            connection.commit()
        flash("Ordren er bekræftet, og ordrefilerne er oprettet.", "success")
        return redirect(url_for("order_detail", order_id=order_id))
    return render_template("confirm_order.html", order=order, items=items)


@app.route("/orders/<int:order_id>/files", methods=["GET", "POST"])
def generated_files(order_id):
    order = get_order(order_id)
    if not order:
        flash("Ordren blev ikke fundet.", "error")
        return redirect(url_for("dashboard"))
    items = get_order_items(order_id)
    if request.method == "POST":
        if not items:
            flash("Ordren skal have mindst ét billede, før filer kan genereres.", "error")
        else:
            success, message, results = generate_files_for_order(order, items)
            flash(message, "success" if success else "error")
            backups = [result["backup"] for result in results if result.get("backup")]
            if backups:
                flash("Eksisterende filer blev sikkerhedskopieret før overskrivning.", "warning")
        return redirect(url_for("generated_files", order_id=order_id))

    file_statuses = file_service.generated_file_status(order["folder_path"])
    previews = {
        status["filename"]: file_service.read_generated_file(order["folder_path"], status["filename"])
        for status in file_statuses
    }
    return render_template(
        "generated_files.html",
        order=order,
        items=items,
        file_statuses=file_statuses,
        previews=previews,
    )


@app.route("/orders/<int:order_id>/email", methods=["GET", "POST"])
def email_preview(order_id):
    order = get_order(order_id)
    if not order:
        flash("Ordren blev ikke fundet.", "error")
        return redirect(url_for("dashboard"))
    items = get_order_items(order_id)
    settings = get_settings()
    preview = email_service.build_email(order, items)
    form_data = {
        "email_to": "",
        "subject": preview["subject"],
        "body": preview["body"],
        "retoucher": preview["retoucher"],
    }

    if request.method == "POST":
        action = request.form.get("action")
        form_data = request.form.to_dict()
        email_to = (request.form.get("email_to") or "").strip()
        subject = (request.form.get("subject") or "").strip()
        body = (request.form.get("body") or "").strip()
        retoucher = (request.form.get("retoucher") or "").strip()

        if action == "cancel":
            return redirect(url_for("order_detail", order_id=order_id))

        status = "Klargjort"
        sent_at = None
        error_message = None

        if action == "send" and email_service.smtp_configured(settings):
            if not email_to:
                flash("Emailmodtager skal udfyldes for at sende.", "error")
                return render_template("email_preview.html", order=order, items=items, form_data=form_data)
            try:
                email_service.send_email(settings, email_to, subject, body)
                status = "Sendt"
                sent_at = now_text()
                flash("Email er sendt til retouchør.", "success")
            except Exception as exc:  # pragma: no cover - depends on external SMTP.
                status = "Fejl"
                error_message = str(exc)
                flash("Email kunne ikke sendes. Den er gemt i loggen med fejlstatus.", "error")
        else:
            flash("Email klargjort, men ikke sendt.", "warning")

        with get_connection() as connection:
            connection.execute(
                """
                INSERT INTO email_log
                    (order_id, retoucher, email_to, subject, body, status, created_at, sent_at, error_message)
                VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)
                """,
                (order_id, retoucher, email_to, subject, body, status, now_text(), sent_at, error_message),
            )
            if status in {"Klargjort", "Sendt"} and order["status"] == "Ordre bekræftet":
                sync_order_status(connection, order_id, "Til retouch")
            connection.commit()
        return redirect(url_for("order_detail", order_id=order_id))

    return render_template("email_preview.html", order=order, items=items, form_data=form_data)


@app.route("/customers")
def customers():
    with get_connection() as connection:
        rows = connection.execute(
            """
            SELECT
                c.*,
                COUNT(DISTINCT s.id) AS session_count,
                MAX(s.session_date) AS latest_session_date
            FROM customers c
            LEFT JOIN sessions s ON s.customer_id = c.id
            GROUP BY c.id
            ORDER BY c.name
            """
        ).fetchall()
    return render_template("customers.html", customers=rows)


@app.route("/customers/<int:customer_id>")
def customer_profile(customer_id):
    with get_connection() as connection:
        customer = connection.execute("SELECT * FROM customers WHERE id = ?", (customer_id,)).fetchone()
        rows = connection.execute(
            """
            SELECT
                s.session_date,
                s.session_type,
                s.photographer,
                s.folder_path,
                o.id AS order_id,
                o.order_number,
                o.status
            FROM sessions s
            LEFT JOIN orders o ON o.session_id = s.id
            WHERE s.customer_id = ?
            ORDER BY s.session_date DESC, s.id DESC
            """,
            (customer_id,),
        ).fetchall()
    if not customer:
        flash("Kunden blev ikke fundet.", "error")
        return redirect(url_for("customers"))
    return render_template("customer_profile.html", customer=customer, sessions=rows)


@app.route("/settings", methods=["GET", "POST"])
def settings():
    settings_values = get_settings()
    if request.method == "POST":
        updated = {
            "studio_name": (request.form.get("studio_name") or "").strip(),
            "base_folder_path": (request.form.get("base_folder_path") or "").strip(),
            "enable_folder_creation": "1" if request.form.get("enable_folder_creation") == "1" else "0",
            "default_retouchers": (request.form.get("default_retouchers") or "").strip(),
            "smtp_host": (request.form.get("smtp_host") or "").strip(),
            "smtp_port": (request.form.get("smtp_port") or "").strip(),
            "smtp_username": (request.form.get("smtp_username") or "").strip(),
            "smtp_password": (request.form.get("smtp_password") or "").strip(),
            "smtp_sender_email": (request.form.get("smtp_sender_email") or "").strip(),
        }
        save_settings(updated)
        flash("Indstillinger er gemt.", "success")
        return redirect(url_for("settings"))
    return render_template("settings.html", settings=settings_values, db_path=DB_PATH)


if __name__ == "__main__":
    app.run(host="0.0.0.0", port=5000, debug=False)
