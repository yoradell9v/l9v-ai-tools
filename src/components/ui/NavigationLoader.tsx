"use client";

import { useEffect, useState, useRef } from "react";
import { usePathname } from "next/navigation";
import Loader from "./Loader";

export default function NavigationLoader() {
    const pathname = usePathname();
    const [isLoading, setIsLoading] = useState(false);
    const prevPathnameRef = useRef(pathname);

    useEffect(() => {
        // Intercept all link clicks to show loader immediately
        const handleLinkClick = (e: MouseEvent) => {
            const target = e.target as HTMLElement;
            const link = target.closest('a');

            if (link && link.href) {
                const href = link.getAttribute('href');

                // Ignore download links, blob URLs, data URLs, and programmatically created download links
                const isDownload = link.hasAttribute('download') ||
                    link.href.startsWith('blob:') ||
                    link.href.startsWith('data:') ||
                    link.getAttribute('data-download') === 'true' ||
                    link.style.display === 'none' || // Programmatically created links are often hidden
                    target.closest('[data-download]'); // Check if parent has download attribute

                // Only intercept internal links (not external links, anchors, or downloads)
                if (href &&
                    !isDownload &&
                    !href.startsWith('http') &&
                    !href.startsWith('mailto:') &&
                    !href.startsWith('tel:') &&
                    !href.startsWith('#') &&
                    !href.startsWith('blob:') &&
                    !href.startsWith('data:')) {
                    setIsLoading(true);
                } else if (isDownload) {
                    // Explicitly ensure loader is not shown for downloads
                    setIsLoading(false);
                }
            }
        };

        // Intercept router.push calls by listening to clicks on elements with router navigation
        document.addEventListener('click', handleLinkClick, true);

        // Handle pathname changes (when navigation completes)
        if (prevPathnameRef.current !== pathname) {
            setIsLoading(true);
            prevPathnameRef.current = pathname;

            // Hide loader after navigation completes
            const timer = setTimeout(() => {
                setIsLoading(false);
            }, 300);

            return () => {
                clearTimeout(timer);
                document.removeEventListener('click', handleLinkClick, true);
            };
        }

        // Safety: Clear loader if it's been showing for too long (5 seconds)
        // This prevents the loader from getting stuck
        const safetyTimer = setTimeout(() => {
            setIsLoading(false);
        }, 5000);

        return () => {
            clearTimeout(safetyTimer);
            document.removeEventListener('click', handleLinkClick, true);
        };
    }, [pathname]);

    if (!isLoading) return null;

    return (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/20 backdrop-blur-sm">
            <Loader />
        </div>
    );
}

