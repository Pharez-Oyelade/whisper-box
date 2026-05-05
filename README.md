# WhisperBox — E2EE Messaging Client

> Stage 4B submission — End-to-End Encrypted Messaging Application

A production-grade secure messaging frontend built against the WhisperBox API. All encryption and decryption happens exclusively on the client using the Web Crypto API. The server never sees plaintext.

---

## Architecture Diagram

```
┌─────────────────────────────────────────────────────────┐
│                    BROWSER (Client)                      │
│                                                          │
│  ┌──────────────┐    ┌──────────────┐                   │
│  │  AuthScreen  │    │   ChatWindow │                   │
│  │  (Register / │    │  + Sidebar   │                   │
│  │   Login)     │    │              │                   │
│  └──────┬───────┘    └──────┬───────┘                   │
│         │                   │                           │
│  ┌──────▼───────────────────▼────────────────────────┐  │
│  │                   AppContext                        │  │
│  │  (auth state · messages · conversations · toasts)  │  │
│  └──────┬────────────────────────────┬───────────────┘  │
│         │                            │                   │
│  ┌──────▼───────┐           ┌────────▼────────────────┐ │
│  │  crypto/     │           │  api/  +  ws/socket     │ │
│  │  Web Crypto  │           │  REST HTTP  │  WebSocket │ │
│  │  API only    │           │             │            │ │
│  └──────────────┘           └─────────────────────────┘ │
│                                                          │
│  ┌────────────────────────────────────────────────────┐  │
│  │           In-Memory Only                            │  │
│  │   RSA Private Key (CryptoKey — non-extractable)    │  │
│  │   Access Token                                      │  │
│  └────────────────────────────────────────────────────┘  │
└────────────────────────┬────────────────────────────────┘
                         │  HTTPS / WSS
┌────────────────────────▼────────────────────────────────┐
│               WhisperBox Backend                         │
│   Stores only: ciphertext, IV, encryptedKey blobs       │
│   Never sees: plaintext messages or raw private keys    │
└─────────────────────────────────────────────────────────┘
```

---

## Encryption Flow Explanation

### Registration

1. **Key generation** — RSA-OAEP 2048-bit keypair generated in-browser via `crypto.subtle.generateKey`
2. **Salt generation** — 128-bit random salt via `crypto.getRandomValues`
3. **Key derivation** — Password + salt → AES-KW 256-bit wrapping key via PBKDF2 (100,000 iterations, SHA-256)
4. **Private key wrapping** — RSA private key wrapped (encrypted) with AES-KW → stored as opaque blob on server
5. **Public key export** — RSA public key exported as SPKI → stored on server (intentionally public)
6. Server receives `{ public_key, wrapped_private_key, pbkdf2_salt }` — **never the raw private key**

### Login / Session Restore

1. Receive `wrapped_private_key` + `pbkdf2_salt` from server
2. Re-derive AES-KW key from password + salt (same PBKDF2 parameters)
3. Unwrap (decrypt) the private key into memory as a **non-extractable** `CryptoKey`
4. Private key lives only in JavaScript memory — never written to storage

### Sending a Message

```
Plaintext → AES-GCM 256-bit (ephemeral key + 96-bit random IV) → Ciphertext
                    ↓
          AES key → RSA-OAEP encrypt → encryptedKey (for recipient)
          AES key → RSA-OAEP encrypt → encryptedKeyForSelf (to read own sent msgs)
```

All four values (`ciphertext`, `iv`, `encryptedKey`, `encryptedKeyForSelf`) are sent to the server as an opaque blob.

### Receiving a Message

```
encryptedKey → RSA-OAEP decrypt (my private key) → AES key
AES key + iv → AES-GCM decrypt → Plaintext
```

---

## Key Management

| Key | Where Generated | Where Stored | Extractable |
|---|---|---|---|
| RSA public key | Browser | Server (SPKI, base64) | Yes (by design) |
| RSA private key | Browser | Never stored in plaintext | No (non-extractable CryptoKey) |
| Wrapped private key blob | Browser | Server (AES-KW encrypted) | Not without password |
| AES-GCM session key | Browser (per message) | Never — ephemeral | No |
| AES-KW wrapping key | Derived at login | Never stored | No |
| PBKDF2 salt | Browser (at register) | Server (base64) | N/A |

**Private key invariant:** The raw RSA private key is never readable by JavaScript code after login — it is imported as `extractable: false`. It can only be used via `crypto.subtle.decrypt`. It is never serialized to `localStorage`, `sessionStorage`, `IndexedDB`, or any network request.

---

## Security Trade-offs

### What this implementation does well

- **Zero-knowledge server** — the backend stores only encrypted blobs; it cannot read any message
- **Non-extractable private key** — marked `extractable: false` at import; JS code cannot export it
- **No plaintext in storage** — access token in memory only; refresh token in `sessionStorage` (opaque, not key material)
- **Ephemeral AES keys** — a fresh AES-GCM key + IV is generated per message
- **Self-encryption** — `encryptedKeyForSelf` allows reading sent messages without the server decrypting anything
- **PBKDF2 with 100k iterations** — slows brute-force of the wrapping key if the wrapped blob is ever exposed
- **WebSocket primary, HTTP fallback** — real-time delivery with offline persistence

### Conscious trade-offs

- **Password-derived key wrapping** — the security of the wrapped private key depends on password strength. A weak password is a weak key. Mitigation: recommend strong passwords in UI (noted but not enforced beyond 8-char minimum per API spec)
- **Refresh token in sessionStorage** — cleared on tab close; not in memory to survive page reload. Acceptable trade-off because it is not cryptographic key material — session expiry forces re-login which re-derives the private key
- **No forward secrecy** — the same RSA keypair is used for all messages. If the private key is ever compromised (e.g. user's password is brute-forced), historical messages could be decrypted. True forward secrecy (e.g. Signal's Double Ratchet) would require key ratcheting, which is outside the scope of this API design
- **No key verification** — users cannot verify each other's public keys out-of-band (no safety numbers / QR codes). A compromised server could theoretically substitute a key to perform a MITM attack

### Known Limitations

1. **No Double Ratchet / forward secrecy** — same keypair for all messages; out of scope for this backend's API contract
2. **No message deletion** — the API doesn't expose a delete endpoint
3. **No read receipts** — `delivered` flag is set by the server on WebSocket delivery, not on read
4. **Single device** — keys are tied to a password-derived wrap; multi-device would require key distribution not supported by this API
5. **No replay attack protection** — the AES-GCM IV is random, not a counter; the server doesn't deduplicate message IDs client-side
6. **Bundle contains no secrets** — confirmed; all crypto keys are runtime-generated or derived, never bundled

---

## Tech Stack

- **Vite** + **React 18** + **TypeScript** — build toolchain
- **Web Crypto API** — all cryptographic operations; no third-party crypto library
- **Tailwind CSS** — utility-first styling
- **WhisperSocket** — custom WebSocket manager with exponential backoff reconnect
- **Zero runtime crypto dependencies** — only `react`, `react-dom`, and dev tooling

---

## Running Locally

```bash
npm install
npm run dev       # dev server at http://localhost:5173
npm run build     # production build → dist/
npm run preview   # preview production build
```
