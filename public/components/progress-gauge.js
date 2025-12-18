/**
 * Handles progress gauge display and updates.
 */
export class ProgressGauge {
  #percentageEl;
  #pendingTextEl;
  #approvedCircle;
  #pendingCircle;
  #circumference = 283;

  /**
   * @param {object} options
   * @param {HTMLElement} options.percentageEl
   * @param {HTMLElement} options.pendingTextEl
   * @param {SVGCircleElement} options.approvedCircle
   * @param {SVGCircleElement} options.pendingCircle
   */
  constructor({ percentageEl, pendingTextEl, approvedCircle, pendingCircle }) {
    this.#percentageEl = percentageEl;
    this.#pendingTextEl = pendingTextEl;
    this.#approvedCircle = approvedCircle;
    this.#pendingCircle = pendingCircle;
  }

  /**
   * Update progress display.
   * @param {number} approvedPercent
   * @param {number} pendingPercent
   */
  update(approvedPercent, pendingPercent) {
    if (this.#percentageEl) {
      this.#percentageEl.textContent = `${approvedPercent}%`;
    }
    if (this.#pendingTextEl) {
      this.#pendingTextEl.textContent = `${pendingPercent}%`;
    }
    if (this.#approvedCircle) {
      this.#approvedCircle.style.strokeDashoffset = 
        String(this.#circumference - (this.#circumference * approvedPercent / 100));
    }
    if (this.#pendingCircle) {
      this.#pendingCircle.style.strokeDashoffset = 
        String(this.#circumference - (this.#circumference * pendingPercent / 100));
    }
  }

  /** @returns {number} */
  getApprovedPercent() {
    return this.#percentageEl ? parseInt(this.#percentageEl.textContent) : 0;
  }

  /** @returns {number} */
  getPendingPercent() {
    return this.#pendingTextEl ? parseInt(this.#pendingTextEl.textContent) : 0;
  }
}
