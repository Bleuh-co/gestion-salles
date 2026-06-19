import { redirect } from "next/navigation";
import { requireSession } from "@/lib/auth-server";

// Point d'entrée — redirige vers la liste des usines
export default async function SallesPage() {
  await requireSession();
  redirect("/usines");
}
