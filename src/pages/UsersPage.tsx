import { useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import { Switch } from "@/components/ui/switch";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent, AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle } from "@/components/ui/alert-dialog";
import { toast } from "sonner";
import { Users, Pencil, Search, Trash2, CheckCircle, XCircle, Clock } from "lucide-react";
import { roleLabels, AppRole, ALL_PAGES, getDefaultPagesForRole } from "@/lib/helpers";
import { UNIDADES } from "@/lib/constants";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import TableSkeleton from "@/components/TableSkeleton";
import QueryError from "@/components/QueryError";

type UserProfile = {
  id: string; user_id: string; full_name: string; email: string | null;
  unidade_setor: string | null; unidade: string | null; created_at: string;
  status: string; permissoes_customizadas: Record<string, boolean> | null;
  role?: AppRole;
};

export default function UsersPage() {
  const queryClient = useQueryClient();
  const [search, setSearch] = useState("");
  const [editDialog, setEditDialog] = useState<UserProfile | null>(null);
  const [editRole, setEditRole] = useState<AppRole>('solicitante');
  const [editSetor, setEditSetor] = useState("");
  const [editUnidade, setEditUnidade] = useState("");
  const [editPermissions, setEditPermissions] = useState<Record<string, boolean>>({});
  const [showCleanupConfirm, setShowCleanupConfirm] = useState(false);
  const [cleaningUp, setCleaningUp] = useState(false);
  const [approveRole, setApproveRole] = useState<AppRole>('solicitante');

  const { data: users = [], isLoading, isError, refetch } = useQuery({
    queryKey: ['users-list'],
    queryFn: async () => {
      const [{ data: profiles, error: e1 }, { data: roles, error: e2 }] = await Promise.all([
        supabase.rpc('list_profiles_for_master' as any),
        supabase.from('user_roles').select('user_id, role'),
      ]);
      if (e1 || e2) throw new Error("Erro ao carregar usuários");
      const roleMap: Record<string, AppRole> = {};
      (roles || []).forEach((r: any) => { roleMap[r.user_id] = r.role; });
      return ((profiles as any[]) || []).map((p: any) => ({ ...p, id: p.user_id, role: roleMap[p.user_id] || 'solicitante' })) as UserProfile[];
    },
    staleTime: 5 * 60 * 1000,
  });

  const pendingUsers = users.filter(u => u.status === 'pendente');
  const activeUsers = users.filter(u => u.status !== 'pendente');
  const filtered = activeUsers.filter(u =>
    u.full_name.toLowerCase().includes(search.toLowerCase()) ||
    (u.email || '').toLowerCase().includes(search.toLowerCase())
  );

  const openEdit = (u: UserProfile) => {
    setEditDialog(u);
    setEditRole(u.role || 'solicitante');
    setEditSetor(u.unidade_setor || '');
    setEditUnidade(u.unidade || '');
    // Init permissions: start with defaults, then apply custom overrides
    const defaults = getDefaultPagesForRole(u.role || 'solicitante');
    const perms: Record<string, boolean> = {};
    ALL_PAGES.forEach(p => { perms[p.key] = defaults.includes(p.key); });
    if (u.permissoes_customizadas) {
      Object.entries(u.permissoes_customizadas).forEach(([k, v]) => { perms[k] = v; });
    }
    setEditPermissions(perms);
  };

  const handleRoleChangeInEdit = (newRole: AppRole) => {
    setEditRole(newRole);
    const defaults = getDefaultPagesForRole(newRole);
    const perms: Record<string, boolean> = {};
    ALL_PAGES.forEach(p => { perms[p.key] = defaults.includes(p.key); });
    setEditPermissions(perms);
  };

  const handleSave = async () => {
    if (!editDialog) return;
    // Calculate custom permissions (diff from role defaults)
    const defaults = getDefaultPagesForRole(editRole);
    const customPerms: Record<string, boolean> = {};
    let hasCustom = false;
    ALL_PAGES.forEach(p => {
      const defaultAccess = defaults.includes(p.key);
      if (editPermissions[p.key] !== defaultAccess) {
        customPerms[p.key] = editPermissions[p.key];
        hasCustom = true;
      }
    });

    await supabase.from('user_roles').update({ role: editRole } as any).eq('user_id', editDialog.user_id);
    await supabase.from('profiles').update({
      unidade_setor: editSetor || null,
      unidade: editUnidade || null,
      permissoes_customizadas: hasCustom ? customPerms : null,
    } as any).eq('user_id', editDialog.user_id);
    toast.success("Usuário atualizado!");
    setEditDialog(null);
    queryClient.invalidateQueries({ queryKey: ['users-list'] });
  };

  const handleApprove = async (u: UserProfile) => {
    await supabase.from('profiles').update({ status: 'ativo' } as any).eq('user_id', u.user_id);
    await supabase.from('user_roles').update({ role: approveRole } as any).eq('user_id', u.user_id);
    await supabase.from('notifications').insert({
      user_id: u.user_id,
      titulo: '✅ Acesso aprovado!',
      mensagem: 'Seu acesso ao sistema foi aprovado pelo administrador. Você já pode utilizar o sistema.',
      tipo: 'info', lida: false,
    } as any);
    toast.success(`${u.full_name} aprovado como ${roleLabels[approveRole]}!`);
    setApproveRole('solicitante');
    queryClient.invalidateQueries({ queryKey: ['users-list'] });
  };

  const handleReject = async (u: UserProfile) => {
    await supabase.from('profiles').update({ status: 'inativo' } as any).eq('user_id', u.user_id);
    await supabase.from('notifications').insert({
      user_id: u.user_id,
      titulo: '❌ Acesso negado',
      mensagem: 'Seu acesso ao sistema foi negado pelo administrador.',
      tipo: 'alerta', lida: false,
    } as any);
    toast.success(`Acesso de ${u.full_name} recusado.`);
    queryClient.invalidateQueries({ queryKey: ['users-list'] });
  };

  const handleCleanupRefused = async () => {
    setCleaningUp(true);
    const { count } = await supabase.from('requisitions').select('*', { count: 'exact', head: true }).eq('status', 'recusada');
    const { error } = await supabase.from('requisitions').delete().eq('status', 'recusada');
    if (error) { toast.error(`Erro ao limpar: ${error.message}`); }
    else {
      toast.success(`${count || 0} solicitação(ões) recusada(s) removida(s).`);
      queryClient.invalidateQueries({ queryKey: ['requisitions-list'] });
      queryClient.invalidateQueries({ queryKey: ['my-requisitions'] });
    }
    setCleaningUp(false);
    setShowCleanupConfirm(false);
  };

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between flex-wrap gap-4">
        <div>
          <h1 className="text-2xl font-bold">Usuários</h1>
          <p className="text-muted-foreground text-sm mt-1">Gerencie os usuários e perfis de acesso</p>
        </div>
        <Button variant="outline" size="sm" onClick={() => setShowCleanupConfirm(true)}>
          <Trash2 className="h-4 w-4 mr-2" />Limpar Recusadas
        </Button>
      </div>

      {/* Pending Users Section */}
      {pendingUsers.length > 0 && (
        <Card className="border-warning/50">
          <CardHeader className="pb-3">
            <CardTitle className="text-lg flex items-center gap-2">
              <Clock className="h-5 w-5 text-warning" />
              Usuários Pendentes ({pendingUsers.length})
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-3">
            {pendingUsers.map(u => (
              <div key={u.id} className="flex items-center justify-between border rounded-lg p-3 bg-warning/5">
                <div>
                  <p className="font-medium">{u.full_name || '—'}</p>
                  <p className="text-xs text-muted-foreground">{u.email} • {u.unidade || 'Sem unidade'} • {u.unidade_setor || 'Sem setor'}</p>
                </div>
                <div className="flex items-center gap-2">
                  <Select value={approveRole} onValueChange={v => setApproveRole(v as AppRole)}>
                    <SelectTrigger className="w-[180px] h-8 text-xs">
                      <SelectValue placeholder="Perfil" />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="solicitante">Solicitante</SelectItem>
                      <SelectItem value="comprador">Comprador</SelectItem>
                      <SelectItem value="aprovador">Aprovador</SelectItem>
                      <SelectItem value="estoquista">Assistente de Suprimentos</SelectItem>
                      <SelectItem value="financeiro">Financeiro</SelectItem>
                      <SelectItem value="master">Master</SelectItem>
                    </SelectContent>
                  </Select>
                  <Button size="sm" variant="default" onClick={() => handleApprove(u)} className="gap-1">
                    <CheckCircle className="h-3 w-3" />Aprovar
                  </Button>
                  <Button size="sm" variant="destructive" onClick={() => handleReject(u)} className="gap-1">
                    <XCircle className="h-3 w-3" />Recusar
                  </Button>
                </div>
              </div>
            ))}
          </CardContent>
        </Card>
      )}

      <div className="relative max-w-md">
        <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
        <Input placeholder="Buscar por nome ou e-mail..." className="pl-9" value={search} onChange={e => setSearch(e.target.value)} />
      </div>

      <Card>
        <CardContent className="p-0">
          {isLoading ? <TableSkeleton columns={6} rows={6} /> : isError ? (
            <QueryError onRetry={() => refetch()} />
          ) : filtered.length === 0 ? (
            <div className="flex flex-col items-center justify-center py-16 text-muted-foreground">
              <Users className="h-12 w-12 mb-3 opacity-50" />
              <p className="text-sm">Nenhum usuário encontrado</p>
            </div>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead>
                  <tr className="border-b">
                    <th className="text-left py-3 px-4 font-medium text-muted-foreground">Nome</th>
                    <th className="text-left py-3 px-4 font-medium text-muted-foreground">E-mail</th>
                    <th className="text-left py-3 px-4 font-medium text-muted-foreground hidden md:table-cell">Unidade</th>
                    <th className="text-left py-3 px-4 font-medium text-muted-foreground hidden md:table-cell">Setor</th>
                    <th className="text-center py-3 px-4 font-medium text-muted-foreground">Perfil</th>
                    <th className="text-right py-3 px-4 font-medium text-muted-foreground">Ações</th>
                  </tr>
                </thead>
                <tbody>
                  {filtered.map(u => (
                    <tr key={u.id} className="border-b last:border-0 hover:bg-muted/50">
                      <td className="py-3 px-4 font-medium">{u.full_name || '—'}</td>
                      <td className="py-3 px-4 text-muted-foreground">{u.email || '—'}</td>
                      <td className="py-3 px-4 text-muted-foreground hidden md:table-cell">{u.unidade || '—'}</td>
                      <td className="py-3 px-4 text-muted-foreground hidden md:table-cell">{u.unidade_setor || '—'}</td>
                      <td className="py-3 px-4 text-center">
                        <Badge variant="outline">{roleLabels[u.role || 'solicitante']}</Badge>
                      </td>
                      <td className="py-3 px-4 text-right">
                        <Button variant="ghost" size="icon" onClick={() => openEdit(u)}><Pencil className="h-4 w-4" /></Button>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </CardContent>
      </Card>

      {/* Edit Dialog with Permission Toggles */}
      <Dialog open={!!editDialog} onOpenChange={() => setEditDialog(null)}>
        <DialogContent className="max-w-lg max-h-[90vh] overflow-y-auto">
          <DialogHeader><DialogTitle>Editar Usuário</DialogTitle></DialogHeader>
          <div className="space-y-4">
            <div className="space-y-2"><Label>Nome</Label><Input value={editDialog?.full_name || ''} disabled /></div>
            <div className="space-y-2">
              <Label>Perfil de Acesso</Label>
              <Select value={editRole} onValueChange={v => handleRoleChangeInEdit(v as AppRole)}>
                <SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="solicitante">Solicitante</SelectItem>
                  <SelectItem value="comprador">Comprador</SelectItem>
                  <SelectItem value="aprovador">Aprovador</SelectItem>
                  <SelectItem value="estoquista">Assistente de Suprimentos</SelectItem>
                  <SelectItem value="financeiro">Financeiro</SelectItem>
                  <SelectItem value="master">Master</SelectItem>
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-2">
              <Label>Unidade</Label>
              <Select value={editUnidade} onValueChange={setEditUnidade}>
                <SelectTrigger><SelectValue placeholder="Selecione a unidade" /></SelectTrigger>
                <SelectContent>
                  {UNIDADES.map(u => <SelectItem key={u} value={u}>{u}</SelectItem>)}
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-2">
              <Label>Setor</Label>
              <Input value={editSetor} onChange={e => setEditSetor(e.target.value)} placeholder="Ex: Cozinha, Administrativo..." />
            </div>

            {/* Permission Toggles */}
            {editRole !== 'master' && (
              <div className="space-y-3 border-t pt-4">
                <Label className="text-sm font-semibold">Permissões de Acesso</Label>
                <p className="text-xs text-muted-foreground">Ative ou desative o acesso a telas específicas para este usuário</p>
                <div className="space-y-2">
                  {ALL_PAGES.filter(p => p.key !== 'usuarios').map(page => {
                    const defaultPages = getDefaultPagesForRole(editRole);
                    const isDefault = defaultPages.includes(page.key);
                    const isActive = editPermissions[page.key] ?? false;
                    const isCustom = isActive !== isDefault;
                    return (
                      <div key={page.key} className="flex items-center justify-between py-1.5">
                        <div className="flex items-center gap-2">
                          <span className="text-sm">{page.label}</span>
                          {isCustom && <Badge variant="outline" className="text-[10px] px-1.5 py-0">Customizado</Badge>}
                        </div>
                        <Switch
                          checked={isActive}
                          onCheckedChange={v => setEditPermissions(prev => ({ ...prev, [page.key]: v }))}
                        />
                      </div>
                    );
                  })}
                </div>
              </div>
            )}

            <div className="flex justify-end gap-2">
              <Button variant="outline" onClick={() => setEditDialog(null)}>Cancelar</Button>
              <Button onClick={handleSave}>Salvar</Button>
            </div>
          </div>
        </DialogContent>
      </Dialog>

      <AlertDialog open={showCleanupConfirm} onOpenChange={setShowCleanupConfirm}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Limpar solicitações recusadas?</AlertDialogTitle>
            <AlertDialogDescription>
              Esta ação irá excluir permanentemente todas as solicitações com status "Recusada" do sistema. Esta ação não pode ser desfeita.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel disabled={cleaningUp}>Cancelar</AlertDialogCancel>
            <AlertDialogAction onClick={handleCleanupRefused} disabled={cleaningUp} className="bg-destructive text-destructive-foreground hover:bg-destructive/90">
              {cleaningUp ? "Limpando..." : "Confirmar Limpeza"}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
}
