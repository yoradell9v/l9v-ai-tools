import type { FormConfig } from "@/components/forms/configs/jdFormConfig";

export interface ValidationResult {
  isValid: boolean;
  errors: string[];
  warnings: string[];
  missingFields: string[];
}

/**
 * Validates extracted data against form configuration.
 * 
 * @param data - Extracted data to validate
 * @param formConfig - Form configuration with validation rules
 * @returns Validation result with errors, warnings, and missing fields
 */
export function validateExtractedData(
  data: Record<string, any>,
  formConfig: FormConfig
): ValidationResult {
  const errors: string[] = [];
  const warnings: string[] = [];
  const missingFields: string[] = [];

  formConfig.sections.forEach((section) => {
    section.fields.forEach((field) => {
      const value = data[field.id];

      // Check required fields
      if (field.required) {
        if (!value || (typeof value === "string" && !value.trim())) {
          missingFields.push(field.id);
          errors.push(`${field.label} is required`);
        }
      }

      // Check minItems for arrays
      if (field.type === "array" && field.minItems) {
        const arrayValue = Array.isArray(value) ? value : [];
        const filledItems = arrayValue.filter((item: string) => item?.trim()).length;
        if (filledItems < field.minItems) {
          errors.push(
            `${field.label} requires at least ${field.minItems} item${field.minItems === 1 ? "" : "s"}`
          );
          if (!missingFields.includes(field.id)) {
            missingFields.push(field.id);
          }
        }
      }

      // Check maxItems for arrays
      if (field.type === "array" && field.maxItems) {
        const arrayValue = Array.isArray(value) ? value : [];
        if (arrayValue.length > field.maxItems) {
          warnings.push(
            `${field.label} has more than ${field.maxItems} items (will be truncated)`
          );
        }
      }

      // Check validation patterns
      if (field.validation && value) {
        if (field.validation.pattern) {
          const regex = new RegExp(field.validation.pattern);
          if (!regex.test(String(value))) {
            errors.push(`${field.label} format is invalid`);
          }
        }
        if (field.validation.minLength && String(value).length < field.validation.minLength) {
          errors.push(
            `${field.label} is too short (min ${field.validation.minLength} characters)`
          );
        }
        if (field.validation.maxLength && String(value).length > field.validation.maxLength) {
          warnings.push(
            `${field.label} is too long (max ${field.validation.maxLength} characters)`
          );
        }
      }

      // Check conditional fields (showIf)
      if (field.showIf) {
        const conditionValue = data[field.showIf.field];
        if (conditionValue === field.showIf.value) {
          // Field should be shown, check if it's required
          if (field.required && (!value || (typeof value === "string" && !value.trim()))) {
            missingFields.push(field.id);
            errors.push(
              `${field.label} is required when ${field.showIf.field} is ${field.showIf.value}`
            );
          }
        }
      }

      // Type-specific validations
      if (value !== undefined && value !== null) {
        switch (field.type) {
          case "array":
            if (!Array.isArray(value)) {
              errors.push(`${field.label} must be an array`);
            }
            break;
          case "slider":
            if (typeof value !== "number" || value < 0 || value > 100) {
              errors.push(`${field.label} must be a number between 0 and 100`);
            }
            break;
          // Add other type validations as needed
        }
      }
    });
  });

  return {
    isValid: errors.length === 0,
    errors,
    warnings,
    missingFields,
  };
}
