CREATE TABLE refresh_tokens ( 
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    account_id UUID NOT NULL REFERENCES accounts(id) ON DELETE CASCADE,
    created_at TIMESTAMPTZ NOT NULL default now(),
    expires_at TIMESTAMPTZ NOT NULL
);
