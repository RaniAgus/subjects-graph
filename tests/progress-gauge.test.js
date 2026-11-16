import { expect, it, vi } from 'vitest';
import { ProgressGauge } from '../public/lib/subjects-graph/progress-gauge.js';
import { DEFAULT_THEME } from '../public/lib/subjects-graph/theme.js';

function mount() {
  const element = {style: {}, addEventListener: vi.fn(), setAttribute: vi.fn(), innerHTML: '', disabled: false};
  const document = /** @type {Document} */ (/** @type {unknown} */ ({createElement: () => element}));
  return {gauge: new ProgressGauge(document, vi.fn()), element};
}

/** @type {import('../public/lib/subjects-graph/index.js').Plan} */
const plan = {
  name: 'Example', edges: [], availabilities: [],
  statuses: ['new', 'active', 'review', 'done'].map(id => ({id, name: id, color: `--${id}`, textColor: '#fff'})),
  subjects: ['a','b','c','d','e'].map(id => ({id, name:id, shortName:id, position:{x:0,y:0}, prerequisites:[]})),
};

it('draws arbitrary catalog states with theme colors and cumulative labels', () => {
  const {gauge, element} = mount();
  gauge.update(plan, {a:'done',b:'review',c:'review',d:'active',e:'new'}, {...DEFAULT_THEME, '--active':'#123456'}, {}, false);
  expect(gauge.svg).toContain('stroke="#123456"');
  expect(gauge.svg).toContain('>20%</text>');
  expect(gauge.svg).toContain('>60%</text>');
  expect(gauge.svg.match(/pathLength=/g)).toHaveLength(4);
  expect(element.setAttribute).toHaveBeenCalledWith('aria-label', 'new: 20%, active: 20%, review: 40%, done: 20%');
  expect(element.disabled).toBe(true);
});

it('handles empty plans and hides disabled or missing labels', () => {
  const {gauge} = mount();
  gauge.update({...plan, subjects:[]}, {}, DEFAULT_THEME, {}, true);
  expect(gauge.svg.match(/>0%<\/text>/g)).toHaveLength(2);
  gauge.update(plan, {}, DEFAULT_THEME, {labels:{primary:false,secondary:'missing'}}, true);
  expect(gauge.svg).not.toMatch(/>\d+%<\/text>/);
});
