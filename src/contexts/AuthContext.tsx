import { createContext, useContext, useEffect, useState, useRef, ReactNode } from "react";
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
  const roleFetchedForUser = useRef<string | null>(null);

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
        roleFetchedForUser.current = null;
        return;
      }

      // Skip if already fetched for this user
      if (roleFetchedForUser.current === userId) {
        console.info("[auth] role já carregada, ignorando chamada duplicada", { userId });
        return;
      }

      roleFetchedForUser.current = userId;
      console.info("[auth] buscando role do usuário", { userId });
      void getUserRole(userId)
        .then((userRole) => {
          if (!isMounted) return;
          console.info("[auth] role carregada", { userId, role: userRole });
          setRole(userRole);
        })
        .catch((error) => {
          console.error("[auth] falha ao buscar role", error);
          if (isMounted) {
            setRole(null);
            roleFetchedForUser.current = null;
          }
        });
    };

    const timeoutId = window.setTimeout(() => {
      if (!isMounted || authResolved) return;
      console.warn("[auth] timeout de 3s ao restaurar sessão; redirecionando para login");
      setSession(null);
      setRole(null);
      resolveLoading("timeout-3s");
    }, 3000);

    const { data: { subscription } } = supabase.auth.onAuthStateChange((event, nextSession) => {
      if (!isMounted) return;
      console.info("[auth] onAuthStateChange", { event, userId: nextSession?.user?.id ?? null });
      setSession(nextSession);

      if (event === 'TOKEN_REFRESHED' && roleFetchedForUser.current === nextSession?.user?.id) {
        console.info("[auth] TOKEN_REFRESHED ignorado — role já carregada");
      } else {
        fetchRole(nextSession?.user?.id);
      }

      resolveLoading(`onAuthStateChange:${event}`);
    });

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
