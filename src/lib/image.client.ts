/**
 * Browser-side image downscale + recompress, run before upload.
 *
 * A phone photo is routinely 4-8 MB; at 1600px/q0.8 the same image lands
 * around 200-500 KB, which keeps us inside the free-tier storage budget and
 * makes the draft load instantly on a phone. Only images are touched — video
 * is passed through untouched (Drive link is the primary path for video).
 *
 * Fails soft: if anything about decode/encode goes wrong we return the
 * original file rather than blocking the upload.
 */

const MAX_EDGE = 1600;
const QUALITY = 0.8;

export type PreparedFile = { blob: Blob; fileName: string; mime: string };

export async function prepareImageForUpload(file: File): Promise<PreparedFile> {
  const passthrough: PreparedFile = { blob: file, fileName: file.name, mime: file.type };

  // GIFs would lose their animation on a canvas round-trip; SVG is not in the
  // bucket's allowed types at all. Leave both alone.
  if (!file.type.startsWith("image/") || file.type === "image/gif") return passthrough;

  try {
    const bitmap = await createImageBitmap(file);
    const scale = Math.min(1, MAX_EDGE / Math.max(bitmap.width, bitmap.height));

    // Already small enough and already a web format — don't re-encode.
    if (scale === 1 && (file.type === "image/jpeg" || file.type === "image/webp")) {
      bitmap.close();
      return passthrough;
    }

    const width = Math.max(1, Math.round(bitmap.width * scale));
    const height = Math.max(1, Math.round(bitmap.height * scale));

    const canvas = document.createElement("canvas");
    canvas.width = width;
    canvas.height = height;
    const ctx = canvas.getContext("2d");
    if (!ctx) {
      bitmap.close();
      return passthrough;
    }
    ctx.drawImage(bitmap, 0, 0, width, height);
    bitmap.close();

    const blob = await new Promise<Blob | null>((resolve) =>
      canvas.toBlob(resolve, "image/jpeg", QUALITY)
    );
    if (!blob || blob.size >= file.size) return passthrough;

    const base = file.name.replace(/\.[^.]+$/, "") || "image";
    return { blob, fileName: `${base}.jpg`, mime: "image/jpeg" };
  } catch {
    return passthrough;
  }
}
