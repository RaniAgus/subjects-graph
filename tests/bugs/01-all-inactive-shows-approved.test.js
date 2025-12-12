import { describe, it, expect } from 'vitest';
import { Graph } from '../../docs/graph.js';
import { config, fullVariant, availabilityColor } from '../helpers/common.js';
import { createMockDrawer } from '../helpers/mockDrawer.js';

/**
 * Bug: All INACTIVE subjects showing APPROVED arrow color
 * 
 * Issue: With the full graph and ALL subjects set to INACTIVE,
 * some arrows were incorrectly showing APPROVED color instead of INACTIVE.
 * Affected paths: F2 -> TdC, I1 -> AdR, DDS -> IA
 * 
 * Root cause: In Link.#getAvailability(), when checking if a source satisfies
 * a target's prerequisites for a given availability level, if the source was
 * NOT mentioned in the prerequisites, empty.every() returned true, incorrectly
 * passing the APPROVED check.
 * 
 * Fix: Added check to ensure at least one source subject IS mentioned in the
 * target's prerequisites before considering that availability level satisfied.
 * 
 * How to contribute bug fixes:
 * 1. Create a test file in tests/bugs/ that reproduces the bug
 * 2. Use fullVariant to test with the complete graph when needed
 * 3. Write clear comments explaining the bug and expected behavior
 * 4. The test should FAIL before the fix and PASS after
 */

describe('Full graph with all INACTIVE subjects', () => {
  it('shows INACTIVE arrows for all paths when all subjects are INACTIVE', () => {
    // Set all subjects to INACTIVE
    const allInactiveSubjects = fullVariant.subjects.map(s => ({
      ...s,
      status: 'INACTIVE',
    }));

    const graph = new Graph(config, allInactiveSubjects, fullVariant.edges);
    const drawer = createMockDrawer();
    graph.render(drawer);

    // F2 -> TdC chain (through link19, link20, link21, link22)
    const f2Arrow = drawer.shapes.arrows.find(a => a.id === 'F2-link19');
    expect(f2Arrow, 'F2-link19 arrow should exist').toBeDefined();
    expect(f2Arrow?.color).toBe(availabilityColor('NOT_AVAILABLE'));

    const link22Arrow = drawer.shapes.arrows.find(a => a.id === 'link22-TdC');
    expect(link22Arrow, 'link22-TdC arrow should exist').toBeDefined();
    expect(link22Arrow?.color).toBe(availabilityColor('NOT_AVAILABLE'));

    // I1 -> AdR (direct or through edges)
    const i1Arrows = drawer.shapes.arrows.filter(a => a.id.startsWith('I1-'));
    expect(i1Arrows.length).toBeGreaterThan(0);
    i1Arrows.forEach(arrow => {
      expect(arrow.color, `Arrow ${arrow.id} should be INACTIVE`).toBe(availabilityColor('NOT_AVAILABLE'));
    });

    // DDS -> IA (direct or through edges)
    const ddsArrows = drawer.shapes.arrows.filter(a => a.id.startsWith('DDS-'));
    expect(ddsArrows.length).toBeGreaterThan(0);
    ddsArrows.forEach(arrow => {
      expect(arrow.color, `Arrow ${arrow.id} should be INACTIVE`).toBe(availabilityColor('NOT_AVAILABLE'));
    });
  });
});
