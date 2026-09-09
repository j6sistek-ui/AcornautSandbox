#!/usr/bin/env python3
"""Check pose transfer and local costume colours; visual review covers detail topology.

These banks intentionally follow Eclipse's changing tail silhouette. Compare each
pose to its Eclipse reference, not to the obsolete banks' median tail volume.
"""
import colorsys
import json
import math
from pathlib import Path
import numpy as np
from PIL import Image

ROOT = Path(__file__).resolve().parents[1]
SOURCE = ROOT / 'art-src/eclipse-motion-transfer'
ART = ROOT / 'docs/art/suits'


def inspect():
    registration = json.loads((SOURCE / 'registration.json').read_text())
    features = json.loads((SOURCE / 'features.json').read_text())
    problems, report = [], {}
    yy, xx = np.ogrid[:256, :256]
    for suit in ('cryostar', 'verdant'):
        rows = []
        for n, frame in enumerate(registration[suit]):
            name = frame['name']
            im = Image.open(ART / (name + '.png'))
            if im.size != (256, 256) or im.mode != 'RGBA':
                problems.append(name + ': must be 256px RGBA')
                continue
            a = np.asarray(im)
            e = np.asarray(Image.open(ART / (name.replace(suit, 'eclipse') + '.png')).convert('RGBA'))
            mask, ref = a[:, :, 3] > 32, e[:, :, 3] > 32
            if mask[0].any() or mask[-1].any() or mask[:, 0].any() or mask[:, -1].any():
                problems.append(name + ': clipped or opaque background')
            iou = float((mask & ref).sum() / (mask | ref).sum())
            # Costumes differ in panel edges, but a wrong/mirrored/reordered pose
            # cannot maintain this overlap against the corresponding Eclipse.
            if iou < .90:
                problems.append(f'{name}: silhouette overlap {iou:.3f} below .90')
            eye, old_eye = frame['eye'], frame['eclipseEye']
            eye_offset = math.hypot(eye['cx'] - old_eye['cx'], eye['cy'] - old_eye['cy'])
            if eye_offset > 6:
                problems.append(f'{name}: reference eye displacement {eye_offset:.1f}px')
            # Pixel-based checks do not trust a claimed dome radius as scale proof.
            hx, hy = frame['dome'][:2]
            head_disk = (xx - hx) ** 2 + (yy - hy) ** 2 <= 30 ** 2
            head_fill = float((mask & head_disk).sum() / head_disk.sum())
            if head_fill < .94:
                problems.append(f'{name}: head leaves its fixed skull region ({head_fill:.3f})')
            opaque = a[:, :, 3] > 200
            rgb = a[:, :, :3].astype(float) / 255
            magenta = opaque & (np.minimum(rgb[:, :, 0], rgb[:, :, 2]) - rgb[:, :, 1] > .10)
            if magenta.any():
                problems.append(f'{name}: production matte remains')
            materials = {}
            for feature in ('shoulder', 'hip'):
                cx, cy = features[feature][n]
                region = opaque & ((xx - cx) ** 2 + (yy - cy) ** 2 <= 16 ** 2)
                hsv = [colorsys.rgb_to_hsv(*p) for p in rgb[region]]
                lo, hi = ((.48, .66) if suit == 'cryostar' else (.23, .46))
                colour = [p for p in hsv if lo <= p[0] <= hi and p[1] > .28 and .12 < p[2] < .98]
                if len(colour) < 60:
                    problems.append(f'{name}: {feature} lost its own coloured insert ({len(colour)}px)')
                median = np.median(colour, axis=0).tolist() if colour else [0, 0, 0]
                materials[feature] = {'pixels': len(colour), 'hsv': median}
            rows.append({'name': name, 'silhouetteIoU': iou, 'eyeOffsetPx': eye_offset, 'headFill': head_fill, 'materials': materials})
        for feature in ('shoulder', 'hip'):
            hues = [f['materials'][feature]['hsv'][0] for f in rows]
            span = max(hues) - min(hues)
            if span > .008:
                problems.append(f'{suit}: {feature} hue span {span:.3f} exceeds .008')
        report[suit] = rows
    return problems, report


if __name__ == '__main__':
    import sys
    failures, metrics = inspect()
    if '--report' in sys.argv:
        (SOURCE / 'review').mkdir(exist_ok=True)
        (SOURCE / 'review/art-report.json').write_text(json.dumps({'passed': not failures, 'problems': failures, 'metrics': metrics}, indent=2) + '\n')
    for problem in failures:
        print('FAIL ' + problem)
    if not failures:
        print('PASS: 32 Eclipse pose matches, skull regions, transparent edges and 64 local armor-insert samples.')
    raise SystemExit(bool(failures))
