import { useId } from "react";

type Props = {
  label: string;
  type: "text" | "email" | "password";
  value: string;
  onChange: (value: string) => void;
  autoComplete: string;
  disabled: boolean;
  error?: string;
};

/** The app's only text input style. Underline rule, ink on focus. */
export default function TextField({
  label,
  type,
  value,
  onChange,
  autoComplete,
  disabled,
  error,
}: Props) {
  const inputId = useId();
  const errorId = useId();

  return (
    <div>
      <label
        htmlFor={inputId}
        className="text-[11px] tracking-[0.18em] text-muted uppercase"
      >
        {label}
      </label>

      <input
        id={inputId}
        type={type}
        value={value}
        onChange={(e) => onChange(e.target.value)}
        autoComplete={autoComplete}
        disabled={disabled}
        aria-invalid={error ? true : undefined}
        aria-describedby={error ? errorId : undefined}
        className={`mt-1 w-full border-b bg-transparent py-3 text-sm transition-colors focus:outline-none disabled:cursor-not-allowed disabled:text-muted ${
          error ? "border-accent" : "border-hairline focus:border-ink"
        }`}
      />

      {error && (
        <p id={errorId} role="alert" className="mt-1 text-xs text-accent">
          {error}
        </p>
      )}
    </div>
  );
}
