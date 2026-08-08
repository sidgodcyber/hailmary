"use client";

import { useRef, useState } from "react";
import { useRouter } from "next/navigation";
import { createClient } from "@/lib/supabase/client";
import { recordAttachment, discardOrphanUpload } from "@/app/app/attachments/actions";
import { prepareImageForUpload } from "@/lib/image.client";
import { kindForMime, mediaObjectPath, formatBytes } from "@/lib/media.client";
import { MAX_UPLOAD_BYTES, MEDIA_BUCKET, type AttachmentParent } from "@/lib/config";
import { Icon } from "@/components/icons";

/**
 * Uploads go browser → Supabase Storage directly, NOT through a server action:
 * Vercel caps a serverless request body at 4.5 MB, so a 20 MB video could never
 * survive the round trip. That makes storage.objects RLS (0006) the real
 * gatekeeper — the browser holds only the anon key plus the user's session, so
 * Postgres decides whether the write into `{tenant}/…` is allowed. The row is
 * recorded afterwards by a server action that re-validates the path.
 */

const MAX_LABEL = `${Math.round(MAX_UPLOAD_BYTES / (1024 * 1024))} MB`;

export function MediaUploader({
  tenantId,
  parentType,
  parentId,
}: {
  tenantId: string;
  parentType: AttachmentParent;
  parentId: string;
}) {
  const router = useRouter();
  const fileRef = useRef<HTMLInputElement>(null);
  const linkRef = useRef<HTMLInputElement>(null);
  const [busy, setBusy] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  async function onFile(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    if (!file) return;
    setError(null);

    const kind = kindForMime(file.type);
    if (!kind) {
      setError("Only images and video can be uploaded here.");
      if (fileRef.current) fileRef.current.value = "";
      return;
    }

    setBusy(kind === "image" ? "Compressing…" : "Uploading…");
    let uploadedPath: string | null = null;
    try {
      const prepared =
        kind === "image"
          ? await prepareImageForUpload(file)
          : { blob: file as Blob, fileName: file.name, mime: file.type };

      if (prepared.blob.size > MAX_UPLOAD_BYTES) {
        setError(
          `That file is ${formatBytes(prepared.blob.size)} — the limit is ${MAX_LABEL}. ` +
            `For longer video, paste a Drive link instead.`
        );
        return;
      }

      setBusy("Uploading…");
      const path = mediaObjectPath({
        tenantId,
        parentType,
        parentId,
        fileName: prepared.fileName,
        uuid: crypto.randomUUID(),
      });

      const supabase = createClient();
      const { error: upErr } = await supabase.storage
        .from(MEDIA_BUCKET)
        .upload(path, prepared.blob, { contentType: prepared.mime, upsert: false });
      if (upErr) throw new Error(upErr.message);
      uploadedPath = path;

      setBusy("Saving…");
      await recordAttachment({
        tenantId,
        parentType,
        parentId,
        kind,
        storagePath: path,
        sizeBytes: prepared.blob.size,
        mime: prepared.mime,
        title: file.name,
      });
      uploadedPath = null; // recorded — no longer an orphan
      router.refresh();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Upload failed. Try again.");
      // Don't leave a stored object with no row pointing at it.
      if (uploadedPath) {
        try {
          await discardOrphanUpload(tenantId, uploadedPath);
        } catch {
          /* best effort */
        }
      }
    } finally {
      setBusy(null);
      if (fileRef.current) fileRef.current.value = "";
    }
  }

  async function onLink(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    const url = linkRef.current?.value.trim();
    if (!url) return;
    setError(null);
    setBusy("Saving…");
    try {
      await recordAttachment({ tenantId, parentType, parentId, kind: "drive", externalUrl: url });
      if (linkRef.current) linkRef.current.value = "";
      router.refresh();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Could not save that link.");
    } finally {
      setBusy(null);
    }
  }

  return (
    <div className="space-y-3">
      <div className="flex flex-wrap items-center gap-2">
        <label className={`btn-ghost cursor-pointer ${busy ? "pointer-events-none opacity-50" : ""}`}>
          <Icon name="image" size={16} />
          {busy ?? "Add image or video"}
          <input
            ref={fileRef}
            type="file"
            accept="image/*,video/*"
            onChange={onFile}
            disabled={!!busy}
            className="sr-only"
          />
        </label>
        <span className="text-xs text-ink-muted">
          Photos are compressed automatically · uploads capped at {MAX_LABEL}
        </span>
      </div>

      <form onSubmit={onLink} className="flex items-end gap-2">
        <div className="flex-1">
          <label htmlFor={`drive_${parentId}`} className="label">
            Or paste a video link (Drive, YouTube…)
          </label>
          <input
            ref={linkRef}
            id={`drive_${parentId}`}
            type="url"
            inputMode="url"
            placeholder="https://drive.google.com/…"
            className="input"
            disabled={!!busy}
          />
        </div>
        <button type="submit" className="btn-ghost shrink-0" disabled={!!busy}>
          Add
        </button>
      </form>

      {error && (
        <p role="alert" className="text-sm text-red-700">
          {error}
        </p>
      )}
    </div>
  );
}
