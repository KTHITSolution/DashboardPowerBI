export type DashboardStatus =
  | "Draft"
  | "Pending_Review"
  | "Published"
  | "Rejected";

export interface Role {
  id: string;
  role_name: string;
}

export interface Profile {
  id: string;
  full_name: string;
  role_id: string;
  department_id?: string;
  role?: Role;
}

export interface Dashboard {
  id: string;
  title: string;
  description: string;
  power_bi_embed_url: string;
  target_role_id: string;
  status: DashboardStatus;
  in_charge_id: string;
  publisher_id?: string;
  department_id?: string;
  rejection_reason: string | null;
  created_at?: string;
  updated_at?: string;
}

export interface InChargeOption {
  id: string;
  full_name: string;
}
