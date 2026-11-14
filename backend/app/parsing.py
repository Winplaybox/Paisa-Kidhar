"""Indian bank statement / SMS parsing. Mirrors apps/mobile/src/lib/parser.ts (keep in sync).

Statement formats handled:
  * CSV / TSV (HDFC, ICICI, SBI, Axis, Kotak exports and most generic layouts)
  * XLSX / XLS
  * PDF — table extraction first, then a balance-delta text heuristic for text-only PDFs
"""

from __future__ import annotations

import csv
import io
import re
from dataclasses import asdict, dataclass
from datetime import datetime, timedelta

KEYWORDS: dict[str, list[str]] = {
    "food": [
        "swiggy",
        "zomato",
        "starbucks",
        "coffee",
        "cafe",
        "chai",
        "third wave",
        "blue tokai",
        "dominos",
        "domino",
        "pizza",
        "mcdonald",
        "kfc",
        "burger",
        "restaurant",
        "eatclub",
        "box8",
        "haldiram",
        "chaayos",
        "dunkin",
        "subway",
        "bakery",
        "biryani",
        "faasos",
        "eatsure",
    ],
    "grocery": [
        "blinkit",
        "zepto",
        "instamart",
        "bigbasket",
        "dmart",
        "jiomart",
        "grofers",
        "dunzo",
        "milkbasket",
        "country delight",
        "licious",
        "grocery",
        "kirana",
        "reliance fresh",
        "more retail",
        "bbnow",
    ],
    "shopping": [
        "amazon",
        "amzn",
        "flipkart",
        "myntra",
        "ajio",
        "meesho",
        "nykaa",
        "croma",
        "tatacliq",
        "reliance digital",
        "decathlon",
        "ikea",
        "lenskart",
        "firstcry",
        "snapdeal",
        "zara",
        "uniqlo",
    ],
    "subs": [
        "netflix",
        "spotify",
        "hotstar",
        "disney",
        "prime video",
        "primevideo",
        "youtube",
        "apple.com",
        "apple services",
        "google play",
        "googleplay",
        "chatgpt",
        "openai",
        "anthropic",
        "claude.ai",
        "sonyliv",
        "zee5",
        "jiocinema",
        "audible",
        "linkedin",
        "icloud",
        "canva",
        "notion",
        "adobe",
    ],
    "travel": [
        "uber",
        "ola",
        "rapido",
        "irctc",
        "metro",
        "petrol",
        "hpcl",
        "iocl",
        "bpcl",
        "indian oil",
        "shell",
        "indigo",
        "vistara",
        "air india",
        "akasa",
        "makemytrip",
        "goibibo",
        "fastag",
        "redbus",
        "cleartrip",
        "yulu",
        "namma yatri",
        "blusmart",
        "parking",
        "fuel",
    ],
    "bills": [
        "electricity",
        "bescom",
        "msedcl",
        "mseb",
        "adani electricity",
        "tata power",
        "mahanagar gas",
        "igl",
        "broadband",
        "recharge",
        "airtel",
        "jio",
        "vodafone",
        "act fibernet",
        "rent",
        "emi",
        "bajaj finance",
        "insurance",
        "lic",
        "maintenance",
        "society",
        "credit card bill",
        "cred",
    ],
    "health": [
        "pharmacy",
        "apollo",
        "1mg",
        "pharmeasy",
        "netmeds",
        "hospital",
        "clinic",
        "medplus",
        "diagnostic",
        "cult",
        "gym",
        "healthifyme",
    ],
    "fun": ["bookmyshow", "pvr", "inox", "cinepolis", "steam", "playstation", "dream11", "district", "paytm insider", "bowling", "smaaash"],
}
_SHORT_RE = {kw: re.compile(rf"(^|[^a-z0-9]){re.escape(kw)}([^a-z0-9]|$)") for words in KEYWORDS.values() for kw in words if len(kw) <= 4}


def _has(text: str, kw: str) -> bool:
    return bool(_SHORT_RE[kw].search(text)) if kw in _SHORT_RE else kw in text


def categorize(text: str, is_vpa: bool = False) -> str:
    t = (text or "").lower()
    if "instamart" in t:
        return "grocery"
    for cat, words in KEYWORDS.items():
        if any(_has(t, w) for w in words):
            return cat
    return "upi" if is_vpa else "other"


MONTHS = ["jan", "feb", "mar", "apr", "may", "jun", "jul", "aug", "sep", "oct", "nov", "dec"]


def _mk(y: int, m: int, d: int) -> datetime | None:
    if y < 100:
        y += 2000
    try:
        return datetime(y, m, d, 12, 0)
    except ValueError:
        return None


def parse_date(s: str, now: datetime | None = None) -> datetime | None:
    now = now or datetime.now()
    s = str(s or "")
    dt = None
    if m := re.search(r"(\d{4})-(\d{1,2})-(\d{1,2})", s):
        dt = _mk(int(m[1]), int(m[2]), int(m[3]))
    elif m := re.search(r"\b(\d{1,2})[-/.](\d{1,2})[-/.](\d{2,4})\b", s):
        dt = _mk(int(m[3]), int(m[2]), int(m[1]))
    elif m := re.search(r"\b(\d{1,2})[-\s]?(jan|feb|mar|apr|may|jun|jul|aug|sep|oct|nov|dec)[a-z]*[-\s,]*(\d{2,4})\b", s, re.I):
        dt = _mk(int(m[3]), MONTHS.index(m[2].lower()) + 1, int(m[1]))
    if dt is None or dt - now > timedelta(days=1):
        return None
    if tm := re.search(r"\b(\d{1,2}):(\d{2})(?::\d{2})?\s*(am|pm)?", s, re.I):
        h, mi, ap = int(tm[1]), int(tm[2]), (tm[3] or "").lower()
        if ap == "pm" and h < 12:
            h += 12
        if ap == "am" and h == 12:
            h = 0
        if h < 24 and mi < 60:
            dt = dt.replace(hour=h, minute=mi)
    return dt


def _title(s: str) -> str:
    return re.sub(r"\b[a-z]", lambda m: m[0].upper(), s.lower())


def clean_merchant(raw: str) -> tuple[str, bool]:
    s = (raw or "").strip()
    if "@" in s:
        s = s.split("@")[0]
        s = re.sub(r"^(paytmqr|bharatpe|q\d+|upi|pay|mab|bpe)[\d.]*", "", s, flags=re.I)
        s = re.sub(r"[._-]+", " ", re.sub(r"\d{4,}", " ", s)).strip()
        if not s or s.isdigit():
            return "UPI Transfer", True
        return _title(s)[:40], True
    s = re.sub(r"\s+(ltd|pvt|private|limited|india|upi)\.?$", "", s, flags=re.I)
    s = re.sub(r"\s{2,}", " ", re.sub(r"[*#]+", " ", s)).strip()
    if not s:
        return "Unknown", False
    if len(s) <= 4 and s == s.upper():
        return s, False
    return (_title(s) if s in (s.upper(), s.lower()) else s)[:40], False


def narration_merchant(n: str) -> tuple[str, bool]:
    s = (n or "").strip()
    if re.match(r"^(upi|imps|neft)[/-]", s, re.I):
        for p in [p.strip() for p in re.split(r"[/-]", s) if p.strip()][1:]:
            if re.fullmatch(r"(dr|cr|p2m|p2a|upi|imps|neft|payment|pay|collect)", p, re.I) or p.isdigit():
                continue
            if re.fullmatch(r"[A-Z]{4}0[A-Z0-9]{6}", p):
                continue
            return clean_merchant(p)
    t = re.sub(r"^(pos|ecom|ach|nach|atm|bil|onl)[\s/\-:]*", "", s, flags=re.I)
    t = re.sub(r"\b\d*[xX*]{2,}\d+\b", "", t)
    t = re.sub(r"\b\d{3,}\b", "", t)
    t = re.sub(r"[/\-_]+", " ", t).strip()
    return clean_merchant(" ".join(t.split()[:3]) or "Bank Txn")


@dataclass
class Txn:
    amount: float
    merchant: str
    category: str
    occurred_at: str
    raw: str

    def dict(self) -> dict:
        return asdict(self)


def _num(v: object) -> float:
    s = re.sub(r"[₹,\s]", "", str(v if v is not None else ""))
    s = re.sub(r"^\((.*)\)$", r"-\1", s)
    s = re.sub(r"(cr|dr)$", "", s, flags=re.I)
    try:
        return float(s)
    except ValueError:
        return 0.0


def _row_txn(amount: float, date_cell: object, narr: str, now: datetime) -> Txn | None:
    if not amount > 0:
        return None
    if isinstance(date_cell, datetime):
        dt = date_cell.replace(hour=12, minute=0) if date_cell.hour == 0 and date_cell.minute == 0 else date_cell
    else:
        dt = parse_date(str(date_cell or ""), now)
    if dt is None:
        return None
    name, _ = narration_merchant(narr)
    return Txn(round(amount, 2), name, categorize(f"{narr} {name}", "upi" in narr.lower()), dt.isoformat(), narr[:200])


def parse_rows(rows: list[list[object]], now: datetime | None = None) -> list[Txn]:
    """Generic tabular statement → debit transactions."""
    now = now or datetime.now()
    rows = [[("" if c is None else c) for c in r] for r in rows if any(str(c or "").strip() for c in r)]
    hi = next(
        (
            i
            for i, r in enumerate(rows)
            if any(re.search("date", str(c), re.I) for c in r)
            and any(re.search(r"narration|description|particular|remark|detail|amount|withdraw|debit", str(c), re.I) for c in r)
        ),
        -1,
    )
    if hi < 0:
        raise ValueError("Header row (Date, Narration, Debit…) nahi mila")
    H = [str(h).lower().strip() for h in rows[hi]]

    def find(pat: str) -> int:
        return next((i for i, h in enumerate(H) if re.search(pat, h)), -1)

    di, ni = find("date"), find("narration|description|particular|remark|detail")
    tyi = find(r"type|cr\s*/\s*dr|dr\s*/\s*cr")
    dbi = next((i for i, h in enumerate(H) if i != tyi and re.search(r"withdraw|debit|\bdr\b", h)), -1)
    ami = find("amount|amt")
    if di < 0 or (dbi < 0 and ami < 0):
        raise ValueError("Date ya Debit/Amount column nahi mila")
    body = rows[hi + 1 :]
    any_neg = dbi < 0 and any(_num(r[ami]) < 0 for r in body if ami < len(r))
    out: list[Txn] = []
    for r in body:

        def cell(i: int, r: list[object] = r) -> object:
            return r[i] if 0 <= i < len(r) else ""

        if dbi >= 0:
            amount = abs(_num(cell(dbi)))
        else:
            v = _num(cell(ami))
            if tyi >= 0:
                if re.search("cr", str(cell(tyi)), re.I):
                    continue
                amount = abs(v)
            elif any_neg:
                if v >= 0:
                    continue
                amount = -v
            elif re.search(r"cr$", str(cell(ami)).strip(), re.I):
                continue
            else:
                amount = v
        t = _row_txn(amount, cell(di), str(cell(ni)) if ni >= 0 else "", now)
        if t:
            out.append(t)
    return out


def parse_csv_bytes(data: bytes, now: datetime | None = None) -> list[Txn]:
    text = data.decode("utf-8-sig", errors="replace")
    try:
        dialect = csv.Sniffer().sniff(text[:4096], delimiters=",;\t|")
    except csv.Error:
        dialect = csv.excel
    return parse_rows(list(csv.reader(io.StringIO(text), dialect)), now)


def parse_xlsx_bytes(data: bytes, now: datetime | None = None) -> list[Txn]:
    from openpyxl import load_workbook

    wb = load_workbook(io.BytesIO(data), read_only=True, data_only=True)
    last_err: Exception | None = None
    for ws in wb.worksheets:
        rows = [list(r) for r in ws.iter_rows(values_only=True)]
        try:
            return parse_rows(rows, now)
        except ValueError as e:
            last_err = e
    raise last_err or ValueError("Sheet khaali hai")


def parse_xls_bytes(data: bytes, now: datetime | None = None) -> list[Txn]:
    import xlrd

    book = xlrd.open_workbook(file_contents=data)
    last_err: Exception | None = None
    for sh in book.sheets():
        rows = []
        for i in range(sh.nrows):
            row = []
            for c in sh.row(i):
                if c.ctype == xlrd.XL_CELL_DATE:
                    row.append(xlrd.xldate_as_datetime(c.value, book.datemode))
                else:
                    row.append(c.value)
            rows.append(row)
        try:
            return parse_rows(rows, now)
        except ValueError as e:
            last_err = e
    raise last_err or ValueError("Sheet khaali hai")


MONEY = re.compile(r"(?<![\d.])(\d{1,3}(?:,\d{2,3})*(?:\.\d{1,2})|\d+\.\d{2})(?:\s*(Cr|Dr))?(?![\d])", re.I)
LINE_DATE = re.compile(
    r"^\s*(\d{1,2}[-/.]\d{1,2}[-/.]\d{2,4}|\d{1,2}[-\s](?:jan|feb|mar|apr|may|jun|jul|aug|sep|oct|nov|dec)[a-z]*[-\s,]*\d{2,4}|\d{4}-\d{2}-\d{2})",
    re.I,
)


def parse_pdf_bytes(data: bytes, now: datetime | None = None, password: str | None = None, max_pages: int = 80) -> list[Txn]:
    import pdfplumber

    now = now or datetime.now()
    try:
        pdf = pdfplumber.open(io.BytesIO(data), password=password or None)
    except Exception as e:  # pdfminer raises various types for encrypted/corrupt files
        msg = str(e).lower()
        if "password" in msg or "encrypt" in msg:
            raise ValueError("PDF password-protected hai — password daalo") from e
        raise ValueError("PDF padh nahi paaye") from e
    with pdf:
        pages = pdf.pages[:max_pages]
        # 1) Tables
        rows: list[list[object]] = []
        for p in pages:
            for tbl in p.extract_tables() or []:
                rows.extend([[(c or "").replace("\n", " ").strip() for c in r] for r in tbl])
        if rows:
            try:
                txns = parse_rows(rows, now)
                if txns:
                    return txns
            except ValueError:
                pass
        # 2) Text lines + running balance
        lines: list[str] = []
        for p in pages:
            lines.extend((p.extract_text() or "").splitlines())
    return _parse_text_lines(lines, now)


def _parse_text_lines(lines: list[str], now: datetime) -> list[Txn]:
    out: list[Txn] = []
    prev_bal: float | None = None
    for line in lines:
        m = LINE_DATE.match(line)
        bal_m = re.search(r"opening balance[^\d]*([\d,]+\.\d{2})", line, re.I)
        if bal_m:
            prev_bal = _num(bal_m[1])
            continue
        if not m:
            continue
        monies = list(MONEY.finditer(line[m.end() :]))
        if not monies:
            continue
        rest = line[m.end() :]
        narr = rest[: monies[0].start()].strip()
        narr = LINE_DATE.sub("", narr).strip()  # value-date column
        amount: float | None = None
        last = monies[-1]
        marker = (last[2] or "").lower()
        if len(monies) >= 2:
            bal = _num(last[1])
            first = _num(monies[0][1])
            if marker == "dr" or (len(monies) == 2 and (monies[0][2] or "").lower() == "dr"):
                amount = first
            elif prev_bal is not None:
                if bal < prev_bal - 0.005:
                    amount = round(prev_bal - bal, 2)
            prev_bal = bal
        elif marker == "dr":
            amount = _num(last[1])
        if amount and amount > 0:
            t = _row_txn(amount, m[1], narr, now)
            if t:
                out.append(t)
    return out


def parse_statement(filename: str, data: bytes, now: datetime | None = None, password: str | None = None) -> list[Txn]:
    name = (filename or "").lower()
    head = data[:8]
    if name.endswith(".pdf") or head.startswith(b"%PDF"):
        return parse_pdf_bytes(data, now, password)
    if name.endswith(".xlsx") or head.startswith(b"PK"):
        return parse_xlsx_bytes(data, now)
    if name.endswith(".xls") or head.startswith(b"\xd0\xcf\x11\xe0"):
        return parse_xls_bytes(data, now)
    return parse_csv_bytes(data, now)


# ---------------- SMS (parity with the app; useful for other clients / future automation) ----------------
AMT_RE = re.compile(r"(?:rs\.?|inr|₹)\s*:?\s*([\d,]+(?:\.\d{1,2})?)", re.I)
STOP = r"(?=\s+(?:on|using|via|ref|refno|for|txn|avl|from|upi|a/c|ac|with|dt|date|thru)\b|\s*[.(;,]|$)"
MERCHANT_RES = [
    re.compile(r"\bvpa\s*:?\s*([\w.-]+@[\w.-]+)", re.I),
    re.compile(
        r"\b([\w.-]+@(?:ybl|ok\w+|paytm|ibl|axl|upi|apl|icici|hdfcbank|sbi|axisbank|kotak|yesbank|pt\w+|wa\w+|freecharge|fbl|idfcbank|aubank|rbl|indus|hsbc|citi|amazonpay|razorpay|pnb|unionbank|boi|kbl|federal|sib|dbs))\b",
        re.I,
    ),
    re.compile(r"\bat\s+([A-Za-z0-9][\w&.'\- ]{1,40}?)" + STOP, re.I),
    re.compile(
        r"\b(?:trf to|transfer to|transferred to|credited to|paid to|sent to|payment to|to)\s+(?!your\b|a/c\b|ac\b|account\b)([A-Za-z0-9][\w&.'@\- ]{1,40}?)"
        + STOP,
        re.I,
    ),
    re.compile(
        r"\b(?:debited for|deducted for|autopay for|mandate for)\s+(?!rs\b|inr\b|₹)([A-Za-z][\w&.' -]{1,30}?)(?=\s+(?:autopay|on|via|ref|subscription|mandate|si)\b|\s*[.(;,]|$)",
        re.I,
    ),
]


def parse_sms(sms: str, now: datetime | None = None) -> dict:
    now = now or datetime.now()
    t = re.sub(r"\s+", " ", sms or "").strip()
    debit = bool(re.search(r"\b(debited|spent|paid|sent|withdrawn|purchase|deducted|debit|dr\.?)\b", t, re.I))
    credit = bool(re.search(r"\b(credited|received|deposited|refund(ed)?)\b", t, re.I)) and not re.search(r"\bdebited\b", t, re.I)
    amount = None
    for m in AMT_RE.finditer(t):
        if re.search(r"bal|balance|limit|lmt|avl|available", t[max(0, m.start() - 14) : m.start()], re.I):
            continue
        v = _num(m[1])
        if v > 0:
            amount = v
            break
    if amount is None and (m2 := re.search(r"(?:debited by|debited for|spent|paid|sent)\s*([\d,]+(?:\.\d{1,2})?)", t, re.I)):
        amount = _num(m2[1]) or None
    if not amount:
        return {"ok": False, "type": "unknown", "raw": t, "reason": "amount not found"}
    raw = next((m[1] for r in MERCHANT_RES if (m := r.search(t))), None)
    name, vpa = clean_merchant(raw) if raw else ("Unknown", False)
    dt = parse_date(t, now) or now
    typ = "credit" if credit else "debit" if debit else "unknown"
    return {
        "ok": typ == "debit",
        "type": typ,
        "raw": t,
        "amount": round(amount, 2),
        "merchant": name,
        "category": categorize(f"{raw} {name}", vpa) if raw else categorize(t),
        "occurred_at": dt.isoformat(),
    }
