type Props = {
  message: string;
};

/**
 * Shown in place of the app when required configuration is missing. Deployed
 * builds have no console reader, so the fix has to be on screen.
 */
export default function ConfigError({ message }: Props) {
  return (
    <div className="flex min-h-screen items-center justify-center px-6">
      <div className="max-w-lg">
        <p className="text-[11px] tracking-[0.24em] text-accent uppercase">
          Configuration error
        </p>

        <h1 className="mt-4 text-3xl font-light tracking-tight">{message}</h1>

        <p className="mt-6 text-sm text-muted">
          The app cannot reach its image-generation webhook without this value.
        </p>

        <div className="mt-8 border-t border-hairline pt-6">
          <p className="text-[11px] tracking-[0.18em] uppercase">Local</p>
          <p className="mt-2 text-sm text-muted">
            Copy <code className="text-ink">.env.example</code> to{" "}
            <code className="text-ink">.env</code>, fill in the URL, then
            restart the dev server — Vite reads it only at startup.
          </p>
        </div>

        <div className="mt-6 border-t border-hairline pt-6">
          <p className="text-[11px] tracking-[0.18em] uppercase">Vercel</p>
          <p className="mt-2 text-sm text-muted">
            Add it under Settings → Environment Variables, then{" "}
            <strong className="font-medium text-ink">redeploy</strong>. The
            value is compiled into the bundle at build time, so setting it
            alone will not change the deployment already live.
          </p>
        </div>
      </div>
    </div>
  );
}
