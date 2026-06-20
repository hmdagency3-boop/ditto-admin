import { useState, useEffect } from 'react';
import { X, Calendar, Megaphone } from 'lucide-react';
import { useAuth } from '@/contexts/AuthContext';
import { format } from 'date-fns';
import { ar } from 'date-fns/locale';

interface Event {
  id: string;
  title: string;
  description?: string;
  color: string;
  start_date: string;
  end_date: string;
  is_active: boolean;
}

const colorMap: Record<string, { bg: string; border: string; text: string; iconBg: string }> = {
  blue:   { bg: 'from-blue-500/15 to-blue-600/5',   border: 'border-blue-400/40',   text: 'text-blue-700 dark:text-blue-300',   iconBg: 'bg-blue-500/20'   },
  green:  { bg: 'from-green-500/15 to-green-600/5',  border: 'border-green-400/40',  text: 'text-green-700 dark:text-green-300',  iconBg: 'bg-green-500/20'  },
  purple: { bg: 'from-purple-500/15 to-purple-600/5',border: 'border-purple-400/40', text: 'text-purple-700 dark:text-purple-300', iconBg: 'bg-purple-500/20' },
  orange: { bg: 'from-orange-500/15 to-orange-600/5',border: 'border-orange-400/40', text: 'text-orange-700 dark:text-orange-300', iconBg: 'bg-orange-500/20' },
  red:    { bg: 'from-red-500/15 to-red-600/5',      border: 'border-red-400/40',    text: 'text-red-700 dark:text-red-300',      iconBg: 'bg-red-500/20'    },
  yellow: { bg: 'from-yellow-500/15 to-yellow-600/5',border: 'border-yellow-400/40', text: 'text-yellow-700 dark:text-yellow-300', iconBg: 'bg-yellow-500/20' },
  pink:   { bg: 'from-pink-500/15 to-pink-600/5',    border: 'border-pink-400/40',   text: 'text-pink-700 dark:text-pink-300',    iconBg: 'bg-pink-500/20'   },
};

export function EventsBanner() {
  const { token } = useAuth();
  const [events, setEvents] = useState<Event[]>([]);
  const [dismissed, setDismissed] = useState<Set<string>>(() => {
    try {
      const stored = sessionStorage.getItem('dismissed_events');
      return new Set(stored ? JSON.parse(stored) : []);
    } catch { return new Set(); }
  });

  useEffect(() => {
    if (!token) return;
    fetch('/api/events', { headers: { Authorization: `Bearer ${token}` } })
      .then(r => r.ok ? r.json() : [])
      .then((data: Event[]) => {
        const now = new Date();
        const active = data.filter(e =>
          e.is_active &&
          new Date(e.start_date) <= now &&
          new Date(e.end_date) >= now
        );
        setEvents(active);
      })
      .catch(() => {});
  }, [token]);

  function dismiss(id: string) {
    const next = new Set(dismissed).add(id);
    setDismissed(next);
    try { sessionStorage.setItem('dismissed_events', JSON.stringify([...next])); } catch {}
  }

  const visible = events.filter(e => !dismissed.has(e.id));
  if (visible.length === 0) return null;

  return (
    <div className="flex flex-col gap-2">
      {visible.map(event => {
        const c = colorMap[event.color] || colorMap.blue;
        return (
          <div
            key={event.id}
            className={`relative flex items-start gap-3 rounded-xl border bg-gradient-to-l ${c.bg} ${c.border} p-4`}
          >
            <div className={`flex items-center justify-center h-9 w-9 rounded-lg shrink-0 ${c.iconBg}`}>
              <Megaphone className={`h-5 w-5 ${c.text}`} />
            </div>
            <div className="flex-1 min-w-0">
              <p className={`font-semibold text-sm ${c.text}`}>{event.title}</p>
              {event.description && (
                <p className="text-sm text-muted-foreground mt-0.5 line-clamp-2">{event.description}</p>
              )}
              <div className={`flex items-center gap-1 mt-1 text-xs ${c.text} opacity-70`}>
                <Calendar className="h-3 w-3" />
                <span>
                  {format(new Date(event.start_date), 'd MMM', { locale: ar })}
                  {' — '}
                  {format(new Date(event.end_date), 'd MMM yyyy', { locale: ar })}
                </span>
              </div>
            </div>
            <button
              onClick={() => dismiss(event.id)}
              className="shrink-0 rounded-md p-1 opacity-50 hover:opacity-100 transition-opacity"
              aria-label="إغلاق"
            >
              <X className="h-4 w-4" />
            </button>
          </div>
        );
      })}
    </div>
  );
}
