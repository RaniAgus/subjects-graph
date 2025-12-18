/**
 * Simple pub/sub event bus for decoupled component communication.
 */
export class EventBus {
  /** @type {Map<string, Set<Function>>} */
  #listeners = new Map();

  /**
   * Subscribe to an event.
   * @param {string} event
   * @param {Function} callback
   * @returns {Function} Unsubscribe function
   */
  on(event, callback) {
    if (!this.#listeners.has(event)) {
      this.#listeners.set(event, new Set());
    }
    this.#listeners.get(event)?.add(callback);
    return () => this.off(event, callback);
  }

  /**
   * Unsubscribe from an event.
   * @param {string} event
   * @param {Function} callback
   */
  off(event, callback) {
    this.#listeners.get(event)?.delete(callback);
  }

  /**
   * Emit an event with optional data.
   * @param {string} event
   * @param {*} [data]
   */
  emit(event, data) {
    this.#listeners.get(event)?.forEach(cb => cb(data));
  }
}
