"use client";

import { useEffect, useRef, useState } from "react";
import Image from "next/image";
import { signIn, signOut } from "next-auth/react";
import type { PackSize } from "@/types";

interface AuthCornerProps {
  user: { name?: string | null; email?: string | null; image?: string | null } | null;
  packCredits: number | null;
  packSize: PackSize | null;
  onSchedulePack?: () => void;
}

function getInitial(name?: string | null): string {
  return (name?.trim()?.[0] ?? "?").toUpperCase();
}

export default function AuthCorner({ user, packCredits, packSize, onSchedulePack }: AuthCornerProps) {
  const [open, setOpen] = useState(false);
  const containerRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!open) return;
    function onOutside(e: MouseEvent) {
      if (!containerRef.current?.contains(e.target as Node)) setOpen(false);
    }
    document.addEventListener("mousedown", onOutside);
    return () => document.removeEventListener("mousedown", onOutside);
  }, [open]);

  useEffect(() => {
    function onKey(e: KeyboardEvent) {
      if (e.key === "Escape") setOpen(false);
    }
    document.addEventListener("keydown", onKey);
    return () => document.removeEventListener("keydown", onKey);
  }, []);

  const hasActivePack = packCredits !== null && packCredits > 0;

  if (!user) {
    return (
      <div className="auth-corner">
        <button
          className="auth-signin-btn"
          onClick={() => signIn("google", { callbackUrl: "/" })}
          aria-label="Iniciar sesión con Google"
        >
          <svg width="15" height="15" viewBox="0 0 24 24" fill="none" aria-hidden="true">
            <circle cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="1.5" />
            <path d="M14.5 9a2.5 2.5 0 1 1-5 0 2.5 2.5 0 0 1 5 0z" fill="currentColor" opacity="0.6" />
            <path d="M6 19c0-2.8 2.686-5 6-5s6 2.2 6 5" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" />
          </svg>
          <span className="auth-signin-label">Iniciar sesión</span>
        </button>
      </div>
    );
  }

  return (
    <div className="auth-corner" ref={containerRef}>
      <div style={{ position: "relative" }}>
        <button
          className="auth-avatar-btn"
          onClick={() => setOpen((prev) => !prev)}
          aria-expanded={open}
          aria-haspopup="true"
          aria-label="Menú de usuario"
        >
          {user.image ? (
            <Image
              src={user.image}
              alt={user.name ?? "Avatar"}
              width={36}
              height={36}
              style={{ borderRadius: "50%", objectFit: "cover" }}
            />
          ) : (
            getInitial(user.name)
          )}
        </button>

        <div
          className={`auth-dropdown${open ? " auth-dropdown--open" : ""}`}
          role="menu"
          aria-label="Opciones de usuario"
        >
          <div className="auth-dropdown-user">
            <div className="auth-dropdown-name">{user.name ?? "Usuario"}</div>
            <div className="auth-dropdown-email">{user.email}</div>
          </div>

          {hasActivePack && (
            <button 
              className="auth-pack-status"
              style={{ 
                display: "block", 
                width: "100%",
                textAlign: "left",
                background: "transparent",
                border: "none",
                cursor: "pointer", 
                transition: "background 0.15s",
                fontFamily: "inherit"
              }}
              onClick={() => {
                setOpen(false);
                onSchedulePack?.();
              }}
              onMouseEnter={(e) => (e.currentTarget.style.background = "var(--surface-2)")}
              onMouseLeave={(e) => (e.currentTarget.style.background = "transparent")}
            >
              <div className="auth-pack-pill">Pack {packSize}h activo</div>
              <div className="auth-pack-remaining">
                {packCredits} clase{packCredits !== 1 ? "s" : ""} disponible{packCredits !== 1 ? "s" : ""}
              </div>
            </button>
          )}

          <button
            className="auth-dropdown-item auth-dropdown-item--signout"
            onClick={() => { setOpen(false); signOut({ callbackUrl: "/" }); }}
            role="menuitem"
          >
            <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" aria-hidden="true">
              <path d="M9 21H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h4" />
              <polyline points="16 17 21 12 16 7" />
              <line x1="21" y1="12" x2="9" y2="12" />
            </svg>
            Cerrar sesión
          </button>
        </div>
      </div>
    </div>
  );
}
