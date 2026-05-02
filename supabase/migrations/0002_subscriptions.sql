-- 0002: coming-soon subscription signups

CREATE TABLE subscriptions (
  id         UUID        PRIMARY KEY DEFAULT gen_random_uuid(),
  email      TEXT        NOT NULL,
  type       TEXT        NOT NULL CHECK (type IN ('courses', 'blog')),
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE (email, type)
);

CREATE INDEX idx_subscriptions_email ON subscriptions (email);
CREATE INDEX idx_subscriptions_type  ON subscriptions (type);

ALTER TABLE subscriptions ENABLE ROW LEVEL SECURITY;
