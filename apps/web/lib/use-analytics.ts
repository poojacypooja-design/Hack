"use client";

import { useEffect, useState } from "react";
import { apiRequest, type ApiAnalytics } from "@/lib/api";

type Role = "customer" | "agent" | "admin";

export function useAnalytics(role: Role) {
  const [analytics, setAnalytics] = useState<ApiAnalytics | null>(null);
  const [loading, setLoading] = useState(role !== "customer");
  const [error, setError] = useState("");

  useEffect(() => {
    let active = true;
    if (role === "customer") return;
    apiRequest<ApiAnalytics>("/analytics")
      .then((result) => {
        if (active) setAnalytics(result);
      })
      .catch((requestError: unknown) => {
        if (active) setError(requestError instanceof Error ? requestError.message : "Analytics are unavailable.");
      })
      .finally(() => {
        if (active) setLoading(false);
      });

    return () => {
      active = false;
    };
  }, [role]);

  return { analytics, loading, error };
}
