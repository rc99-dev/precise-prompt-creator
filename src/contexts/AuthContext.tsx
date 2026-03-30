import { createContext, useContext, useEffect, useState, ReactNode } from "react";
import { Session, User } from "@supabase/supabase-js";
import { supabase } from "@/integrations/supabase/client";
import { getUserRole, AppRole } from "@/lib/helpers";

interface AuthContextType {
  session: Session | null;
  user: User | null;
  role: AppRole | null;
  loading: boolean;
  signOut: () => Promise<void>;
}

const AuthContext = createContext<AuthContextType>({
  session: null, user: null, role: null, loading: true, signOut: async () => {},
});

export function AuthProvider({ children }: { children: ReactNode }) {
  const [session, setSession] = useState<Session | null>(null);
  const [role, setRole] = useState<AppRole | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    let isMounted = true;
    let authResolved = false;

    const resolveLoading = (source: string) => {
      if (!isMounted) return;
      if (!authResolved) {
        console.info(`[auth] loading resolvido por: ${source}`);
      }
      authResolved = true;
      setLoading(false);
    };

    const fetchRole = (userId?: string) => {
      if (!userId) {
        if (isMounted) setRole(null);
        return;
      }

      console.info("[auth] buscando role do usuário", { userId });
      void getUserRole(userId)
        .then((userRole) => {
          if (!isMounted) return;
          console.info("[auth] role carregada", { userId, role: userRole });
          setRole(userRole);
        })
        .catch((error) => {
          console.error("[auth] falha ao buscar role", error);
          if (isMounted) setRole(null);
        });
    };

    const timeoutId = window.setTimeout(() => {
      if (!isMounted || authResolved) return;
      console.warn("[auth] timeout de 3s ao restaurar sessão; redirecionando para login");
      setSession(null);
      setRole(null);
      resolveLoading("timeout-3s");
    }, 3000);

    console.info("[auth] iniciando escuta de autenticação");
    const { data: { subscription } } = supabase.auth.onAuthStateChange((event, nextSession) => {
      if (!isMounted) return;
      console.info("[auth] onAuthStateChange", { event, userId: nextSession?.user?.id ?? null });
      setSession(nextSession);
      fetchRole(nextSession?.user?.id);
      resolveLoading(`onAuthStateChange:${event}`);
    });

    console.info("[auth] restaurando sessão via getSession");
    supabase.auth.getSession()
      .then(({ data: { session: restoredSession }, error }) => {
        if (!isMounted) return;

        if (error) {
          console.error("[auth] erro em getSession", error);
          setSession(null);
          setRole(null);
          resolveLoading("getSession-error");
          return;
        }

        console.info("[auth] sessão restaurada", { userId: restoredSession?.user?.id ?? null });
        setSession(restoredSession);
        fetchRole(restoredSession?.user?.id);
        resolveLoading("getSession-success");
      })
      .catch((error) => {
        if (!isMounted) return;
        console.error("[auth] exceção inesperada em getSession", error);
        setSession(null);
        setRole(null);
        resolveLoading("getSession-catch");
      });

    return () => {
      isMounted = false;
      window.clearTimeout(timeoutId);
      subscription.unsubscribe();
    };
  }, []);

  const signOut = async () => {
    console.info("[auth] iniciando signOut");
    await supabase.auth.signOut();
  };

  return (
    <AuthContext.Provider value={{ session, user: session?.user ?? null, role, loading, signOut }}>
      {children}
    </AuthContext.Provider>
  );
}

export const useAuth = () => useContext(AuthContext);
