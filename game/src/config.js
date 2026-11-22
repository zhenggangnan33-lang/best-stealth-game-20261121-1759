// Shadow Gallery — every tuning number, colour and the level map in one place.
// The playfield is a fixed 1280x720 logical area (32x18 tiles of 40px); the
// renderer scales it to the window, so no rule below depends on screen size.

export const FIELD = { width: 1280, height: 720 };
export const TILE = 40;
export const STEP = 1 / 60; // fixed simulation step, seconds

export const PLAYER = {
  radius: 13,
  walkSpeed: 168,
  sneakSpeed: 86,
  pickupRadius: 30,
};

export const GUARD = {
  radius: 13,
  patrolSpeed: 72,
  chaseSpeed: 138,
  investigateSpeed: 96,
  visionRange: 240,
  visionHalfAngle: 0.58, // ~33 degrees each side
  catchRadius: 26,
  // Suspicion 0..1. Fills while the player is seen, drains while hidden.
  fillBase: 0.30,
  fillClose: 0.75, // extra fill at point-blank range
  fillSneak: 0.45, // multiplier while the player sneaks
  drain: 0.30,
  loseSightSeconds: 2.5, // unseen this long while alerted -> give up the chase
  lookSeconds: 1.6, // pause to look around at an investigated spot
};

export const COINS = { total: 5, tossRange: 280, tossSeconds: 0.38, cooldown: 0.7, lureRadius: 340 };

export const ARTIFACTS = [
  { id: 0, name: 'Ruby Idol', color: '#ff5a6e', x: 5, y: 3 },
  { id: 1, name: 'Emerald Mask', color: '#3ddc84', x: 15, y: 3 },
  { id: 2, name: 'Sapphire Eye', color: '#5aa2ff', x: 26, y: 3 },
];

// The gallery floor, one character per tile (32 wide, 18 tall):
//   # wall   . floor   o tall display case (cover: blocks sight and movement)
//   C crate (cover)   1/2/3 artifacts   P player start   (exit is the gap
//   in the bottom wall at row 17, columns 15-16)
export const MAP = [
  '################################',
  '#.........#..........#.........#',
  '#.........#..........#.........#',
  '#....1....#....2.....#....3....#',
  '#.........#..........#.........#',
  '#..o......#..o.......#..o......#',
  '#.........#..........#.........#',
  '#.........#..........#.........#',
  '#..............................#',
  '#...........o......o...........#',
  '#..............................#',
  '#..............................#',
  '####..####............####..####',
  '#.........#..........#.........#',
  '#..C......#..........#......C..#',
  '#...C.....#..........#.....C...#',
  '#.........#....P.....#.........#',
  '###############..###############',
];

export const EXIT = { x0: 15 * TILE, x1: 17 * TILE, y0: 17 * TILE, y1: 18 * TILE };

// Guard patrols: tile waypoints, walked ping-pong (there and back).
export const PATROLS = [
  { name: 'Rook', color: '#ffb020', tiles: [[3, 10], [28, 10]], speed: 78 },
  { name: 'Bishop', color: '#ff7ab8', tiles: [[17, 2], [17, 10]], speed: 68 },
  { name: 'Knight', color: '#7ae0ff', tiles: [[28, 2], [28, 10]], speed: 72 },
  { name: 'Queen', color: '#c792ff', tiles: [[7, 2], [7, 10], [2, 10]], speed: 66 },
];

export const PALETTE = {
  backdrop: '#07080d',
  floorA: '#2b2620',
  floorB: '#2f2a23',
  carpet: '#5a1f24',
  carpetEdge: '#7a2a30',
  wall: '#3d4457',
  wallTop: '#565f78',
  case: '#4a3b2c',
  caseTop: '#6b563d',
  crate: '#5a4632',
  crateTop: '#7a6248',
  player: '#e8e4d8',
  playerSneak: '#9fb4c8',
  guard: '#23262e',
  coneCalm: 'rgba(255, 214, 90, 0.20)',
  coneWary: 'rgba(255, 160, 40, 0.34)',
  coneAlert: 'rgba(255, 60, 50, 0.38)',
  exit: '#2fd67a',
  exitGlow: 'rgba(47, 214, 122, 0.35)',
  panel: '#171a23',
  panelEdge: '#2c3345',
  text: '#eef1f5',
  muted: '#9aa3b5',
  gold: '#f2c94c',
  danger: '#ff5a4b',
};

export const FONT = 'system-ui, -apple-system, "Segoe UI", sans-serif';

export const BEST_KEY = 'shadow-gallery.best-seconds';
