import { error } from './utils/logger.js'

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
      salt: salt as BufferSource,
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
  } catch (_error) {
    error('Decryption failed:', _error);
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

/**
 * Encrypts a blog post with a password
 */
export async function encryptPost(post: { title: string; content: string }, password: string): Promise<{ encryptedTitle: string; encryptedContent: string }> {
  const enc = new TextEncoder();
  const salt = window.crypto.getRandomValues(new Uint8Array(16));
  const iv = window.crypto.getRandomValues(new Uint8Array(12));
  
  const key = await getKeyFromPassword(password, salt);
  
  // Encrypt title and content separately
  const encryptedTitle = await window.crypto.subtle.encrypt(
    {
      name: 'AES-GCM',
      iv
    },
    key,
    enc.encode(post.title)
  );
  
  const encryptedContent = await window.crypto.subtle.encrypt(
    {
      name: 'AES-GCM',
      iv
    },
    key,
    enc.encode(post.content)
  );
  
  // Combine salt, iv, and encrypted data for each field
  const combinedTitle = new Uint8Array(salt.length + iv.length + new Uint8Array(encryptedTitle).length);
  combinedTitle.set(salt, 0);
  combinedTitle.set(iv, salt.length);
  combinedTitle.set(new Uint8Array(encryptedTitle), salt.length + iv.length);
  
  const combinedContent = new Uint8Array(salt.length + iv.length + new Uint8Array(encryptedContent).length);
  combinedContent.set(salt, 0);
  combinedContent.set(iv, salt.length);
  combinedContent.set(new Uint8Array(encryptedContent), salt.length + iv.length);
  
  // Convert to base64 for string storage
  return {
    encryptedTitle: btoa(String.fromCharCode(...combinedTitle)),
    encryptedContent: btoa(String.fromCharCode(...combinedContent))
  };
}

/**
 * Decrypts a blog post with a password
 */
export async function decryptPost(encryptedData: { title: string; content: string }, password: string): Promise<{ title: string; content: string }> {
  try {
    if (!encryptedData.title || !encryptedData.content) {
      throw new Error('Missing encrypted title or content');
    }

    if (!isValidBase64(encryptedData.title) || !isValidBase64(encryptedData.content)) {
      throw new Error('Invalid base64 encoding');
    }

    const encryptedTitleBytes = Uint8Array.from(atob(encryptedData.title), c => c.charCodeAt(0));
    const encryptedContentBytes = Uint8Array.from(atob(encryptedData.content), c => c.charCodeAt(0));
    
    // Extract salt, iv, and encrypted data for both fields
    const salt = encryptedTitleBytes.slice(0, 16);
    const iv = encryptedTitleBytes.slice(16, 28);
    const titleData = encryptedTitleBytes.slice(28);
    const contentData = encryptedContentBytes.slice(28);
    const key = await getKeyFromPassword(password, salt);
    
    // Decrypt both fields
    const decryptedTitle = await window.crypto.subtle.decrypt(
      {
        name: 'AES-GCM',
        iv
      },
      key,
      titleData
    );
    const decryptedContent = await window.crypto.subtle.decrypt(
      {
        name: 'AES-GCM',
        iv
      },
      key,
      contentData
    );

    return {
      title: new TextDecoder().decode(decryptedTitle),
      content: new TextDecoder().decode(decryptedContent)
    };
  } catch (_error: any) {
    error('Error decrypting post:', _error);
    throw new Error(`Decryption failed: ${_error?.message || 'Unknown error'}`);
  }
}

// Helper function to validate base64 strings
function isValidBase64(str: string): boolean {
  try {
    // Check if the string matches base64 pattern
    return /^[A-Za-z0-9+/]*={0,2}$/.test(str);
  } catch {
    return false;
  }
}

/**
 * Checks if a post is encrypted
 */
export function isEncryptedPost(post: { title: string; content: string }): boolean {
  try {
    // Attempt to decode as base64
    const decodedTitle = atob(post.title);
    const decodedContent = atob(post.content);
    // A properly encrypted post would be long enough
    return decodedTitle.length > 50 && decodedContent.length > 50;
  } catch {
    return false;
  }
} 