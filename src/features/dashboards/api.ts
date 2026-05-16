import { supabase } from "../../lib/supabase";
import type { Dashboard, InChargeOption, Profile } from "./types";

async function getCurrentUserId(): Promise<string> {
  const {
    data: { user },
    error: userError,
  } = await supabase.auth.getUser();

  if (userError || !user) {
    throw new Error(userError?.message ?? "No authenticated user");
  }

  return user.id;
}

export async function getCurrentProfile(): Promise<Profile> {
  const userId = await getCurrentUserId();

  const { data: profileData, error: profileError } = await supabase
    .from("profiles")
    .select("id, full_name, role_id, department_id")
    .eq("id", userId)
    .maybeSingle();

  if (profileError) {
    throw new Error(profileError.message);
  }

  if (!profileData) {
    throw new Error("Profile not found for this account");
  }

  const { data: roleData, error: roleError } = await supabase
    .from("roles")
    .select("id, role_name")
    .eq("id", profileData.role_id)
    .maybeSingle();

  if (roleError) {
    throw new Error(roleError.message);
  }

  if (!roleData) {
    throw new Error("Role not found for this profile");
  }

  return {
    ...profileData,
    role: roleData,
  } as Profile;
}

export async function listAllowedDashboards(): Promise<Dashboard[]> {
  const { data, error } = await supabase
    .from("dashboards")
    .select(
      "id, title, description, power_bi_embed_url, target_role_id, status, in_charge_id, rejection_reason",
    )
    .order("updated_at", { ascending: false });

  if (error) {
    throw new Error(error.message);
  }

  return (data ?? []) as Dashboard[];
}

export async function listPendingReviewForInCharge(): Promise<Dashboard[]> {
  const { data, error } = await supabase
    .from("dashboards")
    .select(
      "id, title, description, power_bi_embed_url, target_role_id, status, in_charge_id, rejection_reason",
    )
    .eq("status", "Pending_Review")
    .order("updated_at", { ascending: false });

  if (error) {
    throw new Error(error.message);
  }

  return (data ?? []) as Dashboard[];
}

export async function listPublisherDashboards(): Promise<Dashboard[]> {
  const { data, error } = await supabase
    .from("dashboards")
    .select(
      "id, title, description, power_bi_embed_url, target_role_id, status, in_charge_id, publisher_id, department_id, rejection_reason, created_at, updated_at",
    )
    .order("updated_at", { ascending: false });

  if (error) {
    throw new Error(error.message);
  }

  return (data ?? []) as Dashboard[];
}

export async function updatePublisherDashboard(
  id: string,
  payload: {
    title: string;
    description: string;
    power_bi_embed_url: string;
    status: "Draft" | "Pending_Review";
  },
): Promise<void> {
  const cleanTitle = payload.title.trim();
  const cleanDescription = payload.description.trim();
  const cleanUrl = payload.power_bi_embed_url.trim();

  if (!cleanTitle) {
    throw new Error("Title is required");
  }
  if (!cleanUrl) {
    throw new Error("Power BI embed URL is required");
  }

  const { error } = await supabase
    .from("dashboards")
    .update({
      title: cleanTitle,
      description: cleanDescription,
      power_bi_embed_url: cleanUrl,
      status: payload.status,
      rejection_reason: null,
    })
    .eq("id", id);

  if (error) {
    throw new Error(error.message);
  }
}

export async function withdrawPendingDashboard(id: string): Promise<void> {
  const { error } = await supabase
    .from("dashboards")
    .update({
      status: "Draft",
      rejection_reason: null,
    })
    .eq("id", id);

  if (error) {
    throw new Error(error.message);
  }
}

export async function listInChargeOptionsForPublisher(): Promise<InChargeOption[]> {
  const profile = await getCurrentProfile();
  const isGlobalPublisher = profile.role?.role_name === "Publisher_Global";

  let query = supabase
    .from("profiles")
    .select("id, full_name, roles!inner(role_name), department_id")
    .eq("roles.role_name", "InCharge")
    .order("full_name", { ascending: true });

  if (!isGlobalPublisher && profile.department_id) {
    query = query.eq("department_id", profile.department_id);
  }

  const { data, error } = await query;
  if (error) {
    throw new Error(error.message);
  }

  return (data ?? []).map((row) => ({
    id: row.id as string,
    full_name: row.full_name as string,
  }));
}

export async function createPublisherDashboard(payload: {
  title: string;
  description: string;
  power_bi_embed_url: string;
  target_role_id: string;
  in_charge_id: string;
}): Promise<void> {
  const profile = await getCurrentProfile();
  const cleanTitle = payload.title.trim();
  const cleanDescription = payload.description.trim();
  const cleanUrl = payload.power_bi_embed_url.trim();

  if (!cleanTitle) {
    throw new Error("Title is required");
  }
  if (!cleanUrl) {
    throw new Error("Power BI embed URL is required");
  }
  if (!payload.in_charge_id) {
    throw new Error("In-Charge selection is required");
  }

  const { error } = await supabase.from("dashboards").insert({
    title: cleanTitle,
    description: cleanDescription,
    power_bi_embed_url: cleanUrl,
    target_role_id: payload.target_role_id,
    status: "Draft",
    in_charge_id: payload.in_charge_id,
    publisher_id: profile.id,
    department_id: profile.department_id,
    rejection_reason: null,
  });

  if (error) {
    throw new Error(error.message);
  }
}

export async function listTargetRoles(): Promise<Array<{ id: string; role_name: string }>> {
  const { data, error } = await supabase
    .from("roles")
    .select("id, role_name")
    .in("role_name", ["Viewer_Marketing"])
    .order("role_name", { ascending: true });

  if (error) {
    throw new Error(error.message);
  }

  return (data ?? []) as Array<{ id: string; role_name: string }>;
}

export async function approveDashboard(id: string): Promise<void> {
  const { error } = await supabase.rpc("review_dashboard", {
    p_dashboard_id: id,
    p_action: "approve",
    p_reason: null,
  });

  if (error) {
    throw new Error(error.message);
  }
}

export async function rejectDashboard(id: string, reason: string): Promise<void> {
  const cleanReason = reason.trim();
  if (!cleanReason) {
    throw new Error("Rejection reason is required");
  }
  if (cleanReason.length > 500) {
    throw new Error("Rejection reason must be 500 characters or fewer");
  }

  const { error } = await supabase.rpc("review_dashboard", {
    p_dashboard_id: id,
    p_action: "reject",
    p_reason: cleanReason,
  });

  if (error) {
    throw new Error(error.message);
  }
}
