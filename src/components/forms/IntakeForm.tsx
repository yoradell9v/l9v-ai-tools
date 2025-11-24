"use client";

import { Fragment, useState, useEffect, useRef } from "react";
import { Listbox, Transition } from "@headlessui/react";
import { CheckIcon, ChevronUpDownIcon } from "@heroicons/react/20/solid";
import Modal from "@/components/ui/Modal";

interface IntakeFormData {
    companyName: string;
    website: string;
    businessGoal: string;
    tasks: string[];
    outcome90Day: string;
    weeklyHours: string;
    timezone: string;
    clientFacing: string;
    tools: string;
    englishLevel: string,
    requirements: string[];
    existingSOPs: string;
    reportingExpectations: string;
    managementStyle: string;
    securityNeeds: string;
    dealBreakers: string;
    niceToHaveSkills: string;
}

interface IntakeFormProps {
    userId: string;
    onFormChange?: (data: IntakeFormData) => void;
    onClose: () => void;
    onSuccess?: (data: any) => void;
}

const STORAGE_KEY = 'jd-form-data';
const MAX_SOP_FILE_SIZE = 10 * 1024 * 1024; // 10MB
const ALLOWED_SOP_EXTENSIONS = [".pdf", ".doc", ".docx", ".txt"];
const ALLOWED_SOP_MIME_TYPES = new Set([
    "application/pdf",
    "application/msword",
    "application/vnd.openxmlformats-officedocument.wordprocessingml.document",
    "text/plain",
]);

export default function IntakeForm({ userId, onFormChange, onClose, onSuccess }: IntakeFormProps) {
    const [formData, setFormData] = useState<IntakeFormData>({
        companyName: "",
        website: "",
        businessGoal: "More leads",
        tasks: ["", "", ""],
        outcome90Day: "",
        weeklyHours: "40",
        timezone: "",
        clientFacing: "Yes",
        tools: "",
        englishLevel: "Good",
        requirements: ["", "", ""],
        existingSOPs: "No",
        reportingExpectations: "",
        managementStyle: "Async",
        securityNeeds: "",
        dealBreakers: "",
        niceToHaveSkills: "",
    });

    const [isClient, setIsClient] = useState(false);
    const [isAnalyzing, setIsAnalyzing] = useState(false);
    const [analysisError, setAnalysisError] = useState<string | null>(null);
    const [analysisSuccess, setAnalysisSuccess] = useState(false);

    const [showClearModal, setShowClearModal] = useState(false);
    const [isFormClearing, setIsFormClearing] = useState(false);
    const [sopFile, setSopFile] = useState<File | null>(null);
    const [sopFileError, setSopFileError] = useState<string | null>(null);
    const sopFileInputRef = useRef<HTMLInputElement | null>(null);

    const steps = [
        { id: 0, title: "Company Info", required: ["companyName"] },
        { id: 1, title: "Business Goals", required: ["businessGoal", "outcome90Day"] },
        { id: 2, title: "Key Tasks", required: ["tasks"] },
        { id: 3, title: "Work Details", required: ["weeklyHours", "timezone", "clientFacing"] },
        { id: 4, title: "Requirements", required: ["requirements"] },
        { id: 5, title: "Tools & Skills", required: [] },
        { id: 6, title: "Additional Details - Process", required: [] },
        { id: 7, title: "Additional Details - Constraints", required: [] },
    ];

    const calculateProgress = (): number => {
        let totalRequired = 0;
        let filledRequired = 0;

        steps.forEach(step => {
            step.required.forEach(field => {
                totalRequired++;
                if (field === "tasks") {
                    const requiredTasks = formData.tasks.slice(0, 3);
                    if (requiredTasks.every(task => task.trim())) {
                        filledRequired++;
                    }
                } else if (field === "requirements") {
                    const requiredRequirements = formData.requirements.slice(0, 3);
                    if (requiredRequirements.every(req => req.trim())) {
                        filledRequired++;
                    }
                } else {
                    const value = formData[field as keyof IntakeFormData];
                    if (value && (typeof value === "string" ? value.trim() : true)) {
                        filledRequired++;
                    }
                }
            });
        });

        return totalRequired > 0 ? Math.round((filledRequired / totalRequired) * 100) : 0;
    };

    useEffect(() => {
        setIsClient(true);
        try {
            const saved = localStorage.getItem(`${STORAGE_KEY}-${userId}`);
            if (saved) {
                const parsed = JSON.parse(saved);
                setFormData(parsed);
                onFormChange?.(parsed);
            }
        } catch (error) {
            console.error('Failed to load saved form data:', error);
        }
    }, [userId]);

    useEffect(() => {
        if (isClient) {
            try {
                localStorage.setItem(`${STORAGE_KEY}-${userId}`, JSON.stringify(formData));
            } catch (error) {
                console.error('Failed to save form data:', error);
            }
        }
    }, [formData, userId, isClient]);

    const handleInputChange = (field: keyof IntakeFormData, value: string | string[]) => {
        setFormData(prev => {
            const newData = { ...prev, [field]: value };
            onFormChange?.(newData);
            return newData;
        });
        if (field === "existingSOPs" && value === "No") {
            setSopFile(null);
            setSopFileError(null);
            if (sopFileInputRef.current) {
                sopFileInputRef.current.value = "";
            }
        }
    };

    const handleTaskChange = (index: number, value: string) => {
        const updatedTasks = [...formData.tasks];
        updatedTasks[index] = value;
        handleInputChange("tasks", updatedTasks);
    };

    const handleAddTask = () => {
        handleInputChange("tasks", [...formData.tasks, ""]);
    };

    const handleRemoveTask = (index: number) => {
        if (formData.tasks.length > 3) {
            const updatedTasks = formData.tasks.filter((_, i) => i !== index);
            handleInputChange("tasks", updatedTasks);
        }
    };

    const handleRequirementChange = (index: number, value: string) => {
        const updatedRequirements = [...formData.requirements];
        updatedRequirements[index] = value;
        handleInputChange("requirements", updatedRequirements);
    };

    const handleAddRequirement = () => {
        handleInputChange("requirements", [...formData.requirements, ""]);
    };

    const handleRemoveRequirement = (index: number) => {
        if (formData.requirements.length > 3) {
            const updatedRequirements = formData.requirements.filter((_, i) => i !== index);
            handleInputChange("requirements", updatedRequirements);
        }
    };

    const handleSOPFileChange = (file: File | null) => {
        if (!file) {
            setSopFile(null);
            setSopFileError(null);
            return;
        }

        const extension = file.name ? file.name.substring(file.name.lastIndexOf(".")).toLowerCase() : "";
        const isExtensionAllowed = ALLOWED_SOP_EXTENSIONS.includes(extension);
        const isMimeAllowed = file.type ? ALLOWED_SOP_MIME_TYPES.has(file.type) : isExtensionAllowed;

        if (file.size > MAX_SOP_FILE_SIZE) {
            setSopFile(null);
            setSopFileError("File is too large. Please upload a file under 10MB.");
            if (sopFileInputRef.current) {
                sopFileInputRef.current.value = "";
            }
            return;
        }

        if (!isExtensionAllowed && !isMimeAllowed) {
            setSopFile(null);
            setSopFileError("Unsupported file type. Allowed types: PDF, DOC, DOCX, TXT.");
            if (sopFileInputRef.current) {
                sopFileInputRef.current.value = "";
            }
            return;
        }

        setSopFile(file);
        setSopFileError(null);
    };

    const handleClearForm = () => {
        setIsFormClearing(true);

        const emptyData: IntakeFormData = {
            companyName: "",
            website: "",
            businessGoal: "More leads",
            tasks: ["", "", ""],
            outcome90Day: "",
            weeklyHours: "40",
            timezone: "",
            clientFacing: "Yes",
            tools: "",
            englishLevel: "Good",
            requirements: ["", "", ""],
            existingSOPs: "No",
            reportingExpectations: "",
            managementStyle: "Async",
            securityNeeds: "",
            dealBreakers: "",
            niceToHaveSkills: "",
        };

        try {
            setFormData(emptyData);
            onFormChange?.(emptyData);
            localStorage.removeItem(`${STORAGE_KEY}-${userId}`);
        } catch (error) {
            console.error("Failed to clear form data:", error);
        } finally {
            setIsFormClearing(false);
            setShowClearModal(false);
        }
        setSopFile(null);
        setSopFileError(null);
        if (sopFileInputRef.current) {
            sopFileInputRef.current.value = "";
        }
    };


    const handleSubmitAnalysis = async () => {
        if (sopFileError) {
            setAnalysisError("Please resolve the SOP file issue before generating the job description.");
            return;
        }

        setIsAnalyzing(true);
        setAnalysisError(null);
        setAnalysisSuccess(false);

        try {
            const toolsArray = formData.tools
                .split(",")
                .map(tool => tool.trim())
                .filter(Boolean);

            const intakePayload = {
                brand: {
                    name: formData.companyName,
                },
                website: formData.website,
                business_goal: formData.businessGoal,
                outcome_90d: formData.outcome90Day,
                tasks_top5: formData.tasks.filter(task => task.trim()).slice(0, 5),
                requirements: formData.requirements.filter(req => req.trim()),
                weekly_hours: parseInt(formData.weeklyHours, 10) || 0,
                timezone: formData.timezone,
                client_facing: formData.clientFacing === "Yes",
                tools: toolsArray,
                tools_raw: formData.tools,
                english_level: formData.englishLevel,
                management_style: formData.managementStyle,
                reporting_expectations: formData.reportingExpectations,
                security_needs: formData.securityNeeds,
                deal_breakers: formData.dealBreakers,
                nice_to_have_skills: formData.niceToHaveSkills,
                existing_sops: formData.existingSOPs === "Yes",
                sop_filename: sopFile?.name ?? null,
            };

            const payload = new FormData();
            console.log("Payload: ", payload)
            payload.append("intake_json", JSON.stringify(intakePayload));

            if (sopFile) {
                payload.append("sopFile", sopFile);
            }

            const response = await fetch('/api/jd/analyze', {
                method: 'POST',
                body: payload,
            });

            if (!response.ok) {
                let message = 'Analysis failed';
                try {
                    const errorPayload = await response.json();
                    if (errorPayload?.error) {
                        message = errorPayload.error;
                    }
                } catch {
                    // Ignore JSON parse errors and use default message
                }
                throw new Error(message);
            }

            const data = await response.json();
            setAnalysisSuccess(true);
            console.log('Analysis successful:', data);

            // Pass data to parent and close form
            if (onSuccess) {
                onSuccess({
                    apiResult: data,
                    input: formData,
                });
            }


            // Close form after a brief delay to show success message
            setTimeout(() => {
                onClose();
            }, 500);

        } catch (error) {
            console.error('Analysis error:', error);
            setAnalysisError(error instanceof Error ? error.message : 'Failed to analyze job description');
        } finally {
            setIsAnalyzing(false);
        }
    };

    const inputClasses = "w-full px-3 py-2 rounded-lg border text-sm transition-all duration-200 focus:outline-none border-[var(--border-color)] bg-[var(--card-bg)] text-[var(--text-primary)]";
    const labelClasses = "block text-xs font-medium mb-2 text-[var(--text-primary)]";
    const sectionClasses = "space-y-3";
    const classNames = (...classes: (string | boolean | undefined)[]) => classes.filter(Boolean).join(" ");

    function SingleSelect<T extends string>({
        value,
        onChange,
        options,
        placeholder,
    }: {
        value: T | "";
        onChange: (v: T) => void;
        options: { label: string; value: T }[];
        placeholder?: string;
    }) {
        const selected = options.find(o => o.value === value) ?? null;
        const buttonRef = useRef<HTMLButtonElement>(null);
        const [position, setPosition] = useState({ top: 0, left: 0, width: 0 });

        return (
            <Listbox value={selected} onChange={(opt) => opt ? onChange(opt.value) : undefined}>
                {({ open }) => {
                    // Update position when dropdown opens using useEffect
                    useEffect(() => {
                        if (open && buttonRef.current) {
                            const rect = buttonRef.current.getBoundingClientRect();
                            setPosition({
                                top: rect.bottom + window.scrollY,
                                left: rect.left + window.scrollX,
                                width: rect.width,
                            });
                        }
                    }, [open]);

                    return (
                        <div className="relative">
                            <Listbox.Button
                                ref={buttonRef}
                                className={classNames(
                                    "w-full px-3 py-2 rounded-lg text-left text-sm transition-all duration-200 focus:outline-none cursor-pointer border-[var(--border-color)] bg-[var(--card-bg)] text-[var(--text-primary)]"
                                )}
                                onFocus={(e) => {
                                    e.currentTarget.style.borderColor = "var(--primary)";
                                    e.currentTarget.style.outline = "none";
                                    e.currentTarget.style.boxShadow = "0 0 0 2px color-mix(in srgb, var(--primary) 15%, transparent)";
                                }}
                                onBlur={(e) => {
                                    e.currentTarget.style.borderColor = "var(--border-color)";
                                    e.currentTarget.style.boxShadow = "none";
                                }}
                            >
                                <span className="block truncate text-sm">
                                    {selected ? selected.label : (placeholder || "Select")}
                                </span>
                                <span className="pointer-events-none absolute inset-y-0 right-2 flex items-center">
                                    <ChevronUpDownIcon className="h-4 w-4 text-[var(--text-secondary)]" aria-hidden="true" />
                                </span>
                            </Listbox.Button>

                            {open && (
                                <Transition
                                    as={Fragment}
                                    show={open}
                                    enter="transition ease-out duration-100"
                                    enterFrom="opacity-0 scale-95"
                                    enterTo="opacity-100 scale-100"
                                    leave="transition ease-in duration-75"
                                    leaveFrom="opacity-100 scale-100"
                                    leaveTo="opacity-0 scale-95"
                                >
                                    <Listbox.Options
                                        className="fixed z-[99999] mt-1 max-h-60 overflow-auto rounded-lg border shadow-md focus:outline-none"
                                        style={{
                                            top: `${position.top}px`,
                                            left: `${position.left}px`,
                                            width: `${position.width}px`,
                                            borderColor: "var(--border-color)",
                                            backgroundColor: "var(--card-bg)",
                                        }}
                                    >
                                        {options.map((opt) => (
                                            <Listbox.Option
                                                key={String(opt.value)}
                                                className={({ active }) =>
                                                    `relative cursor-pointer select-none text-sm transition-colors`
                                                }
                                                value={opt}
                                            >
                                                {({ active, selected: isSelected }) => (
                                                    <div
                                                        className="flex items-center justify-between"
                                                        style={{
                                                            backgroundColor: active ? "var(--hover-bg)" : "transparent",
                                                            color: "var(--text-primary)",
                                                            padding: active ? "0.75rem 0.75rem" : "0.5rem 0.75rem",
                                                        }}
                                                    >
                                                        <span className={`block truncate ${isSelected ? "font-medium" : "font-normal"}`}>
                                                            {opt.label}
                                                        </span>
                                                        {isSelected && (
                                                            <span className="text-xs text-[var(--accent)]">
                                                                ✓
                                                            </span>
                                                        )}
                                                    </div>
                                                )}
                                            </Listbox.Option>
                                        ))}
                                    </Listbox.Options>
                                </Transition>
                            )}
                        </div>
                    );
                }}
            </Listbox>
        );
    }

    const progress = calculateProgress();

    return (
        <>
            <div className="flex flex-col max-h-[calc(100vh-12rem)]">
                {/* Progress Bar */}
                <div className="mb-4 pb-4 border-b border-[var(--border-color)]">
                    <div className="flex items-center justify-between mb-2">
                        <div>
                            <h1 className="text-lg font-semibold mb-1 text-[var(--text-primary)]">
                                Tell us more about your business
                            </h1>
                            <p className="text-xs text-[var(--text-secondary)]">
                                Fill out the details below to generate your job description
                            </p>
                        </div>
                        <button
                            onClick={() => setShowClearModal(true)}
                            className="px-3 py-1.5 text-xs font-medium rounded-lg transition-all duration-200 hover:brightness-110 bg-zinc-200 dark:bg-zinc-800"
                        >
                            Clear Form
                        </button>
                    </div>
                    <div className="flex items-center gap-2">
                        <div className="flex-1 rounded-full h-2 bg-[var(--border-color)]">
                            <div
                                className="h-2 rounded-full transition-all duration-300 bg-[var(--primary)]"
                                style={{ width: `${progress}%` }}
                            />
                        </div>
                        <span className="text-xs font-medium text-[var(--text-secondary)]">
                            {progress}%
                        </span>
                    </div>
                </div>

                {/* Scrollable Form Content */}
                <div className="flex-1 overflow-y-auto">
                    <div className="space-y-4">



                        {/* Company Info */}
                        <div className="p-4 rounded-lg border border-[var(--border-color)] bg-[var(--hover-bg)]">
                            <h3 className="text-sm font-medium mb-3 text-[var(--text-primary)]">Company Information</h3>
                            <div className={sectionClasses}>
                                <div>
                                    <label className={labelClasses}>
                                        Company Name <span className="text-red-500">*</span>
                                    </label>
                                    <input
                                        type="text"
                                        placeholder="Acme Inc."
                                        value={formData.companyName}
                                        onChange={(e) => handleInputChange("companyName", e.target.value)}
                                        className={inputClasses}
                                        onFocus={(e) => {
                                            e.currentTarget.style.borderColor = "var(--primary)";
                                            e.currentTarget.style.outline = "none";
                                            e.currentTarget.style.boxShadow = "0 0 0 2px color-mix(in srgb, var(--primary) 15%, transparent)";
                                        }}
                                        onBlur={(e) => {
                                            e.currentTarget.style.borderColor = "var(--border-color)";
                                            e.currentTarget.style.boxShadow = "none";
                                        }}
                                        required
                                    />
                                </div>
                                <div>
                                    <label className={labelClasses}>Website</label>
                                    <input
                                        type="url"
                                        placeholder="https://example.com or 'none yet'"
                                        value={formData.website}
                                        onChange={(e) => handleInputChange("website", e.target.value)}
                                        className={inputClasses}
                                        onFocus={(e) => {
                                            e.currentTarget.style.borderColor = "var(--primary)";
                                            e.currentTarget.style.outline = "none";
                                            e.currentTarget.style.boxShadow = "0 0 0 2px color-mix(in srgb, var(--primary) 15%, transparent)";
                                        }}
                                        onBlur={(e) => {
                                            e.currentTarget.style.borderColor = "var(--border-color)";
                                            e.currentTarget.style.boxShadow = "none";
                                        }}
                                        pattern="https?://.*"
                                        title="Please enter a valid URL starting with http:// or https://"
                                    />
                                    <p className="text-xs mt-1.5 text-[var(--text-secondary)]">Please enter a valid URL, or type 'none yet' if you don't have a website.</p>
                                </div>
                            </div>
                        </div>

                        {/* Business Goals */}
                        <div className="p-4 rounded-lg border border-[var(--border-color)] bg-[var(--hover-bg)]">
                            <h3 className="text-sm font-medium mb-3 text-[var(--text-primary)]">Business Goals</h3>
                            <div className={sectionClasses}>
                                <div>
                                    <label className={labelClasses}>
                                        Primary Goal <span className="text-red-500">*</span>
                                    </label>
                                    <SingleSelect
                                        value={formData.businessGoal}
                                        onChange={(v) => handleInputChange("businessGoal", v)}
                                        options={[
                                            { label: "Growth & Scale", value: "Growth & Scale" },
                                            { label: "Efficiency & Optimization", value: "Efficiency & Optimization" },
                                            { label: "Brand & Market Position", value: "Brand & Market Position" },
                                            { label: " Customer Experience & Retention", value: "Customer Experience & Retention" },
                                            { label: "Product & Innovation", value: "Product & Innovation" },
                                        ]}
                                        placeholder="Select primary goal"
                                    />
                                </div>
                                <div>
                                    <label className={labelClasses}>
                                        90-Day Outcome <span className="text-red-500">*</span>
                                    </label>
                                    <textarea
                                        placeholder="What is the #1 result you want to achieve in 90 days?"
                                        value={formData.outcome90Day}
                                        onChange={(e) => handleInputChange("outcome90Day", e.target.value)}
                                        className={inputClasses}
                                        onFocus={(e) => {
                                            e.currentTarget.style.borderColor = "var(--primary)";
                                            e.currentTarget.style.outline = "none";
                                            e.currentTarget.style.boxShadow = "0 0 0 2px color-mix(in srgb, var(--primary) 15%, transparent)";
                                        }}
                                        onBlur={(e) => {
                                            e.currentTarget.style.borderColor = "var(--border-color)";
                                            e.currentTarget.style.boxShadow = "none";
                                        }}
                                        rows={3}
                                        required
                                    />
                                </div>
                            </div>
                        </div>


                        {/* Key Tasks */}
                        <div className="p-4 rounded-lg border border-[var(--border-color)] bg-[var(--hover-bg)]">
                            <h3 className="text-sm font-medium mb-1 text-[var(--text-primary)]">Key Tasks</h3>
                            <p className="text-xs mb-3 text-[var(--text-secondary)]">List the top 3 tasks or any additional tasks this role will handle</p>
                            <div className={sectionClasses}>
                                {formData.tasks.map((task, index) => (
                                    <div key={index} className="relative">
                                        <div className="flex items-center justify-between mb-2">
                                            <label className={labelClasses + " mb-0"}>
                                                {index < 3 ? `Task ${index + 1}` : `Additional Task ${index - 2}`}{" "}
                                                {index < 3 && <span className="text-red-500">*</span>}
                                            </label>
                                            {index >= 3 && (
                                                <button
                                                    type="button"
                                                    onClick={() => handleRemoveTask(index)}
                                                    className="p-1 rounded transition-colors hover:bg-red-500/20"
                                                    style={{ color: "rgb(239, 68, 68)" }}
                                                    aria-label="Remove task"
                                                >
                                                    <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                                                    </svg>
                                                </button>
                                            )}
                                        </div>
                                        <input
                                            type="text"
                                            placeholder={`e.g., ${index === 0
                                                ? "Manage social media content"
                                                : index === 1
                                                    ? "Respond to customer inquiries"
                                                    : index === 2
                                                        ? "Create weekly reports"
                                                        : "Additional task description"
                                                }`}
                                            value={task}
                                            onChange={(e) => handleTaskChange(index, e.target.value)}
                                            className={inputClasses}
                                            onFocus={(e) => {
                                                e.currentTarget.style.borderColor = "var(--primary)";
                                                e.currentTarget.style.outline = "none";
                                                e.currentTarget.style.boxShadow = "0 0 0 2px color-mix(in srgb, var(--primary) 15%, transparent)";
                                            }}
                                            onBlur={(e) => {
                                                e.currentTarget.style.borderColor = "var(--border-color)";
                                                e.currentTarget.style.boxShadow = "none";
                                            }}
                                            required={index < 3}
                                        />
                                    </div>
                                ))}
                                <button
                                    type="button"
                                    onClick={handleAddTask}
                                    className="
    inline-flex items-center justify-center rounded-lg border border-dashed px-3 py-2 text-xs font-medium transition-colors
    text-[var(--primary)] border-[var(--primary)]
    dark:text-[var(--accent)] dark:border-[var(--accent)]
    hover:bg-[var(--hover-bg)]
  "
                                >
                                    + Add Task
                                </button>

                            </div>
                        </div>

                        {/* Work Details */}
                        <div className="p-4 rounded-lg border border-[var(--border-color)] bg-[var(--hover-bg)]">
                            <h3 className="text-sm font-medium mb-3 text-[var(--text-primary)]">Work Details</h3>
                            <div className={sectionClasses}>

                                <div>
                                    <label className={labelClasses}>
                                        Weekly Hours <span className="text-red-500">*</span>
                                    </label>
                                    <SingleSelect
                                        value={formData.weeklyHours}
                                        onChange={(v) => handleInputChange("weeklyHours", v)}
                                        options={[
                                            { label: "10 hrs/week", value: "10" },
                                            { label: "20 hrs/week", value: "20" },
                                            { label: "30 hrs/week", value: "30" },
                                            { label: "40 hrs/week", value: "40" },
                                        ]}
                                        placeholder="Select hours"
                                    />
                                </div>


                                <div>
                                    <label className={labelClasses}>
                                        Timezone <span className="text-red-500">*</span>
                                    </label>
                                    <SingleSelect
                                        value={formData.timezone}
                                        onChange={(v) => handleInputChange("timezone", v)}
                                        options={[
                                            { label: "EST (UTC-5)", value: "EST" },
                                            { label: "CST (UTC-6)", value: "CST" },
                                            { label: "MST (UTC-7)", value: "MST" },
                                            { label: "PST (UTC-8)", value: "PST" },
                                            { label: "GMT (UTC+0)", value: "GMT" },
                                            { label: "CET (UTC+1)", value: "CET" },
                                            { label: "IST (UTC+5:30)", value: "IST" },
                                            { label: "SGT (UTC+8)", value: "SGT" },
                                            { label: "AEST (UTC+10)", value: "AEST" },
                                        ]}
                                        placeholder="Select timezone"
                                    />
                                </div>
                                <div>
                                    <label className={labelClasses}>
                                        Client-Facing Role? <span className="text-red-500">*</span>
                                    </label>
                                    <SingleSelect
                                        value={formData.clientFacing}
                                        onChange={(v) => handleInputChange("clientFacing", v)}
                                        options={[
                                            { label: "Yes", value: "Yes" },
                                            { label: "No", value: "No" },
                                        ]}
                                        placeholder="Select option"
                                    />
                                </div>
                            </div>
                        </div>

                        {/* Requirements */}
                        <div className="p-4 rounded-lg border border-[var(--border-color)] bg-[var(--hover-bg)]">
                            <h3 className="text-sm font-medium mb-1 text-[var(--text-primary)]">Requirements</h3>
                            <p className="text-xs mb-3 text-[var(--text-secondary)]">Must-have skills and qualifications</p>
                            <div className={sectionClasses}>
                                {formData.requirements.map((req, index) => (
                                    <div key={index} className="relative">
                                        <div className="flex items-center justify-between mb-2">
                                            <label className={labelClasses + " mb-0"}>
                                                {index < 3 ? `Requirement ${index + 1}` : `Additional Requirement ${index - 2}`} {index < 3 && <span className="text-red-500">*</span>}
                                            </label>
                                            {index >= 3 && (
                                                <button
                                                    type="button"
                                                    onClick={() => handleRemoveRequirement(index)}
                                                    className="p-1 rounded transition-colors hover:bg-red-500/20"
                                                    style={{ color: "rgb(239, 68, 68)" }}
                                                    aria-label="Remove requirement"
                                                >
                                                    <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                                                    </svg>
                                                </button>
                                            )}
                                        </div>
                                        <input
                                            type="text"
                                            placeholder={`${index === 0
                                                ? "e.g., 2+ years experience in social media"
                                                : index === 1
                                                    ? "e.g., Proficient in Canva and Adobe Suite"
                                                    : index === 2
                                                        ? "e.g., Experience with CRM systems"
                                                        : "Additional requirement"
                                                }`}
                                            value={req}
                                            onChange={(e) => handleRequirementChange(index, e.target.value)}
                                            className={inputClasses}
                                            onFocus={(e) => {
                                                e.currentTarget.style.borderColor = "var(--primary)";
                                                e.currentTarget.style.outline = "none";
                                                e.currentTarget.style.boxShadow = "0 0 0 2px color-mix(in srgb, var(--primary) 15%, transparent)";
                                            }}
                                            onBlur={(e) => {
                                                e.currentTarget.style.borderColor = "var(--border-color)";
                                                e.currentTarget.style.boxShadow = "none";
                                            }}
                                            required={index < 3}
                                        />
                                    </div>
                                ))}
                                <button
                                    type="button"
                                    onClick={handleAddRequirement}
                                    className="
                                        inline-flex items-center justify-center rounded-lg border border-dashed px-3 py-2 text-xs font-medium transition-colors
                                        text-[var(--primary)] border-[var(--primary)]
                                        dark:text-[var(--accent)] dark:border-[var(--accent)]
                                        hover:bg-[var(--hover-bg)]
                                    "
                                >
                                    + Add Requirement
                                </button>
                            </div>
                        </div>

                        {/* Tools & Skills */}
                        <div className="p-4 rounded-lg border border-[var(--border-color)] bg-[var(--hover-bg)]">
                            <h3 className="text-sm font-medium mb-3 text-[var(--text-primary)]">Tools & Skills</h3>
                            <div className={sectionClasses}>
                                <div>
                                    <label className={labelClasses}>Tools/Stack in Use</label>
                                    <textarea
                                        placeholder="e.g., GoHighLevel, Slack, ClickUp, Canva, WordPress, Notion, Zapier, HubSpot, Salesforce, Asana, Trello"
                                        value={formData.tools}
                                        onChange={(e) => handleInputChange("tools", e.target.value)}
                                        className={inputClasses}
                                        onFocus={(e) => {
                                            e.currentTarget.style.borderColor = "var(--primary)";
                                            e.currentTarget.style.outline = "none";
                                            e.currentTarget.style.boxShadow = "0 0 0 2px color-mix(in srgb, var(--primary) 15%, transparent)";
                                        }}
                                        onBlur={(e) => {
                                            e.currentTarget.style.borderColor = "var(--border-color)";
                                            e.currentTarget.style.boxShadow = "none";
                                        }}
                                        rows={3}
                                    />
                                    <p className="text-xs mt-1.5 text-[var(--text-secondary)]">List the tools and technologies your team uses</p>
                                </div>
                                <div>
                                    <label className={labelClasses}>English Level</label>
                                    <SingleSelect
                                        value={formData.englishLevel}
                                        onChange={(v) => handleInputChange("englishLevel", v)}
                                        options={[
                                            { label: "Basic", value: "Basic" },
                                            { label: "Good", value: "Good" },
                                            { label: "Excellent", value: "Excellent" },
                                            { label: "Near-native", value: "Near-native" },
                                        ]}
                                        placeholder="Select level"
                                    />
                                </div>
                            </div>
                        </div>

                        {/* Additional Details - Process */}
                        <div className="p-4 rounded-lg border border-[var(--border-color)] bg-[var(--hover-bg)]">
                            <h3 className="text-sm font-medium mb-1 text-[var(--text-primary)]">Additional Details - Process</h3>
                            <p className="text-xs mb-3 text-[var(--text-secondary)]">Optional information to refine your job description</p>
                            <div className={sectionClasses}>
                                <div>
                                    <label className={labelClasses}>Existing SOPs?</label>
                                    <SingleSelect
                                        value={formData.existingSOPs}
                                        onChange={(v) => handleInputChange("existingSOPs", v)}
                                        options={[
                                            { label: "Yes", value: "Yes" },
                                            { label: "No", value: "No" },
                                        ]}
                                        placeholder="Select option"
                                    />
                                </div>

                                {formData.existingSOPs === "Yes" && (
                                    <div>
                                        <label className={labelClasses}>Drop or upload a file of your existing SOP</label>
                                        <input
                                            ref={sopFileInputRef}
                                            type="file"
                                            accept=".pdf,.doc,.docx,.txt"
                                            onChange={(e) => handleSOPFileChange(e.target.files?.[0] ?? null)}
                                            className={inputClasses}
                                        />
                                        {sopFile && (
                                            <div className="mt-2 flex items-center justify-between rounded-lg border px-3 py-2 text-xs border-[var(--border-color)] bg-[var(--card-bg)] text-[var(--text-primary)]">
                                                <span className="truncate">
                                                    {sopFile.name} · {(sopFile.size / (1024 * 1024)).toFixed(2)} MB
                                                </span>
                                                <button
                                                    type="button"
                                                    onClick={() => {
                                                        setSopFile(null);
                                                        setSopFileError(null);
                                                        if (sopFileInputRef.current) {
                                                            sopFileInputRef.current.value = "";
                                                        }
                                                    }}
                                                    className="ml-4 text-xs font-medium hover:underline text-[var(--accent)]"
                                                >
                                                    Remove
                                                </button>
                                            </div>
                                        )}
                                        {sopFileError && (
                                            <p className="mt-2 text-xs" style={{ color: "rgb(220, 38, 38)" }}>{sopFileError}</p>
                                        )}
                                        {formData.existingSOPs === "Yes" && !sopFile && !sopFileError && (
                                            <p className="mt-2 text-xs text-[var(--text-secondary)]">
                                                Supported file types: PDF, DOC, DOCX, TXT. Max size 10MB.
                                            </p>
                                        )}
                                    </div>
                                )}


                                <div>
                                    <label className={labelClasses}>Reporting Expectations</label>
                                    <textarea
                                        placeholder="What does success look like weekly?"
                                        value={formData.reportingExpectations}
                                        onChange={(e) => handleInputChange("reportingExpectations", e.target.value)}
                                        className={inputClasses}
                                        onFocus={(e) => {
                                            e.currentTarget.style.borderColor = "var(--primary)";
                                            e.currentTarget.style.outline = "none";
                                            e.currentTarget.style.boxShadow = "0 0 0 2px color-mix(in srgb, var(--primary) 15%, transparent)";
                                        }}
                                        onBlur={(e) => {
                                            e.currentTarget.style.borderColor = "var(--border-color)";
                                            e.currentTarget.style.boxShadow = "none";
                                        }}
                                        rows={3}
                                    />
                                </div>
                                <div>
                                    <label className={labelClasses}>Management Style</label>
                                    <SingleSelect
                                        value={formData.managementStyle}
                                        onChange={(v) => handleInputChange("managementStyle", v)}
                                        options={[
                                            { label: "Hands-on", value: "Hands-on" },
                                            { label: "Async", value: "Async" },
                                            { label: "Daily standup", value: "Daily standup" },
                                            { label: "Weekly", value: "Weekly" },
                                        ]}
                                        placeholder="Select style"
                                    />
                                </div>
                            </div>
                        </div>

                        {/* Additional Details - Constraints */}
                        <div className="p-4 rounded-lg border border-[var(--border-color)] bg-[var(--hover-bg)]">
                            <h3 className="text-sm font-medium mb-1 text-[var(--text-primary)]">Additional Details - Constraints</h3>
                            <p className="text-xs mb-3 text-[var(--text-secondary)]">Constraints and preferences</p>
                            <div className={sectionClasses}>
                                <div>
                                    <label className={labelClasses}>Security/Compliance Needs</label>
                                    <input
                                        type="text"
                                        placeholder="e.g., PII/PHI, finance access"
                                        value={formData.securityNeeds}
                                        onChange={(e) => handleInputChange("securityNeeds", e.target.value)}
                                        className={inputClasses}
                                        onFocus={(e) => {
                                            e.currentTarget.style.borderColor = "var(--primary)";
                                            e.currentTarget.style.outline = "none";
                                            e.currentTarget.style.boxShadow = "0 0 0 2px color-mix(in srgb, var(--primary) 15%, transparent)";
                                        }}
                                        onBlur={(e) => {
                                            e.currentTarget.style.borderColor = "var(--border-color)";
                                            e.currentTarget.style.boxShadow = "none";
                                        }}
                                    />
                                </div>
                                <div>
                                    <label className={labelClasses}>Deal Breakers</label>
                                    <textarea
                                        placeholder="Any absolute requirements or disqualifiers"
                                        value={formData.dealBreakers}
                                        onChange={(e) => handleInputChange("dealBreakers", e.target.value)}
                                        className={inputClasses}
                                        onFocus={(e) => {
                                            e.currentTarget.style.borderColor = "var(--primary)";
                                            e.currentTarget.style.outline = "none";
                                            e.currentTarget.style.boxShadow = "0 0 0 2px color-mix(in srgb, var(--primary) 15%, transparent)";
                                        }}
                                        onBlur={(e) => {
                                            e.currentTarget.style.borderColor = "var(--border-color)";
                                            e.currentTarget.style.boxShadow = "none";
                                        }}
                                        rows={2}
                                    />
                                </div>
                                <div>
                                    <label className={labelClasses}>Nice-to-Have Skills</label>
                                    <textarea
                                        placeholder="Secondary skills that would be a bonus"
                                        value={formData.niceToHaveSkills}
                                        onChange={(e) => handleInputChange("niceToHaveSkills", e.target.value)}
                                        className={inputClasses}
                                        onFocus={(e) => {
                                            e.currentTarget.style.borderColor = "var(--primary)";
                                            e.currentTarget.style.outline = "none";
                                            e.currentTarget.style.boxShadow = "0 0 0 2px color-mix(in srgb, var(--primary) 15%, transparent)";
                                        }}
                                        onBlur={(e) => {
                                            e.currentTarget.style.borderColor = "var(--border-color)";
                                            e.currentTarget.style.boxShadow = "none";
                                        }}
                                        rows={2}
                                    />
                                </div>
                            </div>
                        </div>
                    </div>
                </div>

                {/* Submit Button - Sticky at bottom */}
                <div className="border-t p-4 sticky bottom-0 border-[var(--border-color)] bg-[var(--card-bg)]">
                    <div className="flex flex-col gap-3">
                        {analysisError && (
                            <div className="px-3 py-2 rounded text-xs border" style={{ backgroundColor: "rgba(239, 68, 68, 0.1)", borderColor: "rgba(239, 68, 68, 0.3)", color: "rgb(220, 38, 38)" }}>
                                <p>{analysisError}</p>
                            </div>
                        )}
                        {analysisSuccess && (
                            <div className="px-3 py-2 rounded text-xs border bg-[var(--accent-bg)] border-[var(--accent)] text-[var(--accent)]">
                                <p>Analysis completed successfully!</p>
                            </div>
                        )}

                        <button
                            onClick={handleSubmitAnalysis}
                            disabled={isAnalyzing}
                            className="w-full px-3 py-2 rounded-lg text-sm font-medium transition-all duration-200 hover:brightness-110 disabled:opacity-50 disabled:cursor-not-allowed active:scale-95"
                            style={{
                                backgroundColor: isAnalyzing ? "var(--border-color)" : "var(--accent)",
                                color: isAnalyzing ? "var(--text-secondary)" : "#000",
                            }}
                        >
                            <div className="flex items-center justify-center gap-2">
                                {isAnalyzing ? (
                                    <>
                                        <svg className="animate-spin h-3.5 w-3.5" viewBox="0 0 24 24">
                                            <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" fill="none" />
                                            <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z" />
                                        </svg>
                                        <span>Analyzing...</span>
                                    </>
                                ) : (
                                    <span>Generate Description</span>
                                )}
                            </div>
                        </button>
                    </div>
                </div>

            </div>
            <Modal
                isOpen={showClearModal}
                onClose={() => setShowClearModal(false)}
                onConfirm={handleClearForm}
                title="Confirm Clear Data"
                message="Are you sure you want to clear all data?"
                confirmVariant="danger"
                confirmText={
                    isFormClearing ? (
                        <div className="flex items-center gap-2">
                            <svg className="animate-spin h-4 w-4" viewBox="0 0 24 24">
                                <circle
                                    className="opacity-25"
                                    cx="12"
                                    cy="12"
                                    r="10"
                                    stroke="currentColor"
                                    strokeWidth="4"
                                    fill="none"
                                />
                                <path
                                    className="opacity-75"
                                    fill="currentColor"
                                    d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"
                                />
                            </svg>
                            <span>Clearing form...</span>
                        </div>
                    ) : (
                        "Clear Form Data"
                    )
                }
            />
        </>

    );
}