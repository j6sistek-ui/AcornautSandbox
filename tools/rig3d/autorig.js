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
//      rigidly, and sharpen the tail/body split everywhere except the true root
//   4. find where the tail should turn: the tail chain's own axis (so tailOut: 1 lays
//      it straight out behind on any model) and the hinge point at the root that
//      stretches the join least, so the plume swings as one piece and keeps the
//      shape it was sculpted with
//   5. expose one control surface, apply(pose), in degrees about the lateral
//      axis: + is nose up / limb forward / tail back; tailAim points the tail
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
  // head: the bone carrying the most of the mesh - the face, the cheeks, the ears. It used to be
  // "the most direct children", which held until a cat whose rig hangs its front legs off a
  // neck bone tied three bones for it and picked the pelvis
  let head = map.head != null ? byName(map.head) : count.reduce((best, n, i) => i !== root && n > count[best] ? i : best, root === 0 ? 1 : 0);
  const pathToRoot = i => { const p = []; while (i >= 0) { p.unshift(i); i = parent[i]; } return p; };
  const spinePath = pathToRoot(head);
  const onSpine = new Set(spinePath);
  // every chain hanging off the spine path: a bone plus its descendants
  const subtree = i => { const out = [i]; for (const c of kids[i]) out.push(...subtree(c)); return out; };
  const chains = [];
  for (const s of spinePath) if (s !== head) for (const c of kids[s]) if (!onSpine.has(c)) chains.push(subtree(c));
  const tipY = ch => Math.min(...ch.map(i => wpos(bones[i]).y));
  const verts = ch => ch.reduce((a, i) => a + count[i], 0);
  // tail FIRST: the heaviest chain of all. Picking the legs first ("the four reaching lowest")
  // took a tail that curls down below the feet for a hind leg - the robot squirrel's ten-bone
  // tail flew as a leg and its tail got one stray bone
  const tailMain = chains.slice().sort((a, b) => verts(b) - verts(a))[0] || [];
  // legs: the four chains reaching lowest, of the rest
  const legs = chains.filter(c => c !== tailMain).sort((a, b) => tipY(a) - tipY(b)).slice(0, 4);
  const rest = chains.filter(c => !legs.includes(c));
  // forward runs from the tail's mass to the head
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

  // ---------- 3. rebuild the tail (and 4. its hinge, further down) ----------
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
  // the TRUE root: where the tail leaves the rump, at its shallowest original bone. Only the
  // tail/body boundary there seeds the distance; where the tail merely touches the back
  // further up, those points are measured along the tail like the rest of it.
  const depthMin = Math.min(...tailOrder.map(i => pathToRoot(i).length));
  const rootPt = new THREE.Vector3(); { const sh = tailOrder.filter(i => pathToRoot(i).length === depthMin); sh.forEach(i => rootPt.add(wpos(bones[i]))); rootPt.divideScalar(sh.length); }
  const boundary = []; for (let r = 0; r < M; r++) if (isTail(r)) for (const n of adj[r]) if (!isTail(n)) { boundary.push(r); break; }
  const ROOT_R = 0.07;
  let seeds = boundary.filter(r => RP[r].distanceTo(rootPt) <= ROOT_R);
  if (seeds.length < 8) seeds = boundary.slice().sort((a, b) => RP[a].distanceTo(rootPt) - RP[b].distanceTo(rootPt)).slice(0, 24);
  for (const r of seeds) { dist[r] = 0; push(0, r); }
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
  // SMOOTH THE TAIL'S PARAMETER NEAR THE ROOT. Where the sculpt wraps the tail's base tightly,
  // side-by-side points can sit far apart along the tail, and their bones then shear the skin
  // between them into a fin. Relaxing the parameter over the surface (root fixed at 0) makes
  // neighbours move like neighbours; the outer tail, where the chain already reads cleanly, is left.
  { const ROOT_SMOOTH = 0.4, fixed = new Uint8Array(M); for (let r = 0; r < M; r++) if (dist[r] === 0) fixed[r] = 1;
    for (let it = 0; it < 80; it++) { const next = Float32Array.from(sParam);
      for (let r = 0; r < M; r++) { if (fixed[r] || sParam[r] < 0 || sParam[r] > ROOT_SMOOTH) continue; let a = 0, c = 0; for (const n of adj[r]) if (sParam[n] >= 0) { a += sParam[n]; c++; } if (c) next[r] = 0.5 * sParam[r] + 0.5 * a / c; }
      sParam.set(next); } }
  // ...and gently along the whole tail, so the thick plume bends as one surface instead of
  // folding where the outer skin projects onto a tight bend (neighbours already far apart
  // along the tail, across a fused curl, are left alone)
  { const fixed = new Uint8Array(M); for (let r = 0; r < M; r++) if (dist[r] === 0) fixed[r] = 1;
    for (let it = 0; it < (opts.smoothTail ?? 60); it++) { const next = Float32Array.from(sParam);
      for (let r = 0; r < M; r++) { if (fixed[r] || sParam[r] < 0) continue; let a = 0, c = 0; for (const n of adj[r]) if (sParam[n] >= 0 && Math.abs(sParam[n] - sParam[r]) < 0.1) { a += sParam[n]; c++; } if (c) next[r] = 0.5 * sParam[r] + 0.5 * a / c; }
      sParam.set(next); } }
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
  // tail share per vertex: wholly tail or wholly body away from the true root (no film across the back)
  const share = new Float32Array(N), sOf = new Float32Array(N);
  for (let i = 0; i < N; i++) { const t = tailW[i], s = sParam[weld[i]] >= 0 ? sParam[weld[i]] : 0; sOf[i] = s; share[i] = t < 0.02 ? 0 : (s > 0.06 ? (t >= 0.5 ? 1 : 0) : t); }
  const rShare = new Float32Array(M); { const n = new Float32Array(M); for (let i = 0; i < N; i++) { rShare[weld[i]] += share[i]; n[weld[i]]++; } for (let r = 0; r < M; r++) if (n[r]) rShare[r] /= n[r]; }

  // CUTS where the sculpt fused the curl onto itself, so it can unroll. Cutting where the tail
  // lies against the back too ({ contactCut: true }) opened a dark pocket under a lip at the top
  // of the root as the tail swung out, so by default that strip stays skin and is blended below.
  const CONTACT_S = 0.06;   // the same line the hard tail/body split starts at
  const cutFace = new Uint8Array(ix.length / 3), touched = new Uint8Array(M);
  let cut = 0, contact = 0;
  for (let t = 0; t < ix.length; t += 3) {
    const rs = [weld[ix[t]], weld[ix[t + 1]], weld[ix[t + 2]]];
    const ss = rs.map(r => sParam[r]).filter(x => x >= 0), bs = rs.map(r => band[r]).filter(x => x >= 0);
    const sp = ss.length > 1 ? Math.max(...ss) - Math.min(...ss) : 0, bsp = bs.length > 1 ? Math.max(...bs) - Math.min(...bs) : 0;
    const sides = rs.map(r => rShare[r] >= 0.5), mixed = sides.some(x => x) && sides.some(x => !x);
    const tailS = Math.max(0, ...rs.filter(r => rShare[r] >= 0.5).map(r => sParam[r]));
    if (opts.unroll && (sp > 0.18 || bsp > 1)) { cutFace[t / 3] = 1; cut++; }
    else if (opts.contactCut === true && mixed && tailS > CONTACT_S) { cutFace[t / 3] = 1; contact++; }
    if (cutFace[t / 3]) rs.forEach(r => touched[r] = 1);
  }
  const adjK = Array.from({ length: M }, () => new Set());
  for (let t = 0; t < ix.length; t += 3) if (!cutFace[t / 3]) { const a = weld[ix[t]], b = weld[ix[t + 1]], c = weld[ix[t + 2]]; adjK[a].add(b).add(c); adjK[b].add(a).add(c); adjK[c].add(a).add(b); }

  // THE BLEND ZONE. A hard 0/1 line creases and spikes when the tail pivots, so at the root the
  // share is diffused across the surface within BLEND of the join, on both sides.
  const BLEND = opts.blend ?? 0.09;
  const dj = new Float64Array(M).fill(Infinity), hq = [];
  const hpush = (d, n) => { hq.push([d, n]); let i = hq.length - 1; while (i > 0) { const p = (i - 1) >> 1; if (hq[p][0] <= hq[i][0]) break; [hq[p], hq[i]] = [hq[i], hq[p]]; i = p; } };
  const hpop = () => { const top = hq[0], last = hq.pop(); if (hq.length) { hq[0] = last; let i = 0; for (;;) { const l = 2 * i + 1, r = l + 1; let m = i; if (l < hq.length && hq[l][0] < hq[m][0]) m = l; if (r < hq.length && hq[r][0] < hq[m][0]) m = r; if (m === i) break; [hq[m], hq[i]] = [hq[i], hq[m]]; i = m; } } return top; };
  for (let r = 0; r < M; r++) for (const n of adjK[r]) if ((rShare[r] >= 0.5) !== (rShare[n] >= 0.5)) { dj[r] = 0; hpush(0, r); break; }
  while (hq.length) { const [d, r] = hpop(); if (d > dj[r] || d > BLEND) continue; for (const n of adjK[r]) { const nd = d + RP[r].distanceTo(RP[n]); if (nd < dj[n]) { dj[n] = nd; hpush(nd, n); } } }
  const zone = []; for (let r = 0; r < M; r++) if (dj[r] <= BLEND) zone.push(r);
  for (let it = 0; it < 60; it++) { const next = new Float32Array(rShare); for (const r of zone) { let a = 0, c = 0; for (const n of adjK[r]) { a += rShare[n]; c++; } if (c) next[r] = a / c; } rShare.set(next); }

  // SOCKETED EDGES. Where the sculpt sinks the tail's open edges into the rump, those edges
  // stay with the body (fading back to tail over TUCK_W), so swinging the tail does not pull
  // them out as a ragged flange with a hole behind it.
  const tuck = new Float32Array(M).fill(1); let socketed = 0;
  if (opts.tuck !== false) { const TUCK_R = opts.tuckR ?? 0.04, TUCK_W = opts.tuckW ?? 0.1;
    const ec = new Map(); for (let t = 0; t < ix.length; t += 3) for (const [a, b] of [[ix[t], ix[t + 1]], [ix[t + 1], ix[t + 2]], [ix[t + 2], ix[t]]]) { const wa = weld[a], wb = weld[b]; const k = wa < wb ? wa * M + wb : wb * M + wa; ec.set(k, (ec.get(k) || 0) + 1); }
    const open = new Uint8Array(M); for (const [k, c] of ec) if (c === 1) { open[Math.floor(k / M)] = 1; open[k % M] = 1; }
    const body = []; for (let r = 0; r < M; r++) if (rTail[r] < 0.02 && sParam[r] < 0) body.push(r);
    const R2 = TUCK_R * TUCK_R, dt = new Float64Array(M).fill(Infinity), tq = [];
    for (let r = 0; r < M; r++) { if (!open[r] || rShare[r] < 0.5 || sParam[r] > 0.35) continue; let near = false; for (const b of body) if (RP[b].distanceToSquared(RP[r]) < R2) { near = true; break; } if (near) { dt[r] = 0; hpush(0, r); socketed++; } }
    while (hq.length) { const [d, r] = hpop(); if (d > dt[r] || d > TUCK_W) continue; for (const n of adj[r]) { if (rShare[n] < 0.02) continue; const nd = d + RP[r].distanceTo(RP[n]); if (nd < dt[n]) { dt[n] = nd; hpush(nd, n); } } }
    for (let r = 0; r < M; r++) if (dt[r] <= TUCK_W) { const f = dt[r] / TUCK_W; tuck[r] = f * f * (3 - 2 * f); } }

  // write the weights. Each tail vertex follows the bones within TENT joints of it (a tent
  // falloff), not just the two either side, so a bend is shared over a stretch of skin
  // instead of creasing it at one joint
  const TENT = opts.tent ?? 2;
  const bodyAnchor = bones.indexOf(parentBone);
  for (let i = 0; i < N; i++) {
    const r = weld[i], t = (dj[r] <= BLEND ? rShare[r] : share[i]) * tuck[r];
    if (t < 0.002 && tailW[i] < 0.02) continue;
    const u = Math.min(NB - 1e-4, sOf[i] * NB), c = u - 0.5; let k0 = Math.floor(c), f = c - k0, k1 = k0 + 1;
    if (k0 < 0) { k0 = 0; f = 0; } if (k1 > NB - 1) k1 = NB - 1;
    const ws = [];
    if (t < 1) { let bodySum = 0; for (let k = 0; k < 4; k++) { const bi = si.getComponent(i, k), w = sw.getComponent(i, k); if (!tailIdx.has(bi) && w > 0) { ws.push([bi, w]); bodySum += w; } }
      if (bodySum > 0) ws.forEach(x => x[1] *= (1 - t) / bodySum); else ws.push([bodyAnchor, 1 - t]); }
    if (t > 0 && TENT > 1) { const cc = Math.min(NB - 1, Math.max(0, c)); const tw = []; let tot = 0; for (let k = 0; k < NB; k++) { const w = Math.max(0, 1 - Math.abs(cc - k) / TENT); if (w > 0) { tw.push([base + k, w]); tot += w; } } tw.forEach(x => ws.push([x[0], t * x[1] / tot])); }
    else if (t > 0) { ws.push([base + k0, t * (1 - f)]); if (k1 !== k0) ws.push([base + k1, t * f]); else ws[ws.length - 1][1] = t; }
    ws.sort((a, b) => b[1] - a[1]); const top = ws.slice(0, 4), tot = top.reduce((a, x) => a + x[1], 0) || 1;
    for (let k = 0; k < 4; k++) { si.setComponent(i, k, top[k] ? top[k][0] : 0); sw.setComponent(i, k, top[k] ? top[k][1] / tot : 0); }
  }

  // CAPS. Every opening a cut leaves is closed, tail side and body side separately (a fan to
  // each side's own centre), so an unrolling curl shows skin, not a hole, and no cap ever
  // spans tail and body.
  const keepIx = []; for (let t = 0; t < ix.length; t += 3) if (!cutFace[t / 3]) keepIx.push(ix[t], ix[t + 1], ix[t + 2]);
  const dirE = new Map();
  for (let t = 0; t < keepIx.length; t += 3) for (const [a, b] of [[keepIx[t], keepIx[t + 1]], [keepIx[t + 1], keepIx[t + 2]], [keepIx[t + 2], keepIx[t]]]) dirE.set(weld[a] + ':' + weld[b], [a, b]);
  const bEdges = [];
  for (const [k, [a, b]] of dirE) { const [wa, wb] = k.split(':'); if (dirE.has(wb + ':' + wa)) continue; if (!touched[weld[a]] || !touched[weld[b]]) continue; bEdges.push([a, b]); }
  const sideOf = i => rShare[weld[i]] >= 0.5;
  const par = bEdges.map((_, i) => i), find = x => par[x] === x ? x : (par[x] = find(par[x]));
  const byV = new Map(); bEdges.forEach(([a, b], e) => { if (sideOf(a) !== sideOf(b)) return; for (const v of [weld[a], weld[b]]) { const k = v + (sideOf(a) ? 't' : 'b'); if (byV.has(k)) par[find(e)] = find(byV.get(k)); else byV.set(k, e); } });
  const groups = new Map(); bEdges.forEach(([a, b], e) => { if (sideOf(a) !== sideOf(b)) return; const g = find(e); if (!groups.has(g)) groups.set(g, []); groups.get(g).push([a, b]); });
  const attrs = Object.entries(geo.attributes), extra = [], capN = [], capTris = []; let caps = 0;
  for (const edges of groups.values()) {
    if (edges.length < 3) continue;
    const vs = [...new Set(edges.flat())]; const nv = N + extra.length;
    extra.push(vs); caps++;
    for (const [a, b] of edges) capTris.push(b, a, nv);
    // the cap faces the way its own fan does (an averaged rim normal can cancel out and shade it black)
    const c = new THREE.Vector3(); vs.forEach(v => c.add(new THREE.Vector3().fromBufferAttribute(pos, v))); c.divideScalar(vs.length);
    const n = new THREE.Vector3(), pa = new THREE.Vector3(), pb = new THREE.Vector3();
    for (const [a, b] of edges) { pa.fromBufferAttribute(pos, a).sub(c); pb.fromBufferAttribute(pos, b).sub(c); n.add(new THREE.Vector3().crossVectors(pb, pa)); }
    capN.push(n.normalize());
  }
  if (extra.length) {
    const total = N + extra.length;
    for (const [name, attr] of attrs) {
      const sz = attr.itemSize, arr = new attr.array.constructor(total * sz); arr.set(attr.array);
      extra.forEach((vs, e) => {
        const o = (N + e) * sz;
        if (name === 'skinIndex' || name === 'skinWeight') return;
        if (name === 'position') { for (const v of vs) for (let c = 0; c < sz; c++) arr[o + c] += attr.array[v * sz + c] / vs.length; }
        else if (name === 'normal') capN[e].toArray(arr, o);
        else for (let c = 0; c < sz; c++) arr[o + c] = attr.array[vs[0] * sz + c];
      });
      if (name === 'skinIndex' || name === 'skinWeight') {
        extra.forEach((vs, e) => { const acc = new Map(); for (const v of vs) for (let k = 0; k < 4; k++) { const bi = si.getComponent(v, k), w = sw.getComponent(v, k); if (w > 0) acc.set(bi, (acc.get(bi) || 0) + w); } const top = [...acc].sort((a, b) => b[1] - a[1]).slice(0, 4), tot = top.reduce((a, x) => a + x[1], 0) || 1; for (let k = 0; k < 4; k++) arr[(N + e) * 4 + k] = top[k] ? (name === 'skinIndex' ? top[k][0] : top[k][1] / tot) : 0; });
      }
      geo.setAttribute(name, new THREE.BufferAttribute(arr, sz, attr.normalized));
    }
  }
  geo.setIndex(keepIx.concat(capTris));
  mesh.bind(new THREE.Skeleton(allBones, inverses), mesh.bindMatrix);
  // signed bend of the curl at each joint, about the lateral axis
  const ang = []; for (let k = 1; k < NB; k++) { const a = J[k].clone().sub(J[k - 1]), b = J[k + 1].clone().sub(J[k]); const cr = new THREE.Vector3().crossVectors(a, b); ang.push(Math.atan2(cr.dot(LAT), a.dot(b))); }
  const tailRestQ = tailBones.map(b => b.quaternion.clone());
  // WHERE "STRAIGHT OUT" IS. tailOut 1 lays the tail's axis (root to the centre of its
  // joints) straight out behind. An unrolling tail no longer points where its curl did -
  // unrolled, it lies along its base - so tailOutAt(unfurl) rebuilds the chain in the forward/up plane with the curl opened by
  // that much, exactly as apply() opens it, and measures where its joints now point. The
  // robot squirrel's tail curls up and forward over its back, so swinging it by its curled
  // axis with the curl opened hung it straight down.
  const rampAt = k => { const r = Math.min(1, Math.max(0, (k - 1) / 3)); return r * r * (3 - 2 * r); };
  const segLen = [], seg0 = J[1].clone().sub(J[0]); for (let k = 0; k < NB; k++) segLen.push(J[k + 1].distanceTo(J[k]));
  const a0 = Math.atan2(seg0.dot(UP), seg0.dot(fwd));
  const axisAt = u => { let a = a0, x = 0, y = 0, sx = 0, sy = 0; for (let k = 0; k < NB; k++) { if (k > 0) a += ang[k - 1] * (1 - u * rampAt(k)); x += Math.cos(a) * segLen[k]; y += Math.sin(a) * segLen[k]; sx += x; sy += y; } return Math.atan2(sy, sx) * 180 / Math.PI; };
  // measured along the joints, not the mass: the robot's coil sits forward over its back, so
  // its mass axis ran 56 degrees off the chain and every swing overshot by that much
  const tailOutAt = u => 180 - axisAt(u);
  // past straight out (and back past the sculpt's angle) the swing is in plain degrees, the
  // same on every model, so an overshoot written for one tail is not doubled on another
  const OVER_DEG = 70;
  // TAIL AIM: where a pose wants the tail's axis, in plain degrees in the forward/up plane -
  // 180 straight out behind, 90 straight up, past 180 below - blended from the sculpt's own
  // rest angle by w. The same aim puts every model's tail in the same place, however it was
  // sculpted: a robot cat whose tail is modelled straight out swings exactly as far as a
  // squirrel whose plume is modelled upright. Frame 1 (w = 0) is the sculpt itself.
  const wrapDeg = d => ((d % 360) + 540) % 360 - 180;
  const REST_AXIS = axisAt(0);
  const aimDeg = (w, to, u) => wrapDeg(REST_AXIS + wrapDeg(to - REST_AXIS) * w - axisAt(u));

  // THE HINGE. The tail joins the rump across a wide patch, so where it turns matters: turned
  // about the middle of its base, the front of that patch tears off the back and stretches.
  // Try pivots in the forward/up plane around the root and keep the one that, swinging the
  // tail straight out, stretches and squeezes the skin across the join least.
  const HP = J[0].clone();
  if (opts.hingeSearch !== false) {
    const tw = new Float32Array(N); for (let i = 0; i < N; i++) for (let k = 0; k < 4; k++) if (si.getComponent(i, k) >= base) tw[i] += sw.getComponent(i, k);
    const E = []; const seen = new Set();
    for (let t = 0; t < ix.length; t += 3) for (const [a, b] of [[ix[t], ix[t + 1]], [ix[t + 1], ix[t + 2]], [ix[t + 2], ix[t]]]) { if (Math.abs(tw[a] - tw[b]) < 1e-3) continue; const k = a < b ? a * N + b : b * N + a; if (seen.has(k)) continue; seen.add(k); E.push(a, b); }
    // the swings the moves actually make: out past straight, and up over the back
    const qs = (opts.hingeAims || [200, 100]).map(to => new THREE.Quaternion().setFromAxisAngle(LAT, aimDeg(1, to, 0) * Math.PI / 180));
    let q = qs[0]; const v = new THREE.Vector3(), pa = new THREE.Vector3(), pb = new THREE.Vector3();
    // vertex i (rest position P[i]) with the tail turned straight out about pivot H
    const moved = (i, H, out) => { v.copy(P[i]).sub(H).applyQuaternion(q).add(H); return out.copy(P[i]).lerp(v, tw[i]); };
    const cost1 = H => { let c = 0; for (let e = 0; e < E.length; e += 2) { const a = E[e], b = E[e + 1], L = P[a].distanceTo(P[b]); if (L < 1e-7) continue; const L1 = moved(a, H, pa).distanceTo(moved(b, H, pb)); c += (L1 - L) * (L1 - L) / L; } return c; };
    const cost = H => qs.reduce((c, qq) => { q = qq; return c + cost1(H); }, 0);
    let best = cost(HP), bp = HP.clone();
    for (const [R, st] of [[0.3, 0.03], [0.04, 0.008]]) { const c0 = bp.clone(); for (let x = -R; x <= R + 1e-9; x += st) for (let y = -R; y <= R + 1e-9; y += st) { const H = c0.clone().addScaledVector(fwd, x).addScaledVector(UP, y); const c = cost(H); if (c < best) { best = c; bp = H; } } }
    HP.copy(bp);
  }
  // the hinge in tail_00's own frame, so apply() can turn the tail about it
  const hingeLocal = tailBones[0].worldToLocal(HP.clone()), tail0Pos = tailBones[0].position.clone();

  // ---------- 5. one control surface ----------
  const all = bones.concat(tailBones);
  const restAll = all.map(b => b.quaternion.clone());
  const pivot = new THREE.Group(); pivot.name = 'flightPivot';
  const box = new THREE.Box3().setFromObject(model), centre = box.getCenter(new THREE.Vector3());
  pivot.position.copy(centre); model.position.sub(centre); pivot.add(model);
  // the tail's swing: all at the hinge, so the plume turns as one piece ({ rootSplit: [...] }
  // shares it down the first joints instead, bending the plume's base)
  const ROOT_SPLIT = opts.rootSplit || [1], ROOT_MAX = opts.rootMax ?? 95;
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
    const unf = p.unfurl ?? 0, out = p.tailOut || 0, outIn = Math.min(1, Math.max(0, out));
    const outDeg = p.tailAim ? aimDeg(p.tailAim[0], p.tailAim[1], unf) : outIn * tailOutAt(unf) + (out - outIn) * OVER_DEG;
    tailBones.forEach((b, k) => {
      const rootRamp = Math.min(1, Math.max(0, (k - 1) / 3)), ramp = rootRamp * rootRamp * (3 - 2 * rootRamp);
      const bend = k === 0 ? 0 : -ang[k - 1] * unf * ramp * 180 / Math.PI;
      // the root hinge turns at most ROOT_MAX; any more is shared by the next joints, so a
      // tail that must turn far (the robot's starts pointing up over its back) bends at its
      // base instead of dragging the rump round with one joint
      const swing = outDeg + (p.tailRoot || 0), held = Math.max(-ROOT_MAX, Math.min(ROOT_MAX, swing)), extra = swing - held;
      const deg = held * (ROOT_SPLIT[k] || 0) + (k >= 1 && k <= 3 ? extra / 3 : 0) + bend + lagAt(p.tail, k);
      b.quaternion.copy(tailRestQ[k]).multiply(new THREE.Quaternion().setFromAxisAngle(LAT, deg * Math.PI / 180));
      // tail_00 turns about the hinge, not its own origin
      if (k === 0) b.position.copy(tail0Pos).add(hingeLocal.clone().applyQuaternion(tailRestQ[0])).sub(hingeLocal.clone().applyQuaternion(b.quaternion));
    });
    pivot.updateMatrixWorld(true);
  }

  return {
    pivot, model, mesh, apply, debug: { sOf: () => sOf, weld, sParam, axisAt, tailOutAt, aimDeg }, centre, LAT, FWD: fwd, UP, all, tailBones,
    info: {
      head: bones[head].name, ears: ears.map(i => bones[i].name), spine: spine.map(i => bones[i].name),
      front: front.map(c => c.map(i => bones[i].name)), hind: hind.map(c => c.map(i => bones[i].name)),
      tail: [...tailSet].map(i => bones[i].name), forward: fwd.toArray().map(x => +x.toFixed(3)),
      tailBones: NB, tailRestAxisDeg: +REST_AXIS.toFixed(1), hinge: HP.clone().sub(J[0]).toArray().map(x => +x.toFixed(3)), cutFaces: cut, contactFaces: contact, caps, socketed, looseTailPieces: islands, curlDeg: ang.map(a => +(a * 180 / Math.PI).toFixed(1)),
    },
  };
}
