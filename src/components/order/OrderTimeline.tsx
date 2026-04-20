import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { formatDate, formatDateTime } from "@/lib/helpers";
import {
  FileText, Send, CheckCircle2, XCircle, Ban, CalendarClock,
  PackageCheck, AlertTriangle, ClipboardList, Edit3,
} from "lucide-react";

type TimelineEvent = {
  key: string;
  icon: React.ComponentType<{ className?: string }>;
  iconClass: string;
  title: string;
  user: string;
  date: string;
  detail?: string;
};

interface Props {
  orderId: string;
  orderUserId: string;
  orderCreatedAt: string;
  orderStatus: string;
  previsaoEntrega?: string | null;
  previsaoRegistradaPor?: string | null;
  obsEstoquista?: string | null;
  updatedAt?: string;
}

export default function OrderTimeline({
  orderId, orderUserId, orderCreatedAt, orderStatus,
  previsaoEntrega, previsaoRegistradaPor, obsEstoquista, updatedAt,
}: Props) {
  const [timeline, setTimeline] = useState<TimelineEvent[]>([]);
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    let active = true;
    const buildTimeline = async () => {
      setLoading(true);

      const [
        { data: linkedReq },
        { data: approvalLogs },
        { data: receipt },
      ] = await Promise.all([
        supabase.from('requisitions')
          .select('id, user_id, created_at')
          .eq('order_id', orderId)
          .order('created_at', { ascending: true })
          .limit(1)
          .maybeSingle(),
        supabase.from('approval_log')
          .select('id, user_id, action, motivo, created_at')
          .eq('order_id', orderId)
          .order('created_at', { ascending: true }),
        supabase.from('receipts')
          .select('id, user_id, status, observacoes, received_at, created_at, numero_nf')
          .eq('order_id', orderId)
          .order('created_at', { ascending: true })
          .limit(1)
          .maybeSingle(),
      ]);

      const userIds = new Set<string>();
      userIds.add(orderUserId);
      if (linkedReq?.user_id) userIds.add(linkedReq.user_id);
      (approvalLogs || []).forEach((a: any) => userIds.add(a.user_id));
      if (receipt?.user_id) userIds.add(receipt.user_id);
      if (previsaoRegistradaPor) userIds.add(previsaoRegistradaPor);

      const { data: profilesData } = await supabase.from('profiles')
        .select('user_id, full_name')
        .in('user_id', Array.from(userIds));
      const profileMap: Record<string, string> = {};
      (profilesData || []).forEach((p: any) => { profileMap[p.user_id] = p.full_name || '—'; });
      const nameOf = (uid?: string | null) => (uid && profileMap[uid]) || '—';

      const events: TimelineEvent[] = [];

      if (linkedReq) {
        events.push({
          key: `req-${linkedReq.id}`,
          icon: ClipboardList,
          iconClass: 'bg-muted text-muted-foreground',
          title: 'Solicitação vinculada',
          user: nameOf(linkedReq.user_id),
          date: linkedReq.created_at,
        });
      }

      events.push({
        key: 'created',
        icon: FileText,
        iconClass: 'bg-info/20 text-info',
        title: 'Pedido criado',
        user: nameOf(orderUserId),
        date: orderCreatedAt,
      });

      const sentLog = (approvalLogs || []).find((a: any) => a.action === 'enviado' || a.action === 'aguardando_aprovacao');
      if (sentLog) {
        events.push({
          key: `sent-${sentLog.id}`,
          icon: Send,
          iconClass: 'bg-info/20 text-info',
          title: 'Enviado para aprovação',
          user: nameOf(sentLog.user_id),
          date: sentLog.created_at,
        });
      } else if (
        ['aguardando_aprovacao', 'aprovado', 'rejeitado', 'emitido', 'recebido', 'recebido_com_ocorrencia', 'cancelado'].includes(orderStatus)
      ) {
        events.push({
          key: 'sent-inferred',
          icon: Send,
          iconClass: 'bg-info/20 text-info',
          title: 'Enviado para aprovação',
          user: nameOf(orderUserId),
          date: orderCreatedAt,
          detail: 'Data aproximada (criação do pedido)',
        });
      }

      (approvalLogs || []).forEach((a: any) => {
        if (a.action === 'aprovado') {
          events.push({
            key: `approved-${a.id}`, icon: CheckCircle2, iconClass: 'bg-success/20 text-success',
            title: 'Aprovado', user: nameOf(a.user_id), date: a.created_at,
            detail: a.motivo || undefined,
          });
        } else if (a.action === 'aprovado_com_alteracao') {
          events.push({
            key: `approved-edit-${a.id}`, icon: Edit3, iconClass: 'bg-success/20 text-success',
            title: 'Aprovado com alteração', user: nameOf(a.user_id), date: a.created_at,
            detail: a.motivo || undefined,
          });
        } else if (a.action === 'rejeitado') {
          events.push({
            key: `rejected-${a.id}`, icon: XCircle, iconClass: 'bg-destructive/20 text-destructive',
            title: 'Rejeitado', user: nameOf(a.user_id), date: a.created_at,
            detail: a.motivo ? `Motivo: ${a.motivo}` : undefined,
          });
        } else if (a.action === 'cancelado') {
          events.push({
            key: `cancelled-${a.id}`, icon: Ban, iconClass: 'bg-destructive/20 text-destructive',
            title: 'Cancelado', user: nameOf(a.user_id), date: a.created_at,
            detail: a.motivo ? `Motivo: ${a.motivo}` : undefined,
          });
        }
      });

      if (previsaoEntrega) {
        events.push({
          key: 'previsao', icon: CalendarClock, iconClass: 'bg-warning/20 text-warning',
          title: 'Previsão de entrega registrada',
          user: nameOf(previsaoRegistradaPor),
          date: updatedAt || orderCreatedAt,
          detail: `Entrega prevista para ${formatDate(previsaoEntrega)}${obsEstoquista ? ` — ${obsEstoquista}` : ''}`,
        });
      }

      if (receipt) {
        const isOccurrence = receipt.status === 'recebido_com_ocorrencia';
        const summary = isOccurrence ? 'Ocorrência no recebimento' : 'Recebimento normal, sem ocorrência';
        events.push({
          key: `received-${receipt.id}`,
          icon: isOccurrence ? AlertTriangle : PackageCheck,
          iconClass: isOccurrence ? 'bg-warning/20 text-warning' : 'bg-success/20 text-success',
          title: isOccurrence ? 'Recebido com ocorrência' : 'Recebido',
          user: nameOf(receipt.user_id),
          date: receipt.received_at || receipt.created_at,
          detail: [
            summary,
            receipt.numero_nf ? `NF ${receipt.numero_nf}` : 'NF não informada',
          ].filter(Boolean).join(' · '),
        });
      }

      events.sort((a, b) => new Date(a.date).getTime() - new Date(b.date).getTime());
      if (active) {
        setTimeline(events);
        setLoading(false);
      }
    };
    buildTimeline();
    return () => { active = false; };
  }, [orderId, orderUserId, orderCreatedAt, orderStatus, previsaoEntrega, previsaoRegistradaPor, obsEstoquista, updatedAt]);

  if (loading) return <p className="text-sm text-muted-foreground py-4">Carregando histórico...</p>;
  if (timeline.length === 0) return <p className="text-sm text-muted-foreground py-4">Nenhum evento registrado para este pedido.</p>;

  return (
    <div className="relative pl-2 py-2">
      <div className="absolute left-[22px] top-2 bottom-2 w-px bg-border" />
      <ul className="space-y-4">
        {timeline.map(ev => {
          const Icon = ev.icon;
          return (
            <li key={ev.key} className="relative flex gap-4">
              <div className={`relative z-10 flex h-10 w-10 flex-shrink-0 items-center justify-center rounded-full ${ev.iconClass}`}>
                <Icon className="h-5 w-5" />
              </div>
              <div className="flex-1 pt-1">
                <div className="flex items-baseline justify-between gap-2 flex-wrap">
                  <p className="text-sm font-semibold">{ev.title}</p>
                  <p className="text-xs text-muted-foreground">{formatDateTime(ev.date)}</p>
                </div>
                <p className="text-xs text-muted-foreground mt-0.5">por <span className="font-medium text-foreground">{ev.user}</span></p>
                {ev.detail && <p className="text-xs text-muted-foreground mt-1 italic">{ev.detail}</p>}
              </div>
            </li>
          );
        })}
      </ul>
    </div>
  );
}
