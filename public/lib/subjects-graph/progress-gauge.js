import { resolveColor } from './theme.js';

export class ProgressGauge {
  /** @param {Document} document @param {() => void} edit */
  constructor(document, edit) {
    this.element = document.createElement('button');
    this.element.type = 'button';
    this.element.className = 'subjects-graph-gauge';
    this.element.addEventListener('click', edit);
    this.svg = '';
    this.position = { vertical: 'bottom', horizontal: 'right' };
    this.offset = { x: 30, y: 30 };
  }

  /** @param {import('./subjects-graph.js').Plan} plan
   * @param {import('./subjects-graph.js').Progress} progress
   * @param {import('./subjects-graph.js').Theme} theme
   * @param {import('./subjects-graph.js').ProgressGaugeOptions} options
   * @param {boolean} editable */
  update(plan, progress, theme, options, editable) {
    const escape = (/** @type {string} */ value) => value.replace(/[&<>"']/g, c => `&#${c.charCodeAt(0)};`);
    this.position = options.position ?? plan.progress?.position ?? { vertical: 'bottom', horizontal: 'right' };
    this.offset = options.offset ?? { x: 30, y: 30 };
    this.element.style.cssText = `${this.position.vertical}:${this.offset.y}px;${this.position.horizontal}:${this.offset.x}px`;
    this.element.disabled = !editable;
    const counts = plan.statuses.map(status => plan.subjects.filter(subject => progress[subject.id] === status.id).length);
    const ratio = (/** @type {number} */ count) => plan.subjects.length ? count / plan.subjects.length * 100 : 0;
    let cursor = 0;
    const arcs = plan.statuses.map((status, i) => ({status, value: ratio(counts[i])})).reverse().map(({status, value}) => {
      const arc = `<circle cx="54" cy="54" r="41" fill="none" stroke="${escape(resolveColor(status.color, theme))}" stroke-width="7" pathLength="100" stroke-dasharray="${value} ${100-value}" stroke-dashoffset="${-cursor}"/>`;
      cursor += value;
      return arc;
    }).join('');
    const label = (/** @type {string | false | undefined} */ id) => {
      const index = plan.statuses.findIndex(status => status.id === id);
      return index < 0 ? '' : `${Math.round(ratio(counts.slice(index).reduce((a,b) => a+b,0)))}%`;
    };
    const primary = options.labels?.primary ?? plan.statuses.at(-1)?.id;
    const secondary = options.labels?.secondary ?? (plan.statuses.length > 2 ? plan.statuses.at(-2)?.id : false);
    const color = (/** @type {string} */ token) => escape(resolveColor(token, theme));
    this.svg = `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 108 108" width="108" height="108"><circle cx="54" cy="54" r="53" fill="${color('--bg-secondary')}" stroke="${color('--border-color')}"/><g transform="rotate(-90 54 54)">${arcs}</g><g text-anchor="middle" dominant-baseline="middle" font-family="${escape(theme['--font-family'])}"><text x="54" y="50" font-size="22" font-weight="700" fill="${color('--text-primary')}">${label(primary)}</text><text x="54" y="68" font-size="11" fill="${color('--text-muted')}">${label(secondary)}</text></g></svg>`;
    this.element.innerHTML = this.svg;
    this.element.setAttribute('aria-label', plan.statuses.map((status,i) => `${status.name}: ${Math.round(ratio(counts[i]))}%`).join(', '));
  }

  /** @param {Blob} blob @returns {Promise<Blob>} */
  async exportPNG(blob) {
    const load = async (/** @type {Blob} */ source) => {
      const url = URL.createObjectURL(source);
      try {
        const image = new Image();
        image.src = url;
        await image.decode();
        return image;
      } finally { URL.revokeObjectURL(url); }
    };
    const svg = this.svg;
    const position = {...this.position};
    const offset = {...this.offset};
    const [graph, gauge] = await Promise.all([load(blob), load(new Blob([svg], {type:'image/svg+xml'}))]);
    const canvas = this.element.ownerDocument.createElement('canvas');
    canvas.width = graph.width; canvas.height = graph.height;
    const ctx = canvas.getContext('2d');
    if (!ctx) throw new Error('Canvas context unavailable');
    ctx.drawImage(graph,0,0);
    const scale = Math.min(canvas.width,canvas.height)/600;
    const size = 108*scale;
    ctx.drawImage(gauge, position.horizontal === 'left' ? offset.x*scale : canvas.width-size-offset.x*scale, position.vertical === 'top' ? offset.y*scale : canvas.height-size-offset.y*scale,size,size);
    return new Promise((resolve,reject) => canvas.toBlob(result => result ? resolve(result) : reject(new Error('PNG export failed')), 'image/png'));
  }
}
