import { openDB } from "idb"

const DB_NAME = "ar-db"
const STORE_NAME = "vault"

const connectDb = async () => {
    return await openDB(DB_NAME, 1, {
        upgrade(db) {
            if (!db.objectStoreNames.contains(STORE_NAME)) {
                db.createObjectStore(STORE_NAME);
            }
        }
    });
}

export const checkMnemonicExists = async (): Promise<boolean> => {
    const db = await connectDb();
    const value = await db.get(STORE_NAME, "encrypted_mnemonic");
    return value !== undefined;
}

export const saveMnemonic = async (encryptedBlob: Uint8Array<ArrayBuffer>) => {
    try {
        const db = await connectDb();
        await db.put(STORE_NAME, encryptedBlob, "encrypted_mnemonic");
        return true
    } catch (err) {
        console.error("Failed to save mnemonic", err)
        return false
    }
}

