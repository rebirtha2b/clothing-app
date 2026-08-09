const NAV_ITEMS = [
  "STUDIO",
  "MERGE",
  "LOOKBOOK",
  "GALLERY",
  "PRESETS",
  "ABOUT",
];

export default function Header() {
  return (
    <header>
      <div className="border-b border-hairline">
        <div className="mx-auto flex h-16 max-w-6xl items-center justify-center px-6">
          <span className="text-xl font-light tracking-[0.3em] uppercase sm:text-2xl">
            Atelier
          </span>
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
