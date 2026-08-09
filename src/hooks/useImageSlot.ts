import { useCallback, useEffect, useRef, useState } from "react";

export type ImageSlot = {
  file: File | null;
  previewUrl: string | null;
  set: (file: File) => void;
  clear: () => void;
};

/**
 * Owns one upload slot. Every object URL created here is revoked before it is
 * replaced and again on unmount, so repeatedly swapping images does not leak.
 */
export function useImageSlot(): ImageSlot {
  const [file, setFile] = useState<File | null>(null);
  const [previewUrl, setPreviewUrl] = useState<string | null>(null);

  // Mirror of previewUrl for cleanup, so the unmount effect can stay [] and
  // still see the latest value.
  const urlRef = useRef<string | null>(null);

  const revoke = useCallback(() => {
    if (urlRef.current) {
      URL.revokeObjectURL(urlRef.current);
      urlRef.current = null;
    }
  }, []);

  const set = useCallback(
    (next: File) => {
      revoke();
      const url = URL.createObjectURL(next);
      urlRef.current = url;
      setFile(next);
      setPreviewUrl(url);
    },
    [revoke],
  );

  const clear = useCallback(() => {
    revoke();
    setFile(null);
    setPreviewUrl(null);
  }, [revoke]);

  useEffect(() => revoke, [revoke]);

  return { file, previewUrl, set, clear };
}
