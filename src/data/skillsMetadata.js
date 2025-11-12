// Metadata enrichment for skills: courses and documentation links
export const skillsMetadata = {
  // Physics & Theory
  monteCarlo: {
    courses: ['Statistical Mechanics', 'Computational Physics'],
    wikiUrl: 'https://en.wikipedia.org/wiki/Monte_Carlo_method'
  },
  statisticalPhysics: {
    courses: ['Statistical Mechanics I', 'Thermodynamics'],
    wikiUrl: 'https://en.wikipedia.org/wiki/Statistical_mechanics'
  },
  thermodynamics: {
    courses: ['Thermodynamics', 'Statistical Mechanics'],
    wikiUrl: 'https://en.wikipedia.org/wiki/Thermodynamics'
  },
  quantumMechanics: {
    courses: ['Quantum Mechanics I & II', 'Advanced Quantum Physics'],
    wikiUrl: 'https://en.wikipedia.org/wiki/Quantum_mechanics'
  },
  quantumFieldTheory: {
    courses: ['Quantum Field Theory', 'Advanced Particle Physics'],
    wikiUrl: 'https://en.wikipedia.org/wiki/Quantum_field_theory'
  },
  generalRelativity: {
    courses: ['General Relativity', 'Differential Geometry'],
    wikiUrl: 'https://en.wikipedia.org/wiki/General_relativity'
  },
  stochasticCalculus: {
    courses: ['Stochastic Calculus', 'Probability Theory'],
    wikiUrl: 'https://en.wikipedia.org/wiki/Stochastic_calculus'
  },
  controlTheory: {
    courses: ['Control Theory', 'Dynamical Systems'],
    wikiUrl: 'https://en.wikipedia.org/wiki/Control_theory'
  },
  gameTheory: {
    courses: ['Game Theory', 'Microeconomics'],
    wikiUrl: 'https://en.wikipedia.org/wiki/Game_theory'
  },

  // Math
  measureTheory: {
    courses: ['Measure Theory', 'Real Analysis'],
    wikiUrl: 'https://en.wikipedia.org/wiki/Measure_(mathematics)'
  },
  functionalAnalysis: {
    courses: ['Functional Analysis', 'Operator Theory'],
    wikiUrl: 'https://en.wikipedia.org/wiki/Functional_analysis'
  },
  differentialGeometry: {
    courses: ['Differential Geometry', 'Riemannian Geometry'],
    wikiUrl: 'https://en.wikipedia.org/wiki/Differential_geometry'
  },
  topology: {
    courses: ['Topology', 'Algebraic Topology'],
    wikiUrl: 'https://en.wikipedia.org/wiki/Topology'
  },
  linearAlgebra: {
    courses: ['Linear Algebra', 'Matrix Theory'],
    wikiUrl: 'https://en.wikipedia.org/wiki/Linear_algebra'
  },
  probabilityTheory: {
    courses: ['Probability Theory', 'Stochastic Processes'],
    wikiUrl: 'https://en.wikipedia.org/wiki/Probability_theory'
  },

  // Programming Languages
  python: {
    courses: ['Introduction to Programming', 'Scientific Computing with Python'],
    wikiUrl: 'https://docs.python.org/'
  },
  cpp: {
    courses: ['C++ Programming', 'High Performance Computing'],
    wikiUrl: 'https://en.cppreference.com/'
  },
  julia: {
    courses: ['Scientific Computing', 'Numerical Methods'],
    wikiUrl: 'https://docs.julialang.org/'
  },
  rust: {
    courses: ['Systems Programming', 'Safe Concurrent Programming'],
    wikiUrl: 'https://doc.rust-lang.org/'
  },
  javascript: {
    courses: ['Web Development', 'Modern JavaScript'],
    wikiUrl: 'https://developer.mozilla.org/en-US/docs/Web/JavaScript'
  },

  // ML & AI
  pytorch: {
    courses: ['Deep Learning', 'Neural Networks'],
    wikiUrl: 'https://pytorch.org/docs/'
  },
  tensorflow: {
    courses: ['Machine Learning', 'Deep Learning'],
    wikiUrl: 'https://www.tensorflow.org/api_docs'
  },
  sklearn: {
    courses: ['Machine Learning', 'Data Science'],
    wikiUrl: 'https://scikit-learn.org/stable/documentation.html'
  },
  transformers: {
    courses: ['Natural Language Processing', 'Deep Learning'],
    wikiUrl: 'https://huggingface.co/docs/transformers/'
  },

  // Scientific Computing
  numpy: {
    courses: ['Scientific Computing', 'Numerical Methods'],
    wikiUrl: 'https://numpy.org/doc/'
  },
  pandas: {
    courses: ['Data Analysis', 'Data Science'],
    wikiUrl: 'https://pandas.pydata.org/docs/'
  },
  scipy: {
    courses: ['Scientific Computing', 'Numerical Analysis'],
    wikiUrl: 'https://docs.scipy.org/'
  },
  matplotlib: {
    courses: ['Data Visualization', 'Scientific Plotting'],
    wikiUrl: 'https://matplotlib.org/stable/contents.html'
  },

  // HPC
  cuda: {
    courses: ['GPU Computing', 'Parallel Programming'],
    wikiUrl: 'https://docs.nvidia.com/cuda/'
  },
  mpi: {
    courses: ['Parallel Computing', 'Distributed Systems'],
    wikiUrl: 'https://www.open-mpi.org/doc/'
  },
  openmp: {
    courses: ['Parallel Programming', 'Shared Memory Computing'],
    wikiUrl: 'https://www.openmp.org/specifications/'
  },
  hpc: {
    courses: ['High Performance Computing', 'Cluster Computing'],
    wikiUrl: 'https://en.wikipedia.org/wiki/High-performance_computing'
  },

  // DevOps
  docker: {
    courses: ['DevOps', 'Containerization'],
    wikiUrl: 'https://docs.docker.com/'
  },
  git: {
    courses: ['Version Control', 'Software Development'],
    wikiUrl: 'https://git-scm.com/doc'
  },
  linux: {
    courses: ['Operating Systems', 'Unix/Linux'],
    wikiUrl: 'https://www.kernel.org/doc/html/latest/'
  },
  latex: {
    courses: ['Scientific Writing', 'Document Preparation'],
    wikiUrl: 'https://www.latex-project.org/help/documentation/'
  },

  // Bioinformatics
  biopython: {
    courses: ['Bioinformatics', 'Computational Biology'],
    wikiUrl: 'https://biopython.org/wiki/Documentation'
  },

  // Web
  vuejs: {
    courses: ['Web Development', 'Frontend Frameworks'],
    wikiUrl: 'https://vuejs.org/guide/'
  },
  d3js: {
    courses: ['Data Visualization', 'Interactive Graphics'],
    wikiUrl: 'https://d3js.org/'
  },
  webgl: {
    courses: ['Computer Graphics', '3D Web Development'],
    wikiUrl: 'https://developer.mozilla.org/en-US/docs/Web/API/WebGL_API'
  },

  // Additional skills
  openmp: {
    courses: ['Parallel Programming', 'Shared Memory Computing'],
    wikiUrl: 'https://www.openmp.org/'
  },
  mpi: {
    courses: ['Distributed Computing', 'Message Passing'],
    wikiUrl: 'https://www.mpi-forum.org/'
  },
  hpc: {
    courses: ['High Performance Computing', 'Supercomputing'],
    wikiUrl: 'https://en.wikipedia.org/wiki/Supercomputer'
  }
}

// Helper function to get enriched skill with metadata
export function enrichSkill(skill, skillKey) {
  const metadata = skillsMetadata[skillKey] || {}
  return {
    ...skill,
    courses: metadata.courses || [],
    wikiUrl: metadata.wikiUrl || null,
    skillKey: skillKey // Keep reference to the key for synchronization
  }
}
