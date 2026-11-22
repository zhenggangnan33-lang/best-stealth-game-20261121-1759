// The game's rules and state, with no drawing and no browser in it: the gallery
// floor, the thief, four patrolling guards with vision cones, suspicion, chases,
// tossed coins, the three artifacts and the exit. step() advances one fixed step
// and returns what happened as bit flags, so the caller can react without the
// world knowing about screens or sound. Nothing here allocates after createWorld
// returns, except the small coin-flight record (at most one coin in flight).
import { ARTIFACTS, COINS, EXIT, FIELD, GUARD, MAP, PATROLS, PLAYER, STEP, TILE } from './config.js';

export const EVENT_PICKUP = 1;
export const EVENT_SPOTTED = 2; // a guard's suspicion just hit full
export const EVENT_CAUGHT = 4;
export const EVENT_WIN = 8;
export const EVENT_COIN = 16;
export const EVENT_COIN_LAND = 32;

const COLS = 32;
const ROWS = 18;

function tileAt(col, row) {
  if (col < 0 || col >= COLS || row < 0 || row >= ROWS) return '#';
  return MAP[row][col];
}

/** True when the tile blocks movement and sight (wall, display case, crate). */
export function isSolid(col, row) {
  const t = tileAt(col, row);
  return t === '#' || t === 'o' || t === 'C';
}

function tileCenter(col, row) {
  return { x: col * TILE + TILE / 2, y: row * TILE + TILE / 2 };
}

function dist(ax, ay, bx, by) {
  return Math.hypot(ax - bx, ay - by);
}

function angleDiff(a, b) {
  let d = a - b;
  while (d > Math.PI) d -= Math.PI * 2;
  while (d < -Math.PI) d += Math.PI * 2;
  return d;
}

/** Line of sight: sample the segment; blocked when a sample lands in a solid tile. */
export function hasLineOfSight(ax, ay, bx, by) {
  const d = dist(ax, ay, bx, by);
  const steps = Math.max(1, Math.ceil(d / 9));
  for (let i = 1; i < steps; i += 1) {
    const t = i / steps;
    const x = ax + (bx - ax) * t;
    const y = ay + (by - ay) * t;
    if (isSolid(Math.floor(x / TILE), Math.floor(y / TILE))) return false;
  }
  return true;
}

export function createWorld(random) {
  const player = { x: 0, y: 0, dirX: 0, dirY: -1, sneaking: false, moving: false };
  const guards = PATROLS.map((patrol) => {
    const start = tileCenter(patrol.tiles[0][0], patrol.tiles[0][1]);
    return {
      name: patrol.name,
      color: patrol.color,
      speed: patrol.speed,
      x: start.x,
      y: start.y,
      facing: Math.PI / 2, // facing down the gallery to start
      waypoints: patrol.tiles.map(([c, r]) => tileCenter(c, r)),
      waypoint: 1,
      pingPong: 1,
      suspicion: 0,
      state: 'patrol', // patrol | chase | investigate | look
      stateTime: 0,
      lastSeenX: 0,
      lastSeenY: 0,
      unseenTime: 0,
      pauseTime: 0,
    };
  });
  const artifacts = ARTIFACTS.map((a) => ({
    ...a,
    x: a.x * TILE + TILE / 2,
    y: a.y * TILE + TILE / 2,
    taken: false,
    bob: random() * Math.PI * 2,
  }));
  const coin = { active: false, x: 0, y: 0, tx: 0, ty: 0, t: 0, fromX: 0, fromY: 0 };
  const state = {
    player,
    guards,
    artifacts,
    coin,
    collected: 0,
    elapsed: 0,
    alerts: 0,
    coinsLeft: COINS.total,
    coinCooldown: 0,
    over: false,
    won: false,
    caughtBy: null,
  };

  function reset() {
    const start = tileCenter(15, 16);
    player.x = start.x;
    player.y = start.y;
    player.dirX = 0;
    player.dirY = -1;
    player.sneaking = false;
    player.moving = false;
    for (const guard of guards) {
      guard.x = guard.waypoints[0].x;
      guard.y = guard.waypoints[0].y;
      guard.facing = Math.PI / 2;
      guard.waypoint = 1;
      guard.pingPong = 1;
      guard.suspicion = 0;
      guard.state = 'patrol';
      guard.stateTime = 0;
      guard.unseenTime = 0;
      guard.pauseTime = 0;
    }
    for (const artifact of artifacts) artifact.taken = false;
    coin.active = false;
    state.collected = 0;
    state.elapsed = 0;
    state.alerts = 0;
    state.coinsLeft = COINS.total;
    state.coinCooldown = 0;
    state.over = false;
    state.won = false;
    state.caughtBy = null;
  }

  /**
   * Circle-vs-wall movement: step, then push the circle out of every solid
   * tile it overlaps, along the shortest way out. A head-on push stops the
   * body; a glancing push lets it slide along the wall and around corners
   * instead of wedging on them.
   */
  function moveCircle(body, dx, dy) {
    const r = body.radius ?? PLAYER.radius;
    body.x += dx;
    body.y += dy;
    for (let iter = 0; iter < 3; iter += 1) {
      let pushed = false;
      const top = Math.floor((body.y - r) / TILE);
      const bottom = Math.floor((body.y + r) / TILE);
      const left = Math.floor((body.x - r) / TILE);
      const right = Math.floor((body.x + r) / TILE);
      for (let row = top; row <= bottom; row += 1) {
        for (let col = left; col <= right; col += 1) {
          if (!isSolid(col, row)) continue;
          const cx = Math.max(col * TILE, Math.min(body.x, col * TILE + TILE));
          const cy = Math.max(row * TILE, Math.min(body.y, row * TILE + TILE));
          const ddx = body.x - cx;
          const ddy = body.y - cy;
          const d2 = ddx * ddx + ddy * ddy;
          if (d2 >= r * r) continue;
          if (d2 === 0) {
            body.y -= r; // centre inside the tile: push straight up out of it
          } else {
            const d = Math.sqrt(d2);
            const push = r - d;
            body.x += (ddx / d) * push;
            body.y += (ddy / d) * push;
          }
          pushed = true;
        }
      }
      if (!pushed) break;
    }
  }

  /** Can the guard see the player right now (cone + range + line of sight)? */
  function guardSees(guard) {
    const d = dist(guard.x, guard.y, player.x, player.y);
    if (d > GUARD.visionRange) return false;
    const angle = Math.atan2(player.y - guard.y, player.x - guard.x);
    if (Math.abs(angleDiff(angle, guard.facing)) > GUARD.visionHalfAngle) return false;
    return hasLineOfSight(guard.x, guard.y, player.x, player.y);
  }

  function stepGuard(guard, dt, events) {
    const sees = guardSees(guard);
    if (sees) {
      guard.lastSeenX = player.x;
      guard.lastSeenY = player.y;
      guard.unseenTime = 0;
      const d = dist(guard.x, guard.y, player.x, player.y);
      const closeness = 1 - d / GUARD.visionRange;
      let rate = GUARD.fillBase + GUARD.fillClose * closeness;
      if (player.sneaking) rate *= GUARD.fillSneak;
      const before = guard.suspicion;
      guard.suspicion = Math.min(1, guard.suspicion + rate * dt);
      if (before < 1 && guard.suspicion >= 1 && guard.state !== 'chase') {
        guard.state = 'chase';
        guard.stateTime = 0;
        state.alerts += 1;
        events |= EVENT_SPOTTED;
      }
    } else {
      guard.unseenTime += dt;
      if (guard.state !== 'chase') guard.suspicion = Math.max(0, guard.suspicion - GUARD.drain * dt);
    }

    if (guard.state === 'chase') {
      // Run at the player's last seen spot; give up after losing sight a while.
      const tx = sees ? player.x : guard.lastSeenX;
      const ty = sees ? player.y : guard.lastSeenY;
      moveToward(guard, tx, ty, GUARD.chaseSpeed, dt);
      if (!sees && guard.unseenTime > GUARD.loseSightSeconds) {
        guard.state = 'patrol';
        guard.suspicion = 0.35;
        guard.stateTime = 0;
      }
      if (dist(guard.x, guard.y, player.x, player.y) < GUARD.catchRadius) {
        state.over = true;
        state.caughtBy = guard.name;
        return events | EVENT_CAUGHT;
      }
      return events;
    }

    if (guard.state === 'investigate') {
      moveToward(guard, guard.lastSeenX, guard.lastSeenY, GUARD.investigateSpeed, dt);
      if (dist(guard.x, guard.y, guard.lastSeenX, guard.lastSeenY) < 10) {
        guard.state = 'look';
        guard.stateTime = 0;
      }
      return events;
    }

    if (guard.state === 'look') {
      guard.stateTime += dt;
      guard.facing += dt * 1.8; // scan the room
      if (guard.stateTime > GUARD.lookSeconds) {
        guard.state = 'patrol';
        guard.stateTime = 0;
      }
      return events;
    }

    // Patrol: walk the waypoints, ping-pong, pausing briefly at each end.
    if (guard.pauseTime > 0) {
      guard.pauseTime -= dt;
      return events;
    }
    const target = guard.waypoints[guard.waypoint];
    moveToward(guard, target.x, target.y, guard.speed, dt);
    if (dist(guard.x, guard.y, target.x, target.y) < 6) {
      guard.waypoint += guard.pingPong;
      if (guard.waypoint >= guard.waypoints.length || guard.waypoint < 0) {
        guard.pingPong *= -1;
        guard.waypoint += guard.pingPong * 2;
        guard.pauseTime = 0.7;
      }
    }
    return events;
  }

  function moveToward(guard, tx, ty, speed, dt) {
    const dx = tx - guard.x;
    const dy = ty - guard.y;
    const d = Math.hypot(dx, dy);
    if (d < 0.5) return;
    const stepLen = Math.min(d, speed * dt);
    const mx = (dx / d) * stepLen;
    const my = (dy / d) * stepLen;
    guard.facing = Math.atan2(dy, dx);
    const body = { x: guard.x, y: guard.y, radius: GUARD.radius };
    moveCircle(body, mx, my);
    guard.x = body.x;
    guard.y = body.y;
  }

  function stepCoin(dt) {
    if (!coin.active) return 0;
    coin.t += dt / COINS.tossSeconds;
    if (coin.t < 1) {
      coin.x = coin.fromX + (coin.tx - coin.fromX) * coin.t;
      coin.y = coin.fromY + (coin.ty - coin.fromY) * coin.t;
      return 0;
    }
    coin.x = coin.tx;
    coin.y = coin.ty;
    coin.active = false;
    // The clink draws every guard near the landing spot over to look.
    for (const guard of guards) {
      if (guard.state === 'chase') continue;
      if (dist(guard.x, guard.y, coin.x, coin.y) < COINS.lureRadius) {
        guard.state = 'investigate';
        guard.stateTime = 0;
        guard.lastSeenX = coin.x;
        guard.lastSeenY = coin.y;
        guard.unseenTime = 0;
      }
    }
    return EVENT_COIN_LAND;
  }

  /**
   * One fixed step. `move` is {x, y} (each -1, 0 or 1), `sneak` a boolean,
   * `toss` a {x, y} target in field pixels, or null.
   */
  function step(dt, move, sneak, toss) {
    let events = 0;
    if (state.over) return events;
    state.elapsed += dt;
    if (state.coinCooldown > 0) state.coinCooldown -= dt;

    // Thief movement.
    const speed = sneak ? PLAYER.sneakSpeed : PLAYER.walkSpeed;
    const mx = move.x * speed * dt;
    const my = move.y * speed * dt;
    player.sneaking = sneak;
    player.moving = mx !== 0 || my !== 0;
    if (player.moving) {
      player.dirX = move.x;
      player.dirY = move.y;
    }
    const body = { x: player.x, y: player.y, radius: PLAYER.radius };
    moveCircle(body, mx, 0);
    moveCircle(body, 0, my);
    player.x = Math.min(FIELD.width - PLAYER.radius, Math.max(PLAYER.radius, body.x));
    player.y = Math.min(FIELD.height - PLAYER.radius, Math.max(PLAYER.radius, body.y));

    // Toss a coin (mouse click): one in flight at a time, limited supply.
    if (toss && !coin.active && state.coinsLeft > 0 && state.coinCooldown <= 0) {
      const dx = toss.x - player.x;
      const dy = toss.y - player.y;
      const d = Math.hypot(dx, dy);
      const range = Math.min(d, COINS.tossRange);
      const nx = d === 0 ? player.x : player.x + (dx / d) * range;
      const ny = d === 0 ? player.y : player.y + (dy / d) * range;
      coin.active = true;
      coin.fromX = player.x;
      coin.fromY = player.y;
      coin.tx = Math.min(FIELD.width - 8, Math.max(8, nx));
      coin.ty = Math.min(FIELD.height - 8, Math.max(8, ny));
      coin.t = 0;
      state.coinsLeft -= 1;
      state.coinCooldown = COINS.cooldown;
      events |= EVENT_COIN;
    }
    events |= stepCoin(dt);

    // Pick up artifacts by walking over them.
    for (const artifact of artifacts) {
      if (artifact.taken) continue;
      if (dist(player.x, player.y, artifact.x, artifact.y) < PLAYER.pickupRadius) {
        artifact.taken = true;
        state.collected += 1;
        events |= EVENT_PICKUP;
      }
    }

    // Guards.
    for (const guard of guards) {
      events |= stepGuard(guard, dt, events);
      if (state.over) return events;
    }

    // Win: all three artifacts, then step into the exit doorway.
    if (
      state.collected === ARTIFACTS.length &&
      player.x > EXIT.x0 && player.x < EXIT.x1 &&
      player.y > EXIT.y0 && player.y < EXIT.y1
    ) {
      state.over = true;
      state.won = true;
      events |= EVENT_WIN;
    }
    return events;
  }

  reset();
  return { state, reset, step, hasLineOfSight, isSolid };
}
