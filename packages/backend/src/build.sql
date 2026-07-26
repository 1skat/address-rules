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
    chain_id TEXT NOT NULL,
    address TEXT NOT NULL,
    symbol TEXT NOT NULL,
    name TEXT NOT NULL,
    decimals INTEGER NOT NULL,
    deployed_at TIMESTAMPTZ ,
    created_at TIMESTAMPTZ NOT NULL default now(),
    UNIQUE (chain_id, address)
);

CREATE TABLE wallet_tokens (
    wallet_id UUID REFERENCES wallets(id) on DELETE CASCADE,
    token_id UUID REFERENCES tokens(id),
    PRIMARY KEY (wallet_id, token_id)
);

INSERT INTO tokens (chain_id, address, symbol, name, decimals, deployed_at)  
VALUES ('501', '11111111111111111111111111111111', 'SOL', 'Solana', 9, to_timestamp(1584658800));
 
INSERT INTO tokens (chain_id, address, symbol, name, decimals, deployed_at)
VALUES ('501', '4zMMC9srt5Ri5X14GAgXhaHii3GnPAEERYPJgZJDncDU', 'USDC', 'USDC', 6, to_timestamp(1721427641)); -- devnet address, 

CREATE TYPE handle_side AS ENUM ('left', 'right');
CREATE TYPE tx_status AS ENUM ('EXECUTING', 'EXECUTION_FAILED', 'FILLED');

CREATE TABLE edges (
    id UUID PRIMARY KEY,
    chain_id TEXT NOT NULL,
    source UUID REFERENCES wallets(id),
    target UUID REFERENCES wallets(id),
    source_handle handle_side NOT NULL,
    target_handle handle_side NOT NULL,
    is_draft BOOLEAN NOT NULL DEFAULT true,
    created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE TABLE transactions (
    order_id UUID PRIMARY KEY,
    edge_id UUID NOT NULl REFERENCES edges(id) ON DELETE RESTRICT, -- prevent removing txs on edge delete
    token_id UUID NOT NULL REFERENCES tokens(id),
    amount NUMERIC(78) NOT NULL, -- need to make sure SUM() works correctly
    -- ui_amount TEXT NOT NULL,
    fee_amount NUMERIC(78) NOT NULL,
    -- ui_fee_amount TEXT NOT NULL,
    signature TEXT NOT NULL,
    status tx_status NOT NULL DEFAULT 'EXECUTING',
    created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE TABLE edge_token_totals (
    edge_id UUID REFERENCES edges(id) ON DELETE CASCADE,
    token_id UUID REFERENCES tokens(id),
    total_amount NUMERIC NOT NULL DEFAULT 0,
    updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
    PRIMARY KEY (edge_id, token_id)
);
