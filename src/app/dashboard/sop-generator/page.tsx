"use client";

import Navbar from "@/components/ui/Navbar";
import { Clock } from "lucide-react";

export default function SopPage() {
    return (
        <>
            <Navbar />
            <div
                className="transition-all duration-300 ease-in-out min-h-screen ml-64"
            >
                <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
                    <div className="flex flex-col items-center justify-center py-16 px-6 text-center">
                        <div
                            className="p-4 rounded-xl mb-4 bg-[var(--accent)]/20"
                        >
                            <Clock
                                size={40}
                                className="text-[var(--accent)]"
                            />
                        </div>
                        <h1 className="text-2xl font-semibold mb-2 text-[#18416B] dark:text-[#FAC133]">
                            SOP Builder AI
                        </h1>
                        <p className="text-sm mb-4 max-w-sm text-[#1a1a1a] dark:text-[#e0e0e0]">
                            Coming soon - Automatically generate standard operating procedures for your business.
                        </p>
                        <span className="text-xs font-medium px-3 py-1 rounded-full bg-zinc-200 dark:bg-zinc-700 text-zinc-600 dark:text-zinc-400">
                            COMING SOON
                        </span>
                    </div>
                </div>
            </div>
        </>
    );
}