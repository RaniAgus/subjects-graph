/**
 * Handles exporting progress data to JSON file.
 */
export class DataExporter {
  #button;
  #getStatuses;
  #getVariant;

  /**
   * @param {object} options
   * @param {HTMLButtonElement} options.button
   * @param {() => Record<string, string>} options.getStatuses
   * @param {() => string} options.getVariant
   */
  constructor({ button, getStatuses, getVariant }) {
    this.#button = button;
    this.#getStatuses = getStatuses;
    this.#getVariant = getVariant;

    this.#button?.addEventListener('click', () => this.export());
  }

  export() {
    const statuses = this.#getStatuses();
    if (Object.keys(statuses).length === 0) {
      alert('No hay progreso para exportar.');
      return;
    }

    const exportData = {
      variant: this.#getVariant(),
      statuses
    };

    const blob = new Blob([JSON.stringify(exportData, null, 2)], { type: 'application/json' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `progress-${this.#getVariant()}.json`;
    a.click();
    URL.revokeObjectURL(url);
  }
}
