#!/usr/bin/env python3
"""Mata Adentro — gerador das partituras originais (composição 100% inédita).

Cada faixa em laço é escrita 3 vezes seguidas; depois o pós-processamento
recorta exatamente o 2º ciclo (que já carrega a cauda de reverb do 1º),
gerando um laço sem emenda. Saída: audio/scores/<faixa>.json
"""
import json, os

OUT = os.path.join(os.path.dirname(__file__), "scores")
os.makedirs(OUT, exist_ok=True)

NOTE = {"C": 0, "D": 2, "E": 4, "F": 5, "G": 7, "A": 9, "B": 11}


def midi(n):
    if isinstance(n, int):
        return n
    name = n[0]
    acc = 0
    i = 1
    while i < len(n) and n[i] in "#b":
        acc += 1 if n[i] == "#" else -1
        i += 1
    octv = int(n[i:])
    return 12 * (octv + 1) + NOTE[name] + acc


class Track:
    def __init__(self, name, instrument, gainDb=-6, pan=0, reverb=0.25, drums=False, chorus=0.0, hum=(8, 6)):
        self.d = {"name": name, "instrument": instrument, "gainDb": gainDb, "pan": pan,
                  "reverb": reverb, "chorus": chorus, "notes": [],
                  "humanize": {"timingMs": hum[0], "velocity": hum[1]}}
        if drums:
            self.d["drums"] = True

    def n(self, t, dur, p, v=88):
        self.d["notes"].append([round(t, 4), round(dur, 4), p, int(max(1, min(127, v)))])


def melody(track, start, beat, phrase, vel=92, legato=0.92, transpose=0):
    """phrase: list of bars; each bar list of (pitch|'r', beats)."""
    t = start
    for bar in phrase:
        for p, b in bar:
            if p != "r":
                pp = midi(p) + transpose
                accent = 6 if abs((t - start) / beat % 2) < 1e-6 else 0
                track.n(t, b * beat * legato, pp, vel + accent)
            t += b * beat
    return t


# acordes: nome -> (raiz midi baixa, tríade em região média)
CH = {
    "F": ("F2", ["F3", "A3", "C4"]), "Bb": ("Bb1", ["F3", "Bb3", "D4"]), "C": ("C2", ["E3", "G3", "C4"]),
    "C7": ("C2", ["E3", "Bb3", "C4"]), "Gm": ("G1", ["G3", "Bb3", "D4"]), "Dm": ("D2", ["F3", "A3", "D4"]),
    "Eb": ("Eb2", ["G3", "Bb3", "Eb4"]), "D": ("D2", ["F#3", "A3", "D4"]), "G": ("G1", ["G3", "B3", "D4"]),
    "A": ("A1", ["E3", "A3", "C#4"]), "Bm": ("B1", ["F#3", "B3", "D4"]), "Cn": ("C2", ["G3", "C4", "E4"]),
    "Am": ("A1", ["E3", "A3", "C4"]), "A7": ("A1", ["E3", "G3", "C#4"]),
}


def fifth(root):
    return midi(root) + 7


def write(name, score):
    with open(os.path.join(OUT, name + ".json"), "w") as f:
        json.dump(score, f)
    print(name, sum(len(t["notes"]) for t in score["tracks"]), "notes")


# ---------------------------------------------------------------- TEMA PRINCIPAL
def tema():
    bpm = 120; beat = 60 / bpm; bar = 4 * beat
    L = 20 * bar  # 40 s
    lead = Track("trompete", "trumpet", -2, 0.05, 0.3, hum=(6, 5))
    harm = Track("trompas", "horn", -7, -0.25, 0.35)
    stab = Track("metais", "brass-section", -6, 0.2, 0.3)
    tuba = Track("tuba", "tuba", -2, 0, 0.15, hum=(4, 4))
    beri = Track("berimbau", "sitar", -5, 0.35, 0.2, hum=(5, 8))
    glock = Track("glock", "celesta", -4, -0.4, 0.4)
    timp = Track("timpano", "timpani", -3, 0, 0.3)
    dr = Track("percussao", 0, -8, 0, 0.18, drums=True, hum=(5, 10))

    A = [
        [("C4", .5), ("F4", .5), ("A4", 1), ("G4", .5), ("A4", .5), ("C5", 1)],
        [("Bb4", 1.5), ("A4", .5), ("G4", 1), ("F4", 1)],
        [("D4", .5), ("G4", .5), ("Bb4", 1), ("A4", .5), ("Bb4", .5), ("D5", 1)],
        [("C5", 3), ("r", 1)],
        [("C5", .5), ("D5", .5), ("C5", .5), ("A4", .5), ("F4", 1), ("A4", 1)],
        [("Bb4", .5), ("C5", .5), ("Bb4", .5), ("G4", .5), ("E4", 1), ("G4", 1)],
        [("A4", 1), ("C5", 1), ("F5", 1.5), ("E5", .5)],
        [("F5", 3), ("r", 1)],
    ]
    Ach = [["F"], ["Bb", "C"], ["Gm"], ["C"], ["F"], ["C7"], ["F", "C"], ["F"]]
    B = [
        [("D5", 1), ("C5", .5), ("Bb4", .5), ("C5", 1), ("F4", 1)],
        [("G4", .5), ("A4", .5), ("Bb4", .5), ("C5", .5), ("D5", 2)],
        [("Eb5", 1), ("D5", .5), ("C5", .5), ("D5", 1), ("Bb4", 1)],
        [("C5", 3), ("r", 1)],
        [("D5", 1), ("C5", .5), ("Bb4", .5), ("A4", 1), ("F4", 1)],
        [("G4", .5), ("A4", .5), ("Bb4", .5), ("D5", .5), ("C5", 2)],
        [("A4", .5), ("C5", .5), ("F5", 1), ("E5", .5), ("G5", .5), ("C5", 1)],
        [("F5", 2), ("C5", 1), ("F4", 1)],
    ]
    Bch = [["Bb", "F"], ["Gm"], ["Eb", "Bb"], ["F"], ["Dm"], ["Gm", "C"], ["F", "C"], ["F"]]
    tag = [[("C5", 1), ("A4", 1), ("C5", 1), ("F5", 1)], [("F5", 2), ("r", 2)]]
    tagch = [["F"], ["F"]]
    # harmonia em terças/sextas abaixo (escala de F maior)
    scale = [midi(x) for x in ["F3", "G3", "A3", "Bb3", "C4", "D4", "E4"]]

    def third_below(p):
        m = midi(p)
        cands = [s + 12 * k for s in scale for k in range(-1, 4)]
        below = sorted([c for c in cands if c < m])
        return below[-2] if len(below) >= 2 else m - 4

    for cyc in range(3):
        o = cyc * L
        bars_ch = [["F"], ["C"]] + Ach + Bch + tagch
        # intro: brass hits
        for i, (t, ch) in enumerate([(0, "F"), (beat * 1.5, "F"), (beat * 2, "C"), (bar + beat * 3, "C")]):
            stab.n(o + t, beat * 0.4, [midi(x) + 12 for x in CH[ch][1]], 104)
        timp.n(o + 0, beat * 0.5, "F2", 110); timp.n(o + bar, beat * 0.5, "C2", 100)
        for k in range(8):
            timp.n(o + bar + beat * 2 + k * beat / 4, beat / 4, "C2", 60 + k * 6)
        # melodia
        t = o + 2 * bar
        melody(lead, t, beat, A, 92)
        melody(lead, t + 8 * bar, beat, B, 100)
        melody(lead, t + 16 * bar, beat, tag, 104)
        # harmonia só no refrão e na tag
        tt = t + 8 * bar
        for barn in B + tag:
            for p, b in barn:
                if p != "r":
                    harm.n(tt, b * beat * 0.9, third_below(p), 80)
                tt += b * beat
        # glockenspiel dobra 2 oitavas acima no refrão (só notas longas)
        tt = t + 8 * bar
        for barn in B:
            for p, b in barn:
                if p != "r" and b >= 1:
                    glock.n(tt, beat, midi(p) + 12, 70)
                tt += b * beat
        # acompanhamento de marcha: tuba em 1 e 3, metais em 2 e 4
        for bi, chs in enumerate(bars_ch):
            bt = o + bi * bar
            for half in range(2):
                ch = chs[min(half, len(chs) - 1)]
                root, tri = CH[ch]
                ht = bt + half * 2 * beat
                if bi >= 2:
                    tuba.n(ht, beat * 0.8, midi(root) + (12 if midi(root) < 33 else 0), 96)
                    tuba.n(ht + beat, beat * 0.5, fifth(root) + (12 if midi(root) < 33 else 0) - 12, 80)
                    stab.n(ht + beat * 0.5, beat * 0.3, tri, 70)
                    stab.n(ht + beat * 1.5, beat * 0.3, tri, 78)
                # berimbau no refrão (bars 10-17): dun dun DIN
                if 10 <= bi < 18:
                    r = midi(root) + 24
                    beri.n(ht, beat * 0.4, r, 90)
                    beri.n(ht + beat * 0.75, beat * 0.25, r, 70)
                    beri.n(ht + beat * 1.0, beat * 0.6, r + 2, 105)
        # percussão
        for bi in range(20):
            bt = o + bi * bar
            for b in range(4):
                x = bt + b * beat
                # surdo: grave abafado no 1/3, aberto no 2/4
                dr.n(x, beat * 0.5, 41 if b % 2 else 43, 112 if b % 2 else 72)
                if b in (0, 2):
                    dr.n(x, 0.1, "kick", 92)
                # caixa de marcha
                if bi >= 2:
                    if b in (1, 3):
                        dr.n(x, 0.1, "snare", 100)
                    for s in (1, 2, 3):
                        dr.n(x + s * beat / 4, 0.05, "snare", 38 + (s == 3) * 18)
                # agogô (alto 67 / baixo 68)
                if bi >= 2:
                    pat = [(0, 67), (0.5, 67), (1.0, 68), (1.5, 67), (1.75, 67)]
                    if b % 2 == 0:
                        for off, k in pat:
                            dr.n(x + off * beat, 0.1, k, 70)
                dr.n(x, 0.05, "shaker", 46); dr.n(x + beat / 2, 0.05, "shaker", 58)
            if bi in (9, 17, 19):  # viradas
                for s in range(8):
                    dr.n(bt + 2 * beat + s * beat / 4, 0.08, "snare", 60 + s * 7)
            if bi in (2, 10, 18):
                dr.n(bt, 1.5, "crash", 95)
    tracks = [lead, harm, stab, tuba, beri, glock, timp, dr]
    write("tema", {"title": "Mata Adentro — Tema", "tracks": [t.d for t in tracks]})
    return L


# ---------------------------------------------------------------- MATA (superfície)
def mata():
    bpm = 120; beat = 0.5; bar = 2.0
    L = 30 * bar  # 60 s
    flute = Track("flauta", "flute", -4, 0.1, 0.35, hum=(8, 6))
    mar = Track("marimba", "marimba", -3, -0.3, 0.3)
    oca = Track("ocarina", "ocarina", -6, 0.25, 0.4)
    gtr = Track("violao", "nylon-guitar", -10, -0.2, 0.2, hum=(10, 8))
    bass = Track("baixo", "finger-bass", -7, 0, 0.1, hum=(4, 4))
    beri = Track("berimbau", "sitar", -8, 0.4, 0.2)
    pad = Track("pad", "warm-pad", -12, 0, 0.5)
    dr = Track("percussao", 0, -9, 0, 0.15, drums=True, hum=(6, 10))
    A = [
        [("A4", .5), ("D5", .5), ("r", .5), ("D5", .5), ("E5", .5), ("F#5", .5), ("E5", 1)],
        [("D5", .5), ("C5", .5), ("A4", 1), ("G4", .5), ("A4", 1.5)],
        [("F#4", .5), ("A4", .5), ("r", .5), ("A4", .5), ("B4", .5), ("D5", .5), ("B4", 1)],
        [("A4", 3), ("r", 1)],
        [("A4", .5), ("D5", .5), ("r", .5), ("D5", .5), ("E5", .5), ("F#5", .5), ("E5", 1)],
        [("D5", .5), ("C5", .5), ("A4", .5), ("C5", .5), ("D5", .5), ("E5", 1.5)],
        [("F#5", .5), ("E5", .5), ("D5", .5), ("B4", .5), ("A4", .5), ("G4", .5), ("A4", 1)],
        [("D5", 3), ("r", 1)],
    ]
    Ach = ["D", "Cn", "G", "A", "D", "Cn", "G", "D"]
    B = [
        [("B4", 1), ("D5", .5), ("F#5", .5), ("E5", 1), ("D5", 1)],
        [("C#5", .5), ("D5", .5), ("E5", 1), ("A4", 2)],
        [("G4", 1), ("B4", .5), ("D5", .5), ("C#5", 1), ("B4", 1)],
        [("A4", .5), ("B4", .5), ("C#5", .5), ("E5", .5), ("D5", 2)],
        [("B4", 1), ("D5", .5), ("F#5", .5), ("E5", 1), ("D5", 1)],
        [("C#5", .5), ("D5", .5), ("E5", 1), ("A4", 2)],
        [("G4", 1), ("B4", .5), ("D5", .5), ("C#5", 1), ("B4", 1)],
        [("D5", 2), ("A4", 1), ("D4", 1)],
    ]
    Bch = ["Bm", "A", "G", "A", "Bm", "A", "G", "D"]
    # mapa de 30 compassos
    layout = (["D", "D"] + Ach + Bch + Ach + ["G", "A", "D", "D"])
    for cyc in range(3):
        o = cyc * L
        melody(flute, o + 2 * bar, beat, A, 88)
        melody(mar, o + 10 * bar, beat, B, 96, legato=0.6)
        melody(flute, o + 10 * bar, beat, B, 70, transpose=-12)
        melody(oca, o + 18 * bar, beat, A, 86)
        # marimba responde ao fim das frases da seção A final
        for i, ch in enumerate(layout):
            bt = o + i * bar
            root, tri = CH[ch]
            r = midi(root) + (12 if midi(root) < 38 else 0)
            # baixo de baião (2x por compasso de 4)
            for half in range(2):
                h = bt + half * 2 * beat
                bass.n(h, beat * 0.7, r, 96)
                bass.n(h + beat * 0.75, beat * 0.2, r, 70)
                bass.n(h + beat * 1.5, beat * 0.45, r + 7, 84)
            # violão: acorde nos contratempos
            if i >= 2 and i < 26:
                for s in (0.5, 1.5, 2.5, 3.5):
                    gtr.n(bt + s * beat, beat * 0.4, tri, 72 + (s == 1.5) * 10)
            if i >= 26:
                mar.n(bt, beat * 0.4, [midi(x) + 12 for x in tri], 60)
                mar.n(bt + 1.5 * beat, beat * 0.4, [midi(x) + 12 for x in tri], 52)
            pad.n(bt, bar, tri, 50)
            # berimbau nas seções A e na quebra
            if i < 10 or i >= 26:
                b0 = midi(root) + 24
                for half in range(2):
                    h = bt + half * 2 * beat
                    beri.n(h, beat * .4, b0, 86); beri.n(h + .75 * beat, beat * .2, b0, 62)
                    beri.n(h + beat, beat * .6, b0 + 2, 98)
            # percussão leve: triângulo de baião, zabumba, agogô
            for b in range(4):
                x = bt + b * beat
                dr.n(x, 0.05, "triangle", 70 if b % 2 == 0 else 46)
                dr.n(x + beat / 2, 0.05, "triangle", 54)
                dr.n(x + beat / 4, 0.05, "shaker", 34); dr.n(x + 3 * beat / 4, 0.05, "shaker", 40)
            dr.n(bt, 0.2, 41, 86); dr.n(bt + .75 * beat, 0.1, 41, 60); dr.n(bt + 1.5 * beat, 0.2, 43, 80)
            dr.n(bt + 2 * beat, 0.2, 41, 86); dr.n(bt + 2.75 * beat, 0.1, 41, 60); dr.n(bt + 3.5 * beat, 0.2, 43, 80)
            dr.n(bt + beat, 0.1, "snare-rim", 56); dr.n(bt + 3 * beat, 0.1, "snare-rim", 56)
            if 10 <= i < 18:
                for off, k in [(0, 67), (.5, 67), (1, 68), (2, 67), (2.5, 68), (3, 68)]:
                    dr.n(bt + off * beat, 0.1, k, 58)
    tracks = [flute, mar, oca, gtr, bass, beri, pad, dr]
    write("mata", {"title": "Mata Adentro — Mata", "tracks": [t.d for t in tracks]})
    return L


# ---------------------------------------------------------------- SUBTERRÂNEO
def sub():
    bpm = 80; beat = 0.75; bar = 3.0
    L = 10 * bar  # 30 s
    pad = Track("cordas", "slow-strings", -9, 0, 0.5)
    low = Track("contrabaixo", "contrabass", -7, 0, 0.3)
    piz = Track("pizz", "pizzicato", -9, -0.3, 0.4, hum=(6, 8))
    drip = Track("gotas", "kalimba", -6, 0.4, 0.6, hum=(15, 12))
    fl = Track("flauta", "shakuhachi", -8, 0.15, 0.55, hum=(10, 6))
    dr = Track("percussao", 0, -7, 0, 0.3, drums=True)
    chords = ["Dm", "Dm", "Bb", "Bb", "Gm", "Gm", "A7", "A7", "Dm", "Dm"]
    tri = {"Dm": ["D3", "F3", "A3"], "Bb": ["D3", "F3", "Bb3"], "Gm": ["D3", "G3", "Bb3"], "A7": ["C#3", "E3", "G3"]}
    roots = {"Dm": "D2", "Bb": "Bb1", "Gm": "G1", "A7": "A1"}
    melo = [(2, 2.0, "A4"), (3.0, 1.0, "G4"), (4.0, 3, "F4"), (8, 1.5, "D5"), (9.5, 1.0, "C5"), (10.5, 2.5, "Bb4"),
            (16, 1.5, "G4"), (17.5, 1.0, "A4"), (18.5, 2.5, "Bb4"), (22, 1, "A4"), (23, 3, "C#5"), (28, 4, "D5")]
    drops = [(0.4, "A5"), (2.9, "D6"), (5.2, "F5"), (7.6, "A5"), (9.1, "E6"), (11.7, "C6"), (13.3, "A5"),
             (16.4, "D6"), (17.9, "F6"), (20.2, "Bb5"), (22.8, "A5"), (24.1, "E6"), (26.5, "G5"), (28.7, "D6")]
    for cyc in range(3):
        o = cyc * L
        for i, ch in enumerate(chords):
            bt = o + i * bar
            pad.n(bt, bar, tri[ch], 62 if i % 2 == 0 else 54)
            low.n(bt, bar * 0.95, roots[ch], 80)
            pat = [0, 1.5, 2, 3]
            ns = [midi(roots[ch]) + 12, midi(roots[ch]) + 19, midi(roots[ch]) + 24, midi(roots[ch]) + 15]
            for k, off in enumerate(pat):
                piz.n(bt + off * beat, beat * 0.4, ns[k], 70 - k * 4)
            dr.n(bt, 0.4, 41, 70); dr.n(bt + 2 * beat, 0.4, 41, 52)
            dr.n(bt + 3.5 * beat, 0.1, "snare-rim", 30)
        for t, d, p in melo:
            fl.n(o + t * beat, d * beat * 0.95, p, 74)
        for t, p in drops:
            drip.n(o + t, 0.4, p, 70)
    tracks = [pad, low, piz, drip, fl, dr]
    write("sub", {"title": "Mata Adentro — Subterrâneo", "tracks": [t.d for t in tracks]})
    return L


# ---------------------------------------------------------------- VITÓRIA (6 s)
def vitoria():
    beat = 0.4
    lead = Track("trompete", "trumpet", -2, 0, 0.35, hum=(3, 3))
    harm = Track("trompas", "horn", -6, -0.25, 0.4)
    stab = Track("metais", "brass-section", -7, 0.2, 0.4)
    tuba = Track("tuba", "tuba", -6, 0, 0.2)
    gl = Track("glock", "celesta", -10, 0.3, 0.5)
    timp = Track("timpano", "timpani", -6, 0, 0.3)
    dr = Track("percussao", 0, -5, 0, 0.25, drums=True)
    seq = [(0, .33, "C5"), (.33, .33, "C5"), (.66, .34, "C5"), (1, 1, "F5"), (2, .5, "E5"), (2.5, .5, "F5"),
           (3, .66, "G5"), (3.66, .34, "A5"), (4, 6, "C6")]
    for t, d, p in seq:
        lead.n(t * beat, d * beat * 0.92, p, 100 + (p == "C6") * 12)
    hseq = [(0, 1, ["F4", "A4"]), (1, 1, ["A4", "C5"]), (2, 1, ["G4", "Bb4"]), (3, 1, ["Bb4", "E5"]), (4, 6, ["F5", "A5"])]
    for t, d, p in hseq:
        harm.n(t * beat, d * beat * 0.95, p, 88)
    for t, ch in [(1, ["F3", "A3", "C4"]), (2, ["E3", "G3", "C4"]), (3, ["E3", "Bb3", "C4"]), (4, ["F3", "A3", "C4", "F4"])]:
        stab.n(t * beat, (6 if t == 4 else 0.8) * beat, ch, 96)
    for t, p in [(0, "C2"), (1, "F2"), (2, "C2"), (3, "C2"), (4, "F1")]:
        tuba.n(t * beat, (6 if t == 4 else .8) * beat, p, 100)
    for k in range(20):
        timp.n(4 * beat + k * 0.08, 0.08, "F2", 70 + k)
    timp.n(0, .3, "C2", 100)
    for i, p in enumerate(["C6", "F6", "A6", "C7", "F6", "A6", "C7", "F7"]):
        gl.n(4 * beat + i * 0.12, 0.6, p, 80)
    dr.n(4 * beat, 3, "crash", 110); dr.n(0, 1, "crash", 80)
    for s in range(8):
        dr.n(3 * beat + s * beat / 8, .05, "snare", 60 + s * 8)
    for k in range(8):
        dr.n(4 * beat + k * 0.25, .1, 67 if k % 2 == 0 else 68, 70)
    tracks = [lead, harm, stab, tuba, gl, timp, dr]
    write("vitoria", {"title": "Vitória", "tracks": [t.d for t in tracks]})


# ---------------------------------------------------------------- FIM DE JOGO (4 s)
def derrota():
    beat = 0.5
    lead = Track("trompete", "trombone", -2, 0, 0.35, hum=(0, 0))
    stab = Track("metais", "brass-section", -8, 0.2, 0.35)
    tuba = Track("tuba", "tuba", -5, 0, 0.3)
    dr = Track("percussao", 0, -8, 0, 0.3, drums=True)
    for i, p in enumerate(["C4", "B3", "Bb3"]):
        lead.n(i * beat * 1.1, beat, p, 90 - i * 4)
    lead.n(3.3 * beat, 3.2 * beat, "A3", 80)
    stab.n(3.3 * beat, 3 * beat, ["D3", "F3", "A3"], 70)
    for i, p in enumerate(["F2", "E2", "Eb2"]):
        tuba.n(i * beat * 1.1, beat, p, 90)
    tuba.n(3.3 * beat, 3.2 * beat, "D2", 92)
    dr.n(3.3 * beat, 0.5, 41, 100); dr.n(3.3 * beat, 1, "ride", 50)
    write("derrota", {"title": "Fim de jogo", "tracks": [t.d for t in [lead, stab, tuba, dr]]})


if __name__ == "__main__":
    lens = {"tema": tema(), "mata": mata(), "sub": sub()}
    vitoria(); derrota()
    with open(os.path.join(OUT, "loops.json"), "w") as f:
        json.dump(lens, f)
    print(lens)
