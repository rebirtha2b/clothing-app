type Props = {
  hasImage1: boolean;
  hasImage2: boolean;
  hasResult: boolean;
};

function Pill({ label, done }: { label: string; done: boolean }) {
  return (
    <span
      className={`rounded-full border px-5 py-2 text-[13px] transition-colors ${
        done
          ? "border-ink bg-ink text-white"
          : "border-hairline text-muted"
      }`}
    >
      {label}
    </span>
  );
}

export default function StatusPills({ hasImage1, hasImage2, hasResult }: Props) {
  return (
    <div className="flex flex-wrap gap-3">
      <Pill label="Source" done={hasImage1} />
      <Pill label="Garment" done={hasImage2} />
      <Pill label="Result" done={hasResult} />
    </div>
  );
}
