import { useState, useMemo } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/contexts/AuthContext";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Switch } from "@/components/ui/switch";
import {
  Select, SelectContent, SelectItem, SelectTrigger, SelectValue,
} from "@/components/ui/select";
import {
  Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter, DialogDescription,
} from "@/components/ui/dialog";
import {
  AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent,
  AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle,
} from "@/components/ui/alert-dialog";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Plus, Pencil, Trash2, Search } from "lucide-react";
import TableSkeleton from "@/components/TableSkeleton";
import { formatCurrency, formatDate } from "@/lib/helpers";
import type { PcpCrudConfig, PcpField } from "@/lib/pcpConfig";

type Props = { config: PcpCrudConfig };

export default function PcpCrudTab({ config }: Props) {
  const { user } = useAuth();
  const qc = useQueryClient();
  const [open, setOpen] = useState(false);
  const [editing, setEditing] = useState<any | null>(null);
  const [formValues, setFormValues] = useState<Record<string, any>>({});
  const [deleteId, setDeleteId] = useState<string | null>(null);
  const [search, setSearch] = useState("");

  const queryKey = ["pcp", config.table];

  const { data: rows = [], isLoading } = useQuery({
    queryKey,
    queryFn: async () => {
      const orderCol = config.orderBy?.column ?? "created_at";
      const asc = config.orderBy?.ascending ?? false;
      const { data, error } = await supabase
        .from(config.table)
        .select("*")
        .order(orderCol, { ascending: asc })
        .limit(500);
      if (error) throw error;
      return data ?? [];
    },
  });

  const filteredRows = useMemo(() => {
    if (!search.trim()) return rows;
    const q = search.toLowerCase();
    return rows.filter((r: any) =>
      config.fields.some((f) => {
        const v = r[f.name];
        return v != null && String(v).toLowerCase().includes(q);
      })
    );
  }, [rows, search, config.fields]);

  const upsertMut = useMutation({
    mutationFn: async (values: Record<string, any>) => {
      const payload: Record<string, any> = { ...values };
      // Apply computed fields
      for (const f of config.fields) {
        if (f.compute) {
          const computed = f.compute(payload);
          if (computed != null && !Number.isNaN(Number(computed))) {
            payload[f.name] = Number(computed);
          }
        }
        // Convert empty strings to null
        if (payload[f.name] === "" || payload[f.name] === undefined) payload[f.name] = null;
        if (f.type === "number" && payload[f.name] != null) {
          payload[f.name] = Number(payload[f.name]);
        }
        if (f.type === "boolean") {
          payload[f.name] = Boolean(payload[f.name]);
        }
      }
      const client = supabase as any;
      if (editing) {
        const { error } = await client.from(config.table).update(payload).eq("id", editing.id);
        if (error) throw error;
      } else {
        payload.user_id = user?.id;
        const { error } = await client.from(config.table).insert(payload);
        if (error) throw error;
      }
    },
    onSuccess: () => {
      toast.success(editing ? "Registro atualizado" : "Registro criado");
      qc.invalidateQueries({ queryKey });
      setOpen(false);
      setEditing(null);
      setFormValues({});
    },
    onError: (err: any) => toast.error(err.message ?? "Erro ao salvar"),
  });

  const deleteMut = useMutation({
    mutationFn: async (id: string) => {
      const { error } = await supabase.from(config.table).delete().eq("id", id);
      if (error) throw error;
    },
    onSuccess: () => {
      toast.success("Registro excluído");
      qc.invalidateQueries({ queryKey });
      setDeleteId(null);
    },
    onError: (err: any) => toast.error(err.message ?? "Erro ao excluir"),
  });

  function openNew() {
    setEditing(null);
    const init: Record<string, any> = {};
    for (const f of config.fields) {
      if (f.type === "date") init[f.name] = new Date().toISOString().slice(0, 10);
      else if (f.type === "boolean") init[f.name] = false;
      else init[f.name] = "";
    }
    setFormValues(init);
    setOpen(true);
  }

  function openEdit(row: any) {
    setEditing(row);
    const init: Record<string, any> = {};
    for (const f of config.fields) init[f.name] = row[f.name] ?? (f.type === "boolean" ? false : "");
    setFormValues(init);
    setOpen(true);
  }

  function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    for (const f of config.fields) {
      if (f.required && (formValues[f.name] === "" || formValues[f.name] == null)) {
        toast.error(`Campo obrigatório: ${f.label}`);
        return;
      }
    }
    upsertMut.mutate(formValues);
  }

  function renderCell(f: PcpField, val: any) {
    if (val == null || val === "") return <span className="text-muted-foreground">—</span>;
    if (f.type === "boolean") return val ? <Badge variant="default">Sim</Badge> : <Badge variant="outline">Não</Badge>;
    if (f.type === "date") return formatDate(String(val));
    if (f.isCurrency) return formatCurrency(Number(val));
    if (f.type === "number") {
      const n = Number(val);
      return n.toLocaleString("pt-BR", { maximumFractionDigits: 3 });
    }
    if (f.name === "status") {
      const map: Record<string, string> = {
        ok: "bg-success/20 text-success",
        atencao: "bg-warning/20 text-warning",
        vencido: "bg-destructive/20 text-destructive",
        descartado: "bg-muted text-muted-foreground",
      };
      return <span className={`px-2 py-0.5 rounded text-xs ${map[val] ?? ""}`}>{val}</span>;
    }
    return String(val);
  }

  const tableCols = config.fields.filter((f) => f.showInTable);

  return (
    <div className="space-y-4">
      <Card>
        <CardContent className="pt-6">
          <div className="flex flex-col sm:flex-row gap-3 items-start sm:items-center justify-between">
            <div>
              <h3 className="text-lg font-semibold">{config.title}</h3>
              <p className="text-sm text-muted-foreground">{config.description}</p>
            </div>
            <Button onClick={openNew} className="gap-2 shrink-0">
              <Plus className="h-4 w-4" /> Novo Registro
            </Button>
          </div>
          <div className="mt-4 relative">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
            <Input
              placeholder="Buscar..."
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              className="pl-9 max-w-sm"
            />
          </div>
        </CardContent>
      </Card>

      <Card>
        <CardContent className="p-0 overflow-x-auto">
          {isLoading ? (
            <div className="p-4"><TableSkeleton rows={5} cols={tableCols.length + 1} /></div>
          ) : filteredRows.length === 0 ? (
            <div className="p-8 text-center text-muted-foreground text-sm">Nenhum registro encontrado.</div>
          ) : (
            <Table>
              <TableHeader>
                <TableRow>
                  {tableCols.map((f) => (
                    <TableHead key={f.name}>{f.label}</TableHead>
                  ))}
                  <TableHead className="w-24 text-right">Ações</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {filteredRows.map((row: any) => (
                  <TableRow key={row.id}>
                    {tableCols.map((f) => (
                      <TableCell key={f.name}>{renderCell(f, row[f.name])}</TableCell>
                    ))}
                    <TableCell className="text-right">
                      <div className="flex justify-end gap-1">
                        <Button size="icon" variant="ghost" onClick={() => openEdit(row)}>
                          <Pencil className="h-4 w-4" />
                        </Button>
                        <Button size="icon" variant="ghost" onClick={() => setDeleteId(row.id)}>
                          <Trash2 className="h-4 w-4 text-destructive" />
                        </Button>
                      </div>
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          )}
        </CardContent>
      </Card>

      <Dialog open={open} onOpenChange={setOpen}>
        <DialogContent className="max-w-2xl max-h-[90vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle>{editing ? "Editar" : "Novo"} — {config.title}</DialogTitle>
            <DialogDescription>{config.description}</DialogDescription>
          </DialogHeader>
          <form onSubmit={handleSubmit} className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            {config.fields.map((f) => (
              <div
                key={f.name}
                className={f.type === "textarea" ? "sm:col-span-2 space-y-1.5" : "space-y-1.5"}
              >
                <Label htmlFor={f.name}>
                  {f.label}
                  {f.required && <span className="text-destructive ml-1">*</span>}
                  {f.compute && <span className="text-xs text-muted-foreground ml-2">(auto)</span>}
                </Label>
                {f.type === "textarea" ? (
                  <Textarea
                    id={f.name}
                    value={formValues[f.name] ?? ""}
                    onChange={(e) => setFormValues((v) => ({ ...v, [f.name]: e.target.value }))}
                    rows={3}
                  />
                ) : f.type === "select" ? (
                  <Select
                    value={formValues[f.name] ? String(formValues[f.name]) : ""}
                    onValueChange={(val) => setFormValues((v) => ({ ...v, [f.name]: val }))}
                  >
                    <SelectTrigger><SelectValue placeholder="Selecione..." /></SelectTrigger>
                    <SelectContent>
                      {(f.options ?? []).map((opt) => (
                        <SelectItem key={opt.value} value={opt.value}>{opt.label}</SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                ) : f.type === "boolean" ? (
                  <div className="flex items-center h-10">
                    <Switch
                      id={f.name}
                      checked={!!formValues[f.name]}
                      onCheckedChange={(checked) => setFormValues((v) => ({ ...v, [f.name]: checked }))}
                    />
                  </div>
                ) : (
                  <Input
                    id={f.name}
                    type={f.type === "number" ? "number" : f.type === "date" ? "date" : "text"}
                    step={f.step}
                    value={formValues[f.name] ?? ""}
                    onChange={(e) => setFormValues((v) => ({ ...v, [f.name]: e.target.value }))}
                  />
                )}
              </div>
            ))}
            <DialogFooter className="sm:col-span-2">
              <Button type="button" variant="outline" onClick={() => setOpen(false)}>
                Cancelar
              </Button>
              <Button type="submit" disabled={upsertMut.isPending}>
                {upsertMut.isPending ? "Salvando..." : editing ? "Salvar" : "Criar"}
              </Button>
            </DialogFooter>
          </form>
        </DialogContent>
      </Dialog>

      <AlertDialog open={!!deleteId} onOpenChange={(o) => !o && setDeleteId(null)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Excluir registro?</AlertDialogTitle>
            <AlertDialogDescription>Esta ação não pode ser desfeita.</AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancelar</AlertDialogCancel>
            <AlertDialogAction
              onClick={() => deleteId && deleteMut.mutate(deleteId)}
              className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
            >
              Excluir
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
}
