// AUTO-RIG FOR TRIPO SQUIRREL MODELS.
//
// Takes a rigged Tripo GLB and turns it into one standard flight rig, so the
// same moves (moves.js) render the same frames for every model:
//
//   1. classify the skeleton by geometry, not by name (Tripo's auto-fit puts
//      its template names on the wrong parts: on the first model its "Head"
//      chain was the tail) - head, ears/antennae, spine, four legs, tail
//   2. find the axes: forward = tail to head, up = +Y, lateral = forward x up
//   3. rebuild the tail as a 12-bone chain down the middle of the real curl
//      (geodesic distance from the root, walked only between neighbouring
//      bands of the original weights, so a curl tip fused to the root cannot
//      shortcut), re-weight the tail to it, carry loose pieces (sprinkles)
//      rigidly, cut the faces where the sculpt fused the curl onto itself, and
//      sharpen the tail/body split everywhere except the true root
//   4. expose one control surface, apply(pose), in degrees about the lateral
//      axis: + is nose up / limb forward / tail back
//
// Runs in a browser (three.js, WebGL). studio.html drives it.
import * as THREE from 'three';
import { GLTFLoader } from 'three/addons/loaders/GLTFLoader.js';

export const TAIL_BONES = 12;

export async function loadRig(url, opts = {}) {
  const gltf = await new GLTFLoader().loadAsync(url);
  const model = gltf.scene; model.updateMatrixWorld(true);
  let mesh = null; model.traverse(o => { if (o.isSkinnedMesh && !mesh) mesh = o; });
  if (!mesh) throw new Error('no skinned mesh: rig the model in Tripo first');
  const skel = mesh.skeleton, bones = skel.bones;
  const geo = mesh.geometry, pos = geo.attributes.position, si = geo.attributes.skinIndex, sw = geo.attributes.skinWeight;
  const N = pos.count;
  const wpos = b => b.getWorldPosition(new THREE.Vector3());
  const P = []; { const v = new THREE.Vector3(); for (let i = 0; i < N; i++) P.push(v.fromBufferAttribute(pos, i).applyMatrix4(mesh.matrixWorld).clone()); }

  // ---------- 1. classify ----------
  const dom = new Int32Array(N); const count = new Array(bones.length).fill(0); const cent = bones.map(() => new THREE.Vector3());
  for (let i = 0; i < N; i++) { let b = 0, w = -1; for (let k = 0; k < 4; k++) { const x = sw.getComponent(i, k); if (x > w) { w = x; b = si.getComponent(i, k); } } dom[i] = b; count[b]++; cent[b].add(P[i]); }
  cent.forEach((c, b) => count[b] && c.divideScalar(count[b]));
  const kids = bones.map(b => b.children.filter(c => c.isBone).map(c => bones.indexOf(c)).filter(i => i >= 0));
  const parent = bones.map(b => bones.indexOf(b.parent));
  const root = parent.findIndex(p => p < 0);
  const map = opts.map || {};
  const byName = n => bones.findIndex(b => b.name.replace(/[^A-Za-z0-9_]/g, '') === n);
  // head: the bone carrying the face - the one with the most direct children
  let head = map.head != null ? byName(map.head) : kids.reduce((best, k, i) => k.length > kids[best].length ? i : best, 0);
  const pathToRoot = i => { const p = []; while (i >= 0) { p.unshift(i); i = parent[i]; } return p; };
  const spinePath = pathToRoot(head);
  const onSpine = new Set(spinePath);
  // every chain hanging off the spine path: a bone plus its descendants
  const subtree = i => { const out = [i]; for (const c of kids[i]) out.push(...subtree(c)); return out; };
  const chains = [];
  for (const s of spinePath) if (s !== head) for (const c of kids[s]) if (!onSpine.has(c)) chains.push(subtree(c));
  const tipY = ch => Math.min(...ch.map(i => wpos(bones[i]).y));
  const verts = ch => ch.reduce((a, i) => a + count[i], 0);
  // legs: the four chains reaching lowest
  const legs = chains.slice().sort((a, b) => tipY(a) - tipY(b)).slice(0, 4);
  const rest = chains.filter(c => !legs.includes(c));
  // tail: the heaviest remaining chain; forward runs from its mass to the head
  const tailMain = rest.slice().sort((a, b) => verts(b) - verts(a))[0] || [];
  const massOf = ch => { const c = new THREE.Vector3(); let n = 0; ch.forEach(i => { c.addScaledVector(cent[i], count[i]); n += count[i]; }); return n ? c.divideScalar(n) : null; };
  const fwd = wpos(bones[head]).sub(massOf(tailMain)); fwd.y = 0; fwd.normalize();
  // any other leftover chain whose mass sits behind the hips is part of the tail too (the base of a big curl)
  const hips = wpos(bones[root]).dot(fwd);
  const tailSet = new Set(tailMain);
  for (const c of rest) if (c !== tailMain) { const m = massOf(c); if (m && m.dot(fwd) < hips) c.forEach(i => tailSet.add(i)); }
  const UP = new THREE.Vector3(0, 1, 0), LAT = new THREE.Vector3().crossVectors(fwd, UP).normalize();
  const along = v => v.dot(fwd);
  const legRoots = legs.map(c => ({ c, x: along(wpos(bones[c[0]])) })).sort((a, b) => b.x - a.x);
  const front = legRoots.slice(0, 2).map(l => l.c), hind = legRoots.slice(2).map(l => l.c);
  // ears/antennae: the head's two highest children
  const ears = kids[head].slice().sort((a, b) => wpos(bones[b]).y - wpos(bones[a]).y).slice(0, 2);
  const spine = spinePath.filter(i => i !== root && i !== head);

  // ---------- rest state + rotation helper ----------
  const restQ = bones.map(b => b.quaternion.clone());
  const restWInv = bones.map(b => b.getWorldQuaternion(new THREE.Quaternion()).invert());
  const turn = (i, deg) => { if (i == null || i < 0) return; const a = LAT.clone().applyQuaternion(restWInv[i]).normalize(); bones[i].quaternion.copy(restQ[i]).multiply(new THREE.Quaternion().setFromAxisAngle(a, deg * Math.PI / 180)); };

  // ---------- 3. rebuild the tail ----------
  const tailIdx = tailSet;
  const tailW = new Float32Array(N);
  for (let i = 0; i < N; i++) for (let k = 0; k < 4; k++) if (tailIdx.has(si.getComponent(i, k))) tailW[i] += sw.getComponent(i, k);
  const key = p => `${Math.round(p.x * 1e4)},${Math.round(p.y * 1e4)},${Math.round(p.z * 1e4)}`;
  const weld = new Int32Array(N), reps = [], km = new Map();
  for (let i = 0; i < N; i++) { const k = key(P[i]); let r = km.get(k); if (r === undefined) { r = reps.length; km.set(k, r); reps.push(i); } weld[i] = r; }
  const M = reps.length, RP = reps.map(i => P[i]);
  const adj = Array.from({ length: M }, () => new Set());
  const ix = geo.index.array;
  for (let t = 0; t < ix.length; t += 3) { const a = weld[ix[t]], b = weld[ix[t + 1]], c = weld[ix[t + 2]]; adj[a].add(b).add(c); adj[b].add(a).add(c); adj[c].add(a).add(b); }
  const rTail = new Float32Array(M); for (let i = 0; i < N; i++) rTail[weld[i]] = Math.max(rTail[weld[i]], tailW[i]);
  const isTail = r => rTail[r] > 0.5;
  // bands: tail bones in order from the root (by distance from the body along the chain)
  const tailOrder = [...tailSet].sort((a, b) => pathToRoot(a).length - pathToRoot(b).length || wpos(bones[a]).y - wpos(bones[b]).y);
  const bandOf = new Map(); { let d = 0; const depth0 = Math.min(...tailOrder.map(i => pathToRoot(i).length)); tailOrder.forEach(i => bandOf.set(i, pathToRoot(i).length - depth0)); }
  const band = new Int8Array(M).fill(-1);
  for (let i = 0; i < N; i++) { let best = -1, bw = 0; for (let k = 0; k < 4; k++) { const b = si.getComponent(i, k), w = sw.getComponent(i, k); if (bandOf.has(b) && w > bw) { bw = w; best = bandOf.get(b); } } if (best >= 0) band[weld[i]] = best; }
  const minBand = Math.min(...[...band].filter(b => b >= 0));
  const dist = new Float64Array(M).fill(Infinity), heap = [];
  const push = (d, n) => { heap.push([d, n]); let i = heap.length - 1; while (i > 0) { const p = (i - 1) >> 1; if (heap[p][0] <= heap[i][0]) break; [heap[p], heap[i]] = [heap[i], heap[p]]; i = p; } };
  const pop = () => { const top = heap[0], last = heap.pop(); if (heap.length) { heap[0] = last; let i = 0; for (;;) { const l = 2 * i + 1, r = l + 1; let m = i; if (l < heap.length && heap[l][0] < heap[m][0]) m = l; if (r < heap.length && heap[r][0] < heap[m][0]) m = r; if (m === i) break; [heap[m], heap[i]] = [heap[i], heap[m]]; i = m; } } return top; };
  for (let r = 0; r < M; r++) if (isTail(r) && band[r] <= minBand + 1) for (const n of adj[r]) if (!isTail(n)) { dist[r] = 0; push(0, r); break; }
  while (heap.length) { const [d, r] = pop(); if (d > dist[r]) continue; for (const n of adj[r]) { if (!isTail(n) || Math.abs(band[n] - band[r]) > 1) continue; const nd = d + RP[r].distanceTo(RP[n]); if (nd < dist[n]) { dist[n] = nd; push(nd, n); } } }
  let smax = 0; for (let r = 0; r < M; r++) if (isTail(r) && isFinite(dist[r])) smax = Math.max(smax, dist[r]);
  const NB = TAIL_BONES;
  const sum = Array.from({ length: NB + 1 }, () => [new THREE.Vector3(), 0]);
  for (let r = 0; r < M; r++) if (isTail(r) && isFinite(dist[r])) { const b = Math.min(NB, Math.round(dist[r] / smax * NB)); sum[b][0].add(RP[r]); sum[b][1]++; }
  const J = sum.map(([p, c]) => c ? p.divideScalar(c) : null);
  for (let i = 0; i <= NB; i++) if (!J[i]) { let a = i - 1; while (a >= 0 && !J[a]) a--; let b = i + 1; while (b <= NB && !J[b]) b++; J[i] = (a >= 0 && b <= NB) ? J[a].clone().lerp(J[b], (i - a) / (b - a)) : (J[a] || J[b]).clone(); }
  for (let it = 0; it < 2; it++) for (let i = 1; i < NB; i++) J[i] = J[i].clone().multiplyScalar(0.5).add(J[i - 1].clone().add(J[i + 1]).multiplyScalar(0.25));
  const sParam = new Float32Array(M).fill(-1);
  const projectNear = (pt, guess) => { const g = Math.round(guess * NB); let best = Infinity, bs = guess; for (let k = Math.max(0, g - 2); k <= Math.min(NB - 1, g + 2); k++) { const a = J[k], d = J[k + 1].clone().sub(a), L2 = d.lengthSq(); let t = L2 ? pt.clone().sub(a).dot(d) / L2 : 0; t = Math.min(1, Math.max(0, t)); const q = a.clone().addScaledVector(d, t), dd = q.distanceToSquared(pt); if (dd < best) { best = dd; bs = (k + t) / NB; } } return bs; };
  for (let r = 0; r < M; r++) if (isTail(r) && isFinite(dist[r])) sParam[r] = projectNear(RP[r], dist[r] / smax);
  const comp = new Int32Array(M).fill(-1); let nc = 0;
  for (let r = 0; r < M; r++) if (comp[r] < 0) { const st = [r]; comp[r] = nc; while (st.length) { const x = st.pop(); for (const n of adj[x]) if (comp[n] < 0) { comp[n] = nc; st.push(n); } } nc++; }
  const members = Array.from({ length: nc }, () => []); for (let r = 0; r < M; r++) members[comp[r]].push(r);
  const anchors = []; for (let r = 0; r < M; r++) if (sParam[r] >= 0) anchors.push(r);
  let islands = 0;
  for (const mem of members) { if (!mem.some(r => rTail[r] > 0.02) || mem.some(r => sParam[r] >= 0)) continue; const c = new THREE.Vector3(); mem.forEach(r => c.add(RP[r])); c.divideScalar(mem.length); let best = Infinity, bs = 0; for (const a of anchors) { const d = RP[a].distanceToSquared(c); if (d < best) { best = d; bs = sParam[a]; } } mem.forEach(r => sParam[r] = bs); islands++; }
  // the new bones hang off the spine bone nearest the tail's root, world rotation identity
  const parentBone = bones[spine.slice().sort((a, b) => wpos(bones[a]).distanceTo(J[0]) - wpos(bones[b]).distanceTo(J[0]))[0] ?? root];
  const tailBones = []; let prev = parentBone;
  const addBone = (name, at) => { const b = new THREE.Bone(); b.name = name; b.position.copy(at.clone().applyMatrix4(prev.matrixWorld.clone().invert())); b.quaternion.copy(prev.getWorldQuaternion(new THREE.Quaternion()).invert()); prev.add(b); b.updateMatrixWorld(true); prev = b; return b; };
  for (let i = 0; i < NB; i++) tailBones.push(addBone('tail_' + String(i).padStart(2, '0'), J[i]));
  const tip = addBone('tail_tip', J[NB]);
  const base = bones.length;
  const allBones = bones.concat(tailBones, [tip]);
  const inverses = skel.boneInverses.concat(tailBones.map(b => b.matrixWorld.clone().invert()), [tip.matrixWorld.clone().invert()]);
  for (let i = 0; i < N; i++) {
    const t = tailW[i]; if (t < 0.02) continue;
    const r = weld[i], s = sParam[r] >= 0 ? sParam[r] : 0;
    const u = Math.min(NB - 1e-4, s * NB), c = u - 0.5; let k0 = Math.floor(c), f = c - k0, k1 = k0 + 1;
    if (k0 < 0) { k0 = 0; f = 0; } if (k1 > NB - 1) k1 = NB - 1;
    // sharpen: away from the true root a vertex belongs wholly to the tail or wholly to the body
    let tt = t; if (s > 0.06) tt = t >= 0.5 ? 1 : 0;
    const ws = []; if (tt < 1) for (let k = 0; k < 4; k++) { const bi = si.getComponent(i, k), w = sw.getComponent(i, k); if (!tailIdx.has(bi) && w > 0) ws.push([bi, w]); }
    if (tt > 0) { ws.push([base + k0, tt * (1 - f)]); if (k1 !== k0) ws.push([base + k1, tt * f]); else ws[ws.length - 1][1] = tt; }
    if (!ws.length) continue;
    ws.sort((a, b) => b[1] - a[1]); const top = ws.slice(0, 4), tot = top.reduce((a, x) => a + x[1], 0);
    for (let k = 0; k < 4; k++) { si.setComponent(i, k, top[k] ? top[k][0] : 0); sw.setComponent(i, k, top[k] ? top[k][1] / tot : 0); }
  }
  si.needsUpdate = sw.needsUpdate = true;
  mesh.bind(new THREE.Skeleton(allBones, inverses), mesh.bindMatrix);
  let cut = 0; { const keep = []; for (let t = 0; t < ix.length; t += 3) { const rs = [weld[ix[t]], weld[ix[t + 1]], weld[ix[t + 2]]]; const ss = rs.map(r => sParam[r]).filter(x => x >= 0), bs = rs.map(r => band[r]).filter(x => x >= 0); const sp = ss.length > 1 ? Math.max(...ss) - Math.min(...ss) : 0, bsp = bs.length > 1 ? Math.max(...bs) - Math.min(...bs) : 0; if (sp > 0.18 || bsp > 1) { cut++; continue; } keep.push(ix[t], ix[t + 1], ix[t + 2]); } geo.setIndex(keep); }
  // signed bend of the curl at each joint, about the lateral axis
  const ang = []; for (let k = 1; k < NB; k++) { const a = J[k].clone().sub(J[k - 1]), b = J[k + 1].clone().sub(J[k]); const cr = new THREE.Vector3().crossVectors(a, b); ang.push(Math.atan2(cr.dot(LAT), a.dot(b))); }
  const tailRestQ = tailBones.map(b => b.quaternion.clone());

  // ---------- 4. one control surface ----------
  const all = bones.concat(tailBones);
  const restAll = all.map(b => b.quaternion.clone());
  const pivot = new THREE.Group(); pivot.name = 'flightPivot';
  const box = new THREE.Box3().setFromObject(model), centre = box.getCenter(new THREE.Vector3());
  pivot.position.copy(centre); model.position.sub(centre); pivot.add(model);
  const lagAt = (fn, k) => typeof fn === 'function' ? fn(k / (NB - 1), k) : (fn || 0);
  function apply(p) {
    all.forEach((b, i) => b.quaternion.copy(restAll[i]));
    pivot.quaternion.setFromAxisAngle(LAT, (p.pitch || 0) * Math.PI / 180);
    pivot.position.copy(centre).addScaledVector(UP, p.lift || 0);
    spine.forEach((i, n) => turn(i, (p.spine || 0) / spine.length));
    turn(head, p.head || 0);
    ears.forEach((i, n) => turn(i, (p.ears || 0) * (n ? 0.85 : 1)));
    front.forEach((ch, n) => { const v = n ? (p.frontR ?? p.front ?? 0) : (p.frontL ?? p.front ?? 0); turn(ch[0], v * 0.55); if (ch[1] != null) turn(ch[1], v * 0.35); if (ch[2] != null) turn(ch[2], -(p.paw || 0) - v * 0.2); });
    hind.forEach((ch, n) => { const v = n ? (p.hindR ?? p.hind ?? 0) : (p.hindL ?? p.hind ?? 0); turn(ch[0], v + (n ? 4 : -4)); if (ch[1] != null) turn(ch[1], p.hindLow || 0); if (ch[2] != null) turn(ch[2], (p.hindLow || 0) * 0.6); });
    const unf = p.unfurl ?? 0.8;
    tailBones.forEach((b, k) => {
      const rootRamp = Math.min(1, Math.max(0, (k - 1) / 3)), ramp = rootRamp * rootRamp * (3 - 2 * rootRamp);
      const bend = k === 0 ? 0 : -ang[k - 1] * unf * ramp * 180 / Math.PI;
      const deg = (k === 0 ? (p.tailRoot || 0) : 0) + bend + lagAt(p.tail, k);
      b.quaternion.copy(tailRestQ[k]).multiply(new THREE.Quaternion().setFromAxisAngle(LAT, deg * Math.PI / 180));
    });
    pivot.updateMatrixWorld(true);
  }

  return {
    pivot, model, mesh, apply, centre, LAT, FWD: fwd, UP, all, tailBones,
    info: {
      head: bones[head].name, ears: ears.map(i => bones[i].name), spine: spine.map(i => bones[i].name),
      front: front.map(c => c.map(i => bones[i].name)), hind: hind.map(c => c.map(i => bones[i].name)),
      tail: [...tailSet].map(i => bones[i].name), forward: fwd.toArray().map(x => +x.toFixed(3)),
      tailBones: NB, cutFaces: cut, looseTailPieces: islands, curlDeg: ang.map(a => +(a * 180 / Math.PI).toFixed(1)),
    },
  };
}
