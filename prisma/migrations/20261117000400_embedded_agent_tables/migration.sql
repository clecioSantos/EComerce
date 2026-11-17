-- Embed WhatsApp agent tables in the existing ecommerce PostgreSQL database.
-- Non-destructive: does not touch commercial records.
CREATE TABLE IF NOT EXISTS agent_stores (
 id UUID PRIMARY KEY, name TEXT NOT NULL, store_url TEXT NOT NULL,
 commerce_api_key_enc TEXT NOT NULL DEFAULT '', whatsapp_phone_id TEXT UNIQUE,
 whatsapp_number TEXT NOT NULL DEFAULT '', whatsapp_token_enc TEXT NOT NULL DEFAULT '',
 waba_id TEXT,
 enabled BOOLEAN NOT NULL DEFAULT false,
 preferences JSONB NOT NULL DEFAULT '{}'::jsonb,
 created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(), updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);
CREATE TABLE IF NOT EXISTS agent_conversations (
 id UUID PRIMARY KEY, store_id UUID NOT NULL REFERENCES agent_stores(id) ON DELETE CASCADE,
 phone TEXT NOT NULL, mode TEXT NOT NULL DEFAULT 'ai' CHECK (mode IN ('ai','human')),
 created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(), updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
 UNIQUE(store_id, phone)
);
CREATE INDEX IF NOT EXISTS agent_conversations_store_updated_idx ON agent_conversations(store_id, updated_at DESC);
CREATE TABLE IF NOT EXISTS agent_messages (
 id UUID PRIMARY KEY, conversation_id UUID NOT NULL REFERENCES agent_conversations(id) ON DELETE CASCADE,
 role TEXT NOT NULL CHECK(role IN ('user','assistant')), text TEXT NOT NULL,
 provider_message_id TEXT UNIQUE, created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);
CREATE INDEX IF NOT EXISTS agent_messages_conversation_created_idx ON agent_messages(conversation_id, created_at DESC);
CREATE TABLE IF NOT EXISTS agent_inbound_events (
 id TEXT PRIMARY KEY, store_phone_id TEXT NOT NULL, sender TEXT NOT NULL,
 event JSONB NOT NULL, attempts INT NOT NULL DEFAULT 0, state TEXT NOT NULL DEFAULT 'queued',
 next_attempt TIMESTAMPTZ NOT NULL DEFAULT NOW(), last_error TEXT, updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);
CREATE INDEX IF NOT EXISTS agent_inbound_due_idx ON agent_inbound_events(state,next_attempt);

CREATE TABLE IF NOT EXISTS agent_signup_states (id TEXT PRIMARY KEY, store_id UUID NOT NULL REFERENCES agent_stores(id) ON DELETE CASCADE, expires_at TIMESTAMPTZ NOT NULL);
CREATE INDEX IF NOT EXISTS agent_signup_states_expires_idx ON agent_signup_states(expires_at);
