/**
 * main.js
 *
 * Entry point. Wires up:
 *  - Section navigation (scroll-to on button click)
 *  - Slider controls → simulation parameter updates
 *  - Animation loop (requestAnimationFrame)
 *  - Stats display updates
 *  - Sprite state updates
 *  - Boss challenge logic
 *  - Sandbox narrative triggers
 */

import { computeGG1, computeGG1FromRho } from './analytics.js';
import { QueueSimulation } from './simulation.js';
import { QueueRenderer } from './queue-renderer.js';
import {
  getRandomizerState,
  getChainMasterState,
  getQuentinState,
  applySprite,
} from './sprites.js';

// ===== Constants =====
const MEAN_SERVICE_TIME = 3; // seconds of animation time for one service
const BOSS_WQ_TARGET = 2;   // target Wq for boss challenge (in abstract time units)

// ===== Simulation Instances =====
// Each level has its own simulation and renderer

const sims = {};
const renderers = {};

function initLevel(levelKey, canvasId, params) {
  sims[levelKey] = new QueueSimulation({
    meanServiceTime: MEAN_SERVICE_TIME,
    ...params,
  });
  renderers[levelKey] = new QueueRenderer(canvasId);
}

// ===== Level Initialization =====

// Level 0: auto-playing, fixed params
initLevel('l0', 'queue-canvas-l0', { rho: 0.7, cvArrival: 0.8, cvService: 0.5 });

// Level 1: user controls CV, fixed rho
initLevel('l1', 'queue-canvas-l1', { rho: 0.75, cvArrival: 0.2, cvService: 0.2 });

// Level 2: user controls rho + CV
initLevel('l2', 'queue-canvas-l2', { rho: 0.5, cvArrival: 0.5, cvService: 0.5 });

// Level 3: boss fight — starts at crisis
initLevel('l3', 'queue-canvas-l3', { rho: 0.92, cvArrival: 1.0, cvService: 1.0 });

// Sandbox: full controls
initLevel('sandbox', 'queue-canvas-sandbox', { rho: 0.83, cvArrival: 1.0, cvService: 0.5 });

// ===== Navigation =====

function scrollTo(id) {
  const el = document.getElementById(id);
  if (el) el.scrollIntoView({ behavior: 'smooth' });
}

document.getElementById('btn-start-story')?.addEventListener('click', () => scrollTo('level-0'));
document.getElementById('btn-skip-sandbox')?.addEventListener('click', () => scrollTo('sandbox'));
document.getElementById('btn-next-l0')?.addEventListener('click', () => scrollTo('level-1'));
document.getElementById('btn-next-l1')?.addEventListener('click', () => scrollTo('level-2'));
document.getElementById('btn-next-l2')?.addEventListener('click', () => scrollTo('level-3'));
document.getElementById('btn-to-sandbox')?.addEventListener('click', () => scrollTo('sandbox'));
document.getElementById('btn-skip-to-sandbox')?.addEventListener('click', () => scrollTo('sandbox'));

// ===== Slider Wiring =====

/**
 * Wire a range input to update a display value and call a callback.
 */
function wireSlider(sliderId, displayId, callback) {
  const slider = document.getElementById(sliderId);
  const display = document.getElementById(displayId);
  if (!slider) return;

  const update = () => {
    const val = parseFloat(slider.value);
    if (display) display.textContent = val.toFixed(2);
    callback(val);
  };

  slider.addEventListener('input', update);
  update(); // initial
}

// Level 1 sliders (CV only, fixed ρ = 0.75)
wireSlider('cv-arrival-l1', 'cv-arrival-l1-val', (v) => {
  sims.l1.update({ cvArrival: v });
});
wireSlider('cv-service-l1', 'cv-service-l1-val', (v) => {
  sims.l1.update({ cvService: v });
});

// Level 2 sliders (ρ + CV)
wireSlider('rho-l2', 'rho-l2-val', (v) => {
  sims.l2.update({ rho: v });
});
wireSlider('cv-arrival-l2', 'cv-arrival-l2-val', (v) => {
  sims.l2.update({ cvArrival: v });
});
wireSlider('cv-service-l2', 'cv-service-l2-val', (v) => {
  sims.l2.update({ cvService: v });
});

// Level 3 sliders (boss fight)
wireSlider('rho-l3', 'rho-l3-val', (v) => {
  sims.l3.update({ rho: v });
});
wireSlider('cv-arrival-l3', 'cv-arrival-l3-val', (v) => {
  sims.l3.update({ cvArrival: v });
});
wireSlider('cv-service-l3', 'cv-service-l3-val', (v) => {
  sims.l3.update({ cvService: v });
});

// Sandbox sliders (λ, μ, CVs)
wireSlider('arrival-rate-sandbox', 'arrival-rate-sandbox-val', (v) => {
  const mu = parseFloat(document.getElementById('service-rate-sandbox')?.value || 3);
  sims.sandbox.update({
    rho: Math.min(v / mu, 0.99),
    meanServiceTime: MEAN_SERVICE_TIME,
  });
});
wireSlider('service-rate-sandbox', 'service-rate-sandbox-val', (v) => {
  const lam = parseFloat(document.getElementById('arrival-rate-sandbox')?.value || 2.5);
  sims.sandbox.update({
    rho: Math.min(lam / v, 0.99),
    meanServiceTime: MEAN_SERVICE_TIME,
  });
});
wireSlider('cv-arrival-sandbox', 'cv-arrival-sandbox-val', (v) => {
  sims.sandbox.update({ cvArrival: v });
});
wireSlider('cv-service-sandbox', 'cv-service-sandbox-val', (v) => {
  sims.sandbox.update({ cvService: v });
});

// ===== Stats Display =====

function formatStat(val) {
  if (!isFinite(val) || val < 0) return '--';
  if (val > 999) return '999+';
  return val.toFixed(2);
}

function updateStats(prefix, metrics) {
  const setEl = (id, val) => {
    const el = document.getElementById(id);
    if (el) el.textContent = val;
  };

  setEl(`stat-rho-${prefix}`, formatStat(metrics.rho));
  setEl(`stat-wq-${prefix}`, formatStat(metrics.Wq));
  setEl(`stat-lq-${prefix}`, formatStat(metrics.Lq));
  setEl(`stat-w-${prefix}`, formatStat(metrics.W));
  setEl(`stat-l-${prefix}`, formatStat(metrics.L));
}

// ===== Sprite Updates =====

function updateSprites(prefix, sim) {
  const rState = getRandomizerState(sim.cvArrival, sim.cvService);
  const cState = getChainMasterState(sim.rho);

  applySprite(`sprite-randomizer-${prefix}`, `randomizer-mood-${prefix}`, rState);
  applySprite(`sprite-chainmaster-${prefix}`, `chainmaster-mood-${prefix}`, cState);
}

// ===== Boss Challenge =====

let bossVictory = false;

function checkBossChallenge(metrics) {
  if (bossVictory) return;

  const targetEl = document.getElementById('challenge-target-val');
  const currentEl = document.getElementById('challenge-current-val');
  if (targetEl) targetEl.textContent = formatStat(BOSS_WQ_TARGET);
  if (currentEl) {
    currentEl.textContent = formatStat(metrics.Wq);
    currentEl.classList.toggle('challenge-value--danger', metrics.Wq > BOSS_WQ_TARGET);
  }

  if (metrics.Wq < BOSS_WQ_TARGET && metrics.stable) {
    bossVictory = true;
    const overlay = document.getElementById('victory-overlay');
    if (overlay) overlay.hidden = false;
  }
}

// ===== Narrative Triggers (Sandbox) =====

const NARRATIVE_TRIGGERS = [
  { condition: (m, s) => m.rho > 0.95, text: 'Quentin whispers: "This reminds me of the DMV... the Olympics of waiting."' },
  { condition: (m, s) => s.cvArrival <= 0.01 && s.cvService <= 0.01, text: '"If everything were perfectly predictable, there\'d be no queue at all." — The Law of Zero Variability' },
  { condition: (m, s) => s.cvArrival >= 1.0 && s.cvService >= 1.0, text: '"Randomizer at full Poisson power! Both arrivals and service are maximally chaotic."' },
  { condition: (m, s) => m.rho < 0.3, text: '"The villains took a coffee break. With this little traffic, even they can\'t cause trouble."' },
  { condition: (m, s) => m.Wq > 10 * (1 / (m.rho > 0 ? m.rho : 1)), text: '"Five stages of queue grief: Denial, Anger, Bargaining, Despair, and... Candy Crush."' },
  { condition: (m, s) => !m.stable, text: '"System unstable! Arrivals are outpacing service. The queue will grow without bound. This is every manager\'s nightmare."' },
];

let lastNarrativeTrigger = -1;

function checkNarrativeTriggers(metrics, sim) {
  const el = document.getElementById('narrative-trigger');
  const textEl = document.getElementById('narrative-trigger-text');
  if (!el || !textEl) return;

  for (let i = 0; i < NARRATIVE_TRIGGERS.length; i++) {
    const t = NARRATIVE_TRIGGERS[i];
    if (t.condition(metrics, sim) && lastNarrativeTrigger !== i) {
      lastNarrativeTrigger = i;
      textEl.textContent = t.text;
      el.hidden = false;
      return;
    }
  }
}

// ===== Animation Loop =====

let lastTime = 0;

function tick(timestamp) {
  const dt = lastTime ? Math.min((timestamp - lastTime) / 1000, 0.1) : 0.016;
  lastTime = timestamp;

  // Step and render each active simulation
  for (const [key, sim] of Object.entries(sims)) {
    sim.step(dt);
    renderers[key]?.render(sim, dt);
  }

  // Update analytics (Kingman's formula) for each level
  // Level 1
  const m1 = computeGG1FromRho({
    rho: sims.l1.rho,
    cvArrival: sims.l1.cvArrival,
    cvService: sims.l1.cvService,
  });
  updateStats('l1', m1);
  updateSprites('l1', sims.l1);

  // Level 2
  const m2 = computeGG1FromRho({
    rho: sims.l2.rho,
    cvArrival: sims.l2.cvArrival,
    cvService: sims.l2.cvService,
  });
  updateStats('l2', m2);
  updateSprites('l2', sims.l2);

  // Level 3 (boss)
  const m3 = computeGG1FromRho({
    rho: sims.l3.rho,
    cvArrival: sims.l3.cvArrival,
    cvService: sims.l3.cvService,
  });
  updateStats('l3', m3);
  updateSprites('l3', sims.l3);
  checkBossChallenge(m3);

  // Sandbox
  const mS = computeGG1({
    arrivalRate: parseFloat(document.getElementById('arrival-rate-sandbox')?.value || 2.5),
    serviceRate: parseFloat(document.getElementById('service-rate-sandbox')?.value || 3),
    cvArrival: sims.sandbox.cvArrival,
    cvService: sims.sandbox.cvService,
  });
  updateStats('sandbox', mS);
  updateSprites('sandbox', sims.sandbox);

  // Quentin in sandbox
  const qState = getQuentinState(mS.Wq, BOSS_WQ_TARGET);
  applySprite('sprite-quentin-sandbox', 'quentin-mood-sandbox', qState);

  checkNarrativeTriggers(mS, sims.sandbox);

  requestAnimationFrame(tick);
}

// ===== Start =====
requestAnimationFrame(tick);
