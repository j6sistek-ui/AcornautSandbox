"""A narrow crown-silhouette guard, not a general proof of correct anatomy.

Compare each standard's opaque crown with its neutral silhouette, allowing
five pixels for ears and small head turns. Exclude the rear tail and lower
face/collar. This detects the confirmed Void/Copper duplicated crown plumes;
tail clearance elsewhere and costume identity still require visual review.
"""
import numpy as np
from scipy import ndimage

CROWN_EXCESS_LIMIT = 40


def crown_excess(neutral, current, neutral_head, current_head):
    hx, hy, radius = neutral_head
    x, y, _ = current_head
    yy, xx = np.mgrid[:256, :256]
    region = ((xx > hx-radius+8) & (xx < hx+radius+8)
              & (yy > hy-radius-28) & (yy < hy-8))
    envelope = ndimage.binary_dilation(neutral[:, :, 3] > 128, iterations=5)
    registered = ndimage.shift(current[:, :, 3] > 128, (hy-y, hx-x), order=0)
    return int((registered & region & ~envelope).sum())
