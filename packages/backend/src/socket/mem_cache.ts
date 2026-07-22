import type { Address } from "@solana/kit";
import type { TokenMeta } from "./transactions.js";

export const userWalletsStore = new Map<Address, { id: string, address: Address }>();
export const tokensStore = new Map<string, TokenMeta>();
