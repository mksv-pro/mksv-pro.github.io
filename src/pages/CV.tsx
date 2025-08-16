import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Download, Calendar, MapPin, Mail, Phone, Globe, Award, GraduationCap, Briefcase } from 'lucide-react';
import Layout from '@/components/Layout';

const CV = () => {
  const experience = [
    {
      title: "Senior Machine Learning Engineer",
      company: "TechCorp AI",
      period: "2022 - Present",
      location: "Remote",
      description: [
        "Lead development of ML models for predictive analytics, achieving 95% accuracy",
        "Architected scalable ML pipelines processing 1M+ daily transactions",
        "Mentored junior engineers and established ML best practices"
      ]
    },
    {
      title: "Data Scientist",
      company: "DataVision Inc.",
      period: "2020 - 2022",
      location: "San Francisco, CA",
      description: [
        "Developed computer vision models for autonomous vehicle perception",
        "Improved model performance by 30% through novel data augmentation techniques",
        "Collaborated with cross-functional teams to deploy models in production"
      ]
    },
    {
      title: "Research Assistant",
      company: "University AI Lab",
      period: "2019 - 2020",
      location: "Boston, MA",
      description: [
        "Conducted research on neural network optimization algorithms",
        "Published 3 papers in top-tier ML conferences",
        "Developed open-source tools used by 500+ researchers globally"
      ]
    }
  ];

  const education = [
    {
      degree: "M.S. in Computer Science",
      institution: "MIT",
      period: "2017 - 2019",
      specialization: "Machine Learning & Artificial Intelligence",
      gpa: "3.9/4.0"
    },
    {
      degree: "B.S. in Mathematics",
      institution: "Stanford University",
      period: "2013 - 2017",
      specialization: "Applied Mathematics & Statistics",
      gpa: "3.8/4.0"
    }
  ];

  const skills = {
    "Programming Languages": ["Python", "R", "JavaScript", "C++", "SQL"],
    "ML/AI Frameworks": ["TensorFlow", "PyTorch", "Scikit-learn", "XGBoost", "Keras"],
    "Data Tools": ["Pandas", "NumPy", "Matplotlib", "Plotly", "Jupyter"],
    "Cloud & DevOps": ["AWS", "Docker", "Kubernetes", "MLflow", "Git"],
    "Databases": ["PostgreSQL", "MongoDB", "Redis", "Elasticsearch"]
  };

  const achievements = [
    {
      title: "Best Paper Award",
      organization: "NeurIPS 2023",
      description: "Novel optimization techniques for large-scale neural networks"
    },
    {
      title: "AI Innovation Award",
      organization: "TechCorp",
      description: "Outstanding contribution to company's ML capabilities"
    },
    {
      title: "Open Source Contributor",
      organization: "TensorFlow",
      description: "Core contributor with 50+ merged pull requests"
    }
  ];

  const publications = [
    {
      title: "Adaptive Learning Rate Scheduling for Deep Neural Networks",
      venue: "NeurIPS 2023",
      authors: "MKSV et al.",
      citations: 127
    },
    {
      title: "Computer Vision for Autonomous Systems: A Comprehensive Survey",
      venue: "CVPR 2022",
      authors: "MKSV, Smith J., Doe A.",
      citations: 203
    },
    {
      title: "Efficient Training of Large Language Models with Gradient Compression",
      venue: "ICML 2022",
      authors: "MKSV, Johnson K.",
      citations: 89
    }
  ];

  return (
    <Layout>
      <div className="container mx-auto px-4 py-12">
        <div className="max-w-5xl mx-auto">
          {/* Header */}
          <div className="text-center mb-12 animate-fade-in">
            <h1 className="text-4xl md:text-5xl font-display font-bold text-gradient mb-4">
              Curriculum Vitae
            </h1>
            <p className="text-xl text-muted-foreground mb-6">
              Machine Learning Engineer & Data Scientist
            </p>
            <Button className="glow-effect bg-primary hover:bg-primary/90 text-primary-foreground">
              <Download className="w-4 h-4 mr-2" />
              Download PDF
            </Button>
          </div>

          <div className="grid lg:grid-cols-3 gap-8">
            {/* Left Column */}
            <div className="lg:col-span-1 space-y-6">
              {/* Contact Info */}
              <Card className="glass-effect shadow-card animate-slide-in">
                <CardHeader>
                  <CardTitle className="text-lg text-gradient">Contact</CardTitle>
                </CardHeader>
                <CardContent className="space-y-3">
                  <div className="flex items-center space-x-2 text-sm">
                    <Mail className="w-4 h-4 text-primary" />
                    <span>mksv@example.com</span>
                  </div>
                  <div className="flex items-center space-x-2 text-sm">
                    <Phone className="w-4 h-4 text-primary" />
                    <span>+1 (555) 123-4567</span>
                  </div>
                  <div className="flex items-center space-x-2 text-sm">
                    <MapPin className="w-4 h-4 text-primary" />
                    <span>San Francisco, CA</span>
                  </div>
                  <div className="flex items-center space-x-2 text-sm">
                    <Globe className="w-4 h-4 text-primary" />
                    <span>mksv.dev</span>
                  </div>
                </CardContent>
              </Card>

              {/* Skills */}
              <Card className="glass-effect shadow-card animate-slide-in" style={{ animationDelay: '0.1s' }}>
                <CardHeader>
                  <CardTitle className="text-lg text-gradient">Skills</CardTitle>
                </CardHeader>
                <CardContent className="space-y-4">
                  {Object.entries(skills).map(([category, items]) => (
                    <div key={category}>
                      <h4 className="font-semibold text-sm mb-2 text-foreground">{category}</h4>
                      <div className="flex flex-wrap gap-1">
                        {items.map((skill) => (
                          <Badge key={skill} variant="secondary" className="text-xs bg-accent/50">
                            {skill}
                          </Badge>
                        ))}
                      </div>
                    </div>
                  ))}
                </CardContent>
              </Card>

              {/* Achievements */}
              <Card className="glass-effect shadow-card animate-slide-in" style={{ animationDelay: '0.2s' }}>
                <CardHeader>
                  <CardTitle className="text-lg text-gradient flex items-center">
                    <Award className="w-5 h-5 mr-2" />
                    Achievements
                  </CardTitle>
                </CardHeader>
                <CardContent className="space-y-3">
                  {achievements.map((achievement, index) => (
                    <div key={index} className="border-l-2 border-primary/30 pl-3">
                      <h4 className="font-semibold text-sm text-foreground">{achievement.title}</h4>
                      <p className="text-xs text-primary">{achievement.organization}</p>
                      <p className="text-xs text-muted-foreground mt-1">{achievement.description}</p>
                    </div>
                  ))}
                </CardContent>
              </Card>
            </div>

            {/* Right Column */}
            <div className="lg:col-span-2 space-y-6">
              {/* Experience */}
              <Card className="glass-effect shadow-card animate-fade-in" style={{ animationDelay: '0.1s' }}>
                <CardHeader>
                  <CardTitle className="text-xl text-gradient flex items-center">
                    <Briefcase className="w-5 h-5 mr-2" />
                    Professional Experience
                  </CardTitle>
                </CardHeader>
                <CardContent className="space-y-6">
                  {experience.map((job, index) => (
                    <div key={index} className="border-l-2 border-primary/30 pl-6 relative">
                      <div className="absolute w-3 h-3 bg-primary rounded-full -left-[7px] top-0"></div>
                      <div className="mb-2">
                        <h3 className="text-lg font-semibold text-foreground">{job.title}</h3>
                        <p className="text-primary font-medium">{job.company}</p>
                        <div className="flex items-center space-x-4 text-sm text-muted-foreground mt-1">
                          <span className="flex items-center">
                            <Calendar className="w-3 h-3 mr-1" />
                            {job.period}
                          </span>
                          <span className="flex items-center">
                            <MapPin className="w-3 h-3 mr-1" />
                            {job.location}
                          </span>
                        </div>
                      </div>
                      <ul className="space-y-1 text-sm text-muted-foreground">
                        {job.description.map((item, i) => (
                          <li key={i} className="flex items-start">
                            <span className="w-1 h-1 bg-primary rounded-full mt-2 mr-2 flex-shrink-0"></span>
                            {item}
                          </li>
                        ))}
                      </ul>
                    </div>
                  ))}
                </CardContent>
              </Card>

              {/* Education */}
              <Card className="glass-effect shadow-card animate-fade-in" style={{ animationDelay: '0.2s' }}>
                <CardHeader>
                  <CardTitle className="text-xl text-gradient flex items-center">
                    <GraduationCap className="w-5 h-5 mr-2" />
                    Education
                  </CardTitle>
                </CardHeader>
                <CardContent className="space-y-4">
                  {education.map((edu, index) => (
                    <div key={index} className="border-l-2 border-primary/30 pl-6 relative">
                      <div className="absolute w-3 h-3 bg-primary rounded-full -left-[7px] top-0"></div>
                      <h3 className="text-lg font-semibold text-foreground">{edu.degree}</h3>
                      <p className="text-primary font-medium">{edu.institution}</p>
                      <div className="flex items-center justify-between text-sm text-muted-foreground mt-1">
                        <span>{edu.period}</span>
                        <span>GPA: {edu.gpa}</span>
                      </div>
                      <p className="text-sm text-muted-foreground mt-1">{edu.specialization}</p>
                    </div>
                  ))}
                </CardContent>
              </Card>

              {/* Publications */}
              <Card className="glass-effect shadow-card animate-fade-in" style={{ animationDelay: '0.3s' }}>
                <CardHeader>
                  <CardTitle className="text-xl text-gradient">Publications</CardTitle>
                </CardHeader>
                <CardContent className="space-y-4">
                  {publications.map((pub, index) => (
                    <div key={index} className="border-l-2 border-primary/30 pl-4">
                      <h4 className="font-semibold text-foreground">{pub.title}</h4>
                      <p className="text-sm text-primary">{pub.venue}</p>
                      <p className="text-sm text-muted-foreground">{pub.authors}</p>
                      <p className="text-xs text-muted-foreground mt-1">Citations: {pub.citations}</p>
                    </div>
                  ))}
                </CardContent>
              </Card>
            </div>
          </div>
        </div>
      </div>
    </Layout>
  );
};

export default CV;