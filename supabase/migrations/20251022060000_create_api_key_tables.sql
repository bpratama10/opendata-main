-- Create API Key Management Tables
-- API keys for developer access to public data

-- Table for storing encrypted API keys
CREATE TABLE api_keys (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  hashed_key VARCHAR(128) NOT NULL UNIQUE, -- Bcrypt hash or SHA-256
  name VARCHAR(100) NOT NULL, -- User-friendly display name
  description TEXT,

  -- Rate limiting configuration (per hour)
  rate_limit_requests INTEGER NOT NULL DEFAULT 1000,
  rate_limit_window_minutes INTEGER NOT NULL DEFAULT 60,

  -- Status and lifecycle
  is_active BOOLEAN NOT NULL DEFAULT true,
  expires_at TIMESTAMP WITH TIME ZONE,
  last_used_at TIMESTAMP WITH TIME ZONE,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT now(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT now(),

  -- Prevent duplicate keys for same user
  UNIQUE(user_id, hashed_key)
);

-- Table for tracking API usage and rate limiting
CREATE TABLE api_key_usage (
  id BIGSERIAL PRIMARY KEY,
  api_key_id UUID NOT NULL REFERENCES api_keys(id) ON DELETE CASCADE,

  -- Request details
  method VARCHAR(10) NOT NULL, -- GET, POST, etc.
  endpoint TEXT NOT NULL,
  response_status INTEGER,

  -- Timing
  requested_at TIMESTAMP WITH TIME ZONE DEFAULT now(),
  response_time_ms INTEGER,

  -- Client information
  client_ip INET,
  user_agent TEXT,

  INDEX(api_key_id, requested_at),
  INDEX(requested_at)
);

-- Table for fine-grained permissions (future use)
CREATE TABLE api_key_permissions (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  api_key_id UUID NOT NULL REFERENCES api_keys(id) ON DELETE CASCADE,
  permission VARCHAR(100) NOT NULL, -- 'read_datasets', 'download_files', etc.
  resource_type VARCHAR(50), -- 'dataset', 'table', etc.
  resource_id UUID, -- Specific resource ID, or NULL for all

  created_at TIMESTAMP WITH TIME ZONE DEFAULT now(),

  UNIQUE(api_key_id, permission, resource_type, resource_id)
);

-- Function to hash API keys for storage
CREATE OR REPLACE FUNCTION hash_api_key(api_key text)
RETURNS text
LANGUAGE sql
IMMUTABLE
AS $$
  SELECT encode(digest($1, 'sha256'), 'hex');
$$;

-- Function to check if API key is valid and not expired
CREATE OR REPLACE FUNCTION validate_api_key(hashed_key text)
RETURNS TABLE (
  id UUID,
  user_id UUID,
  rate_limit_requests INTEGER,
  rate_limit_window_minutes INTEGER,
  is_active BOOLEAN,
  expires_at TIMESTAMP WITH TIME ZONE
)
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT
    ak.id,
    ak.user_id,
    ak.rate_limit_requests,
    ak.rate_limit_window_minutes,
    ak.is_active,
    ak.expires_at
  FROM api_keys ak
  WHERE ak.hashed_key = $1
    AND ak.is_active = true
    AND (ak.expires_at IS NULL OR ak.expires_at > now());
$$;

-- Function to check rate limit for API key
CREATE OR REPLACE FUNCTION check_rate_limit(api_key_id UUID, window_minutes INTEGER)
RETURNS TABLE (
  request_count INTEGER,
  window_start TIMESTAMP WITH TIME ZONE,
  window_end TIMESTAMP WITH TIME ZONE
)
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT
    COUNT(*)::INTEGER as request_count,
    now() - make_interval(mins => $2) as window_start,
    now() as window_end
  FROM api_key_usage
  WHERE api_key_id = $1
    AND requested_at >= now() - make_interval(mins => $2);
$$;

-- Function to log API usage
CREATE OR REPLACE FUNCTION log_api_usage(
  api_key_id UUID,
  method text,
  endpoint text,
  response_status INTEGER,
  response_time_ms INTEGER DEFAULT NULL,
  client_ip INET DEFAULT NULL,
  user_agent text DEFAULT NULL
)
RETURNS void
LANGUAGE sql
VOLATILE
SECURITY DEFINER
SET search_path = public
AS $$
  INSERT INTO api_key_usage (
    api_key_id,
    method,
    endpoint,
    response_status,
    response_time_ms,
    client_ip,
    user_agent
  ) VALUES ($1, $2, $3, $4, $5, $6, $7);

  -- Update last_used_at in api_keys
  UPDATE api_keys
  SET last_used_at = now()
  WHERE id = $1;
$$;

-- Row Level Security Policies

-- API keys: Users can only see their own keys
CREATE POLICY "Users can view own API keys"
ON api_keys FOR SELECT
USING (auth.uid() = user_id);

CREATE POLICY "Users can create own API keys"
ON api_keys FOR INSERT
WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users can update own API keys"
ON api_keys FOR UPDATE
USING (auth.uid() = user_id);

CREATE POLICY "Users can delete own API keys"
ON api_keys FOR DELETE
USING (auth.uid() = user_id);

-- API key usage: Users can view usage for their own keys
CREATE POLICY "Users can view usage for own API keys"
ON api_key_usage FOR SELECT
USING (api_key_id IN (
  SELECT id FROM api_keys WHERE user_id = auth.uid()
));

-- API key permissions: Users can manage permissions for their own keys
CREATE POLICY "Users can manage permissions for own API keys"
ON api_key_permissions FOR ALL
USING (api_key_id IN (
  SELECT id FROM api_keys WHERE user_id = auth.uid()
));

-- Enable Row Level Security
ALTER TABLE api_keys ENABLE ROW LEVEL SECURITY;
ALTER TABLE api_key_usage ENABLE ROW LEVEL SECURITY;
ALTER TABLE api_key_permissions ENABLE ROW LEVEL SECURITY;

-- Indexes for performance
CREATE INDEX idx_api_keys_user_id ON api_keys(user_id);
CREATE INDEX idx_api_keys_hashed_key ON api_keys(hashed_key) WHERE is_active = true;
CREATE INDEX idx_api_key_usage_api_key_id_requested_at ON api_key_usage(api_key_id, requested_at);
CREATE INDEX idx_api_key_usage_requested_at ON api_key_usage(requested_at);
CREATE INDEX idx_api_key_permissions_api_key_id ON api_key_permissions(api_key_id);
