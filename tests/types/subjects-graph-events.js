/** Static-only fixture: this function is checked by tsc and is never executed. */
/** @param {import('~/lib/subjects-graph/index.js').SubjectsGraph} graph */
export function checkEventSubscriptions(graph) {
  graph.addEventListener('statusrequest', event => {
    event.detail.subjectId.toUpperCase();
    event.detail.nextStatusId.toUpperCase();
    // @ts-expect-error Status requests have no position.
    event.detail.position;
  }, { once: true, signal: new AbortController().signal });

  graph.addEventListener('nodepositionrequest', event => {
    event.detail.nodeId.toUpperCase();
    event.detail.position.x.toFixed();
    // @ts-expect-error Position requests have no next status.
    event.detail.nextStatusId;
  }, true);

  graph.addEventListener('editrequest', event => {
    const detail = event.detail;
    if (detail.kind === 'subject' || detail.kind === 'connector') {
      detail.nodeId.toUpperCase();
      // @ts-expect-error Node edit requests have no position.
      detail.position;
    } else if (detail.kind === 'connection') {
      detail.sourceId.toUpperCase();
      detail.targetId.toUpperCase();
      detail.position.y.toFixed();
      // @ts-expect-error Connections do not carry a node ID.
      detail.nodeId;
    } else if (detail.kind === 'background') {
      detail.position.x.toFixed();
      // @ts-expect-error Background requests have no source ID.
      detail.sourceId;
    }
  });

  /** @type {import('~/lib/subjects-graph/index.js').SubjectsGraphEventListener<'statusrequest'>} */
  const listener = event => { event.detail.subjectId.toUpperCase(); };
  graph.addEventListener('statusrequest', listener, false);
  graph.removeEventListener('statusrequest', listener, { capture: false });
  // @ts-expect-error Event names are restricted to the public event map.
  graph.addEventListener('tap', listener);
  // @ts-expect-error Event names are restricted on removal too.
  graph.removeEventListener('tap', listener);
  // @ts-expect-error Status listeners do not accept position requests.
  graph.addEventListener('nodepositionrequest', listener);
}
