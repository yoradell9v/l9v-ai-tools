export type FieldType = 'text' | 'textarea' | 'select' | 'array' | 'file' | 'slider' | 'repeater';

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
}

export interface FormConfig {
    storageKey: string;
    title: string;
    description: string;
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
            fields: [
                {
                    id: 'companyName',
                    label: 'Company Name',
                    type: 'text',
                    placeholder: 'Acme Inc.',
                    required: true,
                },
                {
                    id: 'website',
                    label: 'Website',
                    type: 'text',
                    placeholder: 'https://example.com or \'none yet\'',
                    helpText: 'Please enter a valid URL, or type \'none yet\' if you don\'t have a website.',
                    validation: {
                        pattern: 'https?://.*',
                    },
                },
            ],
        },
        {
            id: 'business-goals',
            title: 'Business Goals',
            fields: [
                {
                    id: 'businessGoal',
                    label: 'Primary Goal',
                    type: 'select',
                    required: true,
                    options: [
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
            fields: [
                {
                    id: 'weeklyHours',
                    label: 'Weekly Hours',
                    type: 'select',
                    required: true,
                    options: [
                        { label: '10 hrs/week', value: '10' },
                        { label: '20 hrs/week', value: '20' },
                        { label: '30 hrs/week', value: '30' },
                        { label: '40 hrs/week', value: '40' },
                    ],
                },
                {
                    id: 'timezone',
                    label: 'Timezone',
                    type: 'select',
                    required: true,
                    options: [
                        { label: 'EST (UTC-5)', value: 'EST' },
                        { label: 'CST (UTC-6)', value: 'CST' },
                        { label: 'MST (UTC-7)', value: 'MST' },
                        { label: 'PST (UTC-8)', value: 'PST' },
                        { label: 'GMT (UTC+0)', value: 'GMT' },
                        { label: 'CET (UTC+1)', value: 'CET' },
                        { label: 'IST (UTC+5:30)', value: 'IST' },
                        { label: 'SGT (UTC+8)', value: 'SGT' },
                        { label: 'AEST (UTC+10)', value: 'AEST' },
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
            fields: [
                {
                    id: 'tools',
                    label: 'Tools/Stack in Use',
                    type: 'textarea',
                    placeholder: 'e.g., GoHighLevel, Slack, ClickUp, Canva, WordPress, Notion, Zapier, HubSpot, Salesforce, Asana, Trello',
                    helpText: 'List the tools and technologies your team uses',
                },
                {
                    id: 'englishLevel',
                    label: 'English Level',
                    type: 'select',
                    options: [
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
                    label: 'Management Style',
                    type: 'select',
                    options: [
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
        companyName: '',
        website: '',
        businessGoal: 'Growth & Scale',
        tasks: ['', '', ''],
        outcome90Day: '',
        weeklyHours: '40',
        timezone: '',
        clientFacing: 'Yes',
        tools: '',
        englishLevel: 'Good',
        requirements: ['', '', ''],
        existingSOPs: 'No',
        reportingExpectations: '',
        managementStyle: 'Async',
        securityNeeds: '',
        dealBreakers: '',
        niceToHaveSkills: '',
    },
    submitButtonText: 'Generate Description',
    apiEndpoint: '/api/jd/analyze',
};

