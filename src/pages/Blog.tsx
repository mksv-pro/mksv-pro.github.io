import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Clock, ArrowRight, Tag, Calendar as CalendarIcon } from 'lucide-react';
import Layout from '@/components/Layout';

const Blog = () => {
  const blogPosts = [
    {
      id: 1,
      title: "The Future of Machine Learning: Trends and Predictions for 2024",
      excerpt: "Exploring the latest developments in ML, from transformer architectures to quantum computing applications, and what they mean for the future of AI.",
      content: "Machine learning continues to evolve at an unprecedented pace. In this post, we'll explore the key trends shaping the field in 2024, including the rise of foundation models, advances in quantum machine learning, and the growing importance of AI safety and interpretability...",
      publishDate: "2024-01-15",
      readTime: "8 min read",
      tags: ["Machine Learning", "AI", "Technology", "Future"],
      featured: true
    },
    {
      id: 2,
      title: "Optimizing Neural Networks: A Deep Dive into Advanced Techniques",
      excerpt: "Comprehensive guide to modern optimization methods for deep learning, including adaptive learning rates, gradient clipping, and novel optimization algorithms.",
      content: "Neural network optimization has come a long way from vanilla SGD. Today's practitioners have access to sophisticated optimization techniques that can dramatically improve model performance and training efficiency...",
      publishDate: "2024-01-10",
      readTime: "12 min read",
      tags: ["Deep Learning", "Optimization", "Neural Networks", "Research"],
      featured: true
    },
    {
      id: 3,
      title: "Computer Vision in Production: Lessons Learned",
      excerpt: "Real-world insights from deploying computer vision models at scale, including performance optimization, edge deployment, and handling edge cases.",
      content: "Deploying computer vision models in production environments presents unique challenges. From latency requirements to hardware constraints, here's what I've learned from years of production deployments...",
      publishDate: "2024-01-05",
      readTime: "10 min read",
      tags: ["Computer Vision", "Production", "MLOps", "Engineering"],
      featured: false
    },
    {
      id: 4,
      title: "Building Robust Data Pipelines for ML: Best Practices",
      excerpt: "Essential strategies for creating reliable, scalable data pipelines that support machine learning workflows and ensure data quality.",
      content: "Data quality is paramount in machine learning. A robust data pipeline is the foundation of any successful ML project. In this comprehensive guide, we'll cover design patterns, monitoring strategies, and tools for building production-ready data pipelines...",
      publishDate: "2023-12-28",
      readTime: "15 min read",
      tags: ["Data Engineering", "MLOps", "Pipelines", "Best Practices"],
      featured: false
    },
    {
      id: 5,
      title: "Understanding Transformer Architectures: From Attention to Applications",
      excerpt: "Complete breakdown of transformer models, from the original attention mechanism to modern variants like GPT and BERT, with practical implementation tips.",
      content: "Transformers have revolutionized natural language processing and beyond. This deep dive explores the architecture, implementation details, and practical considerations for using transformers in your projects...",
      publishDate: "2023-12-20",
      readTime: "18 min read",
      tags: ["Transformers", "NLP", "Deep Learning", "Architecture"],
      featured: true
    },
    {
      id: 6,
      title: "Time Series Forecasting with Modern ML Techniques",
      excerpt: "Comparing traditional statistical methods with modern machine learning approaches for time series prediction, including practical implementation examples.",
      content: "Time series forecasting has been transformed by machine learning. We'll compare traditional methods like ARIMA with modern approaches including LSTMs, Prophet, and transformer-based models...",
      publishDate: "2023-12-15",
      readTime: "14 min read",
      tags: ["Time Series", "Forecasting", "Statistics", "Machine Learning"],
      featured: false
    }
  ];

  const categories = [
    { name: "All", count: blogPosts.length },
    { name: "Machine Learning", count: 4 },
    { name: "Deep Learning", count: 3 },
    { name: "Computer Vision", count: 2 },
    { name: "MLOps", count: 2 },
    { name: "Research", count: 2 }
  ];

  const featuredPosts = blogPosts.filter(post => post.featured);
  const recentPosts = blogPosts.filter(post => !post.featured);

  const formatDate = (dateString: string) => {
    return new Date(dateString).toLocaleDateString('en-US', {
      year: 'numeric',
      month: 'long',
      day: 'numeric'
    });
  };

  return (
    <Layout>
      <div className="container mx-auto px-4 py-12">
        <div className="max-w-6xl mx-auto">
          <p className="text-xl text-muted-foreground mb-12 animate-fade-in" style={{ animationDelay: '0.1s' }}>
            Insights, tutorials, and thoughts on machine learning, data science, and technology.
          </p>

          <div className="grid lg:grid-cols-4 gap-8">
            {/* Sidebar */}
            <div className="lg:col-span-1">
              <Card className="glass-effect shadow-card animate-slide-in sticky top-24">
                <CardHeader>
                  <CardTitle className="text-lg text-gradient">Categories</CardTitle>
                </CardHeader>
                <CardContent className="space-y-2">
                  {categories.map((category) => (
                    <Button
                      key={category.name}
                      variant="ghost"
                      size="sm"
                      className="w-full justify-between hover:bg-accent hover:text-accent-foreground transition-all duration-300"
                    >
                      <span>{category.name}</span>
                      <Badge variant="secondary" className="bg-accent/50">
                        {category.count}
                      </Badge>
                    </Button>
                  ))}
                </CardContent>
              </Card>
            </div>

            {/* Main Content */}
            <div className="lg:col-span-3 space-y-12">
              {/* Featured Posts */}
              <section>
                <h2 className="text-2xl font-display font-semibold text-gradient mb-8 animate-slide-in">
                  Featured Articles
                </h2>
                <div className="grid md:grid-cols-2 gap-6">
                  {featuredPosts.slice(0, 2).map((post, index) => (
                    <Card key={post.id} className="glass-effect shadow-card hover:shadow-glow transition-all duration-500 group animate-fade-in" style={{ animationDelay: `${index * 0.1}s` }}>
                      <CardHeader>
                        <div className="flex items-center space-x-2 text-sm text-muted-foreground mb-2">
                          <CalendarIcon className="w-4 h-4" />
                          <span>{formatDate(post.publishDate)}</span>
                          <span>•</span>
                          <Clock className="w-4 h-4" />
                          <span>{post.readTime}</span>
                        </div>
                        <CardTitle className="text-xl font-display group-hover:text-gradient transition-all duration-300 line-clamp-2">
                          {post.title}
                        </CardTitle>
                      </CardHeader>
                      <CardContent className="space-y-4">
                        <p className="text-muted-foreground text-sm leading-relaxed line-clamp-3">
                          {post.excerpt}
                        </p>
                        
                        <div className="flex flex-wrap gap-1">
                          {post.tags.slice(0, 3).map((tag) => (
                            <Badge key={tag} variant="outline" className="text-xs bg-accent/50">
                              <Tag className="w-2 h-2 mr-1" />
                              {tag}
                            </Badge>
                          ))}
                        </div>
                        
                        <Button 
                          variant="outline" 
                          size="sm" 
                          className="group/btn hover:bg-primary hover:text-primary-foreground transition-all duration-300"
                        >
                          Read More
                          <ArrowRight className="w-4 h-4 ml-2 group-hover/btn:translate-x-1 transition-transform duration-300" />
                        </Button>
                      </CardContent>
                    </Card>
                  ))}
                </div>
              </section>

              {/* Recent Posts */}
              <section>
                <h2 className="text-2xl font-display font-semibold text-gradient mb-8 animate-slide-in">
                  Recent Articles
                </h2>
                <div className="space-y-6">
                  {recentPosts.map((post, index) => (
                    <Card key={post.id} className="glass-effect shadow-card hover:shadow-glow transition-all duration-500 group animate-fade-in" style={{ animationDelay: `${index * 0.1}s` }}>
                      <CardContent className="p-6">
                        <div className="flex flex-col md:flex-row md:items-start space-y-4 md:space-y-0 md:space-x-6">
                          <div className="flex-1">
                            <div className="flex items-center space-x-2 text-sm text-muted-foreground mb-2">
                              <CalendarIcon className="w-4 h-4" />
                              <span>{formatDate(post.publishDate)}</span>
                              <span>•</span>
                              <Clock className="w-4 h-4" />
                              <span>{post.readTime}</span>
                            </div>
                            
                            <h3 className="text-xl font-display font-semibold group-hover:text-gradient transition-all duration-300 mb-3">
                              {post.title}
                            </h3>
                            
                            <p className="text-muted-foreground text-sm leading-relaxed mb-4 line-clamp-2">
                              {post.excerpt}
                            </p>
                            
                            <div className="flex flex-wrap gap-1 mb-4">
                              {post.tags.slice(0, 4).map((tag) => (
                                <Badge key={tag} variant="outline" className="text-xs bg-accent/50">
                                  <Tag className="w-2 h-2 mr-1" />
                                  {tag}
                                </Badge>
                              ))}
                            </div>
                          </div>
                          
                          <div className="flex-shrink-0">
                            <Button 
                              variant="outline" 
                              size="sm" 
                              className="group/btn hover:bg-primary hover:text-primary-foreground transition-all duration-300"
                            >
                              Read More
                              <ArrowRight className="w-4 h-4 ml-2 group-hover/btn:translate-x-1 transition-transform duration-300" />
                            </Button>
                          </div>
                        </div>
                      </CardContent>
                    </Card>
                  ))}
                </div>
              </section>

              {/* Newsletter Signup */}
              <Card className="glass-effect shadow-card bg-gradient-accent animate-fade-in">
                <CardContent className="p-8 text-center">
                  <h3 className="text-2xl font-display font-bold text-gradient mb-4">
                    Stay Updated
                  </h3>
                  <p className="text-muted-foreground mb-6 max-w-md mx-auto">
                    Get the latest articles on machine learning, data science, and AI directly in your inbox.
                  </p>
                  <div className="flex flex-col sm:flex-row gap-4 max-w-md mx-auto">
                    <input 
                      type="email" 
                      placeholder="Enter your email"
                      className="flex-1 px-4 py-2 bg-input border border-border rounded-lg focus:outline-none focus:ring-2 focus:ring-primary text-foreground"
                    />
                    <Button className="glow-effect bg-primary hover:bg-primary/90 text-primary-foreground">
                      Subscribe
                    </Button>
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

export default Blog;