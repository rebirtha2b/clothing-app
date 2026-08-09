import type { Status } from "../App";

type Props = {
  status: Status;
  resultUrl: string | null;
  errorMessage: string | null;
  downloadName: string;
};

function Spinner() {
  return (
    <svg viewBox="0 0 40 40" className="spinner h-8 w-8" aria-hidden="true">
      <circle
        cx="20"
        cy="20"
        r="16"
        fill="none"
        stroke="currentColor"
        strokeOpacity="0.15"
        strokeWidth="2"
      />
      <path
        d="M20 4a16 16 0 0 1 16 16"
        fill="none"
        stroke="currentColor"
        strokeWidth="2"
        strokeLinecap="round"
      />
    </svg>
  );
}

export default function ResultTile({
  status,
  resultUrl,
  errorMessage,
  downloadName,
}: Props) {
  return (
    <div className="flex flex-col">
      <div className="mb-3 flex items-baseline justify-between">
        <span className="text-[11px] tracking-[0.18em] uppercase">
          03 — Result
        </span>
      </div>

      <div className="relative aspect-[3/4] w-full overflow-hidden border border-hairline bg-tile">
        {status === "loading" && (
          <div
            className="flex h-full w-full flex-col items-center justify-center gap-4 text-ink"
            role="status"
          >
            <Spinner />
            <span className="text-[11px] tracking-[0.18em] uppercase">
              Generating image…
            </span>
          </div>
        )}

        {status === "error" && (
          <div className="flex h-full w-full items-center justify-center px-8">
            <p role="alert" className="text-center text-sm text-accent">
              {errorMessage}
            </p>
          </div>
        )}

        {status === "success" && resultUrl && (
          <img
            src={resultUrl}
            alt="Generated result"
            className="h-full w-full object-contain"
          />
        )}

        {(status === "empty" || status === "ready") && (
          <div className="flex h-full w-full items-center justify-center px-8">
            <p className="text-center text-xs text-muted">
              Your result appears here.
            </p>
          </div>
        )}
      </div>

      <div className="mt-3 flex h-5 items-center gap-4 text-[11px] tracking-[0.18em] uppercase">
        {status === "success" && resultUrl && (
          <a
            href={resultUrl}
            download={downloadName}
            className="underline underline-offset-4 hover:text-muted"
          >
            Download
          </a>
        )}
      </div>
    </div>
  );
}
