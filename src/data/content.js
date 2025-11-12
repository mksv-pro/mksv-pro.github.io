// Centralized content data for the portfolio
import { getSkillsByKeys } from './skills.js'

// Education
export const education = [
  {
    id: 1,
    degree: 'BS/MS Mathematics',
    institution: 'SU',
    year: '2021-2027'
  },
  {
    id: 2,
    degree: 'MS Physics',
    institution: 'UPC',
    year: '2025-2027'
  },
  {
    id: 3,
    degree: 'BS/MS Finance',
    institution: 'DauphinePSL',
    year: '2025-2028'
  },
  {
    id: 4,
    degree: 'BA Political Science',
    institution: 'P1',
    year: '2022-2024'
  }
]

// Experiences
export const experiences = [
  {
    id: 1,
    title: 'Research Internship',
    institution: 'Université Paris Dauphine - PSL',
    period: 'Sep 2024 - Jan 2025',
    description: 'Introduction to mean-field game theory applied to economics for the study of the propagation of monetary shocks in a general equilibrium economy with sticky prices, under the supervision of Pierre Cardaliaguet.',
    skills: getSkillsByKeys(['stochasticCalculus', 'controlTheory', 'gameTheory', 'python'])
  },
  {
    id: 2,
    title: 'Research Assistant',
    institution: 'Sciences Po',
    period: 'Jun 2023 - Aug 2023',
    description: 'Research Assistant to Julia Cagé on the article "Hosting Media Bias: Evidence from the Universe of French Broadcasts, 2002-2020".',
    skills: getSkillsByKeys(['python', 'pandas', 'numpy'])
  },
]

// Research Projects
export const projects = [
  {
    id: 1,
    title: 'Machine Learning Framework for Medical Imaging',
    description: 'Deep learning framework for medical image classification using transformer architectures. Implementation includes data augmentation techniques and transfer learning approaches for improved generalization.',
    technologies: getSkillsByKeys(['python', 'pytorch', 'cuda', 'docker', 'latex']),
    linesOfCode: 15000,
    complexity: 'High',
    duration: '18 months',
    github: '#',
    demo: '#',
    paper: '#',
    publications: ['Deep Learning Approaches for Medical Image Classification']
  },
  {
    id: 2,
    title: 'Complex Systems Simulation Engine',
    description: 'Monte Carlo modeling of N-body physical systems with GPU parallelization algorithms. Study of phase transitions and critical properties in frustrated spin systems.',
    technologies: getSkillsByKeys(['cpp', 'openmp', 'mpi', 'hpc']),
    linesOfCode: 8000,
    complexity: 'Very High',
    duration: '12 months',
    github: '#',
    publications: ['Monte Carlo Simulations of Phase Transitions in Complex Systems']
  },
  {
    id: 3,
    title: 'Interactive Scientific Data Visualization',
    description: 'Web application for interactive visualization of large-scale scientific datasets. Features 3D graphics, temporal animations, and dynamic filtering capabilities.',
    technologies: getSkillsByKeys(['vuejs', 'd3js', 'webgl', 'python']),
    linesOfCode: 12000,
    complexity: 'Medium',
    duration: '8 months',
    github: '#',
    demo: '#'
  },
  {
    id: 4,
    title: 'Genomic Sequence Analysis Pipeline',
    description: 'Bioinformatics pipeline for processing genomic data. Sequence alignment algorithms and variant detection with optimized performance.',
    technologies: getSkillsByKeys(['python', 'biopython', 'numpy', 'pandas']),
    linesOfCode: 6000,
    complexity: 'Medium',
    duration: '6 months',
    github: '#',
    paper: '#'
  }
]

// Publications
export const publications = [
  {
    id: 1,
    title: 'Deep Learning Approaches for Medical Image Classification',
    authors: 'Your Name, Co-author A., Co-author B., Co-author C.',
    venue: 'Nature Machine Intelligence',
    type: 'Journal',
    year: 2024,
    abstract: 'We propose a novel neural network architecture for medical image classification, achieving state-of-the-art performance on multiple benchmark datasets. Our approach combines transfer learning and data augmentation techniques to improve generalization across diverse medical imaging modalities.',
    citations: 45,
    downloads: 1200,
    pdf: '#',
    doi: '#',
    code: '#'
  },
  {
    id: 2,
    title: 'Monte Carlo Simulations of Phase Transitions in Complex Systems',
    authors: 'Your Name, Co-author D., Co-author E.',
    venue: 'Physical Review E',
    type: 'Journal',
    year: 2024,
    abstract: 'Monte Carlo study of phase transitions in frustrated spin systems. We identify new universality classes and characterize critical exponents with unprecedented precision using advanced finite-size scaling techniques.',
    citations: 28,
    downloads: 850,
    pdf: '#',
    doi: '#',
    code: '#',
    slides: '#'
  },
  {
    id: 3,
    title: 'Interactive Visualization Techniques for Large-Scale Scientific Data',
    authors: 'Your Name, Co-author F.',
    venue: 'IEEE VIS 2023',
    type: 'Conference',
    year: 2023,
    abstract: 'Novel interactive visualization techniques for exploring large-scale scientific datasets. Our approach uses GPU computing to enable real-time interactions with millions of data points, facilitating pattern discovery and hypothesis generation.',
    citations: 12,
    downloads: 420,
    pdf: '#',
    doi: '#'
  },
]
