import { redirect } from "next/navigation";
import { headers } from "next/headers";
import { getSession } from "@/lib/auth-server";
import { NavBar } from "@/components/NavBar";
import Script from "next/script";

const HUB_URL = process.env.NEXT_PUBLIC_HUB_URL || "https://gandalf.chanv.com";

export default async function AppLayout({ children }: { children: React.ReactNode }) {
  const s = await getSession();
  if (!s) redirect("/login");

  // Mode embarqué Gandalf (header posé par le middleware du SDK) : le hub
  // fournit déjà chatbot/feedback/widget — on ne charge rien de redondant.
  const embedded = (await headers()).get("x-gandalf-embedded") === "1";

  return (
    <>
      <NavBar />
      <div className="chanv-surface mx-auto max-w-5xl px-4 pb-16">{children}</div>
      {/* Hub Widgets — only on app pages (standalone), NOT on print pages nor in embed */}
      {!embedded && (
        <>
          <Script src={`${HUB_URL}/widgets/chatbot.js`} data-hub={HUB_URL} strategy="lazyOnload" />
          <Script src={`${HUB_URL}/widgets/feedback.js`} data-hub={HUB_URL} strategy="lazyOnload" />
          <Script src={`${HUB_URL}/js/gandalf-widget.js`} data-hub={HUB_URL} strategy="lazyOnload" />
        </>
      )}
    </>
  );
}
