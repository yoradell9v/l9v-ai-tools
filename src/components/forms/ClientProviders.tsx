"use client";

import { useEffect } from "react";
import { setupFetchInterceptor } from "@/lib/core/fetch-interceptor";
import { Toaster } from "@/components/ui/sonner";

export function ClientProviders({ children }: { children: React.ReactNode }) {
    useEffect(() => {
        setupFetchInterceptor();
    }, []);

    return (
        <>
            {children}
            <Toaster />
        </>
    );
}