import type { Metadata } from "next";

export const metadata: Metadata = {
  title: "Explorer les mondes — NEXAGEN",
  description: "Parcourez et explorez les mondes voxels 3D crees par la communaute NEXAGEN.",
};

export default function ExplorePage() {
  return (
    <div className="mx-auto max-w-7xl px-6 py-12">
      <header className="mb-10">
        <h1 className="text-3xl font-bold font-display md:text-4xl">
          Explorer les mondes
        </h1>
        <p className="mt-2 text-text-secondary">
          Decouvrez les creations de la communaute et trouvez l&apos;inspiration.
        </p>
      </header>

      {/* Search bar */}
      <div className="mb-10">
        <div className="relative max-w-xl">
          <svg
            xmlns="http://www.w3.org/2000/svg"
            viewBox="0 0 24 24"
            fill="none"
            stroke="currentColor"
            strokeWidth={2}
            className="absolute left-3 top-1/2 h-5 w-5 -translate-y-1/2 text-text-tertiary"
          >
            <path
              strokeLinecap="round"
              strokeLinejoin="round"
              d="m21 21-5.197-5.197m0 0A7.5 7.5 0 1 0 5.196 5.196a7.5 7.5 0 0 0 10.607 10.607Z"
            />
          </svg>
          <input
            type="search"
            placeholder="Rechercher un monde..."
            className="w-full rounded-lg border border-glass-medium bg-bg-secondary py-3 pl-10 pr-4 text-text-primary placeholder:text-text-tertiary outline-none transition-colors focus:border-accent-primary"
          />
        </div>
      </div>

      {/* World cards grid */}
      <div className="grid gap-6 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4">
        {Array.from({ length: 8 }, (_, i) => (
          <div
            key={i}
            className="glass-panel overflow-hidden transition-transform hover:scale-[1.02]"
          >
            <div className="aspect-video w-full bg-bg-tertiary" />
            <div className="p-4">
              <div className="mb-2 h-5 w-3/4 rounded bg-bg-tertiary" />
              <div className="h-4 w-1/2 rounded bg-bg-tertiary" />
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}
