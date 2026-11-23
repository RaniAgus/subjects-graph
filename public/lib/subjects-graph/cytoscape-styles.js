import { mergeTheme, resolveColor } from './theme.js';

/**
 * @param {boolean} [editable]
 * @param {import('./subjects-graph.js').Theme} [theme]
 * @param {boolean} [readOnly]
 * @returns {import('cytoscape').StylesheetStyle[]}
 */
export function buildStylesheet(editable = false, theme = {}, readOnly = false) {
    const colors = mergeTheme(theme);
    return [
      {
        selector: 'node[nodeType="subject"]',
        style: {
          'width': 60,
          'height': 60,
          'shape': 'ellipse',
          'events': readOnly ? 'no' : 'yes',
          'label': 'data(label)',
          'text-valign': 'center',
          'text-halign': 'center',
          'color': 'data(textColor)',
          'font-size': '16px',
          'font-weight': 600,
          'font-family': colors['--font-family'],
          'border-width': 4,
          'border-opacity': 1,
          'background-color': 'data(fillColor)',
          'border-color': 'data(borderColor)',
          'transition-property': 'background-color, border-color',
          'transition-duration': 300
        }
      },
      {
        selector: 'node[nodeType="connector"]',
        style: {
          'width': 15,
          'height': 15,
          'shape': 'diamond',
          'label': '',
          'background-opacity': 0,
          'border-width': 4,
          'border-color': 'data(borderColor)',
          'transition-property': 'border-color',
          'transition-duration': 300,
          'events': editable ? 'yes' : 'no',
        }
      },
      {
        selector: 'node[?isInvisible]',
        style: {
          'opacity': editable ? 0.5 : 0,
          'width': editable ? 15 : 0.0001,
          'height': editable ? 15 : 0.0001,
          'border-width': editable ? 2 : 0,
          'border-color': resolveColor('--accent-color', colors),
          'border-style': 'dashed',
          'events': editable ? 'yes' : 'no',
          'label': '',
        }
      },
      {
        selector: 'node[?isInvisible][?withGap]',
        style: {
          'width': 20,
          'height': 20
        }
      },
      {
        selector: 'edge',
        style: {
          'width': 4,
          'line-color': 'data(color)',
          'target-arrow-color': 'data(color)',
          'target-arrow-shape': 'vee',
          'curve-style': 'bezier',
          'arrow-scale': 1.5,
          'transition-property': 'line-color, target-arrow-color',
          'transition-duration': 300,
          'events': editable ? 'yes' : 'no',
        }
      },
      {
        selector: 'edge[?toInvisible]',
        style: {
          'target-arrow-shape': 'none'
        }
      }
    ];
  }

