"""Generates the app's Lottie animations from code (no third-party assets, no licence questions).

Run:  python3 scripts/lottie/generate.py   → apps/mobile/assets/lottie/*.json
Colours follow packages/design-tokens (rose accent, gold highlight, positive green).
"""
from __future__ import annotations

import json
import math
import pathlib
import random

OUT = pathlib.Path(__file__).resolve().parents[2] / "apps" / "mobile" / "assets" / "lottie"
FR, W, H = 60, 200, 200


def hexc(h: str) -> list[float]:
    h = h.lstrip("#")
    return [round(int(h[i:i + 2], 16) / 255, 4) for i in (0, 2, 4)] + [1]


ROSE, ROSE_LIGHT, GOLD, GREEN, GREEN_BG, PLUM, SKY, WHITE = (
    hexc("#9D174D"), hexc("#F472B6"), hexc("#F5B94A"), hexc("#0B8F5B"), hexc("#E1F5EC"), hexc("#6B21A8"), hexc("#0369A1"), hexc("#FFFFFF"))
EASE_OUT = {"i": {"x": [0.2], "y": [1]}, "o": {"x": [0.3], "y": [0]}}
BACK_OUT = {"i": {"x": [0.3], "y": [1.4]}, "o": {"x": [0.4], "y": [0]}}  # slight overshoot


def st(v):
    return {"a": 0, "k": v}


def an(*kfs, ease=EASE_OUT):
    out = []
    for i, (t, v) in enumerate(kfs):
        k = {"t": t, "s": v if isinstance(v, list) else [v]}
        if i < len(kfs) - 1:
            k.update(ease)
        out.append(k)
    return {"a": 1, "k": out}


def tr(p=(0, 0), s=(100, 100), r=0, o=100):
    return {"ty": "tr", "p": st(list(p)), "a": st([0, 0]), "s": st(list(s)), "r": st(r), "o": st(o)}


def group(*items, transform=None):
    return {"ty": "gr", "it": [*items, transform or tr()]}


def ellipse(w, h, p=(0, 0)):
    return {"ty": "el", "p": st(list(p)), "s": st([w, h])}


def rect(w, h, r=0, p=(0, 0)):
    return {"ty": "rc", "p": st(list(p)), "s": st([w, h]), "r": st(r)}


def path(v, i=None, o=None, closed=True):
    z = [[0, 0]] * len(v)
    return {"ty": "sh", "ks": st({"c": closed, "v": v, "i": i or z, "o": o or z})}


def fill(c, o=100):
    return {"ty": "fl", "c": st(c), "o": st(o) if not isinstance(o, dict) else o, "r": 1}


def stroke(c, w):
    return {"ty": "st", "c": st(c), "o": st(100), "w": st(w), "lc": 2, "lj": 2}


def layer(ind, name, shapes, *, p=(W / 2, H / 2), s=None, r=None, o=None, ip=0, op=120):
    return {"ddd": 0, "ind": ind, "ty": 4, "nm": name, "sr": 1, "ao": 0, "bm": 0, "ip": ip, "op": op, "st": 0,
            "ks": {"o": o or st(100), "r": r or st(0), "p": p if isinstance(p, dict) else st([*p, 0]),
                   "a": st([0, 0, 0]), "s": s or st([100, 100, 100])},
            "shapes": shapes}


def comp(name, layers, op, w=W, h=H):
    return {"v": "5.12.0", "fr": FR, "ip": 0, "op": op, "w": w, "h": h, "nm": name, "ddd": 0, "assets": [],
            "layers": layers}  # first layer renders on top


HEART = dict(
    v=[[0, 45], [-50, -17.5], [-22.5, -45], [0, -34.5], [22.5, -45], [50, -17.5]],
    i=[[25, -20], [0, 25], [-15, 0], [-7, -8], [-9, 0], [0, -15]],
    o=[[-25, -20], [0, -15], [9, 0], [7, -8], [15, 0], [0, 25]],
)


def success():
    op = 90
    circle = layer(2, "circle", [group(ellipse(150, 150), fill(GREEN))],
                   s=an((0, [0, 0, 100]), (22, [100, 100, 100]), ease=BACK_OUT), op=op)
    halo = layer(3, "halo", [group(ellipse(150, 150), fill(GREEN_BG))],
                 s=an((8, [90, 90, 100]), (40, [130, 130, 100])), o=an((8, 100), (40, 0)), op=op)
    check = layer(1, "check", [group(
        path([[-32, 2], [-10, 24], [34, -22]], closed=False), stroke(WHITE, 14),
        {"ty": "tm", "s": st(0), "e": an((18, 0), (42, 100)), "o": st(0), "m": 1})], op=op)
    return comp("success", [check, circle, halo], op)


def heart_burst():
    op = 100
    layers = [layer(1, "heart", [group(path(HEART["v"], HEART["i"], HEART["o"]), fill(ROSE))],
                    s=an((0, [0, 0, 100]), (18, [118, 118, 100]), (30, [100, 100, 100])), op=op)]
    for k in range(10):
        a = 2 * math.pi * k / 10
        x1, y1 = W / 2 + math.cos(a) * 40, H / 2 + math.sin(a) * 40
        x2, y2 = W / 2 + math.cos(a) * 88, H / 2 + math.sin(a) * 88
        col = [GOLD, ROSE_LIGHT][k % 2]
        layers.append(layer(2 + k, f"spark{k}", [group(ellipse(12, 12), fill(col))],
                            p=an((12, [x1, y1, 0]), (46, [x2, y2, 0])),
                            s=an((12, [60, 60, 100]), (46, [0, 0, 100])), o=an((12, 100), (46, 0)), op=op))
    return comp("heart-burst", layers, op)


def confetti(seed=7):
    """Portrait 400x800 canvas so it can fill a phone screen ('cover') with paper-sized pieces."""
    random.seed(seed)
    op, cw, ch = 168, 400, 800
    colors = [ROSE, ROSE_LIGHT, GOLD, GREEN, PLUM, SKY]
    layers = []
    for k in range(56):
        x0 = random.uniform(10, cw - 10)
        delay = random.randint(0, 50)
        fall = random.randint(95, 118)
        drift = random.uniform(-60, 60)
        spin = random.choice([-1, 1]) * random.uniform(240, 720)
        w, h = random.choice([(10, 6), (8, 8), (12, 5), (6, 10)])
        end = delay + fall
        layers.append(layer(k + 1, f"c{k}", [group(rect(w, h, 1.5), fill(random.choice(colors)))],
                            p=an((delay, [x0, -30, 0]), (end, [x0 + drift, ch + 30, 0]), ease={"i": {"x": [0.6], "y": [1]}, "o": {"x": [0.3], "y": [0.2]}}),
                            r=an((delay, 0), (end, spin)), o=an((delay, 100), (end - 12, 100), (end, 0)), op=op))
    return comp("confetti", layers, op, cw, ch)


def gift():
    op = 120  # loops
    bounce = an((0, [100, 112, 0]), (20, [100, 96, 0]), (40, [100, 112, 0]), (120, [100, 112, 0]))
    body = layer(3, "body", [group(rect(16, 70), fill(GOLD)), group(rect(96, 70, 10), fill(ROSE))], p=bounce, op=op)
    lid_p = an((0, [100, 70, 0]), (20, [100, 48, 0]), (40, [100, 70, 0]), (120, [100, 70, 0]))
    lid_r = an((0, 0), (20, -8), (40, 0), (120, 0))
    lid = layer(2, "lid", [group(rect(16, 24), fill(GOLD)), group(rect(110, 24, 8), fill(ROSE))], p=lid_p, r=lid_r, op=op)
    bow = layer(1, "bow", [group(ellipse(30, 20, (-14, 0)), ellipse(30, 20, (14, 0)), fill(GOLD))],
                p=an((0, [100, 52, 0]), (20, [100, 30, 0]), (40, [100, 52, 0]), (120, [100, 52, 0])), r=lid_r, op=op)
    stars = []
    for k, (x, y, t0) in enumerate([(40, 40, 18), (160, 50, 24), (150, 20, 30)]):
        stars.append(layer(4 + k, f"star{k}", [group(path([[0, -9], [3, -3], [9, 0], [3, 3], [0, 9], [-3, 3], [-9, 0], [-3, -3]]), fill(GOLD))],
                           p=(x, y), s=an((t0, [0, 0, 100]), (t0 + 12, [110, 110, 100]), (t0 + 30, [0, 0, 100])), op=op))
    return comp("gift", [*stars, bow, lid, body], op)


def main():
    OUT.mkdir(parents=True, exist_ok=True)
    for name, data in {"success": success(), "heart-burst": heart_burst(), "confetti": confetti(), "gift": gift()}.items():
        (OUT / f"{name}.json").write_text(json.dumps(data, separators=(",", ":")))
        print("wrote", name)


if __name__ == "__main__":
    main()
