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

CREATE TYPE handle_side AS ENUM ('left', 'right');
CREATE TYPE tx_status AS ENUM ('pending', 'processed', 'failed');

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
    mint TEXT NOT NULL,
    amount TEXT NOT NULL, -- save as TEXT to prevent overflow, passed as stringifiedBigInt
    ui_amount TEXT NOT NULL,
    fee_amount TEXT NOT NULL,
    ui_fee_amount TEXT NOT NULL,
    signature TEXT NOT NULL,
    status tx_status NOT NULL DEFAULT 'pending',
    created_at TIMESTAMPTZ NOT NULL DEFAULT now()
)
