/**
 * simulation.js
 *
 * Discrete-event simulation for a G/G/1 queue using Gamma-distributed
 * interarrival and service times. Drives the animated queue visualization.
 *
 * The Gamma distribution is parameterized by mean and CV:
 *   shape k = 1 / CV²
 *   scale θ = mean * CV²
 *   (so k * θ = mean)
 *
 * Special cases:
 *   CV = 0  → deterministic (return mean)
 *   CV = 1  → exponential (k = 1)
 *   CV > 1  → hyper-variable (k < 1)
 */

// ===== Gamma Random Variate Generation =====

/**
 * Generate a standard normal variate using Box-Muller transform.
 */
function randomNormal() {
  let u, v, s;
  do {
    u = Math.random() * 2 - 1;
    v = Math.random() * 2 - 1;
    s = u * u + v * v;
  } while (s >= 1 || s === 0);
  return u * Math.sqrt(-2 * Math.log(s) / s);
}

/**
 * Generate a Gamma(shape, 1) variate using Marsaglia-Tsang method.
 * For shape >= 1.
 */
function gammaMarsagliaTsang(shape) {
  const d = shape - 1 / 3;
  const c = 1 / Math.sqrt(9 * d);

  while (true) {
    let x, v;
    do {
      x = randomNormal();
      v = 1 + c * x;
    } while (v <= 0);

    v = v * v * v;
    const u = Math.random();
    const xSq = x * x;

    if (u < 1 - 0.0331 * xSq * xSq) return d * v;
    if (Math.log(u) < 0.5 * xSq + d * (1 - v + Math.log(v))) return d * v;
  }
}

/**
 * Generate a Gamma(shape, scale) random variate.
 *
 * @param {number} shape - k > 0
 * @param {number} scale - θ > 0
 * @returns {number}
 */
export function randomGamma(shape, scale) {
  if (shape < 1) {
    // Ahrens-Dieter: Gamma(a) = Gamma(a+1) * U^(1/a)
    const g = gammaMarsagliaTsang(shape + 1);
    return g * Math.pow(Math.random(), 1 / shape) * scale;
  }
  return gammaMarsagliaTsang(shape) * scale;
}

/**
 * Generate a random variate from a Gamma distribution parameterized
 * by mean and coefficient of variation.
 *
 * @param {number} mean - desired mean (> 0)
 * @param {number} cv   - coefficient of variation (>= 0)
 * @returns {number} random variate
 */
export function randomGammaFromMeanCV(mean, cv) {
  if (cv <= 0.001) return mean;  // deterministic
  const shape = 1 / (cv * cv);
  const scale = mean * cv * cv;
  return randomGamma(shape, scale);
}

// ===== Discrete-Event Simulation =====

/**
 * @typedef {object} Customer
 * @property {number} id
 * @property {number} arrivalTime       - when they arrive (sim time)
 * @property {number} serviceStartTime  - when service begins (sim time, -1 if still waiting)
 * @property {number} serviceTime       - how long their service takes
 * @property {number} departureTime     - when they leave (sim time, -1 if not done)
 *
 * Animation coordinates are added by the renderer, not here.
 */

/**
 * The simulation state. Manages the event-driven queue.
 */
export class QueueSimulation {
  /**
   * @param {object} params
   * @param {number} params.meanServiceTime    - mean service time in seconds (animation time)
   * @param {number} params.rho                - utilization (determines arrival rate)
   * @param {number} params.cvArrival          - CV of interarrival times
   * @param {number} params.cvService          - CV of service times
   * @param {number} [params.maxQueueDisplay=20] - max customers to keep in visible queue
   */
  constructor(params) {
    this.update(params);
    this.reset();
  }

  /**
   * Update simulation parameters (can be called while running).
   */
  update(params) {
    this.meanServiceTime = params.meanServiceTime ?? this.meanServiceTime ?? 3;
    this.rho = Math.min(params.rho ?? this.rho ?? 0.7, 0.99);
    this.cvArrival = params.cvArrival ?? this.cvArrival ?? 1.0;
    this.cvService = params.cvService ?? this.cvService ?? 1.0;
    this.maxQueueDisplay = params.maxQueueDisplay ?? this.maxQueueDisplay ?? 20;

    // Derive mean interarrival time from utilization
    this.meanInterarrivalTime = this.meanServiceTime / this.rho;
  }

  /**
   * Reset the simulation state.
   */
  reset() {
    this.simTime = 0;
    this.nextArrivalTime = 0;
    this.queue = [];         // customers waiting in line
    this.inService = null;   // customer currently being served
    this.served = [];        // recently served customers (for departure animation)
    this.nextId = 0;
    this.scheduleNextArrival();
  }

  /**
   * Schedule the next arrival event.
   */
  scheduleNextArrival() {
    const interarrival = randomGammaFromMeanCV(this.meanInterarrivalTime, this.cvArrival);
    this.nextArrivalTime = this.simTime + Math.max(interarrival, 0.01);
  }

  /**
   * Advance the simulation by `dt` seconds.
   * Returns events that occurred for the renderer to animate.
   *
   * @param {number} dt - real time elapsed in seconds
   * @returns {Array<{type: string, customer: Customer}>}
   */
  step(dt) {
    const events = [];
    const endTime = this.simTime + dt;

    while (this.simTime < endTime) {
      // Find the next event time
      let nextEventTime = endTime;
      let nextEventType = 'none';

      // Check arrival
      if (this.nextArrivalTime <= nextEventTime) {
        nextEventTime = this.nextArrivalTime;
        nextEventType = 'arrival';
      }

      // Check service completion
      if (this.inService && this.inService.departureTime <= nextEventTime) {
        // If departure happens before or at the same time as arrival, process it first
        if (this.inService.departureTime <= nextEventTime) {
          nextEventTime = this.inService.departureTime;
          nextEventType = 'departure';
        }
      }

      this.simTime = nextEventTime;

      if (nextEventType === 'departure') {
        const done = this.inService;
        this.inService = null;
        this.served.push(done);
        events.push({ type: 'departure', customer: done });

        // Trim served list
        if (this.served.length > 5) this.served.shift();

        // Start serving next in queue
        if (this.queue.length > 0) {
          const next = this.queue.shift();
          this.startService(next);
          events.push({ type: 'service-start', customer: next });
        }
      } else if (nextEventType === 'arrival') {
        const customer = {
          id: this.nextId++,
          arrivalTime: this.simTime,
          serviceStartTime: -1,
          serviceTime: randomGammaFromMeanCV(this.meanServiceTime, this.cvService),
          departureTime: -1,
        };

        if (!this.inService) {
          // Server is free — serve immediately
          this.startService(customer);
          events.push({ type: 'arrival', customer });
          events.push({ type: 'service-start', customer });
        } else {
          // Must wait in queue
          this.queue.push(customer);
          events.push({ type: 'arrival', customer });

          // Cap visible queue to prevent runaway
          if (this.queue.length > this.maxQueueDisplay) {
            this.queue.shift();
          }
        }

        this.scheduleNextArrival();
      } else {
        // No event before endTime, we're done
        break;
      }
    }

    this.simTime = endTime;
    return events;
  }

  /**
   * Start serving a customer.
   */
  startService(customer) {
    customer.serviceStartTime = this.simTime;
    customer.departureTime = this.simTime + customer.serviceTime;
    this.inService = customer;
  }

  /**
   * Get the current number of customers in the system.
   */
  get numInSystem() {
    return this.queue.length + (this.inService ? 1 : 0);
  }

  /**
   * Get the current number of customers in the queue (waiting only).
   */
  get numInQueue() {
    return this.queue.length;
  }
}
