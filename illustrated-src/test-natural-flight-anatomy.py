"""Regression for the two actual bad images reported during PR #246 audit."""
from pathlib import Path
import json
import numpy as np
from PIL import Image
from natural_flight_anatomy import crown_excess, CROWN_EXCESS_LIMIT

root = Path(__file__).resolve().parent.parent
source = root/'art-src/natural-flight'
repair = source/'anatomy-repair'
reg = json.loads((source/'registration.json').read_text())
regions = json.loads((repair/'regions.json').read_text())

for suit, (x0, y0, x1, y1) in regions.items():
    before = np.asarray(Image.open(repair/f'{suit}-asc-8.before.png'))
    after = np.asarray(Image.open(root/f'docs/art/suits/{suit}-asc-8.png'))
    neutral = np.asarray(Image.open(root/f'docs/art/suits/{suit}-asc-1.png'))
    heads = [f['head'] for f in reg['report'][suit]]
    bad = crown_excess(neutral, before, heads[0], heads[7])
    fixed = crown_excess(neutral, after, heads[0], heads[7])
    assert bad > CROWN_EXCESS_LIMIT, f'{suit}: guard failed to reject the real defect'
    assert fixed <= CROWN_EXCESS_LIMIT, f'{suit}: crown still outside the envelope'
    allowed = np.zeros((256, 256), dtype=bool)
    allowed[y0:y1, x0:x1] = True
    assert np.array_equal(before[~allowed], after[~allowed]), f'{suit}: pixels outside repair changed'
    if suit=='voidsuit':
        assert np.all(after[:, :, 3] <= before[:, :, 3]), f'{suit}: repair added ink'
    # Opaque original pixels retain their colors exactly. PNG canvas storage
    # can round RGB at the newly translucent antialiased boundary.
    opaque = (after[:, :, 3] == 255)
    if suit=='copper':opaque[45:86,193:229]=False  # restore the true rear ear
    assert np.array_equal(before[opaque], after[opaque]), f'{suit}: opaque original colors changed'
    print(f'{suit}: original rejected ({bad}), repair passes ({fixed}); changes local to crown')
