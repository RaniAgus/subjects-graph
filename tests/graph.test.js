import { describe, it, expect } from 'vitest';
import { Graph } from '../docs/graph.js';
import { config, subjects, edges, statusColor, availabilityColor } from './helpers/common.js';
import { createMockDrawer } from './helpers/mockDrawer.js';

describe('Graph rendering (I1 -> I2)', () => {
  // I2 depends on I1 (FINAL_EXAM_PENDING for FINAL_EXAM_PENDING, APPROVED for APPROVED)
  // Arrow color should reflect the source's contribution to target's availability
  // All 9 combinations (3x3) - EXPECTED behavior (TDD)
  const testCases = [
    // I1=INACTIVE -> arrow should be INACTIVE (source doesn't satisfy any prereq)
    { statuses: ['INACTIVE', 'INACTIVE'], availabilities: ['FINAL_EXAM_AVAILABLE', 'NOT_AVAILABLE'], arrowAvailability: 'NOT_AVAILABLE' },
    { statuses: ['INACTIVE', 'FINAL_EXAM_PENDING'], availabilities: ['FINAL_EXAM_AVAILABLE', 'NOT_AVAILABLE'], arrowAvailability: 'NOT_AVAILABLE' },
    { statuses: ['INACTIVE', 'APPROVED'], availabilities: ['FINAL_EXAM_AVAILABLE', 'NOT_AVAILABLE'], arrowAvailability: 'NOT_AVAILABLE' },
    // I1=FINAL_EXAM_PENDING -> arrow should be FINAL_EXAM_PENDING (source satisfies FEP prereq)
    { statuses: ['FINAL_EXAM_PENDING', 'INACTIVE'], availabilities: ['FINAL_EXAM_AVAILABLE', 'ENROLL_AVAILABLE'], arrowAvailability: 'ENROLL_AVAILABLE' },
    { statuses: ['FINAL_EXAM_PENDING', 'FINAL_EXAM_PENDING'], availabilities: ['FINAL_EXAM_AVAILABLE', 'ENROLL_AVAILABLE'], arrowAvailability: 'ENROLL_AVAILABLE' },
    { statuses: ['FINAL_EXAM_PENDING', 'APPROVED'], availabilities: ['FINAL_EXAM_AVAILABLE', 'ENROLL_AVAILABLE'], arrowAvailability: 'ENROLL_AVAILABLE' },
    // I1=APPROVED -> arrow should be APPROVED (source satisfies APPROVED prereq)
    { statuses: ['APPROVED', 'INACTIVE'], availabilities: ['FINAL_EXAM_AVAILABLE', 'FINAL_EXAM_AVAILABLE'], arrowAvailability: 'FINAL_EXAM_AVAILABLE' },
    { statuses: ['APPROVED', 'FINAL_EXAM_PENDING'], availabilities: ['FINAL_EXAM_AVAILABLE', 'FINAL_EXAM_AVAILABLE'], arrowAvailability: 'FINAL_EXAM_AVAILABLE' },
    { statuses: ['APPROVED', 'APPROVED'], availabilities: ['FINAL_EXAM_AVAILABLE', 'FINAL_EXAM_AVAILABLE'], arrowAvailability: 'FINAL_EXAM_AVAILABLE' },
  ];

  testCases.forEach(({ statuses: [i1Status, i2Status], availabilities: [i1Avail, i2Avail], arrowAvailability }) => {
    it(`renders with I1=${i1Status}, I2=${i2Status}`, () => {
      const testSubjects = subjects(
        ['I1', i1Status],
        ['I2', i2Status],
      );

      const graph = new Graph(config, testSubjects, []);
      const drawer = createMockDrawer();
      graph.render(drawer);

      // Should draw 2 circles (one per subject)
      expect(drawer.shapes.circles).toHaveLength(2);
      expect(drawer.shapes.circles).toContainEqual({
        label: 'I1',
        tooltip: 'Inglés I',
        position: { x: 400, y: 100 },
        fillColor: statusColor(i1Status),
        borderColor: availabilityColor(i1Avail),
      });
      expect(drawer.shapes.circles).toContainEqual({
        label: 'I2',
        tooltip: 'Inglés II',
        position: { x: 500, y: 100 },
        fillColor: statusColor(i2Status),
        borderColor: availabilityColor(i2Avail),
      });

      // Should draw 1 arrow from I1 to I2
      expect(drawer.shapes.arrows).toHaveLength(1);
      expect(drawer.shapes.arrows).toContainEqual({
        id: 'I1-I2',
        from: 'I1',
        to: 'I2',
        color: availabilityColor(arrowAvailability),
      });
    });
  });
});

describe('Graph rendering (Q, F2 -> TdC)', () => {
  // TdC has 2 availability states:
  // - FINAL_EXAM_PENDING: Q at FINAL_EXAM_PENDING AND F2 at APPROVED
  // - APPROVED: Q at APPROVED
  // As it depends on 2 subjects with no common edge, it should show the color of the source's contribution to the target's availability
  // without interfering with the other source's contribution to the target's availability
  
  // All 9 combinations (3x3) for Q and F2
  // F2 needs APPROVED for TdC's FINAL_EXAM_PENDING availability
  const testCases = [
    // F2=INACTIVE -> arrow should be INACTIVE (F2 doesn't satisfy APPROVED prereq)
    { statuses: ['INACTIVE', 'INACTIVE'], arrowAvailability: 'NOT_AVAILABLE' },
    { statuses: ['INACTIVE', 'FINAL_EXAM_PENDING'], arrowAvailability: 'NOT_AVAILABLE' },
    { statuses: ['INACTIVE', 'APPROVED'], arrowAvailability: 'NOT_AVAILABLE' },
    // F2=FINAL_EXAM_PENDING -> arrow should be INACTIVE (F2 needs APPROVED, not FEP)
    { statuses: ['FINAL_EXAM_PENDING', 'INACTIVE'], arrowAvailability: 'NOT_AVAILABLE' },
    { statuses: ['FINAL_EXAM_PENDING', 'FINAL_EXAM_PENDING'], arrowAvailability: 'NOT_AVAILABLE' },
    { statuses: ['FINAL_EXAM_PENDING', 'APPROVED'], arrowAvailability: 'NOT_AVAILABLE' },
    // F2=APPROVED -> arrow should be FINAL_EXAM_AVAILABLE (F2 satisfies APPROVED prereq, higher levels have no F2 prereqs so also satisfied)
    { statuses: ['APPROVED', 'INACTIVE'], arrowAvailability: 'FINAL_EXAM_AVAILABLE' },
    { statuses: ['APPROVED', 'FINAL_EXAM_PENDING'], arrowAvailability: 'FINAL_EXAM_AVAILABLE' },
    { statuses: ['APPROVED', 'APPROVED'], arrowAvailability: 'FINAL_EXAM_AVAILABLE' },
  ];

  testCases.forEach(({ statuses: [f2Status, qStatus], arrowAvailability }) => {
    it(`renders with F2=${f2Status}, Q=${qStatus}`, () => {
      const testSubjects = subjects(
        ['Q', qStatus],
        ['F2', f2Status],
        ['TdC', 'INACTIVE'],
      );

      const graph = new Graph(config, testSubjects, []);
      const drawer = createMockDrawer();
      graph.render(drawer);

      // F2 -> TdC arrow should reflect F2's contribution
      const f2Arrow = drawer.shapes.arrows.find(a => a.id === 'F2-TdC');
      expect(f2Arrow).toBeDefined();
      expect(f2Arrow?.color).toBe(availabilityColor(arrowAvailability));
    });
  });
});

describe('Transitive deduplication', () => {
  // AyED -> PdP -> DDS chain
  // DDS depends on PdP (FINAL_EXAM_PENDING) and AyED (APPROVED)
  // PdP depends on AyED (FINAL_EXAM_PENDING)
  // So DDS -> AyED should be deduplicated (indirect path via PdP)

  // [AyED status, PdP status, DDS status, expected availability for each node, expected arrow colors]
  // All 27 combinations (3x3x3) - EXPECTED behavior (TDD)
  // Arrow color = source's contribution to target's availability
  const testCases = [
    // AyED=INACTIVE -> AyED-PdP arrow is NOT_AVAILABLE (AyED doesn't satisfy prereq)
    { statuses: ['INACTIVE', 'INACTIVE', 'INACTIVE'], availabilities: ['FINAL_EXAM_AVAILABLE', 'NOT_AVAILABLE', 'NOT_AVAILABLE'], arrowAvailabilities: { 'AyED-PdP': 'NOT_AVAILABLE', 'PdP-DDS': 'NOT_AVAILABLE' } },
    { statuses: ['INACTIVE', 'INACTIVE', 'FINAL_EXAM_PENDING'], availabilities: ['FINAL_EXAM_AVAILABLE', 'NOT_AVAILABLE', 'NOT_AVAILABLE'], arrowAvailabilities: { 'AyED-PdP': 'NOT_AVAILABLE', 'PdP-DDS': 'NOT_AVAILABLE' } },
    { statuses: ['INACTIVE', 'INACTIVE', 'APPROVED'], availabilities: ['FINAL_EXAM_AVAILABLE', 'NOT_AVAILABLE', 'NOT_AVAILABLE'], arrowAvailabilities: { 'AyED-PdP': 'NOT_AVAILABLE', 'PdP-DDS': 'NOT_AVAILABLE' } },
    { statuses: ['INACTIVE', 'FINAL_EXAM_PENDING', 'INACTIVE'], availabilities: ['FINAL_EXAM_AVAILABLE', 'NOT_AVAILABLE', 'NOT_AVAILABLE'], arrowAvailabilities: { 'AyED-PdP': 'NOT_AVAILABLE', 'PdP-DDS': 'NOT_AVAILABLE' } },
    { statuses: ['INACTIVE', 'FINAL_EXAM_PENDING', 'FINAL_EXAM_PENDING'], availabilities: ['FINAL_EXAM_AVAILABLE', 'NOT_AVAILABLE', 'NOT_AVAILABLE'], arrowAvailabilities: { 'AyED-PdP': 'NOT_AVAILABLE', 'PdP-DDS': 'NOT_AVAILABLE' } },
    { statuses: ['INACTIVE', 'FINAL_EXAM_PENDING', 'APPROVED'], availabilities: ['FINAL_EXAM_AVAILABLE', 'NOT_AVAILABLE', 'NOT_AVAILABLE'], arrowAvailabilities: { 'AyED-PdP': 'NOT_AVAILABLE', 'PdP-DDS': 'NOT_AVAILABLE' } },
    { statuses: ['INACTIVE', 'APPROVED', 'INACTIVE'], availabilities: ['FINAL_EXAM_AVAILABLE', 'NOT_AVAILABLE', 'NOT_AVAILABLE'], arrowAvailabilities: { 'AyED-PdP': 'NOT_AVAILABLE', 'PdP-DDS': 'NOT_AVAILABLE' } },
    { statuses: ['INACTIVE', 'APPROVED', 'FINAL_EXAM_PENDING'], availabilities: ['FINAL_EXAM_AVAILABLE', 'NOT_AVAILABLE', 'NOT_AVAILABLE'], arrowAvailabilities: { 'AyED-PdP': 'NOT_AVAILABLE', 'PdP-DDS': 'NOT_AVAILABLE' } },
    { statuses: ['INACTIVE', 'APPROVED', 'APPROVED'], availabilities: ['FINAL_EXAM_AVAILABLE', 'NOT_AVAILABLE', 'NOT_AVAILABLE'], arrowAvailabilities: { 'AyED-PdP': 'NOT_AVAILABLE', 'PdP-DDS': 'NOT_AVAILABLE' } },
    // AyED=FINAL_EXAM_PENDING -> AyED-PdP arrow is ENROLL_AVAILABLE
    { statuses: ['FINAL_EXAM_PENDING', 'INACTIVE', 'INACTIVE'], availabilities: ['FINAL_EXAM_AVAILABLE', 'ENROLL_AVAILABLE', 'NOT_AVAILABLE'], arrowAvailabilities: { 'AyED-PdP': 'ENROLL_AVAILABLE', 'PdP-DDS': 'NOT_AVAILABLE' } },
    { statuses: ['FINAL_EXAM_PENDING', 'INACTIVE', 'FINAL_EXAM_PENDING'], availabilities: ['FINAL_EXAM_AVAILABLE', 'ENROLL_AVAILABLE', 'NOT_AVAILABLE'], arrowAvailabilities: { 'AyED-PdP': 'ENROLL_AVAILABLE', 'PdP-DDS': 'NOT_AVAILABLE' } },
    { statuses: ['FINAL_EXAM_PENDING', 'INACTIVE', 'APPROVED'], availabilities: ['FINAL_EXAM_AVAILABLE', 'ENROLL_AVAILABLE', 'NOT_AVAILABLE'], arrowAvailabilities: { 'AyED-PdP': 'ENROLL_AVAILABLE', 'PdP-DDS': 'NOT_AVAILABLE' } },
    { statuses: ['FINAL_EXAM_PENDING', 'FINAL_EXAM_PENDING', 'INACTIVE'], availabilities: ['FINAL_EXAM_AVAILABLE', 'ENROLL_AVAILABLE', 'NOT_AVAILABLE'], arrowAvailabilities: { 'AyED-PdP': 'ENROLL_AVAILABLE', 'PdP-DDS': 'NOT_AVAILABLE' } },
    { statuses: ['FINAL_EXAM_PENDING', 'FINAL_EXAM_PENDING', 'FINAL_EXAM_PENDING'], availabilities: ['FINAL_EXAM_AVAILABLE', 'ENROLL_AVAILABLE', 'NOT_AVAILABLE'], arrowAvailabilities: { 'AyED-PdP': 'ENROLL_AVAILABLE', 'PdP-DDS': 'NOT_AVAILABLE' } },
    { statuses: ['FINAL_EXAM_PENDING', 'FINAL_EXAM_PENDING', 'APPROVED'], availabilities: ['FINAL_EXAM_AVAILABLE', 'ENROLL_AVAILABLE', 'NOT_AVAILABLE'], arrowAvailabilities: { 'AyED-PdP': 'ENROLL_AVAILABLE', 'PdP-DDS': 'NOT_AVAILABLE' } },
    // DDS needs AyED=APPROVED for ENROLL, so with AyED=FEP, DDS can't reach ENROLL or higher -> NOT_AVAILABLE
    { statuses: ['FINAL_EXAM_PENDING', 'APPROVED', 'INACTIVE'], availabilities: ['FINAL_EXAM_AVAILABLE', 'ENROLL_AVAILABLE', 'NOT_AVAILABLE'], arrowAvailabilities: { 'AyED-PdP': 'ENROLL_AVAILABLE', 'PdP-DDS': 'NOT_AVAILABLE' } },
    { statuses: ['FINAL_EXAM_PENDING', 'APPROVED', 'FINAL_EXAM_PENDING'], availabilities: ['FINAL_EXAM_AVAILABLE', 'ENROLL_AVAILABLE', 'NOT_AVAILABLE'], arrowAvailabilities: { 'AyED-PdP': 'ENROLL_AVAILABLE', 'PdP-DDS': 'NOT_AVAILABLE' } },
    { statuses: ['FINAL_EXAM_PENDING', 'APPROVED', 'APPROVED'], availabilities: ['FINAL_EXAM_AVAILABLE', 'ENROLL_AVAILABLE', 'NOT_AVAILABLE'], arrowAvailabilities: { 'AyED-PdP': 'ENROLL_AVAILABLE', 'PdP-DDS': 'NOT_AVAILABLE' } },
    // AyED=APPROVED -> AyED-PdP arrow is FINAL_EXAM_AVAILABLE
    { statuses: ['APPROVED', 'INACTIVE', 'INACTIVE'], availabilities: ['FINAL_EXAM_AVAILABLE', 'FINAL_EXAM_AVAILABLE', 'NOT_AVAILABLE'], arrowAvailabilities: { 'AyED-PdP': 'FINAL_EXAM_AVAILABLE', 'PdP-DDS': 'NOT_AVAILABLE' } },
    { statuses: ['APPROVED', 'INACTIVE', 'FINAL_EXAM_PENDING'], availabilities: ['FINAL_EXAM_AVAILABLE', 'FINAL_EXAM_AVAILABLE', 'NOT_AVAILABLE'], arrowAvailabilities: { 'AyED-PdP': 'FINAL_EXAM_AVAILABLE', 'PdP-DDS': 'NOT_AVAILABLE' } },
    { statuses: ['APPROVED', 'INACTIVE', 'APPROVED'], availabilities: ['FINAL_EXAM_AVAILABLE', 'FINAL_EXAM_AVAILABLE', 'NOT_AVAILABLE'], arrowAvailabilities: { 'AyED-PdP': 'FINAL_EXAM_AVAILABLE', 'PdP-DDS': 'NOT_AVAILABLE' } },
    { statuses: ['APPROVED', 'FINAL_EXAM_PENDING', 'INACTIVE'], availabilities: ['FINAL_EXAM_AVAILABLE', 'FINAL_EXAM_AVAILABLE', 'ENROLL_AVAILABLE'], arrowAvailabilities: { 'AyED-PdP': 'FINAL_EXAM_AVAILABLE', 'PdP-DDS': 'ENROLL_AVAILABLE' } },
    { statuses: ['APPROVED', 'FINAL_EXAM_PENDING', 'FINAL_EXAM_PENDING'], availabilities: ['FINAL_EXAM_AVAILABLE', 'FINAL_EXAM_AVAILABLE', 'ENROLL_AVAILABLE'], arrowAvailabilities: { 'AyED-PdP': 'FINAL_EXAM_AVAILABLE', 'PdP-DDS': 'ENROLL_AVAILABLE' } },
    { statuses: ['APPROVED', 'FINAL_EXAM_PENDING', 'APPROVED'], availabilities: ['FINAL_EXAM_AVAILABLE', 'FINAL_EXAM_AVAILABLE', 'ENROLL_AVAILABLE'], arrowAvailabilities: { 'AyED-PdP': 'FINAL_EXAM_AVAILABLE', 'PdP-DDS': 'ENROLL_AVAILABLE' } },
    { statuses: ['APPROVED', 'APPROVED', 'INACTIVE'], availabilities: ['FINAL_EXAM_AVAILABLE', 'FINAL_EXAM_AVAILABLE', 'FINAL_EXAM_AVAILABLE'], arrowAvailabilities: { 'AyED-PdP': 'FINAL_EXAM_AVAILABLE', 'PdP-DDS': 'FINAL_EXAM_AVAILABLE' } },
    { statuses: ['APPROVED', 'APPROVED', 'FINAL_EXAM_PENDING'], availabilities: ['FINAL_EXAM_AVAILABLE', 'FINAL_EXAM_AVAILABLE', 'FINAL_EXAM_AVAILABLE'], arrowAvailabilities: { 'AyED-PdP': 'FINAL_EXAM_AVAILABLE', 'PdP-DDS': 'FINAL_EXAM_AVAILABLE' } },
    { statuses: ['APPROVED', 'APPROVED', 'APPROVED'], availabilities: ['FINAL_EXAM_AVAILABLE', 'FINAL_EXAM_AVAILABLE', 'FINAL_EXAM_AVAILABLE'], arrowAvailabilities: { 'AyED-PdP': 'FINAL_EXAM_AVAILABLE', 'PdP-DDS': 'FINAL_EXAM_AVAILABLE' } },
  ];

  testCases.forEach(({ statuses: [ayedStatus, pdpStatus, ddsStatus], availabilities: [ayedAvail, pdpAvail, ddsAvail], arrowAvailabilities }) => {
    it(`deduplicates with AyED=${ayedStatus}, PdP=${pdpStatus}, DDS=${ddsStatus}`, () => {
      const testSubjects = subjects(
        ['AyED', ayedStatus],
        ['PdP', pdpStatus],
        ['DDS', ddsStatus],
      );

      const graph = new Graph(config, testSubjects, []);
      const drawer = createMockDrawer();
      graph.render(drawer);

      // Should draw 3 circles with correct colors
      expect(drawer.shapes.circles).toHaveLength(3);
      expect(drawer.shapes.circles).toContainEqual({
        label: 'AyED',
        tooltip: 'Algoritmos y Estructuras de Datos',
        position: { x: 100, y: 400 },
        fillColor: statusColor(ayedStatus),
        borderColor: availabilityColor(ayedAvail),
      });
      expect(drawer.shapes.circles).toContainEqual({
        label: 'PdP',
        tooltip: 'Paradigmas de Programación',
        position: { x: 200, y: 400 },
        fillColor: statusColor(pdpStatus),
        borderColor: availabilityColor(pdpAvail),
      });
      expect(drawer.shapes.circles).toContainEqual({
        label: 'DDS',
        tooltip: 'Diseño de Sistemas',
        position: { x: 400, y: 300 },
        fillColor: statusColor(ddsStatus),
        borderColor: availabilityColor(ddsAvail),
      });

      // Should draw 2 arrows with correct colors (NOT AyED -> DDS)
      expect(drawer.shapes.arrows).toHaveLength(2);
      expect(drawer.shapes.arrows).toContainEqual({
        id: 'AyED-PdP',
        from: 'AyED',
        to: 'PdP',
        color: availabilityColor(arrowAvailabilities['AyED-PdP']),
      });
      expect(drawer.shapes.arrows).toContainEqual({
        id: 'PdP-DDS',
        from: 'PdP',
        to: 'DDS',
        color: availabilityColor(arrowAvailabilities['PdP-DDS']),
      });
    });
  });
});

describe('Edge nodes (AGA + AM1 -> link3 -> AM2, PyE)', () => {
  // link3 connects AGA + AM1 to AM2 and PyE (two targets)
  // Both AM2 and PyE need AGA and AM1 (FINAL_EXAM_PENDING for FEP, APPROVED for APPROVED)
  // All 9 combinations (3x3) for AGA and AM1 statuses
  const testCases = [
    // Both INACTIVE -> edge NOT_AVAILABLE, targets NOT_AVAILABLE
    { statuses: ['INACTIVE', 'INACTIVE', 'INACTIVE', 'INACTIVE'], availabilities: ['FINAL_EXAM_AVAILABLE', 'FINAL_EXAM_AVAILABLE', 'NOT_AVAILABLE', 'NOT_AVAILABLE', 'NOT_AVAILABLE'], arrowAvailabilities: { 'AGA-link3': 'NOT_AVAILABLE', 'AM1-link3': 'NOT_AVAILABLE', 'link3-AM2': 'NOT_AVAILABLE', 'link3-PyE': 'NOT_AVAILABLE' } },
    // One FEP, one INACTIVE -> edge NOT_AVAILABLE
    { statuses: ['FINAL_EXAM_PENDING', 'INACTIVE', 'INACTIVE', 'INACTIVE'], availabilities: ['FINAL_EXAM_AVAILABLE', 'FINAL_EXAM_AVAILABLE', 'NOT_AVAILABLE', 'NOT_AVAILABLE', 'NOT_AVAILABLE'], arrowAvailabilities: { 'AGA-link3': 'ENROLL_AVAILABLE', 'AM1-link3': 'NOT_AVAILABLE', 'link3-AM2': 'NOT_AVAILABLE', 'link3-PyE': 'NOT_AVAILABLE' } },
    { statuses: ['INACTIVE', 'FINAL_EXAM_PENDING', 'INACTIVE', 'INACTIVE'], availabilities: ['FINAL_EXAM_AVAILABLE', 'FINAL_EXAM_AVAILABLE', 'NOT_AVAILABLE', 'NOT_AVAILABLE', 'NOT_AVAILABLE'], arrowAvailabilities: { 'AGA-link3': 'NOT_AVAILABLE', 'AM1-link3': 'ENROLL_AVAILABLE', 'link3-AM2': 'NOT_AVAILABLE', 'link3-PyE': 'NOT_AVAILABLE' } },
    // Both FEP -> edge ENROLL_AVAILABLE, targets ENROLL_AVAILABLE
    { statuses: ['FINAL_EXAM_PENDING', 'FINAL_EXAM_PENDING', 'INACTIVE', 'INACTIVE'], availabilities: ['FINAL_EXAM_AVAILABLE', 'FINAL_EXAM_AVAILABLE', 'ENROLL_AVAILABLE', 'ENROLL_AVAILABLE', 'ENROLL_AVAILABLE'], arrowAvailabilities: { 'AGA-link3': 'ENROLL_AVAILABLE', 'AM1-link3': 'ENROLL_AVAILABLE', 'link3-AM2': 'ENROLL_AVAILABLE', 'link3-PyE': 'ENROLL_AVAILABLE' } },
    // One APPROVED, one INACTIVE -> edge NOT_AVAILABLE
    { statuses: ['APPROVED', 'INACTIVE', 'INACTIVE', 'INACTIVE'], availabilities: ['FINAL_EXAM_AVAILABLE', 'FINAL_EXAM_AVAILABLE', 'NOT_AVAILABLE', 'NOT_AVAILABLE', 'NOT_AVAILABLE'], arrowAvailabilities: { 'AGA-link3': 'FINAL_EXAM_AVAILABLE', 'AM1-link3': 'NOT_AVAILABLE', 'link3-AM2': 'NOT_AVAILABLE', 'link3-PyE': 'NOT_AVAILABLE' } },
    { statuses: ['INACTIVE', 'APPROVED', 'INACTIVE', 'INACTIVE'], availabilities: ['FINAL_EXAM_AVAILABLE', 'FINAL_EXAM_AVAILABLE', 'NOT_AVAILABLE', 'NOT_AVAILABLE', 'NOT_AVAILABLE'], arrowAvailabilities: { 'AGA-link3': 'NOT_AVAILABLE', 'AM1-link3': 'FINAL_EXAM_AVAILABLE', 'link3-AM2': 'NOT_AVAILABLE', 'link3-PyE': 'NOT_AVAILABLE' } },
    // One APPROVED, one FEP -> edge ENROLL_AVAILABLE (minimum)
    { statuses: ['APPROVED', 'FINAL_EXAM_PENDING', 'INACTIVE', 'INACTIVE'], availabilities: ['FINAL_EXAM_AVAILABLE', 'FINAL_EXAM_AVAILABLE', 'ENROLL_AVAILABLE', 'ENROLL_AVAILABLE', 'ENROLL_AVAILABLE'], arrowAvailabilities: { 'AGA-link3': 'FINAL_EXAM_AVAILABLE', 'AM1-link3': 'ENROLL_AVAILABLE', 'link3-AM2': 'ENROLL_AVAILABLE', 'link3-PyE': 'ENROLL_AVAILABLE' } },
    { statuses: ['FINAL_EXAM_PENDING', 'APPROVED', 'INACTIVE', 'INACTIVE'], availabilities: ['FINAL_EXAM_AVAILABLE', 'FINAL_EXAM_AVAILABLE', 'ENROLL_AVAILABLE', 'ENROLL_AVAILABLE', 'ENROLL_AVAILABLE'], arrowAvailabilities: { 'AGA-link3': 'ENROLL_AVAILABLE', 'AM1-link3': 'FINAL_EXAM_AVAILABLE', 'link3-AM2': 'ENROLL_AVAILABLE', 'link3-PyE': 'ENROLL_AVAILABLE' } },
    // Both APPROVED -> edge FINAL_EXAM_AVAILABLE, targets FINAL_EXAM_AVAILABLE
    { statuses: ['APPROVED', 'APPROVED', 'INACTIVE', 'INACTIVE'], availabilities: ['FINAL_EXAM_AVAILABLE', 'FINAL_EXAM_AVAILABLE', 'FINAL_EXAM_AVAILABLE', 'FINAL_EXAM_AVAILABLE', 'FINAL_EXAM_AVAILABLE'], arrowAvailabilities: { 'AGA-link3': 'FINAL_EXAM_AVAILABLE', 'AM1-link3': 'FINAL_EXAM_AVAILABLE', 'link3-AM2': 'FINAL_EXAM_AVAILABLE', 'link3-PyE': 'FINAL_EXAM_AVAILABLE' } },
  ];

  testCases.forEach(({ statuses: [agaStatus, am1Status, am2Status, pyeStatus], availabilities: [agaAvail, am1Avail, link3Avail, am2Avail, pyeAvail], arrowAvailabilities }) => {
    it(`renders with AGA=${agaStatus}, AM1=${am1Status}`, () => {
      const testSubjects = subjects(
        ['AGA', agaStatus],
        ['AM1', am1Status],
        ['AM2', am2Status],
        ['PyE', pyeStatus],
      );
      const testEdges = edges(['link3'], ['AGA', 'AM1', 'AM2', 'PyE']);

      const graph = new Graph(config, testSubjects, testEdges);
      const drawer = createMockDrawer();
      graph.render(drawer);

      // Should draw 4 circles (subjects) + 1 diamond (edge)
      expect(drawer.shapes.circles).toHaveLength(4);
      expect(drawer.shapes.diamonds).toHaveLength(1);

      // Check edge node border
      expect(drawer.shapes.diamonds).toContainEqual({
        id: 'link3',
        position: { x: 900, y: 200 },
        borderColor: availabilityColor(link3Avail),
      });

      // Should draw 4 arrows: AGA->link3, AM1->link3, link3->AM2, link3->PyE
      expect(drawer.shapes.arrows).toHaveLength(4);
      expect(drawer.shapes.arrows).toContainEqual({
        id: 'AGA-link3',
        from: 'AGA',
        to: 'link3',
        color: availabilityColor(arrowAvailabilities['AGA-link3']),
      });
      expect(drawer.shapes.arrows).toContainEqual({
        id: 'AM1-link3',
        from: 'AM1',
        to: 'link3',
        color: availabilityColor(arrowAvailabilities['AM1-link3']),
      });
      expect(drawer.shapes.arrows).toContainEqual({
        id: 'link3-AM2',
        from: 'link3',
        to: 'AM2',
        color: availabilityColor(arrowAvailabilities['link3-AM2']),
      });
      expect(drawer.shapes.arrows).toContainEqual({
        id: 'link3-PyE',
        from: 'link3',
        to: 'PyE',
        color: availabilityColor(arrowAvailabilities['link3-PyE']),
      });
    });
  });
});

describe('Invisible edge nodes (F2 -> link19 -> link20 -> link21 -> link22 -> TdC)', () => {
  // Chain of 1:1 edge nodes that should use drawEdge (invisible) instead of drawDiamond
  // F2 -> link19 -> link20 -> link21 -> link22 -> TdC
  // Focus: edge nodes use drawEdge (not drawDiamond) and arrows connect through chain
  it('uses drawEdge for 1:1 edge nodes and draws arrows through chain', () => {
    const testSubjects = subjects(
      ['F2', 'APPROVED'],
      ['TdC', 'INACTIVE'],
    );
    const testEdges = edges(['link19', 'link20', 'link21', 'link22'], ['F2', 'TdC']);

    const graph = new Graph(config, testSubjects, testEdges);
    const drawer = createMockDrawer();
    graph.render(drawer);

    // Should draw 2 circles, 0 diamonds, 4 invisible edges
    expect(drawer.shapes.circles).toHaveLength(2);
    expect(drawer.shapes.diamonds).toHaveLength(0);
    expect(drawer.shapes.edges).toHaveLength(4);

    // Should draw 5 arrows through the chain
    expect(drawer.shapes.arrows).toHaveLength(5);
    expect(drawer.shapes.arrows.map(a => a.id)).toEqual(
      expect.arrayContaining(['F2-link19', 'link19-link20', 'link20-link21', 'link21-link22', 'link22-TdC'])
    );
  });
});

describe('Circular dependency protection', () => {
  it('handles circular dependencies without infinite loop', () => {
    // Create subjects with circular prerequisites: A depends on B, B depends on A
    // This is a misconfiguration, but here we want to check that it is handled gracefully
    const circularSubjects = [
      {
        id: 'A',
        name: 'Subject A',
        status: 'APPROVED',
        prerequisites: [
          { availabilityId: 'FINAL_EXAM_AVAILABLE', dependencies: [{ statusId: 'APPROVED', subjects: ['B'] }] },
        ],
        position: { x: 100, y: 100 },
      },
      {
        id: 'B',
        name: 'Subject B',
        status: 'APPROVED',
        prerequisites: [
          { availabilityId: 'FINAL_EXAM_AVAILABLE', dependencies: [{ statusId: 'APPROVED', subjects: ['A'] }] },
        ],
        position: { x: 200, y: 100 },
      },
    ];

    const graph = new Graph(config, circularSubjects, []);
    const drawer = createMockDrawer();

    // Should not hang - render completes
    graph.render(drawer);

    // Should draw both subjects
    expect(drawer.shapes.circles).toHaveLength(2);
    // Should draw arrows (A->B and B->A, but transitive dedup may remove one)
    expect(drawer.shapes.arrows.length).toBeGreaterThanOrEqual(1);
  });
});
