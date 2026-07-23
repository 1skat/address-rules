import { Decimal } from "decimal.js";

export const toUiAmount = (amount: bigint, decimals: number): string => {
    const decimalAmount = new Decimal(amount)
        .div(10 ** decimals);
    const abs = decimalAmount.abs();

    return abs.gte(1_000_000_000) ? decimalAmount.div(1_000_000_000).toFixed(2, Decimal.ROUND_DOWN) + "B"
        : abs.gte(1_000_000) ? decimalAmount.div(1_000_000).toFixed(2, Decimal.ROUND_DOWN) + "M"
            : abs.gte(1_000) ? decimalAmount.div(1_000).toFixed(2, Decimal.ROUND_DOWN) + "K"
                : decimalAmount.toFixed(2, Decimal.ROUND_DOWN);
}

