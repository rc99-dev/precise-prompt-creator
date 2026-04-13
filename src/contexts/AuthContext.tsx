import { createContext, useContext, useEffect, useState, useRef, ReactNode } from "react";
import { Session, User } from "@supabase/supabase-js";
import { supabase } from "@/integrations/supabase/client";
import { getUserRole, AppRole } from "@/lib/helpers";

type ProfileStatus = 'pendente' | 'ativo' | 'inativo' | null;

interface AuthContextType {
  session: Session | null;
  user: User | null;
  role: AppRole | null;
  profileStatus: ProfileStatus;
  loading: boolean;
  signOut: () => Promise<void>;
}

const AuthContext = createContext<AuthContextType>({
  session: null, user: null, role: null, profileStatus: null, loading: true, signOut: async () => {},
});

export function AuthProvider({ children }: { children: ReactNode }) {
  const [session, setSession] = useState<Session | null>(null);
  const [role, setRole] = useState<AppRole | null>(null);
  const [profileStatus, setProfileStatus] = useState<ProfileStatus>(null);
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

    const fetchRoleAndStatus = (userId?: string) => {
      if (!userId) {
        if (isMounted) { setRole(null); setProfileStatus(null); }
        roleFetchedForUser.current = null;
        return;
      }

      if (roleFetchedForUser.current === userId) return;

      roleFetchedForUser.current = userId;
      Promise.all([
        getUserRole(userId),
        supabase.from('profiles').select('status').eq('user_id', userId).single(),
      ]).then(([userRole, { data: profile }]) => {
        if (!isMounted) return;
        setRole(userRole);
        setProfileStatus((profile?.status as ProfileStatus) || 'pendente');
      }).catch((error) => {
        console.error("[auth] falha ao buscar role/status", error);
        if (isMounted) {
          setRole(null);
          setProfileStatus(null);
          roleFetchedForUser.current = null;
        }
      });
    };

    const timeoutId = window.setTimeout(() => {
      if (!isMounted || authResolved) return;
      setSession(null); setRole(null); setProfileStatus(null);
      resolveLoading("timeout-3s");
    }, 3000);

    const { data: { subscription } } = supabase.auth.onAuthStateChange((event, nextSession) => {
      if (!isMounted) return;
      setSession(nextSession);
      if (event === 'TOKEN_REFRESHED' && roleFetchedForUser.current === nextSession?.user?.id) {
        // skip
      } else {
        fetchRoleAndStatus(nextSession?.user?.id);
      }
      resolveLoading(`onAuthStateChange:${event}`);
    });

    supabase.auth.getSession()
      .then(({ data: { session: restoredSession }, error }) => {
        if (!isMounted) return;
        if (error) {
          setSession(null); setRole(null); setProfileStatus(null);
          resolveLoading("getSession-error");
          return;
        }
        setSession(restoredSession);
        fetchRoleAndStatus(restoredSession?.user?.id);
        resolveLoading("getSession-success");
      })
      .catch(() => {
        if (!isMounted) return;
        setSession(null); setRole(null); setProfileStatus(null);
        resolveLoading("getSession-catch");
      });

    return () => {
      isMounted = false;
      window.clearTimeout(timeoutId);
      subscription.unsubscribe();
    };
  }, []);

  const signOut = async () => {
    await supabase.auth.signOut();
  };

  return (
    <AuthContext.Provider value={{ session, user: session?.user ?? null, role, profileStatus, loading, signOut }}>
      {children}
    </AuthContext.Provider>
  );
}

export const useAuth = () => useContext(AuthContext);
