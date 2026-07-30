"use client";

/**
 * StarRating — 1-to-5 star input, and the read-only star row used in history rows.
 *
 * Deliberately local to the personal area rather than extracted from
 * PostClassReview: that component owns the in-room post-class flow with its own
 * phase machine and Google-review CTA, and pulling its stars apart would mean
 * refactoring a surface this task does not touch.
 */

interface StarRatingProps {
  /** Currently selected rating, 0 when nothing is set. */
  value:     number;
  onSelect:  (rating: number) => void;
  disabled?: boolean;
  /** aria-label for each star, e.g. t("starLabel", { count: n }). */
  labelFor:  (rating: number) => string;
}

export default function StarRating({ value, onSelect, disabled = false, labelFor }: StarRatingProps) {
  return (
    <div className="pa-rate__stars" role="group">
      {[1, 2, 3, 4, 5].map((n) => (
        <button
          key={n}
          type="button"
          className={`pa-rate__star${n <= value ? " pa-rate__star--on" : ""}`}
          onClick={() => onSelect(n)}
          disabled={disabled}
          aria-label={labelFor(n)}
          aria-pressed={n === value}
        >
          <span className="material-symbols-outlined" aria-hidden="true">star</span>
        </button>
      ))}
    </div>
  );
}

/** Read-only ★★★★☆ for list rows. */
export function StarsReadOnly({ rating, label }: { rating: number; label: string }) {
  return (
    <span className="pa-stars" aria-label={label}>
      {[1, 2, 3, 4, 5].map((n) => (
        <span key={n} className={n <= rating ? undefined : "pa-o"} aria-hidden="true">
          ★
        </span>
      ))}
    </span>
  );
}
