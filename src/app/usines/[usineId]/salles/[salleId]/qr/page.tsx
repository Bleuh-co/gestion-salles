import { requireSession } from "@/lib/auth-server";

// Page QR imprimable — layout minimal sans navbar (hors du groupe (app))
export default async function SalleQRPage({
  params,
}: {
  params: Promise<{ usineId: string; salleId: string }>;
}) {
  await requireSession();
  const { usineId, salleId } = await params;
  return (
    <main className="min-h-screen flex flex-col items-center justify-center p-6 bg-white">
      <div className="card p-8 text-center text-gray-400 max-w-md">
        <h1 className="text-xl font-bold mb-4 text-gray-700">QR Salle</h1>
        <p>🚧 Page en construction</p>
        <p className="text-sm mt-2">
          QR code imprimable (PrintableQRCode, lib `qrcode`) pour /usines/{usineId}/salles/{salleId}
          — voir Antigravity.md
        </p>
      </div>
    </main>
  );
}
