import { openDB } from "idb"

const DB_NAME = "ar-db"
const STORE_NAME = "vault"

export const checkMnemonicExists = async (): Promise<boolean> => {
    const db = await openDB(DB_NAME, 1, {
        upgrade(db) {
            if (!db.objectStoreNames.contains(STORE_NAME)) {
                db.createObjectStore(STORE_NAME);
            }
        }
    })
    const value = await db.get(STORE_NAME, "encrypted_mnemonic");
    return value !== undefined;
}
