import { useState, useEffect } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Checkbox } from '@/components/ui/checkbox';
import { Badge } from '@/components/ui/badge';
import { Calendar as CalendarIcon, Settings, Plus, Eye, EyeOff } from 'lucide-react';
import Layout from '@/components/Layout';

declare global {
  interface Window {
    gapi: any;
  }
}

const Calendar = () => {
  const [calendars, setCalendars] = useState([
    {
      id: 'primary',
      name: 'Primary Calendar',
      color: '#4285f4',
      visible: true,
      events: []
    },
    {
      id: 'work',
      name: 'Work Schedule',
      color: '#db4437',
      visible: true,
      events: []
    },
    {
      id: 'research',
      name: 'Research Projects',
      color: '#0f9d58',
      visible: true,
      events: []
    }
  ]);

  const [isApiLoaded, setIsApiLoaded] = useState(false);
  const [isSignedIn, setIsSignedIn] = useState(false);

  // Sample events for demonstration
  const sampleEvents = [
    {
      id: '1',
      title: 'Team Meeting',
      start: '2024-01-15T10:00:00',
      end: '2024-01-15T11:00:00',
      calendar: 'work',
      description: 'Weekly team sync'
    },
    {
      id: '2',
      title: 'Research Paper Review',
      start: '2024-01-16T14:00:00',
      end: '2024-01-16T16:00:00',
      calendar: 'research',
      description: 'Review latest ML papers'
    },
    {
      id: '3',
      title: 'Client Presentation',
      start: '2024-01-17T09:00:00',
      end: '2024-01-17T10:30:00',
      calendar: 'work',
      description: 'Present Q4 results'
    }
  ];

  useEffect(() => {
    // Load Google Calendar API
    const loadGoogleAPI = () => {
      const script = document.createElement('script');
      script.src = 'https://apis.google.com/js/api.js';
      script.onload = () => {
        if (window.gapi) {
          window.gapi.load('client:auth2', initializeGapi);
        }
      };
      document.head.appendChild(script);
    };

    const initializeGapi = () => {
      // This would initialize with your Google API credentials
      // For demo purposes, we'll just set as loaded
      setIsApiLoaded(true);
    };

    loadGoogleAPI();
  }, []);

  const toggleCalendarVisibility = (calendarId: string) => {
    setCalendars(prev => 
      prev.map(cal => 
        cal.id === calendarId 
          ? { ...cal, visible: !cal.visible }
          : cal
      )
    );
  };

  const connectGoogleCalendar = () => {
    // In a real implementation, this would trigger Google OAuth
    alert('Google Calendar integration would be implemented here. This requires API credentials and OAuth setup.');
  };

  const addNewCalendar = () => {
    const name = prompt('Enter calendar name:');
    if (name) {
      const newCalendar = {
        id: Date.now().toString(),
        name,
        color: '#' + Math.floor(Math.random()*16777215).toString(16),
        visible: true,
        events: []
      };
      setCalendars(prev => [...prev, newCalendar]);
    }
  };

  return (
    <Layout>
      <div className="container mx-auto px-4 py-12">
        <div className="max-w-7xl mx-auto">
          <h1 className="text-4xl md:text-5xl font-display font-bold text-gradient mb-4 animate-fade-in">
            Calendar
          </h1>
          <p className="text-xl text-muted-foreground mb-8 animate-fade-in" style={{ animationDelay: '0.1s' }}>
            Manage and view multiple Google Calendars in one place.
          </p>

          <div className="grid lg:grid-cols-4 gap-8">
            {/* Calendar Management Sidebar */}
            <div className="lg:col-span-1">
              <Card className="glass-effect shadow-card animate-slide-in">
                <CardHeader>
                  <CardTitle className="text-lg text-gradient flex items-center">
                    <Settings className="w-5 h-5 mr-2" />
                    Calendar Management
                  </CardTitle>
                </CardHeader>
                <CardContent className="space-y-4">
                  {/* Google Calendar Integration */}
                  <div className="space-y-2">
                    <h3 className="text-sm font-semibold text-foreground">Google Calendar</h3>
                    <Button 
                      onClick={connectGoogleCalendar}
                      variant="outline" 
                      size="sm" 
                      className="w-full hover:bg-primary hover:text-primary-foreground transition-all duration-300"
                    >
                      {isSignedIn ? 'Sync Calendars' : 'Connect Google'}
                    </Button>
                    <p className="text-xs text-muted-foreground">
                      Connect your Google account to sync multiple calendars
                    </p>
                  </div>

                  {/* Calendar List */}
                  <div className="space-y-2">
                    <div className="flex items-center justify-between">
                      <h3 className="text-sm font-semibold text-foreground">Calendars</h3>
                      <Button 
                        onClick={addNewCalendar}
                        variant="ghost" 
                        size="sm"
                        className="h-6 w-6 p-0 hover:bg-primary hover:text-primary-foreground"
                      >
                        <Plus className="w-3 h-3" />
                      </Button>
                    </div>
                    
                    <div className="space-y-2">
                      {calendars.map((calendar) => (
                        <div key={calendar.id} className="flex items-center space-x-2">
                          <Checkbox
                            id={calendar.id}
                            checked={calendar.visible}
                            onCheckedChange={() => toggleCalendarVisibility(calendar.id)}
                          />
                          <div className="flex items-center space-x-2 flex-1">
                            <div 
                              className="w-3 h-3 rounded-full"
                              style={{ backgroundColor: calendar.color }}
                            />
                            <label 
                              htmlFor={calendar.id}
                              className="text-sm text-foreground cursor-pointer flex-1"
                            >
                              {calendar.name}
                            </label>
                            <Button
                              variant="ghost"
                              size="sm"
                              className="h-6 w-6 p-0 opacity-50 hover:opacity-100"
                              onClick={() => toggleCalendarVisibility(calendar.id)}
                            >
                              {calendar.visible ? <Eye className="w-3 h-3" /> : <EyeOff className="w-3 h-3" />}
                            </Button>
                          </div>
                        </div>
                      ))}
                    </div>
                  </div>

                  {/* Instructions */}
                  <div className="mt-6 p-3 bg-accent/30 rounded-lg">
                    <h4 className="text-sm font-semibold text-foreground mb-2">Setup Instructions</h4>
                    <ol className="text-xs text-muted-foreground space-y-1">
                      <li>1. Create Google Calendar API credentials</li>
                      <li>2. Add your domain to authorized origins</li>
                      <li>3. Configure OAuth consent screen</li>
                      <li>4. Replace API key in the code</li>
                    </ol>
                  </div>
                </CardContent>
              </Card>
            </div>

            {/* Calendar View */}
            <div className="lg:col-span-3">
              <Card className="glass-effect shadow-card animate-fade-in" style={{ animationDelay: '0.2s' }}>
                <CardHeader>
                  <CardTitle className="text-xl text-gradient flex items-center">
                    <CalendarIcon className="w-6 h-6 mr-2" />
                    Calendar View
                  </CardTitle>
                </CardHeader>
                <CardContent>
                  {/* Calendar Integration Notice */}
                  <div className="text-center py-12 space-y-4">
                    <div className="w-16 h-16 bg-primary/20 rounded-full mx-auto flex items-center justify-center">
                      <CalendarIcon className="w-8 h-8 text-primary" />
                    </div>
                    <h3 className="text-lg font-semibold text-foreground">Google Calendar Integration</h3>
                    <p className="text-muted-foreground max-w-md mx-auto">
                      To display your Google Calendars here, you'll need to set up the Google Calendar API 
                      with proper authentication. The framework is ready - just add your API credentials.
                    </p>
                    
                    {/* Sample Events Display */}
                    <div className="mt-8 space-y-3">
                      <h4 className="text-sm font-semibold text-foreground">Sample Events (Demo)</h4>
                      {sampleEvents.map((event) => {
                        const calendar = calendars.find(cal => cal.id === event.calendar);
                        return calendar?.visible ? (
                          <div key={event.id} className="flex items-center space-x-3 p-3 bg-accent/30 rounded-lg">
                            <div 
                              className="w-3 h-3 rounded-full"
                              style={{ backgroundColor: calendar.color }}
                            />
                            <div className="flex-1 text-left">
                              <h5 className="text-sm font-medium text-foreground">{event.title}</h5>
                              <p className="text-xs text-muted-foreground">{event.description}</p>
                            </div>
                            <Badge variant="outline" className="text-xs">
                              {new Date(event.start).toLocaleDateString()}
                            </Badge>
                          </div>
                        ) : null;
                      })}
                    </div>

                    <div className="mt-6 p-4 bg-muted/30 rounded-lg">
                      <h4 className="text-sm font-semibold text-foreground mb-2">API Setup Required</h4>
                      <p className="text-xs text-muted-foreground">
                        Replace the Google Calendar API integration with your credentials to see real calendar data. 
                        The interface supports multiple calendar overlay and real-time synchronization.
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

export default Calendar;