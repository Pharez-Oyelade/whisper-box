type EventHandler<T = unknown> = (data: T) => void;

interface WsMessageReceive {
  event: "message.receive";
  id: string;
  from_user_id: string;
  to_user_id: string;
  payload: {
    ciphertext: string;
    iv: string;
    encryptedKey: string;
    encryptedKeyForSelf: string;
  };
  created_at: string;
}

interface WsUserPresence {
  event: "user.online" | "user.offline";
  user_id: string;
}

interface WsError {
  event: "error";
  detail: string;
}

export type WsEvent = WsMessageReceive | WsUserPresence | WsError;

export class WhisperSocket {
  private ws: WebSocket | null = null;
  private handlers = new Map<string, EventHandler[]>();
  private reconnectTimer: ReturnType<typeof setTimeout> | null = null;
  private reconnectDelay = 1000;
  private maxDelay = 30_000;
  private active = false;
  private getToken: () => string | null;

  constructor(getToken: () => string | null) {
    this.getToken = getToken;
  }

  connect() {
    this.active = true;
    this._open();
  }

  private _open() {
    const token = this.getToken();
    if (!token || !this.active) return;

    this.ws = new WebSocket(`wss://whisperbox.koyeb.app/ws?token=${token}`);

    this.ws.onopen = () => {
      this.reconnectDelay = 1000;
      this._emit("connected", null);
    };

    this.ws.onmessage = (e: MessageEvent) => {
      try {
        const data = JSON.parse(e.data as string) as WsEvent;
        this._emit(data.event, data);
      } catch {}
    };

    this.ws.onclose = () => {
      this._emit("disconnected", null);
      if (this.active) this._scheduleReconnect();
    };

    this.ws.onerror = () => {
      this.ws?.close();
    };
  }

  private _scheduleReconnect() {
    this.reconnectTimer = setTimeout(() => {
      this.reconnectDelay = Math.min(this.reconnectDelay * 1.5, this.maxDelay);
      this._open();
    }, this.reconnectDelay);
  }

  reconnect() {
    if (this.reconnectTimer) clearTimeout(this.reconnectTimer);
    this.ws?.close();
    this.ws = null;
    if (this.active) this._open();
  }

  disconnect() {
    this.active = false;
    if (this.reconnectTimer) clearTimeout(this.reconnectTimer);
    this.ws?.close();
    this.ws = null;
  }

  send(data: object): boolean {
    if (this.ws?.readyState === WebSocket.OPEN) {
      this.ws.send(JSON.stringify(data));
      return true;
    }
    return false;
  }

  on<T = unknown>(event: string, handler: EventHandler<T>) {
    if (!this.handlers.has(event)) this.handlers.set(event, []);
    this.handlers.get(event)!.push(handler as EventHandler);
    return () => this.off(event, handler as EventHandler);
  }

  off(event: string, handler: EventHandler) {
    const list = this.handlers.get(event) ?? [];
    this.handlers.set(
      event,
      list.filter((h) => h !== handler),
    );
  }

  private _emit(event: string, data: unknown) {
    (this.handlers.get(event) ?? []).forEach((h) => h(data));
  }

  get connected(): boolean {
    return this.ws?.readyState === WebSocket.OPEN;
  }
}
