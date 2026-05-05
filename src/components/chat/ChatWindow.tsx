import {
  useEffect,
  useRef,
  useState,
  type FormEvent,
  type KeyboardEvent,
} from "react";
import { useApp } from "../../contexts/AppContext";
import type { DecryptedMessage } from "../../types";
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

function formatTimestamp(iso: string) {
  return new Date(iso).toLocaleTimeString([], {
    hour: "2-digit",
    minute: "2-digit",
  });
}

function formatDateDivider(iso: string) {
  const d = new Date(iso);
  const now = new Date();
  const diffDays = Math.floor((now.getTime() - d.getTime()) / 86400000);
  if (diffDays === 0) return "Today";
  if (diffDays === 1) return "Yesterday";
  return d.toLocaleDateString([], {
    weekday: "long",
    month: "long",
    day: "numeric",
  });
}

function sameDay(a: string, b: string) {
  return new Date(a).toDateString() === new Date(b).toDateString();
}

function EmptyState() {
  return (
    <div className="flex-1 flex flex-col items-center justify-center text-center px-8 gap-4">
      <div className="w-20 h-20 rounded-3xl bg-accent/10 border border-accent/20 flex items-center justify-center text-4xl">
        🔐
      </div>
      <div>
        <h2 className="text-text-primary font-semibold text-lg">
          End-to-End Encrypted
        </h2>
        <p className="text-text-muted text-sm mt-2 max-w-xs leading-relaxed">
          Select a conversation or search for a user to start a secure, private
          chat. Messages are encrypted before leaving your device.
        </p>
      </div>
      <div className="flex flex-col items-center gap-1.5 mt-2">
        <div className="flex items-center gap-2 text-xs text-text-muted font-mono">
          <span className="text-accent">✓</span> AES-GCM 256-bit message
          encryption
        </div>
        <div className="flex items-center gap-2 text-xs text-text-muted font-mono">
          <span className="text-accent">✓</span> RSA-OAEP 2048-bit key exchange
        </div>
        <div className="flex items-center gap-2 text-xs text-text-muted font-mono">
          <span className="text-accent">✓</span> Private key never leaves your
          device
        </div>
      </div>
    </div>
  );
}

function MessageBubble({
  msg,
  isSent,
  showAvatar,
  peerName,
  peerId,
}: {
  msg: DecryptedMessage;
  isSent: boolean;
  showAvatar: boolean;
  peerName: string;
  peerId: string;
}) {
  return (
    <div
      className={`flex items-end gap-2 ${isSent ? "flex-row-reverse" : "flex-row"} animate-fade-in`}
    >
      {/* Avatar placeholder */}
      <div className="w-7 h-7 shrink-0">
        {!isSent && showAvatar && (
          <div
            className={`w-7 h-7 rounded-lg bg-gradient-to-br ${avatarGradient(peerId)} flex items-center justify-center text-white text-[10px] font-bold`}
          >
            {getInitials(peerName)}
          </div>
        )}
      </div>

      <div
        className={`max-w-[72%] flex flex-col ${isSent ? "items-end" : "items-start"}`}
      >
        {msg.decryptError ? (
          <div className="flex items-center gap-1.5 px-3 py-2 rounded-xl bg-danger/10 border border-danger/20">
            <span className="text-danger text-xs">⚠</span>
            <span className="text-danger text-xs font-mono italic">
              Unable to decrypt message
            </span>
          </div>
        ) : (
          <div
            className={`
              px-4 py-2.5 rounded-2xl text-sm leading-relaxed
              ${
                isSent
                  ? "bg-bubble-sent text-accent rounded-br-sm border border-accent/20"
                  : "bg-bubble-recv text-text-primary rounded-bl-sm border border-border"
              }
              ${msg.pending ? "opacity-60" : ""}
            `}
          >
            {msg.text}
          </div>
        )}

        {/* Timestamp + status */}
        <div
          className={`flex items-center gap-1.5 mt-1 ${isSent ? "flex-row-reverse" : "flex-row"}`}
        >
          <span className="text-[10px] font-mono text-text-muted">
            {formatTimestamp(msg.created_at)}
          </span>
          {isSent && (
            <span
              className="text-[10px] text-text-muted"
              title="End-to-end encrypted"
            >
              {msg.pending ? "○" : "🔒"}
            </span>
          )}
        </div>
      </div>
    </div>
  );
}

export function ChatWindow() {
  const { state, sendMessage, loadOlderMessages, closeConversation } = useApp();
  const {
    activeConversationId,
    conversations,
    messages,
    user,
    onlineUsers,
    wsConnected,
    loadingMessages,
  } = state;

  const [input, setInput] = useState("");
  const [sending, setSending] = useState(false);
  const [loadingOlder, setLoadingOlder] = useState(false);

  const bottomRef = useRef<HTMLDivElement>(null);
  const scrollContainerRef = useRef<HTMLDivElement>(null);

  const activeConv = conversations.find(
    (c) => c.user_id === activeConversationId,
  );
  const peerMessages = activeConversationId
    ? (messages[activeConversationId] ?? [])
    : [];
  const peerIsOnline = activeConversationId
    ? onlineUsers.has(activeConversationId)
    : false;

  // scroll to bottom
  useEffect(() => {
    if (!loadingOlder) {
      bottomRef.current?.scrollIntoView({ behavior: "smooth" });
    }
  }, [peerMessages.length, activeConversationId, loadingOlder]);

  // Load older messages on scroll to top
  const handleScroll = async () => {
    const container = scrollContainerRef.current;
    if (!container || !activeConversationId || loadingOlder || loadingMessages)
      return;
    if (container.scrollTop < 60) {
      const prevHeight = container.scrollHeight;
      setLoadingOlder(true);
      await loadOlderMessages(activeConversationId);
      setLoadingOlder(false);
      // Restore scroll position
      requestAnimationFrame(() => {
        const newHeight = container.scrollHeight;
        container.scrollTop = newHeight - prevHeight;
      });
    }
  };

  const handleSend = async (e?: FormEvent) => {
    e?.preventDefault();
    const text = input.trim();
    if (!text || !activeConversationId || sending) return;

    setInput("");
    setSending(true);
    try {
      await sendMessage(activeConversationId, text);
    } finally {
      setSending(false);
    }
  };

  const handleKeyDown = (e: KeyboardEvent<HTMLTextAreaElement>) => {
    if (e.key === "Enter" && !e.shiftKey) {
      e.preventDefault();
      handleSend();
    }
  };

  if (!activeConversationId || !user) {
    return (
      <div className="flex-1 flex flex-col bg-bg-primary">
        <EmptyState />
      </div>
    );
  }

  const peerName =
    activeConv?.display_name || activeConv?.username || "Unknown";
  const peerId = activeConversationId;

  return (
    <div className="flex-1 flex flex-col bg-bg-primary min-w-0">
      {/* Header */}
      <div className="flex items-center gap-3 px-5 py-3.5 border-b border-border bg-bg-secondary/80 backdrop-blur-sm shrink-0">
        {/* Back button — mobile only */}
        <button
          onClick={closeConversation}
          className="md:hidden flex items-center justify-center w-8 h-8 -ml-1 rounded-lg text-text-muted hover:text-text-primary hover:bg-bg-input transition-colors shrink-0 cursor-pointer"
          aria-label="Back to conversations"
        >
          <svg
            viewBox="0 0 24 24"
            fill="none"
            stroke="currentColor"
            strokeWidth={2.5}
            className="w-4 h-4"
          >
            <path
              d="M15 18l-6-6 6-6"
              strokeLinecap="round"
              strokeLinejoin="round"
            />
          </svg>
        </button>
        <div className="relative shrink-0">
          <div
            className={`w-9 h-9 rounded-xl bg-gradient-to-br ${avatarGradient(peerId)} flex items-center justify-center text-white text-sm font-bold`}
          >
            {getInitials(peerName)}
          </div>
          {peerIsOnline && (
            <span className="absolute -bottom-0.5 -right-0.5 w-2.5 h-2.5 bg-online rounded-full border-2 border-bg-secondary" />
          )}
        </div>

        <div className="flex-1 min-w-0">
          <p className="font-semibold text-text-primary text-sm leading-tight">
            {peerName}
          </p>
          <p className="text-xs text-text-muted mt-0.5">
            {peerIsOnline ? (
              <span className="text-online">● Online</span>
            ) : (
              <span>@{activeConv?.username}</span>
            )}
          </p>
        </div>

        {/* Encryption badge */}
        <div className="flex items-center gap-1.5 px-2.5 py-1 rounded-lg bg-accent/10 border border-accent/20">
          <svg
            viewBox="0 0 24 24"
            fill="none"
            stroke="currentColor"
            strokeWidth={2}
            className="w-3 h-3 text-accent"
          >
            <rect x="5" y="11" width="14" height="10" rx="2" fill="none" />
            <path d="M8 11V7a4 4 0 0 1 8 0v4" strokeLinecap="round" />
          </svg>
          <span className="text-accent text-xs font-medium font-mono">
            E2EE
          </span>
        </div>

        {/* WS indicator */}
        {!wsConnected && (
          <div className="flex items-center gap-1 px-2 py-1 rounded-lg bg-bg-input border border-border">
            <span className="w-1.5 h-1.5 rounded-full bg-text-muted animate-reconnect" />
            <span className="text-[10px] text-text-muted font-mono">
              offline
            </span>
          </div>
        )}
      </div>

      {/* Messages */}
      <div
        ref={scrollContainerRef}
        onScroll={handleScroll}
        className="flex-1 overflow-y-auto px-4 py-4 space-y-1 scroll-smooth"
      >
        {/* Load older indicator */}
        {loadingOlder && (
          <div className="flex justify-center py-2">
            <Spinner size="sm" />
          </div>
        )}

        {/* Initial loading state */}
        {loadingMessages && peerMessages.length === 0 && (
          <div className="flex flex-col items-center justify-center h-full gap-3">
            <Spinner size="md" />
            <p className="text-text-muted text-xs font-mono">
              Decrypting messages…
            </p>
          </div>
        )}

        {/* E2EE notice at top of conversation */}
        {!loadingMessages && peerMessages.length >= 0 && (
          <div className="flex justify-center mb-4">
            <div className="flex items-center gap-1.5 px-3 py-1.5 rounded-full bg-bg-tertiary border border-border">
              <span className="text-accent text-xs">🔒</span>
              <span className="text-text-muted text-xs font-mono">
                Messages are end-to-end encrypted
              </span>
            </div>
          </div>
        )}

        {/* Message list with date dividers */}
        {peerMessages.map((msg, idx) => {
          const isSent = msg.from_user_id === user.id;
          const prev = peerMessages[idx - 1];
          const next = peerMessages[idx + 1];
          const showDateDivider =
            !prev || !sameDay(prev.created_at, msg.created_at);
          const showAvatar =
            !isSent &&
            (!next ||
              next.from_user_id !== msg.from_user_id ||
              !sameDay(next.created_at, msg.created_at));

          return (
            <div key={msg.id}>
              {showDateDivider && (
                <div className="flex items-center gap-3 my-4">
                  <div className="flex-1 h-px bg-border" />
                  <span className="text-[10px] font-mono text-text-muted uppercase tracking-wider">
                    {formatDateDivider(msg.created_at)}
                  </span>
                  <div className="flex-1 h-px bg-border" />
                </div>
              )}
              <MessageBubble
                msg={msg}
                isSent={isSent}
                showAvatar={showAvatar}
                peerName={peerName}
                peerId={peerId}
              />
            </div>
          );
        })}

        <div ref={bottomRef} />
      </div>

      {/* Input Area */}
      <div className="px-4 py-3 border-t border-border bg-bg-secondary/80 backdrop-blur-sm shrink-0">
        {/* Encryption status bar */}
        <div className="flex items-center gap-1.5 mb-2">
          <div
            className={`w-1.5 h-1.5 rounded-full ${wsConnected ? "bg-accent" : "bg-text-muted animate-reconnect"}`}
          />
          <span className="text-[10px] font-mono text-text-muted">
            {wsConnected
              ? "Encrypted · AES-GCM 256"
              : "Reconnecting — messages will be queued"}
          </span>
        </div>

        <form onSubmit={handleSend} className="flex items-end gap-2">
          <div className="flex-1 relative">
            <textarea
              value={input}
              onChange={(e) => {
                setInput(e.target.value);
                // Auto-resize
                e.target.style.height = "auto";
                e.target.style.height =
                  Math.min(e.target.scrollHeight, 120) + "px";
              }}
              onKeyDown={handleKeyDown}
              placeholder="Message (Enter to send, Shift+Enter for newline)"
              rows={1}
              className="
                w-full bg-bg-input border border-border rounded-xl px-4 py-2.5
                text-text-primary placeholder-text-muted text-sm resize-none
                focus:outline-none focus:border-accent/50 focus:ring-1 focus:ring-accent/20
                transition-all leading-relaxed
              "
              style={{ maxHeight: "120px" }}
            />
          </div>

          <button
            type="submit"
            disabled={!input.trim() || sending}
            className="
              w-10 h-10 rounded-xl
              bg-accent text-bg-primary
              hover:bg-accent-dim
              disabled:opacity-40 disabled:cursor-not-allowed
              transition-all active:scale-95
              flex items-center justify-center shrink-0
              shadow-lg shadow-accent/20 cursor-pointer
            "
            title="Send encrypted message"
          >
            {sending ? (
              <Spinner
                size="sm"
                className="border-bg-primary border-t-transparent"
              />
            ) : (
              <svg
                viewBox="0 0 24 24"
                fill="none"
                stroke="currentColor"
                strokeWidth={2.5}
                className="w-4 h-4"
              >
                <line x1="22" y1="2" x2="11" y2="13" strokeLinecap="round" />
                <polygon points="22 2 15 22 11 13 2 9 22 2" />
              </svg>
            )}
          </button>
        </form>
      </div>
    </div>
  );
}
