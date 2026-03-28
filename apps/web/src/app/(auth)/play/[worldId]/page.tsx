import type { Metadata } from "next";
import dynamic from "next/dynamic";

const WorldCanvas = dynamic(
  () => import("@/components/engine/WorldCanvas"),
  { ssr: false, loading: () => <WorldLoadingFallback /> },
);

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

export async function generateMetadata({
  params,
}: {
  params: Promise<{ worldId: string }>;
}): Promise<Metadata> {
  const { worldId } = await params;
  return {
    title: `Monde ${worldId} — NEXAGEN`,
    description: `Explorez le monde ${worldId} en 3D dans votre navigateur.`,
  };
}

export default async function PlayPage({
  params,
}: {
  params: Promise<{ worldId: string }>;
}) {
  const { worldId } = await params;

  return (
    <div className="fixed inset-0 h-screen w-screen overflow-hidden bg-bg-primary">
      <WorldCanvas worldId={worldId} />
    </div>
  );
}
