# 🎓 Academic Portfolio

A modern, clean academic portfolio website inspired by HuggingFace's minimalist design. Built with Vue.js 3, Vite, and Bun for optimal performance.

## ✨ Features

- **Clean HuggingFace-inspired Design**: Minimalist interface with subtle borders and shadows
- **Light/Dark Mode**: Automatic theme switching based on system preferences
- **Two-Column Layout**: Professional About page with fixed sidebar and scrollable content
- **Color-coded Badges**: Consistent badge system across all pages with 5 color variants
- **Fully Responsive**: Optimized for desktop, tablet, and mobile devices
- **Centralized Data**: All content externalized in dedicated data files
- **Type-safe**: Well-structured component architecture with Vue 3 Composition API

## 🚀 Quick Start

### Prerequisites

- [Bun](https://bun.sh) installed on your machine

### Installation

```bash
bun install
```

### Development

```bash
bun run dev
```

The site will be available at `http://localhost:5173`

### Build

```bash
bun run build
```

Files will be generated in the `dist/` folder.

### Preview

```bash
bun run preview
```

## 📁 Project Architecture

```
academic-portfolio/
├── src/
│   ├── assets/
│   │   └── styles/
│   │       └── main.css           # Complete design system (HF-inspired)
│   ├── components/
│   │   ├── Header.vue             # Top navigation with logo and links
│   │   └── Footer.vue             # Site footer
│   ├── data/
│   │   ├── skills.js              # Skills, technologies, and categories
│   │   └── content.js             # All portfolio content (education, experiences, projects, publications)
│   ├── views/
│   │   ├── Home.vue               # About page with sidebar + main content
│   │   └── Research.vue           # Projects and publications
│   ├── router/
│   │   └── index.js               # Vue Router configuration
│   ├── App.vue                    # Root component
│   └── main.js                    # Application entry point
├── public/                        # Static assets
├── .github/workflows/
│   └── deploy.yml                 # GitHub Pages deployment
├── index.html
├── vite.config.js
├── package.json
└── README.md
```

## 🎨 Design System

### Colors

The design uses a clean, professional color palette inspired by HuggingFace:

```css
/* Light theme (default) */
--color-bg-primary: #ffffff;
--color-bg-secondary: #f9fafb;
--color-border: #e5e7eb;
--color-text-primary: #000000;
--color-text-secondary: #000103;

/* Badge colors */
--color-text-task: #ef4444;       /* Red */
--color-vision-task: #3b82f6;     /* Blue */
--color-audio-task: #10b981;      /* Green */
--color-multimodal-task: #f97316; /* Orange */
--color-tabular-task: #8b5cf6;    /* Purple */
```

Dark mode automatically adapts based on `prefers-color-scheme: dark`.

### Typography

- **Sans-serif**: Source Sans 3 (headings, body text)
- **Monospace**: IBM Plex Mono (code snippets)

### Component Classes

**Layout:**
- `.container` / `.container-lg` - Centered containers with max-width
- `.layout-two-col` - Two-column layout (280px sidebar + flexible main)
- `.grid`, `.grid-2`, `.grid-3` - Responsive grids

**UI Elements:**
- `.card` - Basic card with border and hover effect
- `.card-interactive` - Card with hover animation
- `.btn`, `.btn-primary`, `.btn-secondary` - Styled buttons
- `.badge` - Unified badge system with color variants

**Badge Variants:**
- `.badge-text` - Red background
- `.badge-vision` - Blue background
- `.badge-audio` - Green background
- `.badge-multimodal` - Orange background
- `.badge-tabular` - Purple background

## 📄 Page Structure

### Home (About) - `/`

**Two-column layout:**

**LEFT SIDEBAR (280px fixed):**
1. Square profile photo (150×150px)
2. Name and title
3. Short bio
4. "Download CV" button
5. **Skills & Tools** - Quick overview with colored badges
6. **Contact** - Email, LinkedIn, GitHub, ORCID with icons

**RIGHT MAIN CONTENT:**
1. **Education** - Degrees in grid layout (2 columns)
2. **Experience** - Professional experiences with skill badges (2 columns)
3. **Skills & Interests** - Organized by themes (Theoretical, Modeling, Programming) (3 columns)

### Research - `/research`

1. **Research Projects** - Project cards with:
   - Title and description
   - Technology badges
   - Metrics (lines of code, complexity, duration)
   - Links (Code, Demo, Paper)
   - Related publications

2. **Publications** - Academic publications with:
   - Year and type badges
   - Title, authors, venue
   - Abstract
   - Metrics (citations, downloads)
   - Links (PDF, DOI, Code, Slides)

## 🗂️ Data Architecture

All content is centralized in `src/data/` for easy maintenance.

### `src/data/skills.js`

Defines all skills, technologies, and their color variants:

```javascript
export const technologies = {
  python: { name: 'Python', variant: 'text' },
  pytorch: { name: 'PyTorch', variant: 'vision' },
  docker: { name: 'Docker', variant: 'audio' },
  // ... more technologies
}

export const skillCategories = [
  {
    id: 1,
    title: 'Theoretical',
    topics: [
      {
        name: 'Statistical Physics',
        skills: [
          { name: 'Monte Carlo', variant: 'text' },
          // ... more skills
        ],
        courses: 'Advanced Statistical Physics, Phase Transitions',
        projects: 'Complex systems simulation, Spin models'
      }
    ]
  }
  // ... more categories
]

// Helper functions
export const getSkillsByKeys = (keys) => { /* ... */ }
export const getTechnologiesByKeys = (keys) => { /* ... */ }
```

### `src/data/content.js`

Contains all portfolio content:

```javascript
import { getSkillsByKeys, getTechnologiesByKeys } from './skills.js'

export const education = [ /* ... */ ]

export const experiences = [
  {
    title: 'Research Intern',
    institution: 'CNRS',
    period: '2024',
    description: '...',
    skills: getSkillsByKeys(['monteCarlo', 'python', 'cpp', 'hpc'])
  }
  // ... more experiences
]

export const quickSkills = getTechnologiesByKeys([
  'python', 'cpp', 'pytorch', 'docker', 'git', 'hpc'
])

export const projects = [
  {
    title: 'ML Framework',
    description: '...',
    technologies: getTechnologiesByKeys(['python', 'pytorch', 'cuda']),
    linesOfCode: 15000,
    // ... more fields
  }
  // ... more projects
]

export const publications = [ /* ... */ ]
```

## ✏️ Customization Guide

### 1. Update Personal Information

Edit `src/views/Home.vue`:

```vue
<h1>Your Name</h1>
<p>PhD Candidate in Physics & Data Science</p>
<p>Your bio text...</p>
```

Update contact links and CV download URL in the same file.

### 2. Add/Edit Skills & Technologies

Edit `src/data/skills.js`:

```javascript
export const technologies = {
  // Add new technology
  rust: { name: 'Rust', variant: 'vision' },
  // ...
}
```

### 3. Update Education

Edit `src/data/content.js`:

```javascript
export const education = [
  {
    id: 1,
    degree: 'Your Degree',
    institution: 'Your University',
    year: '2024',
    description: 'Description...'
  }
]
```

### 4. Add Experiences

Edit `src/data/content.js`:

```javascript
export const experiences = [
  {
    id: 1,
    title: 'Your Position',
    institution: 'Company/Institution',
    period: '2024',
    description: 'What you did...',
    skills: getSkillsByKeys(['python', 'docker', 'pytorch'])
  }
]
```

### 5. Add Projects

Edit `src/data/content.js`:

```javascript
export const projects = [
  {
    id: 1,
    title: 'Project Name',
    description: 'Project description...',
    technologies: getTechnologiesByKeys(['python', 'vue', 'docker']),
    linesOfCode: 10000,
    complexity: 'High',
    duration: '6 months',
    github: 'https://github.com/...',
    demo: 'https://...',
    publications: ['Related paper title']
  }
]
```

### 6. Add Publications

Edit `src/data/content.js`:

```javascript
export const publications = [
  {
    id: 1,
    title: 'Paper Title',
    authors: 'Your Name, Co-authors',
    venue: 'Conference/Journal Name',
    type: 'Journal', // or 'Conference'
    year: 2024,
    abstract: 'Paper abstract...',
    citations: 45,
    downloads: 1200,
    pdf: 'https://...',
    doi: 'https://doi.org/...',
    code: 'https://github.com/...'
  }
]
```

### 7. Customize Sidebar Quick Skills

Edit `src/data/content.js`:

```javascript
export const quickSkills = getTechnologiesByKeys([
  'python', 'cpp', 'pytorch', 'docker', 'git', 'hpc', 'numpy', 'cuda'
])
```

### 8. Change Colors

Edit `src/assets/styles/main.css`:

```css
:root {
  --color-text-task: #YOUR_COLOR;
  --color-vision-task: #YOUR_COLOR;
  /* ... */
}
```

## 🌐 Deployment (GitHub Pages)

### Automatic Deployment

The project includes a GitHub Actions workflow (`.github/workflows/deploy.yml`) that automatically deploys to GitHub Pages on every push to `main`.

### Setup

1. Create a GitHub repository
2. Push your code:

```bash
git init
git add .
git commit -m "Initial commit"
git branch -M main
git remote add origin https://github.com/username/repo-name.git
git push -u origin main
```

3. Enable GitHub Pages:
   - Go to repository **Settings** > **Pages**
   - Source: Select **GitHub Actions**

4. Configure base path (if not using `username.github.io`):

Edit `vite.config.js`:

```javascript
export default defineConfig({
  base: '/repository-name/', // Add this line
  // ...
})
```

Your site will be available at: `https://username.github.io/repository-name/`

## 🛠️ Tech Stack

- **Frontend Framework**: [Vue.js 3](https://vuejs.org/) (Composition API)
- **Routing**: [Vue Router](https://router.vuejs.org/)
- **Build Tool**: [Vite](https://vitejs.dev/)
- **Runtime**: [Bun](https://bun.sh/)
- **Deployment**: [GitHub Pages](https://pages.github.com/)
- **Fonts**: Google Fonts (Source Sans 3, IBM Plex Mono)

## 📊 Key Design Decisions

### Why Two Data Files?

- **`skills.js`**: Reusable definitions with color variants
- **`content.js`**: Actual portfolio data using skills definitions

This separation allows:
- Same skill/technology to appear in multiple places
- Consistent colors across the entire site
- Easy maintenance (change once, applies everywhere)

### Why Badges Instead of Tags?

Originally had separate `.tag` and `.badge` classes. Merged into single `.badge` system for:
- Visual consistency
- Simpler codebase
- Easier maintenance

### Why Fixed Sidebar?

The two-column layout with fixed sidebar (inspired by HuggingFace):
- Quick access to contact info
- Professional appearance
- Better use of horizontal space on large screens

## 📝 License

MIT

## 🤝 Contributing

This is a personal portfolio template. Feel free to fork and customize for your own use!

---

**Made with Vue.js 3 + Vite + Bun** | Inspired by [HuggingFace](https://huggingface.co)
