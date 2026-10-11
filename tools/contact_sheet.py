#!/usr/bin/env python3
"""Contact sheet of all extracted figures on mid-grey and dark backgrounds.

    python3 tools/contact_sheet.py [subdir]     # default assets/figures, output /tmp/ss-figures/
"""
import os, sys
from PIL import Image, ImageDraw

ROOT = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
sub = sys.argv[1] if len(sys.argv) > 1 else ''
D = os.path.join(ROOT, 'assets', 'figures', sub)
OUT = '/tmp/ss-figures'
os.makedirs(OUT, exist_ok=True)
ids = sorted({f.rsplit('_', 1)[0] for f in os.listdir(D) if f.endswith(('_standard.png', '_monster.png'))})
order = os.environ.get('ORDER')
if order:
    ids = order.split(',')
else:
    A = ['nimi', 'blip', 'roku', 'zen', 'kai', 'miso', 'shady', 'bub', 'tobi', 'lume', 'pix', 'crag', 'sno', 'vee',
         'kuro', 'dot', 'glitch', 'maru', 'nyx', 'zipp']
    ids = [i for i in A if i in ids] + [i for i in ids if i not in A]
cols = 5
tw, th = 400 // 2, 560 // 2
for name, bg in (('grey', (128, 128, 128)), ('dark', (22, 25, 36))):
    rows = (len(ids) + cols - 1) // cols
    sheet = Image.new('RGB', (cols * tw * 2, rows * th), bg)
    d = ImageDraw.Draw(sheet)
    for i, fid in enumerate(ids):
        cx, cy = (i % cols) * tw * 2, (i // cols) * th
        for j, form in enumerate(('standard', 'monster')):
            p = os.path.join(D, f'{fid}_{form}.png')
            if not os.path.exists(p):
                continue
            im = Image.open(p).convert('RGBA').resize((tw, th), Image.LANCZOS)
            sheet.paste(im, (cx + j * tw, cy), im)
        d.line([(cx, cy + int(540 / 2)), (cx + tw * 2, cy + int(540 / 2))], fill=(255, 0, 255), width=1)
        d.line([(cx + tw // 2, cy), (cx + tw // 2, cy + th)], fill=(0, 200, 255), width=1)
        d.line([(cx + tw + tw // 2, cy), (cx + tw + tw // 2, cy + th)], fill=(0, 200, 255), width=1)
        d.text((cx + 4, cy + 4), fid, fill=(255, 255, 0))
    sheet.save(os.path.join(OUT, f'contact_{name}.png'))
    print('wrote', os.path.join(OUT, f'contact_{name}.png'), sheet.size)
