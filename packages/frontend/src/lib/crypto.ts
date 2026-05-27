export const encryptMnemonic = async (mnemonic: string, password: string) => {
    const keyBytes = await crypto.subtle.importKey(
        "raw",
        Buffer.from(password),
        "PBKDF2",
        false,
        ["deriveKey"],
    );

    const salt = crypto.getRandomValues(new Uint8Array(16));
    const key = await crypto.subtle.deriveKey(
        {
            name: "PBKDF2",
            salt,
            iterations: 600_000,
            hash: "SHA-256"
        },
        keyBytes,
        { name: "AES-GCM", length: 256 },
        false,
        ["encrypt"],
    );

    const iv = crypto.getRandomValues(new Uint8Array(12));
    const encryptedMnemonic = await crypto.subtle.encrypt({ name: "AES-GCM", iv }, key, Buffer.from(mnemonic));

    const combinedBlob = new Uint8Array(salt.length + iv.length + encryptedMnemonic.byteLength);
    combinedBlob.set(salt, 0);
    combinedBlob.set(iv, salt.length);
    combinedBlob.set(new Uint8Array(encryptedMnemonic), salt.length + iv.length);

    return combinedBlob;
}

export const decryptMnemonic = async (combinedBlob: Uint8Array, password: string) => {
    const salt = combinedBlob.slice(0, 16);
    const iv = combinedBlob.slice(16, 28);
    const encryptedMnemonic = combinedBlob.slice(28);

    const keyBytes = await crypto.subtle.importKey(
        "raw",
        Buffer.from(password),
        "PBKDF2",
        false,
        ["deriveKey"],
    );

    const key = await crypto.subtle.deriveKey(
        {
            name: "PBKDF2",
            salt,
            iterations: 600_000,
            hash: "SHA-256"
        },
        keyBytes,
        { name: "AES-GCM", length: 256 },
        false,
        ["decrypt"],
    );

    const decrypedMnemonic = await crypto.subtle.decrypt({ name: "AES-GCM", iv }, key, Buffer.from(encryptedMnemonic));

    return Buffer.from(decrypedMnemonic).toString();
}
