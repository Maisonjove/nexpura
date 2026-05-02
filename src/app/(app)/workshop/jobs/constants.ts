// Shared between the server page and the client component. Kept in a
// non-client module so Turbopack doesn't strip the array values when
// the parent module is "use client" — that bug surfaced as
// `STATUS_FILTERS.includes is not a function` on the deployed server
// page (Brief 2 round 2).

export const STATUS_FILTERS = [
  "active",
  "overdue",
  "ready-for-pickup",
  "completed",
] as const;
export type StatusFilter = (typeof STATUS_FILTERS)[number];

export const TYPE_FILTERS = ["all", "repair", "bespoke", "appraisal"] as const;
export type TypeFilter = (typeof TYPE_FILTERS)[number];
