import io
from datetime import datetime

import pytest

from app.parsing import categorize, parse_csv_bytes, parse_pdf_bytes, parse_sms, parse_statement, parse_xlsx_bytes

NOW = datetime(2026, 11, 15, 18, 0)

SMS = [
    (
        "Rs.250.00 debited from A/c XX1234 on 15-11-26 to VPA starbucks.blr@hdfcbank (UPI Ref No 6123). Avl Bal Rs 45,000.00",
        250,
        "Starbucks Blr",
        "food",
    ),
    ("INR 600.00 spent on HDFC Bank Card XX1234 at BLINKIT on 2026-11-15:13:22:10. Avl Lmt: INR 1,20,000", 600, "Blinkit", "grocery"),
    ("Your a/c no. XXXXXXXX1234 is debited for Rs.500.00 on 15-11-2026 and credited to SWIGGY (UPI Ref no 432)", 500, "Swiggy", "food"),
    ("Dear UPI user A/C X1234 debited by 2450.0 on date 15Nov26 trf to AMAZON PAY Refno 987 -SBI", 2450, "Amazon Pay", "shopping"),
    ("Rs 300 sent to 9876543210@ybl on 15-11-26", 300, "UPI Transfer", "upi"),
    ("Rs.199 debited for NETFLIX autopay on 14-11-26", 199, "Netflix", "subs"),
]


@pytest.mark.parametrize("sms,amt,merchant,cat", SMS)
def test_sms_parity_with_app(sms, amt, merchant, cat):
    r = parse_sms(sms, NOW)
    assert r["ok"] and r["amount"] == amt and r["merchant"] == merchant and r["category"] == cat


def test_credit_skipped():
    assert parse_sms("Rs.50000.00 credited to your A/c XX1234 by NEFT SALARY", NOW)["ok"] is False


def test_short_keyword_boundaries():
    assert categorize("Coca Cola store") == "other"
    assert categorize("Premium tailors") == "other"
    assert categorize("OLA CABS") == "travel"


HDFC_CSV = b"""Date,Narration,Chq./Ref.No.,Value Dt,Withdrawal Amt.,Deposit Amt.,Closing Balance
01/11/26,UPI-SWIGGY-swiggy@icici-ICIC0000001-6123-Payment,000,01/11/26,"1,250.00",,10000
02/11/26,POS 4111XXXX1234 AMAZON PAY INDIA,000,02/11/26,999.00,,9000
03/11/26,NEFT CR-SALARY,000,03/11/26,,100000.00,109000
04/11/26,UPI-RAHUL SHARMA-9876543210@ybl-SBIN0001234-1234-UPI,000,04/11/26,300.00,,108700
"""


def test_csv_hdfc():
    items = parse_csv_bytes(HDFC_CSV, NOW)
    assert [(t.merchant, t.amount, t.category) for t in items] == [
        ("Swiggy", 1250, "food"),
        ("Amazon Pay", 999, "shopping"),
        ("Rahul Sharma", 300, "upi"),
    ]


def test_csv_signed_amount_and_semicolon():
    data = b"Txn Date;Description;Amount\n05-11-2026;ZOMATO ORDER;-450.00\n06-11-2026;REFUND;200.00\n"
    items = parse_csv_bytes(data, NOW)
    assert [(t.merchant, t.amount) for t in items] == [("Zomato Order", 450)]


def test_csv_type_column():
    data = b"Date,Description,Amount,Cr/Dr\n07/11/2026,UBER TRIP,320.50,DR\n08/11/2026,INTEREST,12.00,CR\n"
    items = parse_csv_bytes(data, NOW)
    assert len(items) == 1 and items[0].category == "travel" and items[0].amount == 320.5


def test_xlsx():
    from openpyxl import Workbook

    wb = Workbook()
    ws = wb.active
    ws.append(["Bank of Test"])
    ws.append([])
    ws.append(["Transaction Date", "Particulars", "Debit", "Credit", "Balance"])
    ws.append([datetime(2026, 11, 9), "BLINKIT COMMERCE", 640, None, 1000])
    ws.append([datetime(2026, 11, 10), "SALARY", None, 50000, 51000])
    buf = io.BytesIO()
    wb.save(buf)
    items = parse_xlsx_bytes(buf.getvalue(), NOW)
    assert [(t.merchant, t.amount, t.category) for t in items] == [("Blinkit Commerce", 640, "grocery")]
    assert parse_statement("x.xlsx", buf.getvalue(), NOW)[0].amount == 640


def _pdf(lines: list[str]) -> bytes:
    from fpdf import FPDF

    pdf = FPDF()
    pdf.add_page()
    pdf.set_font("Helvetica", size=9)
    for line in lines:
        pdf.cell(0, 6, line, new_x="LMARGIN", new_y="NEXT")
    return bytes(pdf.output())


def test_pdf_text_balance_delta():
    data = _pdf(
        [
            "Statement of account",
            "Opening Balance 10,000.00",
            "01/11/2026 UPI/SWIGGY/123456 450.00 9,550.00",
            "02/11/2026 NEFT SALARY 50,000.00 59,550.00",
            "03/11/2026 POS AMAZON 1,200.00 58,350.00",
        ]
    )
    items = parse_pdf_bytes(data, NOW)
    assert [(t.amount, t.category) for t in items] == [(450.0, "food"), (1200.0, "shopping")]


def test_pdf_dr_marker():
    data = _pdf(["05-11-2026 UBER INDIA 280.00 Dr 9,000.00 Cr"])
    items = parse_pdf_bytes(data, NOW)
    assert len(items) == 1 and items[0].amount == 280 and items[0].category == "travel"


def test_garbage_csv_errors():
    with pytest.raises(ValueError):
        parse_csv_bytes(b"hello,world\n1,2\n", NOW)
