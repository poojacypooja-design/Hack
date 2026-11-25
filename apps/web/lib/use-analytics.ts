"use client";

import { useEffect, useState } from "react";
import { apiRequest, type ApiAnalytics } from "@/lib/api";
import { REALTIME_UPDATE_EVENT } from "@/lib/realtime";

type Role = "customer" | "agent" | "admin";

export function useAnalytics(role: Role) {
  const [analytics, setAnalytics] = useState<ApiAnalytics | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");

  useEffect(() => {
    let active = true;
    const loadAnalytics = async () => {
      try {
        const result = await apiRequest<ApiAnalytics>("/analytics");
        if (active) {
          setAnalytics(result);
          setError("");
        }
      } catch (requestError) {
        if (active) setError(requestError instanceof Error ? requestError.message : "Analytics are unavailable.");
      } finally {
        if (active) setLoading(false);
      }
    };
    const refreshOnRealtimeUpdate = () => { void loadAnalytics(); };
    void loadAnalytics();
    window.addEventListener(REALTIME_UPDATE_EVENT, refreshOnRealtimeUpdate);
    return () => {
      active = false;
      window.removeEventListener(REALTIME_UPDATE_EVENT, refreshOnRealtimeUpdate);
    };
  }, [role]);

  return { analytics, loading, error };
}
