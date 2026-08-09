import { useId, useRef, useState } from "react";

import { ACCEPT_ATTR } from "../lib/constants";
import { validateFile } from "../lib/validate";
import type { ImageSlot } from "../hooks/useImageSlot";

type Props = {
  label: string;
  hint: string;
  slot: ImageSlot;
  disabled: boolean;
};

export default function ImageDropTile({ label, hint, slot, disabled }: Props) {
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
    <div
      onDragOver={(e) => {
        e.preventDefault();
        if (!disabled) setDragging(true);
      }}
      onDragLeave={() => setDragging(false)}
      onDrop={onDrop}
      className={`relative rounded-xl border bg-card p-4 transition-colors ${
        dragging ? "border-ink" : "border-transparent"
      }`}
    >
      {filled && (
        <button
          type="button"
          onClick={() => {
            setError(null);
            slot.clear();
          }}
          disabled={disabled}
          aria-label={`Remove ${label.toLowerCase()} image`}
          className="absolute top-3 right-3 z-10 flex h-7 w-7 cursor-pointer items-center justify-center rounded-full bg-ink text-sm leading-none text-white transition-opacity hover:opacity-80 disabled:cursor-not-allowed disabled:opacity-40"
        >
          ×
        </button>
      )}

      <button
        type="button"
        onClick={openPicker}
        disabled={disabled}
        aria-describedby={error ? errorId : undefined}
        title={filled ? "Choose a different image" : undefined}
        className="flex h-64 w-full cursor-pointer items-center justify-center overflow-hidden rounded-lg disabled:cursor-not-allowed"
      >
        {filled ? (
          <img
            src={slot.previewUrl!}
            alt={`${label} preview`}
            className="max-h-full max-w-full object-contain"
          />
        ) : (
          <span className="flex flex-col items-center gap-3 text-muted transition-colors hover:text-ink">
            <span className="text-3xl font-light">+</span>
            <span className="text-[11px] tracking-[0.18em] uppercase">
              {label}
            </span>
            <span className="text-xs">{hint}</span>
          </span>
        )}
      </button>

      <p className="mt-3 truncate text-center text-xs text-muted">
        {slot.file ? slot.file.name : " "}
      </p>

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

      {error && (
        <p id={errorId} role="alert" className="mt-1 text-center text-xs text-accent">
          {error}
        </p>
      )}
    </div>
  );
}
