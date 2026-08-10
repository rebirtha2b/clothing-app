import { useAuth } from "../hooks/useAuth";

const NAV_ITEMS = [
  "STUDIO",
  "MERGE",
  "LOOKBOOK",
  "GALLERY",
  "PRESETS",
  "ABOUT",
];

export default function Header() {
  const { displayName, signOut } = useAuth();

  return (
    <header>
      <div className="border-b border-hairline">
        {/* Brand stays optically centred; the account block is pinned right so
            it cannot push the wordmark off centre on narrow screens. */}
        <div className="relative mx-auto flex h-16 max-w-6xl items-center justify-center px-6">
          <span className="text-xl font-light tracking-[0.3em] uppercase sm:text-2xl">
            Atelier
          </span>

          <div className="absolute right-6 flex items-center gap-4">
            <span className="hidden max-w-[12rem] truncate text-[11px] tracking-[0.18em] text-muted uppercase sm:inline">
              {displayName}
            </span>
            <button
              type="button"
              onClick={() => void signOut()}
              className="cursor-pointer text-[11px] whitespace-nowrap tracking-[0.18em] text-muted uppercase transition-colors hover:text-ink"
            >
              Sign out
            </button>
          </div>
        </div>
      </div>

      <div className="border-b border-hairline">
        <nav className="mx-auto flex max-w-6xl items-center justify-center gap-6 overflow-x-auto px-6 py-4 sm:gap-8">
          {NAV_ITEMS.map((item, i) => (
            <span
              key={item}
              className={`text-[11px] whitespace-nowrap tracking-[0.18em] uppercase ${
                i === 1 ? "text-ink" : "text-muted"
              }`}
            >
              {item}
            </span>
          ))}
        </nav>
      </div>
    </header>
  );
}
