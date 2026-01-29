"use client";

import { SidebarTrigger } from "@/components/ui/sidebar";
import { CalendarIcon } from "@heroicons/react/24/outline";

export default function TaskIntelligencePage() {
    return (
        <div className="w-full max-w-screen overflow-x-hidden h-screen flex flex-col">
            <div className="flex items-center gap-2 p-4 border-b flex-shrink-0">
                <SidebarTrigger />
            </div>
            <div className="transition-all duration-300 ease-in-out flex-1 min-h-0 flex flex-col overflow-hidden overflow-x-hidden w-full max-w-full">
                <div className="w-full max-w-full py-10 md:px-8 lg:px-16 xl:px-24 2xl:px-32 flex flex-col flex-1 min-h-0 overflow-auto">
                    <div className="py-16 space-y-6 text-center">
                        <div className="mx-auto flex h-24 w-24 items-center justify-center rounded-full bg-gradient-to-br from-[color:var(--accent-strong)]/20 to-[color:var(--primary-dark)]/20">
                            <CalendarIcon className="h-12 w-12 text-[color:var(--accent-strong)]" />
                        </div>
                        <div className="space-y-3 max-w-2xl mx-auto">
                            <h1 className="text-2xl font-semibold">Task Intelligence</h1>
                            <p className="text-base text-muted-foreground">
                                Coming soon. Create and assign tasks to your virtual assistant with AI-matched templates, subtasks, and quality checklists.
                            </p>
                        </div>
                    </div>
                </div>
            </div>
        </div>
    );
}
