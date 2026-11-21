"""Pure domain rules: money, usernames, slugs, UPI links, contribution state machine. No I/O."""
from __future__ import annotations

import re
import secrets
import unicodedata
from urllib.parse import quote

USERNAME_RE = re.compile(r"^[a-z0-9_]{3,24}$")
SLUG_RE = re.compile(r"^[a-z0-9](?:[a-z0-9-]{1,46}[a-z0-9])$")
VPA_RE = re.compile(r"^[a-zA-Z0-9.\-_]{2,128}@[a-zA-Z][a-zA-Z0-9]{1,64}$")
RESERVED_USERNAMES = {"admin", "root", "support", "help", "paisa", "paisakidhar", "winplaybox", "api", "system", "null", "undefined"}

MIN_CONTRIBUTION_PAISE = 100          # ₹1
MAX_CONTRIBUTION_PAISE = 50_000_000   # ₹5,00,000
SUGGESTED_AMOUNTS_PAISE = (50_000, 100_000, 200_000, 500_000)
FREE_PLAN_GOAL_LIMIT = 3
PREMIUM_PLAN_GOAL_LIMIT = 50

_REF_ALPHABET = "ABCDEFGHJKLMNPQRSTUVWXYZ23456789"  # no 0/O/1/I confusion

# allowed transitions: who -> {from: {to}}
_GUEST_TRANSITIONS = {"pledged": {"guest_marked_paid"}}
_OWNER_TRANSITIONS = {
    "pledged": {"confirmed", "rejected"},
    "guest_marked_paid": {"confirmed", "rejected"},
    "confirmed": {"rejected"},   # owner can undo a mistaken confirmation
    "rejected": {"confirmed"},
}


def _ascii(text: str) -> str:
    return unicodedata.normalize("NFKD", text).encode("ascii", "ignore").decode()


def username_base(name: str | None, email: str | None) -> str:
    source = (name or "").strip() or (email or "").split("@")[0]
    base = re.sub(r"[^a-z0-9]+", "_", _ascii(source).lower()).strip("_")
    base = re.sub(r"_+", "_", base)[:16]
    if len(base) < 3 or base in RESERVED_USERNAMES:
        base = "user"
    return base


def username_candidates(name: str | None, email: str | None, n: int = 8) -> list[str]:
    base = username_base(name, email)
    out = [] if base == "user" else [base]
    while len(out) < n:
        out.append(f"{base}_{secrets.randbelow(9000) + 1000}")
    return out


def normalize_username(value: str) -> str:
    v = value.strip().lower()
    if not USERNAME_RE.match(v) or v in RESERVED_USERNAMES:
        raise ValueError("Username must be 3–24 characters: lowercase letters, numbers or underscore.")
    return v


def slugify(*parts: str) -> str:
    raw = "-".join(p for p in parts if p)
    s = re.sub(r"[^a-z0-9]+", "-", _ascii(raw).lower()).strip("-")
    s = re.sub(r"-+", "-", s)[:40].strip("-")
    return s if len(s) >= 3 else f"registry-{secrets.token_hex(3)}"


def normalize_slug(value: str) -> str:
    v = value.strip().lower()
    if not SLUG_RE.match(v):
        raise ValueError("Link must be 3–48 characters: lowercase letters, numbers and hyphens.")
    return v


def normalize_vpa(value: str) -> str:
    v = value.strip()
    if not VPA_RE.match(v):
        raise ValueError("Enter a valid UPI ID, e.g. name@okaxis")
    return v


def rupees_to_paise(rupees: int) -> int:
    if not isinstance(rupees, int) or isinstance(rupees, bool):
        raise ValueError("amount must be whole rupees")
    return rupees * 100


def validate_contribution_amount(paise: int) -> int:
    if not isinstance(paise, int) or isinstance(paise, bool):
        raise ValueError("Amount must be a whole number of paise.")
    if paise < MIN_CONTRIBUTION_PAISE or paise > MAX_CONTRIBUTION_PAISE:
        raise ValueError("Amount must be between ₹1 and ₹5,00,000.")
    return paise


def new_reference() -> str:
    return "PK" + "".join(secrets.choice(_REF_ALPHABET) for _ in range(8))


def paise_to_upi_amount(paise: int) -> str:
    return f"{paise // 100}.{paise % 100:02d}"


def upi_link(vpa: str, payee: str, paise: int, reference: str, note: str) -> str:
    """NPCI UPI deep link (upi://pay). Opens any UPI app with amount + note prefilled."""
    params = {
        "pa": vpa,
        "pn": payee[:40],
        "am": paise_to_upi_amount(paise),
        "cu": "INR",
        "tn": f"{note[:40]} {reference}".strip(),
        "tr": reference,
    }
    return "upi://pay?" + "&".join(f"{k}={quote(v, safe='@.')}" for k, v in params.items())


def can_transition(actor: str, current: str, target: str) -> bool:
    table = _GUEST_TRANSITIONS if actor == "guest" else _OWNER_TRANSITIONS
    return target in table.get(current, set())


def goal_limit(plan: str) -> int:
    return PREMIUM_PLAN_GOAL_LIMIT if plan == "premium" else FREE_PLAN_GOAL_LIMIT


def amount_bucket(paise: int) -> str:
    r = paise // 100
    for limit, label in ((500, "≤₹500"), (1000, "₹501–1k"), (2000, "₹1k–2k"), (5000, "₹2k–5k"), (10000, "₹5k–10k")):
        if r <= limit:
            return label
    return ">₹10k"


AMOUNT_BUCKETS = ["≤₹500", "₹501–1k", "₹1k–2k", "₹2k–5k", "₹5k–10k", ">₹10k"]


# ---- Digital Shagun Card catalogue (kept in sync with apps/mobile/src/cards/catalog.ts) ----
CARD_OCCASIONS = ("wedding", "engagement", "anniversary", "birthday", "baby-shower", "housewarming", "festival", "congratulations")
CARD_TEMPLATES = ("marigold", "rose", "royal", "mehendi", "ivory", "peacock", "engagement", "anniversary", "birthday",
                  "housewarming", "diwali", "baby-shower", "celestial", "minimal")
CARD_LANGS = ("en", "hi", "gu", "mr")
CARD_PALETTES = 4
_CTRL_RE = re.compile(r"[\x00-\x08\x0b-\x1f\x7f\u200e\u200f\u202a-\u202e\u2066-\u2069]")


def clean_text(value: str | None, max_len: int, *, multiline: bool = False) -> str | None:
    """Normalise user text for a card: strip control/bidi characters, collapse whitespace, cap length; empty -> None."""
    if value is None:
        return None
    s = unicodedata.normalize("NFC", _CTRL_RE.sub("", value))
    s = re.sub(r"[ \t]+", " ", s)
    s = re.sub(r"\s*\n\s*", "\n", s) if multiline else re.sub(r"\s+", " ", s)
    s = s.strip()[:max_len].strip()
    return s or None
