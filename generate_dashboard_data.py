from __future__ import annotations

import csv
import json
import re
from pathlib import Path


BASE_DIR = Path(__file__).resolve().parent
OUTPUT_DIR = BASE_DIR / "data"

RATE_FILES = {
    "4円超P": "チェーン店レポート_種別_4円超パチンコ",
    "1円P": "チェーン店レポート_種別_1円パチンコ",
    "1円未満P": "チェーン店レポート_種別_1円未満P",
    "20円超S": "チェーン店レポート_種別_20円超パチスロ",
    "5円S": "チェーン店レポート_種別_5円スロット",
    "5円未満S": "チェーン店レポート_種別_5円未満S",
}


def main() -> None:
    rows = build_dashboard_rows(BASE_DIR)
    OUTPUT_DIR.mkdir(exist_ok=True)
    write_csv(OUTPUT_DIR / "dashboard-data.csv", rows)
    write_json(OUTPUT_DIR / "dashboard-data.json", rows)
    write_js(OUTPUT_DIR / "dashboard-data.js", rows)
    print(f"generated {len(rows)} rows")


def build_dashboard_rows(base_dir: Path) -> list[dict]:
    month_dirs = sorted(
        [path for path in base_dir.iterdir() if path.is_dir() and re.fullmatch(r"\d{4}年\d{1,2}月", path.name)],
        key=lambda path: month_key(path.name),
    )
    latest_month_dir = month_dirs[-1] if month_dirs else None
    latest_store_order = load_latest_store_order(latest_month_dir) if latest_month_dir else {}
    output_rows: list[dict] = []

    for month_dir in month_dirs:
        month = folder_to_month(month_dir.name)
        total_file = find_file(month_dir, "チェーン店レポート_種別_店舗全体実績")
        if not total_file:
            continue

        totals = load_totals(total_file)
        rate_maps = {rate: load_rate_file(find_file(month_dir, prefix)) for rate, prefix in RATE_FILES.items()}

        for store_name, total in totals.items():
            for rate in RATE_FILES:
                rate_row = rate_maps[rate].get(store_name, {})
                seat_count = to_number(rate_row.get("台数")) or 0
                total_seats = to_number(total.get("台数"))
                sales = to_number(rate_row.get("売上合計(千円)")) or 0
                total_sales = to_number(total.get("売上合計(千円)"))
                profit = to_number(rate_row.get("補粗利合計")) or 0
                total_profit = to_number(total.get("補粗利合計"))
                seat_share = calc_share(seat_count, total_seats)
                sales_share = calc_share(sales, total_sales)
                profit_share = calc_share(profit, total_profit)
                sales_diff = diff_or_none(sales_share, seat_share)
                profit_diff = diff_or_none(profit_share, seat_share)
                avg_diff = average([sales_diff, profit_diff])
                status = classify(sales_diff, profit_diff, 3)
                priority = calc_priority(sales_diff, profit_diff, 3)

                output_rows.append(
                    {
                        "年月": month,
                        "店舗名": store_name,
                        "店舗表示順": latest_store_order.get(store_name),
                        "レート区分": rate,
                        "台数": round_or_int(seat_count),
                        "店舗全体台数": round_or_int(total_seats),
                        "台数シェア": round_or_none(seat_share),
                        "売上合計_千円": round_or_int(sales),
                        "店舗全体売上_千円": round_or_int(total_sales),
                        "売上シェア": round_or_none(sales_share),
                        "補粗利合計": round_or_int(profit),
                        "店舗全体補粗利": round_or_int(total_profit),
                        "補粗利シェア": round_or_none(profit_share),
                        "売上差_pt": round_or_none(sales_diff),
                        "補粗利差_pt": round_or_none(profit_diff),
                        "平均差_pt": round_or_none(avg_diff),
                        "判定": status,
                        "優先度": priority,
                    }
                )

    return output_rows


def load_latest_store_order(month_dir: Path) -> dict[str, int]:
    target = find_file(month_dir, RATE_FILES["4円超P"])
    if not target:
        return {}
    rows = load_csv(target)
    order: dict[str, int] = {}
    for index, row in enumerate(rows, start=1):
        store_name = normalize_store_name(row.get("店舗名", ""))
        if not store_name:
            continue
        order[store_name] = index
    return order


def load_totals(path: Path) -> dict[str, dict]:
    rows = load_csv(path)
    result: dict[str, dict] = {}
    for row in rows:
        store_name = normalize_store_name(row.get("店舗名", ""))
        if not store_name:
            continue
        result[store_name] = row
    return result


def load_rate_file(path: Path | None) -> dict[str, dict]:
    if not path:
        return {}
    rows = load_csv(path)
    result: dict[str, dict] = {}
    for row in rows:
        store_name = normalize_store_name(row.get("店舗名", ""))
        if not store_name:
            continue
        result[store_name] = row
    return result


def load_csv(path: Path) -> list[dict]:
    text = read_text(path)
    reader = csv.DictReader(text.splitlines())
    return [dict(row) for row in reader]


def read_text(path: Path) -> str:
    for encoding in ("utf-8-sig", "cp932", "utf-8"):
        try:
            return path.read_text(encoding=encoding)
        except UnicodeDecodeError:
            continue
    raise UnicodeDecodeError("unknown", b"", 0, 1, f"unable to decode {path}")


def find_file(folder: Path, prefix: str) -> Path | None:
    for path in folder.glob("*.csv"):
        if path.name.startswith(prefix):
            return path
    return None


def normalize_store_name(value: str) -> str:
    text = str(value).strip()
    if not text or text == "店舗平均":
        return ""
    return re.sub(r"^\d+\s+", "", text)


def to_number(value: object) -> float | None:
    if value is None:
        return None
    text = str(value).strip().replace(",", "").replace("%", "")
    if text in {"", "-", "NA", "N/A"}:
        return None
    try:
        return float(text)
    except ValueError:
        return None


def calc_share(part: float | None, total: float | None) -> float | None:
    if part is None or total is None:
        return None
    if total == 0:
        return 0.0 if part == 0 else None
    return (part / total) * 100


def diff_or_none(a: float | None, b: float | None) -> float | None:
    if a is None or b is None:
        return None
    return a - b


def average(values: list[float | None]) -> float | None:
    valid = [value for value in values if value is not None]
    if not valid:
        return None
    return sum(valid) / len(valid)


def classify(sales_diff: float | None, profit_diff: float | None, threshold: float) -> str:
    if sales_diff is None or profit_diff is None:
        return "適正"
    if sales_diff >= threshold and profit_diff >= threshold:
        return "不足"
    if sales_diff <= -threshold and profit_diff <= -threshold:
        return "過剰"
    if abs(sales_diff) >= threshold or abs(profit_diff) >= threshold:
        return "要確認"
    return "適正"


def calc_priority(sales_diff: float | None, profit_diff: float | None, threshold: float) -> str:
    score = max(abs(sales_diff or 0), abs(profit_diff or 0))
    if score >= threshold + 3:
        return "高"
    if score >= threshold:
        return "中"
    return "低"


def folder_to_month(folder_name: str) -> str:
    match = re.fullmatch(r"(\d{4})年(\d{1,2})月", folder_name)
    if not match:
        return folder_name
    year, month = match.groups()
    return f"{year}-{int(month):02d}"


def month_key(folder_name: str) -> tuple[int, int]:
    match = re.fullmatch(r"(\d{4})年(\d{1,2})月", folder_name)
    if not match:
        return (0, 0)
    year, month = match.groups()
    return (int(year), int(month))


def round_or_none(value: float | None) -> float | None:
    return None if value is None else round(value, 1)


def round_or_int(value: float | None) -> int | None:
    return None if value is None else int(round(value))


def write_csv(path: Path, rows: list[dict]) -> None:
    if not rows:
        return
    with path.open("w", encoding="utf-8-sig", newline="") as fh:
        writer = csv.DictWriter(fh, fieldnames=list(rows[0].keys()))
        writer.writeheader()
        writer.writerows(rows)


def write_json(path: Path, rows: list[dict]) -> None:
    path.write_text(json.dumps(rows, ensure_ascii=False, indent=2), encoding="utf-8")


def write_js(path: Path, rows: list[dict]) -> None:
    payload = json.dumps(rows, ensure_ascii=False, indent=2)
    path.write_text(f"window.__DASHBOARD_DATA__ = {payload};\n", encoding="utf-8")


if __name__ == "__main__":
    main()
