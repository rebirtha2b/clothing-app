import { useEffect, useRef, useState } from "react";

import Header from "./components/Header";
import ImageDropTile from "./components/ImageDropTile";
import ResultTile from "./components/ResultTile";
import StatusPills from "./components/StatusPills";
import { useImageSlot } from "./hooks/useImageSlot";
import { generate } from "./lib/api";
import { GENERIC_ERROR } from "./lib/constants";

export type Status = "empty" | "ready" | "loading" | "success" | "error";

function extensionFor(type: string): string {
  if (type === "image/png") return "png";
  if (type === "image/webp") return "webp";
  return "jpg";
}

export default function App() {
  const image1 = useImageSlot();
  const image2 = useImageSlot();

  const [status, setStatus] = useState<Status>("empty");
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const [resultUrl, setResultUrl] = useState<string | null>(null);
  const [resultExt, setResultExt] = useState("png");

  const resultUrlRef = useRef<string | null>(null);
  const abortRef = useRef<AbortController | null>(null);

  const bothReady = Boolean(image1.file && image2.file);
  const busy = status === "loading";

  // Keep the pills honest while the user adds and removes images, without
  // stomping on loading/success/error, which are owned by onGenerate.
  useEffect(() => {
    setStatus((current) =>
      current === "empty" || current === "ready"
        ? bothReady
          ? "ready"
          : "empty"
        : current,
    );
  }, [bothReady]);

  useEffect(() => {
    return () => {
      abortRef.current?.abort();
      if (resultUrlRef.current) URL.revokeObjectURL(resultUrlRef.current);
    };
  }, []);

  async function onGenerate() {
    if (busy || !image1.file || !image2.file) return;

    abortRef.current?.abort();
    const controller = new AbortController();
    abortRef.current = controller;

    setStatus("loading");
    setErrorMessage(null);

    try {
      const blob = await generate(image1.file, image2.file, controller.signal);
      if (controller.signal.aborted) return;

      if (resultUrlRef.current) URL.revokeObjectURL(resultUrlRef.current);
      const url = URL.createObjectURL(blob);
      resultUrlRef.current = url;

      setResultUrl(url);
      setResultExt(extensionFor(blob.type));
      setStatus("success");
    } catch (error) {
      if (error instanceof DOMException && error.name === "AbortError") return;
      setErrorMessage(error instanceof Error ? error.message : GENERIC_ERROR);
      setStatus("error");
    } finally {
      if (abortRef.current === controller) abortRef.current = null;
    }
  }

  const readyCount = (image1.file ? 1 : 0) + (image2.file ? 1 : 0);

  return (
    <div className="min-h-screen">
      <Header />

      <main className="mx-auto max-w-6xl px-6 pt-10 pb-24">
        <nav className="flex items-center gap-2 text-xs">
          <span>Home</span>
          <span className="text-muted">›</span>
          <span>Studio</span>
          <span className="text-muted">›</span>
          <span className="text-muted">Image Merge</span>
        </nav>

        <h1 className="mt-8 text-5xl font-light tracking-tight sm:text-6xl">
          Image Merge
        </h1>

        <p className="mt-4 max-w-md text-sm text-muted">
          Upload a source image and a garment. We return a single composed
          result.
        </p>

        <div className="mt-10">
          <StatusPills
            hasImage1={Boolean(image1.file)}
            hasImage2={Boolean(image2.file)}
            hasResult={status === "success"}
          />
        </div>

        <div className="mt-12 flex flex-wrap items-center justify-between gap-4">
          <div className="flex items-center bg-ink px-6 py-4 text-[11px] tracking-[0.18em] text-white uppercase">
            JPG · PNG · WEBP — max 10 MB
          </div>
          <span className="text-sm text-muted">
            {readyCount} of 2 images ready
          </span>
        </div>

        <div className="mt-8 grid grid-cols-1 gap-8 sm:grid-cols-2 lg:grid-cols-3">
          <ImageDropTile
            index={1}
            label="Source"
            hint="A photo of the person"
            slot={image1}
            disabled={busy}
          />
          <ImageDropTile
            index={2}
            label="Garment"
            hint="The item to apply"
            slot={image2}
            disabled={busy}
          />
          <div className="sm:col-span-2 lg:col-span-1">
            <ResultTile
              status={status}
              resultUrl={resultUrl}
              errorMessage={errorMessage}
              downloadName={`merged.${resultExt}`}
            />
          </div>
        </div>

        <div className="mt-14 flex justify-center">
          <button
            type="button"
            onClick={onGenerate}
            disabled={!bothReady || busy}
            className="w-full max-w-md cursor-pointer bg-ink px-10 py-5 text-[11px] tracking-[0.24em] text-white uppercase transition-opacity hover:opacity-85 disabled:cursor-not-allowed disabled:bg-hairline disabled:text-muted disabled:opacity-100"
          >
            {busy ? "Generating…" : "Generate"}
          </button>
        </div>
      </main>

      <footer className="border-t border-hairline">
        <div className="mx-auto flex max-w-6xl justify-center px-6 py-8">
          <span className="text-[11px] tracking-[0.18em] text-muted uppercase">
            Atelier — Studio Tools
          </span>
        </div>
      </footer>
    </div>
  );
}
