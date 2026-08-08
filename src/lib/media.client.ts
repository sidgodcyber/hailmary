/**
 * Pure media helpers shared by the browser uploader and the server actions.
 *
 * The object-path contract lives here so both sides derive it from ONE piece
 * of code: the browser builds a path, the server re-validates it against the
 * tenant it resolved from the session (never from the form), and Postgres
 * checks it a third time (attachments_path_tenant_scoped in 0005).
 *
 * No "server-only" import — this file is deliberately isomorphic, mirroring
 * the auth.ts / auth.client.ts split.
 */

import { ATTACHMENT_KINDS, type AttachmentKind, type AttachmentParent } from "@/lib/config";

const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

/** Strip anything that would make an object key awkward or ambiguous. */
export function sanitizeFileName(name: string): string {
  const cleaned = name
    .normalize("NFKD")
    .replace(/[^\w.\- ]+/g, "")
    .replace(/\s+/g, "-")
    .replace(/-+/g, "-")
    .replace(/^[.\-]+/, "")
    .slice(-80);
  return cleaned || "file";
}

/** `{tenant_id}/{parent_type}/{parent_id}/{uuid}-{filename}` — the one contract. */
export function mediaObjectPath(opts: {
  tenantId: string;
  parentType: AttachmentParent;
  parentId: string;
  fileName: string;
  uuid: string;
}): string {
  return `${opts.tenantId}/${opts.parentType}/${opts.parentId}/${opts.uuid}-${sanitizeFileName(
    opts.fileName
  )}`;
}

/**
 * True only when `path` sits under this tenant's own top-level folder.
 * Rejects `..` segments too: storage keys are opaque strings so they can't
 * actually traverse, but a key containing them is never something we wrote.
 */
export function pathIsInTenant(path: string, tenantId: string): boolean {
  if (!path || !UUID_RE.test(tenantId)) return false;
  if (path.includes("..")) return false;
  const [first, ...rest] = path.split("/");
  return first === tenantId && rest.length > 0 && rest.every((s) => s.length > 0);
}

/** Map a browser-reported MIME type to an attachment kind we store. */
export function kindForMime(mime: string): Exclude<AttachmentKind, "drive"> | null {
  if (mime.startsWith("image/")) return "image";
  if (mime.startsWith("video/")) return "video";
  return null;
}

export function isAttachmentKind(v: string): v is AttachmentKind {
  return (ATTACHMENT_KINDS as readonly string[]).includes(v);
}

/**
 * Return `url` only if it is a plain http(s) link, else null.
 *
 * Attachment/Drive links are rendered as `href`, so an unchecked value would
 * let `javascript:` (or `data:`) through as stored XSS on whoever opens the
 * post. Everything user-supplied that becomes an href goes through here.
 */
export function safeExternalUrl(url: string | null | undefined): string | null {
  if (!url) return null;
  const trimmed = url.trim();
  if (!trimmed) return null;
  try {
    const parsed = new URL(trimmed);
    return parsed.protocol === "http:" || parsed.protocol === "https:" ? parsed.toString() : null;
  } catch {
    return null;
  }
}

export function formatBytes(bytes: number): string {
  if (!bytes || bytes < 0) return "0 KB";
  if (bytes < 1024) return `${bytes} B`;
  const kb = bytes / 1024;
  if (kb < 1024) return `${Math.round(kb)} KB`;
  const mb = kb / 1024;
  if (mb < 1024) return `${mb.toFixed(mb < 10 ? 1 : 0)} MB`;
  return `${(mb / 1024).toFixed(2)} GB`;
}
