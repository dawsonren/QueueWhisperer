/**
 * analytics.js
 *
 * Kingman's VUT approximation for G/G/1 queues.
 * Distribution-free — only requires CVs and utilization.
 *
 * Adapted from the GGs() function in the existing queueing calculator
 * with servers hardcoded to 1 and no breakdown/fix mechanics.
 */

/**
 * Compute G/G/1 queue performance metrics using Kingman's formula.
 *
 * @param {object} params
 * @param {number} params.arrivalRate    - λ, arrivals per time unit
 * @param {number} params.serviceRate    - μ, services per time unit
 * @param {number} params.cvArrival      - CV of interarrival times
 * @param {number} params.cvService      - CV of service times
 * @returns {object} Queue performance metrics
 */
export function computeGG1(params) {
  const { arrivalRate, serviceRate, cvArrival, cvService } = params;

  const rho = arrivalRate / serviceRate;  // utilization
  const meanServiceTime = 1 / serviceRate;

  // Kingman's VUT formula components
  const V = (cvArrival ** 2 + cvService ** 2) / 2;
  const U = rho / (1 - rho);  // for single server: ρ/(1-ρ)
  const T = meanServiceTime;

  const meanTimeInQueue = V * U * T;           // Wq
  const meanNumInQueue = meanTimeInQueue * arrivalRate;  // Lq = Wq * λ
  const meanTimeInSystem = meanTimeInQueue + T;          // W = Wq + 1/μ
  const meanNumInSystem = meanTimeInSystem * arrivalRate; // L = W * λ

  return {
    rho,
    Wq: meanTimeInQueue,
    Lq: meanNumInQueue,
    W: meanTimeInSystem,
    L: meanNumInSystem,
    stable: rho < 1,
  };
}

/**
 * Convenience: compute G/G/1 from utilization + CVs.
 * Fixes a "base" service rate and derives arrival rate from ρ.
 *
 * This is used in story levels where the user controls ρ directly
 * rather than setting λ and μ independently.
 *
 * @param {object} params
 * @param {number} params.rho        - target utilization (0 < ρ < 1)
 * @param {number} params.cvArrival  - CV of interarrival times
 * @param {number} params.cvService  - CV of service times
 * @param {number} [params.serviceRate=1] - base service rate
 * @returns {object} Queue performance metrics
 */
export function computeGG1FromRho(params) {
  const { rho, cvArrival, cvService, serviceRate = 1 } = params;
  const arrivalRate = rho * serviceRate;
  return computeGG1({ arrivalRate, serviceRate, cvArrival, cvService });
}
