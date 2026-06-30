import { redirect } from "next/navigation";
import { getSession } from "@/lib/auth-server";
import { NavBar } from "@/components/NavBar";
import Script from "next/script";

const HUB_URL = process.env.NEXT_PUBLIC_HUB_URL || "https://chanv-apps-hub-271227085398.northamerica-northeast1.run.app";

export default async function AppLayout({ children }: { children: React.ReactNode }) {
  const s = await getSession();
  if (!s) redirect("/login");

  return (
    <>
      <NavBar />
      <div className="chanv-surface mx-auto max-w-5xl px-4 pb-16">{children}</div>
      {/* Hub Widgets — only on app pages, NOT on print pages */}
      <Script src={`${HUB_URL}/widgets/chatbot.js`} data-hub={HUB_URL} strategy="lazyOnload" />
      <Script src={`${HUB_URL}/widgets/feedback.js`} data-hub={HUB_URL} strategy="lazyOnload" />
      <Script src={`${HUB_URL}/js/gandalf-widget.js`} data-hub={HUB_URL} strategy="lazyOnload" />
    </>
  );
}
