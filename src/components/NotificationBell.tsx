import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/contexts/AuthContext";
import { Bell, Calendar } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { formatDateTime } from "@/lib/helpers";

type Notification = {
  id: string; tipo: string; titulo: string; mensagem: string | null;
  lida: boolean; link: string | null; created_at: string;
};

export default function NotificationBell() {
  const { user } = useAuth();
  const [notifications, setNotifications] = useState<Notification[]>([]);
  const [open, setOpen] = useState(false);

  const fetchNotifications = async () => {
    if (!user) return;
    const { data } = await supabase
      .from('notifications')
      .select('*')
      .eq('user_id', user.id)
      .order('created_at', { ascending: false })
      .limit(20);
    setNotifications((data || []) as Notification[]);
  };

  useEffect(() => {
    fetchNotifications();
    if (!user) return;
    const channel = supabase
      .channel(`user-notifications:${user.id}`)
      .on('postgres_changes', {
        event: 'INSERT',
        schema: 'public',
        table: 'notifications',
        filter: `user_id=eq.${user.id}`,
      }, () => fetchNotifications())
      .subscribe();
    return () => { supabase.removeChannel(channel); };
  }, [user]);

  const unreadCount = notifications.filter(n => !n.lida).length;

  const markAllRead = async () => {
    if (!user) return;
    await supabase.from('notifications').update({ lida: true } as any).eq('user_id', user.id).eq('lida', false);
    fetchNotifications();
  };

  const getBorderClass = (tipo: string) => {
    if (tipo === 'alerta') return 'border-l-4 border-l-destructive';
    if (tipo === 'previsao') return 'border-l-4 border-l-amber-500';
    return '';
  };

  return (
    <Popover open={open} onOpenChange={setOpen}>
      <PopoverTrigger asChild>
        <Button variant="ghost" size="icon" className="relative">
          <Bell className="h-5 w-5" />
          {unreadCount > 0 && (
            <span className="absolute -top-0.5 -right-0.5 bg-primary text-primary-foreground text-xs rounded-full h-5 w-5 flex items-center justify-center">
              {unreadCount}
            </span>
          )}
        </Button>
      </PopoverTrigger>
      <PopoverContent className="w-80 p-0" align="end">
        <div className="flex items-center justify-between px-4 py-3 border-b border-border">
          <h3 className="text-sm font-semibold">Notificações</h3>
          {unreadCount > 0 && (
            <button onClick={markAllRead} className="text-xs text-primary hover:underline">
              Marcar todas como lidas
            </button>
          )}
        </div>
        <div className="max-h-64 overflow-y-auto">
          {notifications.length === 0 ? (
            <p className="text-sm text-muted-foreground text-center py-8">Sem notificações</p>
          ) : notifications.map(n => (
            <div key={n.id} className={`px-4 py-3 border-b border-border last:border-0 ${!n.lida ? 'bg-primary/5' : ''} ${getBorderClass(n.tipo)}`}>
              <div className="flex items-start gap-2">
                {n.tipo === 'previsao' && <Calendar className="h-4 w-4 text-amber-500 mt-0.5 shrink-0" />}
                <div>
                  <p className="text-sm font-medium">{n.titulo}</p>
                  {n.mensagem && <p className="text-xs text-muted-foreground mt-0.5">{n.mensagem}</p>}
                  <p className="text-xs text-muted-foreground mt-1">{formatDateTime(n.created_at)}</p>
                </div>
              </div>
            </div>
          ))}
        </div>
      </PopoverContent>
    </Popover>
  );
}
