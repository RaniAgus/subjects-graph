/**
 * Handles theme selection, persistence, and CSS variable application.
 */
export class ThemeSelector {
  #element;
  #storage;
  #eventBus;
  #storageKey;
  /** @type {Record<string, {name: string, colors: Record<string, string>}>} */
  #themes = {};
  /** @type {string|null} */
  #current = null;

  /**
   * @param {object} options
   * @param {HTMLSelectElement} options.element
   * @param {import('./storage.js').Storage} options.storage
   * @param {import('./event-bus.js').EventBus} options.eventBus
   * @param {string} [options.storageKey='selectedTheme']
   */
  constructor({ element, storage, eventBus, storageKey = 'selectedTheme' }) {
    this.#element = element;
    this.#storage = storage;
    this.#eventBus = eventBus;
    this.#storageKey = storageKey;
  }

  /**
   * Initialize with theme data.
   * @param {Record<string, {name: string, colors: Record<string, string>}>} themes
   * @param {string} defaultTheme
   */
  init(themes, defaultTheme) {
    this.#themes = themes;
    this.#populateDropdown();
    this.#current = this.#resolveInitialTheme(defaultTheme);
    this.#element.value = this.#current;
    this.#element.style.display = 'block';
    this.#element.addEventListener('change', () => this.#onChange());
  }

  #populateDropdown() {
    this.#element.innerHTML = '';
    Object.entries(this.#themes).forEach(([id, theme]) => {
      const option = document.createElement('option');
      option.value = id;
      option.textContent = theme.name;
      this.#element.appendChild(option);
    });
  }

  /**
   * @param {string} defaultTheme
   * @returns {string}
   */
  #resolveInitialTheme(defaultTheme) {
    const saved = this.#storage.get(this.#storageKey);
    return (saved && this.#themes[saved]) ? saved : defaultTheme;
  }

  #onChange() {
    const newThemeId = this.#element.value;
    const newTheme = this.#themes[newThemeId];
    if (newTheme) {
      this.#current = newThemeId;
      this.applyTheme(newTheme);
      this.#storage.set(this.#storageKey, newThemeId);
      this.#eventBus.emit('theme:changed', { theme: newThemeId, colors: newTheme.colors });
    }
  }

  /**
   * Apply theme colors to CSS variables.
   * @param {{colors: Record<string, string>}} theme
   */
  applyTheme(theme) {
    if (!theme?.colors) return;
    const root = document.documentElement;
    Object.entries(theme.colors).forEach(([varName, value]) => {
      root.style.setProperty(varName, value);
    });
    const metaTheme = document.querySelector('meta[name="theme-color"]');
    if (metaTheme && theme.colors['--bg-primary'] && metaTheme instanceof HTMLMetaElement) {
      metaTheme.content = theme.colors['--bg-primary'];
    }
  }

  /** @returns {string} */
  get current() {
    return this.#current ?? '';
  }

  /** @returns {Record<string, string>} */
  getColors() {
    return this.#themes[this.current]?.colors ?? {};
  }

  /**
   * Resolve a CSS variable name to its color value.
   * @param {string} varName
   * @returns {string}
   */
  resolveColor(varName) {
    return this.getColors()[varName] ?? '#FFFFFF';
  }
}
