"use client";

/**
 * BookingExitButton — «✕ Salir de la reserva» («Cerrar» once there is nothing left to abandon).
 *
 * BOOKING-STEPS-01: the button `BookingLayout` used to draw as its own row on every booking
 * screen, now shared by the three places that show it:
 *
 *   - the wizard's `WizardProgress`, left of the steps (`compact`: icon-only below sm, the label
 *     stays its accessible name);
 *   - the pack screen's `BookingSidebar` footer, below the sidebar card;
 *   - `BookingLayout`'s `onExit`, now only on the wizard's success and error screens, which have
 *     no step indicator.
 *
 * ✕ (leave the flow) is kept apart from the ← of «Volver atrás» (previous step). Styled like the
 * calendar's week buttons: a secondary control that is easy to find and never competes with the
 * step's primary action.
 */

import { useTranslations } from "next-intl";

interface BookingExitButtonProps {
  onClick:   () => void;
  /** True while a booking request or payment is in flight — leaving would hide its outcome. */
  disabled?: boolean;
  /** «Salir de la reserva» while booking; «Cerrar» once there is nothing left to abandon. */
  variant?:  "exit" | "close";
  /** Icon-only below sm (the label stays the accessible name). */
  compact?:  boolean;
  className?: string;
}

export default function BookingExitButton({
  onClick,
  disabled = false,
  variant = "exit",
  compact = false,
  className = "",
}: BookingExitButtonProps) {
  const t = useTranslations("booking.layout");
  const label = variant === "close" ? t("close") : t("exit");

  return (
    <button
      type="button"
      onClick={onClick}
      disabled={disabled}
      aria-label={compact ? label : undefined}
      className={`inline-flex items-center gap-2 shrink-0 whitespace-nowrap rounded-lg text-sm font-semibold transition-colors bg-[#201f22] border border-[#3c4a42] text-[#bbcabf] enabled:hover:bg-[#2a2a2c] enabled:hover:text-[#e5e1e4] disabled:opacity-50 disabled:cursor-not-allowed ${
        // compact: a 36px square on a phone, the size of WizardProgress's step circles there
        compact ? "h-9 w-9 justify-center sm:h-10 sm:w-auto sm:pl-3 sm:pr-4" : "h-10 pl-3 pr-4"
      } ${className}`}
    >
      <span className="material-symbols-outlined" style={{ fontSize: 18 }} aria-hidden="true">
        close
      </span>
      <span className={compact ? "hidden sm:inline" : undefined}>{label}</span>
    </button>
  );
}
