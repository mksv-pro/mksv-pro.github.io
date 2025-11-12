// Unified scientific & computational knowledge base (with domain + level structure)

const allSkills = {

  // --- 🔴 Theoretical & Statistical Physics
  monteCarlo: {
    name: 'Monte Carlo',
    variant: 'text',
    domain: 'physics',
    level: 'comp',
    courses: ['Statistical Mechanics', 'Computational Physics'],
    wikiUrl: 'https://en.wikipedia.org/wiki/Monte_Carlo_method'
  },
  statisticalPhysics: {
    name: 'Statistical Physics',
    variant: 'text',
    domain: 'physics',
    level: 'theory',
    courses: ['Statistical Mechanics I', 'Thermodynamics'],
    wikiUrl: 'https://en.wikipedia.org/wiki/Statistical_mechanics'
  },
  thermodynamics: { name: 'Thermodynamics', variant: 'text', domain: 'physics', level: 'theory' },
  renormalizationGroup: { name: 'Renormalization Group', variant: 'text', domain: 'physics', level: 'theory' },
  stochasticProcesses: { name: 'Stochastic Processes', variant: 'text', domain: 'physics', level: 'math' },
  criticalPhenomena: { name: 'Critical Phenomena', variant: 'text', domain: 'physics', level: 'app' },
  numericalAnalysis: { name: 'Numerical Analysis', variant: 'text', domain: 'math', level: 'comp' },

  // --- 🔵 Quantum & Theoretical Physics
  quantumMechanics: { name: 'Quantum Mechanics', variant: 'vision', domain: 'physics', level: 'theory' },
  quantumFieldTheory: { name: 'Quantum Field Theory', variant: 'vision', domain: 'physics', level: 'theory' },
  quantumOptics: { name: 'Quantum Optics', variant: 'vision', domain: 'physics', level: 'app' },
  pathIntegrals: { name: 'Path Integrals', variant: 'vision', domain: 'physics', level: 'math' },
  gaugeTheory: { name: 'Gauge Theory', variant: 'vision', domain: 'physics', level: 'theory' },
  generalRelativity: { name: 'General Relativity', variant: 'vision', domain: 'physics', level: 'theory' },
  differentialGeometry: { name: 'Differential Geometry', variant: 'vision', domain: 'math', level: 'theory' },
  topology: { name: 'Topology', variant: 'vision', domain: 'math', level: 'theory' },
  linearAlgebra: { name: 'Linear Algebra', variant: 'vision', domain: 'math', level: 'math' },
  functionalAnalysis: { name: 'Functional Analysis', variant: 'vision', domain: 'math', level: 'theory' },

  // --- 🟢 Simulation & Scientific Computing
  finiteElements: { name: 'Finite Elements', variant: 'audio', domain: 'physics', level: 'comp' },
  molecularDynamics: { name: 'Molecular Dynamics', variant: 'audio', domain: 'physics', level: 'comp' },
  nBody: { name: 'N-Body Simulation', variant: 'audio', domain: 'physics', level: 'comp' },
  pdeSolvers: { name: 'PDE Solvers', variant: 'audio', domain: 'math', level: 'comp' },
  fluidDynamics: { name: 'Fluid Dynamics', variant: 'audio', domain: 'physics', level: 'app' },
  controlTheory: { name: 'Control Theory', variant: 'audio', domain: 'math', level: 'theory' },
  optimization: { name: 'Optimization', variant: 'audio', domain: 'math', level: 'comp' },

  // --- 🧮 Core Numerical Libraries
  numpy: { name: 'NumPy', variant: 'audio', domain: 'infra', level: 'comp' },
  pandas: { name: 'pandas', variant: 'audio', domain: 'infra', level: 'comp' },
  polars: { name: 'Polars', variant: 'audio', domain: 'infra', level: 'comp' },
  arrow: { name: 'Apache Arrow', variant: 'audio', domain: 'infra', level: 'comp' },
  scipy: { name: 'SciPy', variant: 'audio', domain: 'infra', level: 'comp' },
  sympy: { name: 'SymPy', variant: 'audio', domain: 'math', level: 'theory' },
  numba: { name: 'Numba', variant: 'audio', domain: 'infra', level: 'comp' },
  cython: { name: 'Cython', variant: 'audio', domain: 'infra', level: 'comp' },

  // --- 🟠 Machine Learning & AI
  sklearn: { name: 'scikit-learn', variant: 'multimodal', domain: 'ml', level: 'app' },
  tensorflow: { name: 'TensorFlow', variant: 'multimodal', domain: 'ml', level: 'infra' },
  keras: { name: 'Keras', variant: 'multimodal', domain: 'ml', level: 'app' },
  pytorch: { name: 'PyTorch', variant: 'multimodal', domain: 'ml', level: 'infra' },
  transformers: { name: 'Transformers', variant: 'multimodal', domain: 'ml', level: 'app' },
  optuna: { name: 'Optuna', variant: 'multimodal', domain: 'ml', level: 'comp' },
  diffusionModels: { name: 'Diffusion Models', variant: 'multimodal', domain: 'ml', level: 'theory' },
  reinforcementLearning: { name: 'Reinforcement Learning', variant: 'multimodal', domain: 'ml', level: 'app' },

  // --- 📊 Visualization
  matplotlib: { name: 'Matplotlib', variant: 'vision', domain: 'infra', level: 'app' },
  seaborn: { name: 'Seaborn', variant: 'vision', domain: 'infra', level: 'app' },
  plotly: { name: 'Plotly', variant: 'vision', domain: 'infra', level: 'app' },

  // --- ⚡ HPC & Parallel Computing
  mpi4py: { name: 'mpi4py', variant: 'tabular', domain: 'infra', level: 'comp' },
  cupy: { name: 'CuPy', variant: 'tabular', domain: 'infra', level: 'comp' },
  jax: { name: 'JAX', variant: 'tabular', domain: 'infra', level: 'comp' },
  dask: { name: 'Dask', variant: 'tabular', domain: 'infra', level: 'comp' },
  cuda: { name: 'CUDA', variant: 'tabular', domain: 'infra', level: 'infra' },
  hpc: { name: 'HPC', variant: 'tabular', domain: 'infra', level: 'infra' },

  // --- 📈 Econometrics & Finance
  statsmodels: { name: 'Statsmodels', variant: 'abstract', domain: 'econ', level: 'app' },
  pymc: { name: 'PyMC', variant: 'abstract', domain: 'ml', level: 'theory' },
  numpyro: { name: 'NumPyro', variant: 'abstract', domain: 'ml', level: 'theory' },
  econometrics: { name: 'Econometrics', variant: 'abstract', domain: 'econ', level: 'math' },
  stochasticFinance: { name: 'Stochastic Finance', variant: 'abstract', domain: 'econ', level: 'math' },
  portfolioTheory: { name: 'Portfolio Theory', variant: 'abstract', domain: 'econ', level: 'app' },
  gameTheory: { name: 'Game Theory', variant: 'abstract', domain: 'econ', level: 'theory' },

  // --- ⚙️ Mathematical Foundations
  probabilityTheory: { name: 'Probability Theory', variant: 'logic', domain: 'math', level: 'theory' },
  measureTheory: { name: 'Measure Theory', variant: 'logic', domain: 'math', level: 'theory' },
  stochasticCalculus: { name: 'Stochastic Calculus', variant: 'logic', domain: 'math', level: 'math' },
  dynamicalSystems: { name: 'Dynamical Systems', variant: 'logic', domain: 'math', level: 'app' },
  complexAnalysis: { name: 'Complex Analysis', variant: 'logic', domain: 'math', level: 'math' },
  variationalCalculus: { name: 'Variational Calculus', variant: 'logic', domain: 'math', level: 'math' },

  // --- 🧩 Networks & Complex Systems
  networkx: { name: 'NetworkX', variant: 'vision', domain: 'math', level: 'app' },
  complexityScience: { name: 'Complexity Science', variant: 'vision', domain: 'physics', level: 'theory' },
  systemsTheory: { name: 'Systems Theory', variant: 'vision', domain: 'physics', level: 'theory' },

  // --- 💻 Languages & Environment
  python: { name: 'Python', variant: 'tabular', domain: 'infra', level: 'infra' },
  julia: { name: 'Julia', variant: 'tabular', domain: 'infra', level: 'infra' },
  rust: { name: 'Rust', variant: 'tabular', domain: 'infra', level: 'infra' },
  cpp: { name: 'C++', variant: 'tabular', domain: 'infra', level: 'infra' },
  javascript : { name: 'JavaScript', variant: 'tabular', domain: 'infra', level: 'infra' },
  git: { name: 'Git', variant: 'tabular', domain: 'infra', level: 'infra' },
  linux: { name: 'Linux', variant: 'tabular', domain: 'infra', level: 'infra' },
  latex: { name: 'LaTeX', variant: 'tabular', domain: 'infra', level: 'infra' },
  bun: { name: 'Bun', variant: 'tabular', domain: 'infra', level: 'comp' },
  docker: { name: 'Docker', variant: 'tabular', domain: 'infra', level: 'comp' },
  uv : { name: 'uv', variant: 'tabular', domain: 'infra', level: 'comp' }
}

export const allSkillsList = Object.values(allSkills)
export const getSkillsByKeys = (keys) => keys.map(k => ({
  ...allSkills[k],
  skillKey: k // Add skillKey for synchronization
})).filter(Boolean)
export const getSkillsByDomain = (domain) => Object.values(allSkills).filter(s => s.domain === domain)
export const getSkillsByLevel = (level) => Object.values(allSkills).filter(s => s.level === level)

// Skills organized by abstraction level
export const thematicSkills = [
  {
    id: 1,
    title: 'Theory & Foundations',
    skills: getSkillsByKeys([
      // Physics Theory
      'quantumFieldTheory', 'generalRelativity', 'gaugeTheory', 'statisticalPhysics',
      'quantumMechanics', 'thermodynamics', 'renormalizationGroup',
      // Math Theory
      'measureTheory', 'functionalAnalysis', 'differentialGeometry', 'topology',
      'complexAnalysis', 'probabilityTheory', 'variationalCalculus',
      // Economics Theory
      'gameTheory'
    ])
  },
  {
    id: 2,
    title: 'Applied Methods & Modeling',
    skills: getSkillsByKeys([
      // Applied Physics
      'quantumOptics', 'criticalPhenomena', 'fluidDynamics', 'complexityScience', 'systemsTheory',
      // Applied Math & Finance
      'stochasticCalculus', 'stochasticProcesses', 'econometrics', 'stochasticFinance',
      'portfolioTheory', 'controlTheory', 'dynamicalSystems',
      // ML Theory
      'diffusionModels', 'reinforcementLearning', 'pymc', 'numpyro'
    ])
  },
  {
    id: 3,
    title: 'Computational & Numerical',
    skills: getSkillsByKeys([
      // Simulations
      'monteCarlo', 'molecularDynamics', 'nBody', 'finiteElements', 'pdeSolvers',
      'numericalAnalysis', 'optimization',
      // ML Frameworks
      'pytorch', 'tensorflow', 'keras', 'sklearn', 'transformers', 'jax', 'optuna',
      // Scientific Computing
      'numpy', 'scipy', 'sympy', 'pandas', 'polars', 'arrow', 'statsmodels',
      // HPC
      'cuda', 'hpc', 'mpi4py', 'cupy', 'dask', 'numba', 'cython',
      // Visualization
      'matplotlib', 'seaborn', 'plotly', 'networkx'
    ])
  },
  {
    id: 4,
    title: 'Infrastructure & Tools',
    skills: getSkillsByKeys([
      'python', 'julia', 'rust', 'cpp', 'javascript',
      'git', 'linux', 'docker', 'latex', 'bun', 'uv'
    ])
  }
]

// Helper to find skillKey from allSkills by name
const findSkillKey = (skillName) => {
  const entry = Object.entries(allSkills).find(([key, skill]) => skill.name === skillName)
  return entry ? entry[0] : null
}

// Helper to add skillKey to a skill node
const addSkillKey = (node) => {
  const skillKey = findSkillKey(node.name)
  return skillKey ? { ...node, skillKey } : node
}

// Recursively add skillKey to all nodes in tree
const enrichTreeWithSkillKeys = (node) => {
  if (!node) return node

  const skillKey = findSkillKey(node.name)
  const enriched = skillKey ? { ...node, skillKey } : { ...node }

  if (enriched.children) {
    enriched.children = enriched.children.map(child => enrichTreeWithSkillKeys(child))
  }

  return enriched
}

// Hierarchical tree structure for D3 visualization (base definition)
const skillsTreeBase = {
  name: 'Skills',
  children: [
    {
      name: 'Theory & Foundations',
      color: '#ef4444',
      children: [
        {
          name: 'Quantum & Field Theory',
          children: [
            { name: 'Quantum Field Theory', ...allSkills.quantumFieldTheory, skillKey: 'quantumFieldTheory' },
            { name: 'Quantum Mechanics', ...allSkills.quantumMechanics, skillKey: 'quantumMechanics' },
            { name: 'Quantum Optics', ...allSkills.quantumOptics, skillKey: 'quantumOptics' },
            { name: 'Gauge Theory', ...allSkills.gaugeTheory, skillKey: 'gaugeTheory' },
            { name: 'General Relativity', ...allSkills.generalRelativity, skillKey: 'generalRelativity' },
            { name: 'Path Integrals', ...allSkills.pathIntegrals, skillKey: 'pathIntegrals' }
          ]
        },
        {
          name: 'Statistical Physics',
          children: [
            { name: 'Statistical Physics', ...allSkills.statisticalPhysics },
            { name: 'Thermodynamics', ...allSkills.thermodynamics },
            { name: 'Renormalization Group', ...allSkills.renormalizationGroup },
            { name: 'Critical Phenomena', ...allSkills.criticalPhenomena },
            { name: 'Stochastic Processes', ...allSkills.stochasticProcesses }
          ]
        },
        {
          name: 'Pure Mathematics',
          children: [
            { name: 'Measure Theory', ...allSkills.measureTheory },
            { name: 'Functional Analysis', ...allSkills.functionalAnalysis },
            { name: 'Differential Geometry', ...allSkills.differentialGeometry },
            { name: 'Topology', ...allSkills.topology },
            { name: 'Complex Analysis', ...allSkills.complexAnalysis },
            { name: 'Linear Algebra', ...allSkills.linearAlgebra }
          ]
        },
        {
          name: 'Probability & Stochastic',
          children: [
            { name: 'Probability Theory', ...allSkills.probabilityTheory },
            { name: 'Stochastic Calculus', ...allSkills.stochasticCalculus },
            { name: 'Variational Calculus', ...allSkills.variationalCalculus }
          ]
        }
      ]
    },
    {
      name: 'Applied Methods',
      color: '#3b82f6',
      children: [
        {
          name: 'Complex Systems',
          children: [
            { name: 'Complexity Science', ...allSkills.complexityScience },
            { name: 'Systems Theory', ...allSkills.systemsTheory },
            { name: 'Dynamical Systems', ...allSkills.dynamicalSystems },
            { name: 'NetworkX', ...allSkills.networkx }
          ]
        },
        {
          name: 'Physics Applications',
          children: [
            { name: 'Fluid Dynamics', ...allSkills.fluidDynamics },
            { name: 'Control Theory', ...allSkills.controlTheory }
          ]
        },
        {
          name: 'Economics & Finance',
          children: [
            { name: 'Econometrics', ...allSkills.econometrics },
            { name: 'Stochastic Finance', ...allSkills.stochasticFinance },
            { name: 'Portfolio Theory', ...allSkills.portfolioTheory },
            { name: 'Game Theory', ...allSkills.gameTheory }
          ]
        },
        {
          name: 'Machine Learning Theory',
          children: [
            { name: 'Diffusion Models', ...allSkills.diffusionModels },
            { name: 'Reinforcement Learning', ...allSkills.reinforcementLearning },
            { name: 'PyMC', ...allSkills.pymc },
            { name: 'NumPyro', ...allSkills.numpyro }
          ]
        }
      ]
    },
    {
      name: 'Computational',
      color: '#10b981',
      children: [
        {
          name: 'Numerical Methods',
          children: [
            { name: 'Monte Carlo', ...allSkills.monteCarlo },
            { name: 'Molecular Dynamics', ...allSkills.molecularDynamics },
            { name: 'N-Body Simulation', ...allSkills.nBody },
            { name: 'Finite Elements', ...allSkills.finiteElements },
            { name: 'PDE Solvers', ...allSkills.pdeSolvers },
            { name: 'Numerical Analysis', ...allSkills.numericalAnalysis },
            { name: 'Optimization', ...allSkills.optimization }
          ]
        },
        {
          name: 'Machine Learning',
          children: [
            { name: 'PyTorch', ...allSkills.pytorch },
            { name: 'TensorFlow', ...allSkills.tensorflow },
            { name: 'Keras', ...allSkills.keras },
            { name: 'scikit-learn', ...allSkills.sklearn },
            { name: 'Transformers', ...allSkills.transformers },
            { name: 'Optuna', ...allSkills.optuna }
          ]
        },
        {
          name: 'Scientific Computing',
          children: [
            { name: 'NumPy', ...allSkills.numpy },
            { name: 'SciPy', ...allSkills.scipy },
            { name: 'SymPy', ...allSkills.sympy },
            { name: 'pandas', ...allSkills.pandas },
            { name: 'Polars', ...allSkills.polars },
            { name: 'Apache Arrow', ...allSkills.arrow },
            { name: 'Statsmodels', ...allSkills.statsmodels }
          ]
        },
        {
          name: 'High Performance Computing',
          children: [
            { name: 'CUDA', ...allSkills.cuda },
            { name: 'HPC', ...allSkills.hpc },
            { name: 'mpi4py', ...allSkills.mpi4py },
            { name: 'CuPy', ...allSkills.cupy },
            { name: 'JAX', ...allSkills.jax },
            { name: 'Dask', ...allSkills.dask },
            { name: 'Numba', ...allSkills.numba },
            { name: 'Cython', ...allSkills.cython }
          ]
        },
        {
          name: 'Visualization',
          children: [
            { name: 'Matplotlib', ...allSkills.matplotlib },
            { name: 'Seaborn', ...allSkills.seaborn },
            { name: 'Plotly', ...allSkills.plotly }
          ]
        }
      ]
    },
    {
      name: 'Infrastructure',
      color: '#8b5cf6',
      children: [
        {
          name: 'Languages',
          children: [
            { name: 'Python', ...allSkills.python },
            { name: 'Julia', ...allSkills.julia },
            { name: 'Rust', ...allSkills.rust },
            { name: 'C++', ...allSkills.cpp },
            { name: 'JavaScript', ...allSkills.javascript }
          ]
        },
        {
          name: 'DevOps & Tools',
          children: [
            { name: 'Git', ...allSkills.git },
            { name: 'Linux', ...allSkills.linux },
            { name: 'Docker', ...allSkills.docker },
            { name: 'Bun', ...allSkills.bun },
            { name: 'uv', ...allSkills.uv }
          ]
        },
        {
          name: 'Documentation',
          children: [
            { name: 'LaTeX', ...allSkills.latex }
          ]
        }
      ]
    }
  ]
}

// Swap Theory & Foundations with Applied Methods for display order
const swappedTree = {
  ...skillsTreeBase,
  children: [
    skillsTreeBase.children[1], // Applied Methods first
    skillsTreeBase.children[0], // Theory & Foundations second
    skillsTreeBase.children[2], // Computational third
    skillsTreeBase.children[3]  // Infrastructure fourth
  ]
}

// Export enriched tree with skillKeys automatically added
export const skillsTree = enrichTreeWithSkillKeys(swappedTree)
