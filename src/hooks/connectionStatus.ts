// ─────────────────────────────────────────────────────────────────────────────
// connectionStatus
//
// Pure derivation of the self/remote connection statuses from the latest Zoom
// QoS metrics and two time-window facts. Extracted from useZoomConnectionQuality
// so the logic can be unit-tested in isolation (node env) and so the hook never
// reads mutable refs or calls Date.now() during render.
//
// The two time-window facts (decodeStale, sustainedPoor) are evaluated by the
// hook inside its 1 s interval / SDK event handlers — the only places where
// reading the timestamp refs and Date.now() is legitimate — via isDecodeStale /
// isSustainedPoor below. Everything else is a pure function of state/props, so
// render stays pure.
// ─────────────────────────────────────────────────────────────────────────────

export type SelfStatus   = "good" | "poor" | "reconnecting";
export type RemoteStatus = "unknown" | "good" | "poor" | "lost";

// Thresholds — tuned in the plan.
export const POOR_LEVEL_MAX        = 1;     // levels 0,1 = bad
export const REMOTE_LOST_AFTER_MS  = 8000;  // sustained poor uplink → declare lost
export const DECODE_STALL_AFTER_MS = 5000;  // no inbound video frames → declare lost

/** True when inbound video decode has stalled past the threshold. */
export function isDecodeStale(lastDecodeAt: number | null, now: number): boolean {
  return lastDecodeAt !== null && now - lastDecodeAt >= DECODE_STALL_AFTER_MS;
}

/** True when the remote uplink has sat at a poor level past the threshold. */
export function isSustainedPoor(remotePoorSince: number | null, now: number): boolean {
  return remotePoorSince !== null && now - remotePoorSince >= REMOTE_LOST_AFTER_MS;
}

export interface ConnectionStatusInput {
  connectionState: "Connected" | "Reconnecting" | "Closed" | null;
  selfUplink:      number | null;
  remoteUplink:    number | null;
  remoteUserId:    number | null;
  remoteHasVideo:  boolean;
  /** Raw "inbound video decode stalled" fact (not yet gated on remoteHasVideo). */
  decodeStale:     boolean;
  /** "Remote uplink poor past the lost threshold" fact. */
  sustainedPoor:   boolean;
}

export function deriveConnectionStatus(
  s: ConnectionStatusInput,
): { selfStatus: SelfStatus; remoteStatus: RemoteStatus } {
  let selfStatus: SelfStatus = "good";
  if (s.connectionState === "Reconnecting") {
    selfStatus = "reconnecting";
  } else if (s.selfUplink !== null && s.selfUplink <= POOR_LEVEL_MAX) {
    selfStatus = "poor";
  }

  let remoteStatus: RemoteStatus = "unknown";
  if (s.remoteUserId === null) {
    remoteStatus = "unknown";
  } else {
    // A stalled decode only counts as lost while the remote is actually sending
    // video; gating here (in render) keeps the response to a camera toggle
    // immediate.
    const lost =
      s.connectionState !== "Reconnecting" &&
      ((s.remoteHasVideo && s.decodeStale) || s.sustainedPoor);

    if (lost) {
      remoteStatus = "lost";
    } else if (s.remoteUplink !== null && s.remoteUplink <= POOR_LEVEL_MAX) {
      remoteStatus = "poor";
    } else if (s.remoteUplink !== null) {
      remoteStatus = "good";
    }
  }

  return { selfStatus, remoteStatus };
}
