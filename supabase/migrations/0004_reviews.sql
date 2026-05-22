-- 0004: post-class reviews + per-user Google-review prompt gating state

-- reviews: one per booking (rating captured immediately, comment optional)
CREATE TABLE reviews (
  id          UUID        PRIMARY KEY DEFAULT gen_random_uuid(),
  booking_id  UUID        NOT NULL REFERENCES bookings(id) ON DELETE CASCADE,
  user_id     UUID        NOT NULL REFERENCES users(id) ON DELETE RESTRICT,
  rating      INT         NOT NULL CHECK (rating >= 1 AND rating <= 5),
  comment     TEXT,
  created_at  TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at  TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE (booking_id)
);

CREATE INDEX idx_reviews_user_id ON reviews (user_id);

ALTER TABLE reviews ENABLE ROW LEVEL SECURITY;

-- google_review_prompts: tracks when the Google-review CTA was shown/declined
-- so it can be re-shown after 3 more paid classes and permanently dismissed.
CREATE TABLE google_review_prompts (
  user_id                    UUID        PRIMARY KEY REFERENCES users(id) ON DELETE CASCADE,
  shown_count                INT         NOT NULL DEFAULT 0,
  skipped_count              INT         NOT NULL DEFAULT 0,
  dismissed                  BOOLEAN     NOT NULL DEFAULT FALSE,
  last_shown_completed_count INT,
  accepted_at                TIMESTAMPTZ,
  created_at                 TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at                 TIMESTAMPTZ NOT NULL DEFAULT now()
);

ALTER TABLE google_review_prompts ENABLE ROW LEVEL SECURITY;
