import { redirect } from "next/navigation";
import { getSession } from "@/lib/auth-server";

export default async function PrintLayout({ children }: { children: React.ReactNode }) {
  const s = await getSession();
  if (!s) redirect("/login");

  // No header, no nav — just the content for printing
  return <>{children}</>;
}
