"use client";

/**
 * hooks/useBookingRouter.ts
 *
 * ARCH-06: Extracted from InteractiveShell.
 *
 * Responsibility: manage which booking view is currently active
 * (session, pack, or none) and the sign-in gate state that guards them.
 * Also exposes the handlers that InteractiveShell's click callbacks need.
 *
 * This consolidates 7 useState declarations and 3 useEffect blocks that
 * previously lived in InteractiveShell, reducing the component from ~200
 * lines to ~60.
 */

import { useState, useEffect } from "react";
import type { PackSize, StudentInfo } from "@/types";
import type { SingleSessionType } from "@/components/SingleSessionBooking";

export interface BookingRouterState {
  // ── Active views ──────────────────────────────────────────────────────────
  activeSession:   SingleSessionType | null;
  showPackBooking: boolean;
  selectedPack:    PackSize | null;
  rescheduleToken: string | null;

  // ── Sign-in gate ──────────────────────────────────────────────────────────
  /** Non-empty when the sign-in gate should be shown */
  signInGateLabel: string;

  // ── Handlers ──────────────────────────────────────────────────────────────
  handleSessionClick:  (type: SingleSessionType) => void;
  handlePackBuy:       (size: PackSize) => void;
  handlePackSchedule:  () => void;
  handleSignInGateClose: () => void;
  handleCreditsReady:  (_student: StudentInfo) => void;
  closePackBooking:    () => void;
  closeSession:        () => void;

  // ── Reschedule wiring ─────────────────────────────────────────────────────
  /** Called by InteractiveShell once useRescheduleIntent resolves */
  applyReschedule: (type: string, token: string | null) => void;
  /** Merge a sign-in label from useRescheduleIntent into the gate state */
  setRescheduleSignInLabel: (label: string) => void;
}

const SESSION_SIGNIN_LABELS: Record<SingleSessionType, string> = {
  free15min: "reservar el encuentro inicial gratuito",
  session1h: "reservar una sesión de 1 hora",
  session2h: "reservar una sesión de 2 horas",
};

const VALID_SESSION_TYPES = new Set<string>(["free15min", "session1h", "session2h"]);

export function useBookingRouter(isSignedIn: boolean): BookingRouterState {
  const [activeSession,   setActiveSession]   = useState<SingleSessionType | null>(null);
  const [showPackBooking, setShowPackBooking] = useState(false);
  const [selectedPack,    setSelectedPack]   = useState<PackSize | null>(null);
  const [signInGateLabel, setSignInGateLabel] = useState("");
  const [pendingSession,  setPendingSession]  = useState<SingleSessionType | null>(null);
  const [rescheduleToken, setRescheduleToken] = useState<string | null>(null);

  // ── Auto-open session view after sign-in ───────────────────────────────────
  useEffect(() => {
    if (isSignedIn && pendingSession && !activeSession) {
      setActiveSession(pendingSession);
      setPendingSession(null);
      setSignInGateLabel("");
    }
  }, [isSignedIn, pendingSession, activeSession]);

  // ── Handlers ──────────────────────────────────────────────────────────────

  function handleSessionClick(type: SingleSessionType) {
    if (!isSignedIn) {
      setPendingSession(type);
      setSignInGateLabel(SESSION_SIGNIN_LABELS[type]);
      return;
    }
    setActiveSession(type);
  }

  function handlePackBuy(size: PackSize) {
    if (!isSignedIn) {
      setPendingSession(null);
      setSignInGateLabel("comprar un pack de clases");
      setSelectedPack(size);
      return;
    }
    setSelectedPack(size);
  }

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

  function handleCreditsReady(_student: StudentInfo) {
    setSelectedPack(null);
  }

  function closePackBooking() {
    setShowPackBooking(false);
    setRescheduleToken(null);
  }

  function closeSession() {
    setActiveSession(null);
    setRescheduleToken(null);
  }

  // ── Reschedule wiring ──────────────────────────────────────────────────────

  function applyReschedule(type: string, token: string | null) {
    if (token) setRescheduleToken(token);

    if (type === "pack") {
      setShowPackBooking(true);
    } else if (VALID_SESSION_TYPES.has(type)) {
      setActiveSession(type as SingleSessionType);
    }
  }

  function setRescheduleSignInLabel(label: string) {
    setSignInGateLabel(label);
  }

  return {
    activeSession,
    showPackBooking,
    selectedPack,
    rescheduleToken,
    signInGateLabel,
    handleSessionClick,
    handlePackBuy,
    handlePackSchedule,
    handleSignInGateClose,
    handleCreditsReady,
    closePackBooking,
    closeSession,
    applyReschedule,
    setRescheduleSignInLabel,
  };
}
