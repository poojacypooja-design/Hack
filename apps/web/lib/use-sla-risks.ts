"use client";

import { useEffect, useState } from "react";
import { apiRequest, type ApiSlaRisk } from "@/lib/api";

export function useSlaRisks() {
  const [risks, setRisks] = useState<ApiSlaRisk[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");

  useEffect(() => {
    let active = true;
    apiRequest<{ items: ApiSlaRisk[] }>("/sla/risks")
      .then((result) => {
        if (active) setRisks(result.items);
      })
      .catch((requestError: unknown) => {
        if (active) setError(requestError instanceof Error ? requestError.message : "SLA risk data is unavailable.");
      })
      .finally(() => {
        if (active) setLoading(false);
      });

    return () => {
      active = false;
    };
  }, []);

  return { risks, loading, error };
}
