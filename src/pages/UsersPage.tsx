import { useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/contexts/AuthContext";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { toast } from "sonner";
import { Users, Pencil, Search } from "lucide-react";
import { roleLabels, AppRole } from "@/lib/helpers";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import TableSkeleton from "@/components/TableSkeleton";
import QueryError from "@/components/QueryError";

type UserProfile = {
  id: string; user_id: string; full_name: string; email: string | null;
  unidade_setor: string | null; created_at: string;
  role?: AppRole;
};

export default function UsersPage() {
  const queryClient = useQueryClient();
  const [search, setSearch] = useState("");
  const [editDialog, setEditDialog] = useState<UserProfile | null>(null);
  const [editRole, setEditRole] = useState<AppRole>('solicitante');
  const [editSetor, setEditSetor] = useState("");

  const { data: users = [], isLoading, isError, refetch } = useQuery({
    queryKey: ['users-list'],
    queryFn: async () => {
      const [{ data: profiles, error: e1 }, { data: roles, error: e2 }] = await Promise.all([
        supabase.from('profiles').select('*').order('full_name'),
        supabase.from('user_roles').select('user_id, role'),
      ]);
      if (e1 || e2) throw new Error("Erro ao carregar usuários");
      const roleMap: Record<string, AppRole> = {};
      (roles || []).forEach((r: any) => { roleMap[r.user_id] = r.role; });
      return (profiles || []).map((p: any) => ({ ...p, role: roleMap[p.user_id] || 'solicitante' })) as UserProfile[];
    },
    staleTime: 5 * 60 * 1000,
  });

  const filtered = users.filter(u =>
    u.full_name.toLowerCase().includes(search.toLowerCase()) ||
    (u.email || '').toLowerCase().includes(search.toLowerCase())
  );

  const openEdit = (u: UserProfile) => {
    setEditDialog(u);
    setEditRole(u.role || 'solicitante');
    setEditSetor(u.unidade_setor || '');
  };

  const handleSave = async () => {
    if (!editDialog) return;
    await supabase.from('user_roles').update({ role: editRole } as any).eq('user_id', editDialog.user_id);
    await supabase.from('profiles').update({ unidade_setor: editSetor || null } as any).eq('user_id', editDialog.user_id);
    toast.success("Usuário atualizado!");
    setEditDialog(null);
    queryClient.invalidateQueries({ queryKey: ['users-list'] });
  };

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold">Usuários</h1>
        <p className="text-muted-foreground text-sm mt-1">Gerencie os usuários e perfis de acesso</p>
      </div>

      <div className="relative max-w-md">
        <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
        <Input placeholder="Buscar por nome ou e-mail..." className="pl-9" value={search} onChange={e => setSearch(e.target.value)} />
      </div>

      <Card>
        <CardContent className="p-0">
          {isLoading ? <TableSkeleton columns={5} rows={6} /> : isError ? (
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

      <Dialog open={!!editDialog} onOpenChange={() => setEditDialog(null)}>
        <DialogContent>
          <DialogHeader><DialogTitle>Editar Usuário</DialogTitle></DialogHeader>
          <div className="space-y-4">
            <div className="space-y-2"><Label>Nome</Label><Input value={editDialog?.full_name || ''} disabled /></div>
            <div className="space-y-2">
              <Label>Perfil de Acesso</Label>
              <Select value={editRole} onValueChange={v => setEditRole(v as AppRole)}>
                <SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="solicitante">Solicitante</SelectItem>
                  <SelectItem value="comprador">Comprador</SelectItem>
                  <SelectItem value="aprovador">Aprovador</SelectItem>
                  <SelectItem value="estoquista">Estoquista</SelectItem>
                  <SelectItem value="master">Master</SelectItem>
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-2">
              <Label>Unidade/Setor</Label>
              <Input value={editSetor} onChange={e => setEditSetor(e.target.value)} placeholder="Ex: Loja Centro" />
            </div>
            <div className="flex justify-end gap-2">
              <Button variant="outline" onClick={() => setEditDialog(null)}>Cancelar</Button>
              <Button onClick={handleSave}>Salvar</Button>
            </div>
          </div>
        </DialogContent>
      </Dialog>
    </div>
  );
}
