import { PACK_SIZES } from "@/constants";
import type { PackSize } from "@/domain/types";

const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

export function isValidEmail(email: unknown): email is string {
  return typeof email === "string" && EMAIL_RE.test(email.trim());
}

export function isValidPackSize(size: unknown): size is PackSize {
  return PACK_SIZES.includes(size as PackSize);
}

export function sanitizeEmail(email: string): string {
  return email.trim().toLowerCase();
}

export function sanitizeName(name: string): string {
  return name.trim().slice(0, 100); // reasonable max length
}
