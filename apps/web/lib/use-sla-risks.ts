"use client";

import { useEffect, useState } from "react";
import { apiRequest, type ApiSlaRisk } from "@/lib/api";
import { REALTIME_UPDATE_EVENT } from "@/lib/realtime";

export function useSlaRisks() {
  const [risks, setRisks] = useState<ApiSlaRisk[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");

  useEffect(() => {
    let active = true;
    const loadRisks = async () => {
      try {
        const result = await apiRequest<{ items: ApiSlaRisk[] }>("/sla/risks");
        if (active) {
          setRisks(result.items);
          setError("");
        }
      } catch (requestError) {
        if (active) setError(requestError instanceof Error ? requestError.message : "SLA risk data is unavailable.");
      } finally {
        if (active) setLoading(false);
      }
    };
    const refreshOnRealtimeUpdate = () => { void loadRisks(); };
    void loadRisks();
    window.addEventListener(REALTIME_UPDATE_EVENT, refreshOnRealtimeUpdate);
    return () => {
      active = false;
      window.removeEventListener(REALTIME_UPDATE_EVENT, refreshOnRealtimeUpdate);
    };
  }, []);

  return { risks, loading, error };
}
