// Importation des composants UI personnalisés
import { Card, CardContent } from '@/components/ui/card'; // Composants pour les cartes de contenu
import { Badge } from '@/components/ui/badge'; // Badge pour les compétences

// Importation des icônes Lucide
import { Mail, Github, Linkedin, MapPin } from 'lucide-react'; // Icônes pour email, GitHub, LinkedIn, localisation

// Layout principal de la page (header, footer, etc.)
import Layout from '@/components/Layout';


// Déclaration du composant principal "About"
const About = () => {
  // Liste des compétences affichées avec des badges
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

  // Contenu retourné par le composant
  return (
    <Layout> {/* Enveloppe globale avec le layout */}
      <div className="container mx-auto px-4 py-12"> {/* Conteneur centré avec padding */}
        <div className="max-w-4xl mx-auto"> {/* Largeur maximale pour limiter la taille du contenu */}

          {/* Titre principal (invisible ici mais prévu) */}
          <h1 className="text-4xl md:text-5xl font-display font-bold text-gradient mb-8 animate-fade-in">
          </h1>
          
          {/* Grille divisée en 3 colonnes sur grand écran */}
          <div className="grid md:grid-cols-3 gap-8">

            {/* === Colonne 1 : Profil et contact === */}
            <div className="md:col-span-1 animate-slide-in">
              <Card className="glass-effect shadow-card"> {/* Carte avec effet visuel */}
                <CardContent className="p-6"> {/* Contenu interne avec padding */}
                  
                  {/* Image de profil */}
                  <div className="aspect-[4/5] rounded-lg mb-4 overflow-hidden border-2 border-border">
                    <img
                      src="\1718098190-tar-fouduvillagedream.webp"
                      alt="Profile Picture"
                      className="w-full h-full object-cover" // Image responsive
                    />
                  </div>
                  
                  {/* Informations de contact */}
                  <div className="space-y-3">
                    {/* Email */}
                    <div className="flex items-center space-x-2 text-sm">
                      <Mail className="w-4 h-4 text-primary" />
                      <span>pro.mikesilva@gmail.com</span>
                    </div>
                    {/* Localisation */}
                    <div className="flex items-center space-x-2 text-sm">
                      <MapPin className="w-4 h-4 text-primary" />
                      <span>Paris, France</span>
                    </div>
                    {/* GitHub */}
                    <div className="flex items-center space-x-2 text-sm">
                      <Github className="w-4 h-4 text-primary" />
                      <a href="https://github.com/mksv-pro" className="hover:text-primary transition-colors">
                        github.com/mksv-pro
                      </a>
                    </div>
                    {/* LinkedIn */}
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

            {/* === Colonne 2 et 3 : Infos, compétences, formation === */}
            <div className="md:col-span-2 space-y-6 animate-fade-in" style={{ animationDelay: '0.2s' }}>
              
              {/* --- Section : Description --- */}
              <Card className="glass-effect shadow-card">
                <CardContent className="p-6">
                  <h2 className="text-2xl font-display font-semibold mb-4 text-gradient">
                    Hello, I'm Mike Silva
                  </h2>
                  <div className="prose prose-invert max-w-none space-y-4">
                    {/* Présentation académique */}
                    <p className="text-muted-foreground leading-relaxed text-justify">
                      I am a research master's student in mathematics & theoretical physics at 
                      <a href="https://www.sorbonne-universite.fr/" className="text-primary hover:text-primary/80 transition-colors"> Sorbonne Université</a> and and a bachelor's student in economics & finance at <a href="https://dauphine.psl.eu/" className="text-primary hover:text-primary/80 transition-colors"> Dauphine PSL</a>.
                    </p>
                    {/* Intérêts de recherche */}
                    <p className="text-muted-foreground leading-relaxed text-justify">
                      My areas of interest are statistical physics, machine learning, stochastic processes, quantitative finance, theoretical macroeconomics and computational science.
                    </p>
                    {/* Lien vers le CV */}
                    <p className="text-muted-foreground leading-relaxed text-justify">
                      You can view my CV <a href="/cv" className="text-primary hover:text-primary/80 transition-colors">here</a>.
                    </p>
                  </div>
                </CardContent>
              </Card>

              {/* --- Section : Compétences --- */}
              <Card className="glass-effect shadow-card">
                <CardContent className="p-6">
                  <h3 className="text-xl font-display font-semibold mb-4 text-gradient">
                    Skills & Expertise
                  </h3>
                  {/* Affichage dynamique de chaque skill avec animation */}
                  <div className="flex flex-wrap gap-2">
                    {skills.map((skill, index) => (
                      <Badge 
                        key={skill} 
                        variant="secondary" 
                        className="bg-accent hover:bg-primary hover:text-primary-foreground transition-all duration-300 cursor-default animate-slide-in"
                        style={{ animationDelay: `${index * 0.1}s` }} // Délai d’animation par badge
                      >
                        {skill}
                      </Badge>
                    ))}
                  </div>
                </CardContent>
              </Card>

              {/* --- Section : Parcours académique --- */}
              <Card className="glass-effect shadow-card">
                <CardContent className="p-6">
                  <h3 className="text-xl font-display font-semibold mb-4 text-gradient">
                    Background
                  </h3>
                  <div className="space-y-4">
                    {/* Master */}
                    <div className="border-l-2 border-primary/30 pl-4">
                      <h4 className="font-semibold text-foreground"> Research Master - Applied Mathematics</h4>
                      <p className="text-sm text-muted-foreground">
                        Sorbonne Université - Functional Analysis, Stochastic Calculus & Machine Learning
                      </p>
                    </div>
                    {/* Master */}
                    <div className="border-l-2 border-primary/30 pl-4">
                      <h4 className="font-semibold text-foreground"> Research Master - Theoretical Physics </h4>
                      <p className="text-sm text-muted-foreground">
                        Dauphine PSL - Quantum Mechanics, Statistical Physics, High Energy Physics, Computational Science
                      </p>
                    </div>
                    {/* Licence */}
                    <div className="border-l-2 border-primary/30 pl-4">
                      <h4 className="font-semibold text-foreground"> Bachelor - Economics & Finance</h4>
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
