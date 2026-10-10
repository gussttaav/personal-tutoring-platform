-- BLOG-15: which blog areas a subscriber wants to hear about.
--
-- The blog opt-in (`subscriptions.type = 'blog'`) used to mean "every new post". Posts now
-- carry one or two areas (BLOG-13: ia, bases-de-datos, matematicas, programacion), and a
-- reader picks the ones they care about. A post is announced to a subscriber when it shares
-- at least one area with their selection.
--
--   areas NULL      every area — the subscribers who opted in before this column existed,
--                   and anyone who ticks all of them (so a future area includes them too)
--   areas {ia,...}  that explicit subset, never empty
--
-- Only blog rows may carry areas: the courses opt-in has no such axis. There is no CHECK on
-- the values themselves — the closed list lives in src/constants/blog.ts and Zod validates
-- every write, so adding an area stays a code change with no migration.
--
-- delete_user_account needs no change: it deletes subscription rows whole.

ALTER TABLE subscriptions
  ADD COLUMN areas TEXT[];

ALTER TABLE subscriptions
  ADD CONSTRAINT subscriptions_areas_blog_only
  CHECK (areas IS NULL OR (type = 'blog' AND cardinality(areas) > 0));
