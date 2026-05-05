// import {
//   createContext,
//   useCallback,
//   useContext,
//   useEffect,
//   useMemo,
//   useReducer,
//   useRef,
//   type ReactNode,
// } from "react";
// import {
//   apiGetConversations,
//   apiGetMessages,
//   apiGetPublicKey,
//   apiLogin,
//   apiLogout,
//   apiRegister,
//   apiSendMessage,
//   clearTokens,
//   getAccessToken,
//   onSessionExpired,
//   setTokens,
// } from "../api";
// import {
//   decryptMessage,
//   encryptMessage,
//   importPublicKey,
//   restoreCryptoSession,
//   setupCryptoForRegistration,
// } from "../crypto";
// import type {
//   Conversation,
//   CryptoSession,
//   DecryptedMessage,
//   RawMessage,
//   Toast,
//   ToastVariant,
//   User,
// } from "../types";
// import { WhisperSocket } from "../ws/socket";

// interface AppState {
//   user: User | null;
//   crypto: CryptoSession | null;
//   conversations: Conversation[];
//   messages: Record<string, DecryptedMessage[]>;
//   activeConversationId: string | null;
//   onlineUsers: Set<string>;
//   wsConnected: boolean;
//   toasts: Toast[];
//   loadingConversations: boolean;
//   loadingMessages: boolean;
// }

// type Action =
//   | { type: "LOGGED_IN"; user: User; crypto: CryptoSession }
//   | { type: "LOGGED_OUT" }
//   | { type: "SET_CONVERSATIONS"; conversations: Conversation[] }
//   | { type: "SET_MESSAGES"; userId: string; messages: DecryptedMessage[] }
//   | { type: "PREPEND_MESSAGES"; userId: string; messages: DecryptedMessage[] }
//   | { type: "APPEND_MESSAGE"; userId: string; message: DecryptedMessage }
//   | {
//       type: "REPLACE_PENDING";
//       userId: string;
//       pendingId: string;
//       message: DecryptedMessage;
//     }
//   | { type: "SET_ACTIVE"; userId: string | null }
//   | { type: "USER_ONLINE"; userId: string }
//   | { type: "USER_OFFLINE"; userId: string }
//   | { type: "WS_STATUS"; connected: boolean }
//   | { type: "ADD_TOAST"; toast: Toast }
//   | { type: "REMOVE_TOAST"; id: string }
//   | { type: "LOADING_CONVERSATIONS"; loading: boolean }
//   | { type: "LOADING_MESSAGES"; loading: boolean }
//   | { type: "UPSERT_CONVERSATION"; conv: Conversation };

// const initial: AppState = {
//   user: null,
//   crypto: null,
//   conversations: [],
//   messages: {},
//   activeConversationId: null,
//   onlineUsers: new Set(),
//   wsConnected: false,
//   toasts: [],
//   loadingConversations: false,
//   loadingMessages: false,
// };

// function reducer(state: AppState, action: Action): AppState {
//   switch (action.type) {
//     case "LOGGED_IN":
//       return { ...initial, user: action.user, crypto: action.crypto };

//     case "LOGGED_OUT":
//       return { ...initial };

//     case "SET_CONVERSATIONS":
//       return { ...state, conversations: action.conversations };

//     case "UPSERT_CONVERSATION": {
//       const exists = state.conversations.some(
//         (c) => c.user_id === action.conv.user_id,
//       );
//       const updated = exists
//         ? state.conversations.map((c) =>
//             c.user_id === action.conv.user_id ? action.conv : c,
//           )
//         : [action.conv, ...state.conversations];
//       return {
//         ...state,
//         conversations: updated.sort(
//           (a, b) =>
//             new Date(b.last_message_at).getTime() -
//             new Date(a.last_message_at).getTime(),
//         ),
//       };
//     }

//     case "SET_MESSAGES":
//       return {
//         ...state,
//         messages: { ...state.messages, [action.userId]: action.messages },
//       };

//     case "PREPEND_MESSAGES": {
//       const existing = state.messages[action.userId] ?? [];
//       return {
//         ...state,
//         messages: {
//           ...state.messages,
//           [action.userId]: [...action.messages, ...existing],
//         },
//       };
//     }

//     case "APPEND_MESSAGE": {
//       const existing = state.messages[action.userId] ?? [];
//       // Deduplicate by id
//       if (existing.some((m) => m.id === action.message.id)) return state;
//       return {
//         ...state,
//         messages: {
//           ...state.messages,
//           [action.userId]: [...existing, action.message],
//         },
//       };
//     }

//     case "REPLACE_PENDING": {
//       const existing = state.messages[action.userId] ?? [];
//       return {
//         ...state,
//         messages: {
//           ...state.messages,
//           [action.userId]: existing.map((m) =>
//             m.id === action.pendingId ? action.message : m,
//           ),
//         },
//       };
//     }

//     case "SET_ACTIVE":
//       return { ...state, activeConversationId: action.userId };

//     case "USER_ONLINE": {
//       const next = new Set(state.onlineUsers);
//       next.add(action.userId);
//       return { ...state, onlineUsers: next };
//     }

//     case "USER_OFFLINE": {
//       const next = new Set(state.onlineUsers);
//       next.delete(action.userId);
//       return { ...state, onlineUsers: next };
//     }

//     case "WS_STATUS":
//       return { ...state, wsConnected: action.connected };

//     case "ADD_TOAST":
//       return { ...state, toasts: [...state.toasts, action.toast] };

//     case "REMOVE_TOAST":
//       return {
//         ...state,
//         toasts: state.toasts.filter((t) => t.id !== action.id),
//       };

//     case "LOADING_CONVERSATIONS":
//       return { ...state, loadingConversations: action.loading };

//     case "LOADING_MESSAGES":
//       return { ...state, loadingMessages: action.loading };

//     default:
//       return state;
//   }
// }

// interface AppContextValue {
//   state: AppState;
//   login: (username: string, password: string) => Promise<void>;
//   register: (
//     username: string,
//     displayName: string,
//     password: string,
//   ) => Promise<void>;
//   logout: () => Promise<void>;
//   loadConversations: () => Promise<void>;
//   openConversation: (
//     userId: string,
//     displayName: string,
//     username: string,
//   ) => Promise<void>;
//   loadOlderMessages: (userId: string) => Promise<void>;
//   sendMessage: (recipientId: string, text: string) => Promise<void>;
//   toast: (message: string, variant?: ToastVariant) => void;
//   dismissToast: (id: string) => void;
// }

// const AppContext = createContext<AppContextValue | null>(null);

// export function AppProvider({ children }: { children: ReactNode }) {
//   const [state, dispatch] = useReducer(reducer, initial);

//   const stateRef = useRef(state);
//   stateRef.current = state;

//   // Public-key cache
//   const pkCache = useRef<Map<string, CryptoKey>>(new Map());

//   // WebSocket
//   const socket = useRef<WhisperSocket>(new WhisperSocket(getAccessToken));

//   // Toast

//   const toast = useCallback(
//     (message: string, variant: ToastVariant = "info") => {
//       const id = crypto.randomUUID();
//       dispatch({ type: "ADD_TOAST", toast: { id, message, variant } });
//       setTimeout(() => dispatch({ type: "REMOVE_TOAST", id }), 4000);
//     },
//     [],
//   );

//   const dismissToast = useCallback((id: string) => {
//     dispatch({ type: "REMOVE_TOAST", id });
//   }, []);

//   // key

//   const getOrFetchPublicKey = useCallback(
//     async (userId: string): Promise<CryptoKey> => {
//       if (pkCache.current.has(userId)) return pkCache.current.get(userId)!;
//       const b64 = await apiGetPublicKey(userId);
//       const key = await importPublicKey(b64);
//       pkCache.current.set(userId, key);
//       return key;
//     },
//     [],
//   );

//   // Message decryption

//   const decryptRaw = useCallback(
//     async (raw: RawMessage, myId: string): Promise<DecryptedMessage> => {
//       const { crypto: cs } = stateRef.current;
//       if (!cs) throw new Error("No crypto session");

//       const isSender = raw.from_user_id === myId;
//       try {
//         const text = await decryptMessage(raw.payload, cs.privateKey, isSender);
//         return { ...raw, text, decryptError: false };
//       } catch {
//         return { ...raw, text: null, decryptError: true };
//       }
//     },
//     [],
//   );

//   // WebSocket setup

//   useEffect(() => {
//     const ws = socket.current;

//     const offConnected = ws.on("connected", () => {
//       dispatch({ type: "WS_STATUS", connected: true });
//     });

//     const offDisconnected = ws.on("disconnected", () => {
//       dispatch({ type: "WS_STATUS", connected: false });
//     });

//     const offMessage = ws.on("message.receive", async (data: unknown) => {
//       const raw = data as RawMessage & {
//         from_user_id: string;
//         to_user_id: string;
//       };
//       const { user } = stateRef.current;
//       if (!user) return;

//       const peerId =
//         raw.from_user_id === user.id ? raw.to_user_id : raw.from_user_id;

//       const decrypted = await decryptRaw(raw, user.id);
//       dispatch({ type: "APPEND_MESSAGE", userId: peerId, message: decrypted });

//       // Keep conversation list up to date
//       dispatch({
//         type: "UPSERT_CONVERSATION",
//         conv: {
//           user_id: peerId,
//           display_name: peerId, // will be updated when conversations refresh
//           username: peerId,
//           last_message_at: raw.created_at,
//         },
//       });
//     });

//     const offOnline = ws.on("user.online", (data: unknown) => {
//       const d = data as { user_id: string };
//       dispatch({ type: "USER_ONLINE", userId: d.user_id });
//     });

//     const offOffline = ws.on("user.offline", (data: unknown) => {
//       const d = data as { user_id: string };
//       dispatch({ type: "USER_OFFLINE", userId: d.user_id });
//     });

//     return () => {
//       offConnected();
//       offDisconnected();
//       offMessage();
//       offOnline();
//       offOffline();
//     };
//   }, [decryptRaw]);

//   // Session expiry → logout
//   useEffect(() => {
//     onSessionExpired(() => {
//       dispatch({ type: "LOGGED_OUT" });
//       socket.current.disconnect();
//       toast("Your session expired. Please log in again.", "error");
//     });
//   }, [toast]);

//   // Auth

//   const login = useCallback(async (username: string, password: string) => {
//     const data = await apiLogin(username, password);
//     setTokens(data.access_token, data.refresh_token);

//     const cs = await restoreCryptoSession(
//       password,
//       data.user.wrapped_private_key,
//       data.user.pbkdf2_salt,
//       data.user.public_key,
//     );

//     dispatch({ type: "LOGGED_IN", user: data.user, crypto: cs });
//     pkCache.current.clear();
//     socket.current.connect();
//   }, []);

//   const register = useCallback(
//     async (username: string, displayName: string, password: string) => {
//       const { publicKeyBase64, wrappedPrivateKeyBase64, saltBase64, keyPair } =
//         await setupCryptoForRegistration(password);

//       const data = await apiRegister({
//         username,
//         display_name: displayName,
//         password,
//         public_key: publicKeyBase64,
//         wrapped_private_key: wrappedPrivateKeyBase64,
//         pbkdf2_salt: saltBase64,
//       });

//       setTokens(data.access_token, data.refresh_token);
//       dispatch({
//         type: "LOGGED_IN",
//         user: data.user,
//         crypto: {
//           privateKey: keyPair.privateKey,
//           publicKey: keyPair.publicKey,
//         },
//       });
//       pkCache.current.clear();
//       socket.current.connect();
//     },
//     [],
//   );

//   const logout = useCallback(async () => {
//     socket.current.disconnect();
//     await apiLogout();
//     clearTokens();
//     pkCache.current.clear();
//     dispatch({ type: "LOGGED_OUT" });
//   }, []);

//   // Conversation actions

//   const loadConversations = useCallback(async () => {
//     dispatch({ type: "LOADING_CONVERSATIONS", loading: true });
//     try {
//       const convs = await apiGetConversations();
//       dispatch({ type: "SET_CONVERSATIONS", conversations: convs });
//     } catch (e) {
//       toast((e as Error).message, "error");
//     } finally {
//       dispatch({ type: "LOADING_CONVERSATIONS", loading: false });
//     }
//   }, [toast]);

//   const openConversation = useCallback(
//     async (userId: string, displayName: string, username: string) => {
//       dispatch({ type: "SET_ACTIVE", userId });

//       // Ensure this user appears in sidebar
//       dispatch({
//         type: "UPSERT_CONVERSATION",
//         conv: {
//           user_id: userId,
//           display_name: displayName,
//           username,
//           last_message_at: new Date().toISOString(),
//         },
//       });

//       // Only fetch if we don't already have messages
//       if (stateRef.current.messages[userId]) return;

//       dispatch({ type: "LOADING_MESSAGES", loading: true });
//       try {
//         const { user } = stateRef.current;
//         if (!user) return;

//         const raws = await apiGetMessages(userId, 50);
//         // API returns newest-first; reverse for chronological display
//         const sorted = [...raws].reverse();
//         const decrypted = await Promise.all(
//           sorted.map((r) => decryptRaw(r, user.id)),
//         );
//         dispatch({ type: "SET_MESSAGES", userId, messages: decrypted });
//       } catch (e) {
//         toast((e as Error).message, "error");
//       } finally {
//         dispatch({ type: "LOADING_MESSAGES", loading: false });
//       }
//     },
//     [toast, decryptRaw],
//   );

//   const loadOlderMessages = useCallback(
//     async (userId: string) => {
//       const { messages, user } = stateRef.current;
//       const existing = messages[userId] ?? [];
//       if (existing.length === 0 || !user) return;

//       const oldest = existing[0];
//       dispatch({ type: "LOADING_MESSAGES", loading: true });
//       try {
//         const raws = await apiGetMessages(userId, 50, oldest.created_at);
//         if (raws.length === 0) return;
//         const sorted = [...raws].reverse();
//         const decrypted = await Promise.all(
//           sorted.map((r) => decryptRaw(r, user.id)),
//         );
//         dispatch({ type: "PREPEND_MESSAGES", userId, messages: decrypted });
//       } catch (e) {
//         toast((e as Error).message, "error");
//       } finally {
//         dispatch({ type: "LOADING_MESSAGES", loading: false });
//       }
//     },
//     [toast, decryptRaw],
//   );

//   // Send message

//   const sendMessage = useCallback(
//     async (recipientId: string, text: string) => {
//       const { user, crypto: cs } = stateRef.current;
//       if (!user || !cs) return;

//       // Optimistic message
//       const pendingId = `pending-${Date.now()}`;
//       const pendingMsg: DecryptedMessage = {
//         id: pendingId,
//         from_user_id: user.id,
//         to_user_id: recipientId,
//         payload: {
//           ciphertext: "",
//           iv: "",
//           encryptedKey: "",
//           encryptedKeyForSelf: "",
//         },
//         delivered: false,
//         created_at: new Date().toISOString(),
//         text,
//         decryptError: false,
//         pending: true,
//       };
//       dispatch({
//         type: "APPEND_MESSAGE",
//         userId: recipientId,
//         message: pendingMsg,
//       });

//       try {
//         const recipientPk = await getOrFetchPublicKey(recipientId);
//         const payload = await encryptMessage(text, recipientPk, cs.publicKey);

//         // Try WebSocket first, fall back to HTTP
//         const sent = socket.current.send({
//           event: "message.send",
//           to: recipientId,
//           payload,
//         });

//         let confirmedMsg: RawMessage;
//         if (!sent) {
//           confirmedMsg = await apiSendMessage(recipientId, payload);
//         } else {
//           // Construct a synthetic confirmed message for optimistic replace
//           confirmedMsg = {
//             id: crypto.randomUUID(),
//             from_user_id: user.id,
//             to_user_id: recipientId,
//             payload,
//             delivered: true,
//             created_at: new Date().toISOString(),
//           };
//         }

//         const decrypted: DecryptedMessage = {
//           ...confirmedMsg,
//           text,
//           decryptError: false,
//           pending: false,
//         };

//         dispatch({
//           type: "REPLACE_PENDING",
//           userId: recipientId,
//           pendingId,
//           message: decrypted,
//         });

//         dispatch({
//           type: "UPSERT_CONVERSATION",
//           conv: {
//             user_id: recipientId,
//             display_name: "",
//             username: "",
//             last_message_at: confirmedMsg.created_at,
//           },
//         });
//       } catch (e) {
//         // Remove the pending message on failure
//         dispatch({
//           type: "REPLACE_PENDING",
//           userId: recipientId,
//           pendingId,
//           message: {
//             ...pendingMsg,
//             decryptError: true,
//             text: null,
//             pending: false,
//           },
//         });
//         toast((e as Error).message, "error");
//       }
//     },
//     [toast, getOrFetchPublicKey],
//   );

//   const value = useMemo<AppContextValue>(
//     () => ({
//       state,
//       login,
//       register,
//       logout,
//       loadConversations,
//       openConversation,
//       loadOlderMessages,
//       sendMessage,
//       toast,
//       dismissToast,
//     }),
//     [
//       state,
//       login,
//       register,
//       logout,
//       loadConversations,
//       openConversation,
//       loadOlderMessages,
//       sendMessage,
//       toast,
//       dismissToast,
//     ],
//   );

//   return <AppContext.Provider value={value}>{children}</AppContext.Provider>;
// }

// // Hook

// export function useApp(): AppContextValue {
//   const ctx = useContext(AppContext);
//   if (!ctx) throw new Error("useApp must be used inside AppProvider");
//   return ctx;
// }

/**
 * contexts/AppContext.tsx
 * Central state management for WhisperBox.
 * Owns: auth session, crypto keys, conversations, messages, WebSocket, toasts.
 */

import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useReducer,
  useRef,
  type ReactNode,
} from "react";
import {
  apiGetConversations,
  apiGetMessages,
  apiGetPublicKey,
  apiLogin,
  apiLogout,
  apiRegister,
  apiSendMessage,
  clearTokens,
  getAccessToken,
  onSessionExpired,
  refreshAccessToken,
  setTokens,
} from "../api";
import {
  decryptMessage,
  encryptMessage,
  importPublicKey,
  restoreCryptoSession,
  setupCryptoForRegistration,
} from "../crypto";
import type {
  Conversation,
  CryptoSession,
  DecryptedMessage,
  RawMessage,
  Toast,
  ToastVariant,
  User,
} from "../types";
import { WhisperSocket } from "../ws/socket";

// ─── State Shape ──────────────────────────────────────────────────────────

interface AppState {
  user: User | null;
  crypto: CryptoSession | null;
  conversations: Conversation[];
  messages: Record<string, DecryptedMessage[]>; // keyed by peer userId
  activeConversationId: string | null;
  onlineUsers: Set<string>;
  wsConnected: boolean;
  toasts: Toast[];
  loadingConversations: boolean;
  loadingMessages: boolean;
}

type Action =
  | { type: "LOGGED_IN"; user: User; crypto: CryptoSession }
  | { type: "LOGGED_OUT" }
  | { type: "SET_CONVERSATIONS"; conversations: Conversation[] }
  | { type: "SET_MESSAGES"; userId: string; messages: DecryptedMessage[] }
  | { type: "PREPEND_MESSAGES"; userId: string; messages: DecryptedMessage[] }
  | { type: "APPEND_MESSAGE"; userId: string; message: DecryptedMessage }
  | {
      type: "REPLACE_PENDING";
      userId: string;
      pendingId: string;
      message: DecryptedMessage;
    }
  | { type: "SET_ACTIVE"; userId: string | null }
  | { type: "USER_ONLINE"; userId: string }
  | { type: "USER_OFFLINE"; userId: string }
  | { type: "WS_STATUS"; connected: boolean }
  | { type: "ADD_TOAST"; toast: Toast }
  | { type: "REMOVE_TOAST"; id: string }
  | { type: "LOADING_CONVERSATIONS"; loading: boolean }
  | { type: "LOADING_MESSAGES"; loading: boolean }
  | { type: "UPSERT_CONVERSATION"; conv: Conversation };

const initial: AppState = {
  user: null,
  crypto: null,
  conversations: [],
  messages: {},
  activeConversationId: null,
  onlineUsers: new Set(),
  wsConnected: false,
  toasts: [],
  loadingConversations: false,
  loadingMessages: false,
};

function reducer(state: AppState, action: Action): AppState {
  switch (action.type) {
    case "LOGGED_IN":
      return { ...initial, user: action.user, crypto: action.crypto };

    case "LOGGED_OUT":
      return { ...initial };

    case "SET_CONVERSATIONS":
      return { ...state, conversations: action.conversations };

    case "UPSERT_CONVERSATION": {
      const existing = state.conversations.find(
        (c) => c.user_id === action.conv.user_id,
      );
      // Merge: never overwrite a real display_name/username with an empty fallback
      const merged: Conversation = existing
        ? {
            ...existing,
            display_name: action.conv.display_name || existing.display_name,
            username: action.conv.username || existing.username,
            last_message_at: action.conv.last_message_at,
          }
        : action.conv;
      const updated = existing
        ? state.conversations.map((c) =>
            c.user_id === action.conv.user_id ? merged : c,
          )
        : [merged, ...state.conversations];
      return {
        ...state,
        conversations: updated.sort(
          (a, b) =>
            new Date(b.last_message_at).getTime() -
            new Date(a.last_message_at).getTime(),
        ),
      };
    }

    case "SET_MESSAGES":
      return {
        ...state,
        messages: { ...state.messages, [action.userId]: action.messages },
      };

    case "PREPEND_MESSAGES": {
      const existing = state.messages[action.userId] ?? [];
      return {
        ...state,
        messages: {
          ...state.messages,
          [action.userId]: [...action.messages, ...existing],
        },
      };
    }

    case "APPEND_MESSAGE": {
      const existing = state.messages[action.userId] ?? [];
      // Deduplicate by id
      if (existing.some((m) => m.id === action.message.id)) return state;
      return {
        ...state,
        messages: {
          ...state.messages,
          [action.userId]: [...existing, action.message],
        },
      };
    }

    case "REPLACE_PENDING": {
      const existing = state.messages[action.userId] ?? [];
      return {
        ...state,
        messages: {
          ...state.messages,
          [action.userId]: existing.map((m) =>
            m.id === action.pendingId ? action.message : m,
          ),
        },
      };
    }

    case "SET_ACTIVE":
      return { ...state, activeConversationId: action.userId };

    case "USER_ONLINE": {
      const next = new Set(state.onlineUsers);
      next.add(action.userId);
      return { ...state, onlineUsers: next };
    }

    case "USER_OFFLINE": {
      const next = new Set(state.onlineUsers);
      next.delete(action.userId);
      return { ...state, onlineUsers: next };
    }

    case "WS_STATUS":
      return { ...state, wsConnected: action.connected };

    case "ADD_TOAST":
      return { ...state, toasts: [...state.toasts, action.toast] };

    case "REMOVE_TOAST":
      return {
        ...state,
        toasts: state.toasts.filter((t) => t.id !== action.id),
      };

    case "LOADING_CONVERSATIONS":
      return { ...state, loadingConversations: action.loading };

    case "LOADING_MESSAGES":
      return { ...state, loadingMessages: action.loading };

    default:
      return state;
  }
}

// ─── Context ──────────────────────────────────────────────────────────────

interface AppContextValue {
  state: AppState;
  login: (username: string, password: string) => Promise<void>;
  register: (
    username: string,
    displayName: string,
    password: string,
  ) => Promise<void>;
  logout: () => Promise<void>;
  loadConversations: () => Promise<void>;
  openConversation: (
    userId: string,
    displayName: string,
    username: string,
  ) => Promise<void>;
  closeConversation: () => void;
  loadOlderMessages: (userId: string) => Promise<void>;
  sendMessage: (recipientId: string, text: string) => Promise<void>;
  toast: (message: string, variant?: ToastVariant) => void;
  dismissToast: (id: string) => void;
}

const AppContext = createContext<AppContextValue | null>(null);

// ─── Provider ─────────────────────────────────────────────────────────────

export function AppProvider({ children }: { children: ReactNode }) {
  const [state, dispatch] = useReducer(reducer, initial);

  // Refs so callbacks always have latest values without re-creating
  const stateRef = useRef(state);
  stateRef.current = state;

  // Public-key cache so we don't re-fetch on every message
  const pkCache = useRef<Map<string, CryptoKey>>(new Map());

  // WebSocket singleton
  const socket = useRef<WhisperSocket>(new WhisperSocket(getAccessToken));

  // Give the socket a token-refresh hook so reconnects after the 15-min
  // access-token window don't fail silently with a stale token
  useEffect(() => {
    socket.current.setRefreshToken(refreshAccessToken);
  }, []);

  // ── Toast helper ──────────────────────────────────────────────────────

  const toast = useCallback(
    (message: string, variant: ToastVariant = "info") => {
      const id = crypto.randomUUID();
      dispatch({ type: "ADD_TOAST", toast: { id, message, variant } });
      setTimeout(() => dispatch({ type: "REMOVE_TOAST", id }), 4000);
    },
    [],
  );

  const dismissToast = useCallback((id: string) => {
    dispatch({ type: "REMOVE_TOAST", id });
  }, []);

  // ── Key helper ────────────────────────────────────────────────────────

  const getOrFetchPublicKey = useCallback(
    async (userId: string): Promise<CryptoKey> => {
      if (pkCache.current.has(userId)) return pkCache.current.get(userId)!;
      const b64 = await apiGetPublicKey(userId);
      const key = await importPublicKey(b64);
      pkCache.current.set(userId, key);
      return key;
    },
    [],
  );

  // ── Message decryption ────────────────────────────────────────────────

  const decryptRaw = useCallback(
    async (raw: RawMessage, myId: string): Promise<DecryptedMessage> => {
      const { crypto: cs } = stateRef.current;
      if (!cs) throw new Error("No crypto session");

      const isSender = raw.from_user_id === myId;
      try {
        const text = await decryptMessage(raw.payload, cs.privateKey, isSender);
        return { ...raw, text, decryptError: false };
      } catch {
        return { ...raw, text: null, decryptError: true };
      }
    },
    [],
  );

  // ── WebSocket setup ───────────────────────────────────────────────────

  useEffect(() => {
    const ws = socket.current;

    const offConnected = ws.on("connected", () => {
      dispatch({ type: "WS_STATUS", connected: true });
    });

    const offDisconnected = ws.on("disconnected", () => {
      dispatch({ type: "WS_STATUS", connected: false });
    });

    const offMessage = ws.on("message.receive", async (data: unknown) => {
      const raw = data as RawMessage & {
        from_user_id: string;
        to_user_id: string;
        created_at: string;
      };
      const { user, conversations } = stateRef.current;
      if (!user) return;

      const peerId =
        raw.from_user_id === user.id ? raw.to_user_id : raw.from_user_id;

      const decrypted = await decryptRaw(raw, user.id);
      dispatch({ type: "APPEND_MESSAGE", userId: peerId, message: decrypted });

      // If this is a brand-new conversation (sender not in list yet), refresh
      // the conversation list to get their real display_name + username
      const alreadyKnown = conversations.some((c) => c.user_id === peerId);
      if (!alreadyKnown) {
        // Temporarily insert with empty strings — reducer merge will fill in
        // real values once loadConversations completes
        dispatch({
          type: "UPSERT_CONVERSATION",
          conv: {
            user_id: peerId,
            display_name: "",
            username: "",
            last_message_at: raw.created_at,
          },
        });
        apiGetConversations()
          .then((convs) =>
            dispatch({ type: "SET_CONVERSATIONS", conversations: convs }),
          )
          .catch(() => {});
      } else {
        dispatch({
          type: "UPSERT_CONVERSATION",
          conv: {
            user_id: peerId,
            display_name: "",
            username: "",
            last_message_at: raw.created_at,
          },
        });
      }
    });

    const offWsError = ws.on("error", (data: unknown) => {
      const d = data as { detail?: string };
      if (d?.detail) toast(`Server: ${d.detail}`, "error");
    });

    const offOnline = ws.on("user.online", (data: unknown) => {
      const d = data as { user_id: string };
      dispatch({ type: "USER_ONLINE", userId: d.user_id });
    });

    const offOffline = ws.on("user.offline", (data: unknown) => {
      const d = data as { user_id: string };
      dispatch({ type: "USER_OFFLINE", userId: d.user_id });
    });

    return () => {
      offConnected();
      offDisconnected();
      offMessage();
      offWsError();
      offOnline();
      offOffline();
    };
  }, [decryptRaw, toast]);

  // Session expiry → logout
  useEffect(() => {
    onSessionExpired(() => {
      dispatch({ type: "LOGGED_OUT" });
      socket.current.disconnect();
      toast("Your session expired. Please log in again.", "error");
    });
  }, [toast]);

  // ── Auth actions ──────────────────────────────────────────────────────

  const login = useCallback(async (username: string, password: string) => {
    const data = await apiLogin(username, password);
    setTokens(data.access_token, data.refresh_token);

    const cs = await restoreCryptoSession(
      password,
      data.user.wrapped_private_key,
      data.user.pbkdf2_salt,
      data.user.public_key,
    );

    dispatch({ type: "LOGGED_IN", user: data.user, crypto: cs });
    pkCache.current.clear();
    socket.current.connect();
  }, []);

  const register = useCallback(
    async (username: string, displayName: string, password: string) => {
      const { publicKeyBase64, wrappedPrivateKeyBase64, saltBase64, keyPair } =
        await setupCryptoForRegistration(password);

      const data = await apiRegister({
        username,
        display_name: displayName,
        password,
        public_key: publicKeyBase64,
        wrapped_private_key: wrappedPrivateKeyBase64,
        pbkdf2_salt: saltBase64,
      });

      setTokens(data.access_token, data.refresh_token);
      dispatch({
        type: "LOGGED_IN",
        user: data.user,
        crypto: {
          privateKey: keyPair.privateKey,
          publicKey: keyPair.publicKey,
        },
      });
      pkCache.current.clear();
      socket.current.connect();
    },
    [],
  );

  const logout = useCallback(async () => {
    socket.current.disconnect();
    await apiLogout();
    clearTokens();
    pkCache.current.clear();
    dispatch({ type: "LOGGED_OUT" });
  }, []);

  const closeConversation = useCallback(() => {
    dispatch({ type: "SET_ACTIVE", userId: null });
  }, []);

  // ── Conversation actions ───────────────────────────────────────────────

  const loadConversations = useCallback(async () => {
    dispatch({ type: "LOADING_CONVERSATIONS", loading: true });
    try {
      const convs = await apiGetConversations();
      dispatch({ type: "SET_CONVERSATIONS", conversations: convs });
    } catch (e) {
      toast((e as Error).message, "error");
    } finally {
      dispatch({ type: "LOADING_CONVERSATIONS", loading: false });
    }
  }, [toast]);

  const openConversation = useCallback(
    async (userId: string, displayName: string, username: string) => {
      dispatch({ type: "SET_ACTIVE", userId });

      // Ensure this user appears in sidebar
      dispatch({
        type: "UPSERT_CONVERSATION",
        conv: {
          user_id: userId,
          display_name: displayName,
          username,
          last_message_at: new Date().toISOString(),
        },
      });

      // Only fetch if we don't already have messages
      if (stateRef.current.messages[userId]) return;

      dispatch({ type: "LOADING_MESSAGES", loading: true });
      try {
        const { user } = stateRef.current;
        if (!user) return;

        const raws = await apiGetMessages(userId, 50);
        // API returns newest-first; reverse for chronological display
        const sorted = [...raws].reverse();
        const decrypted = await Promise.all(
          sorted.map((r) => decryptRaw(r, user.id)),
        );
        dispatch({ type: "SET_MESSAGES", userId, messages: decrypted });
      } catch (e) {
        toast((e as Error).message, "error");
      } finally {
        dispatch({ type: "LOADING_MESSAGES", loading: false });
      }
    },
    [toast, decryptRaw],
  );

  const loadOlderMessages = useCallback(
    async (userId: string) => {
      const { messages, user } = stateRef.current;
      const existing = messages[userId] ?? [];
      if (existing.length === 0 || !user) return;

      const oldest = existing[0];
      dispatch({ type: "LOADING_MESSAGES", loading: true });
      try {
        const raws = await apiGetMessages(userId, 50, oldest.created_at);
        if (raws.length === 0) return;
        const sorted = [...raws].reverse();
        const decrypted = await Promise.all(
          sorted.map((r) => decryptRaw(r, user.id)),
        );
        dispatch({ type: "PREPEND_MESSAGES", userId, messages: decrypted });
      } catch (e) {
        toast((e as Error).message, "error");
      } finally {
        dispatch({ type: "LOADING_MESSAGES", loading: false });
      }
    },
    [toast, decryptRaw],
  );

  // ── Send message ─────────────────────────────────────────────────────

  const sendMessage = useCallback(
    async (recipientId: string, text: string) => {
      const { user, crypto: cs } = stateRef.current;
      if (!user || !cs) return;

      // Optimistic message
      const pendingId = `pending-${Date.now()}`;
      const pendingMsg: DecryptedMessage = {
        id: pendingId,
        from_user_id: user.id,
        to_user_id: recipientId,
        payload: {
          ciphertext: "",
          iv: "",
          encryptedKey: "",
          encryptedKeyForSelf: "",
        },
        delivered: false,
        created_at: new Date().toISOString(),
        text,
        decryptError: false,
        pending: true,
      };
      dispatch({
        type: "APPEND_MESSAGE",
        userId: recipientId,
        message: pendingMsg,
      });

      try {
        const recipientPk = await getOrFetchPublicKey(recipientId);
        const payload = await encryptMessage(text, recipientPk, cs.publicKey);

        // Try WebSocket first, fall back to HTTP
        const sent = socket.current.send({
          event: "message.send",
          to: recipientId,
          payload,
        });

        let confirmedMsg: RawMessage;
        if (!sent) {
          confirmedMsg = await apiSendMessage(recipientId, payload);
        } else {
          // Construct a synthetic confirmed message for optimistic replace
          confirmedMsg = {
            id: crypto.randomUUID(),
            from_user_id: user.id,
            to_user_id: recipientId,
            payload,
            delivered: true,
            created_at: new Date().toISOString(),
          };
        }

        const decrypted: DecryptedMessage = {
          ...confirmedMsg,
          text,
          decryptError: false,
          pending: false,
        };

        dispatch({
          type: "REPLACE_PENDING",
          userId: recipientId,
          pendingId,
          message: decrypted,
        });

        dispatch({
          type: "UPSERT_CONVERSATION",
          conv: {
            user_id: recipientId,
            display_name: "",
            username: "",
            last_message_at: confirmedMsg.created_at,
          },
        });
      } catch (e) {
        // Remove the pending message on failure
        dispatch({
          type: "REPLACE_PENDING",
          userId: recipientId,
          pendingId,
          message: {
            ...pendingMsg,
            decryptError: true,
            text: null,
            pending: false,
          },
        });
        toast((e as Error).message, "error");
      }
    },
    [toast, getOrFetchPublicKey],
  );

  const value = useMemo<AppContextValue>(
    () => ({
      state,
      login,
      register,
      logout,
      loadConversations,
      openConversation,
      closeConversation,
      loadOlderMessages,
      sendMessage,
      toast,
      dismissToast,
    }),
    [
      state,
      login,
      register,
      logout,
      loadConversations,
      openConversation,
      closeConversation,
      loadOlderMessages,
      sendMessage,
      toast,
      dismissToast,
    ],
  );

  return <AppContext.Provider value={value}>{children}</AppContext.Provider>;
}

// ─── Hook ─────────────────────────────────────────────────────────────────

export function useApp(): AppContextValue {
  const ctx = useContext(AppContext);
  if (!ctx) throw new Error("useApp must be used inside AppProvider");
  return ctx;
}
