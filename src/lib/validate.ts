import { ACCEPTED_TYPES, MAX_BYTES } from "./constants";

function formatMb(bytes: number): string {
  return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
}

/**
 * Returns a human-readable reason the file is unusable, or null if it passes.
 * Both the file picker and the drop handler run this, so drag-and-drop cannot
 * sidestep the accept attribute.
 */
export function validateFile(file: File): string | null {
  if (!(ACCEPTED_TYPES as readonly string[]).includes(file.type)) {
    return "Use a JPG, PNG or WEBP image.";
  }
  if (file.size > MAX_BYTES) {
    return `Image is ${formatMb(file.size)}. Limit is ${formatMb(MAX_BYTES)}.`;
  }
  if (file.size === 0) {
    return "That file is empty.";
  }
  return null;
}
