// Importations React et composants UI
import { useState } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Github, FileText, Star } from "lucide-react";
import Layout from "@/components/Layout";

// Données statiques des projets (6 projets au total)
const initialProjects = [
  {
    id: 1,
    title: "Urban Morphogenesis Model",
    abstract: "A generative model for urban growth and form using diffusion-limited aggregation, stochastic cellular automata, and network growth.",
    description: "This project presents a generative model for urban morphogenesis that combines diffusion-limited aggregation, stochastic cellular automata, and network growth. The model simulates the evolution of urban forms based on simple local rules and interactions, capturing key features of real-world cities.",
    technologies: ["Python", "NumPy", "Matplotlib", "NetworkX"],
    githubUrl: "https://github.com/mksv-pro/urban-morphogenesis",
    pdfUrl: "/pdfs/urban-morphogenesis.pdf",
    context: "Research",
    status: "In Progress",
    featured: true
  },
  {
    id: 2,
    title: "N-body Simulation",
    abstract: "High-performance simulation of N-body gravitational interactions using GPU acceleration.",
    description: "This project implements a fast N-body simulation using CUDA for GPU acceleration. It models gravitational interactions between a large number of particles and provides real-time visualization of the simulation.",
    technologies: ["Python", "CUDA", "NumPy", "Matplotlib"],
    githubUrl: "https://github.com/mksv-pro/n-body-simulation",
    pdfUrl: "/pdfs/n-body-simulation.pdf",
    context: "Academic",
    status: "Complete",
    featured: true
  },

];

const Works = () => {
  // On utilise uniquement les projets initiaux, pas de gestion
  const [projects] = useState(initialProjects);

  // Renvoie la couleur du badge de statut
  const getStatusColor = (status: string) => {
    switch (status) {
      case "In Progress": return "bg-yellow-500/20 text-yellow-400 border-yellow-500/30";
      case "Complete": return "bg-green-500/20 text-green-400 border-green-500/30";
      case "Production": return "bg-blue-500/20 text-blue-400 border-blue-500/30";
      case "Idea": return "bg-gray-500/20 text-gray-400 border-gray-500/30";
      case "Archived": return "bg-red-500/20 text-red-400 border-red-500/30";
      default: return "bg-muted text-muted-foreground";
    }
  };

  // Renvoie la couleur du badge de contexte
  const getContextColor = (context: string) => {
    switch (context) {
      case "Academic": return "bg-indigo-500/20 text-indigo-400 border-indigo-500/30";
      case "Research": return "bg-purple-500/20 text-purple-400 border-purple-500/30";
      case "Professional": return "bg-pink-500/20 text-pink-400 border-pink-500/30";
      case "Personal": return "bg-orange-500/20 text-orange-400 border-orange-500/30";
      case "Open Source": return "bg-teal-500/20 text-teal-400 border-teal-500/30";
      default: return "bg-muted text-muted-foreground";
    }
  };

  return (
    <Layout>
      <div className="container mx-auto px-4 py-12">
        <div className="max-w-6xl mx-auto">
          {/* Titre principal */}
          <h1 className="text-4xl md:text-5xl font-display font-bold text-gradient mb-4 animate-fade-in">
            Works
          </h1>

          {/* Sous-titre */}
          <p className="text-xl text-muted-foreground mb-6 animate-fade-in">
            A collection of projects showcasing machine learning, data science, and software engineering expertise.
          </p>

          {/* Grille des projets */}
          <div className="grid md:grid-cols-2 gap-8">
            {projects.map((project, index) => (
              <Card
                key={project.id}
                className="glass-effect shadow-card hover:shadow-glow transition-all duration-500 group animate-fade-in"
                style={{ animationDelay: `${index * 0.1}s` }}
              >
                <CardHeader>
                  <div className="flex items-start justify-between">
                    {/* Titre du projet */}
                    <CardTitle className="text-xl font-display group-hover:text-gradient transition-all duration-300">
                      {project.title}
                    </CardTitle>

                    {/* Badges contexte + statut + étoile */}
                    <div className="flex space-x-2 items-center">
                      <Badge className={`text-xs ${getContextColor(project.context)}`}>
                        {project.context}
                      </Badge>
                      <Badge className={`text-xs ${getStatusColor(project.status)}`}>
                        {project.status}
                      </Badge>
                      {project.featured && <Star className="w-4 h-4 text-yellow-400" />}
                    </div>
                  </div>
                </CardHeader>

                <CardContent className="space-y-4">
                  {/* Résumé + description */}
                  <p className="text-sm text-muted-foreground font-medium text-justify">
                    {project.abstract}
                  </p>
                  <p className="text-sm text-foreground/80 leading-relaxed text-justify">
                    {project.description}
                  </p>

                  {/* Technologies utilisées */}
                  <div className="flex flex-wrap gap-1">
                    {project.technologies.map((tech) => (
                      <Badge key={tech} variant="outline" className="text-xs bg-accent/50">
                        {tech}
                      </Badge>
                    ))}
                  </div>

                  {/* Boutons GitHub + PDF */}
                  <div className="flex items-center space-x-2 pt-2">
                    <Button variant="outline" size="sm" asChild>
                      <a href={project.githubUrl} target="_blank" rel="noopener noreferrer">
                        <Github className="w-4 h-4 mr-2" /> Code
                      </a>
                    </Button>
                    {project.pdfUrl && (
                      <Button variant="outline" size="sm" asChild>
                        <a href={project.pdfUrl} target="_blank" rel="noopener noreferrer">
                          <FileText className="w-4 h-4 mr-2" /> PDF
                        </a>
                      </Button>
                    )}
                  </div>
                </CardContent>
              </Card>
            ))}
          </div>
        </div>
      </div>
    </Layout>
  );
};

export default Works;
