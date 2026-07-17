import { jwtDecode } from "jwt-decode";
import { useAuthStore } from "../store/authStore";
import { useOnbordingStore } from "../store/onboardingStore";
import { clearMnemonic } from "../lib/vault";
import { deriveWallet } from "../lib/bip39";
import type { Connection, XYPosition } from "@xyflow/react";
import type { Base64EncodedWireTransaction, Blockhash, Signature } from "@solana/kit"
import { wipeSeed } from "../lib/seed";
import type { EdgeTransactionDataV2 } from "../store/useCanvasStore";

const BASE_URL = "http://localhost:3000"

const post = (path: string, body: object) =>
    fetch(`${BASE_URL}/${path}`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(body),
    }).then(resp => resp.json());

export const initLogin = (address: string): Promise<{ nonce: string, sessionId: string }> =>
    post("account/login-by-wallet/init", { address, walletType: "Phantom", chain: "sol" });

export const verifyLogin = (body: object) =>
    fetch(`${BASE_URL}/account/login-by-wallet/verify`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        credentials: "include",
        body: JSON.stringify(body)
    }).then(resp => resp.json());

export const refreshAccessToken = async () => {
    try {
        const res = await fetch("http://localhost:3000/account/refresh-access-token", {
            method: "POST",
            credentials: "include",
        });
        if (!res) {
            useOnbordingStore.getState().setStep("unauthenticated");
        }

        const { accessToken } = await res.json();
        const { sub } = jwtDecode<{ sub: string }>(accessToken);
        useAuthStore.getState().setUser({ id: sub }, accessToken);
        useOnbordingStore.getState().setStep("vault_check");
    } catch {
        useOnbordingStore.getState().setStep("unauthenticated");
    }
}

export const apiFetch = async (path: string, options: RequestInit = {}) => {
    const makeRequest = async (at: string) => fetch(`${BASE_URL}${path}`, {
        ...options,
        headers: {
            ...options.headers,
            Authorization: `Bearer ${at}`
        }
    });
    const token = useAuthStore.getState().accessToken;
    if (!token) {
        useOnbordingStore.getState().setStep("unauthenticated");
        throw new Error("Authentication failed")
    }
    const res = await makeRequest(token);

    if (res.status === 401) {
        await refreshAccessToken()
        const newToken = useAuthStore.getState().accessToken;
        if (!newToken) {
            useOnbordingStore.getState().setStep("unauthenticated");
            throw new Error("Authentication failed")
        }
        const retryRes = await makeRequest(newToken);
        if (retryRes.status === 401) {
            useOnbordingStore.getState().setStep("unauthenticated");
            throw new Error("Authentication failed")
        }
        return retryRes;
    }

    return res;
}

export const logout = async () => {
    try {
        await apiFetch("/account/logout", {
            method: "POST",
            credentials: "include",
        }).then(resp => resp.text());
    } catch (err) {
        console.error(err);
    } finally {
        await clearMnemonic()
        useAuthStore.getState().clearAuth();
        useOnbordingStore.getState().setStep("unauthenticated");
        wipeSeed()
    }
}

export const createEdge = async (edgeId: string, connection: Connection, edgeData: EdgeTransactionDataV2): Promise<void> => {
    const resp = await apiFetch("/edges", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
            edgeId,
            chainId: edgeData.chainId,
            source: connection.source,
            target: connection.target,
            sourceHandle: connection.sourceHandle,
            targetHandle: connection.targetHandle,
        }),
    });

    if (resp.status !== 201) throw new Error("Failed creating edge");
}

export const createWallet = async (chainCode: string, alias: string | null, position: XYPosition) => {
    try {
        while (true) {
            const { nextIndex } = await apiFetch(`/wallets/next-index?chainId=${chainCode}`, {
                method: "GET",

            }).then(resp => resp.json());

            const derivedWallet = await deriveWallet(chainCode, nextIndex);

            const resp = await apiFetch("/wallets", {
                method: "POST",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify({
                    address: derivedWallet,
                    derivationIndex: nextIndex,
                    alias,
                    chainId: chainCode, // chain instead of chain_id
                    posX: position.x,
                    posY: position.y,
                }),
            });
            if (resp.status === 409) continue;

            return resp.json()
        }
    } catch (err) {
        console.error(err);
    }
}

export const archiveWallet = async (walletId: string) => {
    try {
        await apiFetch("/wallets/archive", {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({ walletId }),
        });
    } catch (err) {
        console.error(err);
    }
}

export const getBlockhash = async (): Promise<Readonly<{
    blockhash: Blockhash;
    lastValidBlockHeight: bigint;
}>> => {
    const resp = await fetch(`${BASE_URL}/transactions/blockhash`, {
        method: "GET"
    })
    return await resp.json().then(d => ({
        blockhash: d.blockhash,
        lastValidBlockHeight: BigInt(d.lastValidBlockHeight),
    }));
}



