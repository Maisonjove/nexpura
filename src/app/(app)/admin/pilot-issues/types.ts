// Pilot Issues Type Definitions

export const ISSUE_CATEGORIES = [
  "pos",
  "invoices_payments",
  "repairs",
  "bespoke",
  "inventory",
  "customers_crm",
  "tasks_workshop",
  "intake",
  "website_storefront",
  "billing",
  "migration_import",
  "ai_features",
  "settings_printing_docs",
  "reports_eod",
  "performance",
  "security",
  "ux_frontend",
  "other",
] as const;

export const ISSUE_SEVERITIES = ["critical", "high", "medium", "low"] as const;

export const ISSUE_STATUSES = [
  "new",
  "needs_repro",
  "confirmed",
  "in_progress",
  "fixed",
  "retest_needed",
  "closed",
  "not_a_bug",
] as const;

export type IssueCategory = (typeof ISSUE_CATEGORIES)[number];
export type IssueSeverity = (typeof ISSUE_SEVERITIES)[number];
export type IssueStatus = (typeof ISSUE_STATUSES)[number];

export interface PilotIssue {
  id: string;
  title: string;
  description: string | null;
  route_path: string | null;
  category: IssueCategory;
  severity: IssueSeverity;
  status: IssueStatus;
  is_pilot_blocking: boolean;
  reported_by: string | null;
  reported_by_user_id: string | null;
  tenant_id: string | null;
  tenant_name: string | null;
  steps_to_reproduce: string | null;
  expected_result: string | null;
  actual_result: string | null;
  fix_notes: string | null;
  fixed_by: string | null;
  fixed_at: string | null;
  fixed_in_commit: string | null;
  attachments: string[] | null;
  created_at: string;
  updated_at: string;
}
