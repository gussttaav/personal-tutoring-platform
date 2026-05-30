// REFACTOR-P3-05: unit tests for the per-id Realtime channel name helpers.
import { paymentChannelName, chatChannelName } from "@/lib/realtime-channel";

describe("REFACTOR-P3-05: paymentChannelName", () => {
  it("is deterministic for the same id", () => {
    expect(paymentChannelName("pi_123")).toBe(paymentChannelName("pi_123"));
  });

  it("uses the pay: prefix and a 128-bit (32 hex char) mac", () => {
    const name = paymentChannelName("pi_123");
    expect(name).toMatch(/^pay:[0-9a-f]{32}$/);
  });

  it("differs from chatChannelName for the same id", () => {
    expect(paymentChannelName("abc")).not.toBe(chatChannelName("abc"));
  });

  it("produces different names for different ids", () => {
    expect(paymentChannelName("pi_a")).not.toBe(paymentChannelName("pi_b"));
  });
});
