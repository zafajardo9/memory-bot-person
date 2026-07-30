CREATE TABLE "UserAgentSettings" (
  "userId" UUID NOT NULL,
  "agentName" VARCHAR(60) NOT NULL DEFAULT 'Memory',
  "mood" VARCHAR(30) NOT NULL DEFAULT 'balanced',
  "responseLength" VARCHAR(30) NOT NULL DEFAULT 'balanced',
  "customInstructions" TEXT NOT NULL DEFAULT '',
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMP(3) NOT NULL,

  CONSTRAINT "UserAgentSettings_pkey" PRIMARY KEY ("userId"),
  CONSTRAINT "UserAgentSettings_userId_fkey"
    FOREIGN KEY ("userId") REFERENCES "User"("id")
    ON DELETE CASCADE ON UPDATE CASCADE,
  CONSTRAINT "UserAgentSettings_agentName_check"
    CHECK (char_length(btrim("agentName")) BETWEEN 1 AND 60),
  CONSTRAINT "UserAgentSettings_mood_check"
    CHECK ("mood" IN ('balanced', 'warm', 'upbeat', 'calm', 'direct', 'analytical')),
  CONSTRAINT "UserAgentSettings_responseLength_check"
    CHECK ("responseLength" IN ('concise', 'balanced', 'detailed')),
  CONSTRAINT "UserAgentSettings_customInstructions_check"
    CHECK (char_length("customInstructions") <= 3000)
);
