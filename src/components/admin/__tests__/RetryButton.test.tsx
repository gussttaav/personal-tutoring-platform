/**
 * @jest-environment jsdom
 */
// DEAD-LETTER-RETRY-02: the retry button tells a booked retry from one that found the slot
// taken and refunded the student, and shows the error of a retry that failed again
// (DEAD-LETTER-RETRY-01 made the API answer { ok: false, error } then).
import { fireEvent, render, screen } from "@testing-library/react";
import { RetryButton } from "@/components/admin/RetryButton";

const mockFetch = jest.fn();
global.fetch = mockFetch as unknown as typeof fetch;

function respond(status: number, body: unknown) {
  mockFetch.mockResolvedValue({ ok: status < 400, status, json: async () => body });
}

async function clickRetry() {
  render(<RetryButton stripeSessionId="pi_123" />);
  fireEvent.click(screen.getByRole("button", { name: "Reintentar" }));
}

describe("DEAD-LETTER-RETRY-02: RetryButton", () => {
  beforeEach(() => mockFetch.mockReset());

  it("posts the id to the failed-bookings endpoint", async () => {
    respond(200, { ok: true, outcome: "booked" });

    await clickRetry();
    await screen.findByText(/Procesado correctamente/);

    expect(mockFetch).toHaveBeenCalledWith("/api/admin/failed-bookings", expect.objectContaining({
      method: "POST",
      body:   JSON.stringify({ stripeSessionId: "pi_123" }),
    }));
  });

  it("says «procesado» for a booked retry", async () => {
    respond(200, { ok: true, outcome: "booked" });

    await clickRetry();

    expect((await screen.findByText(/Procesado correctamente/)).className).toBe("success-text");
    expect(screen.queryByText(/Reembolsado/)).toBeNull();
  });

  it("says the student was refunded when the slot was taken", async () => {
    respond(200, { ok: true, outcome: "refunded" });

    await clickRetry();

    const note = await screen.findByText(/Reembolsado al alumno: el hueco ya no estaba libre\./);
    expect(note.className).toBe("warning-text");
    expect(screen.queryByText(/Procesado correctamente/)).toBeNull();
    expect(screen.queryByRole("button")).toBeNull();
  });

  it("keeps the button and shows the error when the booking failed again", async () => {
    respond(500, { ok: false, error: "Error: calendar API down" });

    await clickRetry();

    expect(await screen.findByText("Error: calendar API down")).toBeTruthy();
    expect(screen.getByRole("button", { name: "Reintentar" })).toBeTruthy();
  });
});
