export function initials(nameOrEmail: string): string {
  const s = (nameOrEmail || "").trim();
  if (!s) return "?";
  if (s.includes("@")) return s[0]!.toUpperCase();
  const parts = s.split(/\s+/).filter(Boolean);
  return (parts[0]![0]! + (parts[1]?.[0] ?? "")).toUpperCase();
}

export function displayName(fullName: string | null | undefined, email: string): string {
  return (fullName && fullName.trim()) || email || "Someone";
}

const DATE = new Intl.DateTimeFormat("en-US", { month: "short", day: "numeric" });
const DATE_FULL = new Intl.DateTimeFormat("en-US", {
  weekday: "short",
  month: "short",
  day: "numeric",
  year: "numeric",
});
const TIME = new Intl.DateTimeFormat("en-US", { hour: "numeric", minute: "2-digit" });

export function formatDate(d: string | Date): string {
  return DATE.format(new Date(d));
}
export function formatDateFull(d: string | Date): string {
  return DATE_FULL.format(new Date(d));
}
export function formatDateTime(d: string | Date): string {
  const date = new Date(d);
  return `${DATE.format(date)}, ${TIME.format(date)}`;
}

export function relativeTime(d: string | Date): string {
  const date = new Date(d);
  const diff = Date.now() - date.getTime();
  const sec = Math.round(diff / 1000);
  if (sec < 45) return "just now";
  const min = Math.round(sec / 60);
  if (min < 60) return `${min}m ago`;
  const hr = Math.round(min / 60);
  if (hr < 24) return `${hr}h ago`;
  const day = Math.round(hr / 24);
  if (day < 7) return `${day}d ago`;
  return formatDate(date);
}

/** yyyy-mm-dd for a Date, in local time (used by <input type="date"> and calendar keys). */
export function toDateKey(d: Date): string {
  const y = d.getFullYear();
  const m = String(d.getMonth() + 1).padStart(2, "0");
  const day = String(d.getDate()).padStart(2, "0");
  return `${y}-${m}-${day}`;
}
