import { useState, useEffect } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import Layout from '@/components/Layout';

interface CalendarItem {
  id: string;
  name: string;
  color: string;
  visible: boolean;
  embedUrl: string;
  calendarApiId: string;
}

// Clé API Google Calendar
const API_KEY = 'TA_CLE_API_GOOGLE';

const calendarsData: CalendarItem[] = [
  {
    id: 'master-math',
    name: 'M2 Math of Modeling (SU)',
    color: '#4285f4',
    visible: true,
    embedUrl:
      "https://www.google.com/calendar/embed?src=mathmodelupmc%40gmail.com&mode=AGENDA&bgcolor=%23FFFFFF&color=%234285f4&ctz=Europe%2FParis",
    calendarApiId: 'mathmodelupmc@gmail.com',
  },
  {
    id: 'holidays',
    name: 'Holidays FR',
    color: '#0f9d58',
    visible: true,
    embedUrl:
      "https://www.google.com/calendar/embed?src=fr.french%23holiday%40group.v.calendar.google.com&mode=AGENDA&bgcolor=%23000000&color=%23FFFFFF&ctz=Europe%2FParis",
    calendarApiId: 'fr.french#holiday@group.v.calendar.google.com',
  },
  {
    id: 'personal',
    name: 'Personal',
    color: '#fbbc05',
    visible: true,
    embedUrl:
      "https://www.google.com/calendar/embed?src=yourpersonalcalendar%40gmail.com&mode=AGENDA&bgcolor=%23000000&color=%23FFFFFF&ctz=Europe%2FParis",
    calendarApiId: 'yourpersonalcalendar@gmail.com',
  },
];

// Composant pour afficher les prochains événements
const EventList = ({
  calendarApiId,
  fadeTrigger,
}: {
  calendarApiId: string;
  fadeTrigger: number;
}) => {
  const [events, setEvents] = useState<any[]>([]);
  const [fade, setFade] = useState(false);

  useEffect(() => {
    setFade(false);
    const timeout = setTimeout(() => setFade(true), 50);

    const fetchEvents = async () => {
      const now = new Date().toISOString();
      const res = await fetch(
        `https://www.googleapis.com/calendar/v3/calendars/${calendarApiId}/events?key=${API_KEY}&timeMin=${now}&singleEvents=true&orderBy=startTime&maxResults=5`
      );
      const data = await res.json();
      setEvents(data.items || []);
    };
    fetchEvents();

    return () => clearTimeout(timeout);
  }, [calendarApiId, fadeTrigger]);

  return (
    <ul className={`space-y-2 transition-opacity duration-500 ${fade ? 'opacity-100' : 'opacity-0'}`}>
      {events.map((ev) => (
        <li key={ev.id} className="animate-slide-in">
          <span className="font-semibold">{ev.summary}</span>{' '}
          <span className="text-sm text-muted-foreground">
            {new Date(ev.start.dateTime || ev.start.date).toLocaleString()}
          </span>
        </li>
      ))}
    </ul>
  );
};

const Calendar = () => {
  const [selectedCalendar, setSelectedCalendar] = useState<CalendarItem>(calendarsData[0]);
  const [fadeTrigger, setFadeTrigger] = useState(0);

  const handleSelectCalendar = (cal: CalendarItem) => {
    setSelectedCalendar(cal);
    setFadeTrigger((prev) => prev + 1);
  };

  return (
    <Layout>
      <div className="container mx-auto px-4 py-12 animate-fade-in">
        <div className="max-w-7xl mx-auto grid lg:grid-cols-4 gap-8">
          {/* Sidebar de sélection */}
          <div className="animate-slide-in">
            <Card className="glass-effect shadow-card p-4">
              <CardHeader>
                <CardTitle className="text-lg text-gradient">Select Calendar</CardTitle>
              </CardHeader>

              <CardContent className="space-y-3">
                {calendarsData.map((cal, index) => (
                  <Button
                    key={cal.id}
                    variant="outline"
                    className={`w-full flex items-center gap-3 px-4 py-2 rounded-lg text-sm font-medium justify-start
                      transition-all duration-300 cursor-default
                      ${selectedCalendar.id === cal.id ? 'bg-primary/20 border-primary text-primary' : 'hover:bg-accent/20'}
                      animate-slide-in`}
                    style={{ animationDelay: `${index * 0.1}s` }}
                    onClick={() => handleSelectCalendar(cal)}
                  >
                    <div
                      className="w-3 h-3 rounded-full flex-shrink-0"
                      style={{ backgroundColor: cal.color }}
                    />
                    <span className="text-left">{cal.name}</span>
                  </Button>
                ))}
              </CardContent>

              {/* Prochains événements */}
              <div className="mt-6">
                <h3 className="text-lg text-gradient font-semibold mb-2">Upcoming Events</h3>
                <EventList calendarApiId={selectedCalendar.calendarApiId} fadeTrigger={fadeTrigger} />
              </div>
            </Card>
          </div>

          {/* Contenu principal du calendrier */}
          <div className="lg:col-span-3 animate-fade-in" style={{ animationDelay: '0.2s' }}>
            <Card className="glass-effect shadow-card p-4">
              <CardHeader>
                <CardTitle className="text-xl text-gradient">{selectedCalendar.name} Calendar</CardTitle>
              </CardHeader>
              <CardContent className="mt-4">
                <div
                  className="w-full rounded-lg overflow-hidden border border-border"
                  style={{ height: '80vh' }}
                >
                  {/* Dark mode complet sur iframe via filtre CSS */}
                  <iframe
                    src={selectedCalendar.embedUrl}
                    className="w-full h-full transition-all duration-500"
                    style={{ border: 0, filter: 'invert(1) hue-rotate(180deg)' }}
                    frameBorder="0"
                    scrolling="no"
                  />
                </div>
              </CardContent>
            </Card>
          </div>
        </div>
      </div>
    </Layout>
  );
};

export default Calendar;
