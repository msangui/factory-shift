-- Store the held draft's rendered HTML and final draft on the hold itself, so a
-- force re-run that holds no longer needs to overwrite (and unpublish) a
-- previously shipped issue row. Idempotent.

ALTER TABLE holds ADD COLUMN IF NOT EXISTS html TEXT NOT NULL DEFAULT '';
ALTER TABLE holds ADD COLUMN IF NOT EXISTS final_draft JSONB;
