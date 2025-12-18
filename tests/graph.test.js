import { describe, it, expect } from 'vitest';
import { Graph } from '~/components/graph.js';
import { config, subjects, edges, statusColor, availabilityColor, textColor } from './helpers/common.js';
import { createMockDrawer } from './helpers/mockDrawer.js';

describe('Graph rendering (F1 -> F2)', () => {
  // F2 depends on F1 (FINAL_EXAM_PENDING for FINAL_EXAM_PENDING, APPROVED for APPROVED)
  // Arrow color should reflect the source's contribution to target's availability
  // All 9 combinations (3x3) - EXPECTED behavior (TDD)
  const testCases = [
    // F1=PENDING -> arrow should be PENDING (source doesn't satisfy any prereq)
    { statuses: ['PENDING', 'PENDING'], availabilities: ['FINAL_EXAM_AVAILABLE', 'NOT_AVAILABLE'], arrowAvailability: 'NOT_AVAILABLE' },
    { statuses: ['PENDING', 'FINAL_EXAM_PENDING'], availabilities: ['FINAL_EXAM_AVAILABLE', 'NOT_AVAILABLE'], arrowAvailability: 'NOT_AVAILABLE' },
    { statuses: ['PENDING', 'APPROVED'], availabilities: ['FINAL_EXAM_AVAILABLE', 'NOT_AVAILABLE'], arrowAvailability: 'NOT_AVAILABLE' },
    // F1=FINAL_EXAM_PENDING -> arrow should be FINAL_EXAM_PENDING (source satisfies FEP prereq)
    { statuses: ['FINAL_EXAM_PENDING', 'PENDING'], availabilities: ['FINAL_EXAM_AVAILABLE', 'ENROLL_AVAILABLE'], arrowAvailability: 'ENROLL_AVAILABLE' },
    { statuses: ['FINAL_EXAM_PENDING', 'FINAL_EXAM_PENDING'], availabilities: ['FINAL_EXAM_AVAILABLE', 'ENROLL_AVAILABLE'], arrowAvailability: 'ENROLL_AVAILABLE' },
    { statuses: ['FINAL_EXAM_PENDING', 'APPROVED'], availabilities: ['FINAL_EXAM_AVAILABLE', 'ENROLL_AVAILABLE'], arrowAvailability: 'ENROLL_AVAILABLE' },
    // F1=APPROVED -> arrow should be APPROVED (source satisfies APPROVED prereq)
    { statuses: ['APPROVED', 'PENDING'], availabilities: ['FINAL_EXAM_AVAILABLE', 'FINAL_EXAM_AVAILABLE'], arrowAvailability: 'FINAL_EXAM_AVAILABLE' },
    { statuses: ['APPROVED', 'FINAL_EXAM_PENDING'], availabilities: ['FINAL_EXAM_AVAILABLE', 'FINAL_EXAM_AVAILABLE'], arrowAvailability: 'FINAL_EXAM_AVAILABLE' },
    { statuses: ['APPROVED', 'APPROVED'], availabilities: ['FINAL_EXAM_AVAILABLE', 'FINAL_EXAM_AVAILABLE'], arrowAvailability: 'FINAL_EXAM_AVAILABLE' },
  ];

  testCases.forEach(({ statuses: [f1Status, f2Status], availabilities: [f1Avail, f2Avail], arrowAvailability }) => {
    it(`renders with F1=${f1Status}, F2=${f2Status}`, () => {
      const testSubjects = subjects(
        ['7', f1Status],
        ['11', f2Status],
      );

      const graph = new Graph(config, testSubjects, []);
      const drawer = createMockDrawer();
      graph.render(drawer);

      // Should draw 2 circles (one per subject)
      expect(drawer.shapes.circles).toHaveLength(2);
      expect(drawer.shapes.circles).toContainEqual({
        id: '7',
        label: 'F1',
        tooltip: 'Física I',
        position: { x: 900, y: 500 },
        status: f1Status,
        fillColor: statusColor(f1Status),
        borderColor: availabilityColor(f1Avail),
        textColor: textColor(f1Status, false),
      });
      expect(drawer.shapes.circles).toContainEqual({
        id: '11',
        label: 'F2',
        tooltip: 'Física II',
        position: { x: 800, y: 500 },
        status: f2Status,
        fillColor: statusColor(f2Status),
        borderColor: availabilityColor(f2Avail),
        textColor: textColor(f2Status, true),
      });

      // Should draw 1 arrow from F1 to F2
      expect(drawer.shapes.arrows).toHaveLength(1);
      expect(drawer.shapes.arrows).toContainEqual({
        id: '7-11',
        from: '7',
        to: '11',
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
    // F2=PENDING -> arrow should be PENDING (F2 doesn't satisfy APPROVED prereq)
    { statuses: ['PENDING', 'PENDING'], arrowAvailability: 'NOT_AVAILABLE' },
    { statuses: ['PENDING', 'FINAL_EXAM_PENDING'], arrowAvailability: 'NOT_AVAILABLE' },
    { statuses: ['PENDING', 'APPROVED'], arrowAvailability: 'NOT_AVAILABLE' },
    // F2=FINAL_EXAM_PENDING -> arrow should be PENDING (F2 needs APPROVED, not FEP)
    { statuses: ['FINAL_EXAM_PENDING', 'PENDING'], arrowAvailability: 'NOT_AVAILABLE' },
    { statuses: ['FINAL_EXAM_PENDING', 'FINAL_EXAM_PENDING'], arrowAvailability: 'NOT_AVAILABLE' },
    { statuses: ['FINAL_EXAM_PENDING', 'APPROVED'], arrowAvailability: 'NOT_AVAILABLE' },
    // F2=APPROVED -> arrow should be FINAL_EXAM_AVAILABLE (F2 satisfies APPROVED prereq, higher levels have no F2 prereqs so also satisfied)
    { statuses: ['APPROVED', 'PENDING'], arrowAvailability: 'FINAL_EXAM_AVAILABLE' },
    { statuses: ['APPROVED', 'FINAL_EXAM_PENDING'], arrowAvailability: 'FINAL_EXAM_AVAILABLE' },
    { statuses: ['APPROVED', 'APPROVED'], arrowAvailability: 'FINAL_EXAM_AVAILABLE' },
  ];

  testCases.forEach(({ statuses: [f2Status, qStatus], arrowAvailability }) => {
    it(`renders with F2=${f2Status}, Q=${qStatus}`, () => {
      const testSubjects = subjects(
        ['9', qStatus],
        ['11', f2Status],
        ['30', 'PENDING'],
      );

      const graph = new Graph(config, testSubjects, []);
      const drawer = createMockDrawer();
      graph.render(drawer);

      // F2 -> TdC arrow should reflect F2's contribution
      const f2Arrow = drawer.shapes.arrows.find(a => a.id === '11-30');
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
    // AyED=PENDING -> AyED-PdP arrow is NOT_AVAILABLE (AyED doesn't satisfy prereq)
    { statuses: ['PENDING', 'PENDING', 'PENDING'], availabilities: ['FINAL_EXAM_AVAILABLE', 'NOT_AVAILABLE', 'NOT_AVAILABLE'], arrowAvailabilities: { 'AyED-PdP': 'NOT_AVAILABLE', 'PdP-DDS': 'NOT_AVAILABLE' } },
    { statuses: ['PENDING', 'PENDING', 'FINAL_EXAM_PENDING'], availabilities: ['FINAL_EXAM_AVAILABLE', 'NOT_AVAILABLE', 'NOT_AVAILABLE'], arrowAvailabilities: { 'AyED-PdP': 'NOT_AVAILABLE', 'PdP-DDS': 'NOT_AVAILABLE' } },
    { statuses: ['PENDING', 'PENDING', 'APPROVED'], availabilities: ['FINAL_EXAM_AVAILABLE', 'NOT_AVAILABLE', 'NOT_AVAILABLE'], arrowAvailabilities: { 'AyED-PdP': 'NOT_AVAILABLE', 'PdP-DDS': 'NOT_AVAILABLE' } },
    { statuses: ['PENDING', 'FINAL_EXAM_PENDING', 'PENDING'], availabilities: ['FINAL_EXAM_AVAILABLE', 'NOT_AVAILABLE', 'NOT_AVAILABLE'], arrowAvailabilities: { 'AyED-PdP': 'NOT_AVAILABLE', 'PdP-DDS': 'NOT_AVAILABLE' } },
    { statuses: ['PENDING', 'FINAL_EXAM_PENDING', 'FINAL_EXAM_PENDING'], availabilities: ['FINAL_EXAM_AVAILABLE', 'NOT_AVAILABLE', 'NOT_AVAILABLE'], arrowAvailabilities: { 'AyED-PdP': 'NOT_AVAILABLE', 'PdP-DDS': 'NOT_AVAILABLE' } },
    { statuses: ['PENDING', 'FINAL_EXAM_PENDING', 'APPROVED'], availabilities: ['FINAL_EXAM_AVAILABLE', 'NOT_AVAILABLE', 'NOT_AVAILABLE'], arrowAvailabilities: { 'AyED-PdP': 'NOT_AVAILABLE', 'PdP-DDS': 'NOT_AVAILABLE' } },
    { statuses: ['PENDING', 'APPROVED', 'PENDING'], availabilities: ['FINAL_EXAM_AVAILABLE', 'NOT_AVAILABLE', 'NOT_AVAILABLE'], arrowAvailabilities: { 'AyED-PdP': 'NOT_AVAILABLE', 'PdP-DDS': 'NOT_AVAILABLE' } },
    { statuses: ['PENDING', 'APPROVED', 'FINAL_EXAM_PENDING'], availabilities: ['FINAL_EXAM_AVAILABLE', 'NOT_AVAILABLE', 'NOT_AVAILABLE'], arrowAvailabilities: { 'AyED-PdP': 'NOT_AVAILABLE', 'PdP-DDS': 'NOT_AVAILABLE' } },
    { statuses: ['PENDING', 'APPROVED', 'APPROVED'], availabilities: ['FINAL_EXAM_AVAILABLE', 'NOT_AVAILABLE', 'NOT_AVAILABLE'], arrowAvailabilities: { 'AyED-PdP': 'NOT_AVAILABLE', 'PdP-DDS': 'NOT_AVAILABLE' } },
    // AyED=FINAL_EXAM_PENDING -> AyED-PdP arrow is ENROLL_AVAILABLE
    { statuses: ['FINAL_EXAM_PENDING', 'PENDING', 'PENDING'], availabilities: ['FINAL_EXAM_AVAILABLE', 'ENROLL_AVAILABLE', 'NOT_AVAILABLE'], arrowAvailabilities: { 'AyED-PdP': 'ENROLL_AVAILABLE', 'PdP-DDS': 'NOT_AVAILABLE' } },
    { statuses: ['FINAL_EXAM_PENDING', 'PENDING', 'FINAL_EXAM_PENDING'], availabilities: ['FINAL_EXAM_AVAILABLE', 'ENROLL_AVAILABLE', 'NOT_AVAILABLE'], arrowAvailabilities: { 'AyED-PdP': 'ENROLL_AVAILABLE', 'PdP-DDS': 'NOT_AVAILABLE' } },
    { statuses: ['FINAL_EXAM_PENDING', 'PENDING', 'APPROVED'], availabilities: ['FINAL_EXAM_AVAILABLE', 'ENROLL_AVAILABLE', 'NOT_AVAILABLE'], arrowAvailabilities: { 'AyED-PdP': 'ENROLL_AVAILABLE', 'PdP-DDS': 'NOT_AVAILABLE' } },
    { statuses: ['FINAL_EXAM_PENDING', 'FINAL_EXAM_PENDING', 'PENDING'], availabilities: ['FINAL_EXAM_AVAILABLE', 'ENROLL_AVAILABLE', 'NOT_AVAILABLE'], arrowAvailabilities: { 'AyED-PdP': 'ENROLL_AVAILABLE', 'PdP-DDS': 'NOT_AVAILABLE' } },
    { statuses: ['FINAL_EXAM_PENDING', 'FINAL_EXAM_PENDING', 'FINAL_EXAM_PENDING'], availabilities: ['FINAL_EXAM_AVAILABLE', 'ENROLL_AVAILABLE', 'NOT_AVAILABLE'], arrowAvailabilities: { 'AyED-PdP': 'ENROLL_AVAILABLE', 'PdP-DDS': 'NOT_AVAILABLE' } },
    { statuses: ['FINAL_EXAM_PENDING', 'FINAL_EXAM_PENDING', 'APPROVED'], availabilities: ['FINAL_EXAM_AVAILABLE', 'ENROLL_AVAILABLE', 'NOT_AVAILABLE'], arrowAvailabilities: { 'AyED-PdP': 'ENROLL_AVAILABLE', 'PdP-DDS': 'NOT_AVAILABLE' } },
    // DDS needs AyED=APPROVED for ENROLL, so with AyED=FEP, DDS can't reach ENROLL or higher -> NOT_AVAILABLE
    { statuses: ['FINAL_EXAM_PENDING', 'APPROVED', 'PENDING'], availabilities: ['FINAL_EXAM_AVAILABLE', 'ENROLL_AVAILABLE', 'NOT_AVAILABLE'], arrowAvailabilities: { 'AyED-PdP': 'ENROLL_AVAILABLE', 'PdP-DDS': 'NOT_AVAILABLE' } },
    { statuses: ['FINAL_EXAM_PENDING', 'APPROVED', 'FINAL_EXAM_PENDING'], availabilities: ['FINAL_EXAM_AVAILABLE', 'ENROLL_AVAILABLE', 'NOT_AVAILABLE'], arrowAvailabilities: { 'AyED-PdP': 'ENROLL_AVAILABLE', 'PdP-DDS': 'NOT_AVAILABLE' } },
    { statuses: ['FINAL_EXAM_PENDING', 'APPROVED', 'APPROVED'], availabilities: ['FINAL_EXAM_AVAILABLE', 'ENROLL_AVAILABLE', 'NOT_AVAILABLE'], arrowAvailabilities: { 'AyED-PdP': 'ENROLL_AVAILABLE', 'PdP-DDS': 'NOT_AVAILABLE' } },
    // AyED=APPROVED -> AyED-PdP arrow is FINAL_EXAM_AVAILABLE
    { statuses: ['APPROVED', 'PENDING', 'PENDING'], availabilities: ['FINAL_EXAM_AVAILABLE', 'FINAL_EXAM_AVAILABLE', 'NOT_AVAILABLE'], arrowAvailabilities: { 'AyED-PdP': 'FINAL_EXAM_AVAILABLE', 'PdP-DDS': 'NOT_AVAILABLE' } },
    { statuses: ['APPROVED', 'PENDING', 'FINAL_EXAM_PENDING'], availabilities: ['FINAL_EXAM_AVAILABLE', 'FINAL_EXAM_AVAILABLE', 'NOT_AVAILABLE'], arrowAvailabilities: { 'AyED-PdP': 'FINAL_EXAM_AVAILABLE', 'PdP-DDS': 'NOT_AVAILABLE' } },
    { statuses: ['APPROVED', 'PENDING', 'APPROVED'], availabilities: ['FINAL_EXAM_AVAILABLE', 'FINAL_EXAM_AVAILABLE', 'NOT_AVAILABLE'], arrowAvailabilities: { 'AyED-PdP': 'FINAL_EXAM_AVAILABLE', 'PdP-DDS': 'NOT_AVAILABLE' } },
    { statuses: ['APPROVED', 'FINAL_EXAM_PENDING', 'PENDING'], availabilities: ['FINAL_EXAM_AVAILABLE', 'FINAL_EXAM_AVAILABLE', 'ENROLL_AVAILABLE'], arrowAvailabilities: { 'AyED-PdP': 'FINAL_EXAM_AVAILABLE', 'PdP-DDS': 'ENROLL_AVAILABLE' } },
    { statuses: ['APPROVED', 'FINAL_EXAM_PENDING', 'FINAL_EXAM_PENDING'], availabilities: ['FINAL_EXAM_AVAILABLE', 'FINAL_EXAM_AVAILABLE', 'ENROLL_AVAILABLE'], arrowAvailabilities: { 'AyED-PdP': 'FINAL_EXAM_AVAILABLE', 'PdP-DDS': 'ENROLL_AVAILABLE' } },
    { statuses: ['APPROVED', 'FINAL_EXAM_PENDING', 'APPROVED'], availabilities: ['FINAL_EXAM_AVAILABLE', 'FINAL_EXAM_AVAILABLE', 'ENROLL_AVAILABLE'], arrowAvailabilities: { 'AyED-PdP': 'FINAL_EXAM_AVAILABLE', 'PdP-DDS': 'ENROLL_AVAILABLE' } },
    { statuses: ['APPROVED', 'APPROVED', 'PENDING'], availabilities: ['FINAL_EXAM_AVAILABLE', 'FINAL_EXAM_AVAILABLE', 'FINAL_EXAM_AVAILABLE'], arrowAvailabilities: { 'AyED-PdP': 'FINAL_EXAM_AVAILABLE', 'PdP-DDS': 'FINAL_EXAM_AVAILABLE' } },
    { statuses: ['APPROVED', 'APPROVED', 'FINAL_EXAM_PENDING'], availabilities: ['FINAL_EXAM_AVAILABLE', 'FINAL_EXAM_AVAILABLE', 'FINAL_EXAM_AVAILABLE'], arrowAvailabilities: { 'AyED-PdP': 'FINAL_EXAM_AVAILABLE', 'PdP-DDS': 'FINAL_EXAM_AVAILABLE' } },
    { statuses: ['APPROVED', 'APPROVED', 'APPROVED'], availabilities: ['FINAL_EXAM_AVAILABLE', 'FINAL_EXAM_AVAILABLE', 'FINAL_EXAM_AVAILABLE'], arrowAvailabilities: { 'AyED-PdP': 'FINAL_EXAM_AVAILABLE', 'PdP-DDS': 'FINAL_EXAM_AVAILABLE' } },
  ];

  testCases.forEach(({ statuses: [ayedStatus, pdpStatus, ddsStatus], availabilities: [ayedAvail, pdpAvail, ddsAvail], arrowAvailabilities }) => {
    it(`deduplicates with AyED=${ayedStatus}, PdP=${pdpStatus}, DDS=${ddsStatus}`, () => {
      const testSubjects = subjects(
        ['5', ayedStatus],
        ['14', pdpStatus],
        ['18', ddsStatus],
      );

      const graph = new Graph(config, testSubjects, []);
      const drawer = createMockDrawer();
      graph.render(drawer);

      // Should draw 3 circles with correct colors
      expect(drawer.shapes.circles).toHaveLength(3);
      expect(drawer.shapes.circles).toContainEqual({
        id: '5',
        label: 'AyED',
        tooltip: 'Algoritmos y Estructuras de Datos',
        position: { x: 100, y: 400 },
        status: ayedStatus,
        fillColor: statusColor(ayedStatus),
        borderColor: availabilityColor(ayedAvail),
        textColor: textColor(ayedStatus, false),
      });
      expect(drawer.shapes.circles).toContainEqual({
        id: '14',
        label: 'PdP',
        tooltip: 'Paradigmas de Programación',
        position: { x: 200, y: 400 },
        status: pdpStatus,
        fillColor: statusColor(pdpStatus),
        borderColor: availabilityColor(pdpAvail),
        textColor: textColor(pdpStatus, false),
      });
      expect(drawer.shapes.circles).toContainEqual({
        id: '18',
        label: 'DDS',
        tooltip: 'Diseño de Sistemas',
        position: { x: 400, y: 300 },
        status: ddsStatus,
        fillColor: statusColor(ddsStatus),
        borderColor: availabilityColor(ddsAvail),
        textColor: textColor(ddsStatus, true),
      });

      // Should draw 2 arrows with correct colors (NOT AyED -> DDS)
      expect(drawer.shapes.arrows).toHaveLength(2);
      expect(drawer.shapes.arrows).toContainEqual({
        id: '5-14',
        from: '5',
        to: '14',
        color: availabilityColor(arrowAvailabilities['AyED-PdP']),
      });
      expect(drawer.shapes.arrows).toContainEqual({
        id: '14-18',
        from: '14',
        to: '18',
        color: availabilityColor(arrowAvailabilities['PdP-DDS']),
      });
    });
  });
});

describe('Edge nodes', () => {
  describe('Many to many nodes (AGA + AM1 -> AM2, PyE)', () => {
    // link connects AGA + AM1 to AM2 and PyE (two targets)
    // Both AM2 and PyE need AGA and AM1 (FINAL_EXAM_PENDING for FEP, APPROVED for APPROVED)
    // All 9 combinations (3x3) for AGA and AM1 statuses
    const testCases = [
      // Both PENDING -> edge NOT_AVAILABLE, targets NOT_AVAILABLE
      { statuses: ['PENDING', 'PENDING', 'PENDING', 'PENDING'], availabilities: ['FINAL_EXAM_AVAILABLE', 'FINAL_EXAM_AVAILABLE', 'NOT_AVAILABLE', 'NOT_AVAILABLE', 'NOT_AVAILABLE'], arrowAvailabilities: { 'AGA-link': 'NOT_AVAILABLE', 'AM1-link': 'NOT_AVAILABLE', 'link-AM2': 'NOT_AVAILABLE', 'link-PyE': 'NOT_AVAILABLE' } },
      // One FEP, one PENDING -> edge NOT_AVAILABLE
      { statuses: ['FINAL_EXAM_PENDING', 'PENDING', 'PENDING', 'PENDING'], availabilities: ['FINAL_EXAM_AVAILABLE', 'FINAL_EXAM_AVAILABLE', 'NOT_AVAILABLE', 'NOT_AVAILABLE', 'NOT_AVAILABLE'], arrowAvailabilities: { 'AGA-link': 'ENROLL_AVAILABLE', 'AM1-link': 'NOT_AVAILABLE', 'link-AM2': 'NOT_AVAILABLE', 'link-PyE': 'NOT_AVAILABLE' } },
      { statuses: ['PENDING', 'FINAL_EXAM_PENDING', 'PENDING', 'PENDING'], availabilities: ['FINAL_EXAM_AVAILABLE', 'FINAL_EXAM_AVAILABLE', 'NOT_AVAILABLE', 'NOT_AVAILABLE', 'NOT_AVAILABLE'], arrowAvailabilities: { 'AGA-link': 'NOT_AVAILABLE', 'AM1-link': 'ENROLL_AVAILABLE', 'link-AM2': 'NOT_AVAILABLE', 'link-PyE': 'NOT_AVAILABLE' } },
      // Both FEP -> edge ENROLL_AVAILABLE, targets ENROLL_AVAILABLE
      { statuses: ['FINAL_EXAM_PENDING', 'FINAL_EXAM_PENDING', 'PENDING', 'PENDING'], availabilities: ['FINAL_EXAM_AVAILABLE', 'FINAL_EXAM_AVAILABLE', 'ENROLL_AVAILABLE', 'ENROLL_AVAILABLE', 'ENROLL_AVAILABLE'], arrowAvailabilities: { 'AGA-link': 'ENROLL_AVAILABLE', 'AM1-link': 'ENROLL_AVAILABLE', 'link-AM2': 'ENROLL_AVAILABLE', 'link-PyE': 'ENROLL_AVAILABLE' } },
      // One APPROVED, one PENDING -> edge NOT_AVAILABLE
      { statuses: ['APPROVED', 'PENDING', 'PENDING', 'PENDING'], availabilities: ['FINAL_EXAM_AVAILABLE', 'FINAL_EXAM_AVAILABLE', 'NOT_AVAILABLE', 'NOT_AVAILABLE', 'NOT_AVAILABLE'], arrowAvailabilities: { 'AGA-link': 'FINAL_EXAM_AVAILABLE', 'AM1-link': 'NOT_AVAILABLE', 'link-AM2': 'NOT_AVAILABLE', 'link-PyE': 'NOT_AVAILABLE' } },
      { statuses: ['PENDING', 'APPROVED', 'PENDING', 'PENDING'], availabilities: ['FINAL_EXAM_AVAILABLE', 'FINAL_EXAM_AVAILABLE', 'NOT_AVAILABLE', 'NOT_AVAILABLE', 'NOT_AVAILABLE'], arrowAvailabilities: { 'AGA-link': 'NOT_AVAILABLE', 'AM1-link': 'FINAL_EXAM_AVAILABLE', 'link-AM2': 'NOT_AVAILABLE', 'link-PyE': 'NOT_AVAILABLE' } },
      // One APPROVED, one FEP -> edge ENROLL_AVAILABLE (minimum)
      { statuses: ['APPROVED', 'FINAL_EXAM_PENDING', 'PENDING', 'PENDING'], availabilities: ['FINAL_EXAM_AVAILABLE', 'FINAL_EXAM_AVAILABLE', 'ENROLL_AVAILABLE', 'ENROLL_AVAILABLE', 'ENROLL_AVAILABLE'], arrowAvailabilities: { 'AGA-link': 'FINAL_EXAM_AVAILABLE', 'AM1-link': 'ENROLL_AVAILABLE', 'link-AM2': 'ENROLL_AVAILABLE', 'link-PyE': 'ENROLL_AVAILABLE' } },
      { statuses: ['FINAL_EXAM_PENDING', 'APPROVED', 'PENDING', 'PENDING'], availabilities: ['FINAL_EXAM_AVAILABLE', 'FINAL_EXAM_AVAILABLE', 'ENROLL_AVAILABLE', 'ENROLL_AVAILABLE', 'ENROLL_AVAILABLE'], arrowAvailabilities: { 'AGA-link': 'ENROLL_AVAILABLE', 'AM1-link': 'FINAL_EXAM_AVAILABLE', 'link-AM2': 'ENROLL_AVAILABLE', 'link-PyE': 'ENROLL_AVAILABLE' } },
      // Both APPROVED -> edge FINAL_EXAM_AVAILABLE, targets FINAL_EXAM_AVAILABLE
      { statuses: ['APPROVED', 'APPROVED', 'PENDING', 'PENDING'], availabilities: ['FINAL_EXAM_AVAILABLE', 'FINAL_EXAM_AVAILABLE', 'FINAL_EXAM_AVAILABLE', 'FINAL_EXAM_AVAILABLE', 'FINAL_EXAM_AVAILABLE'], arrowAvailabilities: { 'AGA-link': 'FINAL_EXAM_AVAILABLE', 'AM1-link': 'FINAL_EXAM_AVAILABLE', 'link-AM2': 'FINAL_EXAM_AVAILABLE', 'link-PyE': 'FINAL_EXAM_AVAILABLE' } },
    ];

    testCases.forEach(({ statuses: [agaStatus, am1Status, am2Status, pyeStatus], availabilities: [agaAvail, am1Avail, linkAvail, am2Avail, pyeAvail], arrowAvailabilities }) => {
      it(`renders with AGA=${agaStatus}, AM1=${am1Status}`, () => {
        const testSubjects = subjects(
          ['2', agaStatus],
          ['1', am1Status],
          ['10', am2Status],
          ['17', pyeStatus],
        );
        const testEdges = edges(['AM1,AGA:AM2,PyE'], ['2', '1', '10', '17']);

        const graph = new Graph(config, testSubjects, testEdges);
        const drawer = createMockDrawer();
        graph.render(drawer);

        // Should draw 4 circles (subjects) + 1 diamond (edge)
        expect(drawer.shapes.circles).toHaveLength(4);
        expect(drawer.shapes.diamonds).toHaveLength(1);

        // Check edge node border
        expect(drawer.shapes.diamonds).toContainEqual({
          id: 'AM1,AGA:AM2,PyE',
          position: { x: 900, y: 200 },
          borderColor: availabilityColor(linkAvail),
        });

        // Should draw 4 arrows: AGA->link, AM1->link, link->AM2, link->PyE
        expect(drawer.shapes.arrows).toHaveLength(4);
        expect(drawer.shapes.arrows).toContainEqual({
          id: '2-AM1,AGA:AM2,PyE',
          from: '2',
          to: 'AM1,AGA:AM2,PyE',
          color: availabilityColor(arrowAvailabilities['AGA-link']),
        });
        expect(drawer.shapes.arrows).toContainEqual({
          id: '1-AM1,AGA:AM2,PyE',
          from: '1',
          to: 'AM1,AGA:AM2,PyE',
          color: availabilityColor(arrowAvailabilities['AM1-link']),
        });
        expect(drawer.shapes.arrows).toContainEqual({
          id: 'AM1,AGA:AM2,PyE-10',
          from: 'AM1,AGA:AM2,PyE',
          to: '10',
          color: availabilityColor(arrowAvailabilities['link-AM2']),
        });
        expect(drawer.shapes.arrows).toContainEqual({
          id: 'AM1,AGA:AM2,PyE-17',
          from: 'AM1,AGA:AM2,PyE',
          to: '17',
          color: availabilityColor(arrowAvailabilities['link-PyE']),
        });
      });
    });
  });

  describe('Many to one node (AyED + MD -> SO) and unrelated link (AdC -> SO)', () => {
    // link connects AyED + MD to SO
    // SO also depends on AdC (unrelated)
    // All 9 combinations (3x3) for AyED and MD statuses
    const testCases = [
      // Both PENDING -> edge NOT_AVAILABLE
      { statuses: ['PENDING', 'PENDING', 'PENDING', 'PENDING'], availabilities: ['NOT_AVAILABLE', 'NOT_AVAILABLE', 'NOT_AVAILABLE', 'NOT_AVAILABLE', 'NOT_AVAILABLE', 'NOT_AVAILABLE'] },
      { statuses: ['PENDING', 'PENDING', 'FINAL_EXAM_PENDING', 'PENDING'], availabilities: ['NOT_AVAILABLE', 'NOT_AVAILABLE', 'NOT_AVAILABLE', 'NOT_AVAILABLE', 'ENROLL_AVAILABLE', 'NOT_AVAILABLE'] },
      { statuses: ['PENDING', 'PENDING', 'APPROVED', 'PENDING'], availabilities: ['NOT_AVAILABLE', 'NOT_AVAILABLE', 'NOT_AVAILABLE', 'NOT_AVAILABLE', 'FINAL_EXAM_AVAILABLE', 'NOT_AVAILABLE'] },
      // One FEP, one PENDING -> edge NOT_AVAILABLE
      { statuses: ['FINAL_EXAM_PENDING', 'PENDING', 'PENDING', 'PENDING'], availabilities: ['NOT_AVAILABLE', 'ENROLL_AVAILABLE', 'NOT_AVAILABLE', 'NOT_AVAILABLE', 'NOT_AVAILABLE', 'NOT_AVAILABLE'] },
      { statuses: ['PENDING', 'FINAL_EXAM_PENDING', 'PENDING', 'PENDING'], availabilities: ['NOT_AVAILABLE', 'NOT_AVAILABLE', 'ENROLL_AVAILABLE', 'NOT_AVAILABLE', 'NOT_AVAILABLE', 'NOT_AVAILABLE'] },
      { statuses: ['FINAL_EXAM_PENDING', 'PENDING', 'FINAL_EXAM_PENDING', 'PENDING'], availabilities: ['NOT_AVAILABLE', 'ENROLL_AVAILABLE', 'NOT_AVAILABLE', 'NOT_AVAILABLE', 'ENROLL_AVAILABLE', 'NOT_AVAILABLE'] },
      { statuses: ['PENDING', 'FINAL_EXAM_PENDING', 'FINAL_EXAM_PENDING', 'PENDING'], availabilities: ['NOT_AVAILABLE', 'NOT_AVAILABLE', 'ENROLL_AVAILABLE', 'NOT_AVAILABLE', 'ENROLL_AVAILABLE', 'NOT_AVAILABLE'] },
      { statuses: ['FINAL_EXAM_PENDING', 'PENDING', 'APPROVED', 'PENDING'], availabilities: ['NOT_AVAILABLE', 'ENROLL_AVAILABLE', 'NOT_AVAILABLE', 'NOT_AVAILABLE', 'FINAL_EXAM_AVAILABLE', 'NOT_AVAILABLE'] },
      { statuses: ['PENDING', 'FINAL_EXAM_PENDING', 'APPROVED', 'PENDING'], availabilities: ['NOT_AVAILABLE', 'NOT_AVAILABLE', 'ENROLL_AVAILABLE', 'NOT_AVAILABLE', 'FINAL_EXAM_AVAILABLE', 'NOT_AVAILABLE'] },
      // Both FEP -> edge ENROLL_AVAILABLE
      { statuses: ['FINAL_EXAM_PENDING', 'FINAL_EXAM_PENDING', 'PENDING', 'PENDING'], availabilities: ['ENROLL_AVAILABLE', 'ENROLL_AVAILABLE', 'ENROLL_AVAILABLE', 'ENROLL_AVAILABLE', 'NOT_AVAILABLE', 'NOT_AVAILABLE'] },
      { statuses: ['FINAL_EXAM_PENDING', 'FINAL_EXAM_PENDING', 'FINAL_EXAM_PENDING', 'PENDING'], availabilities: ['ENROLL_AVAILABLE', 'ENROLL_AVAILABLE', 'ENROLL_AVAILABLE', 'ENROLL_AVAILABLE', 'ENROLL_AVAILABLE', 'ENROLL_AVAILABLE'] },
      { statuses: ['FINAL_EXAM_PENDING', 'FINAL_EXAM_PENDING', 'APPROVED', 'PENDING'], availabilities: ['ENROLL_AVAILABLE', 'ENROLL_AVAILABLE', 'ENROLL_AVAILABLE', 'ENROLL_AVAILABLE', 'FINAL_EXAM_AVAILABLE', 'ENROLL_AVAILABLE'] },
      // One APPROVED, one PENDING -> edge NOT_AVAILABLE
      { statuses: ['APPROVED', 'PENDING', 'PENDING', 'PENDING'], availabilities: ['NOT_AVAILABLE', 'FINAL_EXAM_AVAILABLE', 'NOT_AVAILABLE', 'NOT_AVAILABLE', 'NOT_AVAILABLE', 'NOT_AVAILABLE'] },
      { statuses: ['PENDING', 'APPROVED', 'PENDING', 'PENDING'], availabilities: ['NOT_AVAILABLE', 'NOT_AVAILABLE', 'FINAL_EXAM_AVAILABLE', 'NOT_AVAILABLE', 'NOT_AVAILABLE', 'NOT_AVAILABLE'] },
      { statuses: ['APPROVED', 'PENDING', 'FINAL_EXAM_PENDING', 'PENDING'], availabilities: ['NOT_AVAILABLE', 'FINAL_EXAM_AVAILABLE', 'NOT_AVAILABLE', 'NOT_AVAILABLE', 'ENROLL_AVAILABLE', 'NOT_AVAILABLE'] },
      { statuses: ['PENDING', 'APPROVED', 'FINAL_EXAM_PENDING', 'PENDING'], availabilities: ['NOT_AVAILABLE', 'NOT_AVAILABLE', 'FINAL_EXAM_AVAILABLE', 'NOT_AVAILABLE', 'ENROLL_AVAILABLE', 'NOT_AVAILABLE'] },
      { statuses: ['APPROVED', 'PENDING', 'APPROVED', 'PENDING'], availabilities: ['NOT_AVAILABLE', 'FINAL_EXAM_AVAILABLE', 'NOT_AVAILABLE', 'NOT_AVAILABLE', 'FINAL_EXAM_AVAILABLE', 'NOT_AVAILABLE'] },
      { statuses: ['PENDING', 'APPROVED', 'APPROVED', 'PENDING'], availabilities: ['NOT_AVAILABLE', 'NOT_AVAILABLE', 'FINAL_EXAM_AVAILABLE', 'NOT_AVAILABLE', 'FINAL_EXAM_AVAILABLE', 'NOT_AVAILABLE'] },
      // One APPROVED, one FEP -> edge ENROLL_AVAILABLE
      { statuses: ['APPROVED', 'FINAL_EXAM_PENDING', 'PENDING', 'PENDING'], availabilities: ['ENROLL_AVAILABLE', 'FINAL_EXAM_AVAILABLE', 'ENROLL_AVAILABLE', 'ENROLL_AVAILABLE', 'NOT_AVAILABLE', 'NOT_AVAILABLE'] },
      { statuses: ['FINAL_EXAM_PENDING', 'APPROVED', 'PENDING', 'PENDING'], availabilities: ['ENROLL_AVAILABLE', 'ENROLL_AVAILABLE', 'FINAL_EXAM_AVAILABLE', 'ENROLL_AVAILABLE', 'NOT_AVAILABLE', 'NOT_AVAILABLE'] },
      { statuses: ['APPROVED', 'FINAL_EXAM_PENDING', 'FINAL_EXAM_PENDING', 'PENDING'], availabilities: ['ENROLL_AVAILABLE', 'FINAL_EXAM_AVAILABLE', 'ENROLL_AVAILABLE', 'ENROLL_AVAILABLE', 'ENROLL_AVAILABLE', 'ENROLL_AVAILABLE'] },
      { statuses: ['FINAL_EXAM_PENDING', 'APPROVED', 'FINAL_EXAM_PENDING', 'PENDING'], availabilities: ['ENROLL_AVAILABLE', 'ENROLL_AVAILABLE', 'FINAL_EXAM_AVAILABLE', 'ENROLL_AVAILABLE', 'ENROLL_AVAILABLE', 'ENROLL_AVAILABLE'] },
      { statuses: ['APPROVED', 'FINAL_EXAM_PENDING', 'APPROVED', 'PENDING'], availabilities: ['ENROLL_AVAILABLE', 'FINAL_EXAM_AVAILABLE', 'ENROLL_AVAILABLE', 'ENROLL_AVAILABLE', 'FINAL_EXAM_AVAILABLE', 'ENROLL_AVAILABLE'] },
      { statuses: ['FINAL_EXAM_PENDING', 'APPROVED', 'APPROVED', 'PENDING'], availabilities: ['ENROLL_AVAILABLE', 'ENROLL_AVAILABLE', 'FINAL_EXAM_AVAILABLE', 'ENROLL_AVAILABLE', 'FINAL_EXAM_AVAILABLE', 'ENROLL_AVAILABLE'] },
      // Both APPROVED -> edge FINAL_EXAM_AVAILABLE
      { statuses: ['APPROVED', 'APPROVED', 'PENDING', 'PENDING'], availabilities: ['FINAL_EXAM_AVAILABLE', 'FINAL_EXAM_AVAILABLE', 'FINAL_EXAM_AVAILABLE', 'FINAL_EXAM_AVAILABLE', 'NOT_AVAILABLE', 'NOT_AVAILABLE'] },
      { statuses: ['APPROVED', 'APPROVED', 'PENDING', 'FINAL_EXAM_PENDING'], availabilities: ['FINAL_EXAM_AVAILABLE', 'FINAL_EXAM_AVAILABLE', 'FINAL_EXAM_AVAILABLE', 'FINAL_EXAM_AVAILABLE', 'NOT_AVAILABLE', 'NOT_AVAILABLE'] },
      { statuses: ['APPROVED', 'APPROVED', 'PENDING', 'APPROVED'], availabilities: ['FINAL_EXAM_AVAILABLE', 'FINAL_EXAM_AVAILABLE', 'FINAL_EXAM_AVAILABLE', 'FINAL_EXAM_AVAILABLE', 'NOT_AVAILABLE', 'NOT_AVAILABLE'] },
      { statuses: ['APPROVED', 'APPROVED', 'FINAL_EXAM_PENDING', 'PENDING'], availabilities: ['FINAL_EXAM_AVAILABLE', 'FINAL_EXAM_AVAILABLE', 'FINAL_EXAM_AVAILABLE', 'FINAL_EXAM_AVAILABLE', 'ENROLL_AVAILABLE', 'ENROLL_AVAILABLE'] },
      { statuses: ['APPROVED', 'APPROVED', 'FINAL_EXAM_PENDING', 'FINAL_EXAM_PENDING'], availabilities: ['FINAL_EXAM_AVAILABLE', 'FINAL_EXAM_AVAILABLE', 'FINAL_EXAM_AVAILABLE', 'FINAL_EXAM_AVAILABLE', 'ENROLL_AVAILABLE', 'ENROLL_AVAILABLE'] },
      { statuses: ['APPROVED', 'APPROVED', 'FINAL_EXAM_PENDING', 'APPROVED'], availabilities: ['FINAL_EXAM_AVAILABLE', 'FINAL_EXAM_AVAILABLE', 'FINAL_EXAM_AVAILABLE', 'FINAL_EXAM_AVAILABLE', 'ENROLL_AVAILABLE', 'ENROLL_AVAILABLE'] },
      { statuses: ['APPROVED', 'APPROVED', 'APPROVED', 'PENDING'], availabilities: ['FINAL_EXAM_AVAILABLE', 'FINAL_EXAM_AVAILABLE', 'FINAL_EXAM_AVAILABLE', 'FINAL_EXAM_AVAILABLE', 'FINAL_EXAM_AVAILABLE', 'FINAL_EXAM_AVAILABLE'] },
      { statuses: ['APPROVED', 'APPROVED', 'APPROVED', 'FINAL_EXAM_PENDING'], availabilities: ['FINAL_EXAM_AVAILABLE', 'FINAL_EXAM_AVAILABLE', 'FINAL_EXAM_AVAILABLE', 'FINAL_EXAM_AVAILABLE', 'FINAL_EXAM_AVAILABLE', 'FINAL_EXAM_AVAILABLE'] },
      { statuses: ['APPROVED', 'APPROVED', 'APPROVED', 'APPROVED'], availabilities: ['FINAL_EXAM_AVAILABLE', 'FINAL_EXAM_AVAILABLE', 'FINAL_EXAM_AVAILABLE', 'FINAL_EXAM_AVAILABLE', 'FINAL_EXAM_AVAILABLE', 'FINAL_EXAM_AVAILABLE'] },
    ];

    testCases.forEach(({ statuses: [ayedStatus, mdStatus, adcStatus, soStatus], availabilities: [edgeAvailability, ayedArrow, mdArrow, linkSoArrow, adCSoArrow, soAvailability] }) => {
      it(`renders with AyED=${ayedStatus}, MD=${mdStatus}, AdC=${adcStatus}`, () => {
        const testSubjects = subjects(
          ['5', ayedStatus],
          ['3', mdStatus],
          ['6', adcStatus],
          ['15', soStatus],
        );
        const testEdges = edges(['MD,AyED:SSL,PdP,SO'], ['5', '3', '6', '15']);

        const graph = new Graph(config, testSubjects, testEdges);
        const drawer = createMockDrawer();
        graph.render(drawer);

        // Should draw 4 circles (subjects) + 1 diamond (edge)
        expect(drawer.shapes.circles).toHaveLength(4);
        expect(drawer.shapes.diamonds).toHaveLength(1);

        // Check edge node border
        expect(drawer.shapes.diamonds).toContainEqual({
          id: 'MD,AyED:SSL,PdP,SO',
          position: { x: 100, y: 500 },
          borderColor: availabilityColor(edgeAvailability),
        });

        // Should draw 4 arrows: AyED->link8, MD->link8, link8->SO, AdC->SO
        expect(drawer.shapes.arrows).toHaveLength(4);
        expect(drawer.shapes.arrows).toContainEqual({
          id: '5-MD,AyED:SSL,PdP,SO',
          from: '5',
          to: 'MD,AyED:SSL,PdP,SO',
          color: availabilityColor(ayedArrow),
        });
        expect(drawer.shapes.arrows).toContainEqual({
          id: '3-MD,AyED:SSL,PdP,SO',
          from: '3',
          to: 'MD,AyED:SSL,PdP,SO',
          color: availabilityColor(mdArrow),
        });
        expect(drawer.shapes.arrows).toContainEqual({
          id: 'MD,AyED:SSL,PdP,SO-15',
          from: 'MD,AyED:SSL,PdP,SO',
          to: '15',
          color: availabilityColor(linkSoArrow),
        });
        expect(drawer.shapes.arrows).toContainEqual({
          id: '6-15',
          from: '6',
          to: '15',
          color: availabilityColor(adCSoArrow),
        });

        // Check SO border color
        const soCircle = drawer.shapes.circles.find(c => c.label === 'SO');
        expect(soCircle).toBeDefined();
        expect(soCircle?.borderColor).toBe(availabilityColor(soAvailability));
      });
    });
  });

  describe('Invisible edge nodes (11 -> link -> link -> link -> link -> TdC)', () => {
    // Chain of 1:1 edge nodes that should use drawEdge (invisible) instead of drawDiamond
    // F2 -> link -> link -> link -> link -> TdC
    // Focus: edge nodes use drawEdge (not drawDiamond) and arrows connect through chain
    it('uses drawEdge for 1:1 edge nodes and draws arrows through chain', () => {
      const testSubjects = subjects(
        ['11', 'APPROVED'],
        ['30', 'PENDING'],
      );
      const testEdges = edges(['F2:TdC:1', 'F2:TdC:2', 'F2:TdC:3', 'F2:TdC:4'], ['11', '30']);

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
        expect.arrayContaining(['11-F2:TdC:1', 'F2:TdC:1-F2:TdC:2', 'F2:TdC:2-F2:TdC:3', 'F2:TdC:3-F2:TdC:4', 'F2:TdC:4-30'])
      );
    });
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
        shortName: 'A',
        status: 'APPROVED',
        prerequisites: [
          { availabilityId: 'FINAL_EXAM_AVAILABLE', dependencies: [{ statusId: 'APPROVED', subjects: ['B'] }] },
        ],
        position: { x: 100, y: 100 },
      },
      {
        id: 'B',
        name: 'Subject B',
        shortName: 'B',
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
