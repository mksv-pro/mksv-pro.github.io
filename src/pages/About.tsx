import { Card, CardContent } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Mail, Github, Linkedin, MapPin } from 'lucide-react';
import Layout from '@/components/Layout';

const About = () => {
  const skills = [
    'Statistical Physics',
    'Machine Learning',
    'Stochastic Processes',
    'Quantitative Finance',
    'Theoretical Macroeconomics',
    'Computational Science',
    'Mathematics',
    'Physics',
    'Python',
    'R'
  ];

  return (
    <Layout>
      <div className="container mx-auto px-4 py-12">
        <div className="max-w-4xl mx-auto">
          <h1 className="text-4xl md:text-5xl font-display font-bold text-gradient mb-8 animate-fade-in">
            About Me
          </h1>
          
          <div className="grid md:grid-cols-3 gap-8">
            {/* Profile Image */}
            <div className="md:col-span-1 animate-slide-in">
              <Card className="glass-effect shadow-card">
                <CardContent className="p-6">
                  <div className="aspect-[4/5] bg-muted rounded-lg mb-4 flex items-center justify-center border-2 border-dashed border-border">
                    <div className="text-center text-muted-foreground">
                      <div className="w-16 h-16 bg-primary/20 rounded-full mx-auto mb-2 flex items-center justify-center">
                        <span className="text-2xl">🎨</span>
                      </div>
                      <p className="text-sm">Your Drawing Space</p>
                      <p className="text-xs mt-1">Upload your artwork here</p>
                    </div>
                  </div>
                  
                  {/* Contact Info */}
                  <div className="space-y-3">
                    <div className="flex items-center space-x-2 text-sm">
                      <Mail className="w-4 h-4 text-primary" />
                      <span>mksv.contact@example.com</span>
                    </div>
                    <div className="flex items-center space-x-2 text-sm">
                      <MapPin className="w-4 h-4 text-primary" />
                      <span>Location, Country</span>
                    </div>
                    <div className="flex items-center space-x-2 text-sm">
                      <Github className="w-4 h-4 text-primary" />
                      <a href="https://github.com/mksv-pro" className="hover:text-primary transition-colors">
                        github.com/mksv-pro
                      </a>
                    </div>
                    <div className="flex items-center space-x-2 text-sm">
                      <Linkedin className="w-4 h-4 text-primary" />
                      <a href="#" className="hover:text-primary transition-colors">
                        LinkedIn Profile
                      </a>
                    </div>
                  </div>
                </CardContent>
              </Card>
            </div>
            
            {/* Description */}
            <div className="md:col-span-2 space-y-6 animate-fade-in" style={{ animationDelay: '0.2s' }}>
              <Card className="glass-effect shadow-card">
                <CardContent className="p-6">
                  <h2 className="text-2xl font-display font-semibold mb-4 text-gradient">
                    Hello, I'm MKSV
                  </h2>
                  <div className="prose prose-invert max-w-none space-y-4">
                    <p className="text-muted-foreground leading-relaxed">
                      I am a <strong>research master</strong> student in mathematics and physics at 
                      <a href="https://www.sorbonne-universite.fr/" className="text-primary hover:text-primary/80 transition-colors"> Sorbonne Université</a> 
                      and in finance at 
                      <a href="https://dauphine.psl.eu/" className="text-primary hover:text-primary/80 transition-colors"> Dauphine PSL</a>.
                    </p>
                    <p className="text-muted-foreground leading-relaxed">
                      My areas of interest are <strong>statistical physics</strong>, <strong>machine learning</strong>, 
                      <strong>stochastic processes</strong>, <strong>quantitative finance</strong>, 
                      <strong>theoretical macroeconomics</strong> and <strong>computational science</strong>.
                    </p>
                    <p className="text-muted-foreground leading-relaxed">
                      You can view my CV <a href="/cv" className="text-primary hover:text-primary/80 transition-colors">here</a>.
                    </p>
                  </div>
                </CardContent>
              </Card>
              
              {/* Skills */}
              <Card className="glass-effect shadow-card">
                <CardContent className="p-6">
                  <h3 className="text-xl font-display font-semibold mb-4 text-gradient">
                    Skills & Expertise
                  </h3>
                  <div className="flex flex-wrap gap-2">
                    {skills.map((skill, index) => (
                      <Badge 
                        key={skill} 
                        variant="secondary" 
                        className="bg-accent hover:bg-primary hover:text-primary-foreground transition-all duration-300 cursor-default animate-slide-in"
                        style={{ animationDelay: `${index * 0.1}s` }}
                      >
                        {skill}
                      </Badge>
                    ))}
                  </div>
                </CardContent>
              </Card>
              
              {/* Education & Background */}
              <Card className="glass-effect shadow-card">
                <CardContent className="p-6">
                  <h3 className="text-xl font-display font-semibold mb-4 text-gradient">
                    Background
                  </h3>
                  <div className="space-y-4">
                    <div className="border-l-2 border-primary/30 pl-4">
                      <h4 className="font-semibold text-foreground">Research Master - Mathematics & Physics</h4>
                      <p className="text-sm text-muted-foreground">
                        Sorbonne Université - Focus on statistical physics and computational methods
                      </p>
                    </div>
                    <div className="border-l-2 border-primary/30 pl-4">
                      <h4 className="font-semibold text-foreground">Research Master - Finance</h4>
                      <p className="text-sm text-muted-foreground">
                        Dauphine PSL - Specialization in quantitative finance and macroeconomics
                      </p>
                    </div>
                  </div>
                </CardContent>
              </Card>
            </div>
          </div>
        </div>
      </div>
    </Layout>
  );
};

export default About;