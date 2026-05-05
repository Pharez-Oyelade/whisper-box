import type {
  AuthResponse,
  Conversation,
  RawMessage,
  SearchUser,
  User,
} from "../types";

const BASE = "https://whisperbox.koyeb.app";

let _accessToken: string | null = null;
let _refreshToken: string | null = null;
let _onSessionExpired: (() => void) | null = null;

export function setTokens(access: string, refresh: string) {
  _accessToken = access;
  _refreshToken = refresh;
  sessionStorage.setItem("wb_rt", refresh);
}

export function clearTokens() {
  _accessToken = null;
  _refreshToken = null;
  sessionStorage.removeItem("wb_rt");
}

export function getAccessToken(): string | null {
  return _accessToken;
}

export function onSessionExpired(cb: () => void) {
  _onSessionExpired = cb;
}

// Token Refresh

let _refreshing: Promise<string> | null = null;

async function refreshAccessToken(): Promise<string> {
  if (_refreshing) return _refreshing;

  _refreshing = (async () => {
    const rt = _refreshToken ?? sessionStorage.getItem("wb_rt");
    if (!rt) throw new Error("No refresh token");

    const res = await fetch(`${BASE}/auth/refresh`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ refresh_token: rt }),
    });

    if (!res.ok) {
      clearTokens();
      _onSessionExpired?.();
      throw new Error("Session expired");
    }

    const data = await res.json();
    _accessToken = data.access_token;
    return data.access_token as string;
  })().finally(() => {
    _refreshing = null;
  });

  return _refreshing;
}

// Authenticated Fetch

async function authFetch(
  path: string,
  init: RequestInit = {},
): Promise<Response> {
  if (!_accessToken) throw new Error("Not authenticated");

  const doRequest = (token: string) =>
    fetch(`${BASE}${path}`, {
      ...init,
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${token}`,
        ...(init.headers ?? {}),
      },
    });

  let res = await doRequest(_accessToken);

  if (res.status === 401) {
    const fresh = await refreshAccessToken();
    res = await doRequest(fresh);
  }

  return res;
}

// Auth

export async function apiRegister(body: {
  username: string;
  display_name: string;
  password: string;
  public_key: string;
  wrapped_private_key: string;
  pbkdf2_salt: string;
}): Promise<AuthResponse> {
  const res = await fetch(`${BASE}/auth/register`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(body),
  });
  if (!res.ok) {
    const err = await res
      .json()
      .catch(() => ({ detail: "Registration failed" }));
    throw new Error(
      typeof err.detail === "string"
        ? err.detail
        : Array.isArray(err.detail)
          ? (err.detail[0]?.msg ?? "Validation error")
          : "Registration failed",
    );
  }
  return res.json();
}

export async function apiLogin(
  username: string,
  password: string,
): Promise<AuthResponse> {
  const res = await fetch(`${BASE}/auth/login`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ username, password }),
  });
  if (!res.ok) {
    const err = await res
      .json()
      .catch(() => ({ detail: "Invalid credentials" }));
    throw new Error(
      typeof err.detail === "string" ? err.detail : "Invalid credentials",
    );
  }
  return res.json();
}

export async function apiLogout(): Promise<void> {
  const rt = _refreshToken ?? sessionStorage.getItem("wb_rt");
  if (!rt || !_accessToken) return;
  await authFetch("/auth/logout", {
    method: "POST",
    body: JSON.stringify({ refresh_token: rt }),
  }).catch(() => {});
  clearTokens();
}

export async function apiGetMe(): Promise<User> {
  const res = await authFetch("/auth/me");
  if (!res.ok) throw new Error("Failed to load profile");
  return res.json();
}

// Users

export async function apiSearchUsers(q: string): Promise<SearchUser[]> {
  const res = await authFetch(`/users/search?q=${encodeURIComponent(q)}`);
  if (!res.ok) throw new Error("Search failed");
  return res.json();
}

export async function apiGetPublicKey(userId: string): Promise<string> {
  const res = await authFetch(`/users/${userId}/public-key`);
  if (!res.ok) throw new Error("Could not fetch public key");
  const data = await res.json();
  return data.public_key as string;
}

// Messages

export async function apiGetConversations(): Promise<Conversation[]> {
  const res = await authFetch("/conversations");
  if (!res.ok) throw new Error("Failed to load conversations");
  return res.json();
}

export async function apiGetMessages(
  userId: string,
  limit = 50,
  before?: string,
): Promise<RawMessage[]> {
  const params = new URLSearchParams({ limit: String(limit) });
  if (before) params.set("before", before);
  const res = await authFetch(`/conversations/${userId}/messages?${params}`);
  if (!res.ok) throw new Error("Failed to load messages");
  return res.json();
}

export async function apiSendMessage(
  to: string,
  payload: {
    ciphertext: string;
    iv: string;
    encryptedKey: string;
    encryptedKeyForSelf: string;
  },
): Promise<RawMessage> {
  const res = await authFetch("/messages", {
    method: "POST",
    body: JSON.stringify({ to, payload }),
  });
  if (!res.ok) {
    const err = await res.json().catch(() => ({ detail: "Send failed" }));
    throw new Error(
      typeof err.detail === "string" ? err.detail : "Send failed",
    );
  }
  return res.json();
}
