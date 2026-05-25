-- REFACTOR-P1-04: Fallback queue for Zoom session terminations when QStash
-- scheduling fails at booking time. A daily cron sweeps any rows whose
-- fire_at has passed and calls the terminate handler directly.

CREATE TABLE pending_terminations (
  event_id    TEXT        PRIMARY KEY,
  fire_at     TIMESTAMPTZ NOT NULL,
  attempts    INT         NOT NULL DEFAULT 0,
  last_error  TEXT,
  created_at  TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX idx_pending_terminations_fire_at
  ON pending_terminations (fire_at)
  WHERE attempts < 5;

ALTER TABLE pending_terminations ENABLE ROW LEVEL SECURITY;
