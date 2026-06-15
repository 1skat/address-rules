CREATE TABLE transactions (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    wallet_id UUID NOT NULL REFERENCES wallets(id) ON DELETE CASCADE,
    signature TEXT NOT NUll UNIQUE,
    type TEXT NOT NUll CHECK (type IN ('transfer', 'swap')),
    block_time TIMESTAMPTZ NOT NULL,
    created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
    UNIQUE (signature, wallet_id)
); 

CREATE TABLE tx_transfers (
    id UUID PRIMARY KEY REFERENCES transactions(id) ON DELETE CASCADE,
    direction TEXT NOT NULL CHECK (direction IN ('inbound', 'outbound') ),
    target_address TEXT NOT NULL,
    token TEXT NOT NULL DEFAULT 'native'
);
 
CREATE TABLE tx_meta_solana (
    id UUID PRIMARY KEY REFERENCES transactions(id) ON DELETE CASCADE,
    slot BIGINT NOT NULL, 
    fee_lamports BIGINT NOT NULL,
    amount_lamports BIGINT NOT NULL
);
