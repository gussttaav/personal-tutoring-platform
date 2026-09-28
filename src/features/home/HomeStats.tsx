"use client";

/*
 * REDESIGN-P1-01 — the four hero stats on the home (/).
 *
 * The `statCards` array and the grid, moved from `HeroSection.tsx` unchanged: same values, same
 * popover copy (`landing.hero.stats.*`), same Classgap / LinkedIn links. This is the hero's only
 * client island — `StatCard` holds the popover state — so `HomeHero`'s HTML stays static.
 * The 2 → 4 column switch at 1024 is `.home-stats` in `home.css`.
 */

import { useTranslations } from "next-intl";
import { StatCard } from "@/features/landing/StatCard";

export default function HomeStats() {
  const t = useTranslations("landing.hero");

  const statCards = [
    {
      value: "15+",
      label: t("stats.experience.label"),
      modalTitle: t("stats.experience.title"),
      modalBody: t("stats.experience.body"),
      modalLinkLabel: t("stats.experience.link"),
      modalLinkHref: "https://www.linkedin.com/in/gustavo-torres-guerrero",
    },
    {
      value: "4700+",
      label: t("stats.classes.label"),
      modalTitle: t("stats.classes.title"),
      modalBody: t("stats.classes.body"),
      modalLinkLabel: t("stats.classes.link"),
      modalLinkHref: "https://www.classgap.com/es/tutor/gustavo-torres-guerrero",
      modalSide: "right" as const,
    },
    {
      value: "150+",
      label: t("stats.ratings.label"),
      modalTitle: t("stats.ratings.title"),
      modalBody: t("stats.ratings.body"),
      modalLinkLabel: t("stats.ratings.link"),
      modalLinkHref: "https://www.classgap.com/es/tutor/gustavo-torres-guerrero",
    },
    {
      value: "4.9",
      label: t("stats.avg.label"),
      modalTitle: t("stats.avg.title"),
      modalBody: t("stats.avg.body"),
      modalLinkLabel: t("stats.avg.link"),
      modalLinkHref: "https://www.classgap.com/es/tutor/gustavo-torres-guerrero",
      modalSide: "right" as const,
    },
  ];

  return (
    <div
      className="home-stats"
      style={{
        gap: "32px",
        paddingTop: "32px",
        marginTop: "52px",
        borderTop: "1px solid rgba(255,255,255,0.05)",
        width: "100%",
      }}
    >
      {statCards.map((card) => (
        <StatCard key={card.value + card.label} {...card} />
      ))}
    </div>
  );
}
