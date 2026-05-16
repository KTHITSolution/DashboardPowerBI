import { supabase } from "../../lib/supabase";

export const VIEW_MODES = ["default", "fit-width", "fit-page", "fullscreen"] as const;

export type ViewMode = (typeof VIEW_MODES)[number];

function isValidViewMode(value: string): value is ViewMode {
  return VIEW_MODES.includes(value as ViewMode);
}

async function getCurrentUserId(): Promise<string> {
  const {
    data: { user },
    error,
  } = await supabase.auth.getUser();

  if (error || !user) {
    throw new Error(error?.message ?? "No authenticated user");
  }

  return user.id;
}

export async function listViewPreferences(
  dashboardIds: string[],
): Promise<Record<string, ViewMode>> {
  if (dashboardIds.length === 0) {
    return {};
  }

  const userId = await getCurrentUserId();

  const { data, error } = await supabase
    .from("dashboard_view_preferences")
    .select("dashboard_id, view_mode")
    .eq("user_id", userId)
    .in("dashboard_id", dashboardIds);

  if (error) {
    throw new Error(error.message);
  }

  const result: Record<string, ViewMode> = {};
  for (const row of data ?? []) {
    if (typeof row.dashboard_id === "string" && isValidViewMode(row.view_mode)) {
      result[row.dashboard_id] = row.view_mode;
    }
  }

  return result;
}

export async function upsertViewPreference(
  dashboardId: string,
  mode: ViewMode,
): Promise<void> {
  if (!isValidViewMode(mode)) {
    throw new Error("Invalid view mode");
  }

  const userId = await getCurrentUserId();

  const { error } = await supabase.from("dashboard_view_preferences").upsert(
    {
      user_id: userId,
      dashboard_id: dashboardId,
      view_mode: mode,
    },
    {
      onConflict: "user_id,dashboard_id",
    },
  );

  if (error) {
    throw new Error(error.message);
  }
}
