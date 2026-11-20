import pytest

from app import domain
from app.api.v1.contributions import _csv_safe


def test_username_candidates_from_name_and_email():
    c = domain.username_candidates("Riya Sharma", "r@x.com")
    assert c[0] == "riya_sharma"
    assert all(domain.USERNAME_RE.match(x) for x in c)
    assert domain.username_base(None, "a.b+c@gmail.com") == "a_b_c"
    assert domain.username_base("", "") == "user"
    assert domain.username_base("Admin", None) == "user"  # reserved
    assert domain.username_base("प्रिया", None) == "user"  # non-latin falls back safely


def test_normalize_username():
    assert domain.normalize_username("  Riya_99 ") == "riya_99"
    for bad in ("ab", "has space", "admin", "x" * 25, "dash-ed"):
        with pytest.raises(ValueError):
            domain.normalize_username(bad)


def test_slug_and_vpa():
    assert domain.slugify("Riya", "Arjun") == "riya-arjun"
    assert domain.normalize_slug("riya-arjun-2027") == "riya-arjun-2027"
    with pytest.raises(ValueError):
        domain.normalize_slug("-bad")
    assert domain.normalize_vpa(" riya@okaxis ") == "riya@okaxis"
    with pytest.raises(ValueError):
        domain.normalize_vpa("not-a-vpa")


def test_money_is_integer_paise():
    assert domain.rupees_to_paise(500) == 50000
    with pytest.raises(ValueError):
        domain.rupees_to_paise(5.5)  # type: ignore[arg-type]
    with pytest.raises(ValueError):
        domain.validate_contribution_amount(99)
    with pytest.raises(ValueError):
        domain.validate_contribution_amount(domain.MAX_CONTRIBUTION_PAISE + 1)
    with pytest.raises(ValueError):
        domain.validate_contribution_amount(True)  # type: ignore[arg-type]
    assert domain.paise_to_upi_amount(100005) == "1000.05"


def test_upi_link():
    link = domain.upi_link("riya@okaxis", "Riya & Arjun", 150000, "PKABCDEFGH", "Honeymoon")
    assert link.startswith("upi://pay?pa=riya@okaxis&pn=Riya%20%26%20Arjun&am=1500.00&cu=INR")
    assert "tr=PKABCDEFGH" in link


def test_reference_format():
    import re
    for _ in range(50):
        assert re.match(r"^PK[A-Z0-9]{8}$", domain.new_reference())


def test_state_machine():
    assert domain.can_transition("guest", "pledged", "guest_marked_paid")
    assert not domain.can_transition("guest", "pledged", "confirmed")  # guests can never confirm
    assert not domain.can_transition("guest", "guest_marked_paid", "confirmed")
    assert domain.can_transition("owner", "guest_marked_paid", "confirmed")
    assert domain.can_transition("owner", "confirmed", "rejected")
    assert not domain.can_transition("owner", "expired", "confirmed")


def test_buckets_and_csv_guard():
    assert domain.amount_bucket(50000) == "≤₹500"
    assert domain.amount_bucket(2_000_000) == ">₹10k"
    assert _csv_safe("=HYPERLINK()") == "'=HYPERLINK()"
    assert _csv_safe("Riya") == "Riya"
