// ARCH-12/15: Singleton service instances — import from here in route handlers.
import { CreditService } from "./CreditService";
import { SessionService } from "./SessionService";
import { creditsRepository, auditRepository, sessionRepository } from "@/infrastructure/redis";
import { ZoomClient } from "@/infrastructure/zoom";

export const creditService = new CreditService(creditsRepository, auditRepository);

const tutorEmail = process.env.TUTOR_EMAIL ?? "";
export const sessionService = new SessionService(sessionRepository, new ZoomClient(), tutorEmail);
