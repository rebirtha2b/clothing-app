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
    <section>
      <div className="flex min-h-[26rem] items-center justify-center rounded-xl bg-card p-4">
        {status === "loading" && (
          <div className="flex flex-col items-center gap-4 text-ink" role="status">
            <Spinner />
            <span className="text-[11px] tracking-[0.18em] uppercase">
              Generating image…
            </span>
          </div>
        )}

        {status === "error" && (
          <p role="alert" className="max-w-sm text-center text-sm text-accent">
            {errorMessage}
          </p>
        )}

        {status === "success" && resultUrl && (
          <img
            src={resultUrl}
            alt="Generated result"
            className="max-h-[70vh] max-w-full rounded-lg object-contain"
          />
        )}

        {(status === "empty" || status === "ready") && (
          <p className="text-center text-xs text-muted">
            Your result appears here.
          </p>
        )}
      </div>

      {status === "success" && resultUrl && (
        <div className="mt-6 flex justify-center">
          <a
            href={resultUrl}
            download={downloadName}
            className="bg-ink px-10 py-4 text-[11px] tracking-[0.24em] text-white uppercase transition-opacity hover:opacity-85"
          >
            Download result
          </a>
        </div>
      )}
    </section>
  );
}
