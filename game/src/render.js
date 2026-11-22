// Drawing only: the world's state and the current screen in, pixels out. The
// 1280x720 playfield is scaled to fit the window and centred, the margin filled
// with the backdrop colour. Flat shapes and canvas text; the HUD and panels are
// drawn with the same palette as the floor so the screenshots read as one game.
import { EXIT, FIELD, FONT, GUARD, MAP, PALETTE, TILE } from './config.js';

export const SCREEN_TITLE = 'title';
export const SCREEN_PLAY = 'play';
export const SCREEN_PAUSED = 'paused';
export const SCREEN_WIN = 'win';
export const SCREEN_OVER = 'over';

const PANEL = { width: 640, top: 118, line: 32, bottom: 66 };

function cachedLabel(prefix) {
  let value = null;
  let text = '';
  return function label(next) {
    if (next !== value) {
      value = next;
      text = prefix + next;
    }
    return text;
  };
}

function formatTime(seconds) {
  const s = Math.floor(seconds);
  return `${String(Math.floor(s / 60)).padStart(2, '0')}:${String(s % 60).padStart(2, '0')}`;
}

export function createRenderer(canvas) {
  const context = canvas.getContext('2d');
  const view = { scale: 1, x: 0, y: 0 };
  const artLabel = cachedLabel('Artifacts ');
  const timeLabel = cachedLabel('');
  const coinLabel = cachedLabel('Coins ');

  function resize() {
    const ratio = window.devicePixelRatio || 1;
    const width = Math.round(window.innerWidth * ratio);
    const height = Math.round(window.innerHeight * ratio);
    canvas.width = width;
    canvas.height = height;
    view.scale = Math.min(width / FIELD.width, height / FIELD.height);
    view.x = (width - FIELD.width * view.scale) / 2;
    view.y = (height - FIELD.height * view.scale) / 2;
  }

  const fonts = new Map();
  function text(value, x, y, size, color, align) {
    if (!fonts.has(size)) fonts.set(size, `${size}px ${FONT}`);
    context.font = fonts.get(size);
    context.fillStyle = color;
    context.textAlign = align;
    context.fillText(value, x, y);
  }

  function drawFloor() {
    for (let row = 0; row < 18; row += 1) {
      for (let col = 0; col < 32; col += 1) {
        const t = MAP[row][col];
        const x = col * TILE;
        const y = row * TILE;
        if (t === '#') continue;
        context.fillStyle = (row + col) % 2 === 0 ? PALETTE.floorA : PALETTE.floorB;
        context.fillRect(x, y, TILE, TILE);
      }
    }
    // The carpet runner down the central hall.
    context.fillStyle = PALETTE.carpet;
    context.fillRect(9 * TILE, 8 * TILE, 14 * TILE, 4 * TILE);
    context.fillStyle = PALETTE.carpetEdge;
    context.fillRect(9 * TILE, 8 * TILE, 14 * TILE, 4);
    context.fillRect(9 * TILE, 12 * TILE - 4, 14 * TILE, 4);
    // Faint plank lines on the floor.
    context.strokeStyle = 'rgba(0,0,0,0.18)';
    context.lineWidth = 1;
    context.beginPath();
    for (let row = 1; row < 18; row += 1) {
      context.moveTo(0, row * TILE);
      context.lineTo(FIELD.width, row * TILE);
    }
    context.stroke();
  }

  function drawWallsAndCover() {
    for (let row = 0; row < 18; row += 1) {
      for (let col = 0; col < 32; col += 1) {
        const t = MAP[row][col];
        const x = col * TILE;
        const y = row * TILE;
        if (t === '#') {
          context.fillStyle = PALETTE.wall;
          context.fillRect(x, y, TILE, TILE);
          context.fillStyle = PALETTE.wallTop;
          context.fillRect(x, y, TILE, 6);
        } else if (t === 'o') {
          context.fillStyle = PALETTE.case;
          context.fillRect(x + 5, y + 5, TILE - 10, TILE - 10);
          context.fillStyle = PALETTE.caseTop;
          context.fillRect(x + 5, y + 5, TILE - 10, 8);
          context.fillStyle = 'rgba(255,255,255,0.10)';
          context.fillRect(x + 12, y + 12, TILE - 24, TILE - 24);
        } else if (t === 'C') {
          context.fillStyle = PALETTE.crate;
          context.fillRect(x + 3, y + 3, TILE - 6, TILE - 6);
          context.fillStyle = PALETTE.crateTop;
          context.fillRect(x + 3, y + 3, TILE - 6, 6);
          context.strokeStyle = 'rgba(0,0,0,0.35)';
          context.beginPath();
          context.moveTo(x + 3, y + 3);
          context.lineTo(x + TILE - 3, y + TILE - 3);
          context.moveTo(x + TILE - 3, y + 3);
          context.lineTo(x + 3, y + TILE - 3);
          context.stroke();
        }
      }
    }
  }

  function drawExit(state) {
    const open = state.collected === 3;
    const x0 = EXIT.x0;
    const y0 = EXIT.y0;
    context.fillStyle = open ? PALETTE.exitGlow : 'rgba(120,130,140,0.25)';
    context.fillRect(x0 - 6, y0 - 10, (EXIT.x1 - EXIT.x0) + 12, 30);
    context.fillStyle = open ? PALETTE.exit : '#7d8590';
    context.fillRect(x0, y0, EXIT.x1 - EXIT.x0, 10);
    text('EXIT', (x0 + EXIT.x1) / 2, y0 - 18, 20, open ? PALETTE.exit : PALETTE.muted, 'center');
    if (!open) text(`${3 - state.collected} more to steal`, (x0 + EXIT.x1) / 2, y0 - 40, 15, PALETTE.muted, 'center');
  }

  function drawArtifacts(state) {
    for (const artifact of state.artifacts) {
      if (artifact.taken) continue;
      const pulse = 0.55 + 0.35 * Math.sin(state.elapsed * 3 + artifact.bob);
      context.fillStyle = artifact.color;
      context.globalAlpha = 0.25 * pulse + 0.15;
      context.beginPath();
      context.arc(artifact.x, artifact.y, 26, 0, Math.PI * 2);
      context.fill();
      context.globalAlpha = 1;
      // A low display table with the gem on top.
      context.fillStyle = PALETTE.case;
      context.fillRect(artifact.x - 14, artifact.y + 4, 28, 12);
      context.fillStyle = artifact.color;
      context.beginPath();
      context.moveTo(artifact.x, artifact.y - 14);
      context.lineTo(artifact.x + 10, artifact.y + 2);
      context.lineTo(artifact.x, artifact.y + 8);
      context.lineTo(artifact.x - 10, artifact.y + 2);
      context.closePath();
      context.fill();
      context.fillStyle = 'rgba(255,255,255,0.75)';
      context.beginPath();
      context.moveTo(artifact.x, artifact.y - 14);
      context.lineTo(artifact.x + 5, artifact.y - 2);
      context.lineTo(artifact.x, artifact.y + 2);
      context.lineTo(artifact.x - 5, artifact.y - 2);
      context.closePath();
      context.fill();
    }
  }

  function drawCone(guard) {
    const range = GUARD.visionRange;
    const half = GUARD.visionHalfAngle;
    const fill = guard.state === 'chase'
      ? PALETTE.coneAlert
      : guard.suspicion > 0.45
        ? PALETTE.coneWary
        : PALETTE.coneCalm;
    context.fillStyle = fill;
    context.beginPath();
    context.moveTo(guard.x, guard.y);
    context.arc(guard.x, guard.y, range, guard.facing - half, guard.facing + half);
    context.closePath();
    context.fill();
  }

  function drawGuards(state) {
    for (const guard of state.guards) drawCone(guard);
    for (const guard of state.guards) {
      // Guard: dark uniform, coloured cap band, facing tick.
      context.fillStyle = PALETTE.guard;
      context.beginPath();
      context.arc(guard.x, guard.y, GUARD.radius, 0, Math.PI * 2);
      context.fill();
      context.strokeStyle = guard.color;
      context.lineWidth = 3;
      context.beginPath();
      context.arc(guard.x, guard.y, GUARD.radius - 2, guard.facing - 0.9, guard.facing + 0.9);
      context.stroke();
      context.strokeStyle = '#e8e4d8';
      context.lineWidth = 2;
      context.beginPath();
      context.moveTo(guard.x, guard.y);
      context.lineTo(guard.x + Math.cos(guard.facing) * (GUARD.radius + 7), guard.y + Math.sin(guard.facing) * (GUARD.radius + 7));
      context.stroke();
      // Suspicion arc above the guard's head.
      if (guard.suspicion > 0.03) {
        const w = 34;
        context.fillStyle = 'rgba(0,0,0,0.55)';
        context.fillRect(guard.x - w / 2, guard.y - 30, w, 6);
        context.fillStyle = guard.suspicion >= 1 ? PALETTE.danger : PALETTE.gold;
        context.fillRect(guard.x - w / 2, guard.y - 30, w * guard.suspicion, 6);
      }
      if (guard.state === 'chase') {
        text('!', guard.x, guard.y - 36, 22, PALETTE.danger, 'center');
      }
    }
  }

  function drawPlayer(state) {
    const player = state.player;
    const blink = player.sneaking && Math.floor(state.elapsed * 2) % 2 === 0;
    context.fillStyle = blink ? PALETTE.playerSneak : PALETTE.player;
    context.beginPath();
    context.arc(player.x, player.y, 13, 0, Math.PI * 2);
    context.fill();
    // Hood point in the facing direction.
    const fx = player.dirX;
    const fy = player.dirY;
    const len = Math.hypot(fx, fy) || 1;
    context.fillStyle = '#3a3f4d';
    context.beginPath();
    context.moveTo(player.x + (fx / len) * 18, player.y + (fy / len) * 18);
    context.lineTo(player.x + (fx / len) * 8 - (fy / len) * 6, player.y + (fy / len) * 8 + (fx / len) * 6);
    context.lineTo(player.x + (fx / len) * 8 + (fy / len) * 6, player.y + (fy / len) * 8 - (fx / len) * 6);
    context.closePath();
    context.fill();
    if (player.sneaking) text('sneaking', player.x, player.y + 28, 13, PALETTE.playerSneak, 'center');
  }

  function drawCoin(state) {
    const coin = state.coin;
    if (!coin.active) return;
    const lift = Math.sin(Math.min(coin.t, 1) * Math.PI) * 26;
    context.fillStyle = PALETTE.gold;
    context.beginPath();
    context.arc(coin.x, coin.y - lift, 7, 0, Math.PI * 2);
    context.fill();
    context.strokeStyle = 'rgba(242,201,76,0.5)';
    context.lineWidth = 2;
    context.beginPath();
    context.arc(coin.x, coin.y, 12 + coin.t * 10, 0, Math.PI * 2);
    context.stroke();
  }

  function drawDarkness(state) {
    // Night in the gallery: dim everything away from the thief's lamp.
    const g = context.createRadialGradient(
      state.player.x, state.player.y, 90,
      state.player.x, state.player.y, 520,
    );
    g.addColorStop(0, 'rgba(4,5,9,0)');
    g.addColorStop(1, 'rgba(4,5,9,0.42)');
    context.fillStyle = g;
    context.fillRect(0, 0, FIELD.width, FIELD.height);
  }

  function maxSuspicion(state) {
    let max = 0;
    for (const guard of state.guards) max = Math.max(max, guard.suspicion);
    return max;
  }

  function drawHud(state) {
    context.textBaseline = 'top';
    text(artLabel(`${state.collected}/3`), 24, 18, 26, PALETTE.text, 'left');
    text(timeLabel(formatTime(state.elapsed)), FIELD.width / 2, 18, 26, PALETTE.text, 'center');
    text(coinLabel(state.coinsLeft), FIELD.width - 24, 18, 26, PALETTE.text, 'right');
    // The eye: how close the nearest guard is to spotting you.
    const sus = maxSuspicion(state);
    const w = 220;
    const x = (FIELD.width - w) / 2;
    const y = 52;
    context.fillStyle = 'rgba(0,0,0,0.55)';
    context.fillRect(x, y, w, 10);
    context.fillStyle = sus >= 1 ? PALETTE.danger : sus > 0.45 ? '#ff9a3d' : PALETTE.gold;
    context.fillRect(x, y, w * sus, 10);
    text('SPOTTED', x + w / 2, y + 14, 13, sus > 0.45 ? PALETTE.danger : PALETTE.muted, 'center');
  }

  function drawPanel(title, lines, prompt, accent) {
    const height = PANEL.top + lines.length * PANEL.line + PANEL.bottom;
    const x = (FIELD.width - PANEL.width) / 2;
    const y = (FIELD.height - height) / 2;
    context.fillStyle = 'rgba(4,5,9,0.55)';
    context.fillRect(0, 0, FIELD.width, FIELD.height);
    context.fillStyle = PALETTE.panel;
    context.fillRect(x, y, PANEL.width, height);
    context.strokeStyle = PALETTE.panelEdge;
    context.lineWidth = 2;
    context.strokeRect(x, y, PANEL.width, height);
    context.textBaseline = 'alphabetic';
    text(title, FIELD.width / 2, y + 72, 46, accent || PALETTE.text, 'center');
    for (let index = 0; index < lines.length; index += 1) {
      text(lines[index], FIELD.width / 2, y + PANEL.top + index * PANEL.line, 21, PALETTE.muted, 'center');
    }
    text(prompt, FIELD.width / 2, y + height - 38, 23, PALETTE.gold, 'center');
  }

  /** Paint one frame: the gallery, then the HUD or a panel for the screen. */
  function draw(state, screen, best) {
    context.setTransform(1, 0, 0, 1, 0, 0);
    context.fillStyle = PALETTE.backdrop;
    context.fillRect(0, 0, canvas.width, canvas.height);
    context.setTransform(view.scale, 0, 0, view.scale, view.x, view.y);
    drawFloor();
    drawExit(state);
    drawArtifacts(state);
    drawGuards(state);
    drawPlayer(state);
    drawCoin(state);
    drawWallsAndCover();
    drawDarkness(state);
    if (screen === SCREEN_TITLE) {
      drawPanel('SHADOW GALLERY', [
        'Midnight at the Meridian Gallery. Three pieces. Four guards.',
        'Steal the Ruby Idol, the Emerald Mask and the Sapphire Eye,',
        'then slip out the green exit — unseen.',
        '',
        'Move: WASD or arrows · Sneak: hold Shift · Toss a coin: click',
        'Coins lure a guard away. Hiding behind walls breaks their sight.',
      ], 'Press Space or click to begin', PALETTE.gold);
      if (best > 0) text(`Best escape ${formatTime(best)}`, FIELD.width / 2, FIELD.height / 2 + 218, 20, PALETTE.muted, 'center');
      return;
    }
    drawHud(state);
    if (screen === SCREEN_PAUSED) {
      drawPanel('Paused', ['The guards will wait for you.'], 'Press P to resume');
    } else if (screen === SCREEN_WIN) {
      const rating = state.alerts === 0 ? 'GHOST — never once spotted' : `SHADOW — spotted ${state.alerts} time${state.alerts === 1 ? '' : 's'}, still slipped away`;
      drawPanel('CLEAN GETAWAY', [
        `All three pieces, out the door in ${formatTime(state.elapsed)}.`,
        rating,
        best > 0 ? `Best escape ${formatTime(best)}` : '',
      ], 'Press Space or click to play again', PALETTE.exit);
    } else if (screen === SCREEN_OVER) {
      drawPanel('CAUGHT', [
        `Guard ${state.caughtBy || ''} caught you with ${state.collected}/3 pieces.`,
        'The gallery keeps its secrets — this time.',
      ], 'Press Space or click to try again', PALETTE.danger);
    }
  }

  resize();
  window.addEventListener('resize', resize);
  return { draw, formatTime };
}
