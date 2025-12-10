// Subject states
const STATES = {
  PASSED: 'passed',           // Aprobada
  SIGNED: 'signed',           // Firmada
  IN_PROGRESS: 'in_progress', // En curso
  TO_TAKE: 'to_take',        // Por cursar
  AVAILABLE_PASS: 'available_pass', // Disponible para aprobar
  AVAILABLE_TAKE: 'available_take', // Disponible para cursar
  NOT_AVAILABLE: 'not_available'    // No disponible
};

// UTN FRBA - Ingeniería en Sistemas de Información - Curriculum based on reference image
const subjects = [
  // Level 1 - Top row
  {
    id: 'IyS',
    name: 'Ingeniería y Sociedad',
    prerequisites: [],
    state: STATES.NOT_AVAILABLE,
    level: 1,
    position: { x: 100, y: 100 }
  },
  {
    id: 'L',
    name: 'Legislación',
    prerequisites: ['IyS', 'AdS'],
    state: STATES.NOT_AVAILABLE,
    level: 1,
    position: { x: 200, y: 100 }
  },
  {
    id: 'SyO',
    name: 'Sistemas y Organizaciones',
    prerequisites: [],
    state: STATES.NOT_AVAILABLE,
    level: 1,
    position: { x: 100, y: 200 }
  },
  {
    id: 'I1',
    name: 'Inglés I',
    prerequisites: [],
    state: STATES.NOT_AVAILABLE,
    level: 1,
    position: { x: 400, y: 100 }
  },
  {
    id: 'I2',
    name: 'Inglés II',
    prerequisites: ['I1'],
    state: STATES.NOT_AVAILABLE,
    level: 1,
    position: { x: 500, y: 100 }
  },
  {
    id: 'SdR',
    name: 'Sistemas de Representación',
    prerequisites: [],
    state: STATES.NOT_AVAILABLE,
    level: 1,
    position: { x: 600, y: 100 }
  },
  {
    id: 'TdC',
    name: 'Teoría de Control',
    prerequisites: ['F2', 'Q'],
    state: STATES.NOT_AVAILABLE,
    level: 1,
    position: { x: 700, y: 100 }
  },
  {
    id: 'Q',
    name: 'Química',
    prerequisites: [],
    state: STATES.NOT_AVAILABLE,
    level: 1,
    position: { x: 850, y: 100 }
  },
  {
    id: 'AGA',
    name: 'Álgebra y Geometría Analítica',
    prerequisites: [],
    state: STATES.NOT_AVAILABLE,
    level: 1,
    position: { x: 1000, y: 100 }
  },
  
  // Level 2
  {
    id: 'AdS',
    name: 'Análisis de Sistemas',
    prerequisites: ['AyED', 'SyO'],
    state: STATES.NOT_AVAILABLE,
    level: 2,
    position: { x: 200, y: 200 }
  },
  {
    id: 'E',
    name: 'Economía',
    prerequisites: ['AdS'],
    state: STATES.NOT_AVAILABLE,
    level: 2,
    position: { x: 300, y: 200 }
  },
  {
    id: 'AdR',
    name: 'Administración de Recursos',
    prerequisites: ['E', 'SO'],
    state: STATES.NOT_AVAILABLE,
    level: 2,
    position: { x: 400, y: 200 }
  },
  {
    id: 'AG',
    name: 'Administración General',
    prerequisites: ['IO', 'AdR'],
    state: STATES.NOT_AVAILABLE,
    level: 2,
    position: { x: 500, y: 200 }
  },
  {
    id: 'IO',
    name: 'Investigación Operativa',
    prerequisites: ['PyE', 'MS'],
    state: STATES.NOT_AVAILABLE,
    level: 2,
    position: { x: 600, y: 200 }
  },
  {
    id: 'MS',
    name: 'Matemática Superior',
    prerequisites: ['AM2'],
    state: STATES.NOT_AVAILABLE,
    level: 2,
    position: { x: 750, y: 200 }
  },
  {
    id: 'AM2',
    name: 'Análisis Matemático II',
    prerequisites: ['AGA', 'AM1'],
    state: STATES.NOT_AVAILABLE,
    level: 2,
    position: { x: 900, y: 200 }
  },
  {
    id: 'AM1',
    name: 'Análisis Matemático I',
    prerequisites: [],
    state: STATES.NOT_AVAILABLE,
    level: 2,
    position: { x: 1000, y: 250 }
  },
  
  // Level 3
  {
    id: 'AyED',
    name: 'Algoritmos y Estructuras de Datos',
    prerequisites: [],
    state: STATES.NOT_AVAILABLE,
    level: 3,
    position: { x: 100, y: 350 }
  },
  {
    id: 'PdP',
    name: 'Paradigmas de Programación',
    prerequisites: ['AyED', 'MD'],
    state: STATES.NOT_AVAILABLE,
    level: 3,
    position: { x: 200, y: 350 }
  },
  {
    id: 'DDS',
    name: 'Diseño de Sistemas',
    prerequisites: ['AdS', 'PdP'],
    state: STATES.NOT_AVAILABLE,
    level: 3,
    position: { x: 400, y: 300 }
  },
  {
    id: 'SdG',
    name: 'Sistemas de Gestión',
    prerequisites: ['AdR', 'IO', 'S'],
    state: STATES.NOT_AVAILABLE,
    level: 3,
    position: { x: 500, y: 300 }
  },
  {
    id: 'IA',
    name: 'Inteligencia Artificial',
    prerequisites: ['DDS', 'IO', 'S'],
    state: STATES.NOT_AVAILABLE,
    level: 3,
    position: { x: 500, y: 400 }
  },
  {
    id: 'S',
    name: 'Simulación',
    prerequisites: ['MS', 'PyE'],
    state: STATES.NOT_AVAILABLE,
    level: 3,
    position: { x: 600, y: 400 }
  },
  {
    id: 'PyE',
    name: 'Probabilidad y Estadística',
    prerequisites: ['AGA', 'AM1'],
    state: STATES.NOT_AVAILABLE,
    level: 3,
    position: { x: 800, y: 350 }
  },
  {
    id: 'F1',
    name: 'Física I',
    prerequisites: [],
    state: STATES.NOT_AVAILABLE,
    level: 3,
    position: { x: 1000, y: 450 }
  },
  {
    id: 'F2',
    name: 'Física II',
    prerequisites: ['F1', 'AM1'],
    state: STATES.NOT_AVAILABLE,
    level: 3,
    position: { x: 900, y: 450 }
  },
  
  // Level 4
  {
    id: 'MD',
    name: 'Matemática Discreta',
    prerequisites: [],
    state: STATES.NOT_AVAILABLE,
    level: 4,
    position: { x: 100, y: 550 }
  },
  {
    id: 'SSL',
    name: 'Sintaxis y Semántica de Lenguajes',
    prerequisites: ['AyED', 'MD'],
    state: STATES.NOT_AVAILABLE,
    level: 4,
    position: { x: 200, y: 500 }
  },
  {
    id: 'SO',
    name: 'Sistemas Operativos',
    prerequisites: ['MD', 'AyED', 'AdC'],
    state: STATES.NOT_AVAILABLE,
    level: 4,
    position: { x: 250, y: 600 }
  },
  {
    id: 'GDD',
    name: 'Gestión de Datos',
    prerequisites: ['PdP', 'AdS', 'SSL'],
    state: STATES.NOT_AVAILABLE,
    level: 4,
    position: { x: 400, y: 500 }
  },
  {
    id: 'IeS',
    name: 'Ingeniería de Software',
    prerequisites: ['DDS', 'GDD'],
    state: STATES.NOT_AVAILABLE,
    level: 4,
    position: { x: 500, y: 500 }
  },
  {
    id: 'RdI',
    name: 'Redes de Información',
    prerequisites: ['SO', 'C'],
    state: STATES.NOT_AVAILABLE,
    level: 4,
    position: { x: 500, y: 600 }
  },
  {
    id: 'C',
    name: 'Comunicaciones',
    prerequisites: ['F2', 'AM2', 'AdC'],
    state: STATES.NOT_AVAILABLE,
    level: 4,
    position: { x: 700, y: 600 }
  },
  
  // Level 5
  {
    id: 'AdC',
    name: 'Arquitectura de Computadores',
    prerequisites: [],
    state: STATES.NOT_AVAILABLE,
    level: 5,
    position: { x: 400, y: 700 },
    isFinalProject: true
  }
];

// Connector nodes (rhombus) - statically defined based on reference image
// Position coordinates extracted from materias.png
const links = [
  {
    id: 'link1',
    sources: [], // To be filled manually: L, AdS
    destinations: [], // To be filled manually: E
    position: { x: 255, y: 150 }
  },
  {
    id: 'link2',
    sources: [], // To be filled manually: I2, AdR
    destinations: [], // To be filled manually: AG
    position: { x: 450, y: 150 }
  },
  {
    id: 'link3',
    sources: [], // To be filled manually: AGA, AM2
    destinations: [], // To be filled manually: AM1
    position: { x: 950, y: 225 }
  },
  {
    id: 'link4',
    sources: [], // To be filled manually: AdS, E, AdR
    destinations: [], // To be filled manually: DDS
    position: { x: 300, y: 250 }
  },
  {
    id: 'link5',
    sources: [], // To be filled manually: DDS, AG
    destinations: [], // To be filled manually: SdG
    position: { x: 450, y: 330 }
  },
  {
    id: 'link6',
    sources: [], // To be filled manually: IO, SdG
    destinations: [], // To be filled manually: S
    position: { x: 550, y: 350 }
  },
  {
    id: 'link7',
    sources: [], // To be filled manually: MS, AM2
    destinations: [], // To be filled manually: PyE
    position: { x: 825, y: 275 }
  },
  {
    id: 'link8',
    sources: [], // To be filled manually: AyED, PdP
    destinations: [], // To be filled manually: SSL
    position: { x: 150, y: 425 }
  },
  {
    id: 'link9',
    sources: [], // To be filled manually: DDS, SSL
    destinations: [], // To be filled manually: GDD
    position: { x: 300, y: 400 }
  },
  {
    id: 'link10',
    sources: [], // To be filled manually: DDS, GDD
    destinations: [], // To be filled manually: IeS
    position: { x: 450, y: 450 }
  },
  {
    id: 'link11',
    sources: [], // To be filled manually: AM1, F1
    destinations: [], // To be filled manually: F2
    position: { x: 950, y: 500 }
  },
  {
    id: 'link12',
    sources: [], // To be filled manually: SO, C
    destinations: [], // To be filled manually: AdC
    position: { x: 350, y: 650 }
  }
];

// Export for use in app.js
if (typeof module !== 'undefined' && module.exports) {
  module.exports = { subjects, STATES, links };
}
