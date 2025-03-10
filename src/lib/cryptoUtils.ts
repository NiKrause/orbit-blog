// Utility functions for encryption/decryption of seed phrases

/**
 * Generates a cryptographic key from a password
 */
async function getKeyFromPassword(password: string, salt: Uint8Array): Promise<CryptoKey> {
  const enc = new TextEncoder();
  const keyMaterial = await window.crypto.subtle.importKey(
    'raw',
    enc.encode(password),
    { name: 'PBKDF2' },
    false,
    ['deriveBits', 'deriveKey']
  );
  
  return window.crypto.subtle.deriveKey(
    {
      name: 'PBKDF2',
      salt,
      iterations: 100000,
      hash: 'SHA-256'
    },
    keyMaterial,
    { name: 'AES-GCM', length: 256 },
    false,
    ['encrypt', 'decrypt']
  );
}

/**
 * Encrypts a seedPhrase with a password
 */
export async function encryptSeedPhrase(seedPhrase: string, password: string): Promise<string> {
  const enc = new TextEncoder();
  const salt = window.crypto.getRandomValues(new Uint8Array(16));
  const iv = window.crypto.getRandomValues(new Uint8Array(12));
  
  const key = await getKeyFromPassword(password, salt);
  
  const encrypted = await window.crypto.subtle.encrypt(
    {
      name: 'AES-GCM',
      iv
    },
    key,
    enc.encode(seedPhrase)
  );
  
  // Combine salt, iv, and encrypted data into one array for storage
  const combined = new Uint8Array(salt.length + iv.length + new Uint8Array(encrypted).length);
  combined.set(salt, 0);
  combined.set(iv, salt.length);
  combined.set(new Uint8Array(encrypted), salt.length + iv.length);
  
  // Convert to base64 for string storage
  return btoa(String.fromCharCode(...combined));
}

/**
 * Decrypts a seedPhrase with a password
 */
export async function decryptSeedPhrase(encryptedData: string, password: string): Promise<string> {
  try {
    // Convert from base64 to array
    const encryptedBytes = Uint8Array.from(atob(encryptedData), c => c.charCodeAt(0));
    
    // Extract salt, iv, and encrypted data
    const salt = encryptedBytes.slice(0, 16);
    const iv = encryptedBytes.slice(16, 28);
    const data = encryptedBytes.slice(28);
    
    const key = await getKeyFromPassword(password, salt);
    
    const decrypted = await window.crypto.subtle.decrypt(
      {
        name: 'AES-GCM',
        iv
      },
      key,
      data
    );
    
    return new TextDecoder().decode(decrypted);
  } catch (error) {
    console.error('Decryption failed:', error);
    throw new Error('Invalid password or corrupted data');
  }
}

/**
 * Checks if a string is likely an encrypted seed phrase
 */
export function isEncryptedSeedPhrase(data: string): boolean {
  try {
    // Attempt to decode as base64
    const decoded = atob(data);
    // A properly encrypted seed phrase would be long enough
    return decoded.length > 50;
  } catch {
    return false;
  }
} 