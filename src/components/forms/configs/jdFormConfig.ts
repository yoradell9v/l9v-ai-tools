export type FieldType = 'text' | 'textarea' | 'select' | 'combobox' | 'array' | 'file' | 'slider' | 'repeater';

export interface FieldOption {
    label: string;
    value: string;
}

export interface FormField {
    id: string;
    label: string;
    type: FieldType;
    placeholder?: string;
    required?: boolean;
    options?: FieldOption[];
    minItems?: number; // For array and repeater fields
    maxItems?: number; // For array and repeater fields
    itemFields?: FormField[]; // For repeater fields - nested fields for each item
    showIf?: { field: string; value: string }; // Conditional field display
    helpText?: string;
    validation?: {
        pattern?: string;
        minLength?: number;
        maxLength?: number;
    };
    fileConfig?: {
        maxSize: number;
        allowedExtensions: string[];
        allowedMimeTypes: string[];
    };
}

export interface FormSection {
    id: string;
    title: string;
    description?: string;
    fields: FormField[];
    isOptional?: boolean;
    isCollapsible?: boolean;
    defaultExpanded?: boolean;
}

export interface FormConfig {
    storageKey: string;
    title?: string;
    description?: string;
    sections: FormSection[];
    defaultValues: Record<string, any>;
    submitButtonText: string;
    apiEndpoint?: string;
}

export const jdFormConfig: FormConfig = {
    storageKey: 'jd-form-data',
    title: 'Tell us more about your business',
    description: 'Fill out the details below to generate your job description',
    sections: [
        {
            id: 'company-info',
            title: 'Company Information',
            description: 'Company information will be pulled from your Organization Knowledge Base. You can override specific fields below if needed for this role.',
            fields: [
                {
                    id: 'businessName',
                    label: 'Company Name (Override)',
                    type: 'text',
                    placeholder: 'Leave empty to use organization name',
                    helpText: 'Optional: Override the company name from your Organization Knowledge Base for this specific role',
                },
            ],
        },
        {
            id: 'business-goals',
            title: 'Business Goals',
            description: 'Primary business goal will be pulled from your Organization Knowledge Base. Specify the 90-day outcome for this role.',
            fields: [
                {
                    id: 'businessGoal',
                    label: 'Primary Goal (Override)',
                    type: 'select',
                    helpText: 'Optional: Override the primary goal from your Organization Knowledge Base for this specific role',
                    options: [
                        { label: 'Use Organization Default', value: '__ORG_DEFAULT__' },
                        { label: 'Growth & Scale', value: 'Growth & Scale' },
                        { label: 'Efficiency & Optimization', value: 'Efficiency & Optimization' },
                        { label: 'Brand & Market Position', value: 'Brand & Market Position' },
                        { label: 'Customer Experience & Retention', value: 'Customer Experience & Retention' },
                        { label: 'Product & Innovation', value: 'Product & Innovation' },
                    ],
                },
                {
                    id: 'outcome90Day',
                    label: '90-Day Outcome',
                    type: 'textarea',
                    placeholder: 'What is the #1 result you want to achieve in 90 days?',
                    required: true,
                },
            ],
        },
        {
            id: 'key-tasks',
            title: 'Key Tasks',
            description: 'List the top 3 tasks or any additional tasks this role will handle',
            fields: [
                {
                    id: 'tasks',
                    label: 'Tasks',
                    type: 'array',
                    placeholder: 'e.g., Manage social media content',
                    required: true,
                    minItems: 3,
                },
            ],
        },
        {
            id: 'work-details',
            title: 'Work Details',
            description: 'Default timezone and weekly hours will be pulled from your Organization Knowledge Base. Override if needed for this specific role.',
            fields: [
                {
                    id: 'weeklyHours',
                    label: 'Weekly Hours',
                    type: 'select',
                    required: true,
                    helpText: 'Defaults to organization setting if not specified',
                    options: [
                        { label: '10 hrs/week', value: '10' },
                        { label: '20 hrs/week', value: '20' },
                        { label: '30 hrs/week', value: '30' },
                        { label: '40 hrs/week', value: '40' },
                    ],
                },
                {
                    id: 'clientFacing',
                    label: 'Client-Facing Role?',
                    type: 'select',
                    required: true,
                    options: [
                        { label: 'Yes', value: 'Yes' },
                        { label: 'No', value: 'No' },
                    ],
                },
            ],
        },
        {
            id: 'requirements',
            title: 'Requirements',
            description: 'Must-have skills and qualifications',
            fields: [
                {
                    id: 'requirements',
                    label: 'Requirements',
                    type: 'array',
                    placeholder: 'e.g., 2+ years experience in social media',
                    required: true,
                    minItems: 3,
                },
            ],
        },
        {
            id: 'tools-skills',
            title: 'Tools & Skills',
            description: 'Tool stack will be pulled from your Organization Knowledge Base. Specify role-specific tools or English level requirements if different.',
            fields: [
                {
                    id: 'tools',
                    label: 'Additional Tools (Role-Specific)',
                    type: 'textarea',
                    placeholder: 'e.g., Role-specific tools not in organization stack',
                    helpText: 'Optional: Add tools specific to this role. Organization tool stack will be included automatically.',
                },
                {
                    id: 'englishLevel',
                    label: 'English Level (Override)',
                    type: 'select',
                    helpText: 'Optional: Override organization default if this role requires different English proficiency',
                    options: [
                        { label: 'Use Organization Default', value: '__ORG_DEFAULT__' },
                        { label: 'Basic', value: 'Basic' },
                        { label: 'Good', value: 'Good' },
                        { label: 'Excellent', value: 'Excellent' },
                        { label: 'Near-native', value: 'Near-native' },
                    ],
                },
            ],
        },
        {
            id: 'additional-process',
            title: 'Additional Details - Process',
            description: 'Optional information to refine your job description',
            fields: [
                {
                    id: 'existingSOPs',
                    label: 'Existing SOPs?',
                    type: 'select',
                    options: [
                        { label: 'Yes', value: 'Yes' },
                        { label: 'No', value: 'No' },
                    ],
                },
                {
                    id: 'sopFile',
                    label: 'Drop or upload a file of your existing SOP',
                    type: 'file',
                    showIf: { field: 'existingSOPs', value: 'Yes' },
                    fileConfig: {
                        maxSize: 10 * 1024 * 1024, // 10MB
                        allowedExtensions: ['.pdf', '.doc', '.docx', '.txt'],
                        allowedMimeTypes: [
                            'application/pdf',
                            'application/msword',
                            'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
                            'text/plain',
                        ],
                    },
                    helpText: 'Supported file types: PDF, DOC, DOCX, TXT. Max size 10MB.',
                },
                {
                    id: 'reportingExpectations',
                    label: 'Reporting Expectations',
                    type: 'textarea',
                    placeholder: 'What does success look like weekly?',
                },
                {
                    id: 'managementStyle',
                    label: 'Management Style (Override)',
                    type: 'select',
                    helpText: 'Optional: Override organization default management style for this role',
                    options: [
                        { label: 'Use Organization Default', value: '__ORG_DEFAULT__' },
                        { label: 'Hands-on', value: 'Hands-on' },
                        { label: 'Async', value: 'Async' },
                        { label: 'Daily standup', value: 'Daily standup' },
                        { label: 'Weekly', value: 'Weekly' },
                    ],
                },
            ],
        },
        {
            id: 'additional-constraints',
            title: 'Additional Details - Constraints',
            description: 'Constraints and preferences',
            fields: [
                {
                    id: 'securityNeeds',
                    label: 'Security/Compliance Needs',
                    type: 'text',
                    placeholder: 'e.g., PII/PHI, finance access',
                },
                {
                    id: 'dealBreakers',
                    label: 'Deal Breakers',
                    type: 'textarea',
                    placeholder: 'Any absolute requirements or disqualifiers',
                },
                {
                    id: 'niceToHaveSkills',
                    label: 'Nice-to-Have Skills',
                    type: 'textarea',
                    placeholder: 'Secondary skills that would be a bonus',
                },
            ],
        },
    ],
    defaultValues: {
        businessName: '',
        businessGoal: '__ORG_DEFAULT__',
        tasks: ['', '', ''],
        outcome90Day: '',
        weeklyHours: '40',
        clientFacing: 'Yes',
        tools: '',
        englishLevel: '__ORG_DEFAULT__',
        requirements: ['', '', ''],
        existingSOPs: 'No',
        reportingExpectations: '',
        managementStyle: '__ORG_DEFAULT__',
        securityNeeds: '',
        dealBreakers: '',
        niceToHaveSkills: '',
    },
    submitButtonText: 'Generate Description',
    apiEndpoint: '/api/jd/analyze',
};

/**
 * Generates a dynamic form config based on whether Organization Knowledge Base exists
 * When KB is not set up, removes "__ORG_DEFAULT__" options and updates defaults
 */
export function getJDFormConfigWithKB(hasOrgKB: boolean): FormConfig {
    // Deep clone the config to avoid mutating the original
    const config: FormConfig = JSON.parse(JSON.stringify(jdFormConfig));

    if (!hasOrgKB) {
        // When KB doesn't exist, remove "__ORG_DEFAULT__" options and update defaults
        config.defaultValues.businessGoal = 'Growth & Scale';
        config.defaultValues.englishLevel = 'Excellent';
        config.defaultValues.managementStyle = 'Async';

        // Update sections to remove "__ORG_DEFAULT__" options and update descriptions
        config.sections.forEach((section) => {
            // Update section descriptions
            if (section.id === 'company-info') {
                section.description = 'Enter your company information for this role.';
            } else if (section.id === 'business-goals') {
                section.description = 'Specify the primary business goal and 90-day outcome for this role.';
            } else if (section.id === 'work-details') {
                section.description = 'Specify the weekly hours and work details for this role.';
            } else if (section.id === 'tools-skills') {
                section.description = 'Specify role-specific tools and English level requirements.';
            }

            // Update fields
            section.fields.forEach((field) => {
                if (field.options && field.id === 'businessGoal') {
                    field.options = field.options.filter(
                        (opt) => opt.value !== '__ORG_DEFAULT__'
                    );
                    // Update helpText to indicate KB is not set up
                    field.helpText = 'Select the primary goal for this role';
                    field.label = 'Primary Goal'; // Remove "(Override)" since there's no KB to override
                } else if (field.options && field.id === 'englishLevel') {
                    field.options = field.options.filter(
                        (opt) => opt.value !== '__ORG_DEFAULT__'
                    );
                    field.helpText = 'Select the English proficiency level required for this role';
                    field.label = 'English Level'; // Remove "(Override)"
                } else if (field.options && field.id === 'managementStyle') {
                    field.options = field.options.filter(
                        (opt) => opt.value !== '__ORG_DEFAULT__'
                    );
                    field.helpText = 'Select the management style for this role';
                    field.label = 'Management Style'; // Remove "(Override)")
                } else if (field.id === 'businessName') {
                    field.label = 'Company Name'; // Remove "(Override)"
                    field.helpText = 'Enter the company name for this role';
                }
            });
        });
    }

    return config;
}

