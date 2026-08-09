import { useId, useRef, useState } from "react";

import { ACCEPT_ATTR } from "../lib/constants";
import { validateFile } from "../lib/validate";
import type { ImageSlot } from "../hooks/useImageSlot";

type Props = {
  index: number;
  label: string;
  hint: string;
  slot: ImageSlot;
  disabled: boolean;
};

export default function ImageDropTile({
  index,
  label,
  hint,
  slot,
  disabled,
}: Props) {
  const inputRef = useRef<HTMLInputElement>(null);
  const [dragging, setDragging] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const errorId = useId();

  function accept(file: File | undefined) {
    if (!file) return;
    const problem = validateFile(file);
    if (problem) {
      setError(problem);
      return;
    }
    setError(null);
    slot.set(file);
  }

  function onDrop(event: React.DragEvent) {
    event.preventDefault();
    setDragging(false);
    if (disabled) return;
    accept(event.dataTransfer.files[0]);
  }

  function openPicker() {
    if (!disabled) inputRef.current?.click();
  }

  const filled = Boolean(slot.previewUrl);

  return (
    <div className="flex flex-col">
      <div className="mb-3 flex items-baseline justify-between">
        <span className="text-[11px] tracking-[0.18em] uppercase">
          {String(index).padStart(2, "0")} — {label}
        </span>
      </div>

      <div
        onDragOver={(e) => {
          e.preventDefault();
          if (!disabled) setDragging(true);
        }}
        onDragLeave={() => setDragging(false)}
        onDrop={onDrop}
        className={`relative aspect-[3/4] w-full overflow-hidden border bg-tile transition-colors ${
          dragging ? "border-ink" : "border-hairline"
        }`}
      >
        {filled ? (
          <img
            src={slot.previewUrl!}
            alt={`${label} preview`}
            className="h-full w-full object-cover"
          />
        ) : (
          <button
            type="button"
            onClick={openPicker}
            disabled={disabled}
            aria-describedby={error ? errorId : undefined}
            className="flex h-full w-full cursor-pointer flex-col items-center justify-center gap-3 text-muted transition-colors hover:text-ink disabled:cursor-not-allowed"
          >
            <span className="text-3xl font-light">+</span>
            <span className="text-[11px] tracking-[0.18em] uppercase">
              Add image
            </span>
            <span className="max-w-[80%] text-center text-xs">{hint}</span>
          </button>
        )}

        <input
          ref={inputRef}
          type="file"
          accept={ACCEPT_ATTR}
          className="hidden"
          onChange={(e) => {
            accept(e.target.files?.[0]);
            // Allow re-selecting the same file after a removal.
            e.target.value = "";
          }}
        />
      </div>

      <div className="mt-3 flex h-5 items-center gap-4 text-[11px] tracking-[0.18em] uppercase">
        {filled && (
          <>
            <button
              type="button"
              onClick={openPicker}
              disabled={disabled}
              className="cursor-pointer underline underline-offset-4 hover:text-muted disabled:cursor-not-allowed disabled:text-muted"
            >
              Replace
            </button>
            <button
              type="button"
              onClick={() => {
                setError(null);
                slot.clear();
              }}
              disabled={disabled}
              className="cursor-pointer text-muted underline underline-offset-4 hover:text-ink disabled:cursor-not-allowed"
            >
              Remove
            </button>
          </>
        )}
      </div>

      {error && (
        <p id={errorId} role="alert" className="mt-1 text-xs text-accent">
          {error}
        </p>
      )}
    </div>
  );
}
