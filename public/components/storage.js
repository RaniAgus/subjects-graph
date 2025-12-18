/**
 * Storage abstraction for localStorage with optional key prefix.
 */
export class Storage {
  #prefix;

  /**
   * @param {string} [prefix='']
   */
  constructor(prefix = '') {
    this.#prefix = prefix;
  }

  /**
   * @param {string} key
   * @returns {string}
   */
  #key(key) {
    return this.#prefix + key;
  }

  /**
   * @param {string} key
   * @returns {string|null}
   */
  get(key) {
    return localStorage.getItem(this.#key(key));
  }

  /**
   * @param {string} key
   * @param {string} value
   */
  set(key, value) {
    localStorage.setItem(this.#key(key), value);
  }

  /**
   * @param {string} key
   */
  remove(key) {
    localStorage.removeItem(this.#key(key));
  }

  /**
   * @param {string} key
   * @returns {*}
   */
  getJSON(key) {
    const value = this.get(key);
    return value ? JSON.parse(value) : null;
  }

  /**
   * @param {string} key
   * @param {*} value
   */
  setJSON(key, value) {
    this.set(key, JSON.stringify(value));
  }
}
