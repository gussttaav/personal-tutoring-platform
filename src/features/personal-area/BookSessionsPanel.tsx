"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { useTranslations } from "next-intl";
import { usePrices } from "@/components/pricing/PricesProvider";
import type { UserSession } from "@/domain/types";

interface BookSessionsPanelProps {
  hasActivePack: boolean;
  packSession:   UserSession | null;
}

// Icons are non-translatable; text comes from the dictionary.
const SESSION_KEYS = [
  { key: "free15min", icon: "chat_bubble" },
  { key: "session1h", icon: "timer"        },
  { key: "session2h", icon: "history"      },
] as const;

const PACK_KEYS = [
  { key: "pack5",  icon: "inventory_2" },
  { key: "pack10", icon: "inventory_2" },
] as const;

export default function BookSessionsPanel({ hasActivePack, packSession }: BookSessionsPanelProps) {
  const t = useTranslations("areaPersonal.bookPanel");
  const router = useRouter();
  const prices = usePrices();

  return (
    <div
      style={{
        background:   "#1c1b1d",
        borderRadius: 16,
        padding:      20,
        border:       "1px solid rgba(255,255,255,0.06)",
      }}
    >
      <h3 style={{
        fontFamily:    "var(--font-headline, Manrope), sans-serif",
        fontSize:      16,
        fontWeight:    700,
        color:         "#e5e1e4",
        letterSpacing: "-0.01em",
        margin:        "0 0 16px",
      }}>
        {t("title")}
      </h3>

      {/* Pack sessions CTA — only shown if user has active pack */}
      {hasActivePack && packSession && (
        <div style={{ marginBottom: 16 }}>
          <button
            onClick={() => router.push("/?book=pack")}
            style={{
              display:        "flex",
              alignItems:     "center",
              justifyContent: "space-between",
              width:          "100%",
              padding:        "12px 14px",
              background:     "rgba(78,222,163,0.08)",
              border:         "1px solid rgba(78,222,163,0.18)",
              borderRadius:   10,
              cursor:         "pointer",
              fontFamily:     "inherit",
              textAlign:      "left",
              transition:     "background 0.12s",
            }}
            onMouseEnter={(e) => { (e.currentTarget as HTMLElement).style.background = "rgba(78,222,163,0.14)"; }}
            onMouseLeave={(e) => { (e.currentTarget as HTMLElement).style.background = "rgba(78,222,163,0.08)"; }}
          >
            <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
              <div style={{
                width:          32,
                height:         32,
                borderRadius:   8,
                background:     "rgba(78,222,163,0.12)",
                border:         "1px solid rgba(78,222,163,0.2)",
                display:        "flex",
                alignItems:     "center",
                justifyContent: "center",
                flexShrink:     0,
              }}>
                <span className="material-symbols-outlined" style={{ fontSize: 16, color: "#4edea3", fontVariationSettings: "'FILL' 1" }}>
                  calendar_add_on
                </span>
              </div>
              <div>
                <p style={{ fontSize: 12, fontWeight: 700, color: "#4edea3", margin: 0 }}>
                  {t("usePackCredit")}
                </p>
                <p style={{ fontSize: 10, color: "#86948a", margin: "1px 0 0" }}>
                  {t("packCredits", { count: packSession.credits })}
                </p>
              </div>
            </div>
            <span className="material-symbols-outlined" style={{ fontSize: 18, color: "#4edea3" }}>
              chevron_right
            </span>
          </button>

          <div style={{ height: 1, background: "rgba(255,255,255,0.05)", margin: "16px 0 14px" }} />
        </div>
      )}

      {/* Single sessions */}
      <p style={{
        fontSize:      9,
        fontWeight:    700,
        textTransform: "uppercase",
        letterSpacing: "0.1em",
        color:         "#4edea3",
        margin:        "0 0 8px",
      }}>
        {t("singleSessionsLabel")}
      </p>
      <div style={{ display: "flex", flexDirection: "column", gap: 6, marginBottom: 16 }}>
        {SESSION_KEYS.map(({ key, icon }) => (
          <SessionRow
            key={key}
            icon={icon}
            label={t(`sessions.${key}.label` as Parameters<typeof t>[0])}
            sub={t(`sessions.${key}.sub` as Parameters<typeof t>[0])}
            // free15min is free (kept in i18n); paid sessions read the live price.
            price={key === "free15min" ? t("sessions.free15min.price") : prices[key].price}
            onClick={() => router.push(`/?book=${key}`)}
          />
        ))}
      </div>

      {/* Pack purchase */}
      <div style={{ height: 1, background: "rgba(255,255,255,0.05)", margin: "0 0 14px" }} />
      <p style={{
        fontSize:      9,
        fontWeight:    700,
        textTransform: "uppercase",
        letterSpacing: "0.1em",
        color:         "#4edea3",
        margin:        "0 0 8px",
      }}>
        {t("packsLabel")}
      </p>
      <div style={{ display: "flex", flexDirection: "column", gap: 6 }}>
        {PACK_KEYS.map(({ key, icon }) => {
          const p = prices[key];
          // Savings copy is computed from the live price; empty when no discount.
          const sub = p.savingsAmount && p.savingsPct !== null
            ? t("packs.sub", { amount: p.savingsAmount, pct: p.savingsPct })
            : "";
          return (
            <SessionRow
              key={key}
              icon={icon}
              label={t(`packs.${key}.label` as Parameters<typeof t>[0])}
              sub={sub}
              price={p.price}
              onClick={() => router.push(`/?book=${key}`)}
            />
          );
        })}
      </div>
    </div>
  );
}

function SessionRow({
  icon, label, sub, price, onClick,
}: { icon: string; label: string; sub: string; price: string; onClick: () => void }) {
  const [hovered, setHovered] = useState(false);
  return (
    <button
      onClick={onClick}
      onMouseEnter={() => setHovered(true)}
      onMouseLeave={() => setHovered(false)}
      style={{
        display:        "flex",
        alignItems:     "center",
        justifyContent: "space-between",
        width:          "100%",
        padding:        "10px 12px",
        background:     hovered ? "rgba(78,222,163,0.05)" : "#111113",
        border:         `1px solid ${hovered ? "rgba(78,222,163,0.2)" : "rgba(255,255,255,0.04)"}`,
        borderRadius:   10,
        cursor:         "pointer",
        fontFamily:     "inherit",
        textAlign:      "left",
        transition:     "background 0.12s, border-color 0.12s",
      }}
    >
      <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
        <div style={{
          width:          28,
          height:         28,
          borderRadius:   7,
          background:     "rgba(78,222,163,0.08)",
          border:         "1px solid rgba(78,222,163,0.12)",
          display:        "flex",
          alignItems:     "center",
          justifyContent: "center",
          flexShrink:     0,
        }}>
          <span className="material-symbols-outlined" style={{ fontSize: 14, color: "#4edea3" }}>
            {icon}
          </span>
        </div>
        <div>
          <p style={{ fontSize: 12, fontWeight: 700, color: "#e5e1e4", margin: 0 }}>{label}</p>
          <p style={{ fontSize: 10, color: "#86948a", margin: "1px 0 0" }}>{sub}</p>
        </div>
      </div>
      <span style={{ fontSize: 12, fontWeight: 700, color: "#4edea3", flexShrink: 0 }}>
        {price}
      </span>
    </button>
  );
}
