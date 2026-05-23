"use client";

// ─────────────────────────────────────────────────────────────────────────────
// useZoomConnectionQuality
//
// Subscribes to the Zoom Video SDK's quality and stats events for both the
// local client and a single remote peer (1-on-1 sessions), and derives:
//
//   • selfStatus   — 'good' | 'poor' | 'reconnecting'
//   • remoteStatus — 'unknown' | 'good' | 'poor' | 'lost'
//
// Plus the raw QoS snapshots (rtt, jitter, packet loss, fps, bitrate, etc.)
// so a future Settings panel can read live metrics from this same hook.
//
// Lost-connection detection runs ahead of the SDK's ~60 s heartbeat by
// watching for either:
//   • inbound video stats stalling (no decode events with fps>0 for 5 s),
//   • or the remote uplink quality sitting at level ≤ 1 for 8 s.
// ─────────────────────────────────────────────────────────────────────────────

import { useEffect, useRef, useState } from "react";
import type { VideoQosData, AudioQosData } from "@zoom/videosdk";
import {
  deriveConnectionStatus,
  isDecodeStale,
  isSustainedPoor,
  POOR_LEVEL_MAX,
  type SelfStatus,
  type RemoteStatus,
} from "./connectionStatus";

// ─── Public types ──────────────────────────────────────────────────────────────

export type { SelfStatus, RemoteStatus };

export interface QosSnapshot {
  rtt:         number;
  jitter:      number;
  avg_loss:    number;
  max_loss:    number;
  bandwidth:   number;
  bitrate:     number;
  // Video-only fields are 0 for audio snapshots.
  fps:         number;
  width:       number;
  height:      number;
  sample_rate: number;
  encoding:    boolean;
  updatedAt:   number;
}

export interface ZoomConnectionQuality {
  selfStatus:      SelfStatus;
  remoteStatus:    RemoteStatus;
  selfUplink:      number | null;
  selfDownlink:    number | null;
  remoteUplink:    number | null;
  remoteDownlink:  number | null;
  videoEncode:     QosSnapshot | null;
  videoDecode:     QosSnapshot | null;
  audioEncode:     QosSnapshot | null;
  audioDecode:     QosSnapshot | null;
  connectionState: "Connected" | "Reconnecting" | "Closed" | null;
}

// ─── Internal helpers ─────────────────────────────────────────────────────────

// Thresholds (POOR_LEVEL_MAX, REMOTE_LOST_AFTER_MS, DECODE_STALL_AFTER_MS) live
// in ./connectionStatus alongside the pure derivation they parameterise.

function toVideoSnapshot(data: VideoQosData & { encoding: boolean }): QosSnapshot {
  return {
    rtt:         data.rtt         ?? 0,
    jitter:      data.jitter      ?? 0,
    avg_loss:    data.avg_loss    ?? 0,
    max_loss:    data.max_loss    ?? 0,
    bandwidth:   data.bandwidth   ?? 0,
    bitrate:     data.bitrate     ?? 0,
    fps:         data.fps         ?? 0,
    width:       data.width       ?? 0,
    height:      data.height      ?? 0,
    sample_rate: data.sample_rate ?? 0,
    encoding:    data.encoding,
    updatedAt:   Date.now(),
  };
}

function toAudioSnapshot(data: AudioQosData & { encoding: boolean }): QosSnapshot {
  return {
    rtt:         data.rtt         ?? 0,
    jitter:      data.jitter      ?? 0,
    avg_loss:    data.avg_loss    ?? 0,
    max_loss:    data.max_loss    ?? 0,
    bandwidth:   data.bandwidth   ?? 0,
    bitrate:     data.bitrate     ?? 0,
    fps:         0,
    width:       0,
    height:      0,
    sample_rate: data.sample_rate ?? 0,
    encoding:    data.encoding,
    updatedAt:   Date.now(),
  };
}

// ─── Hook ─────────────────────────────────────────────────────────────────────

interface UseZoomConnectionQualityOptions {
  // The Zoom client returned by ZoomVideo.createClient(), or null before join /
  // after leave. Typed as unknown to avoid pulling in the SDK's namespace type;
  // we cast to a minimal shape internally.
  client:        unknown | null;
  selfUserId:    number;
  remoteUserId:  number | null;
  // When false, the remote has voluntarily turned off their camera, so the
  // absence of inbound video decode events is expected — skip stall detection.
  // Without this, turning off the remote's camera would falsely register as
  // a lost connection after DECODE_STALL_AFTER_MS elapses.
  remoteHasVideo?: boolean;
}

type EventClient = { on: (e: string, fn: (p: any) => void) => void; off: (e: string, fn: (p: any) => void) => void };

export function useZoomConnectionQuality(
  opts: UseZoomConnectionQualityOptions
): ZoomConnectionQuality {
  const { client, selfUserId, remoteUserId, remoteHasVideo = true } = opts;

  const [selfUplink,      setSelfUplink]      = useState<number | null>(null);
  const [selfDownlink,    setSelfDownlink]    = useState<number | null>(null);
  const [remoteUplink,    setRemoteUplink]    = useState<number | null>(null);
  const [remoteDownlink,  setRemoteDownlink]  = useState<number | null>(null);
  const [videoEncode,     setVideoEncode]     = useState<QosSnapshot | null>(null);
  const [videoDecode,     setVideoDecode]     = useState<QosSnapshot | null>(null);
  const [audioEncode,     setAudioEncode]     = useState<QosSnapshot | null>(null);
  const [audioDecode,     setAudioDecode]     = useState<QosSnapshot | null>(null);
  const [connectionState, setConnectionState] = useState<ZoomConnectionQuality["connectionState"]>(null);

  // Time-window refs (don't trigger renders).
  const lastDecodeAtRef    = useRef<number | null>(null);
  const remotePoorSinceRef = useRef<number | null>(null);

  // Time-window facts derived from the refs above. Kept as state (not read from
  // refs during render) so render stays pure. They are recomputed only inside
  // the 1 s interval and the SDK event handlers, where reading the refs and
  // Date.now() is legitimate.
  const [decodeStale,   setDecodeStale]   = useState(false);
  const [sustainedPoor, setSustainedPoor] = useState(false);

  // Re-evaluate the time-window facts from the timestamp refs. Stable identity
  // (lazy-initialised once) so it can be called from the listener effect
  // without churning its dependency array. Reads the refs + Date.now() inside a
  // callback — never during render.
  const [recomputeWindows] = useState(() => () => {
    const now = Date.now();
    setDecodeStale(isDecodeStale(lastDecodeAtRef.current, now));
    setSustainedPoor(isSustainedPoor(remotePoorSinceRef.current, now));
  });

  // ── SDK listeners ───────────────────────────────────────────────────────────
  useEffect(() => {
    if (!client) return;
    const c = client as EventClient;

    const onNetworkQuality = (p: { userId: number; type: "uplink" | "downlink"; level: number }) => {
      if (p.userId === selfUserId) {
        if (p.type === "uplink")   setSelfUplink(p.level);
        else                       setSelfDownlink(p.level);
        return;
      }
      if (remoteUserId !== null && p.userId === remoteUserId) {
        if (p.type === "uplink") {
          setRemoteUplink(p.level);
          if (p.level <= POOR_LEVEL_MAX) {
            if (remotePoorSinceRef.current === null) remotePoorSinceRef.current = Date.now();
          } else {
            // Uplink recovered — clear the window and reflect it immediately.
            remotePoorSinceRef.current = null;
          }
          recomputeWindows();
        } else {
          setRemoteDownlink(p.level);
        }
      }
    };

    const onConnection = (p: { state: "Connected" | "Reconnecting" | "Closed" }) => {
      setConnectionState(p.state);
    };

    const onVideoStats = (p: { data: VideoQosData & { encoding: boolean } }) => {
      const snap = toVideoSnapshot(p.data);
      if (snap.encoding) {
        setVideoEncode(snap);
      } else {
        setVideoDecode(snap);
        if (snap.fps > 0) {
          // Fresh frame — stall watchdog re-arms; reflect it immediately.
          lastDecodeAtRef.current = Date.now();
          recomputeWindows();
        }
      }
    };

    const onAudioStats = (p: { data: AudioQosData & { encoding: boolean } }) => {
      const snap = toAudioSnapshot(p.data);
      if (snap.encoding) setAudioEncode(snap);
      else               setAudioDecode(snap);
    };

    c.on("network-quality-change",         onNetworkQuality);
    c.on("connection-change",              onConnection);
    c.on("video-statistic-data-change",    onVideoStats);
    c.on("audio-statistic-data-change",    onAudioStats);

    // Advance the time-window facts every second so the lost-detection
    // thresholds trip even when no SDK event fires (same 1 s cadence as the
    // previous render-forcing tick).
    const tickId = setInterval(recomputeWindows, 1000);

    return () => {
      clearInterval(tickId);
      c.off("network-quality-change",      onNetworkQuality);
      c.off("connection-change",           onConnection);
      c.off("video-statistic-data-change", onVideoStats);
      c.off("audio-statistic-data-change", onAudioStats);
      // Reset detection refs so a fresh client starts clean.
      lastDecodeAtRef.current    = null;
      remotePoorSinceRef.current = null;
    };
  }, [client, selfUserId, remoteUserId, recomputeWindows]);

  // ── Reset detection refs when the tracked peer changes / leaves, or when the
  //    remote stops sending video ─────────────────────────────────────────────
  // Ref writes only (no setState) — safe in an effect. When the remote turns
  // off its camera, fps stops arriving (expected, not a failure); clearing the
  // timestamp lets the stall watchdog re-arm once frames flow again.
  useEffect(() => {
    lastDecodeAtRef.current    = null;
    remotePoorSinceRef.current = null;
  }, [remoteUserId]);

  useEffect(() => {
    if (!remoteHasVideo) {
      lastDecodeAtRef.current = null;
    }
  }, [remoteHasVideo]);

  // ── Reset exposed/derived state on peer or camera change (render-phase) ──────
  // Render-phase "adjust state on input change": resets the metrics and the
  // time-window facts the moment the tracked peer or its camera state changes,
  // without the cascading-render that set-state-in-effect flags. Clearing
  // decodeStale here prevents a stale timestamp from briefly registering as
  // "lost" the instant the remote camera comes back on or the peer switches.
  const [prevPeer, setPrevPeer] = useState({ remoteUserId, remoteHasVideo });
  if (prevPeer.remoteUserId !== remoteUserId || prevPeer.remoteHasVideo !== remoteHasVideo) {
    const peerChanged = prevPeer.remoteUserId !== remoteUserId;
    setPrevPeer({ remoteUserId, remoteHasVideo });
    if (peerChanged) {
      setRemoteUplink(null);
      setRemoteDownlink(null);
      setSustainedPoor(false);
    }
    setDecodeStale(false);
  }

  // ── Derived statuses (pure: no ref reads, no Date.now() during render) ───────
  const { selfStatus, remoteStatus } = deriveConnectionStatus({
    connectionState,
    selfUplink,
    remoteUplink,
    remoteUserId,
    remoteHasVideo,
    decodeStale,
    sustainedPoor,
  });

  return {
    selfStatus,
    remoteStatus,
    selfUplink,
    selfDownlink,
    remoteUplink,
    remoteDownlink,
    videoEncode,
    videoDecode,
    audioEncode,
    audioDecode,
    connectionState,
  };
}
