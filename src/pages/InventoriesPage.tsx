import { useState } from "react";
import { useNavigate } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/contexts/AuthContext";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { CalcInput } from "@/components/CalcInput";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Textarea } from "@/components/ui/textarea";
import { Checkbox } from "@/components/ui/checkbox";
import { Badge } from "@/components/ui/badge";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog";
import { toast } from "sonner";
import { Plus, X, Search, Trash2, Boxes, Send, FileDown, Pencil, ShieldCheck, KeyRound } from "lucide-react";
import { formatDate } from "@/lib/helpers";
import { generateInventoryPDF } from "@/lib/pdfGenerator";
import { resolveUserNames } from "@/lib/userNames";
import { UNIDADES, SETORES, TITULOS_SOLICITACAO, TITULO_TO_CATEGORIA } from "@/lib/constants";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import TableSkeleton from "@/components/TableSkeleton";

type Product = { id: string; nome: string; unidade_medida: string; categoria: string | null };
type DraftItem = { id?: string; product_id: string; nome: string; unidade_medida: string; saldo: string; observacoes: string; solicitar_compra: boolean };
type Inventory = {
  id: string; numero: string | null; titulo: string; categoria: string | null; unidade: string;
  setor: string | null; observacoes: string | null; created_at: string; user_id: string;
  status: string; enviado_em: string | null; autorizado_em: string | null;
  itemsCount: number;
};

const STATUS_BADGE: Record<string, "default"|"secondary"|"outline"|"destructive"> = {
  rascunho: "secondary", enviado: "default", autorizado: "outline",
};

export default function InventoriesPage() {
  const { user, role } = useAuth();
  const navigate = useNavigate();
  const queryClient = useQueryClient();
  const isMaster = role === 'master';

  const [showForm, setShowForm] = useState(false);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [titulo, setTitulo] = useState("");
  const [unidade, setUnidade] = useState("");
  const [setor, setSetor] = useState("");
  const [categoria, setCategoria] = useState("");
  const [observacoes, setObservacoes] = useState("");
  const [items, setItems] = useState<DraftItem[]>([]);
  const [productSearch, setProductSearch] = useState("");
  const [saving, setSaving] = useState(false);
  const [confirmReqOpen, setConfirmReqOpen] = useState<{ inventoryId: string; count: number } | null>(null);
  const [confirmSendOpen, setConfirmSendOpen] = useState<Inventory | null>(null);

  const { data, isLoading } = useQuery({
    queryKey: ['inventories-page'],
    queryFn: async () => {
      const [{ data: invs }, { data: prods }, { data: itemsAll }] = await Promise.all([
        (supabase as any).from('inventories').select('*').order('created_at', { ascending: false }),
        supabase.from('products').select('id, nome, unidade_medida, categoria').eq('status', 'ativo').order('nome'),
        (supabase as any).from('inventory_items').select('inventory_id'),
      ]);
      const counts: Record<string, number> = {};
      (itemsAll || []).forEach((r: any) => { counts[r.inventory_id] = (counts[r.inventory_id] || 0) + 1; });
      const userIds = Array.from(new Set((invs || []).map((i: any) => i.user_id))) as string[];
      const nameMap = userIds.length ? await resolveUserNames(userIds) : {};
      const distinctCats = Array.from(new Set((prods || []).map((p: any) => p.categoria).filter(Boolean))).sort() as string[];
      return {
        inventories: ((invs || []) as any[]).map(i => ({ ...i, itemsCount: counts[i.id] || 0 })) as Inventory[],
        products: (prods || []) as Product[],
        categories: distinctCats,
        nameMap,
      };
    },
    staleTime: 30 * 1000,
  });

  const inventories = data?.inventories || [];
  const products = data?.products || [];
  const categories = data?.categories || [];
  const nameMap = data?.nameMap || {};

  const filteredProducts = products.filter(p =>
    p.nome.toLowerCase().includes(productSearch.toLowerCase()) &&
    !items.some(i => i.product_id === p.id)
  );

  const canEdit = (inv: Inventory) => inv.user_id === user?.id && (inv.status === 'rascunho' || inv.status === 'autorizado') || isMaster;

  const loadCategoryProducts = () => {
    if (!categoria) return;
    const catProducts = products.filter(p => p.categoria === categoria && !items.some(i => i.product_id === p.id));
    if (catProducts.length === 0) { toast.info("Nenhum produto novo nesta categoria."); return; }
    setItems(prev => [
      ...prev,
      ...catProducts.map(p => ({ product_id: p.id, nome: p.nome, unidade_medida: p.unidade_medida, saldo: "", observacoes: "", solicitar_compra: false })),
    ]);
    toast.success(`${catProducts.length} produtos carregados`);
  };

  const addProduct = (p: Product) => {
    setItems([...items, { product_id: p.id, nome: p.nome, unidade_medida: p.unidade_medida, saldo: "", observacoes: "", solicitar_compra: false }]);
    setProductSearch("");
  };
  const removeItem = (idx: number) => setItems(items.filter((_, i) => i !== idx));
  const updateField = (idx: number, field: keyof DraftItem, val: any) => {
    const c = [...items]; c[idx] = { ...c[idx], [field]: val }; setItems(c);
  };
  const resetForm = () => {
    setEditingId(null); setTitulo(""); setUnidade(""); setSetor(""); setCategoria(""); setObservacoes("");
    setItems([]); setShowForm(false);
  };

  const openNew = () => { resetForm(); setShowForm(true); };

  const openEdit = async (inv: Inventory) => {
    if (!canEdit(inv)) { toast.error("Sem permissão para editar"); return; }
    const { data: its } = await (supabase as any).from('inventory_items')
      .select('id, product_id, saldo, observacoes, solicitar_compra, products(nome, unidade_medida)')
      .eq('inventory_id', inv.id);
    setEditingId(inv.id);
    setTitulo(inv.titulo); setUnidade(inv.unidade); setSetor(inv.setor || "");
    setCategoria(inv.categoria || ""); setObservacoes(inv.observacoes || "");
    setItems((its || []).map((i: any) => ({
      id: i.id, product_id: i.product_id, nome: i.products?.nome || "—",
      unidade_medida: i.products?.unidade_medida || "",
      saldo: String(i.saldo || ""), observacoes: i.observacoes || "",
      solicitar_compra: !!i.solicitar_compra,
    })));
    setShowForm(true);
    window.scrollTo({ top: 0, behavior: 'smooth' });
  };

  const logEvent = async (inventory_id: string, action: string, detalhes?: string) => {
    if (!user) return;
    await (supabase as any).from('inventory_log').insert({ inventory_id, user_id: user.id, action, detalhes: detalhes || null });
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!titulo) { toast.error("Selecione o título."); return; }
    if (!unidade) { toast.error("Selecione a unidade."); return; }
    const valid = items.filter(i => i.product_id);
    if (valid.length === 0) { toast.error("Adicione ao menos um produto."); return; }
    setSaving(true);

    if (editingId) {
      const { error } = await (supabase as any).from('inventories').update({
        titulo, categoria: categoria || null, unidade, setor: setor || null, observacoes: observacoes || null, updated_at: new Date().toISOString(),
      }).eq('id', editingId);
      if (error) { toast.error(error.message); setSaving(false); return; }
      // Replace items
      await (supabase as any).from('inventory_items').delete().eq('inventory_id', editingId);
      await (supabase as any).from('inventory_items').insert(valid.map(i => ({
        inventory_id: editingId, product_id: i.product_id,
        saldo: parseFloat(i.saldo) || 0, observacoes: i.observacoes || null,
        solicitar_compra: i.solicitar_compra,
      })));
      await logEvent(editingId, 'editado', `${valid.length} itens`);
      toast.success("Inventário atualizado!");
      const flagged = valid.filter(i => i.solicitar_compra).length;
      if (flagged > 0) setConfirmReqOpen({ inventoryId: editingId, count: flagged });
    } else {
      // Generate numero
      const { data: numData } = await (supabase as any).rpc('generate_inventory_number');
      const numero = numData as string;
      const { data: inv, error } = await (supabase as any).from('inventories').insert({
        user_id: user!.id, created_by: user!.id, numero, status: 'rascunho',
        titulo, categoria: categoria || null, unidade, setor: setor || null, observacoes: observacoes || null,
      }).select('id').single();
      if (error || !inv) { toast.error(error?.message || "Erro"); setSaving(false); return; }
      await (supabase as any).from('inventory_items').insert(valid.map(i => ({
        inventory_id: inv.id, product_id: i.product_id,
        saldo: parseFloat(i.saldo) || 0, observacoes: i.observacoes || null,
        solicitar_compra: i.solicitar_compra,
      })));
      await logEvent(inv.id, 'criado', `${numero} — ${valid.length} itens`);
      toast.success("Inventário salvo!");
      const flagged = valid.filter(i => i.solicitar_compra).length;
      if (flagged > 0) setConfirmReqOpen({ inventoryId: inv.id, count: flagged });
    }
    resetForm();
    queryClient.invalidateQueries({ queryKey: ['inventories-page'] });
    queryClient.invalidateQueries({ queryKey: ['inventories-for-import'] });
    queryClient.invalidateQueries({ queryKey: ['inventory-history'] });
    setSaving(false);
  };

  const sendInventory = (inv: Inventory) => {
    if (inv.user_id !== user?.id && !isMaster) { toast.error("Sem permissão"); return; }
    setConfirmSendOpen(inv);
  };

  const executeSendInventory = async () => {
    const inv = confirmSendOpen;
    if (!inv) return;
    setConfirmSendOpen(null);
    const { error } = await (supabase as any).from('inventories').update({
      status: 'enviado', enviado_em: new Date().toISOString(),
    }).eq('id', inv.id);
    if (error) { toast.error(error.message); return; }
    await logEvent(inv.id, 'enviado');
    const { data: flagged } = await (supabase as any).from('inventory_items')
      .select('id').eq('inventory_id', inv.id).eq('solicitar_compra', true);
    toast.success("Inventário enviado!");
    queryClient.invalidateQueries({ queryKey: ['inventories-page'] });
    if (flagged && flagged.length > 0) {
      setConfirmReqOpen({ inventoryId: inv.id, count: flagged.length });
    }
  };

  const requestAuth = async (inv: Inventory) => {
    if (!user) return;
    await logEvent(inv.id, 'solicitou_autorizacao', 'Solicitou autorização para edição');
    // Notify masters
    const { data: masters } = await supabase.from('user_roles').select('user_id').eq('role', 'master');
    if (masters && masters.length > 0) {
      const { error: notifErr } = await supabase.from('notifications').insert(masters.map((m: any) => ({
        user_id: m.user_id, titulo: 'Autorização de inventário',
        mensagem: `${nameMap[user.id] || 'Usuário'} solicitou autorização para editar o inventário ${inv.numero}.`,
        tipo: 'alerta', link: '/inventarios',
      })));
      if (notifErr) {
        toast.error("Não foi possível notificar os gerentes: " + notifErr.message);
        return;
      }
    }
    toast.success("Autorização solicitada aos gerentes/master.");
  };

  const authorize = async (inv: Inventory) => {
    if (!isMaster) { toast.error("Apenas master pode autorizar"); return; }
    const { error } = await (supabase as any).from('inventories').update({
      status: 'autorizado', autorizado_em: new Date().toISOString(), autorizado_por: user!.id,
    }).eq('id', inv.id);
    if (error) { toast.error(error.message); return; }
    await logEvent(inv.id, 'autorizado', 'Edição liberada');
    await supabase.from('notifications').insert({
      user_id: inv.user_id, titulo: 'Inventário autorizado',
      mensagem: `Seu inventário ${inv.numero} foi autorizado para edição.`,
      tipo: 'sucesso', link: '/inventarios',
    });
    toast.success("Inventário autorizado");
    queryClient.invalidateQueries({ queryKey: ['inventories-page'] });
  };

  const deleteInventory = async (inv: Inventory) => {
    if (inv.user_id !== user?.id && !isMaster) return;
    if (!confirm("Excluir este inventário?")) return;
    await (supabase as any).from('inventory_items').delete().eq('inventory_id', inv.id);
    await (supabase as any).from('inventory_log').delete().eq('inventory_id', inv.id);
    const { error } = await (supabase as any).from('inventories').delete().eq('id', inv.id);
    if (error) toast.error(error.message);
    else { toast.success("Excluído"); queryClient.invalidateQueries({ queryKey: ['inventories-page'] }); }
  };

  const exportPDF = async (inv: Inventory) => {
    const [{ data: its }, { data: log }] = await Promise.all([
      (supabase as any).from('inventory_items').select('saldo, observacoes, solicitar_compra, products(nome, unidade_medida)').eq('inventory_id', inv.id),
      (supabase as any).from('inventory_log').select('*').eq('inventory_id', inv.id).order('created_at', { ascending: true }),
    ]);
    const logUserIds = Array.from(new Set((log || []).map((l: any) => l.user_id).filter(Boolean))) as string[];
    const ln = logUserIds.length ? await resolveUserNames(logUserIds) : {};
    generateInventoryPDF({
      numero: inv.numero || inv.id.slice(0, 8),
      titulo: inv.titulo, unidade: inv.unidade, setor: inv.setor, categoria: inv.categoria,
      criado_por: nameMap[inv.user_id] || '—', status: inv.status, created_at: inv.created_at,
      observacoes: inv.observacoes,
      items: (its || []).map((i: any) => ({
        produto: i.products?.nome || '—', unidade: i.products?.unidade_medida || '',
        saldo: Number(i.saldo || 0), observacoes: i.observacoes, solicitar_compra: !!i.solicitar_compra,
      })),
      log: (log || []).map((l: any) => ({
        data: l.created_at, usuario: ln[l.user_id] || '—', acao: l.action, detalhes: l.detalhes,
      })),
    });
  };

  const goCreateRequisition = (inventoryId: string) => {
    setConfirmReqOpen(null);
    navigate(`/minhas-solicitacoes?fromInventory=${inventoryId}`);
  };

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between flex-wrap gap-4">
        <div>
          <h1 className="text-2xl font-bold">Inventários</h1>
          <p className="text-muted-foreground text-sm mt-1">Cadastre saldos para reaproveitar em solicitações</p>
        </div>
        <div className="flex gap-2">
          <Button variant="outline" onClick={() => navigate('/historico-inventarios')}>Histórico</Button>
          <Button onClick={() => { showForm ? resetForm() : openNew(); }}>
            <Plus className="h-4 w-4 mr-2" />{showForm ? "Cancelar" : "Novo Inventário"}
          </Button>
        </div>
      </div>

      {showForm && (
        <Card>
          <CardHeader><CardTitle className="text-lg">{editingId ? "Editar Inventário" : "Novo Inventário"}</CardTitle></CardHeader>
          <CardContent>
            <form onSubmit={handleSubmit} className="space-y-4">
              <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                <div className="space-y-2">
                  <Label>Título *</Label>
                  <Select value={titulo} onValueChange={(v) => {
                    setTitulo(v);
                    const cat = TITULO_TO_CATEGORIA[v];
                    if (cat && categories.includes(cat)) setCategoria(cat);
                  }}>
                    <SelectTrigger><SelectValue placeholder="Selecione" /></SelectTrigger>
                    <SelectContent>{TITULOS_SOLICITACAO.map(t => <SelectItem key={t} value={t}>{t}</SelectItem>)}</SelectContent>
                  </Select>
                </div>
                <div className="space-y-2">
                  <Label>Unidade *</Label>
                  <Select value={unidade} onValueChange={setUnidade}>
                    <SelectTrigger><SelectValue placeholder="Selecione" /></SelectTrigger>
                    <SelectContent>{UNIDADES.map(u => <SelectItem key={u} value={u}>{u}</SelectItem>)}</SelectContent>
                  </Select>
                </div>
                <div className="space-y-2">
                  <Label>Setor</Label>
                  <Select value={setor} onValueChange={setSetor}>
                    <SelectTrigger><SelectValue placeholder="Selecione" /></SelectTrigger>
                    <SelectContent>{SETORES.map(s => <SelectItem key={s} value={s}>{s}</SelectItem>)}</SelectContent>
                  </Select>
                </div>
              </div>
              <div className="space-y-2">
                <Label>Categoria</Label>
                <div className="flex gap-2">
                  <Select value={categoria} onValueChange={setCategoria}>
                    <SelectTrigger><SelectValue placeholder="Selecione categoria" /></SelectTrigger>
                    <SelectContent>{categories.map(c => <SelectItem key={c} value={c}>{c}</SelectItem>)}</SelectContent>
                  </Select>
                  <Button type="button" variant="outline" onClick={loadCategoryProducts} disabled={!categoria}>Carregar produtos</Button>
                </div>
              </div>
              <div className="space-y-2">
                <Label>Adicionar Produtos</Label>
                <div className="relative">
                  <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                  <Input placeholder="Buscar..." className="pl-9" value={productSearch} onChange={e => setProductSearch(e.target.value)} />
                </div>
                {productSearch.length >= 2 && filteredProducts.length > 0 && (
                  <div className="border rounded-md max-h-40 overflow-y-auto">
                    {filteredProducts.slice(0, 10).map(p => (
                      <button key={p.id} type="button" className="w-full text-left px-3 py-2 hover:bg-muted/50 text-sm flex justify-between" onClick={() => addProduct(p)}>
                        <span>{p.nome}</span><span className="text-muted-foreground text-xs">{p.unidade_medida}</span>
                      </button>
                    ))}
                  </div>
                )}
              </div>
              {items.length > 0 && (
                <div className="border rounded-md overflow-x-auto">
                  <table className="w-full text-sm">
                    <thead><tr className="border-b bg-muted/30">
                      <th className="text-left py-2 px-3">Produto</th>
                      <th className="text-left py-2 px-3 w-20">Unidade</th>
                      <th className="text-right py-2 px-3 w-28">Saldo</th>
                      <th className="text-center py-2 px-3 w-20">Comprar?</th>
                      <th className="text-left py-2 px-3 w-40">Observações</th>
                      <th className="w-10"></th>
                    </tr></thead>
                    <tbody>
                      {[...items].sort((a, b) => a.nome.localeCompare(b.nome, 'pt-BR')).map((it) => {
                        const idx = items.findIndex(i => i.product_id === it.product_id);
                        return (
                          <tr key={it.product_id} className="border-b last:border-0">
                            <td className="py-2 px-3 font-medium">{it.nome}</td>
                            <td className="py-2 px-3 text-muted-foreground">{it.unidade_medida}</td>
                            <td className="py-2 px-3"><Input type="number" step="0.01" min="0" className="w-24 ml-auto text-right h-8" value={it.saldo} onChange={e => updateField(idx, 'saldo', e.target.value)} placeholder="0" /></td>
                            <td className="py-2 px-3 text-center">
                              <Checkbox checked={it.solicitar_compra} onCheckedChange={(v) => updateField(idx, 'solicitar_compra', !!v)} />
                            </td>
                            <td className="py-2 px-3"><Input className="w-36 h-8 text-xs" value={it.observacoes} onChange={e => updateField(idx, 'observacoes', e.target.value)} placeholder="Obs..." /></td>
                            <td className="py-2 px-1"><Button type="button" variant="ghost" size="icon" className="h-7 w-7" onClick={() => removeItem(idx)}><X className="h-3 w-3" /></Button></td>
                          </tr>
                        );
                      })}
                    </tbody>
                  </table>
                </div>
              )}
              <div className="space-y-2">
                <Label>Observações</Label>
                <Textarea value={observacoes} onChange={e => setObservacoes(e.target.value)} />
              </div>
              <div className="flex justify-end gap-2">
                <Button type="button" variant="outline" onClick={resetForm}>Cancelar</Button>
                <Button type="submit" disabled={saving}>{saving ? "Salvando..." : (editingId ? "Atualizar" : "Salvar Inventário")}</Button>
              </div>
            </form>
          </CardContent>
        </Card>
      )}

      <Card>
        <CardContent className="p-0">
          {isLoading ? <TableSkeleton columns={6} rows={5} /> : inventories.length === 0 ? (
            <div className="flex flex-col items-center justify-center py-16 text-muted-foreground">
              <Boxes className="h-12 w-12 mb-3 opacity-50" />
              <p className="text-sm">Nenhum inventário cadastrado</p>
            </div>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead><tr className="border-b">
                  <th className="text-left py-3 px-4 font-medium text-muted-foreground">Número</th>
                  <th className="text-left py-3 px-4 font-medium text-muted-foreground">Título</th>
                  <th className="text-left py-3 px-4 font-medium text-muted-foreground hidden md:table-cell">Unidade</th>
                  <th className="text-left py-3 px-4 font-medium text-muted-foreground hidden lg:table-cell">Usuário</th>
                  <th className="text-center py-3 px-4 font-medium text-muted-foreground">Itens</th>
                  <th className="text-center py-3 px-4 font-medium text-muted-foreground">Status</th>
                  <th className="text-left py-3 px-4 font-medium text-muted-foreground hidden md:table-cell">Data</th>
                  <th className="text-right py-3 px-4 font-medium text-muted-foreground">Ações</th>
                </tr></thead>
                <tbody>
                  {inventories.map(inv => {
                    const isOwner = inv.user_id === user?.id;
                    return (
                      <tr key={inv.id} className="border-b last:border-0 hover:bg-muted/50">
                        <td className="py-3 px-4 font-mono text-xs">{inv.numero || '—'}</td>
                        <td className="py-3 px-4 font-medium">{inv.titulo}</td>
                        <td className="py-3 px-4 text-muted-foreground hidden md:table-cell">{inv.unidade}</td>
                        <td className="py-3 px-4 text-muted-foreground hidden lg:table-cell">{nameMap[inv.user_id] || '—'}</td>
                        <td className="py-3 px-4 text-center">{inv.itemsCount}</td>
                        <td className="py-3 px-4 text-center">
                          <Badge variant={STATUS_BADGE[inv.status] || 'secondary'}>{inv.status}</Badge>
                        </td>
                        <td className="py-3 px-4 text-muted-foreground hidden md:table-cell">{formatDate(inv.created_at)}</td>
                        <td className="py-3 px-4 text-right space-x-1 whitespace-nowrap">
                          <Button size="icon" variant="ghost" title="Baixar PDF" onClick={() => exportPDF(inv)}>
                            <FileDown className="h-4 w-4" />
                          </Button>
                          {canEdit(inv) && (
                            <Button size="icon" variant="ghost" title="Editar" onClick={() => openEdit(inv)}>
                              <Pencil className="h-4 w-4" />
                            </Button>
                          )}
                          {isOwner && inv.status === 'rascunho' && (
                            <Button size="icon" variant="ghost" title="Enviar" onClick={() => sendInventory(inv)}>
                              <Send className="h-4 w-4" />
                            </Button>
                          )}
                          {isOwner && inv.status === 'enviado' && (
                            <Button size="icon" variant="ghost" title="Solicitar autorização" onClick={() => requestAuth(inv)}>
                              <KeyRound className="h-4 w-4" />
                            </Button>
                          )}
                          {isMaster && inv.status === 'enviado' && (
                            <Button size="icon" variant="ghost" title="Autorizar edição" onClick={() => authorize(inv)}>
                              <ShieldCheck className="h-4 w-4 text-primary" />
                            </Button>
                          )}
                          {(isOwner || isMaster) && (
                            <Button size="icon" variant="ghost" title="Excluir" onClick={() => deleteInventory(inv)}>
                              <Trash2 className="h-4 w-4 text-destructive" />
                            </Button>
                          )}
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          )}
        </CardContent>
      </Card>

      <Dialog open={!!confirmSendOpen} onOpenChange={(v) => !v && setConfirmSendOpen(null)}>
        <DialogContent>
          <DialogHeader><DialogTitle>Confirmar envio do inventário</DialogTitle></DialogHeader>
          <p className="text-sm text-muted-foreground">
            Confirma o envio do inventário <strong>{confirmSendOpen?.titulo}</strong>? Após enviar, edições precisarão de autorização.
          </p>
          <DialogFooter>
            <Button variant="outline" onClick={() => setConfirmSendOpen(null)}>Cancelar</Button>
            <Button onClick={executeSendInventory}>Confirmar envio</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <Dialog open={!!confirmReqOpen} onOpenChange={(v) => !v && setConfirmReqOpen(null)}>
        <DialogContent>
          <DialogHeader><DialogTitle>Criar solicitação de compra?</DialogTitle></DialogHeader>
          <p className="text-sm text-muted-foreground">
            Você marcou <strong>{confirmReqOpen?.count}</strong> item(ns) para solicitar compra. Deseja criar uma Solicitação pré-preenchida com esses itens e seus saldos?
          </p>
          <DialogFooter>
            <Button variant="outline" onClick={() => setConfirmReqOpen(null)}>Agora não</Button>
            <Button onClick={() => confirmReqOpen && goCreateRequisition(confirmReqOpen.inventoryId)}>
              Sim, criar solicitação
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
