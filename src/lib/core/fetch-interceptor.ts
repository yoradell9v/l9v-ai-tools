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
    const url =
      typeof input === "string"
        ? input
        : input instanceof URL
        ? input.href
        : input.url;
    if (url.includes("/api/auth/refresh")) {
      return originalFetch(input, init);
    }

    let shouldIncludeCredentials = true;
    if (url.startsWith("http://") || url.startsWith("https://")) {
      try {
        const urlObj = new URL(url);
        shouldIncludeCredentials = urlObj.origin === window.location.origin;
      } catch {
        shouldIncludeCredentials = true;
      }
    }
    let response = await originalFetch(input, {
      ...init,
      credentials: init?.credentials !== undefined 
        ? init.credentials 
        : shouldIncludeCredentials 
          ? "include" 
          : "omit",
    });
    if (response.status === 401 && shouldIncludeCredentials) {
      const refreshed = await refreshAccessToken();

      if (refreshed) {
        response = await originalFetch(input, {
          ...init,
          credentials: init?.credentials !== undefined 
            ? init.credentials 
            : shouldIncludeCredentials 
              ? "include" 
              : "omit",
        });
      }
    }

    return response;
  };
}
