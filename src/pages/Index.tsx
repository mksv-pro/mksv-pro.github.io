import { Button } from '@/components/ui/button';
import { Card, CardContent } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { ArrowRight, Code, Database, Brain, BarChart, Github, Mail, Linkedin } from 'lucide-react';
import { Link } from 'react-router-dom';
import Layout from '@/components/Layout';

const Index = () => {
  const skills = [
    { icon: Brain, name: "Machine Learning", color: "text-blue-400" },
    { icon: Database, name: "Data Science", color: "text-green-400" },
    { icon: Code, name: "Software Engineering", color: "text-purple-400" },
    { icon: BarChart, name: "Statistical Analysis", color: "text-orange-400" }
  ];

  const quickLinks = [
    { href: "/about", label: "About Me", description: "Learn more about my background" },
    { href: "/works", label: "Projects", description: "Explore my latest work" },
    { href: "/cv", label: "Resume", description: "View my professional experience" },
    { href: "/blog", label: "Blog", description: "Read my latest articles" }
  ];

  return (
    <Layout>
      {/* Hero Section */}
      <section className="min-h-screen flex items-center justify-center relative overflow-hidden">
        <div className="container mx-auto px-4 text-center relative z-10">
          <div className="max-w-4xl mx-auto">
            <h1 className="text-5xl md:text-7xl font-display font-bold text-gradient mb-6 animate-fade-in">
              MKSV
            </h1>
            <h2 className="text-2xl md:text-3xl font-display font-semibold text-foreground mb-6 animate-fade-in" style={{ animationDelay: '0.2s' }}>
              Machine Learning Engineer & Data Scientist
            </h2>
            <p className="text-xl text-muted-foreground mb-8 max-w-2xl mx-auto animate-fade-in" style={{ animationDelay: '0.4s' }}>
              Transforming data into insights and building intelligent systems that solve real-world problems. 
              Specializing in deep learning, computer vision, and scalable ML solutions.
            </p>
            
            <div className="flex flex-col sm:flex-row gap-4 justify-center mb-12 animate-fade-in" style={{ animationDelay: '0.6s' }}>
              <Button asChild className="glow-effect bg-primary hover:bg-primary/90 text-primary-foreground group">
                <Link to="/works">
                  View My Work
                  <ArrowRight className="w-4 h-4 ml-2 group-hover:translate-x-1 transition-transform duration-300" />
                </Link>
              </Button>
              <Button asChild variant="outline" className="hover:bg-accent hover:text-accent-foreground">
                <Link to="/about">
                  About Me
                </Link>
              </Button>
            </div>

            {/* Skills */}
            <div className="grid grid-cols-2 md:grid-cols-4 gap-4 max-w-2xl mx-auto animate-slide-in" style={{ animationDelay: '0.8s' }}>
              {skills.map((skill, index) => {
                const Icon = skill.icon;
                return (
                  <Card key={skill.name} className="glass-effect shadow-card hover:shadow-glow transition-all duration-500 group">
                    <CardContent className="p-4 text-center">
                      <Icon className={`w-8 h-8 mx-auto mb-2 ${skill.color} group-hover:animate-float`} />
                      <p className="text-sm font-medium text-foreground">{skill.name}</p>
                    </CardContent>
                  </Card>
                );
              })}
            </div>
          </div>
        </div>
        
        {/* Animated background elements */}
        <div className="absolute inset-0 overflow-hidden pointer-events-none">
          <div className="absolute top-20 left-10 w-32 h-32 bg-primary/10 rounded-full blur-xl animate-float"></div>
          <div className="absolute bottom-20 right-10 w-48 h-48 bg-primary/5 rounded-full blur-2xl animate-float" style={{ animationDelay: '1s' }}></div>
          <div className="absolute top-1/2 left-1/4 w-16 h-16 bg-primary/20 rounded-full blur-lg animate-pulse-glow"></div>
        </div>
      </section>

      {/* Quick Navigation */}
      <section className="py-20">
        <div className="container mx-auto px-4">
          <div className="max-w-4xl mx-auto">
            <h2 className="text-3xl font-display font-bold text-gradient text-center mb-12 animate-fade-in">
              Explore My Portfolio
            </h2>
            
            <div className="grid md:grid-cols-2 gap-6">
              {quickLinks.map((link, index) => (
                <Card key={link.href} className="glass-effect shadow-card hover:shadow-glow transition-all duration-500 group animate-slide-in" style={{ animationDelay: `${index * 0.1}s` }}>
                  <CardContent className="p-6">
                    <Link to={link.href} className="block">
                      <h3 className="text-xl font-display font-semibold text-foreground group-hover:text-gradient transition-all duration-300 mb-2">
                        {link.label}
                      </h3>
                      <p className="text-muted-foreground mb-4">{link.description}</p>
                      <div className="flex items-center text-primary group-hover:translate-x-2 transition-transform duration-300">
                        <span className="text-sm font-medium">Learn more</span>
                        <ArrowRight className="w-4 h-4 ml-2" />
                      </div>
                    </Link>
                  </CardContent>
                </Card>
              ))}
            </div>
          </div>
        </div>
      </section>

      {/* Contact Section */}
      <section className="py-20 bg-gradient-accent">
        <div className="container mx-auto px-4">
          <div className="max-w-2xl mx-auto text-center">
            <h2 className="text-3xl font-display font-bold text-gradient mb-6 animate-fade-in">
              Let's Connect
            </h2>
            <p className="text-muted-foreground mb-8 animate-fade-in" style={{ animationDelay: '0.1s' }}>
              Interested in collaborating on machine learning projects or discussing data science opportunities? 
              I'd love to hear from you.
            </p>
            
            <div className="flex justify-center space-x-4 animate-fade-in" style={{ animationDelay: '0.2s' }}>
              <Button variant="outline" size="sm" className="hover:bg-primary hover:text-primary-foreground transition-all duration-300">
                <Mail className="w-4 h-4 mr-2" />
                Email
              </Button>
              <Button variant="outline" size="sm" className="hover:bg-primary hover:text-primary-foreground transition-all duration-300">
                <Github className="w-4 h-4 mr-2" />
                GitHub
              </Button>
              <Button variant="outline" size="sm" className="hover:bg-primary hover:text-primary-foreground transition-all duration-300">
                <Linkedin className="w-4 h-4 mr-2" />
                LinkedIn
              </Button>
            </div>
          </div>
        </div>
      </section>
    </Layout>
  );
};

export default Index;
