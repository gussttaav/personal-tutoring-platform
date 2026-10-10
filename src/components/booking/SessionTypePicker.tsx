"use client";

/**
 * SessionTypePicker — switch a single session's length without leaving the booking.
 *
 * BOOKING-EXIT-01: the only way to change from, say, a 1-hour to a 2-hour session used to be
 * «Cambiar tipo de sesión», which CLOSED the wizard (and off `/mentoria` navigated there) so
 * the visitor could pick another card and start over. The wizard's sidebar now holds the three
 * types itself, in the slot of the static session card:
 *
 *   - lg+  stacked rows (name over duration · price; the icon from xl, where the sidebar is
 *          wide enough for it), the selected one in emerald;
 *   - <lg  a three-segment control in the compact strip (duration + price; the name stays in
 *          the accessible name), so the phone layout spends no extra height on it.
 *
 * Native radios sharing one `name`: arrow keys, focus and the screen-reader "1 of 3" come for
 * free. The icons are the personal area's booking panel's (`BookSessionsPanel`), so a type
 * looks the same wherever it is chosen. All three types are always offered, as on Mentoría and
 * the personal area — the server enforces the one-free-call cap and the wizard's error screen
 * explains it.
 */

import { useId } from "react";
import { useTranslations } from "next-intl";
import { useSessionPriceLabel } from "@/components/pricing/PricesProvider";
import type { SingleSessionType } from "@/components/SingleSessionBooking";

const OPTIONS: ReadonlyArray<{ type: SingleSessionType; icon: string }> = [
  { type: "free15min", icon: "chat_bubble" },
  { type: "session1h", icon: "timer"       },
  { type: "session2h", icon: "timelapse"   },
];

interface SessionTypePickerProps {
  value:     SingleSessionType;
  onChange:  (type: SingleSessionType) => void;
  /** While availability is being verified or a booking is in flight. */
  disabled?: boolean;
}

export default function SessionTypePicker({ value, onChange, disabled = false }: SessionTypePickerProps) {
  const t       = useTranslations("booking.sidebar");
  const groupId = useId();

  return (
    <div>
      <p
        id={groupId}
        className="text-xs font-label uppercase tracking-widest mb-2 lg:mb-3"
        style={{ color: "#bbcabf" }}
      >
        {t("sessionType")}
      </p>
      <div role="radiogroup" aria-labelledby={groupId} className="grid grid-cols-3 gap-2 lg:grid-cols-1 lg:gap-3">
        {OPTIONS.map(({ type, icon }) => (
          <SessionOption
            key={type}
            name={groupId}
            type={type}
            icon={icon}
            checked={type === value}
            disabled={disabled}
            onSelect={onChange}
          />
        ))}
      </div>
    </div>
  );
}

function SessionOption({
  name, type, icon, checked, disabled, onSelect,
}: {
  name:     string;
  type:     SingleSessionType;
  icon:     string;
  checked:  boolean;
  disabled: boolean;
  onSelect: (type: SingleSessionType) => void;
}) {
  const tMV    = useTranslations("booking.modeView");
  const t      = useTranslations("booking.sidebar");
  // Live price (null for the free call, which reads as «Sin coste» like the sidebar does).
  const price  = useSessionPriceLabel(type) ?? t("free");

  return (
    <label
      className={[
        "flex flex-col lg:flex-row items-center gap-1 lg:gap-3 px-1 py-2.5 lg:p-3 rounded-lg border text-center lg:text-left transition-colors",
        "has-[:focus-visible]:outline has-[:focus-visible]:outline-2 has-[:focus-visible]:outline-offset-2 has-[:focus-visible]:outline-[#4edea3]",
        checked
          ? "bg-[rgba(78,222,163,0.08)] border-[rgba(78,222,163,0.45)]"
          : "bg-[#201f22] border-[rgba(255,255,255,0.06)]",
        disabled
          ? "cursor-not-allowed opacity-60"
          : checked ? "cursor-default" : "cursor-pointer hover:border-[#3c4a42] hover:bg-[#2a2a2c]",
      ].join(" ")}
    >
      <input
        type="radio"
        name={name}
        value={type}
        checked={checked}
        disabled={disabled}
        onChange={() => onSelect(type)}
        className="sr-only"
      />

      <span
        className="hidden xl:flex w-10 h-10 rounded-lg items-center justify-center shrink-0"
        style={checked
          ? { background: "rgba(78,222,163,0.12)", color: "#4edea3" }
          : { background: "#2a2a2c", color: "#86948a" }}
        aria-hidden="true"
      >
        <span className="material-symbols-outlined" style={{ fontSize: 20 }}>{icon}</span>
      </span>

      <span className="flex-1 min-w-0 w-full flex flex-col items-center lg:items-stretch gap-1 lg:gap-0.5">
        <span className="sr-only lg:not-sr-only font-headline text-sm leading-tight" style={{ color: "#e5e1e4" }}>
          {tMV(`sessions.${type}.label`)}
        </span>
        {/* Duration + price: stacked in a phone segment; one line on desktop, wrapping the
            price under the duration where the sidebar is narrow (lg at 1024px). */}
        <span className="flex flex-col lg:flex-row lg:flex-wrap items-center lg:items-baseline lg:justify-between gap-1 lg:gap-x-2 lg:gap-y-0.5">
          <span
            className="text-[13px] font-semibold lg:font-normal lg:text-xs leading-tight whitespace-nowrap"
            style={{ color: checked ? "#e5e1e4" : "#bbcabf" }}
          >
            {tMV(`sessions.${type}.duration`)}
          </span>
          <span
            className="font-headline text-xs lg:text-sm leading-tight whitespace-nowrap"
            style={{ color: checked ? "#4edea3" : "#86948a", letterSpacing: "-0.01em" }}
          >
            {price}
          </span>
        </span>
      </span>
    </label>
  );
}
