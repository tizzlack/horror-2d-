#!/usr/bin/env python3
"""Extract the hand-drawn figures from the art sheets into transparent PNGs.

    python3 tools/extract_figures.py              # sheet A + faceless + sheet B
    python3 tools/extract_figures.py --only A     # sheet A + faceless only
    python3 tools/extract_figures.py --report     # print size / centre report only

Output (docs/ARCHITECTURE.md "Image spec"): 400x560 RGBA, ONE uniform scale for all
images, feet on y=540, body centre on x=200.

Method (per sheet cell):
  1. "ink" mask = pixels whose colour differs from the paper colour.
  2. text (name / Standard / Monster labels), grid fragments and specks are removed.
  3. the ink mask is dilated so a flood fill from the cell border cannot leak through
     small gaps in the pencil outline; the flooded outside is then grown back through
     paper-coloured pixels to undo the dilation halo. Everything not outside = figure.
  4. the cell is split into the standard (left) and monster (right) figure at the emptiest
     column; alpha is feathered, the figure upscaled with LANCZOS + a light unsharp mask.
"""
import argparse, json, os, sys
import numpy as np
from PIL import Image, ImageFilter
from scipy import ndimage as ndi

ROOT = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
SRC = os.path.join(ROOT, 'assets', 'source')
OUT = os.path.join(ROOT, 'assets', 'figures')

IDS_A = ['nimi', 'blip', 'roku', 'zen', 'kai', 'miso', 'shady', 'bub', 'tobi', 'lume',
         'pix', 'crag', 'sno', 'vee', 'kuro', 'dot', 'glitch', 'maru', 'nyx', 'zipp']
IDS_B = ['bubs', 'pixo', 'minz', 'birk', 'kiko', 'moji', 'lumi', 'roki', 'tami', 'sora',
         'drift', 'coco', 'blep', 'skip', 'frost', 'mellow', 'gloom', 'pebo', 'vex', 'neo']

CW, CH = 400, 560
BASE_Y, CENTER_X = 540, 200
SCALE = None  # set by choose_scale()

SHEETS = {
    'A': dict(file='sheet_a.jpg', xs=[2, 267, 530, 781, 1042, 1309], ys=[55, 309, 586, 855, 1133],
              ids=IDS_A, name_box=(0, 0, 150, 44), label_h=30, divider=False,
              paper=(233, 224, 209), ink_t=50),
    'B': dict(file='sheet_b.jpg', xs=[9, 265, 530, 790, 1050, 1312], ys=[76, 329, 593, 864, 1129],
              ids=IDS_B, name_box=None, label_h=34, divider=True, ready=True,
              paper=(221, 203, 185), ink_t=58),
}
# Manual overrides for the standard/monster split column, (sheet, id) -> x relative to the cell crop.
SPLIT_OVERRIDE = {}
PAPER = np.array([233.0, 224.0, 209.0])
LEAK_T = 24         # paper-likeness threshold used to remove enclosed paper patches
NO_LEAK = {('A', 'dot')}   # cream body is the same colour as the paper
INK_T = 50          # colour distance from paper that counts as "ink"
CLOSE_R = 3         # gap-closing radius (source px)


def disk(r):
    y, x = np.ogrid[-r:r + 1, -r:r + 1]
    return x * x + y * y <= r * r


_cache = {}


def load(sheet):
    if sheet not in _cache:
        cfg = SHEETS[sheet]
        _cache[sheet] = np.asarray(Image.open(os.path.join(SRC, cfg['file'])).convert('RGB')).astype(np.float32)
    return SHEETS[sheet], _cache[sheet]


def figure_mask(sheet, r, c, margin=(7, 6), leak=True, key=None):
    """Return (cell rgb crop, figure mask of both figures, split x)."""
    cfg, a = load(sheet)
    xs, ys = cfg['xs'], cfg['ys']
    x0, x1 = xs[c] + margin[0], xs[c + 1] - margin[0]
    y0, y1 = ys[r] + margin[1], ys[r + 1] - margin[1]
    cr = a[y0:y1, x0:x1]
    H, W = cr.shape[:2]
    paper = np.array(cfg['paper'], np.float32)
    d = np.sqrt(((cr - paper) ** 2).sum(2))
    L = d > cfg['ink_t']
    nb, lab_top = cfg['name_box'], H - cfg['label_h']

    # --- junk removal on the raw ink components ---
    lab, n = ndi.label(L, structure=np.ones((3, 3)))
    kill = np.zeros_like(L)
    for i, sl in enumerate(ndi.find_objects(lab), 1):
        by0, by1, bx0, bx1 = sl[0].start, sl[0].stop, sl[1].start, sl[1].stop
        comp = lab[sl] == i
        area = int(comp.sum())
        bw, bh = bx1 - bx0, by1 - by0
        junk = area < 6
        if nb and bx1 <= nb[2] and by1 <= nb[3] and bh < 30 and area < 900:
            junk = True            # letters of the "N. NAME" title
        if by0 >= lab_top and bh < 26 and area < 900:
            junk = True            # "Standard" / "Monster" labels
        if (bx0 <= 0 or by0 <= 0 or bx1 >= W or by1 >= H) and (bw < 8 or bh < 8 or area < 80):
            junk = True            # grid fragments
        if cfg['divider'] and bw < 10 and bh > 28 and bh > 4 * bw:
            junk = True            # remnants of the cell's vertical divider line
        if junk:
            kill[sl] |= comp
    L &= ~kill

    # --- soft ground shadow under the feet: mid-tone, unsaturated, bottom rows of each figure ---
    lum = cr.mean(2)
    chroma = cr.max(2) - cr.min(2)
    shadow_like = (lum > 100) & (lum < 200) & (chroma < 42)
    sx = split_column(L, key)
    for sl in (slice(0, sx), slice(sx, W)):
        part = L[:, sl]
        rows = np.nonzero(part.any(1))[0]
        if not len(rows):
            continue
        yb = rows.max()
        band = np.zeros_like(part)
        band[max(0, yb - 11):] = True
        # only drop shadow pixels, never solid ink (dark / saturated)
        L[:, sl] &= ~(band & shadow_like[:, sl])

    # --- flood fill the outside through the dilated mask ---
    # Smaller closing radii keep narrow gaps (between legs / arms) open but may leak into pale
    # bodies through faint outline gaps; choose per figure the smallest radius that doesn't lose
    # a noticeable part of the figure compared with the safest radius.
    def flood(rad):
        Ld = ndi.binary_dilation(L, disk(rad))
        free, n = ndi.label(~Ld)
        border = np.unique(np.concatenate([free[0], free[-1], free[:, 0], free[:, -1]]))
        out = np.isin(free, border[border > 0])
        for _ in range(rad + 1):          # undo the dilation halo
            out |= ndi.binary_dilation(out, np.ones((3, 3))) & ~L
        return out
    outs = {rad: flood(rad) for rad in (1, 2, 3)}
    outside = np.zeros_like(L)
    for sl in (slice(0, sx), slice(sx, W)):
        ref = (~outs[3][:, sl]).sum()
        pick = 3
        for rad in (1, 2):
            if (~outs[rad][:, sl]).sum() >= 0.93 * ref:
                pick = rad
                break
        outside[:, sl] = outs[pick][:, sl]
    # paper-coloured patches enclosed by sketchy strokes but reachable through a gap
    if leak:
        sm = ndi.gaussian_filter(cr, (1.0, 1.0, 0))
        paperish = np.sqrt(((sm - paper) ** 2).sum(2)) < LEAK_T
        grow = outside.copy()
        while True:
            nxt = grow | (ndi.binary_dilation(grow, np.ones((3, 3))) & paperish & ~L)
            if nxt.sum() == grow.sum():
                break
            grow = nxt
        outside = grow
    F = ~outside
    # drop tiny specks
    lab, n = ndi.label(F, structure=np.ones((3, 3)))
    if n:
        sizes = ndi.sum(F, lab, range(1, n + 1))
        for i, s_ in enumerate(sizes, 1):
            if s_ < 25:
                F[lab == i] = False
    return cr, F, sx


def split_column(F, key):
    H, W = F.shape
    if key in SPLIT_OVERRIDE:
        return SPLIT_OVERRIDE[key]
    occ = F.sum(0).astype(float)
    occ = ndi.uniform_filter1d(occ, 5)
    lo, hi = int(W * 0.38), int(W * 0.62)
    return lo + int(np.argmin(occ[lo:hi]))


def forms_of_cell(sheet, r, c):
    cfg, _ = load(sheet)
    fid = cfg['ids'][r * 5 + c]
    paper = np.array(cfg['paper'], np.float32)
    cr, F, sx = figure_mask(sheet, r, c, leak=(sheet, fid) not in NO_LEAK, key=(sheet, fid))
    res = {}
    # assign whole connected components to a side (so overlapping extremities like Zipp's cap
    # brim / fan are not cut); components straddling the split are cut at the split column
    lab, n = ndi.label(F, structure=np.ones((3, 3)))
    side = {'standard': np.zeros_like(F), 'monster': np.zeros_like(F)}
    for i, sl in enumerate(ndi.find_objects(lab), 1):
        comp = np.zeros_like(F)
        comp[sl] = lab[sl] == i
        cols = np.nonzero(comp.any(0))[0]
        left = (comp[:, :sx]).sum() / comp.sum()
        if left > 0.8:
            side['standard'] |= comp
        elif left < 0.2:
            side['monster'] |= comp
        else:
            side['standard'][:, :sx] |= comp[:, :sx]
            side['monster'][:, sx:] |= comp[:, sx:]
    for form in ('standard', 'monster'):
        m = side[form]
        lab, n = ndi.label(m, structure=np.ones((3, 3)))
        sizes = ndi.sum(m, lab, range(1, n + 1))
        big_i = int(np.argmax(sizes)) + 1
        main = ndi.binary_dilation(lab == big_i, disk(7))
        for i, s_ in enumerate(sizes, 1):
            if i == big_i:
                continue
            tiny = s_ < max(25, 0.004 * sizes.max())
            floater = form == 'standard' and s_ < 0.02 * sizes.max() and not (main & (lab == i)).any()
            if tiny or floater:
                m[lab == i] = False
        # non-light figures: strip paper-coloured pixels hugging the outer edge (rim + enclosed
        # patches between sketchy strokes); eye whites / teeth lie deeper inside and survive
        lum = cr.mean(2)
        if np.median(lum[m]) < 170:
            chroma = cr.max(2) - cr.min(2)
            dpap = np.sqrt(((cr - paper) ** 2).sum(2))
            paperish = (dpap < 42) & (chroma < 45)
            depth = ndi.distance_transform_edt(m)
            m = m & ~(paperish & (depth < 7))
            light = (lum > 150) & (chroma < 60)
            if np.median(lum[m]) < 110:
                for _ in range(3):
                    edge = m & ~ndi.binary_erosion(m, np.ones((3, 3)))
                    m = m & ~(edge & light)
            lab, n = ndi.label(m, structure=np.ones((3, 3)))
            if n:
                sizes = ndi.sum(m, lab, range(1, n + 1))
                for i, s_ in enumerate(sizes, 1):
                    if s_ < max(25, 0.004 * sizes.max()):
                        m[lab == i] = False
        ys, xs = np.nonzero(m)
        y0, y1, x0, x1 = ys.min(), ys.max() + 1, xs.min(), xs.max() + 1
        res[form] = dict(rgb=cr, mask=m, bbox=(x0, y0, x1, y1), id=fid, split=sx)
    return res


def body_centre(m, bbox):
    """Horizontal centre of the BODY (legs/torso band), ignoring accessories."""
    x0, y0, x1, y1 = bbox
    h = y1 - y0
    band = m[int(y1 - 0.34 * h):int(y1 - 0.04 * h)]
    cs = []
    for row in band:
        xs = np.nonzero(row)[0]
        if len(xs):
            cs.append((xs.min() + xs.max()) / 2)
    if not cs:
        return (x0 + x1) / 2
    return float(np.median(cs))


def collect(sheet):
    out = {}
    for r in range(4):
        for c in range(5):
            f = forms_of_cell(sheet, r, c)
            for form, v in f.items():
                v['cx'] = body_centre(v['mask'], v['bbox'])
                out[(v['id'], form)] = v
    return out


def render(v, S):
    """Upscale one form by S, return RGBA canvas 400x560."""
    x0, y0, x1, y1 = v['bbox']
    pad = 4
    H, W = v['mask'].shape
    X0, Y0, X1, Y1 = max(0, x0 - pad), max(0, y0 - pad), min(W, x1 + pad), min(H, y1 + pad)
    rgb = v['rgb'][Y0:Y1, X0:X1].copy()
    m = v['mask'][Y0:Y1, X0:X1]
    # replace paper colour outside the figure by nearest figure colour (no beige fringe)
    inner = ndi.binary_erosion(m, disk(1))
    src = inner if inner.sum() > 20 else m
    idx = ndi.distance_transform_edt(~src, return_distances=False, return_indices=True)
    rgb = rgb[idx[0], idx[1]]
    h, w = m.shape
    nw, nh = int(round(w * S)), int(round(h * S))
    big = Image.fromarray(np.clip(rgb, 0, 255).astype(np.uint8)).resize((nw, nh), Image.LANCZOS)
    big = big.filter(ImageFilter.UnsharpMask(radius=1.6, percent=55, threshold=2))
    af = ndi.gaussian_filter(m.astype(np.float32), 0.7)
    al = Image.fromarray((af * 255).astype(np.uint8)).resize((nw, nh), Image.LANCZOS)
    al = np.asarray(al).astype(np.float32) / 255
    al = np.clip((al - 0.55) * 3.2 + 0.5, 0, 1)
    al = ndi.gaussian_filter(al, 0.5)
    rgba = np.dstack([np.asarray(big), (al * 255).astype(np.uint8)])
    img = Image.fromarray(rgba, 'RGBA')
    canvas = Image.new('RGBA', (CW, CH), (0, 0, 0, 0))
    ox = int(round(CENTER_X - (v['cx'] - X0) * S))
    oy = int(round(BASE_Y - (y1 - Y0) * S))
    canvas.alpha_composite(img, (0, 0)) if False else None
    # paste with clipping
    layer = Image.new('RGBA', (CW, CH), (0, 0, 0, 0))
    layer.paste(img, (ox, oy))
    canvas.alpha_composite(layer)
    return canvas


def report(forms):
    for (fid, form), v in forms.items():
        x0, y0, x1, y1 = v['bbox']
        print(f"{fid:8s}{form:9s} w={x1-x0:4d} h={y1-y0:4d} cx_off={v['cx']-(x0+x1)/2:+6.1f} split={v['split']}")


def choose_scale(forms):
    """One uniform scale for everything: the tallest/widest image must still fit the canvas."""
    hs = [(v['bbox'][3] - v['bbox'][1]) for v in forms.values()]
    ws = [2 * max(v['cx'] - v['bbox'][0], v['bbox'][2] - v['cx']) for v in forms.values()]
    return min((BASE_Y - 4) / max(hs), (CW - 6) / max(ws))


def make_faceless(nimi_std_png, out_path):
    """Bare pale silhouette from Nimi's standard alpha: soft sketchy outline, no face."""
    rng = np.random.RandomState(7)
    src = Image.open(nimi_std_png)
    al = np.asarray(src.split()[3]).astype(np.float32) / 255
    lum_src = np.asarray(src.convert('L')).astype(np.float32)
    m = al > 0.5
    # drop accessories-free: nimi has none; smooth the shape a little so it reads "bare"
    m = ndi.binary_fill_holes(ndi.binary_closing(m, disk(1)))
    m = ndi.gaussian_filter(m.astype(np.float32), 2.2) > 0.5      # smooth the jaggies
    soft = ndi.gaussian_filter(m.astype(np.float32), 1.2)
    # wobbly outline: displace the signed distance with low-frequency noise
    dist_in = ndi.distance_transform_edt(m)
    dist_out = ndi.distance_transform_edt(~m)
    sd = dist_out - dist_in
    noise = ndi.gaussian_filter(rng.randn(CH, CW), 7) * 22
    sd = sd + noise
    outline = np.clip(1 - np.abs(sd - 0.5) / 2.2, 0, 1)
    outline2 = np.clip(1 - np.abs(sd + 3.0 + noise * 0.8) / 1.3, 0, 1) * 0.5
    line = np.clip(outline + outline2, 0, 1) * (0.6 + 0.4 * (ndi.gaussian_filter(rng.rand(CH, CW), 2) > 0.45))
    # pale fill with faint paper grain and a few pencil hatch strokes on the right flank
    fill = np.zeros((CH, CW, 3), np.float32)
    fill[:] = (236, 230, 218)
    grain = ndi.gaussian_filter(rng.randn(CH, CW), 1.0) * 4
    fill += grain[..., None]
    yy, xx = np.mgrid[0:CH, 0:CW]
    hatch = (((xx + yy) % 11) < 1.1) & (xx > 222) & m
    hatch = ndi.gaussian_filter(hatch.astype(np.float32), 0.6) * ndi.gaussian_filter(rng.rand(CH, CW), 3)
    fill -= (hatch * 38)[..., None]
    # faint, eerie smudges: soft grey blotches low on the torso/at the chin, deliberately NOT a face
    for (cx, cy, rx, ry, k) in ((178, 300, 26, 14, 16), (225, 330, 20, 10, 12), (196, 262, 30, 8, 9)):
        sm = np.exp(-(((xx - cx) / rx) ** 2 + ((yy - cy) / ry) ** 2))
        fill -= (sm * k)[..., None]
    ink = np.array([46, 40, 36], np.float32)
    # keep the pencil lines of the arms / legs (below the head, i.e. no face) as soft strokes
    yy2 = np.mgrid[0:CH, 0:CW][0]
    strokes = ((lum_src < 120) & (yy2 > 395) & (yy2 < 492) & (sd < -6)).astype(np.float32)
    strokes = ndi.gaussian_filter(strokes, 1.2) * 0.42
    line = np.clip(line + strokes, 0, 1)
    rgb = fill * (1 - line[..., None]) + ink * line[..., None]
    alpha = np.clip(np.maximum(soft, line * 0.9), 0, 1)
    alpha = np.where((sd > 3.5), 0, alpha)
    out = np.dstack([np.clip(rgb, 0, 255), alpha * 255]).astype(np.uint8)
    Image.fromarray(out, 'RGBA').save(out_path)


def main():
    ap = argparse.ArgumentParser()
    ap.add_argument('--only', choices=['A', 'B'])
    ap.add_argument('--report', action='store_true')
    ap.add_argument('--scale', type=float)
    args = ap.parse_args()
    os.makedirs(OUT, exist_ok=True)
    formsA = collect('A')
    S = args.scale or choose_scale(formsA)
    print(f'uniform scale {S:.4f}')
    if args.report:
        report(formsA)
        return
    for (fid, form), v in formsA.items():
        render(v, S).save(os.path.join(OUT, f'{fid}_{form}.png'), optimize=True)
    make_faceless(os.path.join(OUT, 'nimi_standard.png'), os.path.join(OUT, 'faceless.png'))
    if args.only != 'A' and 'B' in SHEETS and SHEETS['B'].get('ready'):
        formsB = collect('B')
        # sheet B is not used at launch; its tallest monster is slightly taller than sheet A's,
        # so shrink B a touch if needed rather than clipping it
        SB = min(S, choose_scale(formsB))
        if SB < S:
            print(f'sheet B scale {SB:.4f} (A: {S:.4f})')
        os.makedirs(os.path.join(OUT, 'sheet_b'), exist_ok=True)
        for (fid, form), v in formsB.items():
            render(v, SB).save(os.path.join(OUT, 'sheet_b', f'{fid}_{form}.png'), optimize=True)
    print('done')


if __name__ == '__main__':
    main()
