// TEST-01: Fake IZoomClient for integration tests.
import type { IZoomClient } from "@/infrastructure/zoom/ZoomClient";

export class FakeZoomClient implements IZoomClient {
  private counter = 0;

  generateSessionCredentials(params: { sessionName: string }) {
    return {
      sessionId:       `zsid-${this.counter++}`,
      sessionName:     params.sessionName,
      sessionPasscode: "pass123",
    };
  }

  generateJWT(_params: {
    sessionName:     string;
    role:            0 | 1;
    userName:        string;
    sessionPasscode: string;
    durationSeconds: number;  // REFACTOR-P2-05
  }): string {
    return "fake-jwt";
  }

  getDurationWithGrace(_sessionType: string): number {
    return 75;
  }
}
