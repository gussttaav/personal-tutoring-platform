// ARCH-15: Thin wrapper around lib/zoom.ts so SessionService can depend on an
// interface rather than a concrete module — enables testing with mocks.
import * as zoomLib from "@/lib/zoom";

export interface IZoomClient {
  generateSessionCredentials(params: { sessionName: string }): {
    sessionId: string;
    sessionName: string;
    sessionPasscode: string;
  };

  generateJWT(params: {
    sessionName:     string;
    role:            0 | 1;
    userName:        string;
    sessionPasscode: string;
  }): string;

  getDurationWithGrace(sessionType: string): number;
}

export class ZoomClient implements IZoomClient {
  generateSessionCredentials = zoomLib.generateZoomSessionCredentials;
  generateJWT                = zoomLib.generateZoomJWT;
  getDurationWithGrace       = zoomLib.getSessionDurationWithGrace;
}
