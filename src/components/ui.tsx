import Link from "next/link";
import { Icon } from "@/components/icons";
import { initials } from "@/lib/format";

/** A single pulsing placeholder block. */
export function Skeleton({ className = "" }: { className?: string }) {
  return <div className={`animate-pulse rounded-lg bg-black/[0.06] ${className}`} />;
}

/**
 * Generic page skeleton shown via loading.tsx while a route's data streams in.
 * A title bar plus a few card-shaped blocks — enough to make navigation feel
 * instant under free-tier cold starts.
 */
export function PageSkeleton({ rows = 4 }: { rows?: number }) {
  return (
    <div className="space-y-4">
      <div className="space-y-2">
        <Skeleton className="h-6 w-40" />
        <Skeleton className="h-4 w-64 max-w-full" />
      </div>
      <div className="space-y-2.5">
        {Array.from({ length: rows }).map((_, i) => (
          <div key={i} className="card p-4 space-y-2">
            <Skeleton className="h-4 w-24" />
            <Skeleton className="h-4 w-3/4" />
          </div>
        ))}
      </div>
    </div>
  );
}

export function PageHeader({
  title,
  subtitle,
  action,
}: {
  title: string;
  subtitle?: string;
  action?: React.ReactNode;
}) {
  return (
    <div className="flex items-start justify-between gap-3 mb-4">
      <div>
        <h1 className="text-xl font-bold tracking-tight">{title}</h1>
        {subtitle && <p className="mt-0.5 text-sm text-ink-muted">{subtitle}</p>}
      </div>
      {action}
    </div>
  );
}

export function EmptyState({
  title,
  hint,
  action,
}: {
  title: string;
  hint?: string;
  action?: React.ReactNode;
}) {
  return (
    <div className="card p-8 text-center">
      <p className="font-semibold">{title}</p>
      {hint && <p className="mt-1 text-sm text-ink-muted">{hint}</p>}
      {action && <div className="mt-4 flex justify-center">{action}</div>}
    </div>
  );
}

const BADGE_TONES: Record<string, string> = {
  // idea statuses
  new: "bg-brand-50 text-brand-700",
  discussing: "bg-accent-50 text-accent-700",
  planned: "bg-indigo-50 text-indigo-700",
  done: "bg-emerald-50 text-emerald-700",
  parked: "bg-stone-100 text-stone-600",
  // task statuses
  open: "bg-brand-50 text-brand-700",
  in_progress: "bg-accent-50 text-accent-700",
  // calendar statuses
  idea_cal: "bg-brand-50 text-brand-700",
  drafted: "bg-accent-50 text-accent-700",
  approved: "bg-indigo-50 text-indigo-700",
  posted: "bg-emerald-50 text-emerald-700",
  // channels
  instagram: "bg-pink-50 text-pink-700",
  whatsapp: "bg-emerald-50 text-emerald-700",
  other: "bg-stone-100 text-stone-600",
  // asset statuses (prefixed to decouple from same-named statuses elsewhere)
  asset_new: "bg-accent-50 text-accent-700",
  asset_downloaded: "bg-brand-50 text-brand-700",
  asset_editing: "bg-indigo-50 text-indigo-700",
  asset_edited: "bg-violet-50 text-violet-700",
  asset_used: "bg-emerald-50 text-emerald-700",
  // generic
  reference: "bg-indigo-50 text-indigo-700",
  neutral: "bg-stone-100 text-stone-600",
};

export function Badge({
  tone = "neutral",
  children,
}: {
  tone?: keyof typeof BADGE_TONES | string;
  children: React.ReactNode;
}) {
  const cls = BADGE_TONES[tone] ?? BADGE_TONES.neutral;
  return <span className={`chip ${cls}`}>{children}</span>;
}

export function Avatar({ label }: { label: string }) {
  return (
    <span className="inline-flex h-7 w-7 shrink-0 items-center justify-center rounded-full bg-brand-100 text-brand-800 text-xs font-bold">
      {initials(label)}
    </span>
  );
}

export function FabLink({ href, label }: { href: string; label: string }) {
  return (
    <Link href={href} className="btn-primary shadow-soft" aria-label={label}>
      <Icon name="plus" size={18} />
      <span>{label}</span>
    </Link>
  );
}

export function BackLink({ href, label }: { href: string; label: string }) {
  return (
    <Link
      href={href}
      className="inline-flex items-center gap-1 text-sm font-medium text-ink-muted hover:text-ink mb-3"
    >
      <Icon name="back" size={16} />
      {label}
    </Link>
  );
}
