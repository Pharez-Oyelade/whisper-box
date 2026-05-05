import { useEffect, useRef, useState } from "react";
import { useApp } from "../../contexts/AppContext";
import type { Conversation, SearchUser } from "../../types";
import { apiSearchUsers } from "../../api";
import { Spinner } from "../ui/Spinner";

function getInitials(name: string) {
  return name
    .split(" ")
    .slice(0, 2)
    .map((s) => s[0])
    .join("")
    .toUpperCase();
}

const GRADIENT_COLORS = [
  "from-teal-600 to-cyan-700",
  "from-violet-600 to-purple-700",
  "from-blue-600 to-indigo-700",
  "from-emerald-600 to-green-700",
  "from-orange-600 to-amber-700",
  "from-pink-600 to-rose-700",
];

function avatarGradient(userId: string) {
  const idx = userId.charCodeAt(0) % GRADIENT_COLORS.length;
  return GRADIENT_COLORS[idx];
}

function formatTime(iso: string) {
  const d = new Date(iso);
  const now = new Date();
  const diffMs = now.getTime() - d.getTime();
  const diffDays = Math.floor(diffMs / 86400000);

  if (diffDays === 0) {
    return d.toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" });
  } else if (diffDays === 1) {
    return "Yesterday";
  } else if (diffDays < 7) {
    return d.toLocaleDateString([], { weekday: "short" });
  }
  return d.toLocaleDateString([], { month: "short", day: "numeric" });
}

export function Sidebar() {
  const { state, logout, openConversation, loadConversations } = useApp();
  const [searchQuery, setSearchQuery] = useState("");
  const [searchResults, setSearchResults] = useState<SearchUser[]>([]);
  const [searching, setSearching] = useState(false);
  const [showSearch, setShowSearch] = useState(false);
  const searchRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  useEffect(() => {
    if (state.user) loadConversations();
  }, [state.user]);

  // User search with debounce
  useEffect(() => {
    if (!showSearch || !searchQuery.trim()) {
      setSearchResults([]);
      return;
    }
    if (searchRef.current) clearTimeout(searchRef.current);
    searchRef.current = setTimeout(async () => {
      setSearching(true);
      try {
        const res = await apiSearchUsers(searchQuery);
        setSearchResults(res);
      } catch {
        setSearchResults([]);
      } finally {
        setSearching(false);
      }
    }, 350);
  }, [searchQuery, showSearch]);

  const openConv = (user: SearchUser) => {
    openConversation(user.id, user.display_name, user.username);
    setShowSearch(false);
    setSearchQuery("");
    setSearchResults([]);
  };

  return (
    <div className="flex flex-col h-full bg-bg-secondary border-r border-border">
      {/* Header */}
      <div className="px-4 py-4 border-b border-border">
        <div className="flex items-center justify-between mb-3">
          <div className="flex items-center gap-2">
            {/* <span className="text-accent text-lg">🔒</span> */}
            <span className="text-accent text-lg">
              <svg
                xmlns="http://www.w3.org/2000/svg"
                width="24"
                height="24"
                viewBox="0 0 24 24"
                fill="none"
                stroke="currentColor"
                stroke-width="2"
                stroke-linecap="round"
                stroke-linejoin="round"
                className="lucide lucide-message-circle-dashed-icon lucide-message-circle-dashed"
              >
                <path d="M10.1 2.182a10 10 0 0 1 3.8 0" />
                <path d="M13.9 21.818a10 10 0 0 1-3.8 0" />
                <path d="M17.609 3.72a10 10 0 0 1 2.69 2.7" />
                <path d="M2.182 13.9a10 10 0 0 1 0-3.8" />
                <path d="M20.28 17.61a10 10 0 0 1-2.7 2.69" />
                <path d="M21.818 10.1a10 10 0 0 1 0 3.8" />
                <path d="M3.721 6.391a10 10 0 0 1 2.7-2.69" />
                <path d="m6.163 21.117-2.906.85a1 1 0 0 1-1.236-1.169l.965-2.98" />
              </svg>
            </span>
            <span className="font-bold text-text-primary text-base tracking-tight">
              WhisperBox
            </span>
          </div>
          <button
            onClick={() => setShowSearch((s) => !s)}
            className={`
              w-8 h-8 rounded-lg flex items-center justify-center transition-all
              ${showSearch ? "bg-accent/20 text-accent" : "text-text-muted hover:text-text-secondary hover:bg-bg-input"}
            `}
            title="New conversation"
          >
            <svg
              viewBox="0 0 24 24"
              fill="none"
              stroke="currentColor"
              strokeWidth={2}
              className="w-4 h-4"
            >
              <path d="M21 15a2 2 0 0 1-2 2H7l-4 4V5a2 2 0 0 1 2-2h14a2 2 0 0 1 2 2z" />
              <line x1="12" y1="8" x2="12" y2="16" strokeLinecap="round" />
              <line x1="8" y1="12" x2="16" y2="12" strokeLinecap="round" />
            </svg>
          </button>
        </div>

        {/* WS status */}
        <div className="flex items-center gap-1.5">
          <div
            className={`w-1.5 h-1.5 rounded-full ${
              state.wsConnected
                ? "bg-online"
                : "bg-text-muted animate-reconnect"
            }`}
          />
          <span className="text-xs font-mono text-text-muted">
            {state.wsConnected ? "connected" : "connecting…"}
          </span>
        </div>
      </div>

      {/* New Conversation Search */}
      {showSearch && (
        <div className="p-3 border-b border-border bg-bg-tertiary">
          <div className="relative">
            <svg
              viewBox="0 0 24 24"
              fill="none"
              stroke="currentColor"
              strokeWidth={2}
              className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-text-muted"
            >
              <circle cx="11" cy="11" r="8" />
              <path d="m21 21-4.35-4.35" strokeLinecap="round" />
            </svg>
            <input
              autoFocus
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              placeholder="Search by username…"
              className="
                w-full bg-bg-input border border-border rounded-lg pl-9 pr-3 py-2
                text-text-primary placeholder-text-muted text-sm
                focus:outline-none focus:border-accent/50
              "
            />
          </div>

          {searching && (
            <div className="flex justify-center py-3">
              <Spinner size="sm" />
            </div>
          )}

          {searchResults.length > 0 && (
            <ul className="mt-2 space-y-0.5">
              {searchResults.map((u) => (
                <li key={u.id}>
                  <button
                    onClick={() => openConv(u)}
                    className="w-full flex items-center gap-3 px-2 py-2 rounded-lg hover:bg-bg-input transition-colors text-left"
                  >
                    <div
                      className={`w-8 h-8 rounded-lg bg-gradient-to-br ${avatarGradient(u.id)} flex items-center justify-center text-white text-xs font-bold shrink-0`}
                    >
                      {getInitials(u.display_name)}
                    </div>
                    <div>
                      <p className="text-sm font-medium text-text-primary">
                        {u.display_name}
                      </p>
                      <p className="text-xs text-text-muted">@{u.username}</p>
                    </div>
                  </button>
                </li>
              ))}
            </ul>
          )}

          {searchQuery && !searching && searchResults.length === 0 && (
            <p className="text-center text-text-muted text-xs py-3">
              No users found
            </p>
          )}
        </div>
      )}

      {/* Conversation List */}
      <div className="flex-1 overflow-y-auto">
        {state.loadingConversations ? (
          <div className="flex justify-center py-8">
            <Spinner size="md" />
          </div>
        ) : state.conversations.length === 0 ? (
          <div className="flex flex-col items-center justify-center h-full gap-3 text-center px-6">
            <span className="text-3xl">💬</span>
            <p className="text-text-muted text-sm">No conversations yet</p>
            <p className="text-text-muted text-xs">
              Click the icon above to start a new chat
            </p>
          </div>
        ) : (
          <ul className="py-1">
            {state.conversations.map((conv) => (
              <ConversationItem key={conv.user_id} conv={conv} />
            ))}
          </ul>
        )}
      </div>

      {/* Current User */}
      {state.user && (
        <div className="px-3 py-3 border-t border-border flex items-center gap-3">
          <div
            className={`w-8 h-8 rounded-lg bg-gradient-to-br ${avatarGradient(state.user.id)} flex items-center justify-center text-white text-xs font-bold shrink-0`}
          >
            {getInitials(state.user.display_name)}
          </div>
          <div className="flex-1 min-w-0">
            <p className="text-sm font-medium text-text-primary truncate">
              {state.user.display_name}
            </p>
            <p className="text-xs text-text-muted truncate">
              @{state.user.username}
            </p>
          </div>
          <button
            onClick={logout}
            className="text-text-muted hover:text-danger transition-colors p-1.5 rounded-lg hover:bg-danger/10 cursor-pointer"
            title="Sign out"
          >
            <svg
              viewBox="0 0 24 24"
              fill="none"
              stroke="currentColor"
              strokeWidth={2}
              className="w-4 h-4"
            >
              <path
                d="M9 21H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h4"
                strokeLinecap="round"
              />
              <polyline points="16 17 21 12 16 7" />
              <line x1="21" y1="12" x2="9" y2="12" strokeLinecap="round" />
            </svg>
          </button>
        </div>
      )}
    </div>
  );
}

function ConversationItem({ conv }: { conv: Conversation }) {
  const { state, openConversation } = useApp();
  const isActive = state.activeConversationId === conv.user_id;
  const isOnline = state.onlineUsers.has(conv.user_id);
  const messages = state.messages[conv.user_id] ?? [];
  const lastMsg = messages[messages.length - 1];

  return (
    <li>
      <button
        onClick={() =>
          openConversation(conv.user_id, conv.display_name, conv.username)
        }
        className={`
          w-full flex items-center gap-3 px-3 py-3 transition-colors text-left
          ${isActive ? "bg-accent/10 border-r-2 border-accent" : "hover:bg-bg-input"}
        `}
      >
        {/* Avatar */}
        <div className="relative shrink-0">
          <div
            className={`
              w-10 h-10 rounded-xl bg-gradient-to-br ${avatarGradient(conv.user_id)}
              flex items-center justify-center text-white text-sm font-bold
            `}
          >
            {getInitials(conv.display_name || conv.username)}
          </div>
          {isOnline && (
            <span className="absolute -bottom-0.5 -right-0.5 w-3 h-3 bg-online rounded-full border-2 border-bg-secondary" />
          )}
        </div>

        {/* Info */}
        <div className="flex-1 min-w-0">
          <div className="flex items-center justify-between">
            <p
              className={`text-sm font-medium truncate ${isActive ? "text-accent" : "text-text-primary"}`}
            >
              {conv.display_name || conv.username}
            </p>
            <span className="text-xs text-text-muted shrink-0 ml-2">
              {formatTime(conv.last_message_at)}
            </span>
          </div>
          <div className="flex items-center gap-1 mt-0.5">
            <span className="text-xs text-text-muted shrink-0">🔒</span>
            <p className="text-xs text-text-muted truncate">
              {lastMsg
                ? lastMsg.decryptError
                  ? "⚠ Unable to decrypt"
                  : lastMsg.text
                : "Encrypted messages"}
            </p>
          </div>
        </div>
      </button>
    </li>
  );
}
