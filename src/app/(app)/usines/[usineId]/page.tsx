import { requireSession } from "@/lib/auth-server";

export default async function UsineDetailPage({
  params,
}: {
  params: Promise<{ usineId: string }>;
}) {
  await requireSession();
  const { usineId } = await params;
  return (
    <main className="mx-auto max-w-6xl p-6">
      <h1 className="text-2xl font-bold mb-6">Fiche usine — {usineId}</h1>
      <div className="card p-8 text-center text-gray-400">
        <p>🚧 Page en construction</p>
        <p className="text-sm mt-2">
          Plan d&apos;étage SVG interactif (FactoryFloorPlan) + drawer (RoomDrawer) — voir Antigravity.md
        </p>
      </div>
    </main>
  );
}
