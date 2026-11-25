"use client";

import { io, type Socket } from "socket.io-client";
import { getApiBaseUrl } from "@/lib/api";

export const REALTIME_UPDATE_EVENT = "solvex:realtime-update";

let socket: Socket | null = null;

export function getRealtimeSocket() {
  if (!socket) {
    const apiOrigin = new URL(getApiBaseUrl(), window.location.origin).origin;
    socket = io(apiOrigin, {
      autoConnect: false,
      withCredentials: true,
    });
  }
  return socket;
}
