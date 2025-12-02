"use client";

import { Fragment, useState, useEffect, useRef } from "react";
import { Listbox, Transition } from "@headlessui/react";
import { ChevronUpDownIcon } from "@heroicons/react/20/solid";
import Modal from "@/components/ui/Modal";
import { FormConfig, FormField, FieldType } from "./configs/jdFormConfig";

interface BaseIntakeFormProps {
    userId: string;
    config: FormConfig;
    onFormChange?: (data: Record<string, any>) => void;
    onClose: () => void;
    onSuccess?: (data: any) => void;
    onProgress?: (stage: string) => void;
    onError?: (error: string) => void;
    onSubmit?: (formData: Record<string, any>, files: Record<string, File | null>) => Promise<any>;
    initialData?: Record<string, any>;
}

export default function BaseIntakeForm({
    userId,
    config,
    onFormChange,
    onClose,
    onSuccess,
    onProgress,
    onSubmit,
    onError,
    initialData,
}: BaseIntakeFormProps) {
    const [formData, setFormData] = useState<Record<string, any>>(config.defaultValues);
    const [files, setFiles] = useState<Record<string, File | null>>({});
    const [fileErrors, setFileErrors] = useState<Record<string, string | null>>({});
    const fileInputRefs = useRef<Record<string, HTMLInputElement | null>>({});

    const [isClient, setIsClient] = useState(false);
    const [isSubmitting, setIsSubmitting] = useState(false);
    const [submitError, setSubmitError] = useState<string | null>(null);
    const [submitSuccess, setSubmitSuccess] = useState(false);
    const [showClearModal, setShowClearModal] = useState(false);
    const [isFormClearing, setIsFormClearing] = useState(false);

    const calculateProgress = (): number => {
        let totalRequired = 0;
        let filledRequired = 0;

        config.sections.forEach((section) => {
            section.fields.forEach((field) => {
                // Skip fields that shouldn't be shown
                if (!shouldShowField(field)) return;

                if (field.required) {
                    totalRequired++;
                    const value = formData[field.id];

                    if (field.type === 'array') {
                        const arrayMinItems = field.minItems || 0;
                        const arrayValue = Array.isArray(value) ? value : [];
                        if (arrayValue.slice(0, arrayMinItems).every((item: string) => item?.trim())) {
                            filledRequired++;
                        }
                    } else if (field.type === 'repeater') {
                        const repeaterMinItems = field.minItems || 0;
                        const repeaterValue = Array.isArray(value) ? value : [];
                        // Check if all required itemFields are filled for minimum items
                        const allFilled = repeaterValue.slice(0, repeaterMinItems).every((item: any) => {
                            if (!field.itemFields) return false;
                            return field.itemFields.every((itemField) => {
                                if (!itemField.required) return true;
                                const itemValue = item?.[itemField.id];
                                return itemValue && (typeof itemValue === "string" ? itemValue.trim() : true);
                            });
                        });
                        if (allFilled && repeaterValue.length >= repeaterMinItems) {
                            filledRequired++;
                        }
                    } else if (field.type === 'file') {
                        if (files[field.id]) {
                            filledRequired++;
                        }
                    } else if (field.type === 'slider') {
                        // Sliders always have a value (default 50)
                        filledRequired++;
                    } else {
                        if (value && (typeof value === "string" ? value.trim() : true)) {
                            filledRequired++;
                        }
                    }
                }
            });
        });

        return totalRequired > 0 ? Math.round((filledRequired / totalRequired) * 100) : 0;
    };

    useEffect(() => {
        setIsClient(true);

        // Priority: initialData > localStorage
        if (initialData) {
            setFormData(initialData);
            onFormChange?.(initialData);
        } else {
            try {
                const saved = localStorage.getItem(`${config.storageKey}-${userId}`);
                if (saved) {
                    const parsed = JSON.parse(saved);
                    setFormData(parsed);
                    onFormChange?.(parsed);
                }
            } catch (error) {
                console.error('Failed to load saved form data:', error);
            }
        }
    }, [userId, config.storageKey, initialData]);

    useEffect(() => {
        if (isClient) {
            try {
                localStorage.setItem(`${config.storageKey}-${userId}`, JSON.stringify(formData));
            } catch (error) {
                console.error('Failed to save form data:', error);
            }
        }
    }, [formData, userId, config.storageKey, isClient]);

    const handleInputChange = (fieldId: string, value: any) => {
        setFormData((prev) => {
            const newData = { ...prev, [fieldId]: value };
            onFormChange?.(newData);
            return newData;
        });
    };

    const handleArrayItemChange = (fieldId: string, index: number, value: string) => {
        const currentArray = Array.isArray(formData[fieldId]) ? [...formData[fieldId]] : [];
        currentArray[index] = value;
        handleInputChange(fieldId, currentArray);
    };

    const handleAddArrayItem = (fieldId: string) => {
        const currentArray = Array.isArray(formData[fieldId]) ? [...formData[fieldId]] : [];
        handleInputChange(fieldId, [...currentArray, ""]);
    };

    const handleRemoveArrayItem = (fieldId: string, index: number, minItems: number = 0) => {
        const currentArray = Array.isArray(formData[fieldId]) ? [...formData[fieldId]] : [];
        if (currentArray.length > minItems) {
            const newArray = currentArray.filter((_, i) => i !== index);
            handleInputChange(fieldId, newArray);
        }
    };

    const handleRepeaterItemChange = (fieldId: string, index: number, itemFieldId: string, value: any) => {
        const currentArray = Array.isArray(formData[fieldId]) ? [...formData[fieldId]] : [];
        if (!currentArray[index]) {
            currentArray[index] = {};
        }
        currentArray[index] = { ...currentArray[index], [itemFieldId]: value };
        handleInputChange(fieldId, currentArray);
    };

    const handleAddRepeaterItem = (fieldId: string, maxItems?: number) => {
        const currentArray = Array.isArray(formData[fieldId]) ? [...formData[fieldId]] : [];
        if (maxItems && currentArray.length >= maxItems) {
            return;
        }
        handleInputChange(fieldId, [...currentArray, {}]);
    };

    const handleRemoveRepeaterItem = (fieldId: string, index: number, minItems: number = 0) => {
        const currentArray = Array.isArray(formData[fieldId]) ? [...formData[fieldId]] : [];
        if (currentArray.length > minItems) {
            const newArray = currentArray.filter((_, i) => i !== index);
            handleInputChange(fieldId, newArray);
        }
    };

    const shouldShowField = (field: FormField): boolean => {
        if (!field.showIf) return true;
        const { field: conditionField, value: conditionValue } = field.showIf;
        const fieldValue = formData[conditionField];
        return fieldValue === conditionValue;
    };

    const handleFileChange = (fieldId: string, file: File | null, field: FormField) => {
        if (!file) {
            setFiles((prev) => {
                const newFiles = { ...prev };
                delete newFiles[fieldId];
                return newFiles;
            });
            setFileErrors((prev) => {
                const newErrors = { ...prev };
                delete newErrors[fieldId];
                return newErrors;
            });
            return;
        }

        if (!field.fileConfig) return;

        const { maxSize, allowedExtensions, allowedMimeTypes } = field.fileConfig;

        // Check file size
        if (file.size > maxSize) {
            setFileErrors((prev) => ({
                ...prev,
                [fieldId]: `File is too large. Please upload a file under ${(maxSize / (1024 * 1024)).toFixed(0)}MB.`,
            }));
            if (fileInputRefs.current[fieldId]) {
                fileInputRefs.current[fieldId]!.value = "";
            }
            return;
        }

        // Check file extension
        const extension = file.name.substring(file.name.lastIndexOf(".")).toLowerCase();
        const isExtensionAllowed = allowedExtensions.includes(extension);
        const isMimeAllowed = file.type ? allowedMimeTypes.includes(file.type) : isExtensionAllowed;

        if (!isExtensionAllowed && !isMimeAllowed) {
            setFileErrors((prev) => ({
                ...prev,
                [fieldId]: `Unsupported file type. Allowed types: ${allowedExtensions.join(", ").toUpperCase()}.`,
            }));
            if (fileInputRefs.current[fieldId]) {
                fileInputRefs.current[fieldId]!.value = "";
            }
            return;
        }

        setFiles((prev) => ({ ...prev, [fieldId]: file }));
        setFileErrors((prev) => {
            const newErrors = { ...prev };
            delete newErrors[fieldId];
            return newErrors;
        });
    };

    const handleSliderChange = (fieldId: string, value: number) => {
        handleInputChange(fieldId, value);
    };

    const handleClearForm = () => {
        setIsFormClearing(true);
        try {
            setFormData(config.defaultValues);
            setFiles({});
            setFileErrors({});
            onFormChange?.(config.defaultValues);
            localStorage.removeItem(`${config.storageKey}-${userId}`);

            // Clear all file inputs
            Object.keys(fileInputRefs.current).forEach((key) => {
                if (fileInputRefs.current[key]) {
                    fileInputRefs.current[key]!.value = "";
                }
            });
        } catch (error) {
            console.error("Failed to clear form data:", error);
        } finally {
            setIsFormClearing(false);
            setShowClearModal(false);
        }
    };

    const handleSubmit = async () => {
        // Check for file errors
        const hasFileErrors = Object.values(fileErrors).some((error) => error !== null);
        if (hasFileErrors) {
            setSubmitError("Please resolve file upload issues before submitting.");
            return;
        }

        setIsSubmitting(true);
        setSubmitError(null);
        setSubmitSuccess(false);

        try {
            let result;

            if (onSubmit) {
                // Use custom submit handler if provided
                result = await onSubmit(formData, files);
            } else if (config.apiEndpoint) {
                // Default API submission
                const payload = new FormData();
                payload.append("intake_json", JSON.stringify(formData));

                // Append files
                Object.entries(files).forEach(([key, file]) => {
                    if (file) {
                        payload.append(key, file);
                    }
                });

                const response = await fetch(config.apiEndpoint, {
                    method: 'POST',
                    body: payload,
                });

                if (!response.ok) {
                    let message = 'Submission failed';
                    try {
                        const errorPayload = await response.json();
                        if (errorPayload?.error) {
                            message = errorPayload.error;
                        }
                    } catch {
                        // Ignore JSON parse errors
                    }
                    throw new Error(message);
                }

                // Handle streaming response
                const reader = response.body?.getReader();
                const decoder = new TextDecoder();
                let buffer = '';
                let finalData: any = null;

                if (reader) {
                    while (true) {
                        const { done, value } = await reader.read();
                        if (done) break;

                        buffer += decoder.decode(value, { stream: true });
                        const lines = buffer.split('\n');
                        buffer = lines.pop() || '';

                        for (const line of lines) {
                            if (!line.trim()) continue;
                            try {
                                const parsed = JSON.parse(line);
                                if (parsed.type === 'progress' && parsed.stage) {
                                    if (onProgress) {
                                        onProgress(parsed.stage);
                                    }
                                } else if (parsed.type === 'result' && parsed.data) {
                                    finalData = parsed.data;
                                } else if (parsed.type === 'error') {
                                    const errorMessage = parsed.userMessage || parsed.error || parsed.details || 'Submission failed';
                                    throw new Error(errorMessage);
                                }
                            } catch (parseError) {
                                console.error('Failed to parse stream chunk:', parseError);
                            }
                        }
                    }

                    // Process any remaining buffer
                    if (buffer.trim()) {
                        try {
                            const parsed = JSON.parse(buffer);
                            if (parsed.type === 'result' && parsed.data) {
                                finalData = parsed.data;
                            } else if (parsed.type === 'error') {
                                const errorMessage = parsed.userMessage || parsed.error || parsed.details || 'Submission failed';
                                throw new Error(errorMessage);
                            }
                        } catch (parseError) {
                            console.error('Failed to parse final buffer:', parseError);
                        }
                    }
                } else {
                    // Non-streaming response
                    finalData = await response.json();
                }

                result = finalData || { success: true };
            } else {
                throw new Error('No submit handler or API endpoint configured');
            }

            setSubmitSuccess(true);

            if (onSuccess) {
                onSuccess({
                    apiResult: result,
                    input: formData,
                });
            }

            setTimeout(() => {
                onClose();
            }, 500);
        } catch (error) {
            console.error('Submission error:', error);
            // Prefer user-friendly message if available, otherwise use the error message
            let errorMessage = 'Failed to submit form';
            if (error instanceof Error) {
                errorMessage = (error as any).userFriendlyMessage || error.message;
            }
            setSubmitError(errorMessage);
            
            // Notify parent component of error
            if (onError) {
                onError(errorMessage);
            }
        } finally {
            setIsSubmitting(false);
        }
    };

    const inputClasses =
        "w-full px-3 py-2 rounded-lg border text-sm transition-all duration-200 focus:outline-none border-[var(--border-color)] bg-[var(--card-bg)] text-[var(--text-primary)] focus:border-[var(--primary)] focus:ring-2 focus:ring-[var(--primary)]/10";
    const labelClasses = "block text-xs font-medium mb-2 text-[var(--text-primary)]";
    const sectionClasses = "space-y-3";

    const classNames = (...classes: (string | boolean | undefined)[]) => classes.filter(Boolean).join(" ");

    function SingleSelect({
        value,
        onChange,
        options,
        placeholder,
    }: {
        value: string;
        onChange: (v: string) => void;
        options: { label: string; value: string }[];
        placeholder?: string;
    }) {
        const selected = options.find((o) => o.value === value) ?? null;
        return (
            <Listbox value={selected} onChange={(opt) => opt ? onChange(opt.value) : undefined}>
                {({ open }) => {
                    return (
                        <div className="relative">
                            <Listbox.Button
                                className={classNames(
                                    "w-full px-3 py-2 rounded-lg text-left text-sm transition-all duration-200 focus:outline-none cursor-pointer border-[var(--border-color)] bg-[var(--card-bg)] text-[var(--text-primary)] focus:border-[var(--primary)] focus:ring-2 focus:ring-[var(--primary)]/10"
                                )}
                            >
                                <span className="block truncate text-sm">
                                    {selected ? selected.label : placeholder || "Select"}
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
                                    <Listbox.Options className="absolute z-[99999] mt-1 max-h-60 w-full overflow-auto rounded-lg border shadow-md focus:outline-none border-[var(--border-color)] bg-[var(--card-bg)]">
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
                                                        className={`flex items-center justify-between px-3 py-2 text-[var(--text-primary)] transition-colors duration-150 ${active ? "bg-[var(--hover-bg)]" : ""
                                                            }`}
                                                    >

                                                        <span className={`block truncate ${isSelected ? "font-medium" : "font-normal"}`}>
                                                            {opt.label}
                                                        </span>
                                                        {isSelected && (
                                                            <span className="text-xs dark:text-[var(--accent)] dark:text-[var(--primary)]">✓</span>
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

    function Slider({
        value,
        onChange,
        label,
        helpText,
    }: {
        value: number;
        onChange: (v: number) => void;
        label: string;
        helpText?: string;
    }) {
        const [leftLabel, rightLabel] = label.split('↔').map((s) => s.trim());

        return (
            <div>
                <div className="flex items-center justify-between mb-2">
                    <span className="text-xs text-[var(--text-secondary)]">{leftLabel}</span>
                    <span className="text-xs font-medium text-[var(--text-primary)]">{value}</span>
                    <span className="text-xs text-[var(--text-secondary)]">{rightLabel}</span>
                </div>
                <input
                    type="range"
                    min="0"
                    max="100"
                    value={value}
                    onChange={(e) => onChange(parseInt(e.target.value, 10))}
                    className="w-full h-2 bg-[var(--border-color)] rounded-lg appearance-none cursor-pointer accent-[var(--primary)]"
                />
                {helpText && (
                    <p className="text-xs mt-1.5 text-[var(--text-secondary)]">{helpText}</p>
                )}
            </div>
        );
    }

    const renderField = (field: FormField) => {
        const value = formData[field.id] ?? (field.type === 'array' ? [] : field.type === 'slider' ? 50 : '');

        switch (field.type) {
            case 'text':
                return (
                    <div key={field.id}>
                        <label className={labelClasses}>
                            {field.label} {field.required && <span className="text-red-500">*</span>}
                        </label>
                        <input
                            type="text"
                            placeholder={field.placeholder}
                            value={value as string}
                            onChange={(e) => handleInputChange(field.id, e.target.value)}
                            className={inputClasses}
                            required={field.required}
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
                        {field.helpText && (
                            <p className="text-xs mt-1.5 text-[var(--text-secondary)]">{field.helpText}</p>
                        )}
                    </div>
                );

            case 'textarea':
                return (
                    <div key={field.id}>
                        <label className={labelClasses}>
                            {field.label} {field.required && <span className="text-red-500">*</span>}
                        </label>
                        <textarea
                            placeholder={field.placeholder}
                            value={value as string}
                            onChange={(e) => handleInputChange(field.id, e.target.value)}
                            className={inputClasses}
                            rows={3}
                            required={field.required}
                        />
                        {field.helpText && (
                            <p className="text-xs mt-1.5 text-[var(--text-secondary)]">{field.helpText}</p>
                        )}
                    </div>
                );

            case 'select':
                return (
                    <div key={field.id}>
                        <label className={labelClasses}>
                            {field.label} {field.required && <span className="text-red-500">*</span>}
                        </label>
                        <SingleSelect
                            value={value as string}
                            onChange={(v) => handleInputChange(field.id, v)}
                            options={field.options || []}
                            placeholder={field.placeholder}
                        />
                        {field.helpText && (
                            <p className="text-xs mt-1.5 text-[var(--text-secondary)]">{field.helpText}</p>
                        )}
                    </div>
                );

            case 'array':
                const arrayValue = Array.isArray(value) ? value : [];
                const arrayMinItems = field.minItems || 0;
                return (
                    <div key={field.id}>
                        <label className={labelClasses}>
                            {field.label} {field.required && <span className="text-red-500">*</span>}
                        </label>
                        {arrayValue.map((item: string, index: number) => (
                            <div key={index} className="relative mb-2">
                                <div className="flex items-center justify-between mb-2">
                                    <span className="text-xs text-[var(--text-secondary)]">
                                        {index < arrayMinItems ? `${field.label} ${index + 1}` : `Additional ${index - arrayMinItems + 1}`}
                                        {index < arrayMinItems && <span className="text-red-500 ml-1">*</span>}
                                    </span>
                                    {index >= arrayMinItems && (
                                        <button
                                            type="button"
                                            onClick={() => handleRemoveArrayItem(field.id, index, arrayMinItems)}
                                            className="p-1 rounded transition-colors hover:bg-red-500/20"
                                            style={{ color: "rgb(239, 68, 68)" }}
                                            aria-label="Remove item"
                                        >
                                            <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                                            </svg>
                                        </button>
                                    )}
                                </div>
                                <input
                                    type="text"
                                    placeholder={field.placeholder}
                                    value={item}
                                    onChange={(e) => handleArrayItemChange(field.id, index, e.target.value)}
                                    className={inputClasses}
                                    required={index < arrayMinItems && field.required}
                                />
                            </div>
                        ))}
                        <button
                            type="button"
                            onClick={() => handleAddArrayItem(field.id)}
                            className="inline-flex items-center justify-center rounded-lg border border-dashed px-3 py-2 text-xs font-medium transition-colors text-[var(--primary)] border-[var(--primary)] dark:text-[var(--accent)] dark:border-[var(--accent)] hover:bg-[var(--hover-bg)]"
                        >
                            + Add {field.label}
                        </button>
                        {field.helpText && (
                            <p className="text-xs mt-1.5 text-[var(--text-secondary)]">{field.helpText}</p>
                        )}
                    </div>
                );

            case 'file':
                const file = files[field.id];
                const fileError = fileErrors[field.id];
                return (
                    <div key={field.id}>
                        <label className={labelClasses}>
                            {field.label} {field.required && <span className="text-red-500">*</span>}
                        </label>
                        <input
                            ref={(el) => {
                                if (el) fileInputRefs.current[field.id] = el;
                            }}
                            type="file"
                            accept={field.fileConfig?.allowedExtensions.join(',')}
                            onChange={(e) => handleFileChange(field.id, e.target.files?.[0] ?? null, field)}
                            className={inputClasses}
                        />
                        {file && (
                            <div className="mt-2 flex items-center justify-between rounded-lg border px-3 py-2 text-xs border-[var(--border-color)] bg-[var(--card-bg)] text-[var(--text-primary)]">
                                <span className="truncate">
                                    {file.name} · {(file.size / (1024 * 1024)).toFixed(2)} MB
                                </span>
                                <button
                                    type="button"
                                    onClick={() => {
                                        handleFileChange(field.id, null, field);
                                        if (fileInputRefs.current[field.id]) {
                                            fileInputRefs.current[field.id]!.value = "";
                                        }
                                    }}
                                    className="ml-4 text-xs font-medium hover:underline text-[var(--accent)]"
                                >
                                    Remove
                                </button>
                            </div>
                        )}
                        {fileError && (
                            <p className="mt-2 text-xs text-red-600 dark:text-red-400">{fileError}</p>
                        )}
                        {field.helpText && !file && !fileError && (
                            <p className="mt-2 text-xs text-[var(--text-secondary)]">{field.helpText}</p>
                        )}
                    </div>
                );

            case 'slider':
                return (
                    <div key={field.id}>
                        <label className={labelClasses}>
                            {field.label} {field.required && <span className="text-red-500">*</span>}
                        </label>
                        <Slider
                            value={value as number}
                            onChange={(v) => handleSliderChange(field.id, v)}
                            label={field.label}
                            helpText={field.helpText}
                        />
                    </div>
                );

            case 'repeater':
                const repeaterValue = Array.isArray(value) ? value : [];
                const repeaterMinItems = field.minItems || 0;
                const repeaterMaxItems = field.maxItems;
                return (
                    <div key={field.id}>
                        <label className={labelClasses}>
                            {field.label} {field.required && <span className="text-red-500">*</span>}
                        </label>
                        {repeaterValue.map((item: any, index: number) => (
                            <div key={index} className="mb-4 p-4 rounded-lg border border-[var(--border-color)] bg-[var(--card-bg)]">
                                <div className="flex items-center justify-between mb-3">
                                    <span className="text-xs font-medium text-[var(--text-primary)]">
                                        {index < repeaterMinItems ? `${field.label} ${index + 1}` : `Additional ${index - repeaterMinItems + 1}`}
                                        {index < repeaterMinItems && <span className="text-red-500 ml-1">*</span>}
                                    </span>
                                    {index >= repeaterMinItems && (
                                        <button
                                            type="button"
                                            onClick={() => handleRemoveRepeaterItem(field.id, index, repeaterMinItems)}
                                            className="p-1 rounded transition-colors hover:bg-red-500/20"
                                            style={{ color: "rgb(239, 68, 68)" }}
                                            aria-label="Remove item"
                                        >
                                            <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                                            </svg>
                                        </button>
                                    )}
                                </div>
                                <div className="space-y-3">
                                    {field.itemFields?.map((itemField) => (
                                        <div key={itemField.id}>
                                            <label className={labelClasses}>
                                                {itemField.label} {itemField.required && <span className="text-red-500">*</span>}
                                            </label>
                                            {itemField.type === 'text' && (
                                                <input
                                                    type="text"
                                                    placeholder={itemField.placeholder}
                                                    value={item?.[itemField.id] || ''}
                                                    onChange={(e) => handleRepeaterItemChange(field.id, index, itemField.id, e.target.value)}
                                                    className={inputClasses}
                                                    required={itemField.required}
                                                />
                                            )}
                                            {itemField.type === 'textarea' && (
                                                <textarea
                                                    placeholder={itemField.placeholder}
                                                    value={item?.[itemField.id] || ''}
                                                    onChange={(e) => handleRepeaterItemChange(field.id, index, itemField.id, e.target.value)}
                                                    className={inputClasses}
                                                    rows={3}
                                                    required={itemField.required}
                                                />
                                            )}
                                            {itemField.type === 'select' && itemField.options && (
                                                <SingleSelect
                                                    value={item?.[itemField.id] || ''}
                                                    onChange={(v) => handleRepeaterItemChange(field.id, index, itemField.id, v)}
                                                    options={itemField.options}
                                                    placeholder={itemField.placeholder}
                                                />
                                            )}
                                            {itemField.helpText && (
                                                <p className="text-xs mt-1.5 text-[var(--text-secondary)]">{itemField.helpText}</p>
                                            )}
                                        </div>
                                    ))}
                                </div>
                            </div>
                        ))}
                        {(!repeaterMaxItems || repeaterValue.length < repeaterMaxItems) && (
                            <button
                                type="button"
                                onClick={() => handleAddRepeaterItem(field.id, repeaterMaxItems)}
                                className="inline-flex items-center justify-center rounded-lg border border-dashed px-3 py-2 text-xs font-medium transition-colors text-[var(--primary)] border-[var(--primary)] dark:text-[var(--accent)] dark:border-[var(--accent)] hover:bg-[var(--hover-bg)]"
                            >
                                + Add {field.label}
                            </button>
                        )}
                        {field.helpText && (
                            <p className="text-xs mt-1.5 text-[var(--text-secondary)]">{field.helpText}</p>
                        )}
                    </div>
                );

            default:
                return null;
        }
    };

    const progress = calculateProgress();

    return (
        <>
            <div className="flex flex-col max-h-[calc(100vh-12rem)]">
                {/* Progress Bar */}
                <div className="mb-4 pb-4 border-b border-[var(--border-color)]">
                    <div className="flex items-center justify-between mb-2">
                        <div>
                            <h1 className="text-lg font-semibold mb-1 text-[var(--text-primary)]">
                                {config.title}
                            </h1>
                            <p className="text-xs text-[var(--text-secondary)]">
                                {config.description}
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
                                className="h-2 rounded-full transition-all duration-300 bg-[var(--accent)] dark:bg-[var(--primary-light)]"
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
                        {config.sections.map((section) => (
                            <div key={section.id} className="p-4 rounded-lg border border-[var(--border-color)] bg-[var(--hover-bg)]">
                                <h3 className="text-sm font-medium mb-1 text-[var(--text-primary)]">
                                    {section.title}
                                </h3>
                                {section.description && (
                                    <p className="text-xs mb-3 text-[var(--text-secondary)]">
                                        {section.description}
                                    </p>
                                )}
                                <div className={sectionClasses}>
                                    {section.fields.map((field) => {
                                        // Handle conditional field display using showIf
                                        if (!shouldShowField(field)) {
                                            return null;
                                        }
                                        return renderField(field);
                                    })}
                                </div>
                            </div>
                        ))}
                    </div>
                </div>

                {/* Submit Button - Sticky at bottom */}
                <div className="border-t p-4 sticky bottom-0 border-[var(--border-color)] bg-[var(--card-bg)]">
                    <div className="flex flex-col gap-3">
                        {submitError && (
                            <div className="px-3 py-2 rounded text-xs border" style={{ backgroundColor: "rgba(239, 68, 68, 0.1)", borderColor: "rgba(239, 68, 68, 0.3)", color: "rgb(220, 38, 38)" }}>
                                <p>{submitError}</p>
                            </div>
                        )}
                        {submitSuccess && (
                            <div className="px-3 py-2 rounded text-xs border bg-[var(--accent-bg)] border-[var(--accent)] text-[var(--accent)]">
                                <p>Submission completed successfully!</p>
                            </div>
                        )}

                        <button
                            onClick={handleSubmit}
                            disabled={isSubmitting}
                            className={`w-full px-3 py-2 rounded-lg text-sm font-medium transition-all duration-200 hover:brightness-110 disabled:opacity-50 disabled:cursor-not-allowed active:scale-95 bg-[var(--primary)] dark:bg-[var(--accent)] text-white`}
                        >
                            <div className="flex items-center justify-center gap-2">
                                {isSubmitting ? (
                                    <>
                                        <svg className="animate-spin h-3.5 w-3.5" viewBox="0 0 24 24">
                                            <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" fill="none" />
                                            <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z" />
                                        </svg>
                                        <span>Submitting...</span>
                                    </>
                                ) : (
                                    <span>{config.submitButtonText}</span>
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

