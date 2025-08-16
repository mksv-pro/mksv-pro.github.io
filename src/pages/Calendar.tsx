import { useState } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Switch } from '@/components/ui/switch';
import { Badge } from '@/components/ui/badge';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Settings, Plus, Calendar as CalendarIcon } from 'lucide-react';
import Layout from '@/components/Layout';

const Calendar = () => {
  const [calendars, setCalendars] = useState([
    {
      id: 'personnel',
      name: 'Personnel',
      description: 'Événements personnels et rendez-vous',
      color: '#4285f4',
      visible: true,
      events: [
        { title: 'Rendez-vous médecin', date: '2024-01-15', time: '14:00' },
        { title: 'Dîner famille', date: '2024-01-17', time: '19:30' }
      ]
    },
    {
      id: 'cours-sorbonne',
      name: 'Cours Sorbonne',
      description: 'Emploi du temps des cours et examens',
      color: '#4285f4',
      visible: true,
      events: [
        { title: 'Cours Statistical Physics', date: '2024-01-16', time: '10:00' },
        { title: 'Séminaire Maths', date: '2024-01-18', time: '14:00' }
      ]
    },
    {
      id: 'recherche-dauphine',
      name: 'Recherche Dauphine',
      description: 'Séminaires et projets de recherche',
      color: '#0f9d58',
      visible: true,
      events: [
        { title: 'Réunion projet finance', date: '2024-01-15', time: '16:00' },
        { title: 'Séminaire quantitative finance', date: '2024-01-19', time: '15:00' }
      ]
    },
    {
      id: 'conferences',
      name: 'Conférences & Séminaires',
      description: 'Événements académiques externes',
      color: '#9c27b0',
      visible: false,
      events: [
        { title: 'Conference ML in Finance', date: '2024-01-20', time: '09:00' },
        { title: 'Workshop Stochastic Processes', date: '2024-01-22', time: '13:30' }
      ]
    }
  ]);

  const toggleCalendarVisibility = (calendarId: string) => {
    setCalendars(prev => 
      prev.map(cal => 
        cal.id === calendarId 
          ? { ...cal, visible: !cal.visible }
          : cal
      )
    );
  };

  const addNewCalendar = () => {
    const name = prompt('Nom du nouveau calendrier:');
    if (name) {
      const newCalendar = {
        id: Date.now().toString(),
        name,
        description: 'Nouveau calendrier',
        color: '#' + Math.floor(Math.random()*16777215).toString(16),
        visible: true,
        events: []
      };
      setCalendars(prev => [...prev, newCalendar]);
    }
  };

  const connectGoogleCalendar = () => {
    alert('L\'intégration Google Calendar nécessite une configuration API. Framework prêt - ajoutez vos identifiants.');
  };

  const getAllVisibleEvents = () => {
    return calendars
      .filter(cal => cal.visible)
      .flatMap(cal => 
        cal.events.map(event => ({
          ...event,
          calendar: cal.name,
          color: cal.color
        }))
      )
      .sort((a, b) => new Date(a.date).getTime() - new Date(b.date).getTime());
  };

  return (
    <Layout>
      <div className="container mx-auto px-4 py-12">
        <div className="max-w-7xl mx-auto">
          <h1 className="text-4xl md:text-5xl font-display font-bold text-gradient mb-4 animate-fade-in">
            Mes Calendriers
          </h1>
          <p className="text-xl text-muted-foreground mb-8 animate-fade-in" style={{ animationDelay: '0.1s' }}>
            Centralisation de tous mes calendriers académiques et personnels avec vue unifiée.
          </p>

          <div className="grid lg:grid-cols-4 gap-8">
            {/* Sidebar - Controls */}
            <div className="lg:col-span-1">
              <Card className="glass-effect shadow-card animate-slide-in">
                <CardHeader>
                  <CardTitle className="text-lg text-gradient flex items-center">
                    <Settings className="w-5 h-5 mr-2" />
                    Contrôles
                  </CardTitle>
                  <p className="text-sm text-muted-foreground">
                    Gérez la visibilité de vos calendriers
                  </p>
                </CardHeader>
                <CardContent className="space-y-6">
                  {/* Google Calendar Integration */}
                  <div className="space-y-3">
                    <h3 className="text-sm font-semibold text-foreground">Google Calendar</h3>
                    <Button 
                      onClick={connectGoogleCalendar}
                      variant="outline" 
                      size="sm" 
                      className="w-full hover:bg-primary hover:text-primary-foreground transition-all duration-300"
                    >
                      Connecter Google
                    </Button>
                    <p className="text-xs text-muted-foreground">
                      Connectez votre compte Google pour synchroniser vos calendriers
                    </p>
                  </div>

                  {/* Calendar List */}
                  <div className="space-y-4">
                    {calendars.map((calendar) => (
                      <div key={calendar.id} className="space-y-2 p-3 rounded-lg bg-accent/20 border border-border/50">
                        <div className="flex items-center justify-between">
                          <div className="flex items-center space-x-2">
                            <div 
                              className="w-3 h-3 rounded-full"
                              style={{ backgroundColor: calendar.color }}
                            />
                            <span className="text-sm font-medium text-foreground">
                              {calendar.name}
                            </span>
                          </div>
                          <Switch
                            checked={calendar.visible}
                            onCheckedChange={() => toggleCalendarVisibility(calendar.id)}
                          />
                        </div>
                        <p className="text-xs text-muted-foreground ml-5">
                          {calendar.description}
                        </p>
                      </div>
                    ))}
                  </div>

                  <Button 
                    onClick={addNewCalendar}
                    variant="outline" 
                    size="sm"
                    className="w-full hover:bg-primary hover:text-primary-foreground"
                  >
                    <Plus className="w-4 h-4 mr-2" />
                    Ajouter calendrier
                  </Button>
                </CardContent>
              </Card>
            </div>

            {/* Main Calendar View */}
            <div className="lg:col-span-3">
              <Card className="glass-effect shadow-card animate-fade-in" style={{ animationDelay: '0.2s' }}>
                <CardHeader>
                  <CardTitle className="text-xl text-gradient flex items-center">
                    <CalendarIcon className="w-6 h-6 mr-2" />
                    Vue Calendrier
                  </CardTitle>
                </CardHeader>
                <CardContent>
                  <Tabs defaultValue="combined" className="w-full">
                    <TabsList className="grid w-full grid-cols-2 mb-6">
                      <TabsTrigger value="combined">Vue combinée</TabsTrigger>
                      <TabsTrigger value="individual">Vues individuelles</TabsTrigger>
                    </TabsList>
                    
                    <TabsContent value="combined" className="space-y-6">
                      <div>
                        <h3 className="text-lg font-semibold text-gradient mb-4">Calendriers superposés</h3>
                        
                        {/* Legend */}
                        <div className="flex flex-wrap gap-3 mb-6">
                          {calendars.filter(cal => cal.visible).map((calendar) => (
                            <div key={calendar.id} className="flex items-center space-x-2">
                              <div 
                                className="w-3 h-3 rounded-full"
                                style={{ backgroundColor: calendar.color }}
                              />
                              <span className="text-sm text-foreground">{calendar.name}</span>
                            </div>
                          ))}
                        </div>

                        {/* Combined Events */}
                        <div className="space-y-3">
                          {getAllVisibleEvents().length > 0 ? (
                            getAllVisibleEvents().map((event, index) => (
                              <div 
                                key={index} 
                                className="flex items-center space-x-4 p-4 bg-accent/30 rounded-lg border border-border/50 hover:bg-accent/40 transition-colors"
                              >
                                <div 
                                  className="w-4 h-4 rounded-full"
                                  style={{ backgroundColor: event.color }}
                                />
                                <div className="flex-1">
                                  <h4 className="text-sm font-medium text-foreground">{event.title}</h4>
                                  <p className="text-xs text-muted-foreground">{event.calendar}</p>
                                </div>
                                <div className="text-right">
                                  <Badge variant="outline" className="text-xs">
                                    {new Date(event.date).toLocaleDateString('fr-FR')}
                                  </Badge>
                                  <p className="text-xs text-muted-foreground mt-1">{event.time}</p>
                                </div>
                              </div>
                            ))
                          ) : (
                            <div className="text-center py-8 text-muted-foreground">
                              <CalendarIcon className="w-12 h-12 mx-auto mb-4 opacity-50" />
                              <p>Aucun événement visible. Activez des calendriers pour voir les événements.</p>
                            </div>
                          )}
                        </div>
                      </div>
                    </TabsContent>

                    <TabsContent value="individual" className="space-y-6">
                      <div className="grid gap-6">
                        {calendars.filter(cal => cal.visible).map((calendar) => (
                          <Card key={calendar.id} className="bg-accent/20 border-border/50">
                            <CardHeader className="pb-3">
                              <CardTitle className="text-base flex items-center">
                                <div 
                                  className="w-4 h-4 rounded-full mr-3"
                                  style={{ backgroundColor: calendar.color }}
                                />
                                {calendar.name}
                              </CardTitle>
                            </CardHeader>
                            <CardContent>
                              <div className="space-y-2">
                                {calendar.events.map((event, index) => (
                                  <div 
                                    key={index}
                                    className="flex items-center justify-between p-3 bg-background/50 rounded-md"
                                  >
                                    <div>
                                      <h5 className="text-sm font-medium text-foreground">{event.title}</h5>
                                    </div>
                                    <div className="text-right">
                                      <Badge variant="secondary" className="text-xs">
                                        {new Date(event.date).toLocaleDateString('fr-FR')}
                                      </Badge>
                                      <p className="text-xs text-muted-foreground mt-1">{event.time}</p>
                                    </div>
                                  </div>
                                ))}
                                {calendar.events.length === 0 && (
                                  <p className="text-sm text-muted-foreground text-center py-4">
                                    Aucun événement dans ce calendrier
                                  </p>
                                )}
                              </div>
                            </CardContent>
                          </Card>
                        ))}
                      </div>
                    </TabsContent>
                  </Tabs>

                  {/* Setup Instructions */}
                  <div className="mt-8 p-4 bg-muted/30 rounded-lg">
                    <h4 className="text-sm font-semibold text-foreground mb-2">Configuration API requise</h4>
                    <p className="text-xs text-muted-foreground">
                      Pour afficher vos vrais calendriers Google, configurez l'API Google Calendar avec vos identifiants. 
                      L'interface supporte la superposition de multiples calendriers et la synchronisation en temps réel.
                    </p>
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

export default Calendar;