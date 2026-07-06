import { address, createSolanaRpc, type Address, type Signature, type StringifiedBigInt, type StringifiedNumber } from "@solana/kit";
import util from "util";

// 5PLZ51GBZCqdYatNfwm334ereU49mShoeiKyBVDsYtzCMwFjZG6qNeGKN3tqrDYWtHMr8v3ThvUUjvAhkML8eQYk
//4sjHef5UWhn6Zh1SWDVGDLrj5nD3Ehwc15TaswrwW9HyhC3GfBtqUbeiXZrGKjC36dqvQZB8FQHuCn7jAfhBAoVq

export const solanaRpc = createSolanaRpc("https://api.devnet.solana.com");
const signature = "z1Caobxmk5b8aCQbYi3LjTmfRYnNbLMfMwyYPsmHEu7rTHC6EQBDMx2uWryxX5PrSFFLXo97LvWdUub8a7D8vFD" as Signature;
const tx = await solanaRpc.getTransaction(signature, { commitment: "confirmed", encoding: "jsonParsed", maxSupportedTransactionVersion: 0 }).send();

// console.log(util.inspect(tx, { depth: null }));

export const walletStore = new Map<Address, AbortController>();
walletStore.set(address("Ai3XGJhDkTyaiiqq4XYyB2ea4doygM4i3SgH5Hx9UDKH"), new AbortController());

const _rpcResultHint = solanaRpc.getTransaction('' as Signature, { encoding: 'jsonParsed', maxSupportedTransactionVersion: 0, });
type GetTranscationResult = NonNullable<Awaited<ReturnType<typeof _rpcResultHint['send']>>>;

type BalanceChanges = {
    walletNativeBalanceUpdates: { accountAddress: Address, balance: string }[];
    walletTokenBalanceUpdates?: {
        walletAddress: Address;
        mint: Address;
        amount: Readonly<{
            amount: StringifiedBigInt;
            decimals: number;
            uiAmount: number | null;
            uiAmountString: StringifiedNumber;
        }>;
    }[];
}
const parseTxBalancesChanges = (data: GetTranscationResult): BalanceChanges => {
    const { meta, transaction } = data;
    if (!meta || !transaction) throw new Error("no meta/transaction found, handle the err over ws");

    const walletNativeBalanceUpdates = transaction.message.accountKeys
        .map((ak, idx) => ({ ak, idx }))
        .filter(({ ak, idx }) => walletStore.has(ak.pubkey) && meta.preBalances[idx] !== meta.postBalances[idx])
        .map(({ ak, idx }) => ({ accountAddress: ak.pubkey, balance: meta.postBalances[idx]!.toString() }));

    if (!meta.postTokenBalances) return { walletNativeBalanceUpdates }; // no changes for tokens

    const preBalancesMap = new Map(
        meta.preTokenBalances?.map(b => [b.accountIndex, b]) ?? [],
    );
    const walletTokenBalanceUpdates = meta.postTokenBalances
        .filter(postB => postB.owner && walletStore.has(postB.owner))
        .flatMap(postB => {
            if (!postB.owner || !walletStore.has(postB.owner)) return; // its not associated with ant of the users walles

            const preB = preBalancesMap.get(postB.accountIndex);
            if (!preB || preB.uiTokenAmount.amount !== postB.uiTokenAmount.amount) {
                return [{ walletAddress: postB.owner, mint: postB.mint, amount: postB.uiTokenAmount }];
            }

            return [];
        });

    return { walletNativeBalanceUpdates, walletTokenBalanceUpdates };
}

if (!tx) process.exit(0);
const res = parseTxBalancesChanges(tx);

console.log(res)
