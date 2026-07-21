ALTER TABLE "Chat"
ADD COLUMN "title" VARCHAR(160) NOT NULL DEFAULT 'Untitled conversation';

UPDATE "Chat"
SET "title" = LEFT(
  COALESCE(
    NULLIF("messages"->0->'parts'->0->>'text', ''),
    NULLIF("messages"->0->>'content', ''),
    NULLIF("messages"->0->'content'->0->>'text', ''),
    'Untitled conversation'
  ),
  160
);
