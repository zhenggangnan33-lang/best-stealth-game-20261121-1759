// Keyboard and pointer input. Held keys give a steering vector; one-shot presses
// (start, restart, pause, mute) are queued as bit flags and taken once by the loop,
// so a press between two frames is never lost and never counted twice. A click
// (or tap) on the field queues a coin toss at that point, in field coordinates.
export const ACTION_CONFIRM = 1;
export const ACTION_PAUSE = 2;
export const ACTION_MUTE = 4;

const LEFT = new Set(['ArrowLeft', 'KeyA']);
const RIGHT = new Set(['ArrowRight', 'KeyD']);
const UP = new Set(['ArrowUp', 'KeyW']);
const DOWN = new Set(['ArrowDown', 'KeyS']);
const SNEAK = new Set(['ShiftLeft', 'ShiftRight']);
const CONFIRM = new Set(['Space', 'Enter']);
const PAUSE = new Set(['KeyP', 'Escape']);
const MUTE = new Set(['KeyM']);

export function createInput(canvas) {
  const keys = { left: false, right: false, up: false, down: false, sneak: false };
  let actions = 0;
  let toss = null;

  function fieldPoint(event) {
    const rect = canvas.getBoundingClientRect();
    const scaleX = 1280 / rect.width;
    const scaleY = 720 / rect.height;
    return {
      x: (event.clientX - rect.left) * scaleX,
      y: (event.clientY - rect.top) * scaleY,
    };
  }

  window.addEventListener('keydown', (event) => {
    if (LEFT.has(event.code)) keys.left = true;
    else if (RIGHT.has(event.code)) keys.right = true;
    else if (UP.has(event.code)) keys.up = true;
    else if (DOWN.has(event.code)) keys.down = true;
    else if (SNEAK.has(event.code)) keys.sneak = true;
    else if (CONFIRM.has(event.code)) {
      if (!event.repeat) actions |= ACTION_CONFIRM;
    } else if (PAUSE.has(event.code)) {
      if (!event.repeat) actions |= ACTION_PAUSE;
    } else if (MUTE.has(event.code)) {
      if (!event.repeat) actions |= ACTION_MUTE;
    } else return;
    event.preventDefault();
  });
  window.addEventListener('keyup', (event) => {
    if (LEFT.has(event.code)) keys.left = false;
    else if (RIGHT.has(event.code)) keys.right = false;
    else if (UP.has(event.code)) keys.up = false;
    else if (DOWN.has(event.code)) keys.down = false;
    else if (SNEAK.has(event.code)) keys.sneak = false;
  });
  // A key released while the tab is hidden never sends keyup: let go on blur.
  window.addEventListener('blur', () => {
    keys.left = keys.right = keys.up = keys.down = keys.sneak = false;
  });
  canvas.addEventListener('pointerdown', (event) => {
    // Clicks on the field toss a coin there; clicks anywhere confirm a panel.
    toss = fieldPoint(event);
    actions |= ACTION_CONFIRM;
  });

  return {
    /** Steering vector, each component -1, 0 or 1. */
    move() {
      return {
        x: (keys.right ? 1 : 0) - (keys.left ? 1 : 0),
        y: (keys.down ? 1 : 0) - (keys.up ? 1 : 0),
      };
    },
    sneaking() {
      return keys.sneak;
    },
    /** The one-shot presses since the last call, as ACTION_* flags. */
    takeActions() {
      const taken = actions;
      actions = 0;
      return taken;
    },
    /** A queued coin-toss target in field pixels, or null; taken once. */
    takeToss() {
      const taken = toss;
      toss = null;
      return taken;
    },
  };
}
