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

export const CALENDAR_STATUSES = [
  "idea",
  "drafted",
  "awaiting_approval",
  "approved",
  "changes_requested",
  "posted",
] as const;
export type CalendarStatus = (typeof CALENDAR_STATUSES)[number];

export const CALENDAR_STATUS_LABELS: Record<CalendarStatus, string> = {
  idea: "Idea",
  drafted: "Drafted",
  awaiting_approval: "Awaiting approval",
  approved: "Approved",
  changes_requested: "Changes requested",
  posted: "Posted",
};

/**
 * Statuses anyone may set from the plain edit form. The other three are
 * reachable ONLY through the approval actions, so "approved" always means a
 * real client sign-off rather than someone picking it from a dropdown.
 */
export const CALENDAR_MANUAL_STATUSES = ["idea", "drafted", "posted"] as const;
export type CalendarManualStatus = (typeof CALENDAR_MANUAL_STATUSES)[number];

/** Statuses that mean "someone is being waited on" — surfaced on both dashboards. */
export const CALENDAR_PENDING_STATUSES = ["awaiting_approval", "changes_requested"] as const;

// Draft media / attachments
export const ATTACHMENT_KINDS = ["image", "video", "drive"] as const;
export type AttachmentKind = (typeof ATTACHMENT_KINDS)[number];

export const ATTACHMENT_PARENTS = ["idea", "calendar"] as const;
export type AttachmentParent = (typeof ATTACHMENT_PARENTS)[number];

/**
 * Hard ceiling for a directly-uploaded file, in bytes. Kept in sync with the
 * `media` bucket's file_size_limit (0006) and the attachments size CHECK
 * (0005) — three layers, because the client-side one is only a courtesy.
 */
export const MAX_UPLOAD_BYTES = 20 * 1024 * 1024;

/** Signed-URL lifetime for private media. Short: pages re-sign on every render. */
export const SIGNED_URL_TTL_SECONDS = 600;

/** Rough free-tier storage budget, used for the admin usage readout. */
export const STORAGE_BUDGET_BYTES = 1024 * 1024 * 1024;

export const MEDIA_BUCKET = "media";

// Raw asset (footage) tracker
export const ASSET_STATUSES = ["new", "downloaded", "editing", "edited", "used"] as const;
export type AssetStatus = (typeof ASSET_STATUSES)[number];

export const ASSET_STATUS_LABELS: Record<AssetStatus, string> = {
  new: "New",
  downloaded: "Downloaded",
  editing: "Editing",
  edited: "Edited",
  used: "Used",
};

// Roles
export const ROLES = ["admin", "client"] as const;
export type Role = (typeof ROLES)[number];

/** Rate limit for the Gravity read API (per token, fixed window). */
export const EXPORT_API_RATE = { limit: 60, windowSeconds: 60 } as const;
