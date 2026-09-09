/** Presentation-only High Orbit identities; ownership and gameplay stay in catalog/sim. */
export const HIGH_ORBIT_IDS = ['cinderforge','groveguard','cosmic','sunforged','abyssal'] as const;
export type HighOrbitId = typeof HIGH_ORBIT_IDS[number];
export const isHighOrbit = (id:string): id is HighOrbitId => (HIGH_ORBIT_IDS as readonly string[]).includes(id);
export const HIGH_ORBIT_HEAD_RADIUS = 36;
export const HIGH_ORBIT_DISPLAY_SPAN = 192;
export const HIGH_ORBIT_PROFILES = {
  cinderforge: {name:'Cinderforge',trail:'cinderforgewake',wake:'Molten Mantle',colors:['#fff4bb','#ff951f','#cb2718'],period:1.72,inertia:1.10,whip:1.02,seed:.2},
  groveguard: {name:'Groveguard',trail:'groveguardwake',wake:'Verdant Slipstream',colors:['#fff5b4','#91e89c','#247c55'],period:2.03,inertia:1.00,whip:1.06,seed:1.1},
  cosmic: {name:'Cosmic',trail:'cosmicwake',wake:'Astral Veil',colors:['#f3d9ff','#b382ed','#556dec'],period:2.20,inertia:1.08,whip:1.02,seed:2.4},
  sunforged: {name:'Sunforged',trail:'sunforgedwake',wake:'Solar Corona',colors:['#fff8d1','#ffd06c','#e68521'],period:1.90,inertia:1.15,whip:.97,seed:3.6},
  abyssal: {name:'Abyssal',trail:'abyssalwake',wake:'Abyssal Current',colors:['#d8ffff','#58dfe9','#1676a1'],period:2.10,inertia:1.04,whip:1.12,seed:4.7},
} as const;
export const highOrbitTrailSuit = (trail:string): HighOrbitId|undefined =>
  HIGH_ORBIT_IDS.find(id=>HIGH_ORBIT_PROFILES[id].trail===trail);
