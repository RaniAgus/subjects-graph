// UTN FRBA - Ingeniería en Sistemas de Información - Curriculum based on reference image
const subjects = [
  // y: 100
  {
    id: 'IyS',
    name: 'Ingeniería y Sociedad',
    prerequisites: [],
    position: { x: 100, y: 100 }
  },
  {
    id: 'L',
    name: 'Legislación',
    prerequisites: ['IyS', 'AdS'],
    position: { x: 200, y: 100 }
  },
  {
    id: 'I1',
    name: 'Inglés I',
    prerequisites: [],
    position: { x: 400, y: 100 }
  },
  {
    id: 'I2',
    name: 'Inglés II',
    prerequisites: ['I1'],
    position: { x: 500, y: 100 }
  },
  {
    id: 'SdR',
    name: 'Sistemas de Representación',
    prerequisites: [],
    position: { x: 600, y: 100 }
  },
  {
    id: 'TdC',
    name: 'Teoría de Control',
    prerequisites: ['F2', 'Q'],
    position: { x: 700, y: 100 }
  },
  {
    id: 'Q',
    name: 'Química',
    prerequisites: [],
    position: { x: 800, y: 100 }
  },
  {
    id: 'AGA',
    name: 'Álgebra y Geometría Analítica',
    prerequisites: [],
    position: { x: 900, y: 100 }
  },
  // y: 200
  {
    id: 'SyO',
    name: 'Sistemas y Organizaciones',
    prerequisites: [],
    position: { x: 100, y: 200 }
  },
  {
    id: 'AdS',
    name: 'Análisis de Sistemas',
    prerequisites: ['AyED', 'SyO'],
    position: { x: 200, y: 200 }
  },
  {
    id: 'E',
    name: 'Economía',
    prerequisites: ['AdS'],
    position: { x: 300, y: 200 }
  },
  {
    id: 'AdR',
    name: 'Administración de Recursos',
    prerequisites: ['E', 'SO', 'I1', 'DDS'],
    position: { x: 400, y: 200 }
  },
  {
    id: 'AG',
    name: 'Administración General',
    prerequisites: ['IO', 'AdR'],
    position: { x: 500, y: 200 }
  },
  {
    id: 'IO',
    name: 'Investigación Operativa',
    prerequisites: ['PyE', 'MS'],
    position: { x: 600, y: 200 }
  },
  {
    id: 'MS',
    name: 'Matemática Superior',
    prerequisites: ['AM2'],
    position: { x: 700, y: 200 }
  },
  {
    id: 'AM2',
    name: 'Análisis Matemático II',
    prerequisites: ['AGA', 'AM1'],
    position: { x: 800, y: 200 }
  },

  // y: 300
  {
    id: 'DDS',
    name: 'Diseño de Sistemas',
    prerequisites: ['AdS', 'PdP'],
    position: { x: 400, y: 300 }
  },
  {
    id: 'SdG',
    name: 'Sistemas de Gestión',
    prerequisites: ['AdR', 'IO', 'S'],
    position: { x: 500, y: 300 }
  },
  {
    id: 'AM1',
    name: 'Análisis Matemático I',
    prerequisites: [],
    position: { x: 900, y: 300 }
  },
  // y: 400
  {
    id: 'AyED',
    name: 'Algoritmos y Estructuras de Datos',
    prerequisites: [],
    position: { x: 100, y: 400 }
  },
  {
    id: 'PdP',
    name: 'Paradigmas de Programación',
    prerequisites: ['AyED', 'MD'],
    position: { x: 200, y: 400 }
  },
  {
    id: 'IA',
    name: 'Inteligencia Artificial',
    prerequisites: ['DDS', 'IO', 'S'],
    position: { x: 500, y: 400 }
  },
  {
    id: 'S',
    name: 'Simulación',
    prerequisites: ['MS', 'PyE'],
    position: { x: 600, y: 400 }
  },
  {
    id: 'PyE',
    name: 'Probabilidad y Estadística',
    prerequisites: ['AGA', 'AM1'],
    position: { x: 700, y: 400 }
  },

  // y: 500
  {
    id: 'SSL',
    name: 'Sintaxis y Semántica de Lenguajes',
    prerequisites: ['AyED', 'MD'],
    position: { x: 200, y: 500 }
  },
  {
    id: 'GDD',
    name: 'Gestión de Datos',
    prerequisites: ['PdP', 'AdS', 'SSL'],
    position: { x: 400, y: 500 }
  },
  {
    id: 'IeS',
    name: 'Ingeniería de Software',
    prerequisites: ['DDS', 'GDD'],
    position: { x: 500, y: 500 }
  },
  {
    id: 'F2',
    name: 'Física II',
    prerequisites: ['F1', 'AM1'],
    position: { x: 800, y: 500 }
  },
  {
    id: 'F1',
    name: 'Física I',
    prerequisites: [],
    position: { x: 900, y: 500 }
  },
  
  // y: 600
  {
    id: 'MD',
    name: 'Matemática Discreta',
    prerequisites: [],
    position: { x: 100, y: 600 }
  },
  {
    id: 'SO',
    name: 'Sistemas Operativos',
    prerequisites: ['MD', 'AyED', 'AdC'],
    position: { x: 200, y: 600 }
  },
  {
    id: 'RdI',
    name: 'Redes de Información',
    prerequisites: ['SO', 'C'],
    position: { x: 500, y: 600 }
  },
  {
    id: 'C',
    name: 'Comunicaciones',
    prerequisites: ['F2', 'AM2', 'AdC'],
    position: { x: 600, y: 600 }
  },
  
  // y: 700
  {
    id: 'AdC',
    name: 'Arquitectura de Computadores',
    prerequisites: [],
    position: { x: 400, y: 700 },
  }
];

// Connector nodes (rhombus) - statically defined based on reference image
// Position coordinates extracted from materias.png
const links = [
  {
    id: 'link3',
    sources: ['AGA', 'AM1'], // To be filled manually: AGA, AM2
    destinations: ['AM2', 'PyE'], // To be filled manually: AM1
    position: { x: 900, y: 200 }
  },
  {
    id: 'link6',
    sources: ['IO', 'S'], // To be filled manually: IO, SdG
    destinations: ['SdG', 'IA'], // To be filled manually: S
    position: { x: 600, y: 300 }
  },
  {
    id: 'link7',
    sources: ['MS', 'PyE'], // To be filled manually: MS, AM2
    destinations: ['IO', 'S'], // To be filled manually: PyE
    position: { x: 700, y: 300 }
  },
  {
    id: 'link8',
    sources: ['AyED', 'MD'], // To be filled manually: AyED, PdP
    destinations: ['PdP', 'SSL', 'SO'], // To be filled manually: SSL
    position: { x: 100, y: 500 }
  },
  {
    id: 'link9',
    sources: ['AdS', 'PdP'], // To be filled manually: DDS, SSL
    destinations: ['GDD', 'DDS'], // To be filled manually: GDD
    position: { x: 200, y: 300 }
  },
  {
    id: 'link12',
    sources: ['AdC'], // To be filled manually: SO, C
    destinations: ['SO'], // To be filled manually: AdC
    position: { x: 300, y: 700 }
  },
  {
    id: 'link13',
    sources: ['AdC'], // To be filled manually: SO, C
    destinations: ['C'], // To be filled manually: AdC
    position: { x: 500, y: 700 }
  },
  {
    id: 'link14',
    sources: ['DDS'],
    destinations: ['IeS'],
    position: { x: 400, y: 400 }
  },
  {
    id: 'link15',
    sources: ['AM2'],
    destinations: ['C'],
    position: { x: 800, y: 400 }
  },
  {
    id: 'link16',
    sources: ['F2'],
    destinations: ['C'],
    position: { x: 700, y: 600 }
  },
  {
    id: 'link17',
    sources: ['AyED'],
    destinations: ['AdS'],
    position: { x: 100, y: 300 }
  }
];

// Export for use in app.js
if (typeof module !== 'undefined' && module.exports) {
  module.exports = { subjects, links };
}
