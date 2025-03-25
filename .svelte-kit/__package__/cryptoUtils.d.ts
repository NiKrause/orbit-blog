/**
 * Encrypts a seedPhrase with a password
 */
export declare function encryptSeedPhrase(seedPhrase: string, password: string): Promise<string>;
/**
 * Decrypts a seedPhrase with a password
 */
export declare function decryptSeedPhrase(encryptedData: string, password: string): Promise<string>;
/**
 * Checks if a string is likely an encrypted seed phrase
 */
export declare function isEncryptedSeedPhrase(data: string): boolean;
//# sourceMappingURL=cryptoUtils.d.ts.map