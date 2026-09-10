CREATE TABLE IF NOT EXISTS publications (
  id TEXT PRIMARY KEY,
  date TEXT NOT NULL,
  topicFingerprint TEXT NOT NULL,
  problemFingerprint TEXT NOT NULL,
  solutionFingerprint TEXT NOT NULL,
  benefitFingerprint TEXT NOT NULL,
  visualFingerprint TEXT NOT NULL,
  semanticFingerprint TEXT NOT NULL,
  servicePromoted TEXT NOT NULL,
  hook TEXT NOT NULL,
  cta TEXT NOT NULL,
  content TEXT NOT NULL,
  network TEXT NOT NULL
);
