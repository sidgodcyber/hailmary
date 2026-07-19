/**
 * App-wide configuration and domain vocabulary.
 * Change the display name in ONE place via NEXT_PUBLIC_APP_NAME.
 */

export const APP_NAME = process.env.NEXT_PUBLIC_APP_NAME?.trim() || "Hailmary";

export const SITE_URL =
  process.env.NEXT_PUBLIC_SITE_URL?.replace(/\/$/, "") || "http://localhost:3000";

// ---------------------------------------------------------------------------
// Domain vocabulary (kept in sync with the DB CHECK constraints in migrations).
// ---------------------------------------------------------------------------

export const IDEA_TYPES = ["idea", "reference"] as const;
export type IdeaType = (typeof IDEA_TYPES)[number];

export const IDEA_STATUSES = ["new", "discussing", "planned", "done", "parked"] as const;
export type IdeaStatus = (typeof IDEA_STATUSES)[number];

export const IDEA_STATUS_LABELS: Record<IdeaStatus, string> = {
  new: "New",
  discussing: "Discussing",
  planned: "Planned",
  done: "Done",
  parked: "Parked",
};

export const REF_LIKE_TAGS = ["hook", "format", "audio", "visual"] as const;
export type RefLikeTag = (typeof REF_LIKE_TAGS)[number];

export const TASK_STATUSES = ["open", "in_progress", "done"] as const;
export type TaskStatus = (typeof TASK_STATUSES)[number];

export const TASK_STATUS_LABELS: Record<TaskStatus, string> = {
  open: "Open",
  in_progress: "In progress",
  done: "Done",
};

export const TASK_ASSIGNEES = ["admin", "client"] as const;
export type TaskAssignee = (typeof TASK_ASSIGNEES)[number];

export const CALENDAR_CHANNELS = ["instagram", "whatsapp", "other"] as const;
export type CalendarChannel = (typeof CALENDAR_CHANNELS)[number];

export const CALENDAR_CHANNEL_LABELS: Record<CalendarChannel, string> = {
  instagram: "Instagram",
  whatsapp: "WhatsApp",
  other: "Other",
};

export const CALENDAR_STATUSES = ["idea", "drafted", "approved", "posted"] as const;
export type CalendarStatus = (typeof CALENDAR_STATUSES)[number];

export const CALENDAR_STATUS_LABELS: Record<CalendarStatus, string> = {
  idea: "Idea",
  drafted: "Drafted",
  approved: "Approved",
  posted: "Posted",
};

// Roles
export const ROLES = ["admin", "client"] as const;
export type Role = (typeof ROLES)[number];

/** Rate limit for the Gravity read API (per token, fixed window). */
export const EXPORT_API_RATE = { limit: 60, windowSeconds: 60 } as const;
