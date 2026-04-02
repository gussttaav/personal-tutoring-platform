"use client";

/**
 * Navbar — Emerald Nocturne redesign
 *
 * - Desktop: brand + nav links (lg+) + auth dropdown with pack credits
 * - Mobile:  brand + hamburger → full-width panel with nav, user info, pack, auth
 */

import { useState } from "react";
import Link from "next/link";
import { useSession, signIn, signOut } from "next-auth/react";
import Image from "next/image";
import { useUserSession } from "@/hooks/useUserSession";

function openPackBooking() {
  window.dispatchEvent(new CustomEvent("open-pack-booking"));
}

const NAV_LINKS = [
  { label: "Cursos",   href: "#" },
  { label: "Mentoría", href: "#sessions", accent: true },
  { label: "Blog",     href: "#" },
];

export default function Navbar() {
  const { data: session, status } = useSession();
  const { packSession } = useUserSession();
  const [mobileOpen, setMobileOpen] = useState(false);

  const isLoaded   = status !== "loading";
  const isSignedIn = !!session?.user;
  const user       = session?.user;

  const hasActivePack = !!packSession && packSession.credits > 0;

  const handlePackClick = () => {
    setMobileOpen(false);
    openPackBooking();
  };

  return (
    <nav
      className="fixed top-0 w-full z-50"
      style={{
        background: "rgba(19, 19, 21, 0.85)",
        backdropFilter: "blur(20px)",
        WebkitBackdropFilter: "blur(20px)",
        boxShadow: "0 1px 0 rgba(255,255,255,0.05)",
      }}
    >
      {/* ── Main bar ── */}
      <div
        className="flex justify-between items-center px-6 md:px-8 py-4 mx-auto"
        style={{ maxWidth: "1280px" }}
      >
        {/* Left: Brand + desktop nav links */}
        <div className="flex items-center gap-10">
          <Link
            href="/"
            className="text-xl font-black tracking-tighter"
            style={{ fontFamily: "var(--font-headline, Manrope), sans-serif", color: "#e5e1e4" }}
          >
            GUSTAVOAI.DEV
          </Link>

          <div
            className="hidden lg:flex items-center gap-8"
            style={{ fontFamily: "var(--font-headline, Manrope), sans-serif", fontWeight: 600 }}
          >
            {NAV_LINKS.map(({ label, href, accent }) => (
              <Link
                key={label}
                href={href}
                className="transition-colors"
                style={{ color: accent ? "#4edea3" : "rgba(229,225,228,0.6)" }}
                onMouseEnter={(e) => { if (!accent) (e.currentTarget as HTMLElement).style.color = "#e5e1e4"; }}
                onMouseLeave={(e) => { if (!accent) (e.currentTarget as HTMLElement).style.color = "rgba(229,225,228,0.6)"; }}
              >
                {label}
              </Link>
            ))}
          </div>
        </div>

        {/* Right: Auth (desktop) + hamburger (mobile) */}
        <div className="flex items-center gap-3">

          {/* ── Desktop auth ── */}
          {isLoaded && (
            isSignedIn && user ? (
              <div className="hidden sm:flex items-center gap-4 group relative">
                <div
                  className="flex items-center gap-3 cursor-pointer"
                  style={{ paddingLeft: "16px", borderLeft: "1px solid rgba(60,74,66,0.4)" }}
                >
                  <div className="hidden sm:block text-right">
                    <p className="text-[10px] font-bold uppercase tracking-widest leading-none mb-1" style={{ color: "#bbcabf" }}>
                      Área Personal
                    </p>
                    <p className="text-sm font-semibold" style={{ color: "#e5e1e4" }}>
                      {user.name?.split(" ")[0] ?? "Usuario"}
                    </p>
                  </div>

                  {/* Avatar with green dot when pack is active */}
                  <div className="relative">
                    {user.image ? (
                      <Image
                        src={user.image}
                        alt={user.name ?? "Avatar"}
                        width={36}
                        height={36}
                        className="rounded-full"
                        style={{ border: "1px solid rgba(78,222,163,0.2)", boxShadow: "0 0 0 2px rgba(78,222,163,0.1)" }}
                      />
                    ) : (
                      <div
                        className="w-9 h-9 rounded-full flex items-center justify-center text-sm font-bold"
                        style={{ background: "rgba(78,222,163,0.12)", color: "#4edea3", border: "1px solid rgba(78,222,163,0.2)" }}
                      >
                        {user.name?.[0] ?? "U"}
                      </div>
                    )}
                    {hasActivePack && (
                      <span
                        className="absolute -top-0.5 -right-0.5 w-2.5 h-2.5 rounded-full"
                        style={{ background: "#4edea3", border: "2px solid #131315" }}
                        aria-label="Pack activo"
                      />
                    )}
                  </div>

                  <span className="material-symbols-outlined transition-colors" style={{ fontSize: "18px", color: "#bbcabf" }}>
                    expand_more
                  </span>
                </div>

                {/* Desktop dropdown */}
                <div
                  className="absolute right-0 top-full pt-3 opacity-0 invisible group-hover:opacity-100 group-hover:visible transition-all duration-200"
                  style={{ zIndex: 300 }}
                >
                  <div
                    className="rounded-xl p-2"
                    style={{ width: "200px", background: "#2a2a2c", border: "1px solid rgba(255,255,255,0.08)", boxShadow: "0 20px 40px rgba(0,0,0,0.4)" }}
                  >
                    {/* Pack credits (if active) */}
                    {hasActivePack && (
                      <>
                        <button
                          onClick={handlePackClick}
                          className="flex flex-col w-full px-3 py-2.5 rounded-lg text-left transition-colors"
                          style={{ background: "rgba(78,222,163,0.06)", border: "none", cursor: "pointer", fontFamily: "inherit" }}
                          onMouseEnter={(e) => { (e.currentTarget as HTMLElement).style.background = "rgba(78,222,163,0.12)"; }}
                          onMouseLeave={(e) => { (e.currentTarget as HTMLElement).style.background = "rgba(78,222,163,0.06)"; }}
                        >
                          <span className="text-[10px] font-bold uppercase tracking-widest" style={{ color: "#4edea3" }}>
                            Pack {packSession!.packSize}h activo
                          </span>
                          <span className="text-xs mt-0.5" style={{ color: "#bbcabf" }}>
                            {packSession!.credits} clase{packSession!.credits !== 1 ? "s" : ""} disponible{packSession!.credits !== 1 ? "s" : ""}
                          </span>
                        </button>
                        <hr style={{ borderColor: "rgba(60,74,66,0.3)", margin: "6px 0" }} />
                      </>
                    )}

                    <a
                      className="flex items-center gap-3 px-3 py-2 text-sm rounded-lg transition-colors"
                      href="#sessions"
                      style={{ color: "#bbcabf" }}
                      onMouseEnter={(e) => { (e.currentTarget as HTMLElement).style.background = "#353437"; (e.currentTarget as HTMLElement).style.color = "#e5e1e4"; }}
                      onMouseLeave={(e) => { (e.currentTarget as HTMLElement).style.background = "transparent"; (e.currentTarget as HTMLElement).style.color = "#bbcabf"; }}
                    >
                      <span className="material-symbols-outlined" style={{ fontSize: "18px" }}>dashboard</span>
                      Área personal
                    </a>
                    <hr style={{ borderColor: "rgba(60,74,66,0.3)", margin: "6px 0" }} />
                    <button
                      onClick={() => signOut()}
                      className="flex items-center gap-3 w-full px-3 py-2 text-sm rounded-lg text-left transition-colors"
                      style={{ color: "#ffb4ab", background: "none", border: "none", cursor: "pointer", fontFamily: "inherit" }}
                      onMouseEnter={(e) => { (e.currentTarget as HTMLElement).style.background = "rgba(255,180,171,0.08)"; }}
                      onMouseLeave={(e) => { (e.currentTarget as HTMLElement).style.background = "transparent"; }}
                    >
                      <span className="material-symbols-outlined" style={{ fontSize: "18px" }}>logout</span>
                      Cerrar sesión
                    </button>
                  </div>
                </div>
              </div>
            ) : (
              <button
                onClick={() => signIn("google")}
                className="hidden sm:flex items-center gap-2 px-4 py-2 rounded-lg text-sm font-semibold transition-colors"
                style={{ border: "1px solid rgba(60,74,66,0.5)", background: "transparent", color: "#e5e1e4" }}
                onMouseEnter={(e) => ((e.currentTarget as HTMLElement).style.background = "#353437")}
                onMouseLeave={(e) => ((e.currentTarget as HTMLElement).style.background = "transparent")}
              >
                <svg className="w-4 h-4" viewBox="0 0 24 24" aria-hidden="true">
                  <path d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92c-.26 1.37-1.04 2.53-2.21 3.31v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.09z" fill="#4285F4" />
                  <path d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z" fill="#34A853" />
                  <path d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.07H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.93l3.66-2.84z" fill="#FBBC05" />
                  <path d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.07l3.66 2.84c.87-2.6 3.3-4.53 6.16-4.53z" fill="#EA4335" />
                </svg>
                <span>Iniciar sesión</span>
              </button>
            )
          )}

          {/* ── Hamburger button (sm and below) ── */}
          <button
            className="sm:hidden flex items-center justify-center w-10 h-10 rounded-lg transition-colors"
            style={{ background: mobileOpen ? "rgba(78,222,163,0.08)" : "transparent", border: "none", cursor: "pointer", color: "#e5e1e4" }}
            onClick={() => setMobileOpen((prev) => !prev)}
            aria-label={mobileOpen ? "Cerrar menú" : "Abrir menú"}
            aria-expanded={mobileOpen}
          >
            <span className="material-symbols-outlined" style={{ fontSize: "24px" }}>
              {mobileOpen ? "close" : "menu"}
            </span>
          </button>
        </div>
      </div>

      {/* ── Mobile panel ── */}
      {mobileOpen && (
        <div
          className="sm:hidden"
          style={{
            background: "rgba(19,19,21,0.97)",
            backdropFilter: "blur(20px)",
            borderTop: "1px solid rgba(255,255,255,0.05)",
            paddingBottom: "24px",
          }}
        >
          {isLoaded && isSignedIn && user ? (
            <>
              {/* User info */}
              <div className="flex items-center gap-3 px-6 py-5">
                {user.image ? (
                  <Image
                    src={user.image}
                    alt={user.name ?? "Avatar"}
                    width={40}
                    height={40}
                    className="rounded-full flex-shrink-0"
                    style={{ border: "1px solid rgba(78,222,163,0.3)" }}
                  />
                ) : (
                  <div
                    className="w-10 h-10 rounded-full flex items-center justify-center text-sm font-bold flex-shrink-0"
                    style={{ background: "rgba(78,222,163,0.12)", color: "#4edea3", border: "1px solid rgba(78,222,163,0.2)" }}
                  >
                    {user.name?.[0] ?? "U"}
                  </div>
                )}
                <div>
                  <p className="text-sm font-semibold" style={{ color: "#e5e1e4" }}>{user.name ?? "Usuario"}</p>
                  <p className="text-xs" style={{ color: "#86948a" }}>{user.email}</p>
                </div>
              </div>

              {/* Pack credits (if active) */}
              {hasActivePack && (
                <div className="px-4 pb-3">
                  <button
                    onClick={handlePackClick}
                    className="flex items-center justify-between w-full px-4 py-3 rounded-xl text-left transition-colors"
                    style={{ background: "rgba(78,222,163,0.08)", border: "1px solid rgba(78,222,163,0.15)", cursor: "pointer", fontFamily: "inherit" }}
                    onMouseEnter={(e) => { (e.currentTarget as HTMLElement).style.background = "rgba(78,222,163,0.14)"; }}
                    onMouseLeave={(e) => { (e.currentTarget as HTMLElement).style.background = "rgba(78,222,163,0.08)"; }}
                  >
                    <div>
                      <p className="text-[10px] font-bold uppercase tracking-widest" style={{ color: "#4edea3" }}>
                        Pack {packSession!.packSize}h activo
                      </p>
                      <p className="text-sm font-medium mt-0.5" style={{ color: "#e5e1e4" }}>
                        {packSession!.credits} clase{packSession!.credits !== 1 ? "s" : ""} disponible{packSession!.credits !== 1 ? "s" : ""}
                      </p>
                    </div>
                    <span className="material-symbols-outlined" style={{ fontSize: "20px", color: "#4edea3" }}>
                      calendar_month
                    </span>
                  </button>
                </div>
              )}

              <hr style={{ borderColor: "rgba(255,255,255,0.05)", margin: "0 0 8px" }} />

              {/* Nav links */}
              <nav className="px-2">
                <a
                  href="#sessions"
                  onClick={() => setMobileOpen(false)}
                  className="flex items-center gap-3 px-4 py-3 rounded-lg text-sm font-semibold transition-colors"
                  style={{ color: "#bbcabf", fontFamily: "var(--font-headline, Manrope), sans-serif", textDecoration: "none" }}
                  onMouseEnter={(e) => { (e.currentTarget as HTMLElement).style.background = "#1c1b1d"; }}
                  onMouseLeave={(e) => { (e.currentTarget as HTMLElement).style.background = "transparent"; }}
                >
                  <span className="material-symbols-outlined" style={{ fontSize: "18px" }}>dashboard</span>
                  Área Personal
                </a>

                <hr style={{ borderColor: "rgba(255,255,255,0.05)", margin: "4px 0" }} />

                {NAV_LINKS.map(({ label, href, accent }) => (
                  <Link
                    key={label}
                    href={href}
                    onClick={() => setMobileOpen(false)}
                    className="flex items-center px-4 py-3 rounded-lg text-sm font-semibold transition-colors"
                    style={{ color: accent ? "#4edea3" : "#bbcabf", fontFamily: "var(--font-headline, Manrope), sans-serif" }}
                    onMouseEnter={(e) => { (e.currentTarget as HTMLElement).style.background = "#1c1b1d"; }}
                    onMouseLeave={(e) => { (e.currentTarget as HTMLElement).style.background = "transparent"; }}
                  >
                    {label}
                  </Link>
                ))}
              </nav>

              <hr style={{ borderColor: "rgba(255,255,255,0.05)", margin: "8px 0" }} />

              {/* Sign out */}
              <div className="px-2">
                <button
                  onClick={() => { setMobileOpen(false); signOut(); }}
                  className="flex items-center gap-3 w-full px-4 py-3 rounded-lg text-sm text-left transition-colors"
                  style={{ color: "#ffb4ab", background: "none", border: "none", cursor: "pointer", fontFamily: "inherit" }}
                  onMouseEnter={(e) => { (e.currentTarget as HTMLElement).style.background = "rgba(255,180,171,0.08)"; }}
                  onMouseLeave={(e) => { (e.currentTarget as HTMLElement).style.background = "transparent"; }}
                >
                  <span className="material-symbols-outlined" style={{ fontSize: "18px" }}>logout</span>
                  Cerrar sesión
                </button>
              </div>
            </>
          ) : (
            <>
              {/* Nav links */}
              <nav className="px-2 pt-2">
                {NAV_LINKS.map(({ label, href, accent }) => (
                  <Link
                    key={label}
                    href={href}
                    onClick={() => setMobileOpen(false)}
                    className="flex items-center px-4 py-3 rounded-lg text-sm font-semibold transition-colors"
                    style={{ color: accent ? "#4edea3" : "#bbcabf", fontFamily: "var(--font-headline, Manrope), sans-serif" }}
                    onMouseEnter={(e) => { (e.currentTarget as HTMLElement).style.background = "#1c1b1d"; }}
                    onMouseLeave={(e) => { (e.currentTarget as HTMLElement).style.background = "transparent"; }}
                  >
                    {label}
                  </Link>
                ))}
              </nav>

              <hr style={{ borderColor: "rgba(255,255,255,0.05)", margin: "8px 0" }} />

              {/* Sign in */}
              <div className="px-4">
                <button
                  onClick={() => { setMobileOpen(false); signIn("google"); }}
                  className="flex items-center justify-center gap-2 w-full px-4 py-3 rounded-lg text-sm font-semibold transition-colors"
                  style={{ border: "1px solid rgba(60,74,66,0.5)", background: "transparent", color: "#e5e1e4", cursor: "pointer", fontFamily: "inherit" }}
                  onMouseEnter={(e) => ((e.currentTarget as HTMLElement).style.background = "#353437")}
                  onMouseLeave={(e) => ((e.currentTarget as HTMLElement).style.background = "transparent")}
                >
                  <svg className="w-4 h-4" viewBox="0 0 24 24" aria-hidden="true">
                    <path d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92c-.26 1.37-1.04 2.53-2.21 3.31v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.09z" fill="#4285F4" />
                    <path d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z" fill="#34A853" />
                    <path d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.07H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.93l3.66-2.84z" fill="#FBBC05" />
                    <path d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.07l3.66 2.84c.87-2.6 3.3-4.53 6.16-4.53z" fill="#EA4335" />
                  </svg>
                  Iniciar sesión con Google
                </button>
              </div>
            </>
          )}
        </div>
      )}
    </nav>
  );
}
