import type { Metadata } from "next";
import WorldCanvasLoader from "@/components/engine/WorldCanvasLoader";

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
      <WorldCanvasLoader worldId={worldId} />
    </div>
  );
}
