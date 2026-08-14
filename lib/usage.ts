import type { SupabaseClient } from "@supabase/supabase-js";
import type { Database } from "@/lib/supabase/database.types";

/** Ratio at which the UI switches to the "running out of quota" styling. */
export const USAGE_WARNING_RATIO = 0.8;

/**
 * The bucket key used by the `usage` table. Must stay in sync with
 * `to_char(now(), 'YYYY-MM')` in `try_increment_usage` / `release_usage`,
 * which both run in the database's UTC clock.
 */
export function currentUsageMonth(): string {
  return new Date().toISOString().slice(0, 7);
}

/** Calls made by `userId` in the current month (0 when no row exists yet). */
export async function getUsedCount(
  supabase: SupabaseClient<Database>,
  userId: string
): Promise<number> {
  const { data, error } = await supabase
    .from("usage")
    .select("count")
    .eq("user_id", userId)
    .eq("month", currentUsageMonth())
    .maybeSingle();

  if (error) throw error;
  return data?.count ?? 0;
}

/** Filled fraction of the quota meter, clamped to 0..1. Callers handle the unlimited plan. */
export function usageRatio(used: number, limit: number): number {
  if (limit <= 0) return 1;
  return Math.min(used / limit, 1);
}
