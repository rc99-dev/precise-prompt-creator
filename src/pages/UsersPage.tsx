import { useState, useRef } from "react";
import * as XLSX from "xlsx";
import { supabase } from "@/integrations/supabase/client";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import { Switch } from "@/components/ui/switch";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog";
import { AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent, AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle } from "@/components/ui/alert-dialog";
import { toast } from "sonner";
import { Users, Pencil, Search, Trash2, CheckCircle, XCircle, Clock, KeyRound, Eye, EyeOff, UserPlus, FileDown, FileUp } from "lucide-react";
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

type ImportRow = {
  full_name: string; email: string; unidade: string | null; setor: string | null;
  role: AppRole; status: string;
  action: 'create' | 'update'; existing?: UserProfile;
};

const ROLE_OPTIONS: AppRole[] = ['solicitante', 'comprador', 'aprovador', 'estoquista', 'financeiro', 'master'];

const defaultPassword = (name: string) => {
  const slug = (name || 'user').trim().toLowerCase().replace(/[^a-z]/g, '').slice(0, 3) || 'usu';
  return slug + '@2026';
};

export default function UsersPage() {
  const queryClient = useQueryClient();
  const fileInputRef = useRef<HTMLInputElement>(null);
  const [search, setSearch] = useState("");
  const [editDialog, setEditDialog] = useState<UserProfile | null>(null);
  const [editName, setEditName] = useState("");
  const [editRole, setEditRole] = useState<AppRole>('solicitante');
  const [editSetor, setEditSetor] = useState("");
  const [editUnidade, setEditUnidade] = useState("");
  const [editPermissions, setEditPermissions] = useState<Record<string, boolean>>({});
  const [showCleanupConfirm, setShowCleanupConfirm] = useState(false);
  const [cleaningUp, setCleaningUp] = useState(false);
  const [deleteTarget, setDeleteTarget] = useState<UserProfile | null>(null);
  const [deleting, setDeleting] = useState(false);
  const [approveRole, setApproveRole] = useState<AppRole>('solicitante');

  // Password dialog
  const [passwordTarget, setPasswordTarget] = useState<UserProfile | null>(null);
  const [newPassword, setNewPassword] = useState("");
  const [showPassword, setShowPassword] = useState(false);
  const [savingPassword, setSavingPassword] = useState(false);

  // Create user dialog
  const [newUserOpen, setNewUserOpen] = useState(false);
  const [nu, setNu] = useState({ full_name: '', email: '', password: '', unidade: '', setor: '', role: 'solicitante' as AppRole });
  const [creatingUser, setCreatingUser] = useState(false);
  const [showNewPwd, setShowNewPwd] = useState(false);

  // Import dialog
  const [importRows, setImportRows] = useState<ImportRow[] | null>(null);
  const [importing, setImporting] = useState(false);

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
  const activeUsers = users.filter(u => u.status === 'ativo');
  const filtered = activeUsers.filter(u =>
    u.full_name.toLowerCase().includes(search.toLowerCase()) ||
    (u.email || '').toLowerCase().includes(search.toLowerCase())
  );

  const openEdit = (u: UserProfile) => {
    setEditDialog(u);
    setEditName(u.full_name || '');
    setEditRole(u.role || 'solicitante');
    setEditSetor(u.unidade_setor || '');
    setEditUnidade(u.unidade || '');
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
      full_name: editName.trim() || editDialog.full_name,
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
      user_id: u.user_id, titulo: '✅ Acesso aprovado!',
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
      user_id: u.user_id, titulo: '❌ Acesso negado',
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
    if (error) toast.error(`Erro ao limpar: ${error.message}`);
    else {
      toast.success(`${count || 0} solicitação(ões) recusada(s) removida(s).`);
      queryClient.invalidateQueries({ queryKey: ['requisitions-list'] });
      queryClient.invalidateQueries({ queryKey: ['my-requisitions'] });
    }
    setCleaningUp(false);
    setShowCleanupConfirm(false);
  };

  const handleDeleteUser = async () => {
    if (!deleteTarget) return;
    setDeleting(true);
    try {
      const { error } = await supabase.from('profiles').update({ status: 'inativo' } as any).eq('user_id', deleteTarget.user_id);
      if (error) toast.error(`Erro ao excluir: ${error.message}`);
      else {
        toast.success(`Usuário ${deleteTarget.full_name} desativado.`);
        queryClient.invalidateQueries({ queryKey: ['users-list'] });
        setDeleteTarget(null);
      }
    } finally { setDeleting(false); }
  };

  const handleUpdatePassword = async () => {
    if (!passwordTarget) return;
    if (newPassword.length < 6) { toast.error("Senha deve ter ao menos 6 caracteres"); return; }
    setSavingPassword(true);
    const { error } = await supabase.rpc('admin_update_password' as any, {
      _user_id: passwordTarget.user_id, _new_password: newPassword,
    });
    if (error) toast.error(`Erro: ${error.message}`);
    else {
      toast.success(`Senha de ${passwordTarget.full_name} alterada.`);
      setPasswordTarget(null); setNewPassword(""); setShowPassword(false);
    }
    setSavingPassword(false);
  };

  const handleCreateUser = async () => {
    if (!nu.full_name.trim() || !nu.email.trim() || !nu.password) {
      toast.error("Preencha nome, e-mail e senha"); return;
    }
    if (nu.password.length < 6) { toast.error("Senha deve ter ao menos 6 caracteres"); return; }
    setCreatingUser(true);
    const { error } = await supabase.rpc('admin_create_user' as any, {
      _email: nu.email.trim(), _password: nu.password, _full_name: nu.full_name.trim(),
      _unidade: nu.unidade || null, _setor: nu.setor || null, _role: nu.role,
    });
    if (error) toast.error(`Erro: ${error.message}`);
    else {
      toast.success(`Usuário ${nu.full_name} criado!`);
      setNewUserOpen(false);
      setNu({ full_name: '', email: '', password: '', unidade: '', setor: '', role: 'solicitante' });
      queryClient.invalidateQueries({ queryKey: ['users-list'] });
    }
    setCreatingUser(false);
  };

  const handleExport = () => {
    const rows = users.map(u => ({
      'Nome Completo': u.full_name || '',
      'E-mail': u.email || '',
      'Unidade': u.unidade || '',
      'Setor': u.unidade_setor || '',
      'Perfil': u.role || 'solicitante',
      'Status': u.status,
    }));
    const ws = XLSX.utils.json_to_sheet(rows);
    const wb = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(wb, ws, 'Usuários');
    XLSX.writeFile(wb, `usuarios_${new Date().toISOString().slice(0, 10)}.xlsx`);
    toast.success("Planilha exportada!");
  };

  const handleFilePicked = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0]; if (!file) return;
    try {
      const buf = await file.arrayBuffer();
      const wb = XLSX.read(buf, { type: 'array' });
      const ws = wb.Sheets[wb.SheetNames[0]];
      const json: any[] = XLSX.utils.sheet_to_json(ws, { defval: '' });
      const emailMap: Record<string, UserProfile> = {};
      users.forEach(u => { if (u.email) emailMap[u.email.toLowerCase().trim()] = u; });

      const parsed: ImportRow[] = json.map(r => {
        const email = String(r['E-mail'] || r['Email'] || r['email'] || '').trim();
        const roleRaw = String(r['Perfil'] || r['Role'] || 'solicitante').toLowerCase().trim();
        const role = (ROLE_OPTIONS.includes(roleRaw as AppRole) ? roleRaw : 'solicitante') as AppRole;
        const existing = emailMap[email.toLowerCase()];
        return {
          full_name: String(r['Nome Completo'] || r['Nome'] || '').trim(),
          email,
          unidade: String(r['Unidade'] || '').trim() || null,
          setor: String(r['Setor'] || '').trim() || null,
          role,
          status: String(r['Status'] || 'ativo').trim() || 'ativo',
          action: existing ? 'update' : 'create',
          existing,
        };
      }).filter(r => r.email && r.full_name);

      if (parsed.length === 0) { toast.error("Nenhuma linha válida encontrada"); return; }
      setImportRows(parsed);
    } catch (err: any) {
      toast.error(`Erro ao ler planilha: ${err?.message || err}`);
    } finally {
      if (fileInputRef.current) fileInputRef.current.value = '';
    }
  };

  const confirmImport = async () => {
    if (!importRows) return;
    setImporting(true);
    let created = 0, updated = 0, failed = 0;
    for (const row of importRows) {
      if (row.action === 'update' && row.existing) {
        const { error: pe } = await supabase.from('profiles').update({
          full_name: row.full_name, unidade: row.unidade, unidade_setor: row.setor,
          status: row.status,
        } as any).eq('user_id', row.existing.user_id);
        const { error: re } = await supabase.from('user_roles').update({ role: row.role } as any).eq('user_id', row.existing.user_id);
        if (pe || re) failed++; else updated++;
      } else {
        const { error } = await supabase.rpc('admin_create_user' as any, {
          _email: row.email, _password: defaultPassword(row.full_name),
          _full_name: row.full_name, _unidade: row.unidade, _setor: row.setor, _role: row.role,
        });
        if (error) failed++; else created++;
      }
    }
    setImporting(false);
    setImportRows(null);
    toast.success(`Importação concluída: ${created} criado(s), ${updated} atualizado(s)${failed ? `, ${failed} falha(s)` : ''}.`);
    queryClient.invalidateQueries({ queryKey: ['users-list'] });
  };

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between flex-wrap gap-4">
        <div>
          <h1 className="text-2xl font-bold">Usuários</h1>
          <p className="text-muted-foreground text-sm mt-1">Gerencie os usuários e perfis de acesso</p>
        </div>
        <div className="flex gap-2 flex-wrap">
          <Button size="sm" onClick={() => setNewUserOpen(true)}>
            <UserPlus className="h-4 w-4 mr-2" />Novo Usuário
          </Button>
          <Button variant="outline" size="sm" onClick={handleExport}>
            <FileDown className="h-4 w-4 mr-2" />Exportar Excel
          </Button>
          <Button variant="outline" size="sm" onClick={() => fileInputRef.current?.click()}>
            <FileUp className="h-4 w-4 mr-2" />Importar Excel
          </Button>
          <input ref={fileInputRef} type="file" accept=".xlsx,.xls" className="hidden" onChange={handleFilePicked} />
          <Button variant="outline" size="sm" onClick={() => setShowCleanupConfirm(true)}>
            <Trash2 className="h-4 w-4 mr-2" />Limpar Recusadas
          </Button>
        </div>
      </div>

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
                    <SelectTrigger className="w-[180px] h-8 text-xs"><SelectValue placeholder="Perfil" /></SelectTrigger>
                    <SelectContent>
                      {ROLE_OPTIONS.map(r => <SelectItem key={r} value={r}>{roleLabels[r]}</SelectItem>)}
                    </SelectContent>
                  </Select>
                  <Button size="sm" onClick={() => handleApprove(u)} className="gap-1"><CheckCircle className="h-3 w-3" />Aprovar</Button>
                  <Button size="sm" variant="destructive" onClick={() => handleReject(u)} className="gap-1"><XCircle className="h-3 w-3" />Recusar</Button>
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
                        <div className="flex justify-end gap-1">
                          <Button variant="ghost" size="icon" onClick={() => { setPasswordTarget(u); setNewPassword(""); setShowPassword(false); }} title="Ver/Alterar senha"><KeyRound className="h-4 w-4" /></Button>
                          <Button variant="ghost" size="icon" onClick={() => openEdit(u)} title="Editar"><Pencil className="h-4 w-4" /></Button>
                          <Button variant="ghost" size="icon" onClick={() => setDeleteTarget(u)} title="Excluir usuário" className="text-destructive hover:text-destructive"><Trash2 className="h-4 w-4" /></Button>
                        </div>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </CardContent>
      </Card>

      {/* Edit Dialog */}
      <Dialog open={!!editDialog} onOpenChange={() => setEditDialog(null)}>
        <DialogContent className="max-w-lg max-h-[90vh] overflow-y-auto">
          <DialogHeader><DialogTitle>Editar Usuário</DialogTitle></DialogHeader>
          <div className="space-y-4">
            <div className="space-y-2"><Label>Nome completo</Label><Input value={editName} onChange={e => setEditName(e.target.value)} /></div>
            <div className="space-y-2"><Label>E-mail</Label><Input value={editDialog?.email || ''} disabled /></div>
            <div className="space-y-2">
              <Label>Perfil de Acesso</Label>
              <Select value={editRole} onValueChange={v => handleRoleChangeInEdit(v as AppRole)}>
                <SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent>{ROLE_OPTIONS.map(r => <SelectItem key={r} value={r}>{roleLabels[r]}</SelectItem>)}</SelectContent>
              </Select>
            </div>
            <div className="space-y-2">
              <Label>Unidade</Label>
              <Select value={editUnidade} onValueChange={setEditUnidade}>
                <SelectTrigger><SelectValue placeholder="Selecione a unidade" /></SelectTrigger>
                <SelectContent>{UNIDADES.map(u => <SelectItem key={u} value={u}>{u}</SelectItem>)}</SelectContent>
              </Select>
            </div>
            <div className="space-y-2">
              <Label>Setor</Label>
              <Input value={editSetor} onChange={e => setEditSetor(e.target.value)} placeholder="Ex: Cozinha, Administrativo..." />
            </div>

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
                        <Switch checked={isActive} onCheckedChange={v => setEditPermissions(prev => ({ ...prev, [page.key]: v }))} />
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

      {/* Password Dialog */}
      <Dialog open={!!passwordTarget} onOpenChange={(o) => !o && setPasswordTarget(null)}>
        <DialogContent>
          <DialogHeader><DialogTitle>Alterar senha — {passwordTarget?.full_name}</DialogTitle></DialogHeader>
          <div className="space-y-4">
            <p className="text-sm text-muted-foreground">
              Por segurança, senhas armazenadas não podem ser lidas em texto puro. Defina uma nova senha abaixo.
            </p>
            <div className="space-y-2">
              <Label>Nova senha</Label>
              <div className="relative">
                <Input type={showPassword ? 'text' : 'password'} value={newPassword} onChange={e => setNewPassword(e.target.value)} placeholder="Mínimo 6 caracteres" className="pr-10" />
                <Button type="button" variant="ghost" size="icon" className="absolute right-1 top-1/2 -translate-y-1/2 h-7 w-7" onClick={() => setShowPassword(s => !s)}>
                  {showPassword ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
                </Button>
              </div>
            </div>
            <DialogFooter>
              <Button variant="outline" onClick={() => setPasswordTarget(null)}>Cancelar</Button>
              <Button onClick={handleUpdatePassword} disabled={savingPassword}>{savingPassword ? 'Salvando...' : 'Salvar nova senha'}</Button>
            </DialogFooter>
          </div>
        </DialogContent>
      </Dialog>

      {/* New User Dialog */}
      <Dialog open={newUserOpen} onOpenChange={setNewUserOpen}>
        <DialogContent className="max-w-lg max-h-[90vh] overflow-y-auto">
          <DialogHeader><DialogTitle>Novo Usuário</DialogTitle></DialogHeader>
          <div className="space-y-4">
            <div className="space-y-2"><Label>Nome completo *</Label><Input value={nu.full_name} onChange={e => setNu({ ...nu, full_name: e.target.value })} /></div>
            <div className="space-y-2"><Label>E-mail *</Label><Input type="email" value={nu.email} onChange={e => setNu({ ...nu, email: e.target.value })} /></div>
            <div className="space-y-2">
              <Label>Senha inicial *</Label>
              <div className="relative">
                <Input type={showNewPwd ? 'text' : 'password'} value={nu.password} onChange={e => setNu({ ...nu, password: e.target.value })} placeholder="Mínimo 6 caracteres" className="pr-10" />
                <Button type="button" variant="ghost" size="icon" className="absolute right-1 top-1/2 -translate-y-1/2 h-7 w-7" onClick={() => setShowNewPwd(s => !s)}>
                  {showNewPwd ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
                </Button>
              </div>
            </div>
            <div className="space-y-2">
              <Label>Unidade</Label>
              <Select value={nu.unidade} onValueChange={v => setNu({ ...nu, unidade: v })}>
                <SelectTrigger><SelectValue placeholder="Selecione" /></SelectTrigger>
                <SelectContent>{UNIDADES.map(u => <SelectItem key={u} value={u}>{u}</SelectItem>)}</SelectContent>
              </Select>
            </div>
            <div className="space-y-2"><Label>Setor</Label><Input value={nu.setor} onChange={e => setNu({ ...nu, setor: e.target.value })} /></div>
            <div className="space-y-2">
              <Label>Perfil *</Label>
              <Select value={nu.role} onValueChange={v => setNu({ ...nu, role: v as AppRole })}>
                <SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent>{ROLE_OPTIONS.map(r => <SelectItem key={r} value={r}>{roleLabels[r]}</SelectItem>)}</SelectContent>
              </Select>
            </div>
            <DialogFooter>
              <Button variant="outline" onClick={() => setNewUserOpen(false)}>Cancelar</Button>
              <Button onClick={handleCreateUser} disabled={creatingUser}>{creatingUser ? 'Criando...' : 'Criar usuário'}</Button>
            </DialogFooter>
          </div>
        </DialogContent>
      </Dialog>

      {/* Import preview Dialog */}
      <Dialog open={!!importRows} onOpenChange={(o) => !o && setImportRows(null)}>
        <DialogContent className="max-w-3xl max-h-[90vh] overflow-y-auto">
          <DialogHeader><DialogTitle>Prévia da Importação</DialogTitle></DialogHeader>
          {importRows && (
            <div className="space-y-3">
              <div className="flex gap-4 text-sm">
                <Badge className="bg-success/20 text-success">Criar: {importRows.filter(r => r.action === 'create').length}</Badge>
                <Badge className="bg-info/20 text-info">Atualizar: {importRows.filter(r => r.action === 'update').length}</Badge>
                <span className="text-muted-foreground">Total: {importRows.length}</span>
              </div>
              <p className="text-xs text-muted-foreground">
                Usuários novos receberão senha padrão (3 primeiras letras do nome + "@2026").
              </p>
              <div className="border rounded-md max-h-[50vh] overflow-y-auto">
                <table className="w-full text-xs">
                  <thead className="bg-muted/30 sticky top-0">
                    <tr className="border-b">
                      <th className="text-left py-2 px-3">Ação</th>
                      <th className="text-left py-2 px-3">Nome</th>
                      <th className="text-left py-2 px-3">E-mail</th>
                      <th className="text-left py-2 px-3">Unidade</th>
                      <th className="text-left py-2 px-3">Setor</th>
                      <th className="text-left py-2 px-3">Perfil</th>
                    </tr>
                  </thead>
                  <tbody>
                    {importRows.map((r, i) => (
                      <tr key={i} className="border-b last:border-0">
                        <td className="py-1.5 px-3">
                          <Badge variant="outline" className={r.action === 'create' ? 'text-success' : 'text-info'}>
                            {r.action === 'create' ? 'Criar' : 'Atualizar'}
                          </Badge>
                        </td>
                        <td className="py-1.5 px-3">{r.full_name}</td>
                        <td className="py-1.5 px-3 text-muted-foreground">{r.email}</td>
                        <td className="py-1.5 px-3 text-muted-foreground">{r.unidade || '—'}</td>
                        <td className="py-1.5 px-3 text-muted-foreground">{r.setor || '—'}</td>
                        <td className="py-1.5 px-3">{roleLabels[r.role]}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
              <DialogFooter>
                <Button variant="outline" onClick={() => setImportRows(null)} disabled={importing}>Cancelar</Button>
                <Button onClick={confirmImport} disabled={importing}>{importing ? 'Importando...' : 'Confirmar Importação'}</Button>
              </DialogFooter>
            </div>
          )}
        </DialogContent>
      </Dialog>

      <AlertDialog open={!!deleteTarget} onOpenChange={(o) => !o && setDeleteTarget(null)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Excluir usuário?</AlertDialogTitle>
            <AlertDialogDescription>
              Esta ação irá desativar <strong>{deleteTarget?.full_name}</strong> ({deleteTarget?.email}). Os registros históricos são preservados.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel disabled={deleting}>Cancelar</AlertDialogCancel>
            <AlertDialogAction onClick={handleDeleteUser} disabled={deleting} className="bg-destructive text-destructive-foreground hover:bg-destructive/90">
              {deleting ? "Excluindo..." : "Excluir"}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>

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
