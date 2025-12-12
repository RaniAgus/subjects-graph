/**
 * @typedef {string} AvailabilityId
 *
 * @typedef {string} StatusId
 *
 * @typedef {object} Subject
 * @property {string} id
 * @property {string} name
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
 */

class Graph {
  constructor() {
    /** @type {Map<string, SubjectNode>} */
    this.subjects = new Map();
    /** @type {Map<string, EdgeNode>} */
    this.edges = new Map();
  }

  get nodes() {
    return [...this.subjects.values(), ...this.edges.values()];
  }

  /**
   * Creates and adds a subject node to the graph.
   * @param {Subject} subject
   * @return {SubjectNode}
   */
  addSubject(subject) {
    if (!this.subjects.has(subject.id)) {
      this.subjects.set(subject.id, new SubjectNode(subject));
    }
    return this.subjects.get(subject.id);
  }

  /**
   * Creates and adds an edge node.
   * @param {Edge} edge
   * @return {EdgeNode}
   */
  addEdge(edge) {
    if (!this.edges.has(edge.id)) {
      this.edges.set(edge.id, new EdgeNode(edge));
    }
    return this.edges.get(edge.id);
  }

  /**
   * Calculates all dependencies in the graph based on subjects and edges.
   */
  calculateDependencies() {
    for (const node of this.nodes) {
      node.calculateDependencies(this);
    }
    for (const node of this.nodes) {
      node.simplifyTransitiveDependencies();
    }
  }

  /**
   * Gets a node by its ID.
   * @param {string} id
   * @return {AbstractNode | null}
   */
  getNodeById(id) {
    if (this.subjects.has(id)) {
      return this.subjects.get(id);
    }
    if (this.edges.has(id)) {
      return this.edges.get(id);
    }
    return null;
  }
}

/**
 * @abstract
 */
class AbstractNode {
  constructor() {
    if (new.target === AbstractNode) {
      throw new TypeError('Cannot instantiate AbstractNode');
    }
    /** @type {Set<Link>} */
    this.dependencies = new Set();
  }

  /**
   * Simplifies graph by removing redundant direct dependencies.
   * A direct dependency is considered redundant if there exists an indirect
   * path to the same target node.
   */
  simplifyTransitiveDependencies() {
    for (const link of this.dependencies) {
      // Temporarily remove the link
      this.dependencies.delete(link);
      if (this.#dependsOn(link.to)) {
        continue; // This link is redundant
      }
      this.dependencies.add(link); // Keep the link if it's not redundant
    }
  }

  /**
   * @param {AbstractNode} node
   * @param {Set<AbstractNode>} [visited=new Set()]
   * @returns {boolean}
   */
  #dependsOn(node, visited = new Set()) {
    if (this === target) return true;
    if (visited.has(this)) return false;
    visited.add(this);
    return Array.from(this.dependencies).some(link => link.from.#dependsOn(node, visited));
  }
}

class SubjectNode extends AbstractNode {
  /** @param {Subject} data */
  constructor(data) {
    super();
    /** @type {Subject} */
    this.data = data;
  }

  /**
   * @param {Graph} graph
   */
  calculateDependencies(graph) {
    this.data.prerequisites
      .flatMap(prerequisite => prerequisite.dependencies)
      .flatMap(dependency => dependency.subjects)
      .forEach(subjectId => {
        const targetNode = graph.getNodeById(subjectId);
        if (targetNode) {
          this.dependencies.add(new Link(this, targetNode));
        } else {
          log.warn(`Subject with ID ${subjectId} not found in graph.`);
        }
      });
  }
}

class EdgeNode extends AbstractNode {
  /**
   * @param {Edge} data
   */
  constructor(data) {
    super();
    /** @type {Edge} */
    this.data = data;
    /** @type {Set<AbstractNode>} */
    this.targets = new Set();
  }

  /**
   * @param {Graph} graph
   */
  calculateDependencies(graph) {
    this.data.dependencies.forEach(sourceId => {
      const sourceNode = graph.getNodeById(sourceId);
      if (sourceNode) {
        this.dependencies.add(new Link(this, sourceNode));
      } else {
        log.warn(`Edge dependency with ID ${sourceId} not found in graph.`);
      }
    });
    this.data.targets.forEach(targetId => {
      const targetNode = graph.getNodeById(targetId);
      if (targetNode) {
        this.targets.add(targetNode);
      } else {
        log.warn(`Edge target with ID ${targetId} not found in graph.`);
      }
    });
  }
}

class Link {
  /**
   * Creates a link between two nodes.
   * The drawn arrow points from 'from' dependency to 'to' target.
   * @param {AbstractNode} from
   * @param {AbstractNode} to
   */
  constructor(from, to) {
    /** @type {AbstractNode} */
    this.from = from;
    /** @type {AbstractNode} */
    this.to = to;
  }
}
