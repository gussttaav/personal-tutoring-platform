"use client";

import { type ReactNode, type ButtonHTMLAttributes } from "react";
import { COLORS } from "@/constants";

// ─── Spinner ──────────────────────────────────────────────────────────────────

export function Spinner({ size = 8, label = "Cargando..." }: { size?: number; label?: string }) {
  return (
    <div role="status" className="flex flex-col items-center gap-3">
      <div
        className="rounded-full border-2 border-t-transparent animate-spin"
        style={{
          width: size * 4,
          height: size * 4,
          borderColor: COLORS.brand,
          borderTopColor: "transparent",
        }}
      />
      <span className="sr-only">{label}</span>
    </div>
  );
}

// ─── Button ───────────────────────────────────────────────────────────────────

type ButtonVariant = "primary" | "secondary" | "ghost";

interface ButtonProps extends ButtonHTMLAttributes<HTMLButtonElement> {
  variant?: ButtonVariant;
  isLoading?: boolean;
  loadingText?: string;
  fullWidth?: boolean;
  children: ReactNode;
}

const variantStyles: Record<ButtonVariant, React.CSSProperties> = {
  primary: { backgroundColor: COLORS.brand, color: "#fff" },
  secondary: {
    backgroundColor: "transparent",
    color: COLORS.textSecondary,
    border: `1px solid ${COLORS.border}`,
  },
  ghost: { backgroundColor: "transparent", color: COLORS.textMuted },
};

const variantHover: Record<ButtonVariant, string> = {
  primary: COLORS.brandHover,
  secondary: COLORS.border,
  ghost: COLORS.textSecondary,
};

export function Button({
  variant = "primary",
  isLoading = false,
  loadingText,
  fullWidth = false,
  disabled,
  children,
  style,
  onMouseEnter,
  onMouseLeave,
  ...props
}: ButtonProps) {
  const isDisabled = disabled || isLoading;

  return (
    <button
      {...props}
      disabled={isDisabled}
      style={{
        ...variantStyles[variant],
        opacity: isDisabled ? 0.6 : 1,
        cursor: isDisabled ? "not-allowed" : "pointer",
        width: fullWidth ? "100%" : undefined,
        transition: "all 0.2s ease",
        fontWeight: 600,
        fontSize: "0.875rem",
        padding: "0.625rem 1.5rem",
        borderRadius: "0.75rem",
        display: "inline-flex",
        alignItems: "center",
        justifyContent: "center",
        gap: "0.5rem",
        ...style,
      }}
      onMouseEnter={(e) => {
        if (!isDisabled) {
          if (variant === "primary") e.currentTarget.style.backgroundColor = variantHover.primary;
          else if (variant === "secondary") e.currentTarget.style.backgroundColor = variantHover.secondary;
          else e.currentTarget.style.color = variantHover.ghost;
        }
        onMouseEnter?.(e);
      }}
      onMouseLeave={(e) => {
        if (!isDisabled) {
          if (variant === "primary") e.currentTarget.style.backgroundColor = variantStyles.primary.backgroundColor as string;
          else if (variant === "secondary") e.currentTarget.style.backgroundColor = "transparent";
          else e.currentTarget.style.color = variantStyles.ghost.color as string;
        }
        onMouseLeave?.(e);
      }}
    >
      {isLoading && (
        <div
          className="w-4 h-4 rounded-full border-2 border-t-transparent animate-spin"
          style={{ borderColor: "currentColor", borderTopColor: "transparent" }}
        />
      )}
      {isLoading && loadingText ? loadingText : children}
    </button>
  );
}

// ─── Badge ────────────────────────────────────────────────────────────────────

interface BadgeProps {
  children: ReactNode;
  variant?: "brand" | "warning";
}

export function Badge({ children, variant = "brand" }: BadgeProps) {
  const styles: Record<string, React.CSSProperties> = {
    brand: {
      color: COLORS.brand,
      backgroundColor: COLORS.brandMuted,
      border: `1px solid ${COLORS.brandBorder}`,
    },
    warning: {
      color: COLORS.warning,
      backgroundColor: COLORS.warningBg,
      border: `1px solid ${COLORS.warningBorder}`,
    },
  };

  return (
    <span
      className="text-xs font-bold uppercase tracking-widest px-3 py-1 rounded-full"
      style={styles[variant]}
    >
      {children}
    </span>
  );
}

// ─── Alert ────────────────────────────────────────────────────────────────────

interface AlertProps {
  variant: "error" | "success" | "warning" | "info";
  children: ReactNode;
}

const alertStyles: Record<AlertProps["variant"], React.CSSProperties> = {
  error: { backgroundColor: COLORS.errorBg, border: `1px solid ${COLORS.errorBorder}`, color: COLORS.error },
  success: { backgroundColor: COLORS.successBg, border: `1px solid ${COLORS.successBorder}`, color: COLORS.brand },
  warning: { backgroundColor: COLORS.warningBg, border: `1px solid ${COLORS.warningBorder}`, color: COLORS.warning },
  info: { backgroundColor: COLORS.surface, border: `1px solid ${COLORS.border}`, color: COLORS.textSecondary },
};

export function Alert({ variant, children }: AlertProps) {
  return (
    <div
      role="alert"
      className="rounded-xl p-4 text-sm"
      style={alertStyles[variant]}
    >
      {children}
    </div>
  );
}

// ─── Card ─────────────────────────────────────────────────────────────────────

interface CardProps {
  children: ReactNode;
  highlighted?: boolean;
  className?: string;
}

export function Card({ children, highlighted, className }: CardProps) {
  return (
    <div
      className={`rounded-2xl ${className ?? ""}`}
      style={{
        backgroundColor: COLORS.surface,
        border: highlighted
          ? `1.5px solid ${COLORS.brand}`
          : `1px solid ${COLORS.border}`,
      }}
    >
      {children}
    </div>
  );
}
