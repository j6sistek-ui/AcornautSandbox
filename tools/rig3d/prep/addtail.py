"""give a model whose tail is skinned to the pelvis a real tail chain: the tail's vertices
(pelvis-weighted, behind x < cut) are split into NB bands by surface distance from the rump and
each band is bound to a new bone hanging from the pelvis. usage: in.glb out.glb cut NB"""
import sys, json, struct, heapq, numpy as np
sys.path.insert(0, __import__('os').path.dirname(__file__))
import glbio
src, out, cut, NB = sys.argv[1], sys.argv[2], float(sys.argv[3]), int(sys.argv[4])
j, b = glbio.load(src); pr = j['meshes'][0]['primitives'][0]; sk = j['skins'][0]
P = glbio.acc(j, b, pr['attributes']['POSITION']).astype(float); I = glbio.acc(j, b, pr['indices']).reshape(-1, 3).astype(np.int64)
JN = glbio.acc(j, b, pr['attributes']['JOINTS_0']).astype(np.int64).copy(); W = glbio.acc(j, b, pr['attributes']['WEIGHTS_0']).astype(float).copy()
if j['accessors'][pr['attributes']['WEIGHTS_0']].get('normalized'): W /= {5121: 255., 5123: 65535.}[j['accessors'][pr['attributes']['WEIGHTS_0']]['componentType']]
joints = sk['joints']; names = [j['nodes'][k].get('name') for k in joints]
pel = names.index('Pelvis'); IBM = glbio.acc(j, b, sk['inverseBindMatrices']).reshape(-1, 4, 4).transpose(0, 2, 1).astype(float)
wp = np.where(JN == pel, W, 0).sum(1); tail = (wp > 0.5) & (P[:, 0] < cut)
# surface distance from the rump: seeds are tail vertices touching non-tail ones
key = np.round(P, 5); _, wid = np.unique(key, axis=0, return_inverse=True); wid = wid.ravel(); M = wid.max() + 1
RP = np.zeros((M, 3)); RP[wid] = P; rt = np.zeros(M, bool); rt[wid[tail]] = True
adj = [[] for _ in range(M)]
for a, c, d in wid[I]:
    adj[a] += [c, d]; adj[c] += [a, d]; adj[d] += [a, c]
dist = np.full(M, np.inf); h = []
for r in range(M):
    if rt[r] and any(not rt[n] for n in adj[r]) and RP[r, 0] > cut - 0.06: dist[r] = 0; h.append((0., r))
heapq.heapify(h)
while h:
    d, r = heapq.heappop(h)
    if d > dist[r]: continue
    for n in adj[r]:
        if rt[n]:
            nd = d + np.linalg.norm(RP[r] - RP[n])
            if nd < dist[n]: dist[n] = nd; heapq.heappush(h, (nd, n))
fin = rt & np.isfinite(dist); smax = dist[fin].max(); print('tail verts', tail.sum(), 'reached', fin.sum(), 'of', rt.sum(), 'length', round(smax, 3))
band = np.minimum(NB - 1, (dist / smax * NB).astype(int))
Jp = [RP[fin & (dist <= 0.02)].mean(0)] + [RP[fin & (band == k)].mean(0) for k in range(NB)]
# joints: the root, then the centre of each band's far half
Jp = [Jp[0]] + [RP[fin & (dist > (k + .5) / NB * smax) & (dist <= (k + 1) / NB * smax)].mean(0) for k in range(NB)]
G = [np.linalg.inv(IBM[pel])]; nodes = []; parent = joints[pel]
for k in range(NB):
    t = np.linalg.inv(G[-1]) @ np.r_[Jp[k], 1]
    Gk = G[-1] @ np.array([[1, 0, 0, t[0]], [0, 1, 0, t[1]], [0, 0, 1, t[2]], [0, 0, 0, 1.]]); G.append(Gk)
    j['nodes'].append({'name': f'Tail_{k}', 'translation': t[:3].tolist()}); ni = len(j['nodes']) - 1
    j['nodes'][parent].setdefault('children', []).append(ni); parent = ni; nodes.append(ni)
base = len(joints); sk['joints'] = joints + nodes
newIBM = np.concatenate([IBM, np.array([np.linalg.inv(g) for g in G[1:]])]).transpose(0, 2, 1).astype(np.float32)
# each tail vertex: wholly its band's bone (the rig tool re-skins the tail along its own chain)
for i in np.where(tail)[0]:
    r = wid[i]
    if not np.isfinite(dist[r]): continue
    JN[i] = [base + band[r], 0, 0, 0]; W[i] = [1, 0, 0, 0]
pad = lambda x: x + b'\0' * (-len(x) % 4); buf = pad(bytes(b))
def add(arr, ct, typ, target=None):
    global buf
    raw = np.ascontiguousarray(arr).tobytes(); off = len(buf); buf += pad(raw)
    j['bufferViews'].append({'buffer': 0, 'byteOffset': off, 'byteLength': len(raw), **({'target': target} if target else {})})
    j['accessors'].append({'bufferView': len(j['bufferViews']) - 1, 'componentType': ct, 'count': int(len(arr)), 'type': typ}); return len(j['accessors']) - 1
pr['attributes']['JOINTS_0'] = add(JN.astype(np.uint16), 5123, 'VEC4', 34962)
pr['attributes']['WEIGHTS_0'] = add(W.astype(np.float32), 5126, 'VEC4', 34962)
sk['inverseBindMatrices'] = add(newIBM.reshape(-1, 16), 5126, 'MAT4')
j['buffers'][0]['byteLength'] = len(buf)
js = json.dumps(j).encode(); js += b' ' * (-len(js) % 4)
open(out, 'wb').write(b'glTF' + struct.pack('<II', 2, 12 + 8 + len(js) + 8 + len(buf)) + struct.pack('<I', len(js)) + b'JSON' + js + struct.pack('<I', len(buf)) + b'BIN\0' + buf)
print('bones', [j['nodes'][n]['name'] for n in nodes], 'joints', [np.round(p, 3).tolist() for p in Jp])
