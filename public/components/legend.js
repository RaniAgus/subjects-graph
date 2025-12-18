/**
 * Generates and manages the legend display.
 */
export class Legend {
  #statusContainer;
  #borderContainer;
  #wrapperEl;

  /**
   * @param {object} options
   * @param {HTMLElement} options.statusContainer
   * @param {HTMLElement} options.borderContainer
   * @param {HTMLElement} [options.wrapperEl]
   */
  constructor({ statusContainer, borderContainer, wrapperEl }) {
    this.#statusContainer = statusContainer;
    this.#borderContainer = borderContainer;
    this.#wrapperEl = wrapperEl;
  }

  /**
   * Generate legend items from config.
   * @param {object} config
   * @param {Array<import('./graph.js').Status>} config.statuses
   * @param {Array<import('./graph.js').Availability>} config.availabilities
   */
  render(config) {
    if (!this.#statusContainer || !this.#borderContainer) return;

    this.#statusContainer.innerHTML = '';
    this.#borderContainer.innerHTML = '';

    config.statuses.forEach(status => {
      if (status.name) {
        this.#statusContainer.appendChild(this.#createStatusItem(status));
      }
    });

    config.availabilities.forEach(avail => {
      if (avail.name) {
        this.#borderContainer.appendChild(this.#createBorderItem(avail));
      }
    });

    if (this.#wrapperEl) {
      this.#wrapperEl.classList.remove('skeleton');
    }
  }

  /**
   * @param {import('./graph.js').Status} status
   */
  #createStatusItem(status) {
    const item = document.createElement('div');
    item.className = 'legend-item';
    item.innerHTML = `
      <div class="legend-color" style="background: ${status.color}"></div>
      <span>${status.name}</span>
    `;
    return item;
  }

  /**
   * @param {import('./graph.js').Availability} avail
   */
  #createBorderItem(avail) {
    const item = document.createElement('div');
    item.className = 'legend-item';
    item.innerHTML = `
      <div class="legend-color legend-border" style="border-color: ${avail.color}"></div>
      <span>${avail.name}</span>
    `;
    return item;
  }
}
