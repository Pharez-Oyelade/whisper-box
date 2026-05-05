import { useState, type FormEvent } from "react";
import { useApp } from "../../contexts/AppContext";
import { Spinner } from "../ui/Spinner";

type Mode = "login" | "register";

function LockIcon() {
  return (
    <svg
      viewBox="0 0 24 24"
      fill="none"
      className="w-full h-full"
      strokeWidth={1.5}
    >
      <rect
        x="5"
        y="11"
        width="14"
        height="10"
        rx="2"
        stroke="currentColor"
        fill="none"
      />
      <path
        d="M8 11V7a4 4 0 0 1 8 0v4"
        stroke="currentColor"
        fill="none"
        strokeLinecap="round"
      />
      <circle cx="12" cy="16" r="1.5" fill="currentColor" />
    </svg>
  );
}

export function AuthScreen() {
  const { login, register, toast } = useApp();
  const [mode, setMode] = useState<Mode>("login");
  const [loading, setLoading] = useState(false);
  const [shake, setShake] = useState(false);

  // Form fields
  const [username, setUsername] = useState("");
  const [displayName, setDisplayName] = useState("");
  const [password, setPassword] = useState("");
  const [confirmPass, setConfirmPass] = useState("");
  const [error, setError] = useState("");

  const switchMode = (m: Mode) => {
    setMode(m);
    setError("");
    setUsername("");
    setPassword("");
    setDisplayName("");
    setConfirmPass("");
  };

  const triggerShake = () => {
    setShake(true);
    setTimeout(() => setShake(false), 500);
  };

  const handleSubmit = async (e: FormEvent) => {
    e.preventDefault();
    setError("");

    if (mode === "register") {
      if (password !== confirmPass) {
        setError("Passwords do not match");
        triggerShake();
        return;
      }
      if (password.length < 8) {
        setError("Password must be at least 8 characters");
        triggerShake();
        return;
      }
    }

    setLoading(true);
    try {
      if (mode === "login") {
        await login(username, password);
      } else {
        await register(username, displayName || username, password);
        toast("Account created — keys generated ✓", "success");
      }
    } catch (err) {
      const msg = (err as Error).message;
      setError(msg);
      triggerShake();
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="min-h-screen bg-bg-primary flex items-center justify-center p-4">
      {/* Background grid pattern */}
      <div
        className="fixed inset-0 opacity-[0.03]"
        style={{
          backgroundImage:
            "linear-gradient(#00E5CC 1px, transparent 1px), linear-gradient(90deg, #00E5CC 1px, transparent 1px)",
          backgroundSize: "48px 48px",
        }}
      />

      {/* Glow */}
      <div className="fixed top-1/4 left-1/2 -translate-x-1/2 w-96 h-96 rounded-full bg-accent/5 blur-[120px] pointer-events-none" />

      <div
        className={`
          relative w-full max-w-md
          ${shake ? "animate-[shake_0.4s_ease-in-out]" : ""}
        `}
        style={
          shake
            ? {
                animation: "shake 0.4s ease-in-out",
              }
            : {}
        }
      >
        {/* Logo */}
        <div className="text-center mb-8">
          <div className="inline-flex items-center justify-center w-16 h-16 rounded-2xl bg-accent/10 border border-accent/20 mb-4 text-accent">
            <LockIcon />
          </div>
          <h1 className="text-2xl font-bold text-text-primary tracking-tight">
            WhisperBox
          </h1>
          <p className="text-text-muted text-sm mt-1 font-mono">
            end-to-end encrypted messaging
          </p>
        </div>

        {/* Card */}
        <div className="bg-bg-secondary border border-border rounded-2xl overflow-hidden shadow-2xl shadow-black/60">
          {/* Tab switcher */}
          <div className="flex border-b border-border">
            {(["login", "register"] as Mode[]).map((m) => (
              <button
                key={m}
                onClick={() => switchMode(m)}
                className={`
                  flex-1 py-3.5 text-sm font-medium transition-colors capitalize
                  ${
                    mode === m
                      ? "text-accent border-b-2 border-accent -mb-px bg-accent/5"
                      : "text-text-muted hover:text-text-secondary"
                  }
                `}
              >
                {m === "login" ? "Sign In" : "Create Account"}
              </button>
            ))}
          </div>

          {/* Form */}
          <form onSubmit={handleSubmit} className="p-6 space-y-4">
            {mode === "register" && (
              <Field
                label="Display Name"
                type="text"
                value={displayName}
                onChange={setDisplayName}
                placeholder="How others see you"
                autoComplete="name"
              />
            )}

            <Field
              label="Username"
              type="text"
              value={username}
              onChange={setUsername}
              placeholder={
                mode === "login" ? "your_username" : "choose_a_username"
              }
              autoComplete="username"
              required
            />

            <Field
              label="Password"
              type="password"
              value={password}
              onChange={setPassword}
              placeholder={
                mode === "register" ? "Min. 8 characters" : "••••••••"
              }
              autoComplete={
                mode === "login" ? "current-password" : "new-password"
              }
              required
            />

            {mode === "register" && (
              <Field
                label="Confirm Password"
                type="password"
                value={confirmPass}
                onChange={setConfirmPass}
                placeholder="••••••••"
                autoComplete="new-password"
                required
              />
            )}

            {error && (
              <p className="text-danger text-sm flex items-center gap-2 animate-fade-in">
                <span>⚠</span> {error}
              </p>
            )}

            {mode === "register" && !error && (
              <div className="flex items-start gap-2 p-3 rounded-lg bg-accent/5 border border-accent/15">
                <span className="text-accent text-sm mt-0.5 shrink-0">🔐</span>
                <p className="text-text-muted text-xs leading-relaxed">
                  Keys are generated in your browser. Your password never leaves
                  your device — it wraps your private key locally.
                </p>
              </div>
            )}

            <button
              type="submit"
              disabled={loading}
              className="
                w-full py-3 rounded-xl font-semibold text-sm
                bg-accent text-bg-primary
                hover:bg-accent-dim
                disabled:opacity-50 disabled:cursor-not-allowed
                transition-all active:scale-[0.98]
                flex items-center justify-center gap-2
                shadow-lg shadow-accent/20
              "
            >
              {loading ? (
                <>
                  <Spinner size="sm" />
                  <span>
                    {mode === "register" ? "Generating keys…" : "Signing in…"}
                  </span>
                </>
              ) : mode === "login" ? (
                "Sign In"
              ) : (
                "Create Account"
              )}
            </button>
          </form>
        </div>

        <p className="text-center text-text-muted text-xs mt-6 font-mono">
          Messages are encrypted before leaving your device
        </p>
      </div>

      <style>{`
        @keyframes shake {
          0%, 100% { transform: translateX(0); }
          15% { transform: translateX(-6px); }
          30% { transform: translateX(6px); }
          45% { transform: translateX(-4px); }
          60% { transform: translateX(4px); }
          75% { transform: translateX(-2px); }
          90% { transform: translateX(2px); }
        }
      `}</style>
    </div>
  );
}

interface FieldProps {
  label: string;
  type: string;
  value: string;
  onChange: (v: string) => void;
  placeholder?: string;
  autoComplete?: string;
  required?: boolean;
}

function Field({
  label,
  type,
  value,
  onChange,
  placeholder,
  autoComplete,
  required,
}: FieldProps) {
  return (
    <div className="space-y-1.5">
      <label className="text-xs font-medium text-text-secondary uppercase tracking-wider">
        {label}
      </label>
      <input
        type={type}
        value={value}
        onChange={(e) => onChange(e.target.value)}
        placeholder={placeholder}
        autoComplete={autoComplete}
        required={required}
        className="
          w-full bg-bg-input border border-border rounded-xl px-4 py-2.5
          text-text-primary placeholder-text-muted text-sm
          focus:outline-none focus:border-accent/50 focus:ring-1 focus:ring-accent/20
          transition-all
        "
      />
    </div>
  );
}
