/**
 * @typedef {object} Variant
 * @property {string} name
 * @property {Array<Status>} statuses
 * @property {Array<Availability>} availabilities
 * @property {Array<Omit<Subject, 'status'>>} subjects
 * @property {Array<Edge>} edges
 *
 * @typedef {object} Config
 * @property {Array<Status>} statuses
 * @property {Array<Availability>} availabilities
 *
 * @typedef {object} Edge
 * @property {string} id
 * @property {Position} position
 * @property {Array<string>} dependencies
 * @property {Array<string>} targets
 *
 * @typedef {object} Subject
 * @property {string} id
 * @property {string} name
 * @property {string} shortName
 * @property {Position} position
 * @property {StatusId} status
 * @property {Array<Prerequisite>} prerequisites
 * @property {boolean} [hideDependencies]
 *
 * @typedef {object} Prerequisite
 * @property {AvailabilityId} availabilityId
 * @property {Array<Dependency>} dependencies
 *
 * @typedef {object} Dependency
 * @property {StatusId} statusId
 * @property {Array<string>} subjects
 *
 * @typedef {object} Availability
 * @property {AvailabilityId} id
 * @property {string} name
 * @property {string} color
 *
 * @typedef {object} Status
 * @property {StatusId} id
 * @property {string} name
 * @property {string} color
 * @property {string} textColor
 * @property {string} [leafTextColor]
 *
 * @typedef {string} StatusId
 *
 * @typedef {string} AvailabilityId
 *
 * ---
 *
 * @typedef {object} Drawer
 * @property {(params: Circle) => void} drawCircle
 * @property {(params: Diamond) => void} drawDiamond
 * @property {(params: Hidden) => void} drawEdge
 * @property {(params: Arrow) => void} drawArrow
 *
 * @typedef {object} Arrow
 * @property {string} id
 * @property {string} from
 * @property {string} to
 * @property {string} color
 *
 * @typedef {object} Hidden
 * @property {string} id
 * @property {Position} position
 *
 * @typedef {object} Diamond
 * @property {string} id
 * @property {Position} position
 * @property {string} borderColor
 *
 * @typedef {object} Circle
 * @property {string} id
 * @property {string} label
 * @property {StatusId} status
 * @property {string} tooltip
 * @property {Position} position
 * @property {string} fillColor
 * @property {string} borderColor
 * @property {string} textColor
 *
 * @typedef {object} Position
 * @property {number} x
 * @property {number} y
 */

export class Graph {
  /** @type {Config} */
  #config;

  /** @type {Map<string, AbstractNode>} */
  #nodes;

  /**
   * @param {Config} config
   * @param {Array<Subject>} subjects
   * @param {Array<Edge>} edges
   */
  constructor(config, subjects, edges) {
    this.#config = config;
    this.#nodes = new Map();
    for (const subject of subjects) {
      this.#addSubject(subject);
    }
    for (const edge of edges) {
      this.#addEdge(edge);
    }
    this.#calculateDependencies();
  }

  /**
   * Creates and adds a subject node to the graph.
   * @param {Subject} subject
   */
  #addSubject(subject) {
    if (this.#nodes.has(subject.id)) {
      console.warn(`Node with ID ${subject.id} already exists in the graph.`);
      return;
    }
    this.#nodes.set(subject.id, new SubjectNode(this.#config, subject));
  }

  /**
   * Creates and adds an edge node.
   * @param {Edge} edge
   */
  #addEdge(edge) {
    if (this.#nodes.has(edge.id)) {
      console.warn(`Node with ID ${edge.id} already exists in the graph.`);
      return;
    }
    this.#nodes.set(edge.id, new EdgeNode(this.#config, edge));
  }

  /**
   * Calculates all dependencies in the graph based on subjects and edges.
   */
  #calculateDependencies() {
    for (const node of this.#nodes.values()) {
      node.calculateDependencies(this);
    }
    for (const node of this.#nodes.values()) {
      node.simplifyTransitiveDependencies();
    }
    for (const node of this.#nodes.values()) {
      node.calculateLeafDependencies();
    }
  }

  /**
   * @param {string} id
   * @return {AbstractNode | null}
   */
  getNodeById(id) {
    return this.#nodes.get(id) ?? null;
  }

  /**
   * Renders the entire graph.
   * @param {Drawer} drawer
   */
  render(drawer) {
    for (const node of this.#nodes.values()) {
      node.renderNode(drawer);
    }
    for (const node of this.#nodes.values()) {
      node.renderLinks(drawer);
    }
  }

  /**
   * Toggle the status of a node by id (if supported).
   * @param {string} id
   */
  toggleStatus(id) {
    this.getNodeById(id)?.toggleStatus();
  }
}

/**
 * @abstract
 */
class AbstractNode {
  /** @type {Config} */
  #config;

  /** @type {Set<AbstractNode>} */
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

  /**
   * @param {AbstractNode} node
   */
  addDependency(node) {
    this.#dependencies.add(node);
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
    for (const node of Array.from(this.#dependencies)) {
      // Temporarily remove the link
      this.#dependencies.delete(node);
      if (this.#dependsOn(node)) {
        continue; // This link is redundant
      }
      this.#dependencies.add(node); // Keep the link if it's not redundant
    }
  }

  /**
   * Toggles the leaf status off for all dependencies.
   * A leaf node is a node that no other node depends on.
   * This can only be determined after all links are established.
   */
  calculateLeafDependencies() {
    for (const node of this.#dependencies) {
      node.untoggleLeaf();
    }
  }

  /**
   * Toggles the leaf status off.
   * A leaf node is a node that no other node depends on.
   * This can only be determined after all links are established.
   */
  untoggleLeaf() {}

  /**
   * @param {AbstractNode} node
   * @param {Set<AbstractNode>} [visited=new Set()]
   * @returns {boolean}
   */
  #dependsOn(node, visited = new Set()) {
    if (this === node) return true;
    if (visited.has(this)) return false;
    visited.add(this);
    return Array.from(this.#dependencies)
      .some(dependency => dependency.#dependsOn(node, visited));
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
    for (const node of this.#dependencies) {
      drawer.drawArrow({
        id: `${node.id}-${this.id}`,
        from: node.id,
        to: this.id,
        color: this.getAvailability(node.getAllSubjectIds()).color,
      });
    }
  }

  /**
   * Gets the availability status of the node based on its prerequisites.
   * @param {Set<string>} [subjectIds=new Set()] - Subgroup of subjects to consider. If empty, consider all.
   * @returns {Availability}
   */
  getAvailability(subjectIds = new Set()) {
    throw new Error('Method getAvailability() must be implemented in subclasses');
  }

  /**
   * Checks if this node satisfies the given subject and status.
   * @param {string} subjectId
   * @param {StatusId} statusId
   * @param {Set<AbstractNode>} [visited=new Set()]
   * @returns {boolean}
   */
  satisfies(subjectId, statusId, visited = new Set()) {
    if (visited.has(this)) return false;
    visited.add(this);
    return Array.from(this.#dependencies)
      .some(node => node.satisfies(subjectId, statusId, visited));
  }

  /**
   * Gets all subject ids this node depends on.
   * @returns {Set<string>}
   */
  getAllSubjectIds(visited = new Set()) {
    if (visited.has(this)) {
      return new Set();
    }

    visited.add(this);

    const result = new Set();

    this.#dependencies
      .forEach(node => node.getAllSubjectIds(visited)
      .forEach(subj => result.add(subj)));

    return result;
  }

  /**
   * Toggle the status of this node (default: no-op).
   */
  toggleStatus() {}
}

class SubjectNode extends AbstractNode {
  /** @type {Config} */
  #config;

  /** @type {Subject} */
  #data;

  /** @type {boolean} */
  #isLeaf = true;

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
          this.addDependency(targetNode);
        } else {
          console.warn(`Subject with ID ${subjectId} not found in graph.`);
        }
      });
  }

  /**
   * Toggles the leaf status off.
   * A leaf node is a node that no other node depends on.
   * This can only be determined after all links are established.
   */
  untoggleLeaf() {
    this.#isLeaf = false;
  }

  /**
   * Renders the node (shape only). Links are rendered separately by
   * `renderLinks` to allow graphs to draw nodes first and arrows later.
   * @param {Drawer} drawer
   */
  renderNode(drawer) {
    const statusIndex = this.#config.statuses.findIndex(s => s.id === this.#data.status);
    const status = this.#config.statuses[statusIndex] ?? this.#config.statuses[0];
    drawer.drawCircle({
      id: this.#data.id,
      label: this.#data.shortName,
      tooltip: this.#data.name,
      position: this.#data.position,
      status: status.id,
      fillColor: status.color,
      borderColor: this.getAvailability().color,
      textColor: this.#isLeaf ? status.leafTextColor ?? status.textColor : status.textColor,
    });
  }

  /**
   * Gets the availability status of the node based on its prerequisites.
   * @param {Set<string>} [subjectIds=new Set()] - Subgroup of subjects to consider. If empty, consider all.
   * @returns {Availability}
   */
  getAvailability(subjectIds = this.getAllSubjectIds()) {
    let last = this.#config.availabilities[0];

    for (const a of this.#config.availabilities) {
      const isSatisfied = this.#data.prerequisites
        .filter(p => p.availabilityId === a.id)
        .every(p => p.dependencies.every(d => d.subjects
          .filter(subjectId => subjectIds.has(subjectId))
          .every(subjectId => this.satisfies(subjectId, d.statusId))
        ));

      if (!isSatisfied) {
        break;
      }

      last = a;
    }

    return last;
  }

  /**
   * @param {string} subjectId
   * @param {StatusId} statusId
   * @param {Set<AbstractNode>} [visited=new Set()]
   */
  satisfies(subjectId, statusId, visited = new Set()) {
    if (this.#data.id === subjectId) {
      return this.#config.statuses.findIndex(s => s.id === this.#data.status) >=
             this.#config.statuses.findIndex(s => s.id === statusId);
    }

    return super.satisfies(subjectId, statusId, visited);
  }

  /**
   * @returns {Set<string>}
   */
  getAllSubjectIds(visited = new Set()) {
    return super.getAllSubjectIds(visited).add(this.#data.id);
  }

  /**
   * Toggle the status of this subject node.
   */
  toggleStatus() {
    const currentIndex = this.#config.statuses.findIndex(s => s.id === this.#data.status);
    const nextIndex = (currentIndex + 1) % this.#config.statuses.length;
    this.#data.status = this.#config.statuses[nextIndex].id;
  }

  /**
   * Renders only the node's links (arrows).
   * @param {Drawer} drawer
   */
  renderLinks(drawer) {
    if (this.#data.hideDependencies) {
      return;
    }
    super.renderLinks(drawer);
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

  /**
   * @param {Graph} graph
   */
  calculateDependencies(graph) {
    this.#data.dependencies.forEach(sourceId => {
      const sourceNode = graph.getNodeById(sourceId);
      if (sourceNode) {
        this.addDependency(sourceNode);
      } else {
        console.warn(`Edge dependency with ID ${sourceId} not found in graph.`);
      }
    });
    this.#data.targets.forEach(targetId => {
      const targetNode = graph.getNodeById(targetId);
      if (targetNode) {
        targetNode.addDependency(this);
        this.#targets.push(targetNode);
      } else {
        console.warn(`Edge target with ID ${targetId} not found in graph.`);
      }
    });
  }

  /**
   * Renders the node (shape only). Links are rendered separately by
   * `renderLinks` to allow graphs to draw nodes first and arrows later.
   * @param {Drawer} drawer
   */
  renderNode(drawer) {
    // Use drawEdge for 1:1 edges (invisible), drawDiamond for many-to-many
    if (this.#data.dependencies.length === 1 && this.#targets.length === 1) {
      drawer.drawEdge({
        id: this.#data.id,
        position: this.#data.position,
      });
      return;
    }

    drawer.drawDiamond({
      id: this.#data.id,
      position: this.#data.position,
      borderColor: this.getAvailability().color,
    });
  }

  /**
   * Gets the availability status of the node based on its prerequisites.
   * @param {Set<string>} [subjectIds=new Set()] - Subgroup of subjects to consider. If empty, consider all.
   * @returns {Availability}
   */
  getAvailability(subjectIds = this.getAllSubjectIds()) {
    const targetAvailabilities = this.#targets
      .map(t => t.getAvailability(subjectIds))
      .map(a => this.#config.availabilities.indexOf(a));

    return this.#config.availabilities[Math.min(...targetAvailabilities)];
  }
}
