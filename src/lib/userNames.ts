import { supabase } from "@/integrations/supabase/client";

const cache = new Map<string, string>();

/**
 * Resolves user display names for a list of user IDs.
 * Tries get_profile_names RPC first, then falls back to direct profiles query (full_name → email → "Usuário").
 * Caches results in-memory per session.
 */
export async function resolveUserNames(userIds: string[]): Promise<Record<string, string>> {
  const ids = Array.from(new Set(userIds.filter(Boolean)));
  const result: Record<string, string> = {};
  const missing: string[] = [];

  for (const id of ids) {
    if (cache.has(id)) {
      result[id] = cache.get(id)!;
    } else {
      missing.push(id);
    }
  }

  if (missing.length === 0) return result;

  // Try RPC first
  try {
    const { data, error } = await supabase.rpc("get_profile_names", { _user_ids: missing });
    if (!error && Array.isArray(data)) {
      for (const row of data as Array<{ user_id: string; full_name: string | null }>) {
        const name = (row.full_name || "").trim();
        if (name) {
          cache.set(row.user_id, name);
          result[row.user_id] = name;
        }
      }
    }
  } catch {
    // ignore — fall through to direct query
  }

  // Fallback: direct query for any still missing
  const stillMissing = missing.filter((id) => !result[id]);
  if (stillMissing.length > 0) {
    try {
      const { data } = await supabase
        .from("profiles")
        .select("user_id, full_name, email")
        .in("user_id", stillMissing);
      if (Array.isArray(data)) {
        for (const row of data as Array<{ user_id: string; full_name: string | null; email: string | null }>) {
          const name = (row.full_name || "").trim() || (row.email || "").trim() || "Usuário";
          cache.set(row.user_id, name);
          result[row.user_id] = name;
        }
      }
    } catch {
      // ignore
    }
  }

  // Final fallback for unresolved
  for (const id of missing) {
    if (!result[id]) {
      result[id] = "Usuário";
      cache.set(id, "Usuário");
    }
  }

  return result;
}

export async function resolveUserName(userId: string | null | undefined): Promise<string> {
  if (!userId) return "Usuário";
  const map = await resolveUserNames([userId]);
  return map[userId] || "Usuário";
}
