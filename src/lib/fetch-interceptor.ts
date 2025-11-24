"use client";

let isRefreshing = false;
let refreshPromise: Promise<boolean> | null = null;

async function refreshAccessToken(): Promise<boolean> {
  if (isRefreshing && refreshPromise) {
    return refreshPromise;
  }

  isRefreshing = true;
  refreshPromise = (async () => {
    try {
      const response = await window.fetch("/api/auth/refresh", {
        method: "POST",
        credentials: "include",
      });

      if (response.ok) {
        return true;
      }

      // Refresh failed, redirect to login
      window.location.href = "/signin";
      return false;
    } catch (error) {
      console.error("Token refresh failed:", error);
      window.location.href = "/signin";
      return false;
    } finally {
      isRefreshing = false;
      refreshPromise = null;
    }
  })();

  return refreshPromise;
}

export function setupFetchInterceptor() {
  if (typeof window === "undefined") return;

  const originalFetch = window.fetch;

  window.fetch = async (input: RequestInfo | URL, init?: RequestInit) => {
    // Skip interception for refresh endpoint to avoid infinite loop
    const url =
      typeof input === "string"
        ? input
        : input instanceof URL
        ? input.href
        : input.url;
    if (url.includes("/api/auth/refresh")) {
      return originalFetch(input, init);
    }

    // Make the original request
    let response = await originalFetch(input, {
      ...init,
      credentials: init?.credentials || "include",
    });

    // If unauthorized, try to refresh
    if (response.status === 401) {
      const refreshed = await refreshAccessToken();

      if (refreshed) {
        // Retry the original request
        response = await originalFetch(input, {
          ...init,
          credentials: init?.credentials || "include",
        });
      }
    }

    return response;
  };
}
