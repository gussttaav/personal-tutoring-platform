// DB-02: Singleton exports for Supabase repository implementations.
// Services are wired to Redis repos until Task 4.3 (dual-write).
import { SupabaseCreditsRepository }      from "./SupabaseCreditsRepository";
import { SupabaseAuditRepository }        from "./SupabaseAuditRepository";
import { SupabaseBookingRepository }      from "./SupabaseBookingRepository";
import { SupabaseSessionRepository }      from "./SupabaseSessionRepository";
import { SupabasePaymentRepository }      from "./SupabasePaymentRepository";
import { SupabaseSubscriptionRepository } from "./SupabaseSubscriptionRepository";

export const supabaseCreditsRepository      = new SupabaseCreditsRepository();
export const supabaseAuditRepository        = new SupabaseAuditRepository();
export const supabaseBookingRepository      = new SupabaseBookingRepository();
export const supabaseSessionRepository      = new SupabaseSessionRepository();
export const supabasePaymentRepository      = new SupabasePaymentRepository();
export const supabaseSubscriptionRepository = new SupabaseSubscriptionRepository();
