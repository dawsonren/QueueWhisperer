/**
 * sprites.js
 *
 * Character sprite state machine.
 * Swaps PNG src based on queue state thresholds.
 *
 * Each character has a set of states, each with:
 *   - a trigger condition (threshold on a metric)
 *   - a PNG filename
 *   - a mood label (displayed below the sprite)
 *
 * Since sprites are PNGs loaded from assets/sprites/,
 * the swap is just changing the <img> src attribute.
 */

const SPRITE_BASE = 'assets/sprites/';

// ===== State Definitions =====

const RANDOMIZER_STATES = [
  { maxCV: 0.3,  file: 'randomizer-sleeping.png',   mood: 'Sleeping...' },
  { maxCV: 0.7,  file: 'randomizer-scheming.png',   mood: 'Scheming...' },
  { maxCV: 0.99, file: 'randomizer-cackling.png',   mood: 'Cackling!' },
  { maxCV: Infinity, file: 'randomizer-chaos.png',   mood: 'MAXIMUM CHAOS!' },
];

const CHAINMASTER_STATES = [
  { maxRho: 0.5,  file: 'chainmaster-weak.png',     mood: 'Chains broken...' },
  { maxRho: 0.8,  file: 'chainmaster-rising.png',   mood: 'Chains tightening...' },
  { maxRho: 0.95, file: 'chainmaster-dominant.png',  mood: 'Chains everywhere!' },
  { maxRho: Infinity, file: 'chainmaster-unstoppable.png', mood: 'UNSTOPPABLE!' },
];

const QUENTIN_STATES = {
  confident:  { file: 'quentin-confident.png',    mood: 'Looking good!' },
  concerned:  { file: 'quentin-concerned.png',    mood: 'Hmm, getting crowded...' },
  alarmed:    { file: 'quentin-alarmed.png',      mood: 'This is bad!' },
  celebrating:{ file: 'quentin-celebrating.png',  mood: 'We did it!' },
};

// ===== State Resolution =====

/**
 * Get the current Randomizer state based on the max of arrival and service CVs.
 *
 * @param {number} cvArrival
 * @param {number} cvService
 * @returns {{ file: string, mood: string }}
 */
export function getRandomizerState(cvArrival, cvService) {
  const cv = Math.max(cvArrival, cvService);
  for (const state of RANDOMIZER_STATES) {
    if (cv <= state.maxCV) {
      return { file: SPRITE_BASE + state.file, mood: state.mood };
    }
  }
  return {
    file: SPRITE_BASE + RANDOMIZER_STATES[RANDOMIZER_STATES.length - 1].file,
    mood: RANDOMIZER_STATES[RANDOMIZER_STATES.length - 1].mood,
  };
}

/**
 * Get the current Chain Master state based on utilization.
 *
 * @param {number} rho - utilization
 * @returns {{ file: string, mood: string }}
 */
export function getChainMasterState(rho) {
  for (const state of CHAINMASTER_STATES) {
    if (rho <= state.maxRho) {
      return { file: SPRITE_BASE + state.file, mood: state.mood };
    }
  }
  return {
    file: SPRITE_BASE + CHAINMASTER_STATES[CHAINMASTER_STATES.length - 1].file,
    mood: CHAINMASTER_STATES[CHAINMASTER_STATES.length - 1].mood,
  };
}

/**
 * Get the current Quentin state.
 *
 * @param {number} Wq      - current mean wait time in queue
 * @param {number} target   - target wait time threshold
 * @param {boolean} victory - whether the level is won
 * @returns {{ file: string, mood: string }}
 */
export function getQuentinState(Wq, target, victory = false) {
  if (victory) {
    const s = QUENTIN_STATES.celebrating;
    return { file: SPRITE_BASE + s.file, mood: s.mood };
  }

  const ratio = Wq / target;
  let key;
  if (ratio < 0.7) key = 'confident';
  else if (ratio < 1.0) key = 'concerned';
  else key = 'alarmed';

  const s = QUENTIN_STATES[key];
  return { file: SPRITE_BASE + s.file, mood: s.mood };
}

// ===== DOM Helpers =====

/**
 * Apply a sprite state to an <img> element and an optional mood <div>.
 *
 * @param {string} imgId   - id of the <img> element
 * @param {string} moodId  - id of the mood label element (optional)
 * @param {{ file: string, mood: string }} state
 */
export function applySprite(imgId, moodId, state) {
  const img = document.getElementById(imgId);
  if (img && img.getAttribute('src') !== state.file) {
    img.src = state.file;
  }
  if (moodId) {
    const mood = document.getElementById(moodId);
    if (mood) mood.textContent = state.mood;
  }
}
