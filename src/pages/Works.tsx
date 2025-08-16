import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Github, ExternalLink, Eye, Code2 } from 'lucide-react';
import Layout from '@/components/Layout';

const Works = () => {
  const projects = [
    {
      id: 1,
      title: "Neural Network Optimizer",
      abstract: "Advanced optimization algorithms for deep neural networks using adaptive learning rate scheduling and momentum techniques.",
      description: "This project implements state-of-the-art optimization methods including AdamW, RMSprop variants, and custom adaptive algorithms. The optimizer dynamically adjusts learning rates based on gradient statistics and loss landscape analysis.",
      technologies: ["Python", "PyTorch", "NumPy", "Matplotlib"],
      githubUrl: "https://github.com/mksv-pro/neural-optimizer",
      demoUrl: "https://neural-optimizer-demo.vercel.app",
      status: "Active",
      featured: true
    },
    {
      id: 2,
      title: "Computer Vision Pipeline",
      abstract: "End-to-end computer vision system for real-time object detection and classification in industrial environments.",
      description: "A robust computer vision pipeline built with YOLOv8 and custom CNN architectures. Features real-time processing, edge deployment capabilities, and automated model retraining with active learning.",
      technologies: ["Python", "OpenCV", "TensorFlow", "FastAPI", "Docker"],
      githubUrl: "https://github.com/mksv-pro/cv-pipeline",
      demoUrl: "https://cv-demo.mksv.dev",
      status: "Production",
      featured: true
    },
    {
      id: 3,
      title: "Data Analysis Toolkit",
      abstract: "Comprehensive statistical analysis and visualization toolkit for scientific research and data exploration.",
      description: "A Python package providing advanced statistical methods, interactive visualizations, and automated report generation for scientific data analysis. Includes hypothesis testing, regression analysis, and time series forecasting.",
      technologies: ["Python", "Pandas", "Plotly", "SciPy", "Jupyter"],
      githubUrl: "https://github.com/mksv-pro/data-toolkit",
      demoUrl: null,
      status: "Active",
      featured: false
    },
    {
      id: 4,
      title: "NLP Sentiment Analyzer",
      abstract: "Multi-language sentiment analysis system with transformer-based models and real-time processing capabilities.",
      description: "Advanced sentiment analysis using BERT variants and custom transformer architectures. Supports multiple languages, handles complex sentiment nuances, and provides confidence scores with attention visualization.",
      technologies: ["Python", "Transformers", "FastAPI", "Redis", "Docker"],
      githubUrl: "https://github.com/mksv-pro/nlp-sentiment",
      demoUrl: "https://sentiment.mksv.dev",
      status: "Beta",
      featured: false
    },
    {
      id: 5,
      title: "Time Series Forecasting",
      abstract: "Ensemble forecasting models for financial and scientific time series prediction with uncertainty quantification.",
      description: "Hybrid forecasting system combining LSTM networks, ARIMA models, and Prophet for robust time series prediction. Features automatic model selection, confidence intervals, and anomaly detection.",
      technologies: ["Python", "TensorFlow", "Prophet", "Streamlit", "PostgreSQL"],
      githubUrl: "https://github.com/mksv-pro/ts-forecasting",
      demoUrl: "https://forecast.mksv.dev",
      status: "Research",
      featured: true
    },
    {
      id: 6,
      title: "Scientific Computing Library",
      abstract: "High-performance numerical computing library optimized for scientific simulations and mathematical modeling.",
      description: "GPU-accelerated numerical computing library with custom CUDA kernels for scientific simulations. Includes linear algebra operations, differential equation solvers, and optimization algorithms.",
      technologies: ["Python", "CUDA", "CuPy", "Numba", "C++"],
      githubUrl: "https://github.com/mksv-pro/sci-compute",
      demoUrl: null,
      status: "Development",
      featured: false
    }
  ];

  const getStatusColor = (status: string) => {
    switch (status) {
      case 'Active': return 'bg-green-500/20 text-green-400 border-green-500/30';
      case 'Production': return 'bg-blue-500/20 text-blue-400 border-blue-500/30';
      case 'Beta': return 'bg-yellow-500/20 text-yellow-400 border-yellow-500/30';
      case 'Research': return 'bg-purple-500/20 text-purple-400 border-purple-500/30';
      case 'Development': return 'bg-orange-500/20 text-orange-400 border-orange-500/30';
      default: return 'bg-muted text-muted-foreground';
    }
  };

  const featuredProjects = projects.filter(p => p.featured);
  const otherProjects = projects.filter(p => !p.featured);

  return (
    <Layout>
      <div className="container mx-auto px-4 py-12">
        <div className="max-w-6xl mx-auto">
          <h1 className="text-4xl md:text-5xl font-display font-bold text-gradient mb-4 animate-fade-in">
            My Works
          </h1>
          <p className="text-xl text-muted-foreground mb-12 animate-fade-in" style={{ animationDelay: '0.1s' }}>
            A collection of projects showcasing machine learning, data science, and software engineering expertise.
          </p>
          
          {/* Featured Projects */}
          <section className="mb-16">
            <h2 className="text-2xl font-display font-semibold text-gradient mb-8 animate-slide-in">
              Featured Projects
            </h2>
            <div className="grid md:grid-cols-2 gap-8">
              {featuredProjects.map((project, index) => (
                <Card key={project.id} className="glass-effect shadow-card hover:shadow-glow transition-all duration-500 group animate-fade-in" style={{ animationDelay: `${index * 0.1}s` }}>
                  <CardHeader>
                    <div className="flex items-start justify-between">
                      <CardTitle className="text-xl font-display group-hover:text-gradient transition-all duration-300">
                        {project.title}
                      </CardTitle>
                      <Badge className={`text-xs ${getStatusColor(project.status)}`}>
                        {project.status}
                      </Badge>
                    </div>
                  </CardHeader>
                  <CardContent className="space-y-4">
                    <p className="text-sm text-muted-foreground font-medium">
                      {project.abstract}
                    </p>
                    <p className="text-sm text-foreground/80 leading-relaxed">
                      {project.description}
                    </p>
                    
                    <div className="flex flex-wrap gap-1">
                      {project.technologies.map((tech) => (
                        <Badge key={tech} variant="outline" className="text-xs bg-accent/50">
                          {tech}
                        </Badge>
                      ))}
                    </div>
                    
                    <div className="flex items-center space-x-2 pt-2">
                      <Button variant="outline" size="sm" asChild className="hover:bg-primary hover:text-primary-foreground transition-all duration-300">
                        <a href={project.githubUrl} target="_blank" rel="noopener noreferrer">
                          <Github className="w-4 h-4 mr-2" />
                          Code
                        </a>
                      </Button>
                      {project.demoUrl && (
                        <Button variant="outline" size="sm" asChild className="hover:bg-primary hover:text-primary-foreground transition-all duration-300">
                          <a href={project.demoUrl} target="_blank" rel="noopener noreferrer">
                            <ExternalLink className="w-4 h-4 mr-2" />
                            Demo
                          </a>
                        </Button>
                      )}
                    </div>
                  </CardContent>
                </Card>
              ))}
            </div>
          </section>
          
          {/* Other Projects */}
          <section>
            <h2 className="text-2xl font-display font-semibold text-gradient mb-8 animate-slide-in">
              Additional Projects
            </h2>
            <div className="grid md:grid-cols-3 gap-6">
              {otherProjects.map((project, index) => (
                <Card key={project.id} className="glass-effect shadow-card hover:shadow-glow transition-all duration-500 group animate-fade-in" style={{ animationDelay: `${index * 0.1}s` }}>
                  <CardHeader className="pb-3">
                    <div className="flex items-start justify-between">
                      <CardTitle className="text-lg font-display group-hover:text-gradient transition-all duration-300">
                        {project.title}
                      </CardTitle>
                      <Badge className={`text-xs ${getStatusColor(project.status)}`}>
                        {project.status}
                      </Badge>
                    </div>
                  </CardHeader>
                  <CardContent className="space-y-3">
                    <p className="text-sm text-muted-foreground">
                      {project.abstract}
                    </p>
                    
                    <div className="flex flex-wrap gap-1">
                      {project.technologies.slice(0, 3).map((tech) => (
                        <Badge key={tech} variant="outline" className="text-xs bg-accent/50">
                          {tech}
                        </Badge>
                      ))}
                      {project.technologies.length > 3 && (
                        <Badge variant="outline" className="text-xs bg-accent/50">
                          +{project.technologies.length - 3}
                        </Badge>
                      )}
                    </div>
                    
                    <div className="flex items-center space-x-2 pt-2">
                      <Button variant="outline" size="sm" asChild className="hover:bg-primary hover:text-primary-foreground transition-all duration-300">
                        <a href={project.githubUrl} target="_blank" rel="noopener noreferrer">
                          <Code2 className="w-3 h-3 mr-1" />
                          Code
                        </a>
                      </Button>
                      {project.demoUrl && (
                        <Button variant="outline" size="sm" asChild className="hover:bg-primary hover:text-primary-foreground transition-all duration-300">
                          <a href={project.demoUrl} target="_blank" rel="noopener noreferrer">
                            <Eye className="w-3 h-3 mr-1" />
                            Live
                          </a>
                        </Button>
                      )}
                    </div>
                  </CardContent>
                </Card>
              ))}
            </div>
          </section>
        </div>
      </div>
    </Layout>
  );
};

export default Works;
