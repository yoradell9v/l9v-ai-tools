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

    // Check if this is an external URL (not same origin)
    // External URLs (like S3) should use credentials: "omit" to avoid CORS issues
    let shouldIncludeCredentials = true; // Default to true for same-origin requests
    if (url.startsWith("http://") || url.startsWith("https://")) {
      // This is an absolute URL - check if it's same origin
      try {
        const urlObj = new URL(url);
        shouldIncludeCredentials = urlObj.origin === window.location.origin;
      } catch {
        // If URL parsing fails, default to including credentials (shouldn't happen)
        shouldIncludeCredentials = true;
      }
    }
    // Relative URLs (like "/api/...") are same-origin, so shouldIncludeCredentials stays true

    // Make the original request
    let response = await originalFetch(input, {
      ...init,
      credentials: init?.credentials !== undefined 
        ? init.credentials 
        : shouldIncludeCredentials 
          ? "include" 
          : "omit",
    });

    // If unauthorized, try to refresh (only for same-origin requests)
    if (response.status === 401 && shouldIncludeCredentials) {
      const refreshed = await refreshAccessToken();

      if (refreshed) {
        // Retry the original request
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
