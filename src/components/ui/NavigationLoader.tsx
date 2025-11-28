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
                // Only intercept internal links (not external links or anchors)
                if (href && !href.startsWith('http') && !href.startsWith('mailto:') && !href.startsWith('tel:') && !href.startsWith('#')) {
                    setIsLoading(true);
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

        return () => {
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

