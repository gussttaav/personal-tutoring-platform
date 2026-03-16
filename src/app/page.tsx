"use client";

import { useState, useEffect, Suspense } from "react";
import type React from "react";
import Image from "next/image";
import { useUserSession } from "@/hooks/useUserSession";
import PackModal from "@/components/PackModal";
import BookingModeView from "@/components/BookingModeView";
import SignInGate from "@/components/SignInGate";
import SingleSessionBooking from "@/components/SingleSessionBooking";
import AuthCorner from "@/components/AuthCorner";
import Chat from "@/components/Chat";
import { Spinner, CreditsPill } from "@/components/ui";
import { COLORS, PACK_CONFIG, PACK_SIZES, CAL_EVENTS } from "@/constants";
import { SKILL_ITEMS as SKILL_ITEMS_DATA } from "@/constants/skills";
import type { PackSize, StudentInfo } from "@/types";
import type { SingleSessionType } from "@/components/SingleSessionBooking";

// ─── SVG icon components ──────────────────────────────────────────────────────

function ProgrammingIcon({ size = 16 }: { size?: number }) {
  return (
    <svg
      width={size}
      height={size}
      viewBox="0 0 94.504 94.504"
      fill="currentColor"
      aria-hidden="true"
    >
      <path d="M93.918,45.833L69.799,21.714c-0.75-0.75-2.077-0.75-2.827,0l-5.229,5.229c-0.781,0.781-0.781,2.047,0,2.828l17.477,17.475L61.744,64.724c-0.781,0.781-0.781,2.047,0,2.828l5.229,5.229c0.375,0.375,0.884,0.587,1.414,0.587c0.529,0,1.039-0.212,1.414-0.587l24.117-24.118C94.699,47.881,94.699,46.614,93.918,45.833z" />
      <path d="M32.759,64.724L15.285,47.248l17.477-17.475c0.375-0.375,0.586-0.883,0.586-1.414c0-0.53-0.21-1.039-0.586-1.414l-5.229-5.229c-0.375-0.375-0.884-0.586-1.414-0.586c-0.53,0-1.039,0.211-1.414,0.586L0.585,45.833c-0.781,0.781-0.781,2.047,0,2.829L24.704,72.78c0.375,0.375,0.884,0.587,1.414,0.587c0.53,0,1.039-0.212,1.414-0.587l5.229-5.229C33.542,66.771,33.542,65.505,32.759,64.724z" />
      <path d="M60.967,13.6c-0.254-0.466-0.682-0.812-1.19-0.962l-4.239-1.251c-1.058-0.314-2.172,0.293-2.484,1.352L33.375,79.382c-0.15,0.509-0.092,1.056,0.161,1.521c0.253,0.467,0.682,0.812,1.19,0.963l4.239,1.251c0.189,0.056,0.38,0.083,0.567,0.083c0.863,0,1.66-0.564,1.917-1.435l19.679-66.644C61.278,14.612,61.221,14.065,60.967,13.6z" />
    </svg>
  );
}

function SpringBootIcon({ size = 16 }: { size?: number }) {
  return (
    <svg
      width={size}
      height={size}
      viewBox="0 0 24 24"
      fill="currentColor"
      aria-hidden="true"
    >
      <path d="M20.205 16.392c-2.469 3.289-7.741 2.179-11.122 2.338 0 0-.599.034-1.201.133 0 0 .228-.097.519-.198 2.374-.821 3.496-.986 4.939-1.727 2.71-1.388 5.408-4.413 5.957-7.555-1.032 3.022-4.17 5.623-7.027 6.679-1.955.722-5.492 1.424-5.493 1.424a5.28 5.28 0 0 1-.143-.076c-2.405-1.17-2.475-6.38 1.894-8.059 1.916-.736 3.747-.332 5.818-.825 2.208-.525 4.766-2.18 5.805-4.344 1.165 3.458 2.565 8.866.054 12.21zm.042-13.28a9.212 9.212 0 0 1-1.065 1.89 9.982 9.982 0 0 0-7.167-3.031C6.492 1.971 2 6.463 2 11.985a9.983 9.983 0 0 0 3.205 7.334l.22.194a.856.856 0 1 1 .001.001l.149.132A9.96 9.96 0 0 0 12.015 22c5.278 0 9.613-4.108 9.984-9.292.274-2.539-.476-5.763-1.752-9.596" />
    </svg>
  );
}

// ─── Sub-components ───────────────────────────────────────────────────────────

/** Single session card for the "Reserva una sesión" section */
interface SessionCardProps {
  badge?: string;
  name: string;
  duration: string;
  price: string;
  isFree?: boolean;
  featured?: boolean;
  onClick: () => void;
}

function SessionCard({
  badge,
  name,
  duration,
  price,
  isFree = false,
  featured = false,
  onClick,
}: SessionCardProps) {
  return (
    <button
      onClick={onClick}
      className="session-card w-full text-left"
      data-featured={featured || undefined}
      style={{
        display: "flex",
        alignItems: "center",
        justifyContent: "space-between",
        padding: "18px 20px",
        background: featured ? "rgba(61,220,132,0.06)" : "var(--surface)",
        border: featured
          ? "1px solid rgba(61,220,132,0.25)"
          : "1px solid var(--border)",
        borderRadius: "var(--radius)",
        marginBottom: 10,
        cursor: "pointer",
        transition: "border-color 0.2s, background 0.2s",
      }}
      onMouseEnter={(e) => {
        (e.currentTarget as HTMLElement).style.borderColor = featured
          ? "rgba(61,220,132,0.5)"
          : "rgba(255,255,255,0.15)";
      }}
      onMouseLeave={(e) => {
        (e.currentTarget as HTMLElement).style.borderColor = featured
          ? "rgba(61,220,132,0.25)"
          : "var(--border)";
      }}
    >
      <div style={{ minWidth: 0 }}>
        {badge && (
          <span
            style={{
              display: "inline-block",
              padding: "2px 8px",
              borderRadius: 100,
              fontSize: 11,
              fontWeight: 500,
              marginBottom: 5,
              background: featured
                ? "rgba(61,220,132,0.2)"
                : "rgba(255,255,255,0.06)",
              color: featured ? "var(--green)" : "var(--text-muted)",
              border: featured
                ? "1px solid rgba(61,220,132,0.3)"
                : "1px solid var(--border)",
            }}
          >
            {badge}
          </span>
        )}
        <div
          style={{
            fontSize: 15,
            fontWeight: 500,
            color: "var(--text)",
            marginBottom: 2,
          }}
        >
          {name}
        </div>
        <div style={{ fontSize: 13, color: "var(--text-muted)" }}>
          {duration}
        </div>
      </div>
      <div
        style={{
          display: "flex",
          flexDirection: "column",
          alignItems: "flex-end",
          gap: 4,
          flexShrink: 0,
          marginLeft: 16,
        }}
      >
        <span
          style={{
            fontSize: 16,
            fontWeight: 500,
            color: isFree ? "var(--green)" : "var(--text)",
          }}
        >
          {price}
        </span>
        <span style={{ fontSize: 18, color: "var(--text-muted)" }}>→</span>
      </div>
    </button>
  );
}

/** Pack card for "Packs de horas" section — shows buy or schedule depending on credits */
interface PackCardProps {
  size: PackSize;
  /** null = no active pack for this size; number = credits remaining */
  activeCredits: number | null;
  /** true while the credits check is in progress — shows default buy state */
  creditsLoading: boolean;
  onBuy: (size: PackSize) => void;
  onSchedule: () => void;
}

function PackCard({ size, activeCredits, creditsLoading, onBuy, onSchedule }: PackCardProps) {
  const pack = PACK_CONFIG[size];
  const isPopular = pack.featured;
  const hasCredits = !creditsLoading && activeCredits !== null && activeCredits > 0;

  return (
    <div
      style={{
        flex: "1 1 200px",
        padding: "22px 20px",
        background: isPopular ? "rgba(61,220,132,0.06)" : "var(--surface)",
        border: isPopular
          ? "1px solid rgba(61,220,132,0.3)"
          : "1px solid var(--border)",
        borderRadius: "var(--radius)",
        display: "flex",
        flexDirection: "column",
      }}
    >
      <span
        style={{
          fontSize: 11,
          fontWeight: 500,
          color: isPopular ? "var(--green)" : "var(--text-muted)",
          marginBottom: 12,
          display: "block",
        }}
      >
        {pack.badge}
      </span>

      <div
        style={{
          fontFamily: "var(--font-serif), 'DM Serif Display', serif",
          fontSize: 34,
          color: "var(--text)",
          lineHeight: 1,
          marginBottom: 2,
        }}
      >
        {size}h
      </div>

      {/* Credits info — shows remaining classes when active, default otherwise */}
      {hasCredits ? (
        <div style={{ fontSize: 12, marginBottom: 14 }}>
          <span style={{ color: "var(--green)", fontWeight: 500 }}>
            {activeCredits} clase{activeCredits !== 1 ? "s" : ""} disponible{activeCredits !== 1 ? "s" : ""}
          </span>
          <span style={{ color: "var(--text-muted)" }}> · {pack.perClass}</span>
        </div>
      ) : (
        <div style={{ fontSize: 12, color: "var(--text-muted)", marginBottom: 14 }}>
          {size} clases · {pack.perClass}
        </div>
      )}

      <div
        style={{
          display: "flex",
          alignItems: "baseline",
          gap: 6,
          marginBottom: 4,
        }}
      >
        <span style={{ fontSize: 20, fontWeight: 500, color: "var(--text)" }}>
          {pack.price}
        </span>
        <span style={{ fontSize: 12, color: "var(--text-muted)" }}>
          pago único
        </span>
      </div>
      <div
        style={{
          fontSize: 11,
          color: "var(--green)",
          fontWeight: 500,
          marginBottom: 16,
        }}
      >
        {pack.savings}
      </div>

      <button
        onClick={() => (hasCredits ? onSchedule() : onBuy(size))}
        style={{
          display: "block",
          width: "100%",
          padding: "10px",
          borderRadius: 8,
          border: isPopular || hasCredits ? "1px solid var(--green)" : "1px solid var(--border)",
          background: isPopular || hasCredits ? "var(--green)" : "transparent",
          color: isPopular || hasCredits ? "#0d0f10" : "var(--text-muted)",
          fontFamily: "inherit",
          fontSize: 13,
          fontWeight: 500,
          cursor: "pointer",
          transition: "all 0.2s",
          marginTop: "auto",
        }}
        onMouseEnter={(e) => {
          const btn = e.currentTarget as HTMLButtonElement;
          btn.style.background = "var(--green)";
          btn.style.borderColor = "var(--green)";
          btn.style.color = "#0d0f10";
        }}
        onMouseLeave={(e) => {
          const btn = e.currentTarget as HTMLButtonElement;
          if (isPopular || hasCredits) {
            btn.style.background = "var(--green)";
            btn.style.borderColor = "var(--green)";
            btn.style.color = "#0d0f10";
          } else {
            btn.style.background = "transparent";
            btn.style.borderColor = "var(--border)";
            btn.style.color = "var(--text-muted)";
          }
        }}
      >
        {hasCredits ? `Reservar clase` : `Comprar pack · ${pack.price}`}
      </button>
    </div>
  );
}

// ─── Skill items — merge icons (defined here) with data from constants/skills ─

function getSkillIcon(index: number, size: number): React.ReactNode {
  if (index === 0) return <ProgrammingIcon size={size} />;
  if (index === 1) return <SpringBootIcon size={size} />;
  const emojis = ["📊", "🧮", "🌐", "🤖"];
  return emojis[index - 2] ?? null;
}

const SKILL_ITEMS = SKILL_ITEMS_DATA.map((item, i) => ({
  ...item,
  icon: getSkillIcon(i, 16),
}));

// ─── Landing page content ─────────────────────────────────────────────────────

function HomeContent() {
  const {
    googleUser,
    isSignedIn,
    isAuthLoading,
    packSession,
    creditsLoading,
    updateCredits,
    clearPackSession,
  } = useUserSession();

  // Per-pack-size credits: only show active credits on the card that matches
  // the user's current pack size. The other card always shows "Comprar".
  const packCreditsForSize = (size: PackSize): number | null => {
    if (
      packSession !== null &&
      packSession !== undefined &&
      packSession.credits > 0 &&
      packSession.packSize === size
    ) {
      return packSession.credits;
    }
    return null;
  };

  // What the user is trying to book (drives SignInGate label)
  const [pendingSession, setPendingSession] = useState<SingleSessionType | null>(null);
  // Active single-session booking overlay
  const [activeSession, setActiveSession] = useState<SingleSessionType | null>(null);
  // Pack booking overlay (only shown when user explicitly clicks "Reservar clase")
  const [showPackBooking, setShowPackBooking] = useState(false);
  // Pack purchase modal
  const [selectedPack, setSelectedPack] = useState<PackSize | null>(null);
  // Sign-in gate visibility
  const [signInGateLabel, setSignInGateLabel] = useState("");

  function handleCreditsReady(_student: StudentInfo) {
    setSelectedPack(null);
    // Credits refreshed automatically via useUserSession on next render
  }

  // When user clicks a session card
  function handleSessionClick(type: SingleSessionType) {
    if (!isSignedIn) {
      const labels: Record<SingleSessionType, string> = {
        free15min: "reservar el encuentro inicial gratuito",
        session1h: "reservar una sesión de 1 hora",
        session2h: "reservar una sesión de 2 horas",
      };
      setPendingSession(type);
      setSignInGateLabel(labels[type]);
      return;
    }
    setActiveSession(type);
  }

  // When user clicks a pack card buy button
  function handlePackBuy(size: PackSize) {
    if (!isSignedIn) {
      setPendingSession(null);
      setSignInGateLabel("comprar un pack de clases");
      setSelectedPack(size);
      return;
    }
    setSelectedPack(size);
  }

  // When user clicks "Reservar clase" on a pack card with active credits
  function handlePackSchedule() {
    if (!isSignedIn) {
      setSignInGateLabel("reservar una clase de tu pack");
      return;
    }
    setShowPackBooking(true);
  }

  function handleSignInGateClose() {
    setPendingSession(null);
    setSignInGateLabel("");
    setSelectedPack(null);
  }

  // Once signed in, resume any pending session — done via useEffect to
  // avoid calling setState during render
  useEffect(() => {
    if (isSignedIn && pendingSession && !activeSession) {
      setActiveSession(pendingSession);
      setPendingSession(null);
      setSignInGateLabel("");
    }
  }, [isSignedIn, pendingSession, activeSession]);

  // ── Pack booking overlay (explicit user action only) ─────────────────────────
  if (showPackBooking && packSession && googleUser?.email) {
    return (
      <main
        className="min-h-screen"
        style={{ background: COLORS.background, position: "relative", zIndex: 1 }}
      >
        <div className="md:max-w-3xl md:mx-auto md:py-8 md:px-4">
          <div
            className="relative rounded-none md:rounded-2xl overflow-hidden"
            style={{
              background: COLORS.surface,
              border: `1px solid ${COLORS.border}`,
              minHeight: "100dvh",
            }}
          >
            <div
              className="flex items-center justify-between px-4 sm:px-5 py-3 border-b"
              style={{ borderColor: COLORS.border }}
            >
              <CreditsPill credits={packSession.credits} />
              <button
                onClick={() => setShowPackBooking(false)}
                className="text-xs transition-colors"
                style={{ color: COLORS.textMuted }}
                onMouseEnter={(e) =>
                  ((e.currentTarget as HTMLElement).style.color = COLORS.textSecondary)
                }
                onMouseLeave={(e) =>
                  ((e.currentTarget as HTMLElement).style.color = COLORS.textMuted)
                }
              >
                ← Volver al inicio
              </button>
            </div>

            <BookingModeView
              student={packSession}
              calLink={CAL_EVENTS.packBooking}
              onCreditsUpdated={(remaining) => {
                updateCredits(remaining);
                if (remaining <= 0) setShowPackBooking(false);
              }}
              onExit={() => setShowPackBooking(false)}
              hideTopBar
            />
          </div>
        </div>
      </main>
    );
  }

  // ── Single session booking overlay ───────────────────────────────────────────
  if (activeSession && googleUser?.email) {
    return (
      <SingleSessionBooking
        sessionType={activeSession}
        userName={googleUser.name ?? ""}
        userEmail={googleUser.email}
        onBack={() => setActiveSession(null)}
      />
    );
  }

  // ── Normal landing ───────────────────────────────────────────────────────────
  return (
    <>
      {/* Sign-in gate modal */}
      {signInGateLabel && !isSignedIn && (
        <SignInGate
          actionLabel={signInGateLabel}
          onClose={handleSignInGateClose}
        />
      )}

      {/* Pack purchase modal */}
      {selectedPack && isSignedIn && googleUser?.email && (
        <PackModal
          packSize={selectedPack}
          userEmail={googleUser.email}
          userName={googleUser.name ?? ""}
          onClose={() => setSelectedPack(null)}
          onCreditsReady={handleCreditsReady}
        />
      )}

      {/* Landing */}
      <main style={{ position: "relative", zIndex: 1 }}>
        <div
          style={{
            maxWidth: 680,
            margin: "0 auto",
            padding: "0 24px 80px",
            position: "relative",
            zIndex: 1,
          }}
        >
          {/* ── Hero ── */}
          <section style={{ padding: "32px 0 36px" }}>
            {/* Avatar + name */}
            <div
              style={{
                display: "flex",
                alignItems: "flex-start",
                gap: 24,
                marginBottom: 28,
                animation: "fadeUp 0.6s ease both 0.05s",
              }}
            >
              <div style={{ flexShrink: 0 }}>
                <Image
                  src="/avatar.jpg"
                  alt="Gustavo Torres Guerrero"
                  width={80}
                  height={80}
                  priority
                  style={{
                    borderRadius: "50%",
                    objectFit: "cover",
                    border: "2px solid var(--border)",
                    display: "block",
                  }}
                />
              </div>

              <div style={{ flex: 1, paddingTop: 4, minWidth: 0 }}>
                <h1
                  style={{
                    fontFamily:
                      "var(--font-serif), 'DM Serif Display', serif",
                    fontSize: "clamp(24px, 5vw, 38px)",
                    lineHeight: 1.1,
                    color: "var(--text)",
                    marginBottom: 8,
                  }}
                >
                  Gustavo Torres
                  <br />
                  Guerrero
                </h1>
                <p
                  style={{
                    fontSize: "clamp(12px, 2.5vw, 14px)",
                    color: "var(--text-muted)",
                    fontWeight: 400,
                    lineHeight: 1.6,
                  }}
                >
                  Profesor de Programación, Matemáticas &amp; IA · Consultor
                  <br />
                  <span style={{ color: "var(--text-dim)", fontSize: "0.9em" }}>
                    Msc. Matemáticas y Computación
                  </span>
                </p>
              </div>
            </div>

            {/* Social proof badges */}
            <div
              style={{
                display: "flex",
                flexWrap: "wrap",
                gap: 8,
                marginBottom: 32,
                animation: "fadeUp 0.6s ease both 0.15s",
              }}
            >
              <a
                href="https://www.classgap.com/es/tutor/gustavo-torres-guerrero"
                target="_blank"
                rel="noopener noreferrer"
                style={{
                  display: "inline-flex",
                  alignItems: "center",
                  gap: 6,
                  padding: "6px 12px",
                  background: "var(--green-dim)",
                  border: "1px solid rgba(61,220,132,0.2)",
                  borderRadius: 100,
                  fontSize: 12.5,
                  fontWeight: 500,
                  color: "var(--green)",
                  textDecoration: "none",
                  transition: "background 0.2s, border-color 0.2s",
                  whiteSpace: "nowrap",
                }}
                onMouseEnter={(e) => {
                  const el = e.currentTarget as HTMLAnchorElement;
                  el.style.background = "var(--green-mid)";
                  el.style.borderColor = "rgba(61,220,132,0.4)";
                }}
                onMouseLeave={(e) => {
                  const el = e.currentTarget as HTMLAnchorElement;
                  el.style.background = "var(--green-dim)";
                  el.style.borderColor = "rgba(61,220,132,0.2)";
                }}
              >
                ⭐ 150+ valoraciones · Classgap
              </a>

              <a
                href="https://www.linkedin.com/in/gustavo-torres-guerrero"
                target="_blank"
                rel="noopener noreferrer"
                style={{
                  display: "inline-flex",
                  alignItems: "center",
                  gap: 6,
                  padding: "6px 12px",
                  background: "var(--surface)",
                  border: "1px solid var(--border)",
                  borderRadius: 100,
                  fontSize: 12.5,
                  fontWeight: 400,
                  color: "var(--text-muted)",
                  textDecoration: "none",
                  transition: "border-color 0.2s, color 0.2s",
                }}
                onMouseEnter={(e) => {
                  const el = e.currentTarget as HTMLAnchorElement;
                  el.style.borderColor = "rgba(255,255,255,0.2)";
                  el.style.color = "var(--text)";
                }}
                onMouseLeave={(e) => {
                  const el = e.currentTarget as HTMLAnchorElement;
                  el.style.borderColor = "var(--border)";
                  el.style.color = "var(--text-muted)";
                }}
              >
                <svg
                  width="13"
                  height="13"
                  viewBox="0 0 24 24"
                  fill="currentColor"
                  aria-hidden="true"
                >
                  <path d="M19 0h-14c-2.761 0-5 2.239-5 5v14c0 2.761 2.239 5 5 5h14c2.762 0 5-2.239 5-5v-14c0-2.761-2.238-5-5-5zm-11 19h-3v-11h3v11zm-1.5-12.268c-.966 0-1.75-.79-1.75-1.764s.784-1.764 1.75-1.764 1.75.79 1.75 1.764-.783 1.764-1.75 1.764zm13.5 12.268h-3v-5.604c0-3.368-4-3.113-4 0v5.604h-3v-11h3v1.765c1.396-2.586 7-2.777 7 2.476v6.759z" />
                </svg>
                LinkedIn
              </a>

              <a
                href="https://github.com/gussttaav"
                target="_blank"
                rel="noopener noreferrer"
                style={{
                  display: "inline-flex",
                  alignItems: "center",
                  gap: 6,
                  padding: "6px 12px",
                  background: "var(--surface)",
                  border: "1px solid var(--border)",
                  borderRadius: 100,
                  fontSize: 12.5,
                  fontWeight: 400,
                  color: "var(--text-muted)",
                  textDecoration: "none",
                  transition: "border-color 0.2s, color 0.2s",
                }}
                onMouseEnter={(e) => {
                  const el = e.currentTarget as HTMLAnchorElement;
                  el.style.borderColor = "rgba(255,255,255,0.2)";
                  el.style.color = "var(--text)";
                }}
                onMouseLeave={(e) => {
                  const el = e.currentTarget as HTMLAnchorElement;
                  el.style.borderColor = "var(--border)";
                  el.style.color = "var(--text-muted)";
                }}
              >
                <svg
                  width="13"
                  height="13"
                  viewBox="0 0 24 24"
                  fill="currentColor"
                  aria-hidden="true"
                >
                  <path d="M12 0c-6.626 0-12 5.373-12 12 0 5.302 3.438 9.8 8.207 11.387.599.111.793-.261.793-.577v-2.234c-3.338.726-4.033-1.416-4.033-1.416-.546-1.387-1.333-1.756-1.333-1.756-1.089-.745.083-.729.083-.729 1.205.084 1.839 1.237 1.839 1.237 1.07 1.834 2.807 1.304 3.492.997.107-.775.418-1.305.762-1.604-2.665-.305-5.467-1.334-5.467-5.931 0-1.311.469-2.381 1.236-3.221-.124-.303-.535-1.524.117-3.176 0 0 1.008-.322 3.301 1.23.957-.266 1.983-.399 3.003-.404 1.02.005 2.047.138 3.006.404 2.291-1.552 3.297-1.23 3.297-1.23.653 1.653.242 2.874.118 3.176.77.84 1.235 1.911 1.235 3.221 0 4.609-2.807 5.624-5.479 5.921.43.372.823 1.102.823 2.222v3.293c0 .319.192.694.801.576 4.765-1.589 8.199-6.086 8.199-11.386 0-6.627-5.373-12-12-12z" />
                </svg>
                GitHub
              </a>
            </div>

            {/* Bio */}
            <div
              style={{
                background: "var(--surface)",
                border: "1px solid var(--border)",
                borderRadius: "var(--radius)",
                padding: "28px",
                marginBottom: 20,
                animation: "fadeUp 0.6s ease both 0.25s",
              }}
            >
              <p
                style={{
                  fontSize: 14.5,
                  color: "var(--text-muted)",
                  marginBottom: 14,
                  lineHeight: 1.7,
                }}
              >
                Graduado en{" "}
                <strong style={{ color: "var(--text)", fontWeight: 500 }}>
                  Ciencias de la Computación
                </strong>{" "}
                y máster en{" "}
                <strong style={{ color: "var(--text)", fontWeight: 500 }}>
                  Matemáticas y Computación
                </strong>{" "}
                por la Universidad de Cantabria. Tras varios años como desarrollador de software, 
                me dediqué durante cinco años a la docencia en el ámbito universitario, antes de pasar 
                a trabajar de forma independiente combinando enseñanza y consultoría.
              </p>
              <p
                style={{
                  fontSize: 14.5,
                  color: "var(--text-muted)",
                  marginBottom: 14,
                  lineHeight: 1.7,
                }}
              >
                Desde hace más de siete años ayudo a estudiantes, desarrolladores
                y profesionales a mejorar en programación, matemáticas aplicadas
                e inteligencia artificial, tanto para superar asignaturas
                universitarias, aprender desde cero, profundizar en un determinado tema,  
                prepararse para una entrevista como para desarrollar proyectos reales.
              </p>
            </div>

            {/* Skills */}
            <div style={{ animation: "fadeUp 0.6s ease both 0.35s" }}>
              <p
                style={{
                  fontSize: 11,
                  fontWeight: 500,
                  letterSpacing: "0.1em",
                  textTransform: "uppercase",
                  color: "var(--text-dim)",
                  marginBottom: 14,
                  marginTop: 20,
                }}
              >
                Áreas de especialidad
              </p>
              <div className="skills-grid">
                {SKILL_ITEMS.map(({ icon, iconColor, label, tooltipTitle, tooltipBody }, index) => (
                  <div key={label} className="skill-item">
                    <span
                      className="skill-icon"
                      style={{ color: iconColor ?? undefined, display: "flex", alignItems: "center" }}
                    >
                      {icon}
                    </span>
                    {label}
                    <span className="skill-hint">···</span>
                    <div className={`skill-tooltip${index % 2 === 1 ? " skill-tooltip--right" : ""}`}>
                      <strong>{tooltipTitle}</strong>
                      {tooltipBody}
                    </div>
                  </div>
                ))}
              </div>
            </div>
          </section>

          {/* ── Divider ── */}
          <div
            style={{
              height: 1,
              background:
                "linear-gradient(90deg, transparent, var(--border), transparent)",
              margin: "8px 0 32px",
            }}
          />

          {/* ── Sessions ── */}
          <section style={{ animation: "fadeUp 0.6s ease both 0.45s" }}>
            <h2
              style={{
                fontFamily: "var(--font-serif), 'DM Serif Display', serif",
                fontSize: "clamp(22px, 4vw, 28px)",
                color: "var(--text)",
                marginBottom: 6,
              }}
            >
              Reserva una sesión
            </h2>
            <p
              style={{
                fontSize: 14,
                color: "var(--text-muted)",
                marginBottom: 20,
              }}
            >
              Elige el formato que mejor se adapta a lo que necesitas.
            </p>

            <SessionCard
              badge="Gratis"
              name="Encuentro inicial"
              duration="⏱ 15 minutos · Comentamos tu caso y definimos un plan"
              price="Sin coste"
              isFree
              onClick={() => handleSessionClick("free15min")}
            />
            <SessionCard
              badge="Más reservada"
              name="Sesión de 1 hora"
              duration="⏱ 60 minutos · Resolución de dudas o proyecto"
              price="€16"
              featured
              onClick={() => handleSessionClick("session1h")}
            />
            <SessionCard
              name="Sesión de 2 horas"
              duration="⏱ 120 minutos · Para temas que requieren profundidad"
              price="€30"
              onClick={() => handleSessionClick("session2h")}
            />
          </section>

          {/* ── Divider ── */}
          <div
            style={{
              height: 1,
              background:
                "linear-gradient(90deg, transparent, var(--border), transparent)",
              margin: "32px 0",
            }}
          />

          {/* ── Packs ── */}
          <section style={{ animation: "fadeUp 0.6s ease both 0.55s" }}>
            <h2
              style={{
                fontFamily: "var(--font-serif), 'DM Serif Display', serif",
                fontSize: "clamp(22px, 4vw, 28px)",
                color: "var(--text)",
                marginBottom: 6,
              }}
            >
              Packs de horas
            </h2>
            <p
              style={{
                fontSize: 14,
                color: "var(--text-muted)",
                marginBottom: 20,
              }}
            >
              Reserva por adelantado y ahorra. Válidos 6 meses desde la compra.
            </p>

            <div style={{ display: "flex", gap: 12, flexWrap: "wrap" }}>
              {PACK_SIZES.map((size) => (
                <PackCard
                  key={size}
                  size={size}
                  activeCredits={creditsLoading ? null : packCreditsForSize(size)}
                  creditsLoading={creditsLoading && isSignedIn}
                  onBuy={handlePackBuy}
                  onSchedule={handlePackSchedule}
                />
              ))}
            </div>
          </section>

          {/* ── Trust bar ── */}
          <div
            style={{
              marginTop: 40,
              padding: "20px 24px",
              background: "var(--surface)",
              border: "1px solid var(--border)",
              borderRadius: "var(--radius)",
              display: "flex",
              alignItems: "center",
              justifyContent: "center",
              gap: 20,
              flexWrap: "wrap",
              animation: "fadeUp 0.6s ease both 0.65s",
            }}
          >
            {[
              "📅 Horarios en tiempo real vía Google Calendar",
              "🔒 Pago seguro con Stripe",
              "↩️ Sin suscripciones",
            ].map((item, i, arr) => (
              <div
                key={item}
                style={{ display: "flex", alignItems: "center", gap: 20 }}
              >
                <span
                  style={{
                    display: "flex",
                    alignItems: "center",
                    gap: 6,
                    fontSize: 12.5,
                    color: "var(--text-muted)",
                  }}
                >
                  {item}
                </span>
                {i < arr.length - 1 && (
                  <div
                    aria-hidden="true"
                    style={{
                      width: 4,
                      height: 4,
                      background: "var(--text-dim)",
                      borderRadius: "50%",
                    }}
                  />
                )}
              </div>
            ))}
          </div>

          {/* ── Stripe note ── */}
          <p
            style={{
              textAlign: "center",
              fontSize: 12,
              color: "var(--text-dim)",
              marginTop: 16,
              display: "flex",
              alignItems: "center",
              justifyContent: "center",
              gap: 6,
            }}
          >
            🔐 Pagos procesados de forma segura por Stripe
          </p>
        </div>

        {/* CSS animations (scoped to landing) */}
        <style>{`
          @keyframes fadeUp {
            from { opacity: 0; transform: translateY(20px); }
            to   { opacity: 1; transform: translateY(0); }
          }
          @keyframes fadeIn {
            from { opacity: 0; }
            to   { opacity: 1; }
          }
        `}</style>
      </main>

      {/* ── Auth corner (fixed top-right) ── */}
      <AuthCorner
        user={googleUser}
        packCredits={packSession?.credits ?? null}
        packSize={packSession?.packSize ?? null}
      />

      {/* ── Chat widget (fixed bottom-right) ── */}
      <Chat />
    </>
  );
}

// ─── Export ───────────────────────────────────────────────────────────────────

export default function HomePage() {
  return (
    <Suspense
      fallback={
        <div
          className="min-h-screen flex items-center justify-center"
          style={{ background: COLORS.background, position: "relative", zIndex: 1 }}
        >
          <Spinner />
        </div>
      }
    >
      <HomeContent />
    </Suspense>
  );
}
