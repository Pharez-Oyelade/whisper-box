export interface User {
  id: string;
  username: string;
  display_name: string;
  public_key: string;
  wrapped_private_key: string;
  pbkdf2_salt: string;
  created_at: string;
}

export interface AuthResponse {
  access_token: string;
  refresh_token: string;
  token_type: string;
  expires_in: number;
  user: User;
}

export interface MessagePayload {
  ciphertext: string;
  iv: string;
  encryptedKey: string;
  encryptedKeyForSelf: string;
}

export interface RawMessage {
  id: string;
  from_user_id: string;
  to_user_id: string;
  payload: MessagePayload;
  delivered: boolean;
  created_at: string;
}

export interface DecryptedMessage {
  id: string;
  from_user_id: string;
  to_user_id: string;
  payload: MessagePayload;
  delivered: boolean;
  created_at: string;
  text: string | null;
  decryptError: boolean;
  pending?: boolean;
}

export interface Conversation {
  user_id: string;
  display_name: string;
  username: string;
  last_message_at: string;
}

export interface SearchUser {
  id: string;
  username: string;
  display_name: string;
}

export type ToastVariant = "success" | "error" | "info";

export interface Toast {
  id: string;
  message: string;
  variant: ToastVariant;
}

export interface CryptoSession {
  privateKey: CryptoKey;
  publicKey: CryptoKey;
}
