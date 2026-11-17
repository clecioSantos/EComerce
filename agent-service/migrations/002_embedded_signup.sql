-- Apply on installations that already ran agent-service/schema.sql.
ALTER TABLE agent_stores ALTER COLUMN whatsapp_phone_id DROP NOT NULL;
ALTER TABLE agent_stores ALTER COLUMN whatsapp_number SET DEFAULT '';
ALTER TABLE agent_stores ALTER COLUMN commerce_api_key_enc SET DEFAULT '';
ALTER TABLE agent_stores ALTER COLUMN whatsapp_token_enc SET DEFAULT '';
ALTER TABLE agent_stores ADD COLUMN IF NOT EXISTS waba_id TEXT;
CREATE TABLE IF NOT EXISTS agent_signup_states (
 id TEXT PRIMARY KEY,
 store_id UUID NOT NULL REFERENCES agent_stores(id) ON DELETE CASCADE,
 expires_at TIMESTAMPTZ NOT NULL
);
CREATE INDEX IF NOT EXISTS agent_signup_states_expires_idx ON agent_signup_states(expires_at);
