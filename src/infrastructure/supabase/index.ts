// DB-02: Singleton exports for Supabase repository implementations.
// Services are wired to Redis repos until Task 4.3 (dual-write).
import { SupabaseCreditsRepository }      from "./SupabaseCreditsRepository";
import { SupabaseAuditRepository }        from "./SupabaseAuditRepository";
import { SupabaseBookingRepository }      from "./SupabaseBookingRepository";
import { SupabaseSessionRepository }      from "./SupabaseSessionRepository";
import { SupabasePaymentRepository }      from "./SupabasePaymentRepository";
import { SupabaseSubscriptionRepository } from "./SupabaseSubscriptionRepository";
import { SupabasePricingRepository }      from "./SupabasePricingRepository";
import { SupabaseScheduleRepository }     from "./SupabaseScheduleRepository";
import { SupabaseUserRepository }         from "./SupabaseUserRepository";
import { SupabaseReviewRepository }       from "./SupabaseReviewRepository";
import { SupabaseCourseRepository }       from "./SupabaseCourseRepository";
import { SupabaseGoogleReviewPromptRepository } from "./SupabaseGoogleReviewPromptRepository";
import { SupabaseContentFeedbackRepository } from "./SupabaseContentFeedbackRepository";
import { SupabaseAdminQueryRepository }   from "./SupabaseAdminQueryRepository";

export const supabaseCreditsRepository      = new SupabaseCreditsRepository();
export const supabaseAuditRepository        = new SupabaseAuditRepository();
export const supabaseBookingRepository      = new SupabaseBookingRepository();
export const supabaseSessionRepository      = new SupabaseSessionRepository();
export const supabasePaymentRepository      = new SupabasePaymentRepository();
export const supabaseSubscriptionRepository = new SupabaseSubscriptionRepository();
export const supabasePricingRepository      = new SupabasePricingRepository();
export const supabaseScheduleRepository     = new SupabaseScheduleRepository();
export const supabaseUserRepository         = new SupabaseUserRepository();
export const supabaseReviewRepository       = new SupabaseReviewRepository();
export const supabaseCourseRepository       = new SupabaseCourseRepository();
export const supabaseGoogleReviewPromptRepository = new SupabaseGoogleReviewPromptRepository();
export const supabaseContentFeedbackRepository = new SupabaseContentFeedbackRepository();
// REFACTOR-R4-P3-02: the admin panel's reads (was the admin panel's `_data.ts`).
export const supabaseAdminQueryRepository   = new SupabaseAdminQueryRepository();
