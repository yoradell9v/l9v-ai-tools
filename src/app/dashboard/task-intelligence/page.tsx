"use client";

import React, { useState, useEffect, useCallback } from "react";
import { SidebarTrigger } from "@/components/ui/sidebar";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Card, CardContent } from "@/components/ui/card";
import { Calendar } from "@/components/ui/calendar";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import {
    Dialog,
    DialogContent,
    DialogHeader,
    DialogTitle,
    DialogFooter,
} from "@/components/ui/dialog";
import {
    Paperclip,
    Sparkles,
    Trash2,
    Mic,
    Square,
    Plus,
    Loader2,
    ChevronRight,
    Send,
    Search,
    PenTool,
    Headset,
    ClipboardList,
    ChevronDown,
    ChevronUp,
    LayoutGrid,
    Calendar as CalendarIcon,
    Link2,
    X,
    FileStack,
    AlertCircle,
    ArrowUpDown,
} from "lucide-react";
import {
    ChartPieIcon,
    Cog6ToothIcon,
    PaintBrushIcon,
    CodeBracketIcon,
    MegaphoneIcon,
    ShareIcon,
    VideoCameraIcon,
    ClipboardDocumentCheckIcon,
    RectangleStackIcon,
    XMarkIcon,
} from "@heroicons/react/24/outline";
import { useSpeechRecognition } from "@/components/chat/useSpeechRecognition";
import { toast } from "sonner";

const STAGES = [
    { label: "Draft", key: "draft" },
    { label: "Edit Details", key: "edit" },
    { label: "Review & Submit", key: "review" },
] as const;

type TaskStatus = "DRAFT" | "SUBMITTED";

interface Task {
    id: string;
    userPrompt: string;
    title: string;
    category: string;
    description: string;
    keyConsiderations: string;
    subtasks: string[];
    deliverables: string[];
    qualityControlChecklist: string[];
    status: TaskStatus;
    submittedAt: string | null;
    createdAt: string;
    matchReason?: string | null;
    matchedTemplateId?: string | null;
    matchedTemplate?: { id: string; title: string } | null;
    requestedCompletionAt?: string | null;
    assetLinks?: string[];
}

interface TaskListItem {
    id: string;
    title: string;
    category: string;
    status: TaskStatus;
    createdAt: string;
    submittedAt: string | null;
}

interface TemplateLibraryItem {
    id: string;
    title: string;
    category: string;
    description: string;
    keyConsiderations?: string;
    subtasks: string[];
    deliverables: string[];
    qualityControlChecklist: string[];
    subtaskCount: number;
}

const TEMPLATE_CATEGORY_ICONS: Record<string, React.ComponentType<{ className?: string }>> = {
    Admin: ClipboardList,
    Analytics: ChartPieIcon,
    Automation: Cog6ToothIcon,
    Content: PenTool,
    "Customer Support": Headset,
    Design: PaintBrushIcon,
    Development: CodeBracketIcon,
    Marketing: MegaphoneIcon,
    Operations: Cog6ToothIcon,
    "Social Media": ShareIcon,
    "Video/Audio": VideoCameraIcon,
};

const TEMPLATE_CATEGORY_CARD_BOX: Record<string, string> = {
    Admin: "bg-emerald-100/70 text-emerald-700 dark:bg-emerald-900/30 dark:text-emerald-300",
    Analytics: "bg-indigo-100/70 text-indigo-700 dark:bg-indigo-900/30 dark:text-indigo-300",
    Automation: "bg-slate-100/70 text-slate-700 dark:bg-slate-700/30 dark:text-slate-300",
    Content: "bg-violet-100/70 text-violet-700 dark:bg-violet-900/30 dark:text-violet-300",
    "Customer Support": "bg-sky-100/70 text-sky-700 dark:bg-sky-900/30 dark:text-sky-300",
    Design: "bg-rose-100/70 text-rose-700 dark:bg-rose-900/30 dark:text-rose-300",
    Development: "bg-blue-100/70 text-blue-700 dark:bg-blue-900/30 dark:text-blue-300",
    Marketing: "bg-amber-100/70 text-amber-700 dark:bg-amber-900/30 dark:text-amber-300",
    Operations: "bg-teal-100/70 text-teal-700 dark:bg-teal-900/30 dark:text-teal-300",
    "Social Media": "bg-pink-100/70 text-pink-700 dark:bg-pink-900/30 dark:text-pink-300",
    "Video/Audio": "bg-orange-100/70 text-orange-700 dark:bg-orange-900/30 dark:text-orange-300",
};

const TEMPLATE_CATEGORY_BUTTON_ICON: Record<string, string> = {
    Admin: "text-emerald-600 dark:text-emerald-400",
    Analytics: "text-indigo-600 dark:text-indigo-400",
    Automation: "text-slate-600 dark:text-slate-400",
    Content: "text-violet-600 dark:text-violet-400",
    "Customer Support": "text-sky-600 dark:text-sky-400",
    Design: "text-rose-600 dark:text-rose-400",
    Development: "text-blue-600 dark:text-blue-400",
    Marketing: "text-amber-600 dark:text-amber-400",
    Operations: "text-teal-600 dark:text-teal-400",
    "Social Media": "text-pink-600 dark:text-pink-400",
    "Video/Audio": "text-orange-600 dark:text-orange-400",
};

const DEFAULT_CARD_BOX = "bg-muted/70 text-muted-foreground";
const DEFAULT_BUTTON_ICON = "text-muted-foreground";

function friendlyErrorMessage(apiError: string | undefined, fallback: string): string {
    if (!apiError || typeof apiError !== "string") return fallback;
    const technical =
        /Unknown arg|TaskUpdateInput|Prisma|EnumTaskStatus|NullableDateTime|StringFieldUpdateOperations/i.test(
            apiError
        );
    return technical ? fallback : apiError.length > 120 ? fallback : apiError;
}

/** Format a Date as YYYY-MM-DD in local time (avoids UTC off-by-one when using toISOString). */
function toLocalDateString(d: Date): string {
    const y = d.getFullYear();
    const m = String(d.getMonth() + 1).padStart(2, "0");
    const day = String(d.getDate()).padStart(2, "0");
    return `${y}-${m}-${day}`;
}

function ReviewField({
    label,
    children,
    className,
}: {
    label: string;
    children: React.ReactNode;
    className?: string;
}) {
    return (
        <div>
            <p className="text-base text-muted-foreground font-medium">{label}</p>
            <div className={className}>{children}</div>
        </div>
    );
}

export default function TaskIntelligencePage() {
    const [activeTab, setActiveTab] = useState<"new-task" | "templates">("new-task");
    const [currentStage, setCurrentStage] = useState(0);
    const [taskDescription, setTaskDescription] = useState("");
    const [currentTask, setCurrentTask] = useState<Task | null>(null);
    const [recentTasks, setRecentTasks] = useState<TaskListItem[]>([]);
    const [isCreating, setIsCreating] = useState(false);
    const [isUpdating, setIsUpdating] = useState(false);
    const [isUsingTemplate, setIsUsingTemplate] = useState(false);
    const [isLoadingTask, setIsLoadingTask] = useState(false);

    const [editTitle, setEditTitle] = useState("");
    const [editCategory, setEditCategory] = useState("");
    const [editDescription, setEditDescription] = useState("");
    const [editKeyConsiderations, setEditKeyConsiderations] = useState("");
    const [editSubtasks, setEditSubtasks] = useState<string[]>([]);
    const [editDeliverables, setEditDeliverables] = useState<string[]>([]);
    const [editQC, setEditQC] = useState<string[]>([]);
    const [editRequestedCompletionAt, setEditRequestedCompletionAt] = useState("");
    const [requestDatePickerOpen, setRequestDatePickerOpen] = useState(false);
    const [editAssetLinks, setEditAssetLinks] = useState<string[]>([]);
    const [assetsSectionExpanded, setAssetsSectionExpanded] = useState(true);

    const [templates, setTemplates] = useState<TemplateLibraryItem[]>([]);
    const [templatesLoading, setTemplatesLoading] = useState(false);
    const [templateSearch, setTemplateSearch] = useState("");
    const [selectedTemplateCategory, setSelectedTemplateCategory] = useState<string>("all");
    const [expandedTemplateCategories, setExpandedTemplateCategories] = useState<Set<string>>(new Set());
    const [selectedTemplateForDialog, setSelectedTemplateForDialog] = useState<TemplateLibraryItem | null>(null);
    const [recentTaskSearch, setRecentTaskSearch] = useState("");
    const [recentTasksSortOrder, setRecentTasksSortOrder] = useState<"desc" | "asc">("desc");
    const [recentTasksOpen, setRecentTasksOpen] = useState(true);

    const fetchRecentTasks = useCallback(async () => {
        try {
            const res = await fetch("/api/task-intelligence/tasks?limit=10");
            const json = await res.json();
            if (json.success && json.data?.tasks) {
                setRecentTasks(json.data.tasks);
            }
        } catch {
            // ignore
        }
    }, []);

    useEffect(() => {
        fetchRecentTasks();
    }, [fetchRecentTasks]);

    const fetchTemplates = useCallback(async () => {
        setTemplatesLoading(true);
        try {
            const res = await fetch("/api/task-intelligence/templates");
            const json = await res.json();
            if (json.success && json.data?.templates) {
                const list = json.data.templates as TemplateLibraryItem[];
                setTemplates(list);
                const categories: string[] = [...new Set(list.map((t) => t.category))].sort();
                setExpandedTemplateCategories(new Set(categories));
            }
        } catch {
            toast.error("Failed to load templates.");
        } finally {
            setTemplatesLoading(false);
        }
    }, []);

    useEffect(() => {
        if (activeTab === "templates") fetchTemplates();
    }, [activeTab, fetchTemplates]);

    useEffect(() => {
        if (currentTask) {
            setEditTitle(currentTask.title);
            setEditCategory(currentTask.category);
            setEditDescription(currentTask.description);
            setEditKeyConsiderations(currentTask.keyConsiderations);
            setEditSubtasks(currentTask.subtasks.length ? [...currentTask.subtasks] : [""]);
            setEditDeliverables(currentTask.deliverables.length ? [...currentTask.deliverables] : [""]);
            setEditQC(currentTask.qualityControlChecklist.length ? [...currentTask.qualityControlChecklist] : [""]);
            setEditRequestedCompletionAt(
                currentTask.requestedCompletionAt
                    ? toLocalDateString(new Date(currentTask.requestedCompletionAt.slice(0, 10) + "T12:00:00"))
                    : ""
            );
            setEditAssetLinks(
                currentTask.assetLinks && currentTask.assetLinks.length > 0
                    ? [...currentTask.assetLinks]
                    : [""]
            );
        }
    }, [currentTask]);

    const {
        transcript,
        isRecording,
        isSupported,
        error: speechError,
        startRecording,
        stopRecording,
        clearTranscript,
    } = useSpeechRecognition({
        onError: (err) => toast.error("Speech recognition error", { description: err }),
    });

    useEffect(() => {
        if (transcript) setTaskDescription(transcript);
    }, [transcript]);

    useEffect(() => {
        if (speechError) toast.error("Speech recognition error", { description: speechError });
    }, [speechError]);

    const handleClear = () => {
        setTaskDescription("");
        clearTranscript();
    };

    const handleCreateWithAI = async () => {
        const prompt = taskDescription.trim();
        if (!prompt) {
            toast.error("Please describe your task first.");
            return;
        }
        setIsCreating(true);
        try {
            const res = await fetch("/api/task-intelligence/draft", {
                method: "POST",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify({ userPrompt: prompt }),
            });
            const json = await res.json();
            if (!res.ok) {
                toast.error(friendlyErrorMessage(json.error, "We couldn't create your draft. Please try again."));
                return;
            }
            setCurrentTask(json.data as Task);
            setCurrentStage(1);
            toast.success("Draft created. Edit details below.");
            fetchRecentTasks();
        } catch {
            toast.error("We couldn't create your draft. Please try again.");
        } finally {
            setIsCreating(false);
        }
    };

    const handleUseTemplate = async (template: TemplateLibraryItem) => {
        setIsUsingTemplate(true);
        try {
            const res = await fetch("/api/task-intelligence/draft", {
                method: "POST",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify({
                    templateId: template.id,
                    userPrompt: template.title,
                }),
            });
            const json = await res.json();
            if (!res.ok) {
                toast.error(friendlyErrorMessage(json.error, "We couldn't create a task from this template. Please try again."));
                return;
            }
            setCurrentTask(json.data as Task);
            setCurrentStage(1);
            setActiveTab("new-task");
            setSelectedTemplateForDialog(null);
            toast.success("Task created from template. Edit details below.");
            fetchRecentTasks();
        } catch {
            toast.error("We couldn't create a task from this template. Please try again.");
        } finally {
            setIsUsingTemplate(false);
        }
    };

    const handleSelectRecentTask = async (taskId: string, status: TaskStatus) => {
        setIsLoadingTask(true);
        try {
            const res = await fetch(`/api/task-intelligence/draft/${taskId}`);
            const json = await res.json();
            if (!res.ok) {
                toast.error(json.error || "Could not load task.");
                return;
            }
            const task = json.data as Task;
            setCurrentTask(task);
            setActiveTab("new-task");
            if (status === "DRAFT") {
                setCurrentStage(1);
            } else {
                setCurrentStage(2);
            }
        } catch {
            toast.error("Could not load task.");
        } finally {
            setIsLoadingTask(false);
        }
    };

    const handleDetachTemplate = async () => {
        if (!currentTask) return;
        try {
            const res = await fetch(`/api/task-intelligence/draft/${currentTask.id}`, {
                method: "PATCH",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify({ matchedTemplateId: null }),
            });
            const json = await res.json();
            if (res.ok && json.data) {
                setCurrentTask({ ...currentTask, ...json.data, matchedTemplateId: null, matchedTemplate: null, matchReason: null });
            }
        } catch {
            toast.error("We couldn't detach the template. Please try again.");
        }
    };

    const handleContinueToReview = async () => {
        if (!currentTask) return;
        setIsUpdating(true);
        try {
            const res = await fetch(`/api/task-intelligence/draft/${currentTask.id}`, {
                method: "PATCH",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify({
                    title: editTitle.trim(),
                    category: editCategory.trim(),
                    description: editDescription.trim(),
                    keyConsiderations: editKeyConsiderations.trim(),
                    subtasks: editSubtasks.map((s) => s.trim()).filter(Boolean),
                    deliverables: editDeliverables.map((d) => d.trim()).filter(Boolean),
                    qualityControlChecklist: editQC.map((q) => q.trim()).filter(Boolean),
                    requestedCompletionAt: editRequestedCompletionAt.trim() || null,
                    assetLinks: editAssetLinks.map((u) => u.trim()).filter(Boolean),
                }),
            });
            const json = await res.json();
            if (!res.ok) {
                toast.error(friendlyErrorMessage(json.error, "We couldn't save your changes. Please try again."));
                return;
            }
            setCurrentTask(json.data as Task);
            setCurrentStage(2);
        } catch {
            toast.error("We couldn't save your changes. Please try again.");
        } finally {
            setIsUpdating(false);
        }
    };

    const handleSubmitTask = () => {
        // No action for now
    };

    const updateList = (
        list: string[],
        setList: React.Dispatch<React.SetStateAction<string[]>>,
        index: number,
        value: string
    ) => {
        const next = [...list];
        next[index] = value;
        setList(next);
    };

    const addToList = (list: string[], setList: React.Dispatch<React.SetStateAction<string[]>>) => {
        setList([...list, ""]);
    };

    const removeFromList = (
        list: string[],
        setList: React.Dispatch<React.SetStateAction<string[]>>,
        index: number
    ) => {
        if (list.length <= 1) return;
        setList(list.filter((_, i) => i !== index));
    };

    const filteredRecentTasks = React.useMemo(() => {
        const q = recentTaskSearch.trim().toLowerCase();
        let list = recentTasks;
        if (q) {
            list = list.filter(
                (t) =>
                    t.title.toLowerCase().includes(q) ||
                    t.category.toLowerCase().includes(q)
            );
        }
        list = [...list].sort((a, b) => {
            const da = new Date(a.createdAt).getTime();
            const db = new Date(b.createdAt).getTime();
            return recentTasksSortOrder === "desc" ? db - da : da - db;
        });
        return list;
    }, [recentTasks, recentTaskSearch, recentTasksSortOrder]);

    const displayTask = currentTask
        ? {
            ...currentTask,
            title: editTitle.trim() || currentTask.title,
            category: editCategory.trim() || currentTask.category,
            description: editDescription.trim() || currentTask.description,
            keyConsiderations: editKeyConsiderations.trim() || currentTask.keyConsiderations,
            subtasks: editSubtasks.map((s) => s.trim()).filter(Boolean),
            deliverables: editDeliverables.map((d) => d.trim()).filter(Boolean),
            qualityControlChecklist: editQC.map((q) => q.trim()).filter(Boolean),
            requestedCompletionAt: editRequestedCompletionAt.trim()
                ? new Date(editRequestedCompletionAt.trim() + "T12:00:00").toISOString()
                : currentTask.requestedCompletionAt ?? null,
            assetLinks: editAssetLinks.map((u) => u.trim()).filter(Boolean),
        }
        : null;

    return (
        <div className="w-full max-w-screen overflow-x-hidden h-screen flex flex-col">
            <div className="transition-all duration-300 ease-in-out flex-1 min-h-0 flex flex-col overflow-hidden overflow-x-hidden w-full max-w-full">
                <div className="w-full max-w-full py-10 md:px-8 lg:px-16 xl:px-24 2xl:px-32 flex flex-col flex-1 min-h-0 overflow-hidden">
                    <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between flex-shrink-0 mb-6">
                        <div>
                            <h1 className="text-2xl font-bold mb-1">Task Intelligence</h1>
                            <p className="text-base text-muted-foreground">
                                Describe what you need done or browse templates
                            </p>
                        </div>
                        <SidebarTrigger />
                    </div>

                    <Tabs
                        value={activeTab}
                        onValueChange={(v) => setActiveTab(v as "new-task" | "templates")}
                        className="flex-1 flex flex-col min-h-0"
                    >
                        <TabsList className="inline-flex mb-6">
                            <TabsTrigger value="new-task" className="gap-2">
                                <Plus className="h-4 w-4" />
                                New Task
                            </TabsTrigger>
                            <TabsTrigger value="templates" className="gap-2">
                                <RectangleStackIcon className="h-4 w-4" />
                                Template Library
                            </TabsTrigger>
                        </TabsList>

                        <TabsContent value="new-task" className="flex-1 mt-0 min-h-0 flex flex-col overflow-hidden">
                            <div className="max-w-3xl mx-auto w-full flex flex-col gap-4 sm:flex-row sm:items-center mb-6 flex-shrink-0">
                                {STAGES.map((stage, i) => (
                                    <React.Fragment key={stage.key}>
                                        <button
                                            type="button"
                                            onClick={() => setCurrentStage(i)}
                                            className={`flex items-center gap-2 rounded-lg border transition-colors flex-shrink-0 ${currentStage === i
                                                ? "border-muted-foreground/30 bg-blue-50 dark:bg-blue-950/30 px-3 py-2"
                                                : "border-transparent bg-transparent px-0 py-2 hover:opacity-80"
                                                }`}
                                        >
                                            <span
                                                className={`flex h-8 w-8 shrink-0 items-center justify-center rounded-full text-base font-medium ${currentStage === i
                                                    ? "bg-[var(--primary-dark)] text-white"
                                                    : "bg-muted text-muted-foreground"
                                                    }`}
                                            >
                                                {i + 1}
                                            </span>
                                            <span
                                                className={`text-base font-medium whitespace-nowrap ${currentStage === i
                                                    ? "text-[var(--primary-dark)]"
                                                    : "text-muted-foreground"
                                                    }`}
                                            >
                                                {stage.label}
                                            </span>
                                        </button>
                                        {i < STAGES.length - 1 && (
                                            <div
                                                className="flex-1 min-w-[24px] h-0 border-t border-dashed border-muted-foreground/40 mx-1"
                                                aria-hidden
                                            />
                                        )}
                                    </React.Fragment>
                                ))}
                            </div>

                            {currentStage === 0 && (
                                <div className="flex flex-col flex-1 min-h-0 gap-6">
                                    <div className="flex-shrink-0 rounded-lg border border-border/60 bg-muted/20 p-4 space-y-4">
                                        <h2 className="text-lg font-bold mb-3">What do you need done?</h2>
                                        <div className="relative">
                                            <Textarea
                                                placeholder="Describe your task in detail. You can type or use the mic to speak."
                                                value={taskDescription}
                                                onChange={(e) => setTaskDescription(e.target.value)}
                                                className="min-h-[140px] pr-12 resize-y"
                                                disabled={isRecording}
                                            />
                                            {isSupported && (
                                                <div className="absolute bottom-3 right-3">
                                                    {isRecording ? (
                                                        <Button
                                                            type="button"
                                                            variant="destructive"
                                                            size="icon"
                                                            className="h-9 w-9"
                                                            onClick={stopRecording}
                                                            title="Stop recording"
                                                        >
                                                            <Square className="h-4 w-4" />
                                                        </Button>
                                                    ) : (
                                                        <Button
                                                            type="button"
                                                            variant="outline"
                                                            size="icon"
                                                            className="h-9 w-9 border-[var(--primary-dark)] text-[var(--primary-dark)] hover:bg-[var(--primary-dark)]/10"
                                                            onClick={startRecording}
                                                            title="Tap to speak"
                                                        >
                                                            <Mic className="h-4 w-4" />
                                                        </Button>
                                                    )}
                                                </div>
                                            )}
                                        </div>
                                        <div className="flex flex-wrap items-center gap-2">
                                            <Button variant="outline" size="sm" className="gap-2" disabled>
                                                <Paperclip className="h-4 w-4" />
                                                Attach
                                            </Button>
                                            <Button
                                                size="sm"
                                                className="bg-[var(--primary-dark)] hover:bg-[var(--primary-dark)]/90 text-white gap-2"
                                                onClick={handleCreateWithAI}
                                                disabled={isCreating}
                                            >
                                                {isCreating ? (
                                                    <Loader2 className="h-4 w-4 animate-spin" />
                                                ) : (
                                                    <Sparkles className="h-4 w-4" />
                                                )}
                                                Create with AI
                                            </Button>
                                            <Button
                                                variant="ghost"
                                                size="sm"
                                                className="gap-2 text-muted-foreground"
                                                onClick={handleClear}
                                            >
                                                <Trash2 className="h-4 w-4" />
                                                Clear
                                            </Button>
                                        </div>
                                    </div>

                                    <div className="flex-1 min-h-0 flex flex-col overflow-hidden bg-muted/10">
                                        <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between flex-shrink-0 py-2">
                                            <button
                                                type="button"
                                                onClick={() => setRecentTasksOpen((o) => !o)}
                                                className="flex items-center gap-2 rounded-md py-1 pr-2 text-left text-base font-semibold transition-colors hover:bg-muted/50 focus-visible:outline focus-visible:ring-2 focus-visible:ring-ring"
                                                aria-expanded={recentTasksOpen}
                                            >
                                                <ChevronDown
                                                    className={`h-4 w-4 shrink-0 text-muted-foreground transition-transform duration-200 ${recentTasksOpen ? "" : "-rotate-90"}`}
                                                />
                                                <h3>Recent Tasks</h3>
                                            </button>
                                            <div className="flex flex-wrap items-center gap-2 shrink-0">
                                                <div className="relative w-[180px]">
                                                    <Search className="absolute left-2.5 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                                                    <Input
                                                        placeholder="Search tasks..."
                                                        value={recentTaskSearch}
                                                        onChange={(e) => setRecentTaskSearch(e.target.value)}
                                                        className="pl-8 text-base h-9"
                                                    />
                                                </div>
                                                <Button
                                                    type="button"
                                                    variant="outline"
                                                    size="sm"
                                                    className="gap-1.5 border-[var(--primary-dark)] text-[var(--primary-dark)] hover:bg-[var(--primary-dark)]/10 h-9"
                                                    onClick={() =>
                                                        setRecentTasksSortOrder((o) => (o === "desc" ? "asc" : "desc"))
                                                    }
                                                >
                                                    <ArrowUpDown className="h-4 w-4" />
                                                    {recentTasksSortOrder === "desc" ? "Newest" : "Oldest"}
                                                </Button>
                                            </div>
                                        </div>
                                        {recentTasksOpen && (
                                            <div className="flex-1 min-h-0 overflow-y-auto">
                                                {recentTasks.length === 0 ? (
                                                    <div className="rounded-lg border border-dashed border-muted-foreground/40 bg-muted/20 p-8 text-center">
                                                        <p className="text-base font-medium text-muted-foreground">
                                                            No tasks yet
                                                        </p>
                                                        <p className="text-base text-muted-foreground mt-1">
                                                            Describe what you need above and click Create with AI
                                                        </p>
                                                    </div>
                                                ) : filteredRecentTasks.length === 0 ? (
                                                    <div className="rounded-lg border border-dashed border-muted-foreground/40 bg-muted/20 p-6 text-center">
                                                        <p className="text-base font-medium text-muted-foreground">
                                                            No tasks match your search
                                                        </p>
                                                    </div>
                                                ) : (
                                                    <ul className="space-y-2 pr-1">
                                                        {filteredRecentTasks.map((t) => (
                                                            <li key={t.id}>
                                                                <Card
                                                                    className="cursor-pointer transition-colors hover:bg-muted/50 border-border/60"
                                                                    onClick={() => handleSelectRecentTask(t.id, t.status)}
                                                                >
                                                                    <CardContent className="py-3 px-4 flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
                                                                        <div className="flex items-center gap-3 min-w-0">
                                                                            <span className="flex h-9 w-9 shrink-0 items-center justify-center rounded bg-[var(--primary-dark)]/10 text-[var(--primary-dark)]">
                                                                                <RectangleStackIcon className="h-5 w-5" />
                                                                            </span>
                                                                            <div className="min-w-0">
                                                                                <p className="font-bold truncate">{t.title}</p>
                                                                                <p className="text-base text-muted-foreground">
                                                                                    {t.category} · {t.status.toLowerCase()} ·{" "}
                                                                                    {new Date(t.createdAt).toLocaleDateString()}
                                                                                </p>
                                                                            </div>
                                                                        </div>
                                                                        <span
                                                                            className={`shrink-0 text-xs px-2 py-0.5 rounded ${t.status === "DRAFT"
                                                                                ? "text-[color:var(--accent-strong)] bg-[color:var(--accent-strong)]/10"
                                                                                : "text-[var(--primary-dark)] bg-[var(--primary-dark)]/10"
                                                                                }`}
                                                                        >
                                                                            {t.status}
                                                                        </span>
                                                                    </CardContent>
                                                                </Card>
                                                            </li>
                                                        ))}
                                                    </ul>
                                                )}
                                            </div>
                                        )}
                                    </div>
                                </div>
                            )}

                            {currentStage === 1 && !currentTask && (
                                <div className="flex flex-col flex-1 min-h-0 gap-6">
                                    <div className="rounded-lg border border-dashed border-muted-foreground/40 bg-muted/20 p-8 flex flex-col items-center justify-center text-center gap-4 flex-1 min-h-0">
                                        <ClipboardDocumentCheckIcon className="h-12 w-12 text-muted-foreground" />
                                        <p className="text-base font-medium text-muted-foreground">
                                            Create task with AI or Start with a task template
                                        </p>
                                        <Button
                                            variant="outline"
                                            className="gap-2 border-[var(--primary-dark)] text-[var(--primary-dark)] hover:bg-[var(--primary-dark)]/10"
                                            onClick={() => setCurrentStage(0)}
                                        >
                                            Go to Draft
                                        </Button>
                                    </div>
                                </div>
                            )}

                            {currentStage === 1 && currentTask && (
                                <div className="flex flex-col flex-1 min-h-0 gap-6">
                                    <Card className="border border-border/60 rounded-lg flex-1 min-h-0 flex flex-col overflow-hidden">
                                        <CardContent className="pt-4 pb-4 px-6 space-y-5 flex-1 min-h-0 overflow-y-auto">
                                            <div className="flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between">
                                                <div className="flex items-center gap-2">
                                                    <FileStack className="h-5 w-5 text-muted-foreground shrink-0" />
                                                    <h2 className="text-lg font-bold">Edit Task Details</h2>
                                                </div>
                                                <Button
                                                    type="button"
                                                    variant="ghost"
                                                    size="sm"
                                                    className="gap-2 text-muted-foreground shrink-0"
                                                    onClick={() => setCurrentStage(0)}
                                                >
                                                    Go to Draft
                                                </Button>
                                            </div>

                                            {(currentTask.matchedTemplateId ?? currentTask.matchedTemplate) && (
                                                <div className="flex flex-wrap items-center gap-2 p-3 rounded-lg bg-amber-50 dark:bg-amber-950/30 border border-amber-200 dark:border-amber-800/50">
                                                    <FileStack className="h-4 w-4 text-amber-600 dark:text-amber-400 shrink-0" />
                                                    <span className="text-base font-medium text-amber-800 dark:text-amber-200">
                                                        Using template: {(currentTask.matchedTemplate?.title ?? currentTask.matchReason?.replace(/^Matched:\s*/i, "")) || "Template"}
                                                    </span>
                                                    <Button
                                                        type="button"
                                                        variant="ghost"
                                                        size="sm"
                                                        className="ml-auto shrink-0 text-amber-700 dark:text-amber-300 hover:bg-amber-100 dark:hover:bg-amber-900/50 gap-1"
                                                        onClick={handleDetachTemplate}
                                                    >
                                                        <X className="h-4 w-4" />
                                                        Detach
                                                    </Button>
                                                </div>
                                            )}

                                            <div>
                                                <p className="text-base font-medium text-muted-foreground mb-1.5">Task Category</p>
                                                <div className="flex flex-wrap items-center gap-2">
                                                    {(() => {
                                                        const CatIcon = TEMPLATE_CATEGORY_ICONS[editCategory] ?? CodeBracketIcon;
                                                        const cardBox = TEMPLATE_CATEGORY_CARD_BOX[editCategory] ?? DEFAULT_CARD_BOX;
                                                        return (
                                                            <span
                                                                className={`inline-flex items-center gap-1.5 rounded-lg px-3 py-1.5 text-base font-medium ${cardBox}`}
                                                            >
                                                                <CatIcon className="h-4 w-4 shrink-0" />
                                                                {editCategory || "—"}
                                                            </span>
                                                        );
                                                    })()}
                                                    <span className="text-xs text-muted-foreground inline-flex items-center gap-1">
                                                        <Sparkles className="h-3.5 w-3.5" />
                                                        {currentTask.matchedTemplateId ?? currentTask.matchedTemplate
                                                            ? "From Template"
                                                            : "AI generated"}
                                                    </span>
                                                </div>
                                            </div>

                                            <div>
                                                <Label htmlFor="edit-requested-date" className="flex items-center gap-1.5">
                                                    Requested Completion Date
                                                    <span className="text-muted-foreground" title="When should this task be completed?">
                                                        <span className="sr-only">Info</span>
                                                        <span className="inline-flex h-4 w-4 rounded-full bg-muted items-center justify-center text-xs">i</span>
                                                    </span>
                                                </Label>
                                                <Popover open={requestDatePickerOpen} onOpenChange={setRequestDatePickerOpen}>
                                                    <PopoverTrigger asChild>
                                                        <button
                                                            id="edit-requested-date"
                                                            type="button"
                                                            className="mt-1 flex h-9 w-full items-center rounded-md border border-amber-200/50 bg-amber-50/50 px-3 py-2 text-left text-sm shadow-xs transition-[color,box-shadow] outline-none focus-visible:ring-[3px] focus-visible:ring-ring/50 dark:border-amber-800/30 dark:bg-amber-950/20 [&_svg]:pointer-events-none [&_svg]:shrink-0"
                                                        >
                                                            {editRequestedCompletionAt
                                                                ? new Date(editRequestedCompletionAt + "T12:00:00").toLocaleDateString(undefined, { dateStyle: "medium" })
                                                                : "Select date"}
                                                            <CalendarIcon className="ml-auto h-4 w-4 text-muted-foreground" />
                                                        </button>
                                                    </PopoverTrigger>
                                                    <PopoverContent className="w-auto p-0" align="start">
                                                        <Calendar
                                                            mode="single"
                                                            selected={editRequestedCompletionAt ? new Date(editRequestedCompletionAt + "T12:00:00") : undefined}
                                                            onSelect={(d) => {
                                                                setEditRequestedCompletionAt(d ? toLocalDateString(d) : "");
                                                                setRequestDatePickerOpen(false);
                                                            }}
                                                            className="rounded-lg border-0"
                                                        />
                                                    </PopoverContent>
                                                </Popover>
                                            </div>

                                            <div className="rounded-lg overflow-hidden">
                                                <button
                                                    type="button"
                                                    className="w-full flex items-center justify-between gap-2 p-3 text-left hover:bg-muted/50 transition-colors"
                                                    onClick={() => setAssetsSectionExpanded((b) => !b)}
                                                >
                                                    <span className="font-bold text-base">Assets & Resources</span>
                                                    {assetsSectionExpanded ? (
                                                        <ChevronUp className="h-4 w-4 text-muted-foreground shrink-0" />
                                                    ) : (
                                                        <ChevronDown className="h-4 w-4 text-muted-foreground shrink-0" />
                                                    )}
                                                </button>
                                                {assetsSectionExpanded && (
                                                    <div className="px-3 pb-4 space-y-3 pt-3">
                                                        <div className="flex gap-2 p-3 rounded-md bg-destructive/10 border border-destructive/20 text-destructive dark:bg-destructive/20 dark:border-destructive/30 dark:text-destructive">
                                                            <AlertCircle className="h-4 w-4 shrink-0 mt-0.5" />
                                                            <p className="text-base">
                                                                Do NOT include passwords here. Your PM will request access securely via your project management tool after task assignment.
                                                            </p>
                                                        </div>
                                                        <p className="text-base text-muted-foreground">
                                                            Add links to assets, brand boards, shared folders, or tools needed for this task.
                                                        </p>
                                                        <div className="space-y-2">
                                                            {editAssetLinks.map((url, i) => (
                                                                <div key={i} className="flex flex-col gap-2 sm:flex-row">
                                                                    <Input
                                                                        value={url}
                                                                        onChange={(e) =>
                                                                            updateList(editAssetLinks, setEditAssetLinks, i, e.target.value)
                                                                        }
                                                                        placeholder="https://..."
                                                                        className="font-mono text-base"
                                                                    />
                                                                    <Button
                                                                        type="button"
                                                                        variant="ghost"
                                                                        size="icon"
                                                                        onClick={() =>
                                                                            removeFromList(editAssetLinks, setEditAssetLinks, i)
                                                                        }
                                                                        disabled={editAssetLinks.length <= 1}
                                                                    >
                                                                        <XMarkIcon className="h-4 w-4" />
                                                                    </Button>
                                                                </div>
                                                            ))}
                                                            <Button
                                                                type="button"
                                                                variant="outline"
                                                                size="sm"
                                                                className="gap-1 border-[var(--primary-dark)] text-[var(--primary-dark)] hover:bg-[var(--primary-dark)]/10"
                                                                onClick={() => addToList(editAssetLinks, setEditAssetLinks)}
                                                            >
                                                                <Link2 className="h-4 w-4" />
                                                                Add Asset Link
                                                            </Button>
                                                        </div>
                                                    </div>
                                                )}
                                            </div>

                                            <div className="pt-2">
                                                <p className="text-base font-bold text-muted-foreground mb-2 flex items-center gap-1.5">
                                                    <Sparkles className="h-4 w-4" />
                                                    AI-Enhanced Details
                                                </p>
                                            </div>
                                            <div className="space-y-4">
                                                <div>
                                                    <Label htmlFor="edit-title">Title</Label>
                                                    <Input
                                                        id="edit-title"
                                                        value={editTitle}
                                                        onChange={(e) => setEditTitle(e.target.value)}
                                                        className="mt-1"
                                                    />
                                                </div>
                                                <div>
                                                    <Label htmlFor="edit-category">Category</Label>
                                                    <Input
                                                        id="edit-category"
                                                        value={editCategory}
                                                        onChange={(e) => setEditCategory(e.target.value)}
                                                        className="mt-1"
                                                    />
                                                </div>
                                                <div>
                                                    <Label htmlFor="edit-description">Description</Label>
                                                    <Textarea
                                                        id="edit-description"
                                                        value={editDescription}
                                                        onChange={(e) => setEditDescription(e.target.value)}
                                                        className="mt-1 min-h-[80px]"
                                                    />
                                                </div>
                                                <div>
                                                    <Label htmlFor="edit-considerations">Key considerations</Label>
                                                    <Textarea
                                                        id="edit-considerations"
                                                        value={editKeyConsiderations}
                                                        onChange={(e) => setEditKeyConsiderations(e.target.value)}
                                                        className="mt-1 min-h-[60px]"
                                                    />
                                                </div>
                                                <div>
                                                    <Label className="mb-2 block">Subtasks</Label>
                                                    <div className="space-y-2">
                                                        {editSubtasks.map((s, i) => (
                                                            <div key={i} className="flex flex-col gap-2 sm:flex-row">
                                                                <Input
                                                                    value={s}
                                                                    onChange={(e) =>
                                                                        updateList(editSubtasks, setEditSubtasks, i, e.target.value)
                                                                    }
                                                                    placeholder={`Subtask ${i + 1}`}
                                                                />
                                                                <Button
                                                                    type="button"
                                                                    variant="ghost"
                                                                    size="icon"
                                                                    onClick={() => removeFromList(editSubtasks, setEditSubtasks, i)}
                                                                    disabled={editSubtasks.length <= 1}
                                                                >
                                                                    <XMarkIcon className="h-4 w-4" />
                                                                </Button>
                                                            </div>
                                                        ))}
                                                        <Button
                                                            type="button"
                                                            variant="outline"
                                                            size="sm"
                                                            className="gap-1"
                                                            onClick={() => addToList(editSubtasks, setEditSubtasks)}
                                                        >
                                                            <Plus className="h-4 w-4" />
                                                            Add subtask
                                                        </Button>
                                                    </div>
                                                </div>
                                                <div>
                                                    <Label className="mb-2 block">Deliverables</Label>
                                                    <div className="space-y-2">
                                                        {editDeliverables.map((d, i) => (
                                                            <div key={i} className="flex flex-col gap-2 sm:flex-row">
                                                                <Input
                                                                    value={d}
                                                                    onChange={(e) =>
                                                                        updateList(editDeliverables, setEditDeliverables, i, e.target.value)
                                                                    }
                                                                    placeholder={`Deliverable ${i + 1}`}
                                                                />
                                                                <Button
                                                                    type="button"
                                                                    variant="ghost"
                                                                    size="icon"
                                                                    onClick={() =>
                                                                        removeFromList(editDeliverables, setEditDeliverables, i)
                                                                    }
                                                                    disabled={editDeliverables.length <= 1}
                                                                >
                                                                    <XMarkIcon className="h-4 w-4" />
                                                                </Button>
                                                            </div>
                                                        ))}
                                                        <Button
                                                            type="button"
                                                            variant="outline"
                                                            size="sm"
                                                            className="gap-1"
                                                            onClick={() => addToList(editDeliverables, setEditDeliverables)}
                                                        >
                                                            <Plus className="h-4 w-4" />
                                                            Add deliverable
                                                        </Button>
                                                    </div>
                                                </div>
                                                <div>
                                                    <Label className="mb-2 block">Quality control checklist</Label>
                                                    <div className="space-y-2">
                                                        {editQC.map((q, i) => (
                                                            <div key={i} className="flex flex-col gap-2 sm:flex-row">
                                                                <Input
                                                                    value={q}
                                                                    onChange={(e) => updateList(editQC, setEditQC, i, e.target.value)}
                                                                    placeholder={`Check ${i + 1}`}
                                                                />
                                                                <Button
                                                                    type="button"
                                                                    variant="ghost"
                                                                    size="icon"
                                                                    onClick={() => removeFromList(editQC, setEditQC, i)}
                                                                    disabled={editQC.length <= 1}
                                                                >
                                                                    <XMarkIcon className="h-4 w-4" />
                                                                </Button>
                                                            </div>
                                                        ))}
                                                        <Button
                                                            type="button"
                                                            variant="outline"
                                                            size="sm"
                                                            className="gap-1"
                                                            onClick={() => addToList(editQC, setEditQC)}
                                                        >
                                                            <Plus className="h-4 w-4" />
                                                            Add item
                                                        </Button>
                                                    </div>
                                                </div>
                                            </div>
                                        </CardContent>
                                    </Card>
                                    <div className="flex flex-col gap-2 sm:flex-row flex-shrink-0">
                                        <Button
                                            type="button"
                                            variant="outline"
                                            className="gap-2"
                                            onClick={() => setCurrentStage(0)}
                                        >
                                            Go to Draft
                                        </Button>
                                        <Button
                                            onClick={handleContinueToReview}
                                            disabled={isUpdating}
                                            className="bg-[var(--primary-dark)] hover:bg-[var(--primary-dark)]/90 text-white gap-2"
                                        >
                                            {isUpdating ? (
                                                <Loader2 className="h-4 w-4 animate-spin" />
                                            ) : (
                                                <ChevronRight className="h-4 w-4" />
                                            )}
                                            Continue to Review
                                        </Button>
                                    </div>
                                </div>
                            )}

                            {currentStage === 2 && !displayTask && (
                                <div className="flex flex-col flex-1 min-h-0 gap-6">
                                    <div className="rounded-lg border border-dashed border-muted-foreground/40 bg-muted/20 p-8 flex flex-col items-center justify-center text-center gap-4 flex-1 min-h-0">
                                        <ClipboardDocumentCheckIcon className="h-12 w-12 text-muted-foreground" />
                                        <p className="text-base font-medium text-muted-foreground">
                                            Create task with AI or Start with a task template
                                        </p>
                                        <Button
                                            variant="outline"
                                            className="gap-2 border-[var(--primary-dark)] text-[var(--primary-dark)] hover:bg-[var(--primary-dark)]/10"
                                            onClick={() => setCurrentStage(0)}
                                        >
                                            Go to Draft
                                        </Button>
                                    </div>
                                </div>
                            )}

                            {currentStage === 2 && displayTask && (
                                <div className="flex flex-col flex-1 min-h-0 gap-6">
                                    <h2 className="text-lg font-bold flex-shrink-0">Review & Submit</h2>
                                    <Card className="border border-border/60 rounded-lg flex-1 min-h-0 flex flex-col overflow-hidden">
                                        <CardContent className="pt-6 pb-4 px-6 space-y-4 flex-1 min-h-0 overflow-y-auto">
                                            <ReviewField label="Title">
                                                <p className="font-medium">{displayTask.title}</p>
                                            </ReviewField>
                                            <ReviewField label="Category">
                                                <p>{displayTask.category}</p>
                                            </ReviewField>
                                            {displayTask.requestedCompletionAt && (
                                                <ReviewField label="Requested completion date">
                                                    <p>{new Date(displayTask.requestedCompletionAt.slice(0, 10) + "T12:00:00").toLocaleDateString()}</p>
                                                </ReviewField>
                                            )}
                                            {displayTask.assetLinks && displayTask.assetLinks.length > 0 && (
                                                <ReviewField label="Assets & Resources">
                                                    <ul className="list-disc list-inside space-y-1">
                                                        {displayTask.assetLinks.map((url, i) => (
                                                            <li key={i}>
                                                                <a
                                                                    href={url}
                                                                    target="_blank"
                                                                    rel="noopener noreferrer"
                                                                    className="text-[var(--primary-dark)] underline break-all"
                                                                >
                                                                    {url}
                                                                </a>
                                                            </li>
                                                        ))}
                                                    </ul>
                                                </ReviewField>
                                            )}
                                            <ReviewField label="Description" className="whitespace-pre-wrap">
                                                {displayTask.description || "—"}
                                            </ReviewField>
                                            <ReviewField label="Key considerations" className="whitespace-pre-wrap">
                                                {displayTask.keyConsiderations || "—"}
                                            </ReviewField>
                                            {displayTask.subtasks.length > 0 && (
                                                <ReviewField label="Subtasks">
                                                    <ul className="list-disc list-inside space-y-1">
                                                        {displayTask.subtasks.map((s, i) => (
                                                            <li key={i}>{s}</li>
                                                        ))}
                                                    </ul>
                                                </ReviewField>
                                            )}
                                            {displayTask.deliverables.length > 0 && (
                                                <ReviewField label="Deliverables">
                                                    <ul className="list-disc list-inside space-y-1">
                                                        {displayTask.deliverables.map((d, i) => (
                                                            <li key={i}>{d}</li>
                                                        ))}
                                                    </ul>
                                                </ReviewField>
                                            )}
                                            {displayTask.qualityControlChecklist.length > 0 && (
                                                <ReviewField label="Quality control checklist">
                                                    <ul className="list-disc list-inside space-y-1">
                                                        {displayTask.qualityControlChecklist.map((q, i) => (
                                                            <li key={i}>{q}</li>
                                                        ))}
                                                    </ul>
                                                </ReviewField>
                                            )}
                                        </CardContent>
                                    </Card>
                                    <div className="flex flex-col gap-2 sm:flex-row flex-shrink-0">
                                        <Button
                                            variant="ghost"
                                            className="gap-2 text-muted-foreground"
                                            onClick={() => setCurrentStage(0)}
                                        >
                                            Go to Draft
                                        </Button>
                                        <Button
                                            variant="outline"
                                            className="border-[var(--primary-dark)] text-[var(--primary-dark)] hover:bg-[var(--primary-dark)]/10"
                                            onClick={() => setCurrentStage(1)}
                                        >
                                            Back
                                        </Button>
                                        <Button
                                            onClick={handleSubmitTask}
                                            className="bg-[var(--primary-dark)] hover:bg-[var(--primary-dark)]/90 text-white gap-2"
                                        >
                                            <Send className="h-4 w-4" />
                                            Submit Task
                                        </Button>
                                    </div>
                                </div>
                            )}
                        </TabsContent>

                        <TabsContent value="templates" className="flex-1 mt-0 min-h-0 flex flex-col">
                            <div className="space-y-4 flex-1 min-h-0 flex flex-col">
                                <div className="flex flex-col sm:flex-row gap-3 sm:items-center sm:justify-between">
                                    <div className="relative flex-1 max-w-md">
                                        <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                                        <Input
                                            placeholder="Search templates..."
                                            value={templateSearch}
                                            onChange={(e) => setTemplateSearch(e.target.value)}
                                            className="pl-9"
                                        />
                                    </div>
                                    <Button variant="outline" size="sm" className="gap-2 shrink-0" disabled>
                                        <Plus className="h-4 w-4" />
                                        Suggest Template
                                    </Button>
                                </div>

                                {templatesLoading ? (
                                    <div className="flex items-center justify-center py-16">
                                        <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />
                                    </div>
                                ) : (
                                    <>
                                        {(() => {
                                            const searchLower = templateSearch.trim().toLowerCase();
                                            const filtered = templates.filter((t) => {
                                                const matchCategory =
                                                    selectedTemplateCategory === "all" ||
                                                    t.category === selectedTemplateCategory;
                                                const matchSearch =
                                                    !searchLower ||
                                                    t.title.toLowerCase().includes(searchLower) ||
                                                    t.description.toLowerCase().includes(searchLower);
                                                return matchCategory && matchSearch;
                                            });
                                            const categories = [...new Set(filtered.map((t) => t.category))].sort();
                                            const countByCategory = filtered.reduce(
                                                (acc, t) => {
                                                    acc[t.category] = (acc[t.category] ?? 0) + 1;
                                                    return acc;
                                                },
                                                {} as Record<string, number>
                                            );
                                            const allCategories = [...new Set(templates.map((t) => t.category))].sort();

                                            return (
                                                <>
                                                    <div className="flex flex-wrap gap-2">
                                                        <button
                                                            type="button"
                                                            onClick={() => setSelectedTemplateCategory("all")}
                                                            className={`rounded-full px-3 py-1.5 text-base font-medium transition-colors inline-flex items-center gap-2 ${selectedTemplateCategory === "all"
                                                                ? "bg-[var(--primary-dark)] text-white"
                                                                : "bg-muted/80 text-muted-foreground hover:bg-muted"
                                                                }`}
                                                        >
                                                            <LayoutGrid className="h-4 w-4 shrink-0" />
                                                            All ({filtered.length})
                                                        </button>
                                                        {allCategories.map((cat) => {
                                                            const CatIcon = TEMPLATE_CATEGORY_ICONS[cat] ?? LayoutGrid;
                                                            const buttonIconClass = TEMPLATE_CATEGORY_BUTTON_ICON[cat] ?? DEFAULT_BUTTON_ICON;
                                                            return (
                                                                <button
                                                                    key={cat}
                                                                    type="button"
                                                                    onClick={() => setSelectedTemplateCategory(cat)}
                                                                    className={`rounded-full px-3 py-1.5 text-base font-medium transition-colors inline-flex items-center gap-2 ${selectedTemplateCategory === cat
                                                                        ? "bg-[var(--primary-dark)] text-white"
                                                                        : "bg-muted/80 hover:bg-muted"
                                                                        }`}
                                                                >
                                                                    <CatIcon
                                                                        className={`h-4 w-4 shrink-0 ${selectedTemplateCategory === cat ? "text-white" : buttonIconClass}`}
                                                                    />
                                                                    {cat} ({countByCategory[cat] ?? 0})
                                                                </button>
                                                            );
                                                        })}
                                                    </div>

                                                    <div className="space-y-4 flex-1 min-h-0 overflow-auto">
                                                        {categories.map((category) => {
                                                            const categoryTemplates = filtered.filter(
                                                                (t) => t.category === category
                                                            );
                                                            if (categoryTemplates.length === 0) return null;
                                                            const IconComponent =
                                                                TEMPLATE_CATEGORY_ICONS[category] ?? LayoutGrid;
                                                            const cardBoxClass =
                                                                TEMPLATE_CATEGORY_CARD_BOX[category] ?? DEFAULT_CARD_BOX;
                                                            const isExpanded =
                                                                expandedTemplateCategories.has(category);

                                                            return (
                                                                <div key={category} className="space-y-0">
                                                                    <div className="rounded-lg overflow-hidden bg-muted/30">
                                                                        <button
                                                                            type="button"
                                                                            onClick={() =>
                                                                                setExpandedTemplateCategories((prev) => {
                                                                                    const next = new Set(prev);
                                                                                    if (next.has(category)) next.delete(category);
                                                                                    else next.add(category);
                                                                                    return next;
                                                                                })
                                                                            }
                                                                            className="w-full flex items-center gap-3 p-4 text-left hover:bg-muted/50 transition-colors"
                                                                        >
                                                                            <span
                                                                                className={`flex h-9 w-9 shrink-0 items-center justify-center rounded-lg ${cardBoxClass}`}
                                                                            >
                                                                                <IconComponent className="h-4 w-4" />
                                                                            </span>
                                                                            <div className="flex-1 min-w-0">
                                                                                <p className="font-medium">{category}</p>
                                                                                <p className="text-base text-muted-foreground">
                                                                                    {categoryTemplates.length} template
                                                                                    {categoryTemplates.length !== 1 ? "s" : ""}
                                                                                </p>
                                                                            </div>
                                                                            {isExpanded ? (
                                                                                <ChevronUp className="h-4 w-4 shrink-0 text-muted-foreground" />
                                                                            ) : (
                                                                                <ChevronDown className="h-4 w-4 shrink-0 text-muted-foreground" />
                                                                            )}
                                                                        </button>
                                                                    </div>
                                                                    {isExpanded && (
                                                                        <div className="pt-4">
                                                                            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
                                                                                {categoryTemplates.map((t) => (
                                                                                    <Card
                                                                                        key={t.id}
                                                                                        className="overflow-hidden flex flex-col border bg-card cursor-pointer hover:border-muted-foreground/30 transition-colors py-2"
                                                                                        onClick={() => setSelectedTemplateForDialog(t)}
                                                                                    >
                                                                                        <CardContent className="p-4 flex flex-col flex-1">
                                                                                            <span
                                                                                                className={`mb-3 inline-flex h-8 w-8 shrink-0 items-center justify-center rounded-lg ${cardBoxClass}`}
                                                                                            >
                                                                                                <IconComponent className="h-4 w-4" />
                                                                                            </span>
                                                                                            <h3 className="font-medium line-clamp-2 mb-2">
                                                                                                {t.title}
                                                                                            </h3>
                                                                                            <p className="text-base text-muted-foreground line-clamp-2 flex-1">
                                                                                                {t.description || "—"}
                                                                                            </p>
                                                                                            <p className="text-xs text-muted-foreground mt-2">
                                                                                                {t.subtaskCount} subtask
                                                                                                {t.subtaskCount !== 1 ? "s" : ""}
                                                                                            </p>
                                                                                        </CardContent>
                                                                                    </Card>
                                                                                ))}
                                                                            </div>
                                                                        </div>
                                                                    )}
                                                                </div>
                                                            );
                                                        })}
                                                        {categories.length === 0 && (
                                                            <div className="py-12 text-center text-muted-foreground">
                                                                No templates match your search.
                                                            </div>
                                                        )}
                                                    </div>
                                                </>
                                            );
                                        })()}
                                    </>
                                )}
                            </div>
                        </TabsContent>
                    </Tabs>
                </div>
            </div>

            <Dialog open={!!selectedTemplateForDialog} onOpenChange={(open) => !open && setSelectedTemplateForDialog(null)}>
                <DialogContent className="sm:max-w-xl max-h-[90vh] overflow-hidden flex flex-col">
                    {selectedTemplateForDialog && (() => {
                        const DialogCategoryIcon = TEMPLATE_CATEGORY_ICONS[selectedTemplateForDialog.category] ?? LayoutGrid;
                        const dialogIconBoxClass = TEMPLATE_CATEGORY_CARD_BOX[selectedTemplateForDialog.category] ?? DEFAULT_CARD_BOX;
                        const subtasks = selectedTemplateForDialog.subtasks ?? [];
                        const deliverables = selectedTemplateForDialog.deliverables ?? [];
                        const qcList = selectedTemplateForDialog.qualityControlChecklist ?? [];
                        return (
                            <React.Fragment key={selectedTemplateForDialog.id}>
                                <DialogHeader>
                                    <DialogTitle className="pr-8 flex items-center gap-2">
                                        <span className={`flex h-8 w-8 shrink-0 items-center justify-center rounded-lg ${dialogIconBoxClass}`}>
                                            <DialogCategoryIcon className="h-4 w-4" />
                                        </span>
                                        <span className="min-w-0 truncate">{selectedTemplateForDialog.title}</span>
                                    </DialogTitle>
                                </DialogHeader>
                                <div className="flex-1 min-h-0 overflow-y-auto">
                                    <div className="space-y-5 pr-3">
                                        <div>
                                            <p className="text-base font-semibold text-foreground mb-1.5">Description</p>
                                            <p className="text-base whitespace-pre-wrap text-muted-foreground">{selectedTemplateForDialog.description || "—"}</p>
                                        </div>
                                        <div>
                                            <p className="text-base font-semibold text-foreground mb-1.5">Subtasks</p>
                                            {subtasks.length > 0 ? (
                                                <ul className="space-y-2 list-none p-0 m-0">
                                                    {subtasks.map((s, i) => (
                                                        <li key={i} className="flex gap-2 items-start">
                                                            <span className="flex h-6 w-6 shrink-0 items-center justify-center text-base font-medium text-muted-foreground">
                                                                {i + 1}.
                                                            </span>
                                                            <div className="flex-1 min-w-0 rounded-md border border-border/60 bg-muted/40 px-3 py-2 text-base">
                                                                {s}
                                                            </div>
                                                        </li>
                                                    ))}
                                                </ul>
                                            ) : (
                                                <p className="text-base text-muted-foreground">—</p>
                                            )}
                                        </div>
                                        <div>
                                            <p className="text-base font-semibold text-foreground mb-1.5">Deliverables</p>
                                            {deliverables.length > 0 ? (
                                                <ul className="space-y-2 list-none p-0 m-0">
                                                    {deliverables.map((d, i) => (
                                                        <li key={i} className="flex gap-2 items-start">
                                                            <span
                                                                className="flex h-4 w-4 shrink-0 rounded-full border-2 border-muted-foreground/40 mt-0.5"
                                                                aria-hidden
                                                            />
                                                            <div className="flex-1 min-w-0 rounded-md border border-border/60 bg-muted/40 px-3 py-2 text-base">
                                                                {d}
                                                            </div>
                                                        </li>
                                                    ))}
                                                </ul>
                                            ) : (
                                                <p className="text-base text-muted-foreground">—</p>
                                            )}
                                        </div>
                                        <div>
                                            <p className="text-base font-semibold text-foreground mb-1.5">Quality control checklist</p>
                                            {qcList.length > 0 ? (
                                                <ul className="space-y-2 list-none p-0 m-0">
                                                    {qcList.map((q, i) => (
                                                        <li key={i} className="flex gap-2 items-start">
                                                            <span
                                                                className="flex h-4 w-4 shrink-0 rounded-full border-2 border-muted-foreground/40 mt-0.5"
                                                                aria-hidden
                                                            />
                                                            <div className="flex-1 min-w-0 rounded-md border border-border/60 bg-muted/40 px-3 py-2 text-base">
                                                                {q}
                                                            </div>
                                                        </li>
                                                    ))}
                                                </ul>
                                            ) : (
                                                <p className="text-base text-muted-foreground">—</p>
                                            )}
                                        </div>
                                    </div>
                                </div>
                                <DialogFooter className="mt-4 shrink-0">
                                    <Button
                                        variant="outline"
                                        className="border-[var(--primary-dark)] text-[var(--primary-dark)] hover:bg-[var(--primary-dark)]/10"
                                        onClick={() => setSelectedTemplateForDialog(null)}
                                        disabled={isUsingTemplate}
                                    >
                                        Cancel
                                    </Button>
                                    <Button
                                        className="bg-[var(--primary-dark)] hover:bg-[var(--primary-dark)]/90 text-white"
                                        onClick={() => selectedTemplateForDialog && handleUseTemplate(selectedTemplateForDialog)}
                                        disabled={isUsingTemplate}
                                    >
                                        {isUsingTemplate ? (
                                            <Loader2 className="h-4 w-4 animate-spin" />
                                        ) : (
                                            "Use Template"
                                        )}
                                    </Button>
                                </DialogFooter>
                            </React.Fragment>
                        );
                    })()}
                </DialogContent>
            </Dialog>
        </div>
    );
}
