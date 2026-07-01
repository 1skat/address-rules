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
 
CREATE TABLE tokens (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    symbol TEXT NOT NULL,
    chain_id TEXT NOT NULL,
    address TEXT NOT NULL,
    decimals INTEGER NOT NULL,
    name TEXT NOT NULL,
    deployed_at TIMESTAMPTZ NOT NULL,
    created_at TIMESTAMPTZ NOT NULL default now()
);

CREATE TABLE wallet_tokens (
    wallet_id UUID REFERENCES wallets(id) on DELETE CASCADE,
    token_id UUID REFERENCES tokens(id),
    PRIMARY KEY (wallet_id, token_id)
)
