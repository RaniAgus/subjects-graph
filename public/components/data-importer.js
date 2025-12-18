/**
 * Handles importing progress data from JSON file.
 */
export class DataImporter {
  #button;
  #eventBus;
  #saveStatuses;

  /**
   * @param {object} options
   * @param {HTMLButtonElement} options.button
   * @param {import('./event-bus.js').EventBus} options.eventBus
   * @param {(statuses: Record<string, string>) => void} options.saveStatuses
   */
  constructor({ button, eventBus, saveStatuses }) {
    this.#button = button;
    this.#eventBus = eventBus;
    this.#saveStatuses = saveStatuses;

    this.#button?.addEventListener('click', () => this.import());
  }

  import() {
    const input = document.createElement('input');
    input.type = 'file';
    input.accept = '.json';

    input.onchange = (e) => {
      const file = e.target.files[0];
      if (!file) return;

      const reader = new FileReader();
      reader.onload = (e) => {
        try {
          const data = JSON.parse(e.target.result);
          if (!data.statuses || typeof data.statuses !== 'object') {
            throw new Error('Formato de datos inválido');
          }
          this.#saveStatuses(data.statuses);
          this.#eventBus.emit('data:imported', { statuses: data.statuses });
        } catch (err) {
          alert('Error al importar: ' + err.message);
        }
      };
      reader.readAsText(file);
    };

    input.click();
  }
}
