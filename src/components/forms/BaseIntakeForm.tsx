"use client";

import { useState, useEffect, useRef, useImperativeHandle, forwardRef } from "react";
import { ChevronDown, X, Upload, FileText, Plus, Loader2, CheckCircle2, AlertCircle } from "lucide-react";
import { FormConfig, FormField, FieldType } from "./configs/jdFormConfig";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Progress } from "@/components/ui/progress";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { Slider as SliderComponent } from "@/components/ui/slider";
import {
    AlertDialog,
    AlertDialogAction,
    AlertDialogCancel,
    AlertDialogContent,
    AlertDialogDescription,
    AlertDialogFooter,
    AlertDialogHeader,
    AlertDialogTitle,
} from "@/components/ui/alert-dialog";

interface BaseIntakeFormProps {
    userId: string;
    config: FormConfig;
    onFormChange?: (data: Record<string, any>) => void;
    onClose: () => void;
    onSuccess?: (data: any) => void;
    onProgress?: (stage: string) => void;
    onError?: (error: string) => void;
    onSubmit?: (formData: Record<string, any>, uploadedFileUrls: Record<string, Array<{ url: string; name: string; key: string; type: string }>>) => Promise<any>;
    initialData?: Record<string, any>;
    hideClearButton?: boolean;
    secondaryButton?: React.ReactNode;
}

export interface BaseIntakeFormRef {
    triggerClearForm: () => void;
}

const BaseIntakeForm = forwardRef<BaseIntakeFormRef, BaseIntakeFormProps>(({
    userId,
    config,
    onFormChange,
    onClose,
    onSuccess,
    onProgress,
    onSubmit,
    onError,
    initialData,
    hideClearButton = false,
    secondaryButton,
}, ref) => {
    const [formData, setFormData] = useState<Record<string, any>>(config.defaultValues);
    const [files, setFiles] = useState<Record<string, File[]>>({});
    const [uploadedFileUrls, setUploadedFileUrls] = useState<Record<string, Array<{ url: string; name: string; key: string; type: string }>>>({});
    const [uploadingFiles, setUploadingFiles] = useState<Record<string, Record<number, boolean>>>({});
    const [fileUploadErrors, setFileUploadErrors] = useState<Record<string, Record<number, string>>>({});
    const [fileErrors, setFileErrors] = useState<Record<string, string | null>>({});
    const [dragOver, setDragOver] = useState<Record<string, boolean>>({});
    const fileInputRefs = useRef<Record<string, HTMLInputElement | null>>({});

    const [isClient, setIsClient] = useState(false);
    const [isSubmitting, setIsSubmitting] = useState(false);
    const [submitError, setSubmitError] = useState<string | null>(null);
    const [submitSuccess, setSubmitSuccess] = useState(false);
    const [showClearModal, setShowClearModal] = useState(false);
    const [isFormClearing, setIsFormClearing] = useState(false);
    const [expandedSections, setExpandedSections] = useState<Record<string, boolean>>({});

    useImperativeHandle(ref, () => ({
        triggerClearForm: () => {
            setShowClearModal(true);
        },
    }));

    const calculateProgress = (): number => {
        let totalRequired = 0;
        let filledRequired = 0;

        config.sections.forEach((section) => {
            // Only count required fields from non-optional sections for progress
            if (section.isOptional) return;

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
                        // Check if files are uploaded to S3 (not just selected)
                        const fieldUrls = uploadedFileUrls[field.id] || [];
                        if (fieldUrls.length > 0) {
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

    const toggleSection = (sectionId: string) => {
        setExpandedSections((prev) => ({
            ...prev,
            [sectionId]: !prev[sectionId],
        }));
    };

    useEffect(() => {
        setIsClient(true);

        // Initialize expanded sections based on defaultExpanded
        const initialExpanded: Record<string, boolean> = {};
        config.sections.forEach((section) => {
            if (section.isCollapsible) {
                initialExpanded[section.id] = section.defaultExpanded ?? false;
            } else {
                initialExpanded[section.id] = true; // Non-collapsible sections are always expanded
            }
        });
        setExpandedSections(initialExpanded);

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

    const validateFile = (file: File, field: FormField): string | null => {
        if (!field.fileConfig) return null;

        const { maxSize, allowedExtensions, allowedMimeTypes } = field.fileConfig;

        // Check file size
        if (file.size > maxSize) {
            return `File "${file.name}" is too large. Please upload files under ${(maxSize / (1024 * 1024)).toFixed(0)}MB.`;
        }

        // Check file extension
        const extension = file.name.substring(file.name.lastIndexOf(".")).toLowerCase();
        const isExtensionAllowed = allowedExtensions.includes(extension);
        const isMimeAllowed = file.type ? allowedMimeTypes.includes(file.type) : isExtensionAllowed;

        if (!isExtensionAllowed && !isMimeAllowed) {
            return `Unsupported file type for "${file.name}". Allowed types: ${allowedExtensions.join(", ").toUpperCase()}.`;
        }

        return null;
    };

    const uploadFileToS3 = async (
        file: File,
        fieldId: string,
        fileIndex: number,
        field: FormField
    ): Promise<{ url: string; name: string; key: string; type: string } | null> => {
        try {
            // Get presigned URL
            const presignedResponse = await fetch("/api/upload/presigned-url", {
                method: "POST",
                headers: {
                    "Content-Type": "application/json",
                },
                body: JSON.stringify({
                    fileName: file.name,
                    fileType: file.type || "application/octet-stream",
                    fieldId: fieldId,
                    maxSize: field.fileConfig?.maxSize,
                    allowedMimeTypes: field.fileConfig?.allowedMimeTypes,
                }),
            });

            if (!presignedResponse.ok) {
                const errorData = await presignedResponse.json();
                throw new Error(errorData.error || "Failed to get upload URL");
            }

            const { presignedUrl, fileUrl, key } = await presignedResponse.json();

            // Upload file directly to S3
            // Note: credentials must be 'omit' for S3 presigned URLs to work with CORS wildcard
            const uploadResponse = await fetch(presignedUrl, {
                method: "PUT",
                body: file,
                headers: {
                    "Content-Type": file.type || "application/octet-stream",
                },
                credentials: "omit", // Required: S3 presigned URLs don't need credentials, and wildcard CORS doesn't allow credentials
            });

            if (!uploadResponse.ok) {
                // Try to read error response from S3
                let errorText = "Failed to upload file to S3";
                try {
                    const errorBody = await uploadResponse.text();
                    if (errorBody) {
                        errorText = `S3 upload failed: ${errorBody}`;
                    } else {
                        errorText = `S3 upload failed with status ${uploadResponse.status}: ${uploadResponse.statusText}`;
                    }
                } catch (e) {
                    errorText = `S3 upload failed with status ${uploadResponse.status}: ${uploadResponse.statusText}`;
                }
                console.error("S3 upload error:", {
                    status: uploadResponse.status,
                    statusText: uploadResponse.statusText,
                    headers: Object.fromEntries(uploadResponse.headers.entries()),
                });
                throw new Error(errorText);
            }

            return {
                url: fileUrl,
                name: file.name,
                key: key,
                type: file.type || "application/octet-stream",
            };
        } catch (error) {
            console.error("Error uploading file to S3:", error);
            const errorMessage = error instanceof Error ? error.message : "Failed to upload file";
            
            // Set error for this specific file
            setFileUploadErrors((prev) => ({
                ...prev,
                [fieldId]: {
                    ...(prev[fieldId] || {}),
                    [fileIndex]: errorMessage,
                },
            }));
            
            return null;
        }
    };

    const handleFilesAdd = async (fieldId: string, newFiles: File[], field: FormField) => {
        if (!field.fileConfig) return;

        const currentFiles = files[fieldId] || [];
        const currentUrls = uploadedFileUrls[fieldId] || [];
        const validFiles: File[] = [];
        const errors: string[] = [];

        // Validate each file
        newFiles.forEach((file) => {
            const error = validateFile(file, field);
            if (error) {
                errors.push(error);
            } else {
                // Check for duplicates (by name and size)
                const isDuplicate = currentFiles.some(
                    (existingFile) => existingFile.name === file.name && existingFile.size === file.size
                ) || currentUrls.some(
                    (existingUrl) => existingUrl.name === file.name
                );
                if (!isDuplicate) {
                    validFiles.push(file);
                }
            }
        });

        // Set validation errors if any
        if (errors.length > 0) {
            setFileErrors((prev) => ({
                ...prev,
                [fieldId]: errors.join(" "),
            }));
        } else {
            setFileErrors((prev) => {
                const newErrors = { ...prev };
                delete newErrors[fieldId];
                return newErrors;
            });
        }

        // Add valid files to UI state immediately
        if (validFiles.length > 0) {
            const startIndex = currentFiles.length;
            setFiles((prev) => ({
                ...prev,
                [fieldId]: [...currentFiles, ...validFiles],
            }));

            // Initialize uploading state for all new files
            setUploadingFiles((prev) => {
                const fieldUploading = prev[fieldId] || {};
                validFiles.forEach((_, index) => {
                    fieldUploading[startIndex + index] = true;
                });
                return {
                    ...prev,
                    [fieldId]: fieldUploading,
                };
            });

            // Upload each file to S3
            validFiles.forEach((file, index) => {
                const fileIndex = startIndex + index;
                const fileKey = `${file.name}-${file.size}`;
                
                uploadFileToS3(file, fieldId, fileIndex, field).then((uploadResult) => {
                    // Remove from uploading state
                    setUploadingFiles((prev) => {
                        const fieldUploading = { ...(prev[fieldId] || {}) };
                        delete fieldUploading[fileIndex];
                        return {
                            ...prev,
                            [fieldId]: fieldUploading,
                        };
                    });

                    // If upload successful, add to uploadedFileUrls
                    // Match by file name to maintain correspondence
                    if (uploadResult) {
                        setUploadedFileUrls((prev) => {
                            const currentUrls = prev[fieldId] || [];
                            // Check if this file is already in the list (by name)
                            const existingIndex = currentUrls.findIndex((url) => url.name === file.name);
                            if (existingIndex >= 0) {
                                // Replace existing entry
                                const newUrls = [...currentUrls];
                                newUrls[existingIndex] = uploadResult;
                                return {
                                    ...prev,
                                    [fieldId]: newUrls,
                                };
                            } else {
                                // Add new entry
                                return {
                                    ...prev,
                                    [fieldId]: [...currentUrls, uploadResult],
                                };
                            }
                        });
                    }
                });
            });
        }

        // Clear input
        if (fileInputRefs.current[fieldId]) {
            fileInputRefs.current[fieldId]!.value = "";
        }
    };

    const handleFileChange = (fieldId: string, fileList: FileList | null, field: FormField) => {
        if (!fileList || fileList.length === 0) return;
        const newFiles = Array.from(fileList);
        handleFilesAdd(fieldId, newFiles, field);
    };

    const handleFileRemove = (fieldId: string, index: number) => {
        // Get the file being removed to match by name
        const fileToRemove = files[fieldId]?.[index];
        
        // Remove from files state
        setFiles((prev) => {
            const currentFiles = prev[fieldId] || [];
            const newFiles = currentFiles.filter((_, i) => i !== index);
            if (newFiles.length === 0) {
                const updated = { ...prev };
                delete updated[fieldId];
                return updated;
            }
            return { ...prev, [fieldId]: newFiles };
        });

        // Remove from uploadedFileUrls state (match by file name)
        if (fileToRemove) {
            setUploadedFileUrls((prev) => {
                const currentUrls = prev[fieldId] || [];
                const newUrls = currentUrls.filter((url) => url.name !== fileToRemove.name);
                if (newUrls.length === 0) {
                    const updated = { ...prev };
                    delete updated[fieldId];
                    return updated;
                }
                return { ...prev, [fieldId]: newUrls };
            });
        }

        // Remove from uploading state
        setUploadingFiles((prev) => {
            const fieldUploading = { ...(prev[fieldId] || {}) };
            delete fieldUploading[index];
            if (Object.keys(fieldUploading).length === 0) {
                const updated = { ...prev };
                delete updated[fieldId];
                return updated;
            }
            return { ...prev, [fieldId]: fieldUploading };
        });

        // Remove from upload errors
        setFileUploadErrors((prev) => {
            const fieldErrors = { ...(prev[fieldId] || {}) };
            delete fieldErrors[index];
            if (Object.keys(fieldErrors).length === 0) {
                const updated = { ...prev };
                delete updated[fieldId];
                return updated;
            }
            return { ...prev, [fieldId]: fieldErrors };
        });

        // Clear field-level errors
        setFileErrors((prev) => {
            const newErrors = { ...prev };
            delete newErrors[fieldId];
            return newErrors;
        });
    };

    const handleDragOver = (e: React.DragEvent, fieldId: string) => {
        e.preventDefault();
        e.stopPropagation();
        setDragOver((prev) => ({ ...prev, [fieldId]: true }));
    };

    const handleDragLeave = (e: React.DragEvent, fieldId: string) => {
        e.preventDefault();
        e.stopPropagation();
        setDragOver((prev) => ({ ...prev, [fieldId]: false }));
    };

    const handleDrop = (e: React.DragEvent, fieldId: string, field: FormField) => {
        e.preventDefault();
        e.stopPropagation();
        setDragOver((prev) => ({ ...prev, [fieldId]: false }));

        const droppedFiles = Array.from(e.dataTransfer.files);
        if (droppedFiles.length > 0) {
            handleFilesAdd(fieldId, droppedFiles, field);
        }
    };

    const handleSliderChange = (fieldId: string, value: number) => {
        handleInputChange(fieldId, value);
    };

    const handleClearForm = () => {
        setIsFormClearing(true);
        try {
            setFormData(config.defaultValues);
            setFiles({});
            setUploadedFileUrls({});
            setUploadingFiles({});
            setFileUploadErrors({});
            setFileErrors({});
            setDragOver({});
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

        // Check if any files are still uploading
        const hasUploadingFiles = Object.values(uploadingFiles).some((fieldUploading) =>
            Object.values(fieldUploading).some((isUploading) => isUploading)
        );
        if (hasUploadingFiles) {
            setSubmitError("Please wait for all files to finish uploading before submitting.");
            return;
        }

        // Check for file upload errors
        const hasUploadErrors = Object.values(fileUploadErrors).some((fieldErrors) =>
            Object.values(fieldErrors).some((error) => error !== null && error !== undefined)
        );
        if (hasUploadErrors) {
            setSubmitError("Please resolve file upload errors before submitting.");
            return;
        }

        setIsSubmitting(true);
        setSubmitError(null);
        setSubmitSuccess(false);

        try {
            let result;

            if (onSubmit) {
                // Use custom submit handler if provided
                // Pass uploadedFileUrls instead of files
                result = await onSubmit(formData, uploadedFileUrls);
            } else if (config.apiEndpoint) {
                // Default API submission
                const payload = new FormData();
                payload.append("intake_json", JSON.stringify(formData));

                // Append file URLs (not files)
                payload.append("file_urls", JSON.stringify(uploadedFileUrls));

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
            <div className="space-y-2">
                <div className="flex items-center justify-between">
                    <span className="text-xs text-muted-foreground">{leftLabel}</span>
                    <span className="text-xs font-medium">{value}</span>
                    <span className="text-xs text-muted-foreground">{rightLabel}</span>
                </div>
                <SliderComponent
                    value={[value]}
                    onValueChange={(vals) => onChange(vals[0])}
                    min={0}
                    max={100}
                />
                {helpText && (
                    <p className="text-xs text-muted-foreground">{helpText}</p>
                )}
            </div>
        );
    }

    const renderField = (field: FormField) => {
        const value = formData[field.id] ?? (field.type === 'array' ? [] : field.type === 'slider' ? 50 : '');

        switch (field.type) {
            case 'text':
                return (
                    <div key={field.id} className="space-y-2">
                        <Label htmlFor={field.id}>
                            {field.label} {field.required && <span className="text-destructive">*</span>}
                        </Label>
                        <Input
                            id={field.id}
                            type="text"
                            placeholder={field.placeholder}
                            value={value as string}
                            onChange={(e) => handleInputChange(field.id, e.target.value)}
                            required={field.required}
                        />
                        {field.helpText && (
                            <p className="text-xs text-muted-foreground">{field.helpText}</p>
                        )}
                    </div>
                );

            case 'textarea':
                return (
                    <div key={field.id} className="space-y-2">
                        <Label htmlFor={field.id}>
                            {field.label} {field.required && <span className="text-destructive">*</span>}
                        </Label>
                        <Textarea
                            id={field.id}
                            placeholder={field.placeholder}
                            value={value as string}
                            onChange={(e) => handleInputChange(field.id, e.target.value)}
                            rows={3}
                            required={field.required}
                        />
                        {field.helpText && (
                            <p className="text-xs text-muted-foreground">{field.helpText}</p>
                        )}
                    </div>
                );

            case 'select':
                return (
                    <div key={field.id} className="space-y-2">
                        <Label htmlFor={field.id}>
                            {field.label} {field.required && <span className="text-destructive">*</span>}
                        </Label>
                        <Select
                            value={value as string}
                            onValueChange={(v) => handleInputChange(field.id, v)}
                        >
                            <SelectTrigger id={field.id} className="w-full">
                                <SelectValue placeholder={field.placeholder || "Select"} />
                            </SelectTrigger>
                            <SelectContent className="z-[10000]">
                                {field.options?.map((opt) => (
                                    <SelectItem key={String(opt.value)} value={opt.value}>
                                        {opt.label}
                                    </SelectItem>
                                ))}
                            </SelectContent>
                        </Select>
                        {field.helpText && (
                            <p className="text-xs text-muted-foreground">{field.helpText}</p>
                        )}
                    </div>
                );

            case 'array':
                const arrayValue = Array.isArray(value) ? value : [];
                const arrayMinItems = field.minItems || 0;
                return (
                    <div key={field.id} className="space-y-3">
                        <Label>
                            {field.label} {field.required && <span className="text-destructive">*</span>}
                        </Label>
                        {arrayValue.map((item: string, index: number) => (
                            <div key={index} className="space-y-2">
                                <div className="flex items-center justify-between">
                                    <Label className="text-xs text-muted-foreground">
                                        {index < arrayMinItems ? `${field.label} ${index + 1}` : `Additional ${index - arrayMinItems + 1}`}
                                        {index < arrayMinItems && <span className="text-destructive ml-1">*</span>}
                                    </Label>
                                    {index >= arrayMinItems && (
                                        <Button
                                            type="button"
                                            variant="ghost"
                                            size="icon"
                                            className="h-6 w-6"
                                            onClick={() => handleRemoveArrayItem(field.id, index, arrayMinItems)}
                                            aria-label="Remove item"
                                        >
                                            <X className="h-4 w-4 text-destructive" />
                                        </Button>
                                    )}
                                </div>
                                <Input
                                    type="text"
                                    placeholder={field.placeholder}
                                    value={item}
                                    onChange={(e) => handleArrayItemChange(field.id, index, e.target.value)}
                                    required={index < arrayMinItems && field.required}
                                />
                            </div>
                        ))}
                        <Button
                            type="button"
                            variant="outline"
                            size="sm"
                            onClick={() => handleAddArrayItem(field.id)}
                            className="w-full"
                        >
                            <Plus className="h-4 w-4 mr-2" />
                            Add {field.label}
                        </Button>
                        {field.helpText && (
                            <p className="text-xs text-muted-foreground">{field.helpText}</p>
                        )}
                    </div>
                );

            case 'file':
                const fieldFiles = files[field.id] || [];
                const fieldUrls = uploadedFileUrls[field.id] || [];
                const fieldUploading = uploadingFiles[field.id] || {};
                const fieldUploadErrors = fileUploadErrors[field.id] || {};
                const fileError = fileErrors[field.id];
                const isDragOver = dragOver[field.id] || false;
                const hasUploading = Object.values(fieldUploading).some((uploading) => uploading);
                
                return (
                    <div key={field.id} className="space-y-3">
                        <Label>
                            {field.label} {field.required && <span className="text-destructive">*</span>}
                        </Label>
                        <div
                            onDragOver={(e) => handleDragOver(e, field.id)}
                            onDragLeave={(e) => handleDragLeave(e, field.id)}
                            onDrop={(e) => handleDrop(e, field.id, field)}
                            className={`relative border-2 border-dashed rounded-lg p-6 transition-all duration-200 ${isDragOver
                                ? "border-primary bg-primary/5"
                                : "border-border bg-muted/50 hover:border-primary/50"
                                } ${hasUploading ? "opacity-50 pointer-events-none" : ""}`}
                        >
                            <input
                                ref={(el) => {
                                    if (el) fileInputRefs.current[field.id] = el;
                                }}
                                type="file"
                                multiple
                                accept={field.fileConfig?.allowedExtensions.join(',')}
                                onChange={(e) => handleFileChange(field.id, e.target.files, field)}
                                className="absolute inset-0 w-full h-full opacity-0 cursor-pointer"
                                disabled={hasUploading}
                            />
                            <div className="flex flex-col items-center justify-center text-center">
                                <Upload className="w-10 h-10 mb-3 text-muted-foreground" />
                                <p className="text-sm font-medium mb-1">
                                    {isDragOver ? "Drop files here" : "Drag and drop files here"}
                                </p>
                                <p className="text-xs text-muted-foreground mb-2">
                                    or click to browse
                                </p>
                                {field.fileConfig && (
                                    <p className="text-xs text-muted-foreground">
                                        Accepted: {field.fileConfig.allowedExtensions.join(", ").toUpperCase()} · Max: {(field.fileConfig.maxSize / (1024 * 1024)).toFixed(0)}MB per file
                                    </p>
                                )}
                            </div>
                        </div>
                        {fieldFiles.length > 0 && (
                            <div className="space-y-2">
                                {fieldFiles.map((file, index) => {
                                    const isUploading = fieldUploading[index] || false;
                                    const uploadError = fieldUploadErrors[index];
                                    const isUploaded = fieldUrls.some((url) => url.name === file.name);
                                    
                                    return (
                                        <div
                                            key={`${file.name}-${index}`}
                                            className={`flex items-center justify-between rounded-lg border px-3 py-2 text-xs ${
                                                uploadError ? "border-destructive bg-destructive/5" : ""
                                            }`}
                                        >
                                            <div className="flex items-center gap-2 flex-1 min-w-0">
                                                {isUploading ? (
                                                    <Loader2 className="w-4 h-4 flex-shrink-0 text-primary animate-spin" />
                                                ) : isUploaded ? (
                                                    <CheckCircle2 className="w-4 h-4 flex-shrink-0 text-green-500" />
                                                ) : uploadError ? (
                                                    <AlertCircle className="w-4 h-4 flex-shrink-0 text-destructive" />
                                                ) : (
                                                    <FileText className="w-4 h-4 flex-shrink-0 text-muted-foreground" />
                                                )}
                                                <div className="flex-1 min-w-0">
                                                    <span className="truncate block">
                                                        {file.name} · {(file.size / (1024 * 1024)).toFixed(2)} MB
                                                    </span>
                                                    {uploadError && (
                                                        <span className="text-destructive text-[10px] block mt-0.5">
                                                            {uploadError}
                                                        </span>
                                                    )}
                                                    {isUploading && (
                                                        <span className="text-muted-foreground text-[10px] block mt-0.5">
                                                            Uploading...
                                                        </span>
                                                    )}
                                                </div>
                                            </div>
                                            <Button
                                                type="button"
                                                variant="ghost"
                                                size="sm"
                                                className="h-6 text-xs text-destructive hover:text-destructive"
                                                onClick={() => handleFileRemove(field.id, index)}
                                                disabled={isUploading}
                                            >
                                                Remove
                                            </Button>
                                        </div>
                                    );
                                })}
                            </div>
                        )}
                        {fileError && (
                            <Alert variant="destructive">
                                <AlertDescription className="text-xs">{fileError}</AlertDescription>
                            </Alert>
                        )}
                        {field.helpText && fieldFiles.length === 0 && !fileError && (
                            <p className="text-xs text-muted-foreground">{field.helpText}</p>
                        )}
                    </div>
                );

            case 'slider':
                return (
                    <div key={field.id} className="space-y-2">
                        <Label>
                            {field.label} {field.required && <span className="text-destructive">*</span>}
                        </Label>
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
                    <div key={field.id} className="space-y-3">
                        <Label>
                            {field.label} {field.required && <span className="text-destructive">*</span>}
                        </Label>
                        {repeaterValue.map((item: any, index: number) => (
                            <Card key={index} className="p-4">
                                <div className="flex items-center justify-between mb-3">
                                    <Label className="text-xs font-medium">
                                        {index < repeaterMinItems ? `${field.label} ${index + 1}` : `Additional ${index - repeaterMinItems + 1}`}
                                        {index < repeaterMinItems && <span className="text-destructive ml-1">*</span>}
                                    </Label>
                                    {index >= repeaterMinItems && (
                                        <Button
                                            type="button"
                                            variant="ghost"
                                            size="icon"
                                            className="h-6 w-6"
                                            onClick={() => handleRemoveRepeaterItem(field.id, index, repeaterMinItems)}
                                            aria-label="Remove item"
                                        >
                                            <X className="h-4 w-4 text-destructive" />
                                        </Button>
                                    )}
                                </div>
                                <div className="space-y-3">
                                    {field.itemFields?.map((itemField) => (
                                        <div key={itemField.id} className="space-y-2">
                                            <Label htmlFor={`${field.id}-${index}-${itemField.id}`} className="text-sm">
                                                {itemField.label} {itemField.required && <span className="text-destructive">*</span>}
                                            </Label>
                                            {itemField.type === 'text' && (
                                                <Input
                                                    id={`${field.id}-${index}-${itemField.id}`}
                                                    type="text"
                                                    placeholder={itemField.placeholder}
                                                    value={item?.[itemField.id] || ''}
                                                    onChange={(e) => handleRepeaterItemChange(field.id, index, itemField.id, e.target.value)}
                                                    required={itemField.required}
                                                />
                                            )}
                                            {itemField.type === 'textarea' && (
                                                <Textarea
                                                    id={`${field.id}-${index}-${itemField.id}`}
                                                    placeholder={itemField.placeholder}
                                                    value={item?.[itemField.id] || ''}
                                                    onChange={(e) => handleRepeaterItemChange(field.id, index, itemField.id, e.target.value)}
                                                    rows={3}
                                                    required={itemField.required}
                                                />
                                            )}
                                            {itemField.type === 'select' && itemField.options && (
                                                <Select
                                                    value={item?.[itemField.id] || ''}
                                                    onValueChange={(v) => handleRepeaterItemChange(field.id, index, itemField.id, v)}
                                                >
                                                    <SelectTrigger id={`${field.id}-${index}-${itemField.id}`} className="w-full">
                                                        <SelectValue placeholder={itemField.placeholder || "Select"} />
                                                    </SelectTrigger>
                                                    <SelectContent className="z-[10000]">
                                                        {itemField.options.map((opt) => (
                                                            <SelectItem key={String(opt.value)} value={opt.value}>
                                                                {opt.label}
                                                            </SelectItem>
                                                        ))}
                                                    </SelectContent>
                                                </Select>
                                            )}
                                            {itemField.helpText && (
                                                <p className="text-xs text-muted-foreground">{itemField.helpText}</p>
                                            )}
                                        </div>
                                    ))}
                                </div>
                            </Card>
                        ))}
                        {(!repeaterMaxItems || repeaterValue.length < repeaterMaxItems) && (
                            <Button
                                type="button"
                                variant="outline"
                                size="sm"
                                onClick={() => handleAddRepeaterItem(field.id, repeaterMaxItems)}
                                className="w-full"
                            >
                                <Plus className="h-4 w-4 mr-2" />
                                Add {field.label}
                            </Button>
                        )}
                        {field.helpText && (
                            <p className="text-xs text-muted-foreground">{field.helpText}</p>
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
                <div className="pb-4 border-b">
                    {(config.title || config.description) && (
                        <div className="flex items-center justify-between ">
                            <div>
                                {config.title && (
                                    <h1 className="text-lg font-semibold">
                                        {config.title}
                                    </h1>
                                )}
                                {config.description && (
                                    <p className="text-xs text-muted-foreground">
                                        {config.description}
                                    </p>
                                )}
                            </div>
                        </div>
                    )}
                    <div className="flex items-center gap-2">
                        <Progress value={progress} className="flex-1" />
                        <span className="text-xs font-medium text-muted-foreground">
                            {progress}%
                        </span>
                    </div>
                </div>

                {/* Scrollable Form Content */}
                <div className="flex-1 overflow-y-auto">
                    <div className="space-y-4">
                        {config.sections.map((section) => {
                            const isExpanded = expandedSections[section.id] ?? (section.defaultExpanded ?? true);
                            const isCollapsible = section.isCollapsible ?? false;
                            const isOptional = section.isOptional ?? false;

                            return (
                                <Card key={section.id}>
                                    <CardHeader
                                        className={isCollapsible ? 'cursor-pointer' : ''}
                                        onClick={() => isCollapsible && toggleSection(section.id)}
                                    >
                                        <div className="flex items-center justify-between">
                                            <div className="flex-1">
                                                <div className="flex items-center gap-2">
                                                    <CardTitle className="text-lg">
                                                        {section.title}
                                                    </CardTitle>
                                                    {isOptional && (
                                                        <Badge variant="secondary">Optional</Badge>
                                                    )}
                                                </div>
                                                {section.description && (
                                                    <p className="text-xs mt-1 text-muted-foreground">
                                                        {section.description}
                                                    </p>
                                                )}
                                            </div>
                                            {isCollapsible && (
                                                <Button
                                                    type="button"
                                                    variant="ghost"
                                                    size="icon"
                                                    className="h-8 w-8"
                                                    onClick={(e) => {
                                                        e.stopPropagation();
                                                        toggleSection(section.id);
                                                    }}
                                                    aria-label={isExpanded ? "Collapse section" : "Expand section"}
                                                >
                                                    <ChevronDown
                                                        className={`h-4 w-4 transition-transform ${isExpanded ? 'rotate-180' : ''}`}
                                                    />
                                                </Button>
                                            )}
                                        </div>
                                    </CardHeader>
                                    {isExpanded && (
                                        <CardContent>
                                            <div className="space-y-3">
                                                {section.fields.map((field) => {
                                                    // Handle conditional field display using showIf
                                                    if (!shouldShowField(field)) {
                                                        return null;
                                                    }
                                                    return renderField(field);
                                                })}
                                            </div>
                                        </CardContent>
                                    )}
                                </Card>
                            );
                        })}
                    </div>
                </div>

                {/* Submit Button - Sticky at bottom */}
                <div className="border-t pt-2 pb-2 sticky bottom-0 bg-background">
                    <div className="flex flex-col gap-2">
                        {submitError && (
                            <Alert variant="destructive">
                                <AlertDescription>{submitError}</AlertDescription>
                            </Alert>
                        )}
                        {submitSuccess && (
                            <Alert>
                                <AlertDescription>Submission completed successfully!</AlertDescription>
                            </Alert>
                        )}

                        <Button
                            onClick={handleSubmit}
                            disabled={isSubmitting || Object.values(uploadingFiles).some((fieldUploading) =>
                                Object.values(fieldUploading).some((isUploading) => isUploading)
                            )}
                            className="w-full"
                            size="lg"
                        >
                            {isSubmitting ? (
                                <>
                                    <svg className="animate-spin h-4 w-4 mr-2" viewBox="0 0 24 24">
                                        <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" fill="none" />
                                        <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z" />
                                    </svg>
                                    <span>Submitting...</span>
                                </>
                            ) : (
                                <span>{config.submitButtonText}</span>
                            )}
                        </Button>
                        {!hideClearButton && (
                            <Button
                                variant="outline"
                                size="sm"
                                className="w-full"
                                onClick={() => setShowClearModal(true)}
                            >
                                Clear Form
                            </Button>
                        )}
                        {secondaryButton}
                    </div>
                </div>
            </div>
            <AlertDialog open={showClearModal} onOpenChange={setShowClearModal}>
                <AlertDialogContent>
                    <AlertDialogHeader>
                        <AlertDialogTitle>Confirm Clear Data</AlertDialogTitle>
                        <AlertDialogDescription>
                            Are you sure you want to clear all data? This action cannot be undone.
                        </AlertDialogDescription>
                    </AlertDialogHeader>
                    <AlertDialogFooter>
                        <AlertDialogCancel disabled={isFormClearing}>Cancel</AlertDialogCancel>
                        <AlertDialogAction
                            onClick={handleClearForm}
                            disabled={isFormClearing}
                            className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
                        >
                            {isFormClearing ? (
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
                            )}
                        </AlertDialogAction>
                    </AlertDialogFooter>
                </AlertDialogContent>
            </AlertDialog>
        </>
    );
});

BaseIntakeForm.displayName = "BaseIntakeForm";

export default BaseIntakeForm;
