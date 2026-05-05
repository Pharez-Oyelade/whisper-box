export function bufferToBase64(buffer: ArrayBuffer): string {
  const bytes = new Uint8Array(buffer);
  let binary = "";
  for (let i = 0; i < bytes.byteLength; i++) {
    binary += String.fromCharCode(bytes[i]);
  }
  return btoa(binary);
}

export function base64ToBuffer(base64: string): ArrayBuffer {
  const binary = atob(base64);
  const bytes = new Uint8Array(binary.length);
  for (let i = 0; i < binary.length; i++) {
    bytes[i] = binary.charCodeAt(i);
  }
  return bytes.buffer;
}

// Key Generation

/** Generate RSA-OAEP 2048-bit key */
export async function generateKeyPair(): Promise<CryptoKeyPair> {
  return crypto.subtle.generateKey(
    {
      name: "RSA-OAEP",
      modulusLength: 2048,
      publicExponent: new Uint8Array([1, 0, 1]),
      hash: "SHA-256",
    },
    true,
    ["encrypt", "decrypt"],
  );
}

/** Generate random 128-bit PBKDF2 salt */
export function generateSalt(): Uint8Array {
  return crypto.getRandomValues(new Uint8Array(16));
}

// Key Wrapping / Unwrapping

async function deriveWrappingKey(
  password: string,
  salt: Uint8Array,
): Promise<CryptoKey> {
  const keyMaterial = await crypto.subtle.importKey(
    "raw",
    new TextEncoder().encode(password),
    "PBKDF2",
    false,
    ["deriveKey"],
  );

  return crypto.subtle.deriveKey(
    {
      name: "PBKDF2",
      salt: new Uint8Array(salt).buffer,
      iterations: 100_000,
      hash: "SHA-256",
    },
    keyMaterial,
    { name: "AES-KW", length: 256 },
    false,
    ["wrapKey", "unwrapKey"],
  );
}

/** encrypt RSA private key with AES-KW */
export async function wrapPrivateKey(
  privateKey: CryptoKey,
  wrappingKey: CryptoKey,
): Promise<string> {
  const wrapped = await crypto.subtle.wrapKey(
    "pkcs8",
    privateKey,
    wrappingKey,
    "AES-KW",
  );
  return bufferToBase64(wrapped);
}

/** Unwrap RSA private key from base64 */
export async function unwrapPrivateKey(
  wrappedBase64: string,
  wrappingKey: CryptoKey,
): Promise<CryptoKey> {
  return crypto.subtle.unwrapKey(
    "pkcs8",
    base64ToBuffer(wrappedBase64),
    wrappingKey,
    { name: "AES-KW" },
    { name: "RSA-OAEP", hash: "SHA-256" },
    false,
    ["decrypt"],
  );
}

// Public Key Import / Export

export async function exportPublicKey(publicKey: CryptoKey): Promise<string> {
  const spki = await crypto.subtle.exportKey("spki", publicKey);
  return bufferToBase64(spki);
}

export async function importPublicKey(base64: string): Promise<CryptoKey> {
  return crypto.subtle.importKey(
    "spki",
    base64ToBuffer(base64),
    { name: "RSA-OAEP", hash: "SHA-256" },
    true,
    ["encrypt"],
  );
}

// Full Session Setup (Registration)
export async function setupCryptoForRegistration(password: string) {
  const keyPair = await generateKeyPair();
  const salt = generateSalt();
  const wrappingKey = await deriveWrappingKey(password, salt);

  const [wrappedPrivateKey, publicKeyBase64] = await Promise.all([
    wrapPrivateKey(keyPair.privateKey, wrappingKey),
    exportPublicKey(keyPair.publicKey),
  ]);

  return {
    keyPair,
    publicKeyBase64,
    wrappedPrivateKeyBase64: wrappedPrivateKey,
    saltBase64: bufferToBase64(salt.buffer as ArrayBuffer),
  };
}

// Login
export async function restoreCryptoSession(
  password: string,
  wrappedPrivateKeyBase64: string,
  saltBase64: string,
  publicKeyBase64: string,
): Promise<{ privateKey: CryptoKey; publicKey: CryptoKey }> {
  const salt = new Uint8Array(base64ToBuffer(saltBase64));
  const wrappingKey = await deriveWrappingKey(password, salt);

  const [privateKey, publicKey] = await Promise.all([
    unwrapPrivateKey(wrappedPrivateKeyBase64, wrappingKey),
    importPublicKey(publicKeyBase64),
  ]);

  return { privateKey, publicKey };
}

// Message Encryption

export async function encryptMessage(
  plaintext: string,
  recipientPublicKey: CryptoKey,
  senderPublicKey: CryptoKey,
): Promise<{
  ciphertext: string;
  iv: string;
  encryptedKey: string;
  encryptedKeyForSelf: string;
}> {
  // Generate AES-GCM key and 96-bit IV
  const aesKey = await crypto.subtle.generateKey(
    { name: "AES-GCM", length: 256 },
    true,
    ["encrypt", "decrypt"],
  );
  const iv = crypto.getRandomValues(new Uint8Array(12));

  // Encrypt the plaintext with AES-GCM
  const ciphertext = await crypto.subtle.encrypt(
    { name: "AES-GCM", iv: iv.buffer as ArrayBuffer },
    aesKey,
    new TextEncoder().encode(plaintext),
  );

  // Export the raw AES key so we can RSA-wrap it
  const aesKeyRaw = await crypto.subtle.exportKey("raw", aesKey);

  // Encrypt AES key for recipient + for self (to read own sent messages)
  const [encryptedKey, encryptedKeyForSelf] = await Promise.all([
    crypto.subtle.encrypt({ name: "RSA-OAEP" }, recipientPublicKey, aesKeyRaw),
    crypto.subtle.encrypt({ name: "RSA-OAEP" }, senderPublicKey, aesKeyRaw),
  ]);

  return {
    ciphertext: bufferToBase64(ciphertext),
    iv: bufferToBase64(iv.buffer as ArrayBuffer),
    encryptedKey: bufferToBase64(encryptedKey),
    encryptedKeyForSelf: bufferToBase64(encryptedKeyForSelf),
  };
}

// Message Decryption

export async function decryptMessage(
  payload: {
    ciphertext: string;
    iv: string;
    encryptedKey: string;
    encryptedKeyForSelf: string;
  },
  privateKey: CryptoKey,
  isSender: boolean,
): Promise<string> {
  // Use the appropriate wrapped key copy
  const wrappedAesKeyBase64 = isSender
    ? payload.encryptedKeyForSelf
    : payload.encryptedKey;

  // Decrypt the AES key using our RSA private key
  const aesKeyRaw = await crypto.subtle.decrypt(
    { name: "RSA-OAEP" },
    privateKey,
    base64ToBuffer(wrappedAesKeyBase64),
  );

  // Import raw AES key
  const aesKey = await crypto.subtle.importKey(
    "raw",
    aesKeyRaw,
    { name: "AES-GCM" },
    false,
    ["decrypt"],
  );

  // Decrypt the ciphertext
  const plaintext = await crypto.subtle.decrypt(
    { name: "AES-GCM", iv: base64ToBuffer(payload.iv) },
    aesKey,
    base64ToBuffer(payload.ciphertext),
  );

  return new TextDecoder().decode(plaintext);
}
