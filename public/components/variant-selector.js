/**
 * Handles variant selection dropdown and persistence.
 */
export class VariantSelector {
  #element;
  #storage;
  #eventBus;
  #storageKey;
  #variants = {};
  #current = null;

  /**
   * @param {object} options
   * @param {HTMLSelectElement} options.element
   * @param {import('./storage.js').Storage} options.storage
   * @param {import('./event-bus.js').EventBus} options.eventBus
   * @param {string} [options.storageKey='selectedVariant']
   */
  constructor({ element, storage, eventBus, storageKey = 'selectedVariant' }) {
    this.#element = element;
    this.#storage = storage;
    this.#eventBus = eventBus;
    this.#storageKey = storageKey;
  }

  /**
   * Initialize with variant data.
   * @param {Record<string, {name: string}>} variants
   * @param {string} defaultVariant
   */
  init(variants, defaultVariant) {
    this.#variants = variants;
    this.#populateDropdown();
    this.#current = this.#resolveInitialVariant(defaultVariant);
    this.#element.value = this.#current;
    this.#element.classList.remove('skeleton');
    this.#element.style.display = 'block';
    this.#element.addEventListener('change', () => this.#onChange());
  }

  #populateDropdown() {
    this.#element.innerHTML = '';
    Object.entries(this.#variants).forEach(([id, variant]) => {
      const option = document.createElement('option');
      option.value = id;
      option.textContent = variant.name;
      this.#element.appendChild(option);
    });
  }

  #resolveInitialVariant(defaultVariant) {
    const saved = this.#storage.get(this.#storageKey);
    return (saved && this.#variants[saved]) ? saved : defaultVariant;
  }

  #onChange() {
    const newVariant = this.#element.value;
    if (this.#variants[newVariant]) {
      this.#current = newVariant;
      this.#storage.set(this.#storageKey, newVariant);
      this.#eventBus.emit('variant:changed', { variant: newVariant });
    }
  }

  /** @returns {string} */
  get current() {
    return this.#current;
  }

  /** @returns {object} */
  getData() {
    return this.#variants[this.#current];
  }
}
