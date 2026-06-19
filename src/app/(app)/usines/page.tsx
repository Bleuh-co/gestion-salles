import { requireSession } from "@/lib/auth-server";
import { getUsines } from "@/lib/data";
import { UsineCard } from "@/components/UsineCard";
import { EmptyState } from "@/components/EmptyState";

export default async function UsinesPage() {
  await requireSession();
  const usines = getUsines().map(({ salles, ...rest }) => rest);

  return (
    <main>
      <div className="flex items-center justify-between mb-6">
        <h1 className="text-2xl font-bold text-chanv-terre">🏭 Usines</h1>
        <span className="badge-neutral">{usines.length} usine{usines.length > 1 ? "s" : ""}</span>
      </div>

      {usines.length === 0 ? (
        <EmptyState
          icon="🏭"
          title="Aucune usine disponible"
          description="Les usines apparaîtront ici une fois configurées."
        />
      ) : (
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
          {usines.map((usine) => (
            <UsineCard key={usine.id} usine={usine} />
          ))}
        </div>
      )}
    </main>
  );
}
