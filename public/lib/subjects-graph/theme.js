/** Default Dark palette, independent of the host document.
 * @type {Readonly<import('./subjects-graph.js').Theme>}
 */
export const DEFAULT_THEME = Object.freeze({
  '--font-family': '-apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif',
  '--bg-primary': '#060b14', '--bg-secondary': '#0d1520', '--bg-tertiary': '#141f2c',
  '--fill-color-1': '#060b14', '--fill-color-2': '#263447',
  '--fill-color-3': '#6e5d1d', '--fill-color-4': '#dbb138', '--fill-color-5': '#e8c760',
  '--border-color-2': '#263446', '--border-color-3': '#6e5d1c', '--border-color-4': '#dbb137',
  '--btn-secondary': '#263447', '--btn-secondary-hover': '#243040',
  '--btn-reset': '#b91c1c', '--btn-reset-hover': '#991b1b',
  '--text-primary': '#f5f0e6', '--text-secondary': '#ffffff', '--text-muted': '#a0a8b0',
  '--border-color': '#263448', '--accent-color': '#e8c760',
});

/** @param {import('./subjects-graph.js').Theme} [overrides]
 * @returns {import('./subjects-graph.js').Theme}
 */
export function mergeTheme(overrides = {}) {
  return { ...DEFAULT_THEME, ...overrides };
}

/** Resolve a raw token or CSS var(token) against the supplied palette.
 * Literal CSS colors pass through without consulting the DOM.
 * @param {string} color
 * @param {import('./subjects-graph.js').Theme} theme
 * @returns {string}
 */
export function resolveColor(color, theme) {
  const token = color.match(/^var\(\s*(--[^\s,)]+)\s*\)$/)?.[1] ?? color;
  return token.startsWith('--') ? (theme[token] ?? '#000000') : color;
}
