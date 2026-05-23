import {
  deriveConnectionStatus,
  isDecodeStale,
  isSustainedPoor,
  DECODE_STALL_AFTER_MS,
  REMOTE_LOST_AFTER_MS,
  type ConnectionStatusInput,
} from "../connectionStatus";

// Sensible defaults for a healthy 1-on-1 session; tests override per case.
const base: ConnectionStatusInput = {
  connectionState: "Connected",
  selfUplink:      5,
  remoteUplink:    5,
  remoteUserId:    42,
  remoteHasVideo:  true,
  decodeStale:     false,
  sustainedPoor:   false,
};

describe("isDecodeStale", () => {
  it("is false when no decode has been seen yet", () => {
    expect(isDecodeStale(null, 10_000)).toBe(false);
  });

  it("is false right up to the threshold and true once it elapses", () => {
    const last = 1_000;
    expect(isDecodeStale(last, last + DECODE_STALL_AFTER_MS - 1)).toBe(false);
    expect(isDecodeStale(last, last + DECODE_STALL_AFTER_MS)).toBe(true);
  });
});

describe("isSustainedPoor", () => {
  it("is false when the uplink was never poor", () => {
    expect(isSustainedPoor(null, 10_000)).toBe(false);
  });

  it("is false right up to the threshold and true once it elapses", () => {
    const since = 1_000;
    expect(isSustainedPoor(since, since + REMOTE_LOST_AFTER_MS - 1)).toBe(false);
    expect(isSustainedPoor(since, since + REMOTE_LOST_AFTER_MS)).toBe(true);
  });
});

describe("deriveConnectionStatus — selfStatus", () => {
  it("is good on a healthy connection", () => {
    expect(deriveConnectionStatus(base).selfStatus).toBe("good");
  });

  it("is reconnecting while the connection is Reconnecting (overrides poor uplink)", () => {
    expect(
      deriveConnectionStatus({ ...base, connectionState: "Reconnecting", selfUplink: 0 }).selfStatus,
    ).toBe("reconnecting");
  });

  it("is poor when self uplink sits at or below the poor level", () => {
    expect(deriveConnectionStatus({ ...base, selfUplink: 1 }).selfStatus).toBe("poor");
    expect(deriveConnectionStatus({ ...base, selfUplink: 2 }).selfStatus).toBe("good");
  });
});

describe("deriveConnectionStatus — remoteStatus", () => {
  it("is unknown when there is no remote peer", () => {
    expect(deriveConnectionStatus({ ...base, remoteUserId: null }).remoteStatus).toBe("unknown");
  });

  it("is unknown when a peer exists but no uplink has arrived yet", () => {
    expect(deriveConnectionStatus({ ...base, remoteUplink: null }).remoteStatus).toBe("unknown");
  });

  it("walks good → poor → lost", () => {
    expect(deriveConnectionStatus({ ...base, remoteUplink: 5 }).remoteStatus).toBe("good");
    expect(deriveConnectionStatus({ ...base, remoteUplink: 1 }).remoteStatus).toBe("poor");
    expect(
      deriveConnectionStatus({ ...base, remoteUplink: 1, sustainedPoor: true }).remoteStatus,
    ).toBe("lost");
  });

  it("is lost when inbound video decode has stalled and the remote has video", () => {
    expect(deriveConnectionStatus({ ...base, decodeStale: true }).remoteStatus).toBe("lost");
  });

  it("does NOT report lost from a decode stall when the remote camera is off", () => {
    // Remote turned its camera off — absence of frames is expected, not a failure.
    expect(
      deriveConnectionStatus({ ...base, decodeStale: true, remoteHasVideo: false }).remoteStatus,
    ).toBe("good");
  });

  it("never reports the remote as lost while the connection is Reconnecting", () => {
    expect(
      deriveConnectionStatus({
        ...base,
        connectionState: "Reconnecting",
        decodeStale:     true,
        sustainedPoor:   true,
      }).remoteStatus,
    ).not.toBe("lost");
  });
});
