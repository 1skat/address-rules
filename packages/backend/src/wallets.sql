CREATE TABLE wallets ( 
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    account_id UUID NOT NULL REFERENCES accounts(id) ON DELETE CASCADE,
    address TEXT NOT NULL,
    derivation_index INTEGER NOT NULL,
    alias TEXT default NULL,
    chain_id TEXT NOT NULL,
    position_x FLOAT NOT NULL default 0,
    position_y FLOAT NOT NULL default 0,
    archived BOOLEAN NOT NULL DEFAULT false,
    created_at TIMESTAMPTZ NOT NULL default now(),
    UNIQUE (account_id, address),
    UNIQUE (account_id, chain_id, derivation_index)
);
