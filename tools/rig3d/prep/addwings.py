"""give each wing (back-bone vertices above the shoulders, split left/right) its own hinge bone
at its root, so the rig tool can drive them. usage: in.glb out.glb"""
import sys, json, struct, numpy as np
sys.path.insert(0, __import__('os').path.dirname(__file__))
import glbio
src, out = sys.argv[1:3]
j, b = glbio.load(src); pr = j['meshes'][0]['primitives'][0]; sk = j['skins'][0]
P = glbio.acc(j, b, pr['attributes']['POSITION']).astype(float)
JN = glbio.acc(j, b, pr['attributes']['JOINTS_0']).astype(np.int64).copy(); W = glbio.acc(j, b, pr['attributes']['WEIGHTS_0']).astype(float).copy()
joints = sk['joints']; names = [j['nodes'][k].get('name') for k in joints]; sp = names.index('Spine01')
IBM = glbio.acc(j, b, sk['inverseBindMatrices']).reshape(-1, 4, 4).transpose(0, 2, 1).astype(float)
dom = JN[np.arange(len(JN)), W.argmax(1)]
box = (P[:, 1] > 0.36) & (P[:, 0] > -0.12) & (P[:, 0] < 0.25) & (dom == sp)
G0 = np.linalg.inv(IBM[sp]); base = len(joints); nodes = []; IB = []
for k, (side, m) in enumerate([('L', box & (P[:, 2] < 0)), ('R', box & (P[:, 2] >= 0))]):
    q = P[m]; root = q[np.argsort(np.abs(q[:, 2]))[:max(20, len(q) // 50)]].mean(0)
    t = np.linalg.inv(G0) @ np.r_[root, 1]
    G = G0 @ np.array([[1, 0, 0, t[0]], [0, 1, 0, t[1]], [0, 0, 1, t[2]], [0, 0, 0, 1.]])
    j['nodes'].append({'name': f'{side}_Wing', 'translation': t[:3].tolist()}); ni = len(j['nodes']) - 1
    j['nodes'][joints[sp]].setdefault('children', []).append(ni); nodes.append(ni); IB.append(np.linalg.inv(G))
    JN[m] = [base + k, 0, 0, 0]; W[m] = [1, 0, 0, 0]
    print(side, 'wing verts', m.sum(), 'root', root.round(3))
sk['joints'] = joints + nodes
newIBM = np.concatenate([IBM, np.array(IB)]).transpose(0, 2, 1).astype(np.float32)
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
