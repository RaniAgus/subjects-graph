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

// UTN FRBA - Ingeniería en Sistemas de Información - Sample Curriculum
const subjects = [
  // First Year - First Semester
  {
    id: 'AM1',
    name: 'Análisis Matemático I',
    prerequisites: [],
    state: STATES.NOT_AVAILABLE,
    level: 1
  },
  {
    id: 'ALG',
    name: 'Álgebra y Geometría Analítica',
    prerequisites: [],
    state: STATES.NOT_AVAILABLE,
    level: 1
  },
  {
    id: 'FIS1',
    name: 'Física I',
    prerequisites: [],
    state: STATES.NOT_AVAILABLE,
    level: 1
  },
  {
    id: 'ING',
    name: 'Ingeniería y Sociedad',
    prerequisites: [],
    state: STATES.NOT_AVAILABLE,
    level: 1
  },
  {
    id: 'SIS',
    name: 'Sistemas y Organizaciones',
    prerequisites: [],
    state: STATES.NOT_AVAILABLE,
    level: 1
  },
  {
    id: 'ALG_PROG',
    name: 'Algoritmos y Programación',
    prerequisites: [],
    state: STATES.NOT_AVAILABLE,
    level: 1
  },
  // First Year - Second Semester
  {
    id: 'AM2',
    name: 'Análisis Matemático II',
    prerequisites: ['AM1'],
    state: STATES.NOT_AVAILABLE,
    level: 2
  },
  {
    id: 'FIS2',
    name: 'Física II',
    prerequisites: ['FIS1', 'AM1'],
    state: STATES.NOT_AVAILABLE,
    level: 2
  },
  {
    id: 'QUI',
    name: 'Química',
    prerequisites: [],
    state: STATES.NOT_AVAILABLE,
    level: 2
  },
  {
    id: 'ING_SOFT1',
    name: 'Ingeniería de Software I',
    prerequisites: ['SIS'],
    state: STATES.NOT_AVAILABLE,
    level: 2
  },
  {
    id: 'MAT_DISC',
    name: 'Matemática Discreta',
    prerequisites: ['ALG_PROG'],
    state: STATES.NOT_AVAILABLE,
    level: 2
  },
  // Second Year - First Semester
  {
    id: 'PROB',
    name: 'Probabilidad y Estadística',
    prerequisites: ['AM2'],
    state: STATES.NOT_AVAILABLE,
    level: 3
  },
  {
    id: 'ARQ',
    name: 'Arquitectura de Computadoras',
    prerequisites: ['FIS2'],
    state: STATES.NOT_AVAILABLE,
    level: 3
  },
  {
    id: 'SINT',
    name: 'Sintaxis y Semántica de los Lenguajes',
    prerequisites: ['MAT_DISC'],
    state: STATES.NOT_AVAILABLE,
    level: 3
  },
  {
    id: 'PARA',
    name: 'Paradigmas de Programación',
    prerequisites: ['MAT_DISC', 'ALG_PROG'],
    state: STATES.NOT_AVAILABLE,
    level: 3
  },
  {
    id: 'ING_SOFT2',
    name: 'Ingeniería de Software II',
    prerequisites: ['ING_SOFT1'],
    state: STATES.NOT_AVAILABLE,
    level: 3
  },
  // Second Year - Second Semester
  {
    id: 'SIS_OP',
    name: 'Sistemas Operativos',
    prerequisites: ['ARQ'],
    state: STATES.NOT_AVAILABLE,
    level: 4
  },
  {
    id: 'GDD',
    name: 'Gestión de Datos',
    prerequisites: ['PARA'],
    state: STATES.NOT_AVAILABLE,
    level: 4
  },
  {
    id: 'COM',
    name: 'Comunicaciones',
    prerequisites: ['FIS2'],
    state: STATES.NOT_AVAILABLE,
    level: 4
  },
  {
    id: 'MATE',
    name: 'Matemática Superior',
    prerequisites: ['AM2', 'PROB'],
    state: STATES.NOT_AVAILABLE,
    level: 4
  },
  {
    id: 'ING_SOFT3',
    name: 'Ingeniería de Software III',
    prerequisites: ['ING_SOFT2'],
    state: STATES.NOT_AVAILABLE,
    level: 4
  },
  // Third Year - First Semester
  {
    id: 'DDS',
    name: 'Diseño de Sistemas',
    prerequisites: ['GDD', 'ING_SOFT3'],
    state: STATES.NOT_AVAILABLE,
    level: 5,
    unlocksFinal: true
  },
  {
    id: 'ADM',
    name: 'Administración de Recursos',
    prerequisites: ['ING'],
    state: STATES.NOT_AVAILABLE,
    level: 5
  },
  {
    id: 'ECON',
    name: 'Economía',
    prerequisites: [],
    state: STATES.NOT_AVAILABLE,
    level: 5
  },
  {
    id: 'OPE',
    name: 'Investigación Operativa',
    prerequisites: ['MATE', 'PROB'],
    state: STATES.NOT_AVAILABLE,
    level: 5
  },
  {
    id: 'SIM',
    name: 'Simulación',
    prerequisites: ['PROB', 'PARA'],
    state: STATES.NOT_AVAILABLE,
    level: 5
  },
  // Third Year - Second Semester
  {
    id: 'TP',
    name: 'Trabajo Profesional',
    prerequisites: ['DDS', 'ADM', 'ECON', 'OPE', 'SIM'],
    state: STATES.NOT_AVAILABLE,
    level: 6,
    isFinalProject: true
  }
];

// Export for use in app.js
if (typeof module !== 'undefined' && module.exports) {
  module.exports = { subjects, STATES };
}
