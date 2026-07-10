"use client";

import Image from "next/image";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { Building2, Settings2 } from "lucide-react";
import { useGandalf } from "@bleuh-co/gandalf-sdk-next/client";

import { cn } from "@/lib/utils";
import { useT } from "@/lib/i18n";
import { useAuth } from "./AuthProvider";
import { Sidebar } from "./Sidebar";

interface NavLink {
  href: string;
  labelKey: string;
  icon: typeof Building2;
  adminOnly?: boolean;
}

// « masqué ≠ perdu » : la même liste (liens role-gated inclus) alimente la
// barre standalone ET la nav d'embed — aucun lien ne disparaît en mode embarqué.
const LINKS: NavLink[] = [
  { href: "/salles", labelKey: "nav.rooms", icon: Building2 },
  { href: "/admin", labelKey: "nav.admin", icon: Settings2, adminOnly: true },
];

export function NavBar() {
  const pathname = usePathname();
  const { session } = useAuth();
  const { embedded, hubUrl } = useGandalf();
  const t = useT();

  if (!session) return null;

  const isAdmin = session.role === "admin" || session.role === "superadmin";
  const visible = LINKS.filter((l) => !l.adminOnly || isAdmin);

  if (embedded) {
    // Contrat d'embed, morceau 3 — nav interne d'embed, modèle xero/elearning
    // (#gandalf-embed-nav) : barre claire sticky sur fond parchemin, pastilles
    // blanches arrondies, pastille active or. Le hub fournit logo/titre/profil —
    // rien de redondant ici, mais la navigation reste fonctionnelle.
    return (
      <nav
        id="gandalf-embed-nav"
        className="sticky top-0 z-40 flex flex-wrap items-center gap-1.5 bg-[#F4EFE3] px-4 pb-1 pt-3"
      >
        {visible.map((l) => {
          const Icon = l.icon;
          const active = pathname === l.href || pathname?.startsWith(l.href + "/");
          return (
            <Link
              key={l.href}
              href={l.href}
              className={cn(
                "inline-flex items-center gap-1.5 rounded-full border px-4 py-2 text-[12.5px] font-semibold transition-colors",
                active
                  ? "border-[#A8863F] bg-[#A8863F] font-bold text-white"
                  : "border-black/10 bg-white text-black/60 hover:border-[#A8863F]/40 hover:text-[#282828]",
              )}
            >
              <Icon size={15} />
              <span>{t(l.labelKey)}</span>
            </Link>
          );
        })}
      </nav>
    );
  }

  return (
    <header className="chanv-header">
      <div className="mx-auto max-w-5xl flex items-center gap-6 flex-nowrap relative flex-col md:flex-row text-center md:text-left">
        <a
          href={hubUrl}
          className="chanv-logo-wrapper flex items-center"
          title={t("nav.backToHub")}
        >
          <Image
            src="/logo-groupe-chanv.svg"
            alt="Chanv"
            width={130}
            height={44}
            priority
            className="h-10 w-auto"
          />
        </a>
        <div>
          <h1 className="text-xl font-bold m-0 leading-tight">{t("app.title")}</h1>
          <p className="text-[10px] md:text-[11px] uppercase tracking-[3px] opacity-70 mt-1 m-0">
            {t("nav.subtitle")}
          </p>
        </div>

        {/* Nav links — desktop only (mobile uses sidebar) */}
        <nav className="hidden md:flex items-center gap-4 md:ml-auto">
          {visible.map((l) => {
            const Icon = l.icon;
            return (
              <a
                key={l.href}
                href={l.href}
                className="flex items-center gap-1.5 text-sm font-medium text-white/80 hover:text-white transition-colors"
              >
                <Icon size={16} />
                {t(l.labelKey)}
              </a>
            );
          })}
        </nav>

        <div className="flex items-center gap-3 absolute top-0 right-0 md:relative md:top-auto md:right-auto">
          <div className="text-right hidden sm:block">
            <div className="text-sm font-semibold text-white whitespace-nowrap">
              {session.displayName || session.email}
            </div>
            <div className="text-[11px] text-white/60 uppercase tracking-wider whitespace-nowrap">
              {t(`role.${session.role}`)}
            </div>
          </div>
          <Sidebar />
        </div>
      </div>
    </header>
  );
}
