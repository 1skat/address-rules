import type { StringifiedBigInt } from "@solana/kit";
import { Decimal } from "decimal.js";

export const throttle = (fn: Function, ms: number) => {
    let last = 0;
    return (...args: any[]) => {
        const now = Date.now();
        if (now - last >= ms) {
            last = now
            fn(...args);
        }
    }
}

export const generateIndecies = () => {
    const out: Array<number> = [];
    while (out.length !== 3) {
        const idx = Math.floor(Math.random() * 12);
        if (out.includes(idx)) continue;

        out.push(idx)
    }
    return out;
}

export const shortFormat = (address: string) => (address.slice(0, 5) + "..." + address.slice(-4));

export const toSmallestUnit = (amount: string, decimals: number) => {
    if (amount === "") return BigInt(0);
    if (!/^\d+(\.\d+)?$/.test(amount)) return null;
    const [whole, decimal = ""] = amount.split(".");
    const padded = (decimal + "0".repeat(decimals)).slice(0, decimals)

    return BigInt(whole + padded);
}

export const toUiAmount = (amount: bigint, decimals: number): string => {
    return (Number(amount) / 10 ** decimals).toString();
}

export const toUiAmountV2 = (amount: StringifiedBigInt, decimals: number) => {
    const decimalAmount = new Decimal(amount).div(new Decimal(10).pow(decimals));

    const abs = decimalAmount.abs();
    if (abs.lessThan(1)) {
        const val = abs.toString();
        const match = val.match(/^0\.(0{3,})(\d{2})/)
        if (!match) return abs.toFixed(3, Decimal.ROUND_DOWN);

        return `0.0(${match[1].length})${match[2]}`
    } else {
        return abs.gte(1_000_000_000) ? decimalAmount.div(1_000_000_000).toFixed(2, Decimal.ROUND_DOWN) + "B"
            : abs.gte(1_000_000) ? decimalAmount.div(1_000_000).toFixed(2, Decimal.ROUND_DOWN) + "M"
                : abs.gte(1_000) ? decimalAmount.div(1_000).toFixed(2, Decimal.ROUND_DOWN) + "K"
                    : decimalAmount.toFixed(2, Decimal.ROUND_DOWN);
    }
}


