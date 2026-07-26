"use client";

import dynamic from "next/dynamic";

function WorldLoadingFallback() {
  return (
    <div className="flex h-screen w-screen items-center justify-center bg-bg-primary">
      <div className="flex flex-col items-center gap-4">
        <div className="h-10 w-10 animate-spin rounded-full border-2 border-accent-primary border-t-transparent" />
        <p className="text-sm text-text-secondary">Chargement du monde...</p>
      </div>
    </div>
  );
}

const WorldCanvas = dynamic(() => import("./WorldCanvas"), {
  ssr: false,
  loading: () => <WorldLoadingFallback />,
});

interface WorldCanvasLoaderProps {
  readonly worldId: string;
}

export default function WorldCanvasLoader({ worldId }: WorldCanvasLoaderProps) {
  return <WorldCanvas worldId={worldId} />;
}
