/**
 * Task Intelligence: seed data for TaskTemplate.
 * Templates are stored in the DB and seeded with a fixed number per category.
 */

export const TASK_TEMPLATE_CATEGORIES = [
  "Marketing",
  "Design",
  "Admin",
  "Content",
  "Development",
  "Video/Audio",
  "Automation",
  "Customer Support",
  "Social Media",
  "Analytics",
] as const;

/** Number of templates to seed per category */
export const TASK_TEMPLATES_PER_CATEGORY = 2;

export type TaskTemplateSeed = {
  title: string;
  category: string;
  description: string;
  keyConsiderations: string;
  subtasks: string[];
  deliverables: string[];
  qualityControlChecklist: string[];
};

export function getTaskTemplateSeeds(): TaskTemplateSeed[] {
  return [
    // --- Marketing (1) ---
    {
      title: "Execute Email Marketing Campaign for [PRODUCT/OFFER]",
      category: "Marketing",
      description:
        "Plan, create, and deploy an email marketing campaign to promote a product, service, or special offer. This includes list segmentation, email design, copywriting, A/B testing setup, and post-campaign analysis. Typically requested for product launches, seasonal promotions, or nurture sequences. The VA should understand email best practices, deliverability basics, and how to use the client's email marketing platform effectively.",
      keyConsiderations:
        "Ensure compliance with email regulations (CAN-SPAM, GDPR). Segment lists appropriately to improve relevance and engagement. Test emails across multiple email clients and devices before sending. Monitor deliverability metrics and avoid spam triggers.",
      subtasks: [
        "Define campaign goals, audience, and success metrics",
        "Segment email list based on criteria provided",
        "Draft email copy with compelling subject lines",
        "Design email template matching brand guidelines",
        "Set up A/B test variants if applicable",
        "Configure tracking and UTM parameters",
        "Send test emails and check rendering",
        "Schedule or send campaign at optimal time",
        "Monitor initial performance and deliverability",
        "Compile performance report with recommendations",
      ],
      deliverables: [
        "Campaign strategy brief with goals and KPIs",
        "Segmented email lists with recipient counts",
        "Final email copy and subject line variants",
        "Designed email template (mobile-responsive)",
        "A/B test setup confirmation if used",
        "Tracking and UTM parameter documentation",
        "Test email screenshots across clients",
        "Send confirmation with date and time",
        "Performance report (opens, clicks, conversions)",
        "Recommendations for future campaigns",
      ],
      qualityControlChecklist: [
        "Subject line is compelling and under 50 characters",
        "All links work and point to correct destinations",
        "Unsubscribe link is present and functional",
        "Email renders correctly on mobile and desktop",
        "No broken images or missing content",
        "Personalization tokens work correctly",
        "Spam score checked and acceptable",
        "List segmentation verified for accuracy",
        "Send time optimized for audience timezone",
        "Client approval obtained before sending",
      ],
    },
    {
      title: "Create and Launch Lead Magnet with Landing Page for [OFFER]",
      category: "Marketing",
      description:
        "Design and execute a lead magnet campaign: create a valuable lead magnet (e.g., checklist, template, mini-course), build a dedicated landing page, set up email capture and delivery automation, and promote it through chosen channels. Typically used for list building, product launches, or webinar registration. The VA should understand conversion-focused copy, landing page best practices, and integration between page, email, and CRM.",
      keyConsiderations:
        "Lead magnet must deliver clear value to justify the signup. Landing page should have a single clear CTA. Ensure mobile-responsive design and fast load times. Set up automated delivery so leads receive the asset immediately. Comply with privacy policies and consent capture.",
      subtasks: [
        "Define lead magnet concept and target audience",
        "Create lead magnet content or asset",
        "Write landing page copy (headline, benefits, CTA)",
        "Design or build landing page with form",
        "Set up email automation for delivery",
        "Configure tracking and conversion goals",
        "Add to email sequences if applicable",
        "Prepare promotion copy for social/email",
        "Launch and monitor initial conversions",
        "Report on conversion rate and quality",
      ],
      deliverables: [
        "Lead magnet asset (PDF, video, etc.)",
        "Landing page live and tested",
        "Email automation for instant delivery",
        "Tracking setup (form submissions, source)",
        "Promotion assets (social, email)",
        "Launch confirmation and link",
        "Conversion report with recommendations",
        "A/B test suggestions if applicable",
      ],
      qualityControlChecklist: [
        "Lead magnet delivers on promised value",
        "Landing page loads quickly and is mobile-friendly",
        "Form captures required fields only",
        "Auto-delivery email sends within minutes",
        "Thank-you page or redirect works",
        "Tracking fires correctly",
        "Privacy/consent language present",
        "Links and CTAs tested",
        "Client approval obtained before launch",
      ],
    },

    // --- Design (1) ---
    {
      title: "Design [MARKETING COLLATERAL] for [CAMPAIGN/PURPOSE]",
      category: "Design",
      description:
        "Create visual marketing materials such as social media graphics, infographics, presentations, brochures, or ads. This includes understanding the brief, developing concepts, creating designs in brand style, and delivering final files in required formats. Typically requested for campaigns, events, or ongoing brand content needs. The VA should be proficient in design tools and understand visual hierarchy, typography, and brand consistency.",
      keyConsiderations:
        "Adhere strictly to brand guidelines (colors, fonts, logos). Ensure designs are optimized for their intended platform or medium. Consider accessibility (contrast, readability). Obtain proper licensing for any stock images or fonts used.",
      subtasks: [
        "Review design brief and gather requirements",
        "Collect brand assets and guidelines",
        "Research design trends for the medium",
        "Create initial design concepts or mockups",
        "Present concepts to client for feedback",
        "Revise design based on feedback",
        "Finalize design with all required elements",
        "Prepare files in all requested formats",
        "Organize and label files clearly",
        "Deliver with usage guidelines if needed",
      ],
      deliverables: [
        "Initial design concepts (2-3 options)",
        "Final design in editable source format",
        "Export files in required formats (PNG, PDF, etc.)",
        "Web-optimized versions if applicable",
        "Print-ready files with bleed if for print",
        "Font and asset documentation",
        "Color codes and specifications",
        "Usage guidelines or template instructions",
        "Organized file folder with clear naming",
        "Design revision history if requested",
      ],
      qualityControlChecklist: [
        "Design follows brand guidelines accurately",
        "All text is spelled correctly and legible",
        "Images are high resolution and properly licensed",
        "Color contrast meets accessibility standards",
        "Design works at all required sizes",
        "Files are in correct formats and dimensions",
        "No placeholder text or images remain",
        "Client feedback incorporated fully",
        "Files are properly named and organized",
        "Final approval received from client",
      ],
    },
    {
      title: "Create Presentation Deck for [MEETING/PITCH/PROJECT]",
      category: "Design",
      description:
        "Design a professional presentation (e.g., PowerPoint, Google Slides, Keynote) for a specific purpose: investor pitch, sales deck, internal review, or webinar. Includes structure, copy, visuals, charts, and speaker notes. The VA should understand narrative flow, visual hierarchy, and the client's brand so the deck is both on-brand and persuasive.",
      keyConsiderations:
        "Match slide count and depth to audience and time available. Use consistent branding (colors, fonts, logo). Keep text minimal; let visuals support the story. Ensure charts and data are accurate and cited. Export in requested format and check compatibility with client's software.",
      subtasks: [
        "Clarify purpose, audience, and key messages",
        "Create outline and slide structure",
        "Draft copy for each slide",
        "Source or create visuals and graphics",
        "Build slides with consistent styling",
        "Add charts or data visualizations",
        "Write speaker notes if requested",
        "Review for flow and clarity",
        "Apply client feedback and finalize",
        "Export in required format(s)",
      ],
      deliverables: [
        "Presentation file (PPTX, etc.)",
        "PDF version for sharing",
        "Speaker notes document if applicable",
        "Source file for future edits",
        "Image/asset folder",
        "Brand-compliant design",
      ],
      qualityControlChecklist: [
        "All text proofread and accurate",
        "Charts and numbers match sources",
        "Brand guidelines followed",
        "No broken images or links",
        "Slides flow logically",
        "File opens in client's preferred tool",
        "Client sign-off obtained",
      ],
    },

    // --- Admin (1) ---
    {
      title: "Manage Calendar and Schedule [MEETINGS/APPOINTMENTS]",
      category: "Admin",
      description:
        "Coordinate and manage the client's calendar, including scheduling meetings, sending invitations, managing conflicts, and ensuring all participants are prepared. This includes booking video calls, coordinating across time zones, sending reminders, and rescheduling as needed. Typically requested by executives, consultants, or busy professionals who need calendar support. The VA should be detail-oriented and proactive in anticipating scheduling needs.",
      keyConsiderations:
        "Respect time zone differences and preferred meeting times. Build in buffer time between meetings. Confirm attendance before meetings. Maintain confidentiality of calendar contents and meeting purposes.",
      subtasks: [
        "Review calendar for conflicts and availability",
        "Coordinate with attendees to find suitable times",
        "Send calendar invitations with agenda and details",
        "Book video conferencing links if needed",
        "Add time zone information for global meetings",
        "Send reminder emails 24 hours before meetings",
        "Prepare briefing materials or agendas",
        "Handle reschedules and communicate changes",
        "Block focus time or prep time as requested",
        "Update recurring meetings and templates",
      ],
      deliverables: [
        "Updated calendar with all meetings scheduled",
        "Calendar invitations sent to all participants",
        "Video conferencing links for virtual meetings",
        "Meeting agendas or briefing documents",
        "Time zone conversion reference if needed",
        "Reminder confirmations sent",
        "Rescheduling confirmations if applicable",
        "Weekly calendar summary for client review",
        "Contact list for regular meeting attendees",
        "Calendar management process documentation",
      ],
      qualityControlChecklist: [
        "All meeting times confirmed with attendees",
        "No double-bookings or conflicts present",
        "Video links tested and working",
        "Invitations include all necessary information",
        "Time zones clearly indicated",
        "Reminders scheduled appropriately",
        "Client preferences honored (buffer time, etc.)",
        "Recurring meetings updated as needed",
        "Cancellations communicated promptly",
        "Calendar access and permissions verified",
      ],
    },
    {
      title: "Prepare Monthly Expense Report and Reconcile [ACCOUNTS]",
      category: "Admin",
      description:
        "Gather expense data from receipts, cards, and accounts; categorize spending; reconcile against budgets or statements; and produce a clear monthly expense report. May include coding to cost centers, flagging variances, and preparing summaries for leadership. Typically requested by small business owners or department heads. The VA should be detail-oriented and comfortable with spreadsheets and basic accounting concepts.",
      keyConsiderations:
        "Classify expenses consistently with client's chart of accounts or categories. Keep receipts and documentation organized. Respect confidentiality of financial data. Clarify approval workflows and deadlines. Flag unusual or duplicate transactions.",
      subtasks: [
        "Collect receipts and transaction exports",
        "Import or enter data into tracking sheet",
        "Categorize each expense correctly",
        "Reconcile against bank/credit statements",
        "Compare to budget if provided",
        "Flag variances or anomalies",
        "Draft summary and commentary",
        "Prepare report in requested format",
        "Archive supporting documents",
        "Submit for review by deadline",
      ],
      deliverables: [
        "Monthly expense report (spreadsheet or PDF)",
        "Categorized transaction list",
        "Reconciliation notes",
        "Variance or exception summary",
        "Organized receipt/attachment folder",
        "Recommendations if requested",
      ],
      qualityControlChecklist: [
        "All transactions accounted for",
        "Categories applied consistently",
        "Reconciliation balances",
        "No duplicate entries",
        "Confidentiality maintained",
        "Client approval process followed",
      ],
    },

    // --- Content (1) ---
    {
      title: "Write and Optimize Blog Post on [TOPIC]",
      category: "Content",
      description:
        "Research, write, and optimize a blog post on a specified topic. This includes keyword research, outline creation, writing engaging content, SEO optimization, adding internal/external links, and formatting for web. Typically requested as part of content marketing strategy to drive organic traffic and establish thought leadership. The VA should understand SEO basics, the client's target audience, and how to write compelling web content.",
      keyConsiderations:
        "Focus on providing genuine value to readers, not just keyword stuffing. Use proper heading hierarchy (H1, H2, H3). Include credible sources and data. Optimize meta description and title tag. Ensure content aligns with the client's brand voice and expertise.",
      subtasks: [
        "Conduct keyword research for the topic",
        "Research topic and gather credible sources",
        "Create detailed outline with headers",
        "Write engaging introduction and conclusion",
        "Develop body content with clear sections",
        "Add internal links to related content",
        "Include external links to authoritative sources",
        "Optimize for target keywords naturally",
        "Write SEO title and meta description",
        "Format content with images and proper styling",
      ],
      deliverables: [
        "Keyword research report with target terms",
        "Content outline with main points",
        "Complete blog post (800-2000 words)",
        "SEO-optimized title tag (under 60 characters)",
        "Meta description (under 160 characters)",
        "Suggested featured image or graphics",
        "Internal and external link recommendations",
        "Image alt text suggestions",
        "Content in CMS-ready format or HTML",
        "Performance tracking setup (if requested)",
      ],
      qualityControlChecklist: [
        "Content provides clear value to target audience",
        "Primary keyword used naturally throughout",
        "Heading hierarchy is logical and SEO-friendly",
        "All facts and statistics are sourced",
        "Internal links point to relevant content",
        "External links are credible and working",
        "No grammatical or spelling errors",
        "Meta title and description compelling",
        "Images have descriptive alt text",
        "Content matches brand voice and style",
      ],
    },
    {
      title: "Write and Send [NEWSLETTER/DIGEST] for [AUDIENCE]",
      category: "Content",
      description:
        "Plan, write, and send a regular newsletter or email digest. Includes topic selection, writing engaging copy, formatting for email, scheduling, and optional performance summary. Typically used for nurturing leads, staying top-of-mind with customers, or sharing updates. The VA should understand email copywriting, the client's voice, and the chosen email platform.",
      keyConsiderations:
        "Keep subject lines clear and engaging. Balance value (useful content) with promotion. Maintain consistent send cadence. Segment lists when relevant. Include unsubscribe and physical address for compliance.",
      subtasks: [
        "Confirm theme, CTA, and send date",
        "Draft subject line options",
        "Write headline and body copy",
        "Add links and CTAs",
        "Format in email builder",
        "Preview and test on devices",
        "Schedule or send at agreed time",
        "Monitor opens/clicks if requested",
        "Summarize performance for client",
      ],
      deliverables: [
        "Final copy (in platform or doc)",
        "Subject line(s) used",
        "Send confirmation and metrics",
        "Short performance summary",
      ],
      qualityControlChecklist: [
        "Subject line under 50 characters",
        "All links work",
        "Unsubscribe and address present",
        "Mobile preview checked",
        "Sent on schedule",
      ],
    },

    // --- Development (1) ---
    {
      title: "Build Custom [FEATURE/INTEGRATION] for [WEBSITE/APP]",
      category: "Development",
      description:
        "Develop a custom feature, functionality, or integration for a website or application. This could include contact forms, payment processing, API integrations, custom calculators, or database connections. Includes planning, coding, testing, and deployment. Typically requested when standard plugins or tools don't meet specific business needs. The VA should have coding skills and understand web development best practices.",
      keyConsiderations:
        "Write clean, well-commented code for future maintenance. Test thoroughly across browsers and devices. Follow security best practices, especially for forms and data handling. Document the implementation for the client or future developers.",
      subtasks: [
        "Gather detailed requirements and specifications",
        "Plan architecture and technical approach",
        "Set up development environment and version control",
        "Write code following best practices",
        "Implement error handling and validation",
        "Test functionality across browsers/devices",
        "Integrate with existing systems if applicable",
        "Write technical documentation",
        "Deploy to staging for client review",
        "Deploy to production after approval",
      ],
      deliverables: [
        "Technical specification document",
        "Source code with clear comments",
        "Version control repository access",
        "Working feature on staging environment",
        "Browser and device compatibility report",
        "Technical documentation for maintenance",
        "User guide if feature is client-facing",
        "Test results and QA report",
        "Production deployment confirmation",
        "Post-launch monitoring plan",
      ],
      qualityControlChecklist: [
        "Code follows best practices and standards",
        "All functions work as specified",
        "Error handling covers edge cases",
        "Security vulnerabilities addressed",
        "Works across major browsers",
        "Mobile responsive if applicable",
        "Load time is acceptable",
        "Documentation is complete and clear",
        "Client testing and approval completed",
        "Backup and rollback plan in place",
      ],
    },
    {
      title: "Set Up and Configure [TOOL/PLATFORM] for [PURPOSE]",
      category: "Development",
      description:
        "Install, configure, and optionally customize a software tool or platform (e.g., CMS, CRM, form builder, analytics) to meet the client's workflow. Includes account setup, integrations, permissions, and basic training or documentation. Requested when onboarding new tools or changing processes. The VA should be comfortable with SaaS admin panels and common integrations.",
      keyConsiderations:
        "Follow security best practices (strong passwords, minimal permissions). Document login and configuration for the client. Test core flows before handoff. Confirm data ownership and backup options.",
      subtasks: [
        "Confirm tool, plan, and requirements",
        "Create or access admin account",
        "Configure core settings and branding",
        "Set up users and permissions",
        "Connect integrations (email, CRM, etc.)",
        "Create templates or default content if needed",
        "Test main workflows",
        "Document setup and usage",
        "Hand off with training or walkthrough",
      ],
      deliverables: [
        "Configured tool ready for use",
        "Admin and user access documented",
        "Short setup/usage guide",
        "Integration checklist",
      ],
      qualityControlChecklist: [
        "All required settings completed",
        "Integrations tested",
        "Access and credentials documented securely",
        "Client can perform key tasks",
      ],
    },

    // --- Video/Audio (1) ---
    {
      title: "Edit [VIDEO/PODCAST] Episode for [SERIES/CHANNEL]",
      category: "Video/Audio",
      description:
        "Edit raw video or audio content into a polished final product ready for publishing. This includes cutting unnecessary sections, adding intro/outro, incorporating graphics or B-roll, color correction, sound mixing, and exporting in the required format. Typically requested for YouTube videos, podcasts, online courses, or marketing videos. The VA should be proficient with editing software and understand pacing, storytelling, and platform requirements.",
      keyConsiderations:
        "Maintain consistent audio levels throughout. Follow the client's style guide for intros, outros, and graphics. Export in the correct format and resolution for the destination platform. Keep project files organized for future revisions.",
      subtasks: [
        "Import and organize raw footage or audio files",
        "Review content and identify sections to cut",
        "Trim and arrange clips in logical sequence",
        "Add intro, outro, and transition elements",
        "Incorporate graphics, text overlays, or B-roll",
        "Color grade video or balance audio levels",
        "Add background music or sound effects",
        "Export in required format and resolution",
        "Upload to client's platform or storage",
        "Archive project files for future edits",
      ],
      deliverables: [
        "Edited video/audio in final format",
        "Thumbnail or cover art if requested",
        "Transcript or captions file if needed",
        "Multiple format exports if required",
        "Project file for future edits",
        "Asset folder with all media used",
        "Metadata (title, description, tags)",
        "Preview link for client approval",
        "Upload confirmation to platform",
        "Backup of final and project files",
      ],
      qualityControlChecklist: [
        "All cuts are smooth and intentional",
        "Audio levels consistent throughout",
        "No background noise or audio artifacts",
        "Video quality and resolution appropriate",
        "Branding elements match style guide",
        "Transitions are smooth and not distracting",
        "Text is legible and spell-checked",
        "Export settings match platform requirements",
        "Client approval obtained before publishing",
        "Files properly backed up and archived",
      ],
    },
    {
      title:
        "Create Short-Form Video Clips from [LONG-FORM CONTENT] for [PLATFORM]",
      category: "Video/Audio",
      description:
        "Identify highlight moments from a long-form video (webinar, podcast, interview) and edit them into short, platform-optimized clips for social (e.g., YouTube Shorts, Instagram Reels, TikTok). Includes selecting segments, adding captions, formatting for aspect ratio and length, and exporting. Typically requested for repurposing content and increasing reach. The VA should understand platform specs and hook-driven editing.",
      keyConsiderations:
        "Respect platform limits (length, aspect ratio, file size). Use captions for accessibility and sound-off viewing. Hook in the first few seconds. Credit or brand consistently. Check music and rights for reuse.",
      subtasks: [
        "Review full video and note timestamps",
        "Select 3–5 clip-worthy segments",
        "Edit each clip to length and ratio",
        "Add captions or subtitles",
        "Add intro/outro or branding",
        "Export in platform specs",
        "Upload or deliver files",
        "Provide suggested captions and hashtags",
      ],
      deliverables: [
        "Short-form clips (specified count)",
        "Caption/hashtag suggestions",
        "Source timestamps for reference",
      ],
      qualityControlChecklist: [
        "Length and ratio match platform",
        "Captions accurate and readable",
        "Audio levels consistent",
        "Branding present where agreed",
        "Files named and organized",
      ],
    },

    // --- Automation (1) ---
    {
      title: "Build [AUTOMATION WORKFLOW] Using [TOOL/PLATFORM]",
      category: "Automation",
      description:
        "Design and implement an automated workflow using tools like Zapier, Make, n8n, or custom scripts. This includes mapping the process, setting up triggers and actions, testing the flow, and documenting how it works. Typical workflows include lead capture to CRM, email notifications, data syncing, or social media scheduling. Requested when clients want to reduce manual work and improve efficiency. The VA should understand automation logic and the platforms involved.",
      keyConsiderations:
        "Map the entire workflow before building. Test with real data but in a safe environment. Set up error notifications so failures don't go unnoticed. Document the workflow clearly for troubleshooting and future updates.",
      subtasks: [
        "Map current manual process and pain points",
        "Identify trigger events and desired actions",
        "Choose appropriate automation platform",
        "Connect required apps and authenticate",
        "Build workflow with triggers and actions",
        "Add filters and conditional logic if needed",
        "Set up error handling and notifications",
        "Test workflow with sample data",
        "Monitor initial runs and fix issues",
        "Document workflow and provide training",
      ],
      deliverables: [
        "Workflow diagram or process map",
        "Configured automation in platform",
        "Test results showing successful runs",
        "Error handling and notification setup",
        "Documentation of how workflow works",
        "Troubleshooting guide for common issues",
        "Access credentials securely documented",
        "Training video or guide for client",
        "List of connected apps and permissions",
        "Maintenance and monitoring plan",
      ],
      qualityControlChecklist: [
        "Workflow triggers reliably on specified events",
        "All actions execute as intended",
        "Data maps correctly between systems",
        "Error notifications are working",
        "No duplicate or missed records",
        "Workflow handles edge cases appropriately",
        "Connected apps have proper permissions",
        "Documentation is clear and complete",
        "Client understands how to monitor",
        "Backup or manual process documented",
      ],
    },
    {
      title: "Sync Data Between [SOURCE] and [DESTINATION] with [TOOL]",
      category: "Automation",
      description:
        "Design and implement a one-way or two-way data sync between two systems (e.g., form to CRM, e-commerce to email, spreadsheet to database) using an automation tool or API. Includes mapping fields, handling duplicates, scheduling, and error handling. Requested when teams use multiple tools and need data to stay in sync. The VA should understand both systems and the chosen sync method.",
      keyConsiderations:
        "Define source of truth to avoid conflicts. Map fields accurately and handle missing data. Test with sample data first. Set up alerts for failed runs. Document sync logic and schedule.",
      subtasks: [
        "Document source and destination schemas",
        "Define field mappings and rules",
        "Choose sync method (native, Zapier, API)",
        "Build and test sync (staging if possible)",
        "Handle duplicates and edge cases",
        "Schedule or trigger sync",
        "Monitor first runs and fix issues",
        "Document and hand off to client",
      ],
      deliverables: [
        "Working sync configuration",
        "Field mapping document",
        "Error handling and alert setup",
        "Short runbook for client",
      ],
      qualityControlChecklist: [
        "Data flows correctly both ways (if applicable)",
        "No unintended overwrites",
        "Errors trigger notifications",
        "Client can verify data in destination",
      ],
    },

    // --- Customer Support (1) ---
    {
      title: "Manage Customer Support Inbox and Respond to [CHANNEL] Inquiries",
      category: "Customer Support",
      description:
        "Monitor and respond to customer inquiries via email, chat, or ticketing system. This includes triaging requests, providing solutions, escalating complex issues, and maintaining customer satisfaction. Requires understanding of the client's products/services, tone of voice, and support policies. Typically requested by businesses needing consistent, timely customer communication. The VA should be empathetic, solution-oriented, and detail-focused.",
      keyConsiderations:
        "Respond within promised SLA timeframes. Maintain a helpful and empathetic tone. Know when to escalate vs. resolve independently. Track common issues to identify patterns. Protect customer data and privacy at all times.",
      subtasks: [
        "Review and triage incoming support requests",
        "Categorize and prioritize tickets by urgency",
        "Research solutions using knowledge base",
        "Respond with clear, helpful answers",
        "Escalate complex issues to appropriate team",
        "Follow up on pending or unresolved tickets",
        "Update customer records in CRM",
        "Document new issues for knowledge base",
        "Track response times and satisfaction",
        "Report common issues and trends to client",
      ],
      deliverables: [
        "Responded to all tickets within SLA",
        "Resolution documentation for each ticket",
        "Escalation log for complex issues",
        "Updated CRM records for customers",
        "New knowledge base articles if needed",
        "Daily or weekly support metrics report",
        "Common issues summary for client",
        "Customer satisfaction ratings",
        "Follow-up confirmations on resolved issues",
        "Recommendations for process improvements",
      ],
      qualityControlChecklist: [
        "All responses are within SLA timeframes",
        "Tone is friendly, professional, and on-brand",
        "Solutions are accurate and complete",
        "Escalations include full context",
        "No customer data exposed inappropriately",
        "Ticket statuses are up to date",
        "Follow-ups completed as promised",
        "Knowledge base is current",
        "Satisfaction scores meet targets",
        "Client briefed on any critical issues",
      ],
    },
    {
      title:
        "Create and Update Help Center Articles and FAQ for [PRODUCT/SERVICE]",
      category: "Customer Support",
      description:
        "Research common customer questions, draft or update help center articles and FAQs, organize content for findability, and optionally add screenshots or short videos. Reduces repeat inquiries and improves self-service. The VA should understand the product/service and write in clear, customer-friendly language.",
      keyConsiderations:
        "Write for the customer's reading level. Use consistent formatting and navigation. Keep content current as product changes. Include search-friendly titles and keywords. Link between related articles.",
      subtasks: [
        "Audit existing articles and support tickets",
        "Identify gaps and new topics",
        "Draft or revise articles with steps and examples",
        "Add or update FAQ entries",
        "Insert screenshots or media",
        "Organize categories and internal links",
        "Publish and set visibility",
        "Share with support team for feedback",
      ],
      deliverables: [
        "New or updated help articles",
        "Updated FAQ section",
        "Content map or index",
        "Handoff notes for future updates",
      ],
      qualityControlChecklist: [
        "Steps are accurate and testable",
        "No broken links or images",
        "Tone matches brand",
        "Search and navigation work",
      ],
    },

    // --- Social Media (1) ---
    {
      title: "Manage [PLATFORM] Social Media Presence and Engagement",
      category: "Social Media",
      description:
        "Manage daily social media activities including posting content, engaging with followers, responding to comments and messages, and monitoring brand mentions. This includes content scheduling, community management, and performance tracking. Typically requested to maintain consistent social presence and build audience relationships. The VA should understand platform best practices, the client's brand voice, and how to handle various engagement scenarios.",
      keyConsiderations:
        "Post at optimal times for audience engagement. Respond to comments and messages promptly. Monitor for negative feedback or PR issues. Stay on-brand with all interactions. Track performance to inform content strategy.",
      subtasks: [
        "Schedule and publish approved content",
        "Monitor comments and mentions throughout day",
        "Respond to comments and direct messages",
        "Engage with relevant accounts and content",
        "Flag negative feedback or urgent issues",
        "Track engagement metrics daily",
        "Share user-generated content when appropriate",
        "Report trending topics or opportunities",
        "Update content calendar based on performance",
        "Compile weekly performance summary",
      ],
      deliverables: [
        "All scheduled posts published on time",
        "Response to all comments and messages",
        "Engagement activity log",
        "Escalation report for urgent issues",
        "User-generated content shares if applicable",
        "Daily engagement metrics",
        "Weekly performance report with insights",
        "Trending topics or opportunities identified",
        "Updated content calendar with learnings",
        "Recommendations for next week's content",
      ],
      qualityControlChecklist: [
        "All posts published at scheduled times",
        "No typos or broken links in posts",
        "Comments responded to within 24 hours",
        "Messages answered within SLA",
        "Negative feedback handled appropriately",
        "Brand voice maintained in all interactions",
        "Crisis situations escalated immediately",
        "Engagement metrics tracked accurately",
        "Performance trends identified",
        "Client kept informed of important interactions",
      ],
    },
    {
      title:
        "Create [MONTHLY/QUARTERLY] Social Media Content Calendar for [PLATFORMS]",
      category: "Social Media",
      description:
        "Plan a full content calendar for specified social platforms: themes, post types, copy, visual concepts, hashtags, and publish dates. Aligns with campaigns, product launches, or evergreen engagement. The VA should understand each platform's best practices and the client's brand voice and goals.",
      keyConsiderations:
        "Balance promotional and value-driven content. Respect platform algorithms and optimal posting times. Plan for holidays and key dates. Leave room for real-time or reactive posts. Ensure variety in format (image, video, carousel, etc.).",
      subtasks: [
        "Review goals, audience, and past performance",
        "Define content pillars and themes",
        "Draft post copy for each slot",
        "Suggest visual concepts or assets needed",
        "Assign dates and times per platform",
        "Add hashtags and CTAs",
        "Export calendar for client/scheduling tool",
        "Flag content that needs design or approval",
      ],
      deliverables: [
        "Content calendar (spreadsheet or tool)",
        "Post copy for all planned posts",
        "Hashtag and CTA list",
        "Asset request list for design team",
      ],
      qualityControlChecklist: [
        "No conflicting or duplicate themes",
        "Copy matches brand voice",
        "Dates and times are realistic",
        "Client can hand off to designer/scheduler",
      ],
    },

    // --- Analytics (1) ---
    {
      title: "Create [PERFORMANCE] Analytics Report and Dashboard",
      category: "Analytics",
      description:
        "Collect, analyze, and visualize data to create a comprehensive performance report or dashboard. This includes setting up tracking, pulling data from various sources, identifying trends, and presenting insights with recommendations. Typical use cases include website analytics, marketing campaign performance, sales metrics, or social media analytics. Requested when clients need data-driven insights to make decisions. The VA should be comfortable with analytics tools and data interpretation.",
      keyConsiderations:
        "Ensure data accuracy by verifying sources and calculation methods. Focus on actionable insights, not just raw numbers. Visualize data clearly for easy understanding. Protect sensitive business data. Set up recurring reports to track changes over time.",
      subtasks: [
        "Define key metrics and KPIs to track",
        "Set up or verify tracking implementation",
        "Connect data sources to reporting tool",
        "Pull data for specified time period",
        "Clean and validate data accuracy",
        "Calculate key metrics and trends",
        "Create visualizations (charts, graphs)",
        "Analyze patterns and identify insights",
        "Write summary with recommendations",
        "Deliver report and set up automated refresh",
      ],
      deliverables: [
        "KPI definition document",
        "Data source connection documentation",
        "Raw data export if requested",
        "Visual dashboard or report",
        "Key metrics summary",
        "Trend analysis with period comparisons",
        "Charts and graphs for key data points",
        "Written insights and recommendations",
        "Automated report setup if applicable",
        "Next steps and optimization suggestions",
      ],
      qualityControlChecklist: [
        "All data sources connected correctly",
        "Tracking verified for accuracy",
        "Calculations and formulas are correct",
        "Date ranges and filters applied properly",
        "Visualizations are clear and accurate",
        "Insights are data-driven and actionable",
        "No sensitive data exposed inappropriately",
        "Report format meets client preferences",
        "Automated refresh working if set up",
        "Client understands how to read and use report",
      ],
    },
    {
      title: "Set Up Conversion Tracking and Funnels for [WEBSITE/CAMPAIGN]",
      category: "Analytics",
      description:
        "Implement conversion tracking (e.g., Google Analytics 4, Meta Pixel, LinkedIn Insight Tag) and define key funnels (e.g., signup, purchase, lead). Includes tag installation, event configuration, funnel setup, and verification. Requested when launching new campaigns or sites, or when existing tracking is incomplete. The VA should be familiar with tag managers and analytics platforms.",
      keyConsiderations:
        "Use a tag manager (e.g., GTM) where possible for flexibility. Respect consent and privacy (cookie banners, consent mode). Test events in debug mode before going live. Document what is tracked and where for the client.",
      subtasks: [
        "Audit current tracking setup",
        "Define conversion events and funnels",
        "Create tags and triggers in tag manager",
        "Install or verify base tags (GA4, etc.)",
        "Configure conversion events",
        "Set up funnel steps in analytics",
        "Test in staging or with debug tools",
        "Document implementation for client",
        "Verify data in reports after launch",
      ],
      deliverables: [
        "Tracking implementation (tags/GTM)",
        "Conversion and funnel documentation",
        "Test/verification report",
        "Short guide for viewing in analytics",
      ],
      qualityControlChecklist: [
        "Key events fire correctly",
        "Funnels reflect actual user flow",
        "No duplicate or missing tags",
        "Privacy/consent considered",
        "Client can see data in dashboard",
      ],
    },
  ];
}
