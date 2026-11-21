#!/usr/bin/env python3
"""Generates the decorative Lottie animations for the Shagun Card + theme toggle (pure shape layers, tiny files, no external assets).
Run: python3 scripts/gen-lottie.py  -> writes assets/lottie/*.json"""
import json, math, pathlib, random

OUT = pathlib.Path(__file__).resolve().parent.parent / "assets" / "lottie"
EASE = {"i": {"x": [0.4], "y": [1]}, "o": {"x": [0.6], "y": [0]}}


def hexc(h, a=1):
    h = h.lstrip("#")
    return [int(h[i:i + 2], 16) / 255 for i in (0, 2, 4)] + [a]


def val(v):
    return {"a": 0, "k": v}


def anim(frames):
    """frames: [(t, value)] -> animated property (value is a list)."""
    ks = []
    for n, (t, v) in enumerate(frames):
        k = {"t": t, "s": v if isinstance(v, list) else [v]}
        if n < len(frames) - 1:
            k.update(EASE)
        ks.append(k)
    return {"a": 1, "k": ks}


def prop(v):
    return v if isinstance(v, dict) else val(v)


def fill(color, op=100):
    return {"ty": "fl", "c": val(hexc(color)), "o": val(op), "r": 1}


def stroke(color, w):
    return {"ty": "st", "c": val(hexc(color)), "o": val(100), "w": val(w), "lc": 2, "lj": 2}


def ellipse(w, h, pos=(0, 0)):
    return {"ty": "el", "p": val(list(pos)), "s": val([w, h])}


def rect(w, h, r=0, pos=(0, 0)):
    return {"ty": "rc", "p": val(list(pos)), "s": val([w, h]), "r": val(r)}


def star(points, outer, inner, pos=(0, 0)):
    return {"ty": "sr", "sy": 1, "p": val(list(pos)), "r": val(0), "pt": val(points), "or": val(outer), "os": val(0), "ir": val(inner), "is": val(0)}


def group(items):
    return {"ty": "gr", "it": items + [{"ty": "tr", "p": val([0, 0]), "a": val([0, 0]), "s": val([100, 100]), "r": val(0), "o": val(100)}]}


def layer(name, shapes, ip, op, pos=(0, 0), scale=(100, 100), rot=0, opacity=100, anchor=(0, 0)):
    return {"ddd": 0, "ty": 4, "nm": name, "sr": 1, "ip": ip, "op": op, "st": 0, "ind": 0, "bm": 0,
            "ks": {"o": prop(opacity), "r": prop(rot), "p": prop(list(pos) if not isinstance(pos, dict) else pos),
                   "a": val(list(anchor)), "s": prop(list(scale) if not isinstance(scale, dict) else scale)},
            "shapes": shapes}


def comp(name, w, h, frames, layers, fr=30):
    for i, l in enumerate(layers):
        l["ind"] = i + 1
    return {"v": "5.7.0", "fr": fr, "ip": 0, "op": frames, "w": w, "h": h, "nm": name, "ddd": 0, "assets": [], "layers": layers}


def save(name, data):
    OUT.mkdir(parents=True, exist_ok=True)
    (OUT / f"{name}.json").write_text(json.dumps(data, separators=(",", ":")))


def heart_shapes(color, size=1.0):
    s = size
    return [group([ellipse(36 * s, 36 * s, (-12.75 * s, -6.75 * s)), ellipse(36 * s, 36 * s, (12.75 * s, -6.75 * s)),
                   {"ty": "gr", "it": [rect(36 * s, 36 * s, 2, (0, 6 * s)), {"ty": "tr", "p": val([0, 0]), "a": val([0, 0]), "s": val([100, 100]), "r": val(45), "o": val(100)}]},
                   fill(color)])]


# ---------------- petals falling (wedding / floral) ----------------
def petals():
    rnd = random.Random(7)
    cols = ["#F9A8C9", "#F472B6", "#FDBA74", "#FACC15", "#FB923C", "#FBCFE8"]
    layers = []
    for i in range(18):
        x = rnd.uniform(20, 380); st = rnd.randint(0, 70); dur = rnd.randint(110, 150)
        sway = rnd.uniform(25, 55) * rnd.choice([-1, 1])
        end = st + dur
        pos = anim([(st, [x, -30]), (st + dur * 0.33, [x + sway, 190]), (st + dur * 0.66, [x - sway * 0.6, 400]), (end, [x + sway * 0.4, 640])])
        rot = anim([(st, 0), (end, rnd.choice([-1, 1]) * rnd.randint(300, 600))])
        sz = rnd.uniform(0.7, 1.3)
        shapes = [group([ellipse(14 * sz, 24 * sz), fill(cols[i % len(cols)], 90)])]
        layers.append(layer(f"petal{i}", shapes, st, min(end, 200), pos=pos, rot=rot))
    return comp("petals-fall", 400, 600, 200, layers)


# ---------------- gold sparkles (royal) ----------------
def sparkles():
    rnd = random.Random(11)
    layers = []
    for i in range(16):
        x = rnd.uniform(25, 375); y = rnd.uniform(25, 575); st = rnd.randint(0, 80); sz = rnd.uniform(60, 130)
        scale = anim([(st, [0, 0]), (st + 15, [sz, sz]), (st + 36, [0, 0])])
        rot = anim([(st, 0), (st + 36, 90)])
        shapes = [group([star(4, 20, 4), fill(rnd.choice(["#FCD34D", "#FDE68A", "#F5B94A", "#FFFFFF"]))])]
        layers.append(layer(f"spark{i}", shapes, st, st + 37, pos=(x, y), scale=scale, rot=rot))
    return comp("gold-sparkles", 400, 600, 120, layers)


# ---------------- diya flame (festival) ----------------
def diya():
    glow = layer("glow", [group([ellipse(150, 150), fill("#FBBF24", 12)])], 0, 60, pos=(200, 200),
                 scale=anim([(0, [95, 95]), (15, [112, 112]), (30, [100, 100]), (45, [115, 115]), (60, [95, 95])]))
    outer = layer("flame", [group([ellipse(46, 78), fill("#F97316")])], 0, 60, pos=(200, 188),
                  scale=anim([(0, [100, 100]), (8, [92, 108]), (18, [106, 94]), (30, [96, 106]), (42, [104, 96]), (60, [100, 100])]),
                  rot=anim([(0, -2), (15, 3), (30, -3), (45, 2), (60, -2)]))
    inner = layer("core", [group([ellipse(24, 46), fill("#FEF08A")])], 0, 60, pos=(200, 200),
                  scale=anim([(0, [100, 100]), (10, [90, 110]), (22, [108, 92]), (36, [94, 108]), (60, [100, 100])]))
    return comp("diya-light", 400, 400, 60, [inner, outer, glow])


# ---------------- balloons rising (birthday / baby shower) ----------------
def balloons():
    rnd = random.Random(5)
    cols = ["#F472B6", "#60A5FA", "#FBBF24", "#34D399", "#A78BFA", "#FB7185"]
    layers = []
    for i in range(9):
        x = 30 + i * 42 + rnd.uniform(-10, 10); st = rnd.randint(0, 50); dur = rnd.randint(110, 150); sway = rnd.uniform(10, 22)
        pos = anim([(st, [x, 680]), (st + dur * 0.5, [x + sway, 300]), (st + dur, [x - sway * 0.5, -120])])
        shapes = [group([rect(1.6, 34, 0, (0, 40)), fill("#FFFFFF", 70)]), group([ellipse(46, 56), fill(cols[i % len(cols)], 95)]),
                  group([star(3, 5, 2, (0, 30)), fill(cols[i % len(cols)])])]
        layers.append(layer(f"balloon{i}", shapes, st, min(st + dur, 200), pos=pos))
    return comp("balloon-float", 400, 600, 200, layers)


# ---------------- fireworks (final reveal) ----------------
def fireworks():
    rnd = random.Random(3)
    cols = ["#FBBF24", "#F472B6", "#60A5FA", "#34D399", "#F97316"]
    layers = []
    bursts = [(110, 150, 0), (290, 110, 18), (200, 240, 36), (90, 330, 54), (310, 300, 70)]
    for b, (cx, cy, st) in enumerate(bursts):
        for k in range(14):
            a = k / 14 * 2 * math.pi + rnd.uniform(-0.1, 0.1); d = rnd.uniform(55, 95); c = cols[(b + k) % len(cols)]
            pos = anim([(st, [cx, cy]), (st + 26, [cx + math.cos(a) * d, cy + math.sin(a) * d]), (st + 44, [cx + math.cos(a) * d * 1.12, cy + math.sin(a) * d * 1.12 + 22])])
            op = anim([(st, 100), (st + 28, 100), (st + 44, 0)])
            sc = anim([(st, [100, 100]), (st + 44, [30, 30])])
            layers.append(layer(f"fw{b}_{k}", [group([ellipse(11, 11), fill(c)])], st, st + 45, pos=pos, opacity=op, scale=sc))
    return comp("fireworks", 400, 600, 130, layers)


# ---------------- hearts floating (anniversary / romance) ----------------
def hearts():
    rnd = random.Random(9)
    cols = ["#F43F5E", "#FB7185", "#F9A8D4", "#E11D48"]
    layers = []
    for i in range(10):
        x = rnd.uniform(30, 370); st = rnd.randint(0, 70); dur = rnd.randint(110, 150); sway = rnd.uniform(15, 35)
        sz = rnd.uniform(0.4, 0.9)
        pos = anim([(st, [x, 640]), (st + dur * 0.5, [x + sway, 330]), (st + dur, [x - sway, -40])])
        op = anim([(st, 0), (st + 14, 90), (st + dur * 0.8, 90), (st + dur, 0)])
        layers.append(layer(f"heart{i}", heart_shapes(cols[i % 4], sz), st, min(st + dur, 200), pos=pos, opacity=op))
    return comp("hearts-float", 400, 600, 200, layers)


# ---------------- theme toggle icons (sun <-> moon) ----------------
def theme(to_dark: bool):
    F = 24
    sun, moon = "#F59E0B", "#CBD5E1"
    a, b = (sun, moon) if to_dark else (moon, sun)
    layers = []
    # rays
    for i in range(8):
        ang = i * 45
        ray = [group([rect(7, 22, 3.5, (0, -52)), fill(sun)]), ]
        sc = anim([(0, [100, 100]), (14, [0, 0])] if to_dark else [(0, [0, 0]), (10, [0, 0]), (F, [100, 100])])
        layers.append(layer(f"ray{i}", ray, 0, F + 1, pos=(100, 100), rot=ang, scale=sc))
    # body
    colors = {"ty": "fl", "c": anim([(0, hexc(a)), (F, hexc(b))]), "o": val(100), "r": 1}
    body_sc = anim([(0, [100, 100]), (12, [88, 88]), (F, [100, 100])] if to_dark else [(0, [100, 100]), (12, [88, 88]), (F, [100, 100])])
    layers.append(layer("body", [group([ellipse(60, 60), colors])], 0, F + 1, pos=(100, 100), scale=body_sc,
                        rot=anim([(0, 0), (F, -50 if to_dark else 50)])))
    # craters (moon only)
    for j, (cx, cy, r) in enumerate([(-10, -8, 9), (11, 6, 6), (-3, 14, 5)]):
        op = anim([(0, 0), (F, 100)] if to_dark else [(0, 100), (F - 8, 0)])
        layers.append(layer(f"crater{j}", [group([ellipse(r * 2, r * 2), fill("#94A3B8")])], 0, F + 1, pos=(100 + cx, 100 + cy), opacity=op))
    # layers drawn bottom-up in Lottie (first = top): put craters on top
    layers = layers[::-1]
    return comp("theme-to-dark" if to_dark else "theme-to-light", 200, 200, F + 1, layers)


if __name__ == "__main__":
    for n, d in {"petals-fall": petals(), "gold-sparkles": sparkles(), "diya-light": diya(), "balloon-float": balloons(),
                 "fireworks": fireworks(), "hearts-float": hearts(), "theme-to-dark": theme(True), "theme-to-light": theme(False)}.items():
        save(n, d)
        print(n, (OUT / f"{n}.json").stat().st_size, "bytes")
