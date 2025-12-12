/**
 * @typedef {string} AvailabilityId
 *
 * @typedef {string} StatusId
 *
 * @typedef {object} Subject
 * @property {string} id
 * @property {string} name
 * @property {Position} position
 * @property {StatusId} status
 * @property {Array<Prerequisite>} prerequisites
 *
 * @typedef {object} Prerequisite
 * @property {AvailabilityId} availabilityId
 * @property {Array<Dependency>} dependencies
 *
 * @typedef {object} Dependency
 * @property {StatusId} statusId
 * @property {Array<string>} subjects
 *
 * @typedef {object} Edge
 * @property {string} id
 * @property {Position} position
 * @property {Array<string>} dependencies
 * @property {Array<string>} targets
 *
 * @typedef {object} Config
 * @property {Array<Status>} statuses
 * @property {Array<Availability>} availabilities
 *
 * @typedef {object} Status
 * @property {StatusId} id
 * @property {string} name
 * @property {string} color
 *
 * @typedef {object} Availability
 * @property {AvailabilityId} id
 * @property {string} name
 * @property {string} color
 *
 * @typedef {object} Position
 * @property {number} x
 * @property {number} y
 *
 * @interface Drawer
 * @method drawCircle
 * @method drawDiamond
 * @method drawArrow
 */

class Graph {
  /** @type {Config} */
  #config;

  /** @type {Map<string, SubjectNode>} */
  #subjects;

  /** @type {Map<string, EdgeNode>} */
  #edges;

  /**
   * @param {Config} config
   * @param {Array<Subject>} subjects
   * @param {Array<Edge>} edges
   */
  constructor(config, subjects, edges) {
    this.#config = config;
    this.#subjects = new Map();
    this.#edges = new Map();
    subjects.forEach(subject => this.#addSubject(subject));
    edges.forEach(edge => this.#addEdge(edge));
    this.#calculateDependencies();
  }

  get #nodes() {
    return [...this.#subjects.values(), ...this.#edges.values()];
  }

  /**
   * Creates and adds a subject node to the graph.
   * @param {Subject} subject
   */
  #addSubject(subject) {
    if (this.#subjects.has(subject.id)) {
      console.warn(`Subject with ID ${subject.id} already exists in the graph.`);
      return;
    }
    this.#subjects.set(subject.id, new SubjectNode(this.#config, subject));
  }

  /**
   * Creates and adds an edge node.
   * @param {Edge} edge
   */
  #addEdge(edge) {
    if (this.#edges.has(edge.id)) {
      console.warn(`Edge with ID ${edge.id} already exists in the graph.`);
      return;
    }
    this.#edges.set(edge.id, new EdgeNode(this.#config, edge));
  }

  /**
   * Calculates all dependencies in the graph based on subjects and edges.
   */
  #calculateDependencies() {
    for (const node of this.#nodes) {
      node.calculateDependencies(this);
    }
    for (const node of this.#nodes) {
      node.simplifyTransitiveDependencies();
    }
  }

  /**
   * Gets a node by its ID.
   * @param {string} id
   * @return {AbstractNode | null}
   */
  getNodeById(id) {
    if (this.#subjects.has(id)) {
      return this.#subjects.get(id);
    }
    if (this.#edges.has(id)) {
      return this.#edges.get(id);
    }
    return null;
  }

  /**
   * Renders the entire graph.
   * @param {Drawer} drawer
   */
  render(drawer) {
    for (const node of this.#nodes) {
       node.renderNode(drawer);
    }
    for (const node of this.#nodes) {
      node.renderLinks(drawer);
    }
  }
}

/**
 * @abstract
 */
class AbstractNode {
  /** @type {Config} */
  #config;

  /** @type {Set<Link>} */
  #dependencies;

  /**
   * @param {Config} config
   */
  constructor(config) {
    if (new.target === AbstractNode) {
      throw new TypeError('Cannot instantiate AbstractNode');
    }
    this.#config = config;
    this.#dependencies = new Set();
  }

  /** @returns {string} */
  get id() {
    throw new Error('Getter id() must be implemented in subclasses');
  }

  /** @returns {Position} */
  get position() {
    throw new Error('Getter position() must be implemented in subclasses');
  }

  /**
   * @param {AbstractNode} node
   * @protected
   */
  _addDependency(node) {
    this.#dependencies.add(new Link(this.#config, node, this));
  }

  /**
   * @param {Graph} graph
   */
  calculateDependencies(graph) {
    throw new Error('Method calculateDependencies() must be implemented in subclasses');
  }

  /**
   * Simplifies graph by removing redundant direct dependencies.
   * A direct dependency is considered redundant if there exists an indirect
   * path to the same target node.
   */
  simplifyTransitiveDependencies() {
    // Work on a snapshot of current links to avoid mutating during iteration
    for (const link of Array.from(this.#dependencies)) {
      // Temporarily remove the link
      this.#dependencies.delete(link);
      if (this.#dependsOn(link.from)) {
        continue; // This link is redundant
      }
      this.#dependencies.add(link); // Keep the link if it's not redundant
    }
  }

  /**
   * @param {AbstractNode} node
   * @param {Set<AbstractNode>} [visited=new Set()]
   * @returns {boolean}
   */
  #dependsOn(node, visited = new Set()) {
    if (this === node) return true;
    if (visited.has(this)) return false;
    visited.add(this);
    return Array.from(this.#dependencies).some(link => link.from.#dependsOn(node, visited));
  }

  /**
   * Renders the node (shape only). Links are rendered separately by
   * `renderLinks` to allow graphs to draw nodes first and arrows later.
   * @param {Drawer} drawer
   */
  renderNode(drawer) {
    throw new Error('Method renderNode() must be implemented in subclasses');
  }

  /**
   * Renders only the node's links (arrows).
   * @param {Drawer} drawer
   */
  renderLinks(drawer) {
    for (const link of this.#dependencies) {
      link.render(drawer);
    }
  }

  /**
   * Gets the availability status of the node based on its prerequisites.
   * @param {Array<string>} [subjects=[]] - Subgroup of subjects to consider. If empty, consider all.
   * @returns {Availability}
   */
  getAvailability(subjects = []) {
    throw new Error('Method getAvailability() must be implemented in subclasses');
  }

  /**
   * Gets the prerequisites for a specific availability level.
   * @param {string} availabilityId
   * @returns {Array<Prerequisite>}
   */
  getPrerequisitesById(availabilityId) {
    throw new Error('Method getPrerequisitesById() must be implemented in subclasses');
  }

  /**
   * Checks if this node satisfies the given subject and status.
   * @param {string} subjectId
   * @param {StatusId} statusId
   */
  satisfies(subjectId, statusId) {
    return Array.from(this.#dependencies)
      .some(link => link.from.satisfies(subjectId, statusId));
  }

  /**
   * Gets all subjects this node depends on.
   * @returns {Set<Subject>}
   */
  getAllSubjects(visited = new Set()) {
    if (visited.has(this)) return new Set();
    visited.add(this);

    const result = new Set();
    for (const link of this.#dependencies) {
      const subjSet = link.from.getAllSubjects(visited);
      for (const subj of subjSet) result.add(subj);
    }
    return result;
  }
}

class SubjectNode extends AbstractNode {
  /** @type {Config} */
  #config;

  /** @type {Subject} */
  #data;

  /**
   * @param {Config} config
   * @param {Subject} data
   */
  constructor(config, data) {
    super(config);
    this.#config = config;
    this.#data = data;
  }

  get id() {
    return this.#data.id;
  }

  get position() {
    return this.#data.position;
  }

  /**
   * @param {Graph} graph
   */
  calculateDependencies(graph) {
    this.#data.prerequisites
      .flatMap(prerequisite => prerequisite.dependencies)
      .flatMap(dependency => dependency.subjects)
      .forEach(subjectId => {
        const targetNode = graph.getNodeById(subjectId);
        if (targetNode) {
          this._addDependency(targetNode);
        } else {
          console.warn(`Subject with ID ${subjectId} not found in graph.`);
        }
      });
  }

  /**
   * Renders the node and its links.
   * @param {Drawer} drawer
   */
  /**
   * Renders the node (shape only). Links are rendered separately by
   * `renderLinks` to allow graphs to draw nodes first and arrows later.
   * @param {Drawer} drawer
   */
  renderNode(drawer) {
    const status = this.#config.statuses.find(s => s.id === this.#data.status);
    const availability = this.getAvailability();

    if (!status || !availability) {
      console.warn(`Status or availability not found for subject ID ${this.#data.id}.`);
      return;
    }

    drawer.drawCircle({
      label: this.#data.id,
      tooltip: this.#data.name,
      position: this.#data.position,
      fillColor: status.color,
      borderColor: availability.color,
    });
  }

  /**
   * Gets the availability status of the node based on its prerequisites.
   * @param {Array<string>} [subjects=[]] - Subgroup of subjects to consider. If empty, consider all.
   * @returns {Availability}
   */
  getAvailability(subjects = []) {
    return this.#config.availabilities.findLast(a => {
      const p = this.#data.prerequisites.find(pr => pr.availabilityId === a.id);
      return (p?.dependencies ?? []).every(d =>
        d.subjects
          .filter(subjectId => subjects.length === 0 || subjects.includes(subjectId))
          .every(subjectId => this.satisfies(subjectId, d.statusId))
      );
    })
  }

  /**
   * @param {string} subjectId
   * @param {Subject} statusId
   */
  satisfies(subjectId, statusId) {
    if (this.#data.id === subjectId) {
      return this.#config.statuses.findIndex(s => s.id === this.#data.status) >=
             this.#config.statuses.findIndex(s => s.id === statusId);
    }

    return super.satisfies(subjectId, statusId);
  }

  /**
   * @returns {Array<Subject>}
   */
  getAllSubjects(visited = new Set()) {
    const set = new Set([this.#data]);
    for (const subj of super.getAllSubjects(visited)) set.add(subj);
    return set;
  }

  /**
   * @param {string} availabilityId
   * @returns {Array<Prerequisite>}
   */
  getPrerequisitesById(availabilityId) {
    const prereq = this.#data.prerequisites.find(p => p.availabilityId === availabilityId);
    return prereq ? [prereq] : [];
  }
}

class EdgeNode extends AbstractNode {
  /** @type {Config} */
  #config;

  /** @type {Edge} */
  #data;

  /** @type {Array<AbstractNode>} */
  #targets;

  /**
   * @param {Config} config
   * @param {Edge} data
   */
  constructor(config, data) {
    super(config);
    this.#config = config;
    this.#data = data;
    this.#targets = [];
  }

  get id() {
    return this.#data.id;
  }

  get position() {
    return this.#data.position;
  }

  /**
   * @param {Graph} graph
   */
  calculateDependencies(graph) {
    this.#data.dependencies.forEach(sourceId => {
      const sourceNode = graph.getNodeById(sourceId);
      if (sourceNode) {
        this._addDependency(sourceNode);
      } else {
        console.warn(`Edge dependency with ID ${sourceId} not found in graph.`);
      }
    });
    this.#data.targets.forEach(targetId => {
      const targetNode = graph.getNodeById(targetId);
      if (targetNode) {
        this.#targets.push(targetNode);
        targetNode._addDependency(this);
      } else {
        console.warn(`Edge target with ID ${targetId} not found in graph.`);
      }
    });
  }

  /**
   * Renders the node and its links.
   * @param {Drawer} drawer
   */
  /**
   * Renders the node (shape only). Links are rendered separately by
   * `renderLinks` to allow graphs to draw nodes first and arrows later.
   * @param {Drawer} drawer
   */
  renderNode(drawer) {
    const availability = this.getAvailability();
    if (!availability) {
      console.warn(`Availability not found for edge ID ${this.#data.id}.`);
      return;
    }

    drawer.drawDiamond({
      id: this.#data.id,
      position: this.#data.position,
      borderColor: availability.color,
    });
  }

  /**
   * Gets the availability status of the node based on its prerequisites.
   * @param {Array<string>} [subjects=[]] - Subgroup of subjects to consider. If empty, consider all.
   * @returns {Availability}
   */
  getAvailability(subjects = []) {
    return this.#config.availabilities.findLast(a =>
      this.#targets.every(target =>
        target.getAvailability(subjects)?.id === a.id
      )
    );
  }

  /**
   * Gets the combined prerequisites for a specific availability level from all targets.
   * @param {string} availabilityId
   * @returns {Array<Prerequisite>}
   */
  getPrerequisitesById(availabilityId) {
    return this.#targets.flatMap(target => target.getPrerequisitesById(availabilityId));
  }
}

class Link {
  /** @type {Config} */
  #config;

  /** @type {AbstractNode} */
  from;

  /** @type {AbstractNode} */
  #to;

  /**
   * Creates a link between two nodes.
   * The drawn arrow points from 'from' dependency to 'to' target.
   * @param {Config} config
   * @param {AbstractNode} from
   * @param {AbstractNode} to
   */
  constructor(config, from, to) {
    this.#config = config;
    this.from = from;
    this.#to = to;
  }

  /**
   * Renders the node and its links.
   * @param {Drawer} drawer
   */
  render(drawer) {
    const availability = this.#getAvailability();
    if (!availability) {
      console.warn('Availability not found for link rendering.');
      return;
    }

    const edgeId = `${this.from.id}-${this.#to.id}`;
    if (!this.from.id || !this.#to.id) {
      console.warn('Cannot render link: missing fromId or toId.', { fromId: this.from.id, toId: this.#to.id });
      return;
    }

    drawer.drawArrow({ id: edgeId, from: this.from.id, to: this.#to.id, color: availability.color });
  }

  /**
   * Get the availability that the source contributes to the target.
   * Arrow color reflects what the source provides, not the target's overall availability.
   */
  #getAvailability() {
    const sourceSubjects = Array.from(this.from.getAllSubjects());
    
    // Find the highest availability that the source satisfies for the target
    const result = this.#config.availabilities.findLast(availability => {
      // Get the target's prerequisites for this availability level (may be multiple for EdgeNode)
      const prereqsList = this.#to.getPrerequisitesById(availability.id);
      if (prereqsList.length === 0) return false;
      
      // Check if source subjects satisfy their required statuses in ALL prerequisites
      return prereqsList.every(prereqs =>
        prereqs.dependencies.every(dep =>
          dep.subjects
            .filter(subjectId => sourceSubjects.some(s => s.id === subjectId))
            .every(subjectId => {
              const sourceSubject = sourceSubjects.find(s => s.id === subjectId);
              return this.#config.statuses.findIndex(s => s.id === sourceSubject.status) >=
                     this.#config.statuses.findIndex(s => s.id === dep.statusId);
            })
        )
      );
    });
    
    // If no availability matched, return the lowest (INACTIVE)
    return result ?? this.#config.availabilities[0];
  }
}

// CommonJS export (guarded) so this module is testable in Node environments.
if (typeof module !== 'undefined' && module.exports) {
  module.exports = { Graph, SubjectNode, EdgeNode, AbstractNode, Link };
}
