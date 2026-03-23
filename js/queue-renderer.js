/**
 * queue-renderer.js
 *
 * Draws the animated G/G/1 queue on a <canvas>.
 * Customers are rendered as colored circles that move through the queue.
 *
 * Layout (left to right):
 *   [Arrival zone] → [Queue / waiting line] → [Server box] → [Departure zone]
 *
 * Each customer has an animated x-position that interpolates toward
 * their target position in the queue.
 */

// ===== Layout Constants =====
const CUSTOMER_RADIUS = 10;
const CUSTOMER_GAP = 28;
const SERVER_X = 0.75;   // server position as fraction of canvas width
const SERVER_WIDTH = 40;
const SERVER_HEIGHT = 40;
const QUEUE_Y = 0.5;     // vertical center as fraction of canvas height
const ARRIVAL_X = 0.05;  // leftmost spawn position
const DEPARTURE_X = 0.95;

// Colors
const COLOR_WAITING = '#B6ACD1';
const COLOR_SERVING = '#401F68';
const COLOR_SERVED = '#9FE1CB';
const COLOR_SERVER_BG = '#EEEDFE';
const COLOR_SERVER_BORDER = '#401F68';
const COLOR_CHAIN_RIPPLE = '#E24B4A';

/**
 * Manages rendering for a single canvas.
 */
export class QueueRenderer {
  /**
   * @param {string} canvasId - id of the <canvas> element
   */
  constructor(canvasId) {
    this.canvas = document.getElementById(canvasId);
    this.ctx = this.canvas ? this.canvas.getContext('2d') : null;

    // Track animated positions per customer id
    this.customerPositions = new Map(); // id → { x, y, targetX, opacity }

    this.resize();
    if (this.canvas) {
      window.addEventListener('resize', () => this.resize());
    }
  }

  resize() {
    if (!this.canvas) return;
    const rect = this.canvas.parentElement.getBoundingClientRect();
    const dpr = window.devicePixelRatio || 1;
    this.canvas.width = rect.width * dpr;
    this.canvas.height = (this.canvas.getAttribute('height') || 200) * dpr;
    this.canvas.style.width = rect.width + 'px';
    this.canvas.style.height = (this.canvas.getAttribute('height') || 200) + 'px';
    this.ctx.scale(dpr, dpr);
    this.w = rect.width;
    this.h = parseInt(this.canvas.getAttribute('height') || 200);
  }

  /**
   * Render a frame given the current simulation state.
   *
   * @param {import('./simulation.js').QueueSimulation} sim
   * @param {number} dt - time since last frame in seconds (for animation lerp)
   */
  render(sim, dt) {
    if (!this.ctx) return;
    const ctx = this.ctx;

    ctx.clearRect(0, 0, this.w, this.h);

    const centerY = this.h * QUEUE_Y;
    const serverX = this.w * SERVER_X;

    // Draw server box
    ctx.fillStyle = COLOR_SERVER_BG;
    ctx.strokeStyle = COLOR_SERVER_BORDER;
    ctx.lineWidth = 2;
    ctx.beginPath();
    ctx.roundRect(
      serverX - SERVER_WIDTH / 2,
      centerY - SERVER_HEIGHT / 2,
      SERVER_WIDTH,
      SERVER_HEIGHT,
      6
    );
    ctx.fill();
    ctx.stroke();

    // Label
    ctx.fillStyle = COLOR_SERVER_BORDER;
    ctx.font = '600 14px system-ui, sans-serif';
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';
    ctx.fillText('S', serverX, centerY);

    // Draw queue line (dashed)
    ctx.strokeStyle = '#D3D1C7';
    ctx.lineWidth = 1;
    ctx.setLineDash([4, 4]);
    ctx.beginPath();
    ctx.moveTo(this.w * ARRIVAL_X, centerY);
    ctx.lineTo(serverX - SERVER_WIDTH / 2 - 10, centerY);
    ctx.stroke();
    ctx.setLineDash([]);

    // Draw departure zone line
    ctx.strokeStyle = '#D3D1C7';
    ctx.lineWidth = 1;
    ctx.setLineDash([4, 4]);
    ctx.beginPath();
    ctx.moveTo(serverX + SERVER_WIDTH / 2 + 10, centerY);
    ctx.lineTo(this.w * DEPARTURE_X, centerY);
    ctx.stroke();
    ctx.setLineDash([]);

    // Calculate target positions for all customers
    const targets = new Map();

    // Customers in queue: line up to the left of the server
    const queueStartX = serverX - SERVER_WIDTH / 2 - 20;
    sim.queue.forEach((c, i) => {
      const idx = sim.queue.length - 1 - i; // rightmost = closest to server
      targets.set(c.id, {
        x: queueStartX - idx * CUSTOMER_GAP,
        y: centerY,
      });
    });

    // Customer in service: at server position
    if (sim.inService) {
      targets.set(sim.inService.id, {
        x: serverX,
        y: centerY,
      });
    }

    // Recently served: moving rightward
    sim.served.forEach((c, i) => {
      targets.set(c.id, {
        x: serverX + SERVER_WIDTH / 2 + 30 + i * CUSTOMER_GAP,
        y: centerY,
      });
    });

    // Clean up positions for customers no longer in the sim
    const activeIds = new Set(targets.keys());
    for (const id of this.customerPositions.keys()) {
      if (!activeIds.has(id)) {
        this.customerPositions.delete(id);
      }
    }

    // Update animated positions (lerp toward targets)
    const lerpSpeed = 8;
    for (const [id, target] of targets) {
      if (!this.customerPositions.has(id)) {
        // New customer — spawn at arrival zone
        this.customerPositions.set(id, {
          x: this.w * ARRIVAL_X,
          y: centerY,
          opacity: 1,
        });
      }
      const pos = this.customerPositions.get(id);
      pos.x += (target.x - pos.x) * Math.min(lerpSpeed * dt, 1);
      pos.y += (target.y - pos.y) * Math.min(lerpSpeed * dt, 1);
    }

    // Draw customers
    const drawCustomer = (id, color) => {
      const pos = this.customerPositions.get(id);
      if (!pos) return;
      ctx.fillStyle = color;
      ctx.beginPath();
      ctx.arc(pos.x, pos.y, CUSTOMER_RADIUS, 0, Math.PI * 2);
      ctx.fill();
    };

    // Served customers (faded)
    sim.served.forEach(c => {
      ctx.globalAlpha = 0.4;
      drawCustomer(c.id, COLOR_SERVED);
      ctx.globalAlpha = 1;
    });

    // In service
    if (sim.inService) {
      drawCustomer(sim.inService.id, COLOR_SERVING);
    }

    // Queue
    sim.queue.forEach(c => {
      drawCustomer(c.id, COLOR_WAITING);
    });

    // Queue count label
    if (sim.queue.length > 0) {
      ctx.fillStyle = '#888780';
      ctx.font = '500 12px system-ui, sans-serif';
      ctx.textAlign = 'center';
      ctx.fillText(
        `${sim.queue.length} waiting`,
        queueStartX - ((sim.queue.length - 1) * CUSTOMER_GAP) / 2,
        centerY + CUSTOMER_RADIUS + 16
      );
    }
  }
}
