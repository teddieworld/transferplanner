"use client";

import { useEffect, useState } from "react";

type RemoteState<T> = { url: string; data: T | null; error: string | null };

// Ignore results from an earlier selection and cancel obsolete requests.
export function useRemoteData<T>(url: string | null) {
  const [state, setState] = useState<RemoteState<T> | null>(null);

  useEffect(() => {
    if (!url) return;
    const controller = new AbortController();
    const requestUrl = url;

    async function load() {
      try {
        const response = await fetch(requestUrl, { signal: controller.signal });
        if (!response.ok) throw new Error("Request failed");
        const data: T = await response.json();
        if (!controller.signal.aborted) setState({ url: requestUrl, data, error: null });
      } catch {
        if (!controller.signal.aborted) {
          setState({ url: requestUrl, data: null, error: "Unable to load data. Please refresh to try again." });
        }
      }
    }
    void load();
    return () => controller.abort();
  }, [url]);

  const current = url && state?.url === url ? state : null;
  return {
    data: current?.data ?? null,
    error: current?.error ?? null,
    isLoading: url !== null && current === null
  };
}
