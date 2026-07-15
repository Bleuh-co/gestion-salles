import { redirect } from "next/navigation";
import { getSession } from "@/lib/auth-server";
import { NavBar } from "@/components/NavBar";
import { StandaloneWidgets } from "@/components/StandaloneWidgets";

const HUB_URL = process.env.NEXT_PUBLIC_HUB_URL || "https://gandalf.chanv.com";

export default async function AppLayout({ children }: { children: React.ReactNode }) {
  const s = await getSession();
  if (!s) redirect("/login");

  return (
    <>
      <NavBar />
      <div className="chanv-surface mx-auto max-w-5xl px-4 pb-16">{children}</div>
      {/* Widgets flottants du hub — STANDALONE seulement. AVANT : gardés par le
          flag serveur `!embedded` (dérivé du cookie gandalf_embed collant) qui
          contaminait le standalone. Le composant client vérifie le VRAI framing
          (window.self !== window.top). */}
      <StandaloneWidgets hubUrl={HUB_URL} scripts={["/widgets/chatbot.js", "/widgets/feedback.js", "/js/gandalf-widget.js"]} />
    </>
  );
}
