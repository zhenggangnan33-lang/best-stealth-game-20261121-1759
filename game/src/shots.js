// The screenshot scenes behind ?shot=start|play|end. Each one plays the real
// rules forward from a fresh world, steered by a timing-gate autopilot: the
// thief walks a fixed route (lobby, each artifact, back out the exit) and only
// starts a leg when no guard's vision cone covers the middle of it. Once a
// leg starts it is committed — stopping mid-lane only lets the guards' cones
// top suspicion up, while walking straight through stays under the alarm.
// A chase sends the thief running for the lobby, then the route resumes.
// The same seed always gives the same frame.
import { GUARD, STEP, TILE } from './config.js';
import { SCREEN_OVER, SCREEN_PLAY, SCREEN_TITLE, SCREEN_WIN } from './render.js';

const START_SECONDS = 5;
const PLAY_SECONDS = 14;
const END_LIMIT_SECONDS = 300;

// The route, as objectives: walk to the point, or until the artifact is taken.
const OBJECTIVES = [
  { x: 15 * TILE + TILE / 2, y: 11 * TILE + TILE / 2 },
  { x: 5 * TILE + TILE / 2, y: 11 * TILE + TILE / 2 },
  { x: 5 * TILE + TILE / 2, y: 3 * TILE + TILE / 2, artifact: 0 },
  { x: 5 * TILE + TILE / 2, y: 11 * TILE + TILE / 2 },
  { x: 15 * TILE + TILE / 2, y: 11 * TILE + TILE / 2 },
  { x: 15 * TILE + TILE / 2, y: 3 * TILE + TILE / 2, artifact: 1 },
  { x: 15 * TILE + TILE / 2, y: 11 * TILE + TILE / 2 },
  { x: 26 * TILE + TILE / 2, y: 11 * TILE + TILE / 2 },
  { x: 26 * TILE + TILE / 2, y: 3 * TILE + TILE / 2, artifact: 2 },
  { x: 26 * TILE + TILE / 2, y: 11 * TILE + TILE / 2 },
  { x: 15 * TILE + TILE / 2, y: 11 * TILE + TILE / 2 },
  { x: 15 * TILE + TILE / 2, y: 16 * TILE + TILE / 2 },
  { x: 15 * TILE + TILE / 2, y: 17 * TILE + TILE / 2 },
];

function angleDiff(a, b) {
  let d = a - b;
  while (d > Math.PI) d -= Math.PI * 2;
  while (d < -Math.PI) d += Math.PI * 2;
  return d;
}

/** Would this guard spot someone standing at (x, y) right now? */
function coneCovers(world, guard, x, y) {
  const d = Math.hypot(x - guard.x, y - guard.y);
  if (d > GUARD.visionRange) return false;
  const angle = Math.atan2(y - guard.y, x - guard.x);
  if (Math.abs(angleDiff(angle, guard.facing)) > GUARD.visionHalfAngle) return false;
  return world.hasLineOfSight(guard.x, guard.y, x, y);
}

function maxSuspicion(state) {
  let max = 0;
  for (const guard of state.guards) max = Math.max(max, guard.suspicion);
  return max;
}

function anyChasing(state) {
  for (const guard of state.guards) if (guard.state === 'chase') return guard;
  return null;
}

/**
 * One autopilot step. `driver` holds the objective index and flee state.
 * Returns { move: {x, y}, sneak: boolean }.
 */
function autopilot(world, driver) {
  const state = world.state;
  const player = state.player;

  const chaser = anyChasing(state);
  if (chaser) {
    // Run directly away from the chaser: the thief (168) outruns a guard
    // (138), and the chase ends once sight is broken for a while. Never stop
    // in a dead end — the lobby has one way out and a guard behind blocks it.
    driver.fleeing = true;
    const dx = player.x - chaser.x;
    const dy = player.y - chaser.y;
    return {
      move: { x: Math.abs(dx) > 14 ? Math.sign(dx) : 0, y: Math.abs(dy) > 14 ? Math.sign(dy) : 0 },
      sneak: false,
    };
  }
  if (driver.fleeing) {
    // Wait in the lobby until every guard has calmed down, then resume.
    if (maxSuspicion(state) < 0.12) driver.fleeing = false;
    else return { move: { x: 0, y: 0 }, sneak: true };
  }

  const objective = OBJECTIVES[Math.min(driver.objective, OBJECTIVES.length - 1)];
  const done =
    objective.artifact !== undefined
      ? state.artifacts[objective.artifact].taken
      : Math.hypot(objective.x - player.x, objective.y - player.y) < 10;
  if (done) {
    driver.objective = Math.min(driver.objective + 1, OBJECTIVES.length - 1);
    driver.committed = false;
    return { move: { x: 0, y: 0 }, sneak: true };
  }

  // Timing gate: only start the leg when no guard's cone covers the middle
  // of it. Once committed, push through: stopping mid-lane is what gets a
  // thief spotted, while one clean crossing stays under the alarm.
  if (!driver.committed) {
    const midX = (player.x + objective.x) / 2;
    const midY = (player.y + objective.y) / 2;
    for (const guard of state.guards) {
      if (coneCovers(world, guard, midX, midY)) return { move: { x: 0, y: 0 }, sneak: true };
    }
    driver.committed = true;
  }

  const dx = objective.x - player.x;
  const dy = objective.y - player.y;
  return {
    move: { x: Math.abs(dx) > 4 ? Math.sign(dx) : 0, y: Math.abs(dy) > 4 ? Math.sign(dy) : 0 },
    sneak: false,
  };
}

/**
 * Set `world` to the named scene (start, play or end; any other name is start)
 * and return the screen to draw over it and the best time to show.
 */
export function stageShot(name, world) {
  world.reset();
  if (name !== 'play' && name !== 'end') {
    for (let index = 0; index < START_SECONDS / STEP; index += 1) {
      world.step(STEP, { x: 0, y: 0 }, false, null);
    }
    return { screen: SCREEN_TITLE, best: 0 };
  }
  const limit = name === 'end' ? END_LIMIT_SECONDS : PLAY_SECONDS;
  const driver = { objective: 0, fleeing: false, committed: false };
  for (let index = 0; index < limit / STEP; index += 1) {
    const drive = autopilot(world, driver);
    world.step(STEP, drive.move, drive.sneak, null);
    if (world.state.over) break;
  }
  if (world.state.won) return { screen: SCREEN_WIN, best: world.state.elapsed };
  if (world.state.over) return { screen: SCREEN_OVER, best: 0 };
  return { screen: SCREEN_PLAY, best: 0 };
}
