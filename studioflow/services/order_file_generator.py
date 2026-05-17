PRINT_PRODUCTS = {"Print", "Ramme", "Canvas", "Album"}


def value(row, key, default=""):
    if row is None:
        return default
    try:
        result = row[key]
    except (KeyError, IndexError, TypeError):
        result = getattr(row, key, default)
    return result if result not in (None, "") else default


def format_date(date_value):
    if not date_value:
        return "-"
    parts = str(date_value).split("-")
    if len(parts) == 3:
        return f"{parts[2]}/{parts[1]}/{parts[0]}"
    return str(date_value)


def item_block(item):
    lines = [
        value(item, "image_filename"),
        f"- Produkt: {value(item, 'product')}",
    ]
    if value(item, "size"):
        lines.append(f"- Størrelse: {value(item, 'size')}")
    if value(item, "frame"):
        lines.append(f"- Ramme: {value(item, 'frame')}")
    lines.extend(
        [
            f"- Antal: {value(item, 'quantity')}",
            f"- Variant: {value(item, 'variant')}",
            f"- Retouch: {value(item, 'retouch_type')}",
        ]
    )
    if value(item, "retoucher") and value(item, "retoucher") != "-":
        lines.append(f"- Retouchør: {value(item, 'retoucher')}")
    if value(item, "notes") and value(item, "notes") != "-":
        lines.append(f"- Note: {value(item, 'notes')}")
    return "\n".join(lines)


def order_header(order):
    return "\n".join(
        [
            f"ORDRE: {value(order, 'order_number')}",
            f"Kunde: {value(order, 'customer_name')}",
            f"Telefon: {value(order, 'phone', '-')}",
            f"Email: {value(order, 'email', '-')}",
            f"Dato: {format_date(value(order, 'session_date'))}",
            f"Fotograf: {value(order, 'photographer', '-')}",
            f"Mappe: {value(order, 'folder_path')}",
            f"Status: {value(order, 'status')}",
        ]
    )


def build_order_info(order, items):
    lines = [order_header(order), "", "ORDRELINJER:", ""]
    if not items:
        lines.append("Ingen ordrelinjer registreret.")
    else:
        lines.append("\n\n".join(item_block(item) for item in items))
    return "\n".join(lines).strip() + "\n"


def build_retouch_list(order, items):
    retouch_items = [item for item in items if value(item, "retouch_type") != "Ingen"]
    lines = [
        f"RETOUCHLISTE: {value(order, 'order_number')}",
        f"Kunde: {value(order, 'customer_name')}",
        f"Mappe: {value(order, 'folder_path')}",
        "",
        "BILLEDER TIL RETOUCH:",
        "",
    ]
    if not retouch_items:
        lines.append("Ingen billeder markeret til retouch.")
    else:
        lines.append("\n\n".join(item_block(item) for item in retouch_items))
    return "\n".join(lines).strip() + "\n"


def build_print_list(order, items):
    print_items = [item for item in items if value(item, "product") in PRINT_PRODUCTS]
    lines = [
        f"PRINTLISTE: {value(order, 'order_number')}",
        f"Kunde: {value(order, 'customer_name')}",
        f"Mappe: {value(order, 'folder_path')}",
        "",
        "BILLEDER TIL PRINT/PRODUKTION:",
        "",
    ]
    if not print_items:
        lines.append("Ingen billeder markeret til print eller produktion.")
    else:
        lines.append("\n\n".join(item_block(item) for item in print_items))
    return "\n".join(lines).strip() + "\n"


def build_all_files(order, items):
    return {
        "order_info.txt": build_order_info(order, items),
        "retouch_list.txt": build_retouch_list(order, items),
        "print_list.txt": build_print_list(order, items),
    }
