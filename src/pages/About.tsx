import { Card, CardContent } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Mail, Github, Linkedin, MapPin, Download } from 'lucide-react';
import Layout from '@/components/Layout';

const Home = () => {
  const skills = [
    'Statistical Physics',
    'Machine Learning',
    'Stochastic Processes',
    'Quantitative Finance',
    'Theoretical Macroeconomics',
    'Computational Science',
    'Data Science',
    'Statistical Analysis',
    'Python',
    'JavaScript',
    'R'
  ];

  return (
    <Layout>
      <div className="container mx-auto px-4 py-12">
        <div className="max-w-5xl mx-auto">

          {/* Main Grid */}
          <div className="grid md:grid-cols-3 gap-8">

            {/* Column 1: Profile & Contact */}
            <div className="md:col-span-1 animate-slide-in">
              <Card className="glass-effect shadow-card">
                <CardContent className="p-6">
                  <div className="aspect-[4/5] rounded-lg mb-4 overflow-hidden border-2 border-border">
                    <img
                      src="306e129075e52b3562a53a6afc370544-removebg-preview.png"
                      alt="Profile Picture"
                      className="w-full h-full object-cover"
                    />
                  </div>

                  {/* Contact Info */}
                  <div className="space-y-3">
                    <div className="flex items-center space-x-2 text-sm">
                      <Mail className="w-4 h-4 text-primary" />
                      <span>pro.mikesilva@gmail.com</span>
                    </div>
                    <div className="flex items-center space-x-2 text-sm">
                      <MapPin className="w-4 h-4 text-primary" />
                      <span>Paris, France</span>
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

                    {/* Download CV */}
                    <a
                      href={`${import.meta.env.BASE_URL}CV_modern.pdf`}
                      download
                      className="inline-flex items-center mt-2 bg-primary hover:bg-primary/90 text-primary-foreground px-4 py-2 rounded-md font-medium transition-colors"
                    >
                      <Download className="w-4 h-4 mr-2" />
                      Download CV
                    </a>
                  </div>
                </CardContent>
              </Card>
            </div>

            {/* Column 2: Description, Skills & Background */}
            <div className="md:col-span-2 space-y-6 animate-fade-in" style={{ animationDelay: '0.2s' }}>

              {/* Description */}
              <Card className="glass-effect shadow-card">
                <CardContent className="p-6">
                  <h2 className="text-2xl font-display font-semibold mb-4 text-gradient">
                    Hello, I'm Mike Silva
                  </h2>
                  <div className="prose prose-invert max-w-none space-y-4">
                    <p className="text-muted-foreground leading-relaxed text-justify">
                      I am a research master's student in applied mathematics at 
                      <a href="https://www.sorbonne-universite.fr/" className="text-primary hover:text-primary/80 transition-colors"> Sorbonne University</a>, 
                      studying quantum physics at <a href="https://u-paris.fr/" className="text-primary hover:text-primary/80 transition-colors"> University Paris Cité</a>, 
                      and a bachelor's student in economics & finance at <a href="https://dauphine.psl.eu/" className="text-primary hover:text-primary/80 transition-colors"> University Paris-Dauphine PSL</a>.
                    </p>
                    <p className="text-muted-foreground leading-relaxed text-justify">
                      My areas of interest include statistical physics, machine learning, stochastic processes, quantitative finance, theoretical macroeconomics, and computational science.
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

              {/* Background / Education */}
              <Card className="glass-effect shadow-card">
                <CardContent className="p-6">
                  <h3 className="text-xl font-display font-semibold mb-4 text-gradient">
                    Background
                  </h3>
                  <div className="space-y-4">
                    <div className="border-l-2 border-primary/30 pl-4">
                      <h4 className="font-semibold text-foreground"> Sorbonne University - Applied Mathematics</h4>
                      <p className="text-sm text-muted-foreground">
                        <h4>
                          @MSc Functional Analysis, Computational Statistics, Stochastic Calculus Applied in Finance, Fourier Theory & Machine Learning (Present)
                          </h4>
                      </p>
                    </div>
                    <div className="border-l-2 border-primary/30 pl-4">
                      <h4 className="font-semibold text-foreground">University Paris Cité - Theoretical Physics</h4>
                      <p className="text-sm text-muted-foreground">                  
                        <h4>
                          @MSc Quantum Mechanics, Statistical Physics, Condensed Matter Physics, High Energy Physics & Computational Science (Present)
                        </h4>
                      </p>
                    </div>
                    <div className="border-l-2 border-primary/30 pl-4">
                      <h4 className="font-semibold text-foreground">Dauphine PSL - Economics & Finance</h4>
                      <p className="text-sm text-muted-foreground">
                        @BSc Microeconomics, Macroeconomics, Econometrics, Corporate Finance, Asset Management, Financial Markets & Data Science (Present)
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

export default Home;
