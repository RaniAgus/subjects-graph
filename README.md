# Grafo de Materias - UTN FRBA

Interactive web application for visualizing and tracking university subject dependencies as a directed graph. Built with vanilla JavaScript and Cytoscape.js.

![Graph Visualization](https://img.shields.io/badge/Graph-Cytoscape.js-blue)
![License](https://img.shields.io/badge/License-BSD%203--Clause-green)

## Screenshots

### Application Interface
The application features a dark blue theme with an interactive graph on the left and a legend/controls panel on the right:

- **Graph Area**: Interactive visualization of subjects and their dependencies
- **Progress Gauge**: Circular indicator showing completion percentage (top-right of graph)
- **Legend Panel**: Color-coded reference guide for subject states
- **Control Buttons**: Reset progress and fit-to-view options

![Application Interface](https://github.com/user-attachments/assets/6fb5c1ab-eb7c-4419-93e0-fd21652f56ce)

> **Note**: The graph visualization requires an active internet connection to load Cytoscape.js from CDN. In restricted environments, you'll see a fallback message.

## Features

### 📊 Graph Visualization
- **Interactive Graph**: Subjects displayed as circular nodes with arrows showing prerequisite relationships
- **Connector Nodes**: Diamond-shaped "Y" (AND) connectors simplify visualization when multiple prerequisites converge to a single subject
- **Cytoscape.js**: Powerful graph rendering with zoom, pan, and navigation controls
- **Smart Layout**: Automatic breadth-first layout organizing subjects by dependency level

### 🎨 Subject States with Color Coding
Track your academic progress with 7 different states:

| State | Spanish | Visual Style | Description |
|-------|---------|--------------|-------------|
| **Passed** | Aprobada | Solid blue fill | Subject completed and approved |
| **Signed** | Firmada | Blue outline only | Coursework complete, awaiting exam |
| **In Progress** | En curso | Gray fill | Currently enrolled |
| **Available to Pass** | Disponible para aprobar | Green fill | All prerequisites passed |
| **Available to Take** | Disponible para cursar | Blue outline with arrow | Prerequisites signed or better |
| **To Take** | Por cursar | Gray fill | No prerequisites, ready to take |
| **Not Available** | No disponible | Dark gray, dimmed | Prerequisites not yet met |

Plus special nodes:
- **Final Project** (Proyecto Final): Gold/orange highlighting with star icon
- **Connector Nodes** (Y): Gray diamond shapes that represent AND logic for multiple prerequisites

### 🎯 Interactive Features
- **Click to Update**: Click any subject node to cycle through states
- **Auto-calculation**: Automatically determines which subjects become available as you complete prerequisites
- **Hover Effects**: Highlight nodes and their connections on hover
- **Pan & Zoom**: Navigate large curriculum graphs with ease
- **Fit to View**: Reset camera to see entire graph

### 📈 Progress Tracking
- **Completion Gauge**: Circular progress indicator showing percentage complete
- **Real-time Updates**: Progress updates instantly as you mark subjects
- **LocalStorage Persistence**: Your progress is saved automatically in the browser

### 📚 Legend Panel
- Visual reference guide for all subject states
- Control instructions
- Quick reset and view adjustment buttons

## Technical Stack

- **Vanilla JavaScript**: No frameworks, pure ES6+
- **Cytoscape.js 3.28.1**: From CDN for graph visualization
- **CSS Variables**: Easy theme customization
- **LocalStorage API**: Client-side progress persistence
- **Responsive Design**: Desktop-optimized layout

## Getting Started

### Prerequisites
- A modern web browser (Chrome, Firefox, Safari, Edge)
- **Internet connection** (required to load Cytoscape.js from CDN)
- No build tools or dependencies required!

### Installation

1. Clone the repository:
```bash
git clone https://github.com/RaniAgus/frba-subjects-graph.git
cd frba-subjects-graph
```

2. Open `index.html` in your web browser:
```bash
# On macOS
open index.html

# On Linux
xdg-open index.html

# On Windows
start index.html
```

Or simply double-click `index.html` in your file explorer.

Alternatively, serve with any static file server:
```bash
# Python 3
python -m http.server 8000

# Node.js (if you have npx)
npx serve

# PHP
php -S localhost:8000
```

Then open `http://localhost:8000` in your browser.

## Usage

### Tracking Your Progress

1. **View the Graph**: The application displays all subjects and their dependencies
2. **Update Subject States**: Click on any subject node to cycle through states:
   - Not Available → To Take → In Progress → Signed → Passed → (back to Not Available)
3. **Watch Availability Update**: As you mark prerequisites as "Passed" or "Signed", dependent subjects automatically become available
4. **Monitor Progress**: The circular gauge shows your completion percentage
5. **Save Progress**: Everything is saved automatically to your browser's LocalStorage

### Controls

- **Click Node**: Cycle through subject states
- **Scroll**: Zoom in/out
- **Click & Drag on Background**: Pan the view
- **Fit Button**: Reset view to show entire graph
- **Reset Button**: Clear all progress (with confirmation)

### Keyboard Shortcuts

The graph uses standard Cytoscape.js controls:
- Mouse wheel: Zoom
- Click and drag: Pan

## File Structure

```
├── index.html      # Main HTML structure
├── styles.css      # Dark theme styles and CSS variables
├── app.js          # Application logic and Cytoscape initialization
├── data.js         # Subject definitions and curriculum structure
├── README.md       # This file
└── LICENSE         # BSD 3-Clause License
```

## Customization

### Adding Your Own Subjects

Edit `data.js` to customize the curriculum:

```javascript
const subjects = [
  {
    id: 'SUBJ1',           // Unique identifier
    name: 'Subject Name',  // Full name
    prerequisites: [],     // Array of prerequisite IDs
    state: STATES.NOT_AVAILABLE,
    level: 1,              // Optional: for layout
    unlocksFinal: false,   // Optional: required for final project
    isFinalProject: false  // Optional: marks as final project
  },
  // ... more subjects
];
```

### Customizing Colors

Edit CSS variables in `styles.css`:

```css
:root {
  --bg-primary: #0a1628;        /* Main background */
  --accent-blue: #3b82f6;       /* Primary accent */
  --state-passed: #3b82f6;      /* Passed subjects */
  --state-available-pass: #10b981;  /* Available subjects */
  /* ... more variables */
}
```

### Changing Graph Layout

In `app.js`, modify the Cytoscape layout options:

```javascript
layout: {
  name: 'breadthfirst',  // Try: 'cose', 'grid', 'circle'
  directed: true,
  spacingFactor: 1.5,    // Adjust spacing
  // ... more layout options
}
```

## Browser Compatibility

- Chrome/Edge: ✅ Full support
- Firefox: ✅ Full support
- Safari: ✅ Full support
- Internet Explorer: ❌ Not supported (requires modern ES6+ features)

## LocalStorage

Progress is stored in your browser's LocalStorage under the key `subjectProgress`. 

To manually clear:
1. Open browser DevTools (F12)
2. Go to Application/Storage tab
3. Select LocalStorage
4. Delete the `subjectProgress` key

Or use the "Reiniciar Progreso" (Reset Progress) button in the app.

## License

This project is licensed under the BSD 3-Clause License - see the [LICENSE](LICENSE) file for details.

## Credits

- **Graph Library**: [Cytoscape.js](https://js.cytoscape.org/)
- **Curriculum**: Based on UTN FRBA - Ingeniería en Sistemas de Información

## Contributing

Contributions are welcome! Feel free to:
- Report bugs
- Suggest new features
- Submit pull requests
- Improve documentation

## Roadmap

Potential future enhancements:
- [ ] Export/import progress as JSON
- [ ] Multiple curriculum support (different engineering programs)
- [ ] Semester planning mode
- [ ] Print/export graph as image
- [ ] Mobile-responsive layout
- [ ] Dark/light theme toggle
- [ ] Accessibility improvements (ARIA labels, keyboard navigation)

## Support

For questions or issues, please open an issue on GitHub.