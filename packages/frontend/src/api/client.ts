const BASE_URL = "http://localhost:3000"

const post = (path: string, body: object) =>
    fetch(`${BASE_URL}/${path}`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(body)
    }).then(resp => resp.json());

export const initLogin = (address: string): Promise<{ nonce: string, sessionId: string }> =>
    post("account/login-by-wallet/init", { address, walletType: "Phantom", chain: "sol" });

export const verifyLogin = (body: object) =>
    post("account/login-by-wallet/verify", body)
