"use client";

import { useCallback, useEffect, useState } from "react";
import { apiRequest, ApiError, type ApiUser } from "@/lib/api";

export function useSession() {
  const [user, setUser] = useState<ApiUser | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");

  const loadSession = useCallback(async () => {
    try {
      const result = await apiRequest<{ user: ApiUser }>("/auth/me");
      setUser(result.user);
      return result.user;
    } catch (requestError) {
      setUser(null);
      if (!(requestError instanceof ApiError && requestError.status === 401)) {
        setError(requestError instanceof Error ? requestError.message : "Could not verify your session.");
      }
      return null;
    } finally {
      setLoading(false);
    }
  }, []);

  const refresh = useCallback(async () => {
    setLoading(true);
    setError("");
    return loadSession();
  }, [loadSession]);

  useEffect(() => {
    let active = true;
    apiRequest<{ user: ApiUser }>("/auth/me")
      .then((result) => { if (active) setUser(result.user); })
      .catch((requestError: unknown) => {
        if (!active) return;
        setUser(null);
        if (!(requestError instanceof ApiError && requestError.status === 401)) {
          setError(requestError instanceof Error ? requestError.message : "Could not verify your session.");
        }
      })
      .finally(() => { if (active) setLoading(false); });
    return () => { active = false; };
  }, []);

  return { user, loading, error, refresh };
}
