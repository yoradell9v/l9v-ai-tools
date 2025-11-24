"use client";

import Navbar from "@/components/ui/Navbar";

export default function DashboardPage() {
    return (
        <>
            <Navbar />
            <div
                className="transition-all duration-300 ease-in-out"
                style={{ marginLeft: "var(--sidebar-width, 16rem)" }}
            >
                <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
                    <h1 className="text-2xl font-semibold" style={{ color: "var(--text-primary)" }}>
                        Dashboard Page
                    </h1>
                </div>
            </div>
        </>
    );
}