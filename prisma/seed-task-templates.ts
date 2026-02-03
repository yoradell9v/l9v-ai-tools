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
export const TASK_TEMPLATES_PER_CATEGORY = 1;

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
  ];
}