import { useEffect, useRef } from 'react';
import { getToken, socketUrl } from './api';

/** Canal WebSocket autenticado; trata reconexão e limpeza. */
export function useRealtime(onEvent: (event: string, data: any) => void) {
  const cb = useRef(onEvent); cb.current = onEvent;
  useEffect(() => {
    const token = getToken();
    if (!token) return;
    let ws: WebSocket | null = null; let retry: any = null; let closed = false;
    const connect = () => {
      ws = new WebSocket(socketUrl(token));
      ws.onmessage = e => { try { const m = JSON.parse(e.data); if (m.type !== 'ready') cb.current(m.type, m.data); } catch { /* ignora */ } };
      ws.onclose = () => { if (!closed) retry = setTimeout(connect, 3000); };
    };
    connect();
    return () => { closed = true; clearTimeout(retry); ws?.close(); };
  }, []);
}
