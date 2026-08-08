import { Icon } from "@/components/icons";
import { DeleteAttachmentButton } from "@/components/media/DeleteAttachmentButton";
import { formatBytes, safeExternalUrl } from "@/lib/media.client";
import type { AttachmentKind } from "@/lib/config";

export type AttachmentView = {
  id: string;
  kind: AttachmentKind;
  storage_path: string | null;
  external_url: string | null;
  title: string | null;
  size_bytes: number;
  mime: string | null;
  created_at: string;
  /** Minted per render by signMediaUrls(); null when signing was refused/failed. */
  signedUrl: string | null;
};

/**
 * Stored media is never public — each render mints a fresh short-lived signed
 * URL, and signing itself runs through storage RLS, so a row pointing outside
 * the viewer's tenant yields no URL at all rather than a leak.
 */
export function AttachmentGallery({ attachments }: { attachments: AttachmentView[] }) {
  if (attachments.length === 0) return null;

  return (
    <ul className="grid grid-cols-2 gap-3">
      {attachments.map((a) => {
        const href = a.kind === "drive" ? safeExternalUrl(a.external_url) : null;
        return (
          <li key={a.id} className="group relative overflow-hidden rounded-xl border border-[color:var(--line)] bg-cream/40">
            {a.kind === "image" &&
              (a.signedUrl ? (
                // eslint-disable-next-line @next/next/no-img-element
                <img
                  src={a.signedUrl}
                  alt={a.title ?? "Draft image"}
                  loading="lazy"
                  className="aspect-square w-full object-cover"
                />
              ) : (
                <Unavailable label="Image unavailable" />
              ))}

            {a.kind === "video" &&
              (a.signedUrl ? (
                <video
                  src={a.signedUrl}
                  controls
                  preload="metadata"
                  className="aspect-square w-full bg-black object-contain"
                />
              ) : (
                <Unavailable label="Video unavailable" />
              ))}

            {a.kind === "drive" && (
              <div className="flex aspect-square w-full flex-col items-center justify-center gap-2 p-3 text-center">
                <span className="inline-flex h-10 w-10 items-center justify-center rounded-xl bg-brand-50 text-brand-700">
                  <Icon name="film" size={20} />
                </span>
                {href ? (
                  <a href={href} target="_blank" rel="noopener noreferrer" className="text-sm link">
                    Open video link
                  </a>
                ) : (
                  <span className="text-sm text-ink-muted">Link unavailable</span>
                )}
              </div>
            )}

            <div className="flex items-center justify-between gap-2 border-t border-[color:var(--line)] bg-surface px-2.5 py-1.5">
              <span className="truncate text-[11px] text-ink-muted" title={a.title ?? undefined}>
                {a.title || (a.kind === "drive" ? "Video link" : "Attachment")}
                {a.size_bytes > 0 && ` · ${formatBytes(a.size_bytes)}`}
              </span>
              <DeleteAttachmentButton attachmentId={a.id} />
            </div>
          </li>
        );
      })}
    </ul>
  );
}

function Unavailable({ label }: { label: string }) {
  return (
    <div className="flex aspect-square w-full items-center justify-center p-3 text-center text-xs text-ink-muted">
      {label}
    </div>
  );
}
