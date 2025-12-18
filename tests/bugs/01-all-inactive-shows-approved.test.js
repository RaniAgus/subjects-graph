import { describe, it, expect } from 'vitest';
import { Graph } from '~/components/graph.js';
import { config, fullVariant, availabilityColor } from '../helpers/common.js';
import { createMockDrawer } from '../helpers/mockDrawer.js';

/**
 * Bug: All PENDING subjects showing APPROVED arrow color
 *
 * Issue: With the full graph and ALL subjects set to PENDING,
 * some arrows were incorrectly showing APPROVED color instead of PENDING.
 * Affected paths: F2 -> TdC, I1 -> AdR, DDS -> IA
 *
 * Root cause: The getAvailability() methods used .findLast() which doesn't
 * break when a condition isn't met - it just skips to the next item. However,
 * availability requirements are accumulative: to reach FINAL_EXAM_AVAILABLE,
 * you must first satisfy ENROLL_AVAILABLE prerequisites.
 *
 * Fix: Changed to a procedural approach that iterates through each availability
 * level in order and returns early when a level's prerequisites are not satisfied.
 * This ensures accumulative requirements are properly enforced.
 *
 * How to contribute bug fixes:
 * 1. Create a test file in tests/bugs/ that reproduces the bug
 * 2. Use fullVariant to test with the complete graph when needed
 * 3. Write clear comments explaining the bug and expected behavior
 * 4. The test should FAIL before the fix and PASS after
 */

describe('Full graph with all PENDING subjects', () => {
  it('shows PENDING arrows for all paths when all subjects are PENDING', () => {
    // Set all subjects to PENDING
    const allInactiveSubjects = fullVariant.subjects.map(s => ({
      ...s,
      status: 'PENDING',
    }));

    const graph = new Graph(config, allInactiveSubjects, fullVariant.edges);
    const drawer = createMockDrawer();
    graph.render(drawer);

    // F2 -> TdC chain (through 4 links)
    const f2Arrow = drawer.shapes.arrows.find(a => a.id === '11-F2:TdC:1');
    expect(f2Arrow, 'F2-link1 arrow should exist').toBeDefined();
    expect(f2Arrow?.color).toBe(availabilityColor('NOT_AVAILABLE'));

    const tdcArrow = drawer.shapes.arrows.find(a => a.id === 'F2:TdC:4-30');
    expect(tdcArrow, 'link4-TdC arrow should exist').toBeDefined();
    expect(tdcArrow?.color).toBe(availabilityColor('NOT_AVAILABLE'));

    // I1 -> AdR (direct or through edges)
    const i1Arrows = drawer.shapes.arrows.filter(a => a.id.startsWith('8-'));
    expect(i1Arrows.length).toBeGreaterThan(0);
    i1Arrows.forEach(arrow => {
      expect(arrow.color, `Arrow ${arrow.id} should be PENDING`).toBe(availabilityColor('NOT_AVAILABLE'));
    });

    // DDS -> IA (direct or through edges)
    const ddsArrows = drawer.shapes.arrows.filter(a => a.id.startsWith('18-'));
    expect(ddsArrows.length).toBeGreaterThan(0);
    ddsArrows.forEach(arrow => {
      expect(arrow.color, `Arrow ${arrow.id} should be PENDING`).toBe(availabilityColor('NOT_AVAILABLE'));
    });
  });
});
