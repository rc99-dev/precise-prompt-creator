import { useState } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/contexts/AuthContext";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { Paperclip, Download, Trash2, Upload, FileText } from "lucide-react";
import { toast } from "sonner";
import { formatDate } from "@/lib/helpers";

const TIPO_LABEL: Record<string, string> = {
  orcamento: "Orçamento",
  espelho: "Espelho",
  nota_fiscal: "Nota Fiscal",
  outro: "Outro",
};

type Attachment = {
  id: string;
  order_id: string;
  user_id: string;
  tipo: string;
  file_name: string;
  file_path: string;
  mime_type: string | null;
  size_bytes: number | null;
  created_at: string;
};

type Props = {
  orderId: string;
  orderNumero: string;
  variant?: "icon" | "button";
  className?: string;
};

export default function OrderAttachmentsButton({ orderId, orderNumero, variant = "icon", className }: Props) {
  const { user, role } = useAuth();
  const qc = useQueryClient();
  const [open, setOpen] = useState(false);
  const [tipo, setTipo] = useState<string>("orcamento");
  const [uploading, setUploading] = useState(false);

  const { data: attachments = [], refetch } = useQuery({
    queryKey: ["order-attachments", orderId],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("order_attachments" as any)
        .select("*")
        .eq("order_id", orderId)
        .order("created_at", { ascending: false });
      if (error) throw error;
      return (data || []) as unknown as Attachment[];
    },
    enabled: open,
  });

  const { data: countData } = useQuery({
    queryKey: ["order-attachments-count", orderId],
    queryFn: async () => {
      const { count } = await supabase
        .from("order_attachments" as any)
        .select("id", { count: "exact", head: true })
        .eq("order_id", orderId);
      return count || 0;
    },
    staleTime: 30 * 1000,
  });

  const handleUpload = async (file: File) => {
    if (!user) { toast.error("Não autenticado."); return; }
    if (file.size > 20 * 1024 * 1024) { toast.error("Arquivo maior que 20MB."); return; }
    setUploading(true);
    try {
      const ext = file.name.split(".").pop() || "pdf";
      const path = `${orderId}/${tipo}/${Date.now()}-${Math.random().toString(36).slice(2, 8)}.${ext}`;
      const { error: upErr } = await supabase.storage.from("order-attachments").upload(path, file, {
        contentType: file.type || "application/pdf",
        upsert: false,
      });
      if (upErr) { toast.error(`Erro upload: ${upErr.message}`); return; }
      const { error: insErr } = await supabase.from("order_attachments" as any).insert({
        order_id: orderId,
        user_id: user.id,
        tipo,
        file_name: file.name,
        file_path: path,
        mime_type: file.type || null,
        size_bytes: file.size,
      });
      if (insErr) {
        await supabase.storage.from("order-attachments").remove([path]);
        toast.error(`Erro ao salvar: ${insErr.message}`);
        return;
      }
      toast.success("Arquivo anexado!");
      refetch();
      qc.invalidateQueries({ queryKey: ["order-attachments-count", orderId] });
    } finally {
      setUploading(false);
    }
  };

  const handleDownload = async (att: Attachment) => {
    const { data, error } = await supabase.storage
      .from("order-attachments")
      .createSignedUrl(att.file_path, 60);
    if (error || !data) { toast.error("Erro ao gerar link."); return; }
    const a = document.createElement("a");
    a.href = data.signedUrl;
    a.download = att.file_name;
    a.target = "_blank";
    a.rel = "noopener";
    document.body.appendChild(a);
    a.click();
    a.remove();
  };

  const handleDelete = async (att: Attachment) => {
    if (!confirm(`Excluir "${att.file_name}"?`)) return;
    await supabase.storage.from("order-attachments").remove([att.file_path]);
    const { error } = await supabase.from("order_attachments" as any).delete().eq("id", att.id);
    if (error) { toast.error(error.message); return; }
    toast.success("Anexo excluído.");
    refetch();
    qc.invalidateQueries({ queryKey: ["order-attachments-count", orderId] });
  };

  const canDelete = (att: Attachment) =>
    att.user_id === user?.id || role === "master" || role === "comprador";

  const count = countData ?? 0;

  return (
    <>
      {variant === "icon" ? (
        <Button
          variant="ghost"
          size="icon"
          className={className}
          onClick={(e) => { e.stopPropagation(); setOpen(true); }}
          title="Anexos (orçamento / espelho / NF)"
        >
          <div className="relative">
            <Paperclip className="h-4 w-4" />
            {count > 0 && (
              <span className="absolute -top-1.5 -right-2 text-[10px] bg-primary text-primary-foreground rounded-full px-1 min-w-[14px] h-[14px] flex items-center justify-center font-bold">
                {count}
              </span>
            )}
          </div>
        </Button>
      ) : (
        <Button variant="outline" size="sm" className={className} onClick={(e) => { e.stopPropagation(); setOpen(true); }}>
          <Paperclip className="h-4 w-4 mr-1" />
          Anexos {count > 0 && <Badge className="ml-2 h-5">{count}</Badge>}
        </Button>
      )}

      <Dialog open={open} onOpenChange={setOpen}>
        <DialogContent className="max-w-2xl" onClick={(e) => e.stopPropagation()}>
          <DialogHeader>
            <DialogTitle>Anexos do pedido {orderNumero}</DialogTitle>
          </DialogHeader>

          <div className="space-y-4 py-2">
            <div className="flex gap-2 items-end border rounded-md p-3 bg-muted/30">
              <div className="flex-1 space-y-1">
                <label className="text-xs text-muted-foreground">Tipo do documento</label>
                <Select value={tipo} onValueChange={setTipo}>
                  <SelectTrigger><SelectValue /></SelectTrigger>
                  <SelectContent>
                    <SelectItem value="orcamento">Orçamento</SelectItem>
                    <SelectItem value="espelho">Espelho</SelectItem>
                    <SelectItem value="nota_fiscal">Nota Fiscal</SelectItem>
                    <SelectItem value="outro">Outro</SelectItem>
                  </SelectContent>
                </Select>
              </div>
              <div className="flex-1 space-y-1">
                <label className="text-xs text-muted-foreground">Arquivo (PDF, máx 20MB)</label>
                <Input
                  type="file"
                  accept="application/pdf,image/*"
                  disabled={uploading}
                  onChange={(e) => {
                    const f = e.target.files?.[0];
                    if (f) handleUpload(f);
                    e.target.value = "";
                  }}
                />
              </div>
              {uploading && <Upload className="h-4 w-4 animate-pulse mb-2" />}
            </div>

            <div className="border rounded-md divide-y max-h-[400px] overflow-auto">
              {attachments.length === 0 ? (
                <div className="text-center text-sm text-muted-foreground py-8">
                  Nenhum arquivo anexado ainda.
                </div>
              ) : attachments.map((att) => (
                <div key={att.id} className="flex items-center gap-3 p-3 hover:bg-muted/50">
                  <FileText className="h-5 w-5 text-primary flex-shrink-0" />
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2">
                      <Badge variant="outline">{TIPO_LABEL[att.tipo] || att.tipo}</Badge>
                      <span className="text-sm font-medium truncate">{att.file_name}</span>
                    </div>
                    <p className="text-xs text-muted-foreground">
                      {formatDate(att.created_at)}
                      {att.size_bytes ? ` • ${(att.size_bytes / 1024).toFixed(0)} KB` : ""}
                    </p>
                  </div>
                  <Button variant="ghost" size="icon" onClick={() => handleDownload(att)} title="Baixar">
                    <Download className="h-4 w-4" />
                  </Button>
                  {canDelete(att) && (
                    <Button variant="ghost" size="icon" onClick={() => handleDelete(att)} title="Excluir">
                      <Trash2 className="h-4 w-4 text-destructive" />
                    </Button>
                  )}
                </div>
              ))}
            </div>
          </div>
        </DialogContent>
      </Dialog>
    </>
  );
}
