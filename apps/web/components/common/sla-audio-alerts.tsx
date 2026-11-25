"use client";

import { useCallback, useEffect, useRef, useState, useSyncExternalStore } from "react";
import { BellRing, Volume2, VolumeX } from "lucide-react";
import { apiRequest, type ApiSlaRisk, type ApiTicket } from "@/lib/api";
import { REALTIME_UPDATE_EVENT } from "@/lib/realtime";

type Role = "customer" | "agent" | "admin";
type AlertTicket = Pick<ApiSlaRisk, "ticketId" | "ticketCode" | "deadline"> & {
  remainingMs?: number;
};

const preferenceChangedEvent = "solvex:sla-audio-preference-changed";
const mutedPreferences = new Map<string, boolean>();

function readMutedPreference(key: string) {
  const cached = mutedPreferences.get(key);
  if (cached !== undefined) return cached;
  try {
    const saved = window.localStorage.getItem(key);
    return saved ? (JSON.parse(saved) as { muted?: boolean }).muted === true : false;
  } catch {
    return false;
  }
}

function subscribeToMutedPreference(key: string, onChange: () => void) {
  const onPreferenceChanged = (event: Event) => {
    if ((event as CustomEvent<{ key?: string }>).detail?.key === key) onChange();
  };
  const onStorage = (event: StorageEvent) => {
    if (event.key === key) onChange();
  };
  window.addEventListener(preferenceChangedEvent, onPreferenceChanged);
  window.addEventListener("storage", onStorage);
  return () => {
    window.removeEventListener(preferenceChangedEvent, onPreferenceChanged);
    window.removeEventListener("storage", onStorage);
  };
}

function createAlertKey(userId: string, ticket: AlertTicket, stage: string) {
  return `solvex:sla-alert:${userId}:${ticket.ticketId}:${ticket.deadline}:${stage}`;
}

function playTone(context: AudioContext, stage: string) {
  const count = stage === "breach" ? 4 : stage === "1m" ? 3 : stage === "5m" ? 2 : 1;
  const frequency = stage === "breach" ? 880 : stage === "1m" ? 760 : stage === "5m" ? 640 : 520;
  for (let index = 0; index < count; index += 1) {
    const oscillator = context.createOscillator();
    const gain = context.createGain();
    const start = context.currentTime + index * 0.18;
    oscillator.type = "sine";
    oscillator.frequency.value = frequency;
    gain.gain.setValueAtTime(0.0001, start);
    gain.gain.exponentialRampToValueAtTime(0.12, start + 0.015);
    gain.gain.exponentialRampToValueAtTime(0.0001, start + 0.13);
    oscillator.connect(gain);
    gain.connect(context.destination);
    oscillator.start(start);
    oscillator.stop(start + 0.14);
  }
}

export function SlaAudioAlerts({ role, userId }: { role: Role; userId: string }) {
  const [tickets, setTickets] = useState<AlertTicket[]>([]);
  const [enabled, setEnabled] = useState(false);
  const [notice, setNotice] = useState("");
  const audioContext = useRef<AudioContext | null>(null);
  const previousRemaining = useRef(new Map<string, number>());
  const seenAlerts = useRef(new Set<string>());
  const ticketsRef = useRef(tickets);
  const preferenceKey = `solvex:sla-audio:${userId}`;
  const muted = useSyncExternalStore(
    useCallback((onChange) => subscribeToMutedPreference(preferenceKey, onChange), [preferenceKey]),
    useCallback(() => readMutedPreference(preferenceKey), [preferenceKey]),
    () => false,
  );

  useEffect(() => {
    ticketsRef.current = tickets;
  }, [tickets]);

  useEffect(() => {
    let active = true;
    const loadTickets = async () => {
      try {
        if (role === "customer") {
          const result = await apiRequest<{ items: ApiTicket[] }>("/tickets?page=1&limit=100");
          if (!active) return;
          setTickets(result.items.flatMap((ticket) => {
            if (ticket.status === "RESOLVED" || ticket.status === "CLOSED" || !ticket.slaRecord) return [];
            const deadline = ticket.slaRecord.firstResponseAt
              ? ticket.slaRecord.resolutionDueAt
              : ticket.slaRecord.firstResponseDueAt;
            return deadline ? [{ ticketId: ticket.id, ticketCode: ticket.ticketCode, deadline }] : [];
          }));
        } else {
          const result = await apiRequest<{ items: ApiSlaRisk[] }>("/sla/risks");
          if (!active) return;
          setTickets(result.items.map(({ ticketId, ticketCode, deadline, remainingMs }) => ({
            ticketId,
            ticketCode,
            deadline,
            remainingMs,
          })));
        }
      } catch (error) {
        if (active) setNotice(error instanceof Error ? `SLA alerts unavailable: ${error.message}` : "SLA alerts are unavailable.");
      }
    };
    void loadTickets();
    const refresh = () => { void loadTickets(); };
    window.addEventListener(REALTIME_UPDATE_EVENT, refresh);
    return () => {
      active = false;
      window.removeEventListener(REALTIME_UPDATE_EVENT, refresh);
    };
  }, [role]);

  const savePreference = useCallback((next: { enabled: boolean; muted: boolean }) => {
    mutedPreferences.set(preferenceKey, next.muted);
    try {
      window.localStorage.setItem(preferenceKey, JSON.stringify(next));
    } catch {
      setNotice("Audio preferences could not be saved in this browser.");
    }
    window.dispatchEvent(new CustomEvent(preferenceChangedEvent, { detail: { key: preferenceKey } }));
  }, [preferenceKey]);

  const activateSound = useCallback(async () => {
    const Context = window.AudioContext;
    if (!Context) {
      setNotice("Audio alerts are not supported by this browser.");
      return;
    }
    const context = audioContext.current ?? new Context();
    audioContext.current = context;
    try {
      await context.resume();
      setEnabled(true);
      savePreference({ enabled: true, muted: false });
      setNotice("SLA sound alerts enabled.");
    } catch {
      setNotice("The browser blocked audio. Use the enable-sound button again to allow it.");
    }
  }, [savePreference]);

  const toggleMuted = useCallback(() => {
    const nextMuted = !muted;
    savePreference({ enabled, muted: nextMuted });
  }, [enabled, muted, savePreference]);

  const testSound = useCallback(async () => {
    if (!audioContext.current) {
      const Context = window.AudioContext;
      if (!Context) {
        setNotice("Audio alerts are not supported by this browser.");
        return;
      }
      audioContext.current = new Context();
    }
    try {
      await audioContext.current.resume();
      playTone(audioContext.current, "5m");
      setNotice("Test sound played.");
    } catch {
      setNotice("The browser blocked audio. Enable sound from this page first.");
    }
  }, []);

  useEffect(() => {
    const check = () => {
      const now = Date.now();
      for (const ticket of ticketsRef.current) {
        const remaining = new Date(ticket.deadline).getTime() - now;
        if (!Number.isFinite(remaining)) continue;
        const identity = `${ticket.ticketId}:${ticket.deadline}`;
        const previous = previousRemaining.current.get(identity);
        previousRemaining.current.set(identity, remaining);
        const stage = remaining <= 0
          ? "breach"
          : previous === undefined
            ? remaining <= 60_000 ? "1m" : remaining <= 5 * 60_000 ? "5m" : remaining <= 15 * 60_000 ? "15m" : null
            : previous > 60_000 && remaining <= 60_000 ? "1m"
              : previous > 5 * 60_000 && remaining <= 5 * 60_000 ? "5m"
                : previous > 15 * 60_000 && remaining <= 15 * 60_000 ? "15m"
                  : null;
        if (!stage) continue;

        const key = createAlertKey(userId, ticket, stage);
        try {
          if (seenAlerts.current.has(key) || window.localStorage.getItem(key)) continue;
          window.localStorage.setItem(key, "1");
        } catch {
          if (seenAlerts.current.has(key)) continue;
          setNotice("Alert deduplication could not be persisted in this browser.");
        }
        seenAlerts.current.add(key);
        const label = stage === "breach" ? "SLA deadline reached" : `${stage} SLA warning`;
        setNotice(`${label} · ${ticket.ticketCode}`);
        if (enabled && !muted && audioContext.current?.state === "running") {
          playTone(audioContext.current, stage);
        }
      }
    };
    check();
    const timer = window.setInterval(check, 1000);
    return () => window.clearInterval(timer);
  }, [enabled, muted, tickets, userId]);

  useEffect(() => () => {
    void audioContext.current?.close();
    audioContext.current = null;
  }, []);

  return (
    <div id="sla-audio-controls" className="flex items-center gap-1">
      {!enabled ? (
        <button type="button" onClick={() => void activateSound()} className="rounded-lg border border-blue-200 bg-blue-50 px-2.5 py-2 text-[10px] font-semibold text-blue-700 hover:bg-blue-100">Enable sound</button>
      ) : (
        <button type="button" onClick={toggleMuted} aria-label={muted ? "Unmute SLA alerts" : "Mute SLA alerts"} title={muted ? "Unmute SLA alerts" : "Mute SLA alerts"} className="grid h-9 w-9 place-items-center rounded-lg border border-slate-200 text-slate-600 hover:bg-slate-50">
          {muted ? <VolumeX size={15} /> : <Volume2 size={15} />}
        </button>
      )}
      <button type="button" onClick={() => void testSound()} aria-label="Test SLA warning sound" title="Test SLA warning sound" className="grid h-9 w-9 place-items-center rounded-lg border border-slate-200 text-slate-600 hover:bg-slate-50"><BellRing size={14} /></button>
      {notice && <div role="status" aria-live="polite" className="fixed bottom-5 right-5 z-50 max-w-sm rounded-xl border border-blue-100 bg-white px-4 py-3 text-xs font-medium text-slate-800 shadow-xl">{notice}</div>}
    </div>
  );
}
