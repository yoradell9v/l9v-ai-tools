"use client";

import { useEffect } from "react";
import { setupFetchInterceptor } from "@/lib/fetch-interceptor";

export function ClientProviders({ children }: { children: React.ReactNode }) {
    useEffect(() => {
        setupFetchInterceptor();
    }, []);

    return <>{children}</>;
}