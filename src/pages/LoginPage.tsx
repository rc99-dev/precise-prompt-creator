import { useState, useEffect } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { toast } from "sonner";

const SIGNUP_UNIDADES = ['CASARÃO', 'VEIGA CABRAL', 'PORTO FUTURO', 'ÓBIDOS', 'ANGUSTURA', 'AQUÁRIOS'] as const;
const SIGNUP_SETORES = [
  'LOJA', 'BAR', 'SALÃO', 'COZINHA', 'SUPRIMENTOS', 'PRODUÇÃO',
  'DIRETORIA', 'GENTE & GESTÃO', 'FINANCEIRO', 'MARKETING', 'PROCESSOS & CONTROLADORIA',
] as const;

export default function LoginPage() {
  const [loading, setLoading] = useState(false);
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [fullName, setFullName] = useState("");
  const [unidade, setUnidade] = useState("");
  const [setor, setSetor] = useState("");
  const [setorOptions, setSetorOptions] = useState<string[]>([]);

  // Fetch distinct setores from existing profiles to populate the dropdown
  useEffect(() => {
    (async () => {
      const { data } = await supabase
        .from('profiles')
        .select('unidade_setor')
        .not('unidade_setor', 'is', null);
      const distinct = Array.from(
        new Set((data || []).map((p: any) => (p.unidade_setor || '').trim()).filter(Boolean))
      );
      // Merge DB values with the canonical fallback list and dedupe (case-insensitive)
      const merged = [...SIGNUP_SETORES, ...distinct];
      const seen = new Set<string>();
      const unique: string[] = [];
      for (const s of merged) {
        const key = s.toLowerCase();
        if (!seen.has(key)) { seen.add(key); unique.push(s); }
      }
      unique.sort((a, b) => a.localeCompare(b, 'pt-BR'));
      setSetorOptions(unique);
    })();
  }, []);

  const handleLogin = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    const { error } = await supabase.auth.signInWithPassword({ email, password });
    if (error) toast.error(error.message);
    setLoading(false);
  };

  const handleSignUp = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    const { data: signUpData, error } = await supabase.auth.signUp({
      email, password,
      options: { data: { full_name: fullName }, emailRedirectTo: window.location.origin },
    });
    if (error) { toast.error(error.message); setLoading(false); return; }

    // Update profile with unidade and setor after signup + notify masters
    if (signUpData?.user) {
      setTimeout(async () => {
        await supabase.from('profiles').update({
          unidade: unidade || null,
          unidade_setor: setor || null,
        } as any).eq('user_id', signUpData.user!.id);

        // Notify all masters via signup-specific RPC (only callable by pending users)
        await supabase.rpc('notify_masters_new_signup' as any, {
          _titulo: '👤 Novo usuário aguarda aprovação',
          _mensagem: `Novo usuário aguarda aprovação: ${fullName} — ${unidade || 'Sem unidade'} — ${setor || 'Sem setor'}`,
        });
      }, 1500);
    }

    toast.success("Conta criada! Aguarde a aprovação do administrador.");
    setLoading(false);
  };

  return (
    <div className="min-h-screen flex items-center justify-center bg-background p-4">
      <Card className="w-full max-w-md border-border">
        <CardHeader className="text-center space-y-3">
          <div className="flex justify-center">
            <img
              src="/logo.png"
              alt="Logo Point do Açaí"
              className="h-16 w-16 rounded-xl object-contain"
              onError={(e) => { (e.target as HTMLImageElement).style.display = 'none'; }}
            />
          </div>
          <CardTitle className="text-2xl font-bold">Point do Açaí D'Amazônia</CardTitle>
          <CardDescription>Sistema de Gestão de Suprimentos</CardDescription>
        </CardHeader>
        <CardContent>
          <Tabs defaultValue="login">
            <TabsList className="grid w-full grid-cols-2">
              <TabsTrigger value="login">Entrar</TabsTrigger>
              <TabsTrigger value="register">Criar conta</TabsTrigger>
            </TabsList>
            <TabsContent value="login">
              <form onSubmit={handleLogin} className="space-y-4 mt-4">
                <div className="space-y-2">
                  <Label htmlFor="login-email">E-mail</Label>
                  <Input id="login-email" type="email" value={email} onChange={e => setEmail(e.target.value)} required placeholder="seu@email.com" />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="login-password">Senha</Label>
                  <Input id="login-password" type="password" value={password} onChange={e => setPassword(e.target.value)} required />
                </div>
                <Button type="submit" className="w-full" disabled={loading}>
                  {loading ? "Entrando..." : "Entrar"}
                </Button>
              </form>
            </TabsContent>
            <TabsContent value="register">
              <form onSubmit={handleSignUp} className="space-y-4 mt-4">
                <div className="space-y-2">
                  <Label htmlFor="reg-name">Nome completo</Label>
                  <Input id="reg-name" value={fullName} onChange={e => setFullName(e.target.value)} required />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="reg-email">E-mail</Label>
                  <Input id="reg-email" type="email" value={email} onChange={e => setEmail(e.target.value)} required />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="reg-password">Senha</Label>
                  <Input id="reg-password" type="password" value={password} onChange={e => setPassword(e.target.value)} required minLength={6} />
                </div>
                <div className="space-y-2">
                  <Label>Unidade</Label>
                  <Select value={unidade} onValueChange={setUnidade}>
                    <SelectTrigger><SelectValue placeholder="Selecione a unidade" /></SelectTrigger>
                    <SelectContent>
                      {SIGNUP_UNIDADES.map(u => <SelectItem key={u} value={u}>{u}</SelectItem>)}
                    </SelectContent>
                  </Select>
                </div>
                <div className="space-y-2">
                  <Label>Setor</Label>
                  <Select value={setor} onValueChange={setSetor}>
                    <SelectTrigger><SelectValue placeholder="Selecione o setor" /></SelectTrigger>
                    <SelectContent>
                      {SIGNUP_SETORES.map(s => <SelectItem key={s} value={s}>{s}</SelectItem>)}
                    </SelectContent>
                  </Select>
                </div>
                <Button type="submit" className="w-full" disabled={loading}>
                  {loading ? "Criando..." : "Criar conta"}
                </Button>
              </form>
            </TabsContent>
          </Tabs>
        </CardContent>
      </Card>
    </div>
  );
}
