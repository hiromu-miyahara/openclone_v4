BEGIN;

CREATE EXTENSION IF NOT EXISTS pg_trgm;

CREATE TABLE IF NOT EXISTS users (
  id TEXT PRIMARY KEY,
  auth_provider TEXT NOT NULL CHECK (auth_provider IN ('google', 'email')),
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS user_runtime_state (
  user_id TEXT PRIMARY KEY REFERENCES users(id) ON DELETE CASCADE,
  status TEXT NOT NULL CHECK (status IN ('pending', 'provisioning', 'ready', 'failed', 'stopped')),
  instance_name TEXT,
  endpoint TEXT,
  zone TEXT,
  model_id TEXT,
  auth_token TEXT,
  last_error TEXT,
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS chat_sessions (
  id TEXT PRIMARY KEY,
  user_id TEXT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS chat_messages (
  id TEXT PRIMARY KEY,
  session_id TEXT NOT NULL REFERENCES chat_sessions(id) ON DELETE CASCADE,
  user_id TEXT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  role TEXT NOT NULL CHECK (role IN ('user', 'assistant')),
  text TEXT NOT NULL,
  action TEXT NOT NULL,
  audio_url TEXT,
  tts_status TEXT NOT NULL DEFAULT 'skipped' CHECK (tts_status IN ('ready', 'failed', 'skipped')),
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS onboarding_sessions (
  id TEXT PRIMARY KEY,
  user_id TEXT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  status TEXT NOT NULL DEFAULT 'active' CHECK (status IN ('active', 'completed', 'failed')),
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  completed_at TIMESTAMPTZ
);

CREATE TABLE IF NOT EXISTS onboarding_answers (
  id BIGSERIAL PRIMARY KEY,
  onboarding_session_id TEXT NOT NULL REFERENCES onboarding_sessions(id) ON DELETE CASCADE,
  question_id INTEGER NOT NULL CHECK (question_id BETWEEN 1 AND 8),
  answer_text TEXT,
  answer_audio_url TEXT NOT NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  UNIQUE (onboarding_session_id, question_id)
);

CREATE TABLE IF NOT EXISTS onboarding_big5_answers (
  id BIGSERIAL PRIMARY KEY,
  onboarding_session_id TEXT NOT NULL REFERENCES onboarding_sessions(id) ON DELETE CASCADE,
  question_id INTEGER NOT NULL CHECK (question_id BETWEEN 1 AND 10),
  choice_value INTEGER NOT NULL CHECK (choice_value BETWEEN 1 AND 7),
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  UNIQUE (onboarding_session_id, question_id)
);

CREATE TABLE IF NOT EXISTS onboarding_big5_results (
  onboarding_session_id TEXT PRIMARY KEY REFERENCES onboarding_sessions(id) ON DELETE CASCADE,
  openness_raw REAL NOT NULL,
  conscientiousness_raw REAL NOT NULL,
  extraversion_raw REAL NOT NULL,
  agreeableness_raw REAL NOT NULL,
  neuroticism_raw REAL NOT NULL,
  openness REAL NOT NULL,
  conscientiousness REAL NOT NULL,
  extraversion REAL NOT NULL,
  agreeableness REAL NOT NULL,
  neuroticism REAL NOT NULL,
  formality REAL NOT NULL,
  energy REAL NOT NULL,
  directness REAL NOT NULL,
  warmth REAL NOT NULL,
  type_code TEXT NOT NULL,
  type_label TEXT NOT NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS voice_clone_jobs (
  id TEXT PRIMARY KEY,
  user_id TEXT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  onboarding_session_id TEXT NOT NULL REFERENCES onboarding_sessions(id) ON DELETE CASCADE,
  status TEXT NOT NULL CHECK (status IN ('queued', 'processing', 'ready', 'failed')),
  voice_profile_ref TEXT,
  error_message TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS pixel_jobs (
  id TEXT PRIMARY KEY,
  user_id TEXT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  status TEXT NOT NULL CHECK (status IN ('queued', 'processing', 'completed', 'failed')),
  progress INTEGER NOT NULL DEFAULT 0 CHECK (progress BETWEEN 0 AND 100),
  pipeline_version TEXT NOT NULL,
  base_fullbody_png TEXT,
  motion_frame_urls JSONB,
  motion_gif_urls JSONB,
  error_message TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_chat_sessions_user_created
  ON chat_sessions (user_id, created_at DESC);

CREATE INDEX IF NOT EXISTS idx_chat_messages_session_created
  ON chat_messages (session_id, created_at ASC);

CREATE INDEX IF NOT EXISTS idx_chat_messages_user_created
  ON chat_messages (user_id, created_at DESC);

CREATE INDEX IF NOT EXISTS idx_chat_messages_text_trgm
  ON chat_messages USING GIN (text gin_trgm_ops);

CREATE INDEX IF NOT EXISTS idx_onboarding_answers_session
  ON onboarding_answers (onboarding_session_id, question_id);

CREATE INDEX IF NOT EXISTS idx_onboarding_big5_answers_session
  ON onboarding_big5_answers (onboarding_session_id, question_id);

CREATE INDEX IF NOT EXISTS idx_voice_clone_jobs_user_updated
  ON voice_clone_jobs (user_id, updated_at DESC);

CREATE INDEX IF NOT EXISTS idx_pixel_jobs_user_updated
  ON pixel_jobs (user_id, updated_at DESC);

COMMIT;
