import os
import re
import shutil
from datetime import datetime
from pathlib import Path


APP_ROOT = Path(__file__).resolve().parents[1]
MONTH_NAMES = {
    "01": "Januar",
    "02": "Februar",
    "03": "Marts",
    "04": "April",
    "05": "Maj",
    "06": "Juni",
    "07": "Juli",
    "08": "August",
    "09": "September",
    "10": "Oktober",
    "11": "November",
    "12": "December",
}
ORDER_FILES = ("order_info.txt", "retouch_list.txt", "print_list.txt")


def resolve_studio_path(path_value):
    if not path_value:
        return None
    expanded = os.path.expandvars(os.path.expanduser(str(path_value).strip()))
    path = Path(expanded)
    if not path.is_absolute():
        path = APP_ROOT / path
    return path.resolve(strict=False)


def path_exists(path_value):
    path = resolve_studio_path(path_value)
    return bool(path and path.exists() and path.is_dir())


def is_path_within_base(folder_path, base_folder_path):
    folder = resolve_studio_path(folder_path)
    base = resolve_studio_path(base_folder_path)
    if not folder or not base:
        return False
    try:
        folder_str = os.path.normcase(str(folder))
        base_str = os.path.normcase(str(base))
        return os.path.commonpath([base_str, folder_str]) == base_str
    except ValueError:
        return False


def validate_writable_folder(folder_path, base_folder_path):
    folder = resolve_studio_path(folder_path)
    if not folder:
        return False, "Der mangler en servermappe."
    if not folder.exists() or not folder.is_dir():
        return False, "Mappe ikke fundet. StudioFlow har ikke skrevet filer."
    if not base_folder_path:
        return False, "Base servermappe mangler i indstillinger."
    if not is_path_within_base(folder_path, base_folder_path):
        return False, "Mappen ligger uden for den konfigurerede base servermappe. StudioFlow har ikke skrevet filer."
    return True, ""


def backup_existing_file(target_path):
    if not target_path.exists():
        return None
    timestamp = datetime.now().strftime("%Y%m%d_%H%M%S")
    backup_name = f"{target_path.stem}_OLD_{timestamp}{target_path.suffix}"
    backup_path = target_path.with_name(backup_name)
    shutil.copy2(target_path, backup_path)
    return backup_path


def write_text_file_with_backup(folder_path, filename, content):
    folder = resolve_studio_path(folder_path)
    target = folder / filename
    backup_path = backup_existing_file(target)
    target.write_text(content, encoding="utf-8", newline="\n")
    return {
        "filename": filename,
        "path": str(target),
        "backup": str(backup_path) if backup_path else None,
    }


def write_generated_files(folder_path, contents_by_filename):
    results = []
    for filename, content in contents_by_filename.items():
        results.append(write_text_file_with_backup(folder_path, filename, content))
    return results


def generated_file_status(folder_path):
    folder = resolve_studio_path(folder_path)
    statuses = []
    for filename in ORDER_FILES:
        file_path = folder / filename if folder else None
        statuses.append(
            {
                "filename": filename,
                "exists": bool(file_path and file_path.exists() and file_path.is_file()),
                "path": str(file_path) if file_path else "",
            }
        )
    return statuses


def read_generated_file(folder_path, filename):
    if filename not in ORDER_FILES:
        return ""
    folder = resolve_studio_path(folder_path)
    if not folder:
        return ""
    target = folder / filename
    if not target.exists() or not target.is_file():
        return ""
    return target.read_text(encoding="utf-8", errors="replace")


def safe_folder_name(value):
    cleaned = re.sub(r'[<>:"/\\|?*]+', " ", value).strip()
    cleaned = re.sub(r"\s+", " ", cleaned)
    return cleaned or "Kunde"


def display_order_number_for_folder(order_number):
    match = re.match(r"FG-(\d{4})(\d{2})(\d{2})-(\d{3})", order_number)
    if not match:
        return order_number
    year, month, day, sequence = match.groups()
    return f"FG-{year}-{month}{day}-{sequence}"


def create_order_folder_structure(base_folder_path, session_date, order_number, customer_name):
    base = resolve_studio_path(base_folder_path)
    if not base:
        raise ValueError("Base servermappe mangler i indstillinger.")

    date_parts = session_date.split("-")
    if len(date_parts) != 3:
        raise ValueError("Sessionsdato er ugyldig.")

    year, month, _day = date_parts
    month_folder = f"{month}_{MONTH_NAMES.get(month, month)}"
    order_folder_name = f"{display_order_number_for_folder(order_number)} - {safe_folder_name(customer_name)}"
    order_folder = (base / year / month_folder / order_folder_name).resolve(strict=False)

    if not is_path_within_base(str(order_folder), base_folder_path):
        raise ValueError("Den beregnede mappe ligger uden for base servermappen.")

    order_folder.mkdir(parents=True, exist_ok=True)
    for subfolder in (
        "00_Originals",
        "01_Selected",
        "02_To_Retouch",
        "03_Retouched",
        "04_Print",
        "05_Delivery",
    ):
        (order_folder / subfolder).mkdir(exist_ok=True)

    placeholder = order_folder / "order_info.txt"
    if not placeholder.exists():
        placeholder.write_text(
            "StudioFlow ordre oprettet.\nOrdrefiler genereres, når ordren bekræftes.\n",
            encoding="utf-8",
            newline="\n",
        )

    return str(order_folder)
