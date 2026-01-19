import path from "path";
import * as cheerio from "cheerio";
import { getDownloadPresignedUrl } from "@/lib/core/s3";
import OpenAI from "openai";

export interface ExtractionMetrics {
  inputTokens: number;
  outputTokens: number;
  estimatedCost: number;
  model: string;
}

export interface ExtractedFileContent {
  summary: string; 
  keyPoints: string[]; 
  importantSections?: string[]; 
  cleanedText?: string; 
  metadata: {
    fileName: string;
    fileType: string;
    size?: number;
    extractedAt: string;
    summarizedAt: string;
  };
  metrics?: ExtractionMetrics;
  error?: string;
}

export interface ExtractedWebsiteContent {
  sections: {
    hero?: { summary: string; keyPoints: string[] };
    about?: { summary: string; keyPoints: string[] };
    services?: { summary: string; keyPoints: string[] };
    companyInfo?: { summary: string; keyPoints: string[] };
    team?: { summary: string; keyPoints: string[] };
    values?: { summary: string; keyPoints: string[] };
    contact?: { summary: string; keyPoints: string[] };
  };
  overallSummary: string; // Overall page summary
  keyInsights: string[]; // Cross-section insights
  testimonials: string[]; // Testimonials (kept as-is)
  metadata: {
    title: string;
    description: string;
    extractedAt: string;
    summarizedAt: string;
    isSPA?: boolean; // Single Page Application detected
  };
  metrics?: ExtractionMetrics; // Token usage and cost tracking
  error?: string;
}

export interface FileExtractionInput {
  url: string;
  fileName: string;
  fileType?: string;
  s3Key?: string;
}

export interface BatchExtractionResult {
  files: {
    [fileName: string]: ExtractedFileContent;
  };
  urls: {
    [url: string]: ExtractedWebsiteContent;
  };
  errors: Array<{
    source: string;
    type: "file" | "url";
    error: string;
  }>;
  totalMetrics?: {
    totalInputTokens: number;
    totalOutputTokens: number;
    totalEstimatedCost: number;
  };
}

export type ProgressCallback = (
  completed: number,
  total: number,
  current: string
) => void;

const openai = new OpenAI({
  apiKey: process.env.OPENAI_API_KEY,
});

const AI_SUMMARIZATION_MODEL = "gpt-4o-mini";
const MAX_INPUT_LENGTH = 15000; 

const AI_RATE_LIMIT = {
  maxRequestsPerMinute: 60, 
  delayBetweenRequests: 1000,
};

let lastAIRequestTime = 0;
let requestCount = 0;

interface CacheEntry<T> {
  data: T;
  timestamp: number;
}

const extractionCache = new Map<
  string,
  CacheEntry<ExtractedWebsiteContent | ExtractedFileContent>
>();

const CACHE_TTL = 24 * 60 * 60 * 1000;

function getCacheKey(type: "file" | "url", identifier: string): string {
  return `${type}:${identifier}`;
}

const ALLOWED_FILE_EXTENSIONS = new Set([".pdf", ".doc", ".docx", ".txt"]);
const ALLOWED_MIME_TYPES = new Set([
  "application/pdf",
  "application/msword",
  "application/vnd.openxmlformats-officedocument.wordprocessingml.document",
  "text/plain",
]);

function getFileExtension(fileName?: string | null): string {
  if (!fileName) return "";
  return path.extname(fileName).toLowerCase();
}

function normalizeWhitespace(text: string): string {
  return text.replace(/\s+/g, " ").trim();
}


function cleanExtractedText(text: string): string {
  if (!text || text.trim().length === 0) return "";
  let cleaned = normalizeWhitespace(text);
  cleaned = cleaned.replace(/^\d+\s*$/gm, ""); 
  cleaned = cleaned.replace(/\n{3,}/g, "\n\n");

  const lines = cleaned.split("\n");
  const meaningfulLines = lines.filter(
    (line) => line.trim().length > 10 || line.trim().length === 0
  );
  cleaned = meaningfulLines.join("\n");

  cleaned = normalizeWhitespace(cleaned);

  if (cleaned.length > MAX_INPUT_LENGTH) {
    cleaned = cleaned.substring(0, MAX_INPUT_LENGTH) + "...";
  }

  return cleaned.trim();
}

function cleanWebsiteText(text: string, maxLength: number = 2000): string {
  if (!text || text.trim().length === 0) return "";
  const cleaned = normalizeWhitespace(text);
  return cleaned.substring(0, maxLength).trim();
}

function estimateTokens(text: string): number {
  if (!text || text.length === 0) return 0;
  return Math.ceil(text.length / 4);
}

function calculateCost(
  inputTokens: number,
  outputTokens: number
): number {
  const inputCost = (inputTokens / 1_000_000) * 0.15;
  const outputCost = (outputTokens / 1_000_000) * 0.6;
  return inputCost + outputCost;
}


function shouldSummarize(text: string): boolean {
  if (!text || text.trim().length === 0) return false;

  if (text.length < 100) return false;

  const alphanumericRatio =
    (text.match(/[a-zA-Z0-9]/g) || []).length / text.length;
  if (alphanumericRatio < 0.5) return false;

  const uniqueChars = new Set(text).size;
  if (uniqueChars < 20) return false;

  return true;
}

async function rateLimitedAICall<T>(fn: () => Promise<T>): Promise<T> {
  const now = Date.now();

  if (now - lastAIRequestTime > 60000) {
    requestCount = 0;
  }

  if (requestCount >= AI_RATE_LIMIT.maxRequestsPerMinute) {
    const waitTime = 60000 - (now - lastAIRequestTime);
    if (waitTime > 0) {
      console.log(
        `Rate limit reached. Waiting ${Math.ceil(waitTime / 1000)}s...`
      );
      await new Promise((resolve) => setTimeout(resolve, waitTime));
      requestCount = 0;
    }
  }


  if (now - lastAIRequestTime < AI_RATE_LIMIT.delayBetweenRequests) {
    const delay =
      AI_RATE_LIMIT.delayBetweenRequests - (now - lastAIRequestTime);
    await new Promise((resolve) => setTimeout(resolve, delay));
  }

  lastAIRequestTime = Date.now();
  requestCount++;

  return fn();
}

async function retryAICall<T>(
  fn: () => Promise<T>,
  maxRetries = 3,
  delay = 1000
): Promise<T> {
  for (let i = 0; i < maxRetries; i++) {
    try {
      return await fn();
    } catch (error: any) {
      if (
        error?.status === 400 ||
        error?.status === 401 ||
        error?.status === 403
      ) {
        throw error;
      }

      if (i === maxRetries - 1) throw error;
      const backoffDelay = delay * Math.pow(2, i);
      console.warn(
        `AI call failed (attempt ${i + 1}/${maxRetries}). Retrying in ${backoffDelay}ms...`
      );
      await new Promise((resolve) => setTimeout(resolve, backoffDelay));
    }
  }
  throw new Error("Max retries exceeded");
}

function validateFileType(fileName: string, mimeType?: string): boolean {
  const extension = getFileExtension(fileName);
  const extensionAllowed = extension
    ? ALLOWED_FILE_EXTENSIONS.has(extension)
    : false;
  const mimeAllowed = mimeType ? ALLOWED_MIME_TYPES.has(mimeType) : false;
  return extensionAllowed || mimeAllowed;
}

// Use centralized S3 utility instead of generating presigned URL manually
async function generateGetPresignedUrl(s3Key: string): Promise<string> {
  return await getDownloadPresignedUrl(s3Key, 300);
}

async function extractTextFromPdfBuffer(buffer: Buffer): Promise<string> {
  try {
    const pdfjsLib = await import("pdfjs-dist/legacy/build/pdf.mjs");

    if (typeof window === "undefined") {
      pdfjsLib.GlobalWorkerOptions.workerSrc =
        "pdfjs-dist/legacy/build/pdf.worker.mjs";
    }

    const loadingTask = pdfjsLib.getDocument({
      data: new Uint8Array(buffer),
      useSystemFonts: true,
      verbosity: 0,
      useWorkerFetch: false,
      isEvalSupported: false,
      maxImageSize: 1024 * 1024,
    });

    const pdf = await loadingTask.promise;
    const numPages = pdf.numPages;

    let fullText = "";
    for (let pageNum = 1; pageNum <= numPages; pageNum++) {
      const page = await pdf.getPage(pageNum);
      const textContent = await page.getTextContent();

      const pageText = textContent.items.map((item: any) => item.str).join(" ");

      fullText += pageText;

      if (pageNum < numPages) {
        fullText += "\n";
      }
    }

    if (!fullText || fullText.trim().length === 0) {
      throw new Error("PDF parsing returned no text content");
    }

    return fullText.trim();
  } catch (error: any) {
    console.error("PDF extraction error:", error);

    if (error.name === "PasswordException") {
      throw new Error("PDF is password-protected and cannot be parsed");
    } else if (error.name === "InvalidPDFException") {
      throw new Error("Invalid or corrupted PDF file");
    } else if (error.message) {
      throw new Error(`Failed to parse PDF: ${error.message}`);
    } else {
      throw new Error("Failed to parse PDF: Unknown error");
    }
  }
}

async function extractTextFromDocx(buffer: Buffer): Promise<string> {
  const mammoth = await import("mammoth");
  const result = await mammoth.extractRawText({ buffer });
  if (!result || !result.value) {
    throw new Error("DOCX parsing returned no text content");
  }
  return normalizeWhitespace(result.value);
}

async function extractTextFromDoc(buffer: Buffer): Promise<string> {
  const WordExtractor = (await import("word-extractor")).default;
  const extractor = new WordExtractor();
  const doc = await extractor.extract(buffer);
  const text =
    typeof doc?.getBody === "function" ? doc.getBody() : String(doc ?? "");
  if (!text) {
    throw new Error("DOC parsing returned no text content");
  }
  return normalizeWhitespace(text);
}

async function extractTextFromFileUrl(
  fileUrl: string,
  fileName: string,
  mimeType?: string,
  s3Key?: string
): Promise<string> {
  if (
    !fileUrl ||
    (!fileUrl.startsWith("http://") && !fileUrl.startsWith("https://"))
  ) {
    throw new Error(
      `Invalid URL format. Expected HTTP/HTTPS URL, got: ${fileUrl}`
    );
  }

  if (!validateFileType(fileName, mimeType)) {
    throw new Error(
      `Unsupported file type. Allowed types: PDF, DOC, DOCX, TXT.`
    );
  }

  let fetchUrl = fileUrl;
  if (s3Key) {
    try {
      fetchUrl = await generateGetPresignedUrl(s3Key);
    } catch (presignError) {
      console.warn(
        "Failed to generate GET presigned URL, falling back to provided URL:",
        presignError
      );
    }
  }

  const response = await fetch(fetchUrl, {
    credentials: "omit",
  });

  if (!response.ok) {
    throw new Error(
      `Failed to fetch file: ${response.status} ${response.statusText}`
    );
  }

  const arrayBuffer = await response.arrayBuffer();
  const buffer = Buffer.from(arrayBuffer);
  const extension = getFileExtension(fileName);

  if (extension === ".pdf" || mimeType === "application/pdf") {
    return await extractTextFromPdfBuffer(buffer);
  }

  if (
    extension === ".docx" ||
    mimeType ===
      "application/vnd.openxmlformats-officedocument.wordprocessingml.document"
  ) {
    return await extractTextFromDocx(buffer);
  }

  if (extension === ".doc" || mimeType === "application/msword") {
    return await extractTextFromDoc(buffer);
  }

  if (extension === ".txt" || mimeType === "text/plain") {
    const text = buffer.toString("utf-8");
    if (!text || text.trim().length === 0) {
      throw new Error("Text file is empty");
    }
    return normalizeWhitespace(text);
  }

  throw new Error(`Unsupported file type: ${extension || mimeType}`);
}

function extractHeroSection($: cheerio.CheerioAPI): string {
  const selectors = [
    "section.hero",
    "section[class*='hero']",
    "div.hero",
    "div[class*='hero']",
    "header .hero",
    ".hero-section",
    "h1",
  ];

  for (const selector of selectors) {
    const element = $(selector).first();
    if (element.length > 0) {
      const text = element.text().trim();
      if (text.length > 20) {
        return text.substring(0, 500);
      }
    }
  }

  const h1 = $("h1").first();
  if (h1.length > 0) {
    return h1.text().trim().substring(0, 500);
  }

  return "";
}

function extractAboutSection($: cheerio.CheerioAPI): string {
  const selectors = [
    "section.about",
    "section[class*='about']",
    "section#about",
    "div.about",
    "div[class*='about']",
    "div#about",
    "[data-section='about']",
  ];

  for (const selector of selectors) {
    const element = $(selector).first();
    if (element.length > 0) {
      const text = element.text().trim();
      if (text.length > 50) {
        return text.substring(0, 2000);
      }
    }
  }

  return "";
}

function extractServicesSection($: cheerio.CheerioAPI): string {
  const selectors = [
    "section.services",
    "section[class*='service']",
    "section#services",
    "div.services",
    "div[class*='service']",
    "div#services",
    "[data-section='services']",
  ];

  for (const selector of selectors) {
    const element = $(selector).first();
    if (element.length > 0) {
      const text = element.text().trim();
      if (text.length > 50) {
        return text.substring(0, 2000);
      }
    }
  }

  return "";
}

function extractTestimonials($: cheerio.CheerioAPI): string[] {
  const testimonials: string[] = [];

  const selectors = [
    "blockquote",
    ".testimonial",
    "[class*='testimonial']",
    ".review",
    "[class*='review']",
    ".quote",
    "[class*='quote']",
  ];

  for (const selector of selectors) {
    $(selector).each((_, element) => {
      const text = $(element).text().trim();
      if (text.length > 20 && text.length < 500) {
        testimonials.push(text);
      }
    });
  }

  return [...new Set(testimonials)].slice(0, 10);
}

function extractBodyText(
  $: cheerio.CheerioAPI,
  options: { maxLength: number }
): string {
  $("script, style, noscript").remove();

  const body = $("body");
  if (body.length > 0) {
    let text = body.text();
    text = normalizeWhitespace(text);
    return text.substring(0, options.maxLength);
  }

  return "";
}

function extractMetadata($: cheerio.CheerioAPI): {
  title: string;
  description: string;
} {
  const title =
    $("title").text().trim() ||
    $('meta[property="og:title"]').attr("content") ||
    "";

  const description =
    $('meta[name="description"]').attr("content") ||
    $('meta[property="og:description"]').attr("content") ||
    "";

  return { title, description };
}

function extractCompanyInfo($: cheerio.CheerioAPI): string {
  const selectors = [
    "section.company",
    "section[class*='company']",
    "section#company",
    ".company-info",
    "[data-section='company']",
    ".mission",
    ".vision",
  ];

  let combinedText = "";

  for (const selector of selectors) {
    const element = $(selector).first();
    if (element.length > 0) {
      const text = element.text().trim();
      if (text.length > 50) {
        combinedText += text.substring(0, 1000) + " ";
      }
    }
  }

  const mission = $(".mission, [class*='mission']").first().text().trim();
  const vision = $(".vision, [class*='vision']").first().text().trim();

  if (mission) combinedText += `Mission: ${mission.substring(0, 500)} `;
  if (vision) combinedText += `Vision: ${vision.substring(0, 500)} `;

  return normalizeWhitespace(combinedText).substring(0, 2000);
}

function extractTeamSection($: cheerio.CheerioAPI): string {
  const selectors = [
    "section.team",
    "section[class*='team']",
    "section#team",
    ".team-section",
    "[data-section='team']",
  ];

  for (const selector of selectors) {
    const element = $(selector).first();
    if (element.length > 0) {
      const text = element.text().trim();
      if (text.length > 50) {
        return text.substring(0, 2000);
      }
    }
  }

  return "";
}

function extractValuesSection($: cheerio.CheerioAPI): string {
  const selectors = [
    "section.values",
    "section[class*='value']",
    "section#values",
    ".values-section",
    "[data-section='values']",
    ".culture",
    "[class*='culture']",
  ];

  let combinedText = "";

  for (const selector of selectors) {
    const element = $(selector).first();
    if (element.length > 0) {
      const text = element.text().trim();
      if (text.length > 50) {
        combinedText += text.substring(0, 1000) + " ";
      }
    }
  }

  return normalizeWhitespace(combinedText).substring(0, 2000);
}

function extractContactInfo($: cheerio.CheerioAPI): string {
  const contactSelectors = [
    "section.contact",
    "section[class*='contact']",
    "section#contact",
    ".contact-section",
    "[data-section='contact']",
  ];

  let contactText = "";

  for (const selector of contactSelectors) {
    const element = $(selector).first();
    if (element.length > 0) {
      const text = element.text().trim();
      if (text.length > 20) {
        contactText += text.substring(0, 500) + " ";
      }
    }
  }

  const emailRegex = /[a-zA-Z0-9._%+-]+@[a-zA-Z0-9.-]+\.[a-zA-Z]{2,}/g;
  const emails = $("body").text().match(emailRegex);
  if (emails) {
    contactText += `Emails: ${emails.slice(0, 3).join(", ")} `;
  }

  const phoneRegex = /[\+]?[(]?[0-9]{3}[)]?[-\s\.]?[0-9]{3}[-\s\.]?[0-9]{4,6}/g;
  const phones = $("body").text().match(phoneRegex);
  if (phones) {
    contactText += `Phones: ${phones.slice(0, 2).join(", ")} `;
  }

  return normalizeWhitespace(contactText).substring(0, 1000);
}

interface FileSummaryResult {
  summary: string;
  keyPoints: string[];
  importantSections?: string[];
}

interface WebsiteSummaryResult {
  sections: {
    [sectionName: string]: {
      summary: string;
      keyPoints: string[];
    };
  };
  overallSummary: string;
  keyInsights: string[];
}

async function summarizeFileContent(
  cleanedText: string,
  fileName: string
): Promise<FileSummaryResult & { metrics?: ExtractionMetrics }> {
  if (!cleanedText || cleanedText.trim().length === 0) {
    return {
      summary: "",
      keyPoints: [],
      importantSections: [],
    };
  }

  // Quality check - skip AI if content is too low quality
  if (!shouldSummarize(cleanedText)) {
    return {
      summary: cleanedText.substring(0, 200),
      keyPoints: [],
      importantSections: [],
    };
  }

  const prompt = `You are an expert content analyzer. Analyze and summarize the following document content.

DOCUMENT: ${fileName}
CONTENT:
${cleanedText}

Provide a comprehensive analysis in JSON format:
{
  "summary": "A 2-3 paragraph summary of the document's main content, purpose, and key information",
  "keyPoints": [
    "Key point 1 (specific and actionable)",
    "Key point 2",
    "Key point 3",
    "Up to 10 key points total"
  ],
  "importantSections": [
    "Section 1 name or topic",
    "Section 2 name or topic"
  ]
}

Focus on:
- Main purpose and content
- Actionable insights
- Important details that would be useful for understanding the organization
- Key facts, figures, or claims mentioned

Be specific and concise. Each key point should be a complete, standalone insight.`;

  const inputTokens = estimateTokens(prompt);

  try {
    const response = await retryAICall(() =>
      rateLimitedAICall(() =>
        openai.chat.completions.create({
          model: AI_SUMMARIZATION_MODEL,
          messages: [
            {
              role: "system",
              content:
                "You are an expert content analyzer. Always respond with valid JSON.",
            },
            { role: "user", content: prompt },
          ],
          response_format: { type: "json_object" },
          temperature: 0.3,
          max_tokens: 1000,
        })
      )
    );

    const rawResponse = response.choices[0].message.content || "{}";
    const summaryData = JSON.parse(rawResponse);

    const outputTokens = response.usage?.completion_tokens || 0;
    const totalInputTokens = response.usage?.prompt_tokens || inputTokens;
    const estimatedCost = calculateCost(totalInputTokens, outputTokens);

    return {
      summary: summaryData.summary || "",
      keyPoints: Array.isArray(summaryData.keyPoints)
        ? summaryData.keyPoints.slice(0, 10)
        : [],
      importantSections: Array.isArray(summaryData.importantSections)
        ? summaryData.importantSections.slice(0, 5)
        : [],
      metrics: {
        inputTokens: totalInputTokens,
        outputTokens,
        estimatedCost,
        model: AI_SUMMARIZATION_MODEL,
      },
    };
  } catch (error) {
    console.error(`Error summarizing file ${fileName}:`, error);
    // Return empty summary on error - fallback will use cleaned text
    return {
      summary: "",
      keyPoints: [],
      importantSections: [],
    };
  }
}

async function summarizeWebsiteContent(
  rawContent: {
    hero: string;
    about: string;
    services: string;
    companyInfo: string;
    team: string;
    values: string;
    contact: string;
    metadata: { title: string; description: string; isSPA?: boolean };
  }
): Promise<WebsiteSummaryResult & { metrics?: ExtractionMetrics }> {
  // Build context for AI
  const sectionsWithContent = [];
  if (rawContent.hero) sectionsWithContent.push(`HERO: ${rawContent.hero}`);
  if (rawContent.about) sectionsWithContent.push(`ABOUT: ${rawContent.about}`);
  if (rawContent.services)
    sectionsWithContent.push(`SERVICES: ${rawContent.services}`);
  if (rawContent.companyInfo)
    sectionsWithContent.push(`COMPANY INFO: ${rawContent.companyInfo}`);
  if (rawContent.team) sectionsWithContent.push(`TEAM: ${rawContent.team}`);
  if (rawContent.values) sectionsWithContent.push(`VALUES: ${rawContent.values}`);
  if (rawContent.contact)
    sectionsWithContent.push(`CONTACT: ${rawContent.contact}`);

  const contentText = sectionsWithContent.join("\n\n");

  if (!contentText || contentText.trim().length === 0) {
    return {
      sections: {},
      overallSummary: "",
      keyInsights: [],
    };
  }

  // Quality check - skip AI if content is too low quality
  if (!shouldSummarize(contentText)) {
    // Return basic summaries from raw content
    const basicSections: WebsiteSummaryResult["sections"] = {};
    if (rawContent.hero) {
      basicSections.hero = {
        summary: rawContent.hero.substring(0, 200),
        keyPoints: [],
      };
    }
    if (rawContent.about) {
      basicSections.about = {
        summary: rawContent.about.substring(0, 300),
        keyPoints: [],
      };
    }
    return {
      sections: basicSections,
      overallSummary: rawContent.metadata.description || "",
      keyInsights: [],
    };
  }

  const prompt = `You are an expert website content analyzer. Analyze and summarize the following website content.

WEBSITE METADATA:
Title: ${rawContent.metadata.title || "Not provided"}
Description: ${rawContent.metadata.description || "Not provided"}

WEBSITE CONTENT:
${contentText}

Provide a comprehensive analysis in JSON format:
{
  "sections": {
    "hero": {
      "summary": "Summary of hero section",
      "keyPoints": ["Key point 1", "Key point 2"]
    },
    "about": {
      "summary": "Summary of about section",
      "keyPoints": ["Key point 1", "Key point 2"]
    },
    "services": {
      "summary": "Summary of services section",
      "keyPoints": ["Key point 1", "Key point 2"]
    },
    "companyInfo": {
      "summary": "Summary of company info",
      "keyPoints": ["Key point 1", "Key point 2"]
    },
    "team": {
      "summary": "Summary of team section",
      "keyPoints": ["Key point 1", "Key point 2"]
    },
    "values": {
      "summary": "Summary of values section",
      "keyPoints": ["Key point 1", "Key point 2"]
    },
    "contact": {
      "summary": "Summary of contact section",
      "keyPoints": ["Key point 1", "Key point 2"]
    }
  },
  "overallSummary": "A 2-3 paragraph summary of the entire website, its purpose, and main value proposition",
  "keyInsights": [
    "Cross-section insight 1",
    "Cross-section insight 2",
    "Up to 10 key insights"
  ]
}

Only include sections that have actual content. Focus on:
- Main value proposition
- Key differentiators
- Important details about the business
- Actionable insights

Be specific and concise.`;

  const inputTokens = estimateTokens(prompt);

  try {
    const response = await retryAICall(() =>
      rateLimitedAICall(() =>
        openai.chat.completions.create({
          model: AI_SUMMARIZATION_MODEL,
          messages: [
            {
              role: "system",
              content:
                "You are an expert website content analyzer. Always respond with valid JSON.",
            },
            { role: "user", content: prompt },
          ],
          response_format: { type: "json_object" },
          temperature: 0.3,
          max_tokens: 2000,
        })
      )
    );

    const rawResponse = response.choices[0].message.content || "{}";
    const summaryData = JSON.parse(rawResponse);

    const outputTokens = response.usage?.completion_tokens || 0;
    const totalInputTokens = response.usage?.prompt_tokens || inputTokens;
    const estimatedCost = calculateCost(totalInputTokens, outputTokens);

    // Process sections - only include those with content
    const processedSections: WebsiteSummaryResult["sections"] = {};
    if (summaryData.sections) {
      for (const [sectionName, sectionData] of Object.entries(
        summaryData.sections
      )) {
        const section = sectionData as any;
        if (section && section.summary) {
          processedSections[sectionName] = {
            summary: section.summary || "",
            keyPoints: Array.isArray(section.keyPoints)
              ? section.keyPoints.slice(0, 5)
              : [],
          };
        }
      }
    }

    return {
      sections: processedSections,
      overallSummary: summaryData.overallSummary || "",
      keyInsights: Array.isArray(summaryData.keyInsights)
        ? summaryData.keyInsights.slice(0, 10)
        : [],
      metrics: {
        inputTokens: totalInputTokens,
        outputTokens,
        estimatedCost,
        model: AI_SUMMARIZATION_MODEL,
      },
    };
  } catch (error) {
    console.error("Error summarizing website content:", error);
    // Return empty summary on error
    return {
      sections: {},
      overallSummary: "",
      keyInsights: [],
    };
  }
}

export async function extractFromFile(
  fileUrl: string,
  fileName: string,
  fileType?: string,
  s3Key?: string,
  useCache = true
): Promise<ExtractedFileContent> {
  const cacheKey = getCacheKey("file", `${fileName}:${fileUrl}`);

  if (useCache) {
    const cached = extractionCache.get(cacheKey);
    if (cached && Date.now() - cached.timestamp < CACHE_TTL) {
      console.log(`Using cached extraction for file: ${fileName}`);
      return cached.data as ExtractedFileContent;
    }
  }
  const extractedAt = new Date().toISOString();
  let cleanedText = "";
  let extractionError: string | undefined;

  try {
    const rawText = await extractTextFromFileUrl(
      fileUrl,
      fileName,
      fileType,
      s3Key
    );
    cleanedText = cleanExtractedText(rawText);
  } catch (error) {
    const errorMessage =
      error instanceof Error ? error.message : "Unknown error";
    console.error(
      `Error extracting content from file ${fileName}:`,
      errorMessage
    );
    extractionError = errorMessage;
  }

  let summary = "";
  let keyPoints: string[] = [];
  let importantSections: string[] = [];
  let metrics: ExtractionMetrics | undefined;
  let summarizationError: string | undefined;

  if (cleanedText && cleanedText.trim().length > 0) {
    try {
      const summaryResult = await summarizeFileContent(cleanedText, fileName);
      summary = summaryResult.summary;
      keyPoints = summaryResult.keyPoints || [];
      importantSections = summaryResult.importantSections || [];
      metrics = summaryResult.metrics;
    } catch (error) {
      const errorMessage =
        error instanceof Error ? error.message : "Unknown error";
      console.error(
        `Error summarizing file ${fileName}:`,
        errorMessage
      );
      summarizationError = errorMessage;
      // Fallback: use cleaned text as summary if AI fails
      if (cleanedText.length > 500) {
        summary = cleanedText.substring(0, 500) + "...";
      } else {
        summary = cleanedText;
      }
    }
  }

  if (extractionError && !cleanedText) {
    const errorResult = {
      summary: "",
      keyPoints: [],
      importantSections: [],
      metadata: {
        fileName,
        fileType: fileType || getFileExtension(fileName),
        extractedAt,
        summarizedAt: new Date().toISOString(),
      },
      error: extractionError,
    };
    return errorResult;
  }

  const result: ExtractedFileContent = {
    summary,
    keyPoints,
    importantSections,
    cleanedText: summarizationError ? cleanedText : undefined,
    metadata: {
      fileName,
      fileType: fileType || getFileExtension(fileName),
      extractedAt,
      summarizedAt: new Date().toISOString(),
    },
    metrics,
    error: summarizationError || extractionError,
  };

  if (!result.error && useCache) {
    extractionCache.set(cacheKey, {
      data: result,
      timestamp: Date.now(),
    });
  }

  return result;
}

export async function extractFromUrl(
  url: string,
  useCache = true
): Promise<ExtractedWebsiteContent> {
  const cacheKey = getCacheKey("url", url);

  if (useCache) {
    const cached = extractionCache.get(cacheKey);
    if (cached && Date.now() - cached.timestamp < CACHE_TTL) {
      console.log(`Using cached extraction for URL: ${url}`);
      return cached.data as ExtractedWebsiteContent;
    }
  }
  const extractedAt = new Date().toISOString();
  let rawContent: {
    hero: string;
    about: string;
    services: string;
    companyInfo: string;
    team: string;
    values: string;
    contact: string;
    metadata: { title: string; description: string; isSPA?: boolean };
  } | null = null;
  let testimonials: string[] = [];
  let extractionError: string | undefined;

  try {
    const response = await fetch(url, {
      headers: {
        "User-Agent":
          "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36",
      },
    });

    if (!response.ok) {
      throw new Error(`Failed to fetch website: ${response.statusText}`);
    }

    const html = await response.text();
    const $ = cheerio.load(html);

    const hasReactRoot =
      html.includes('id="root"') || html.includes('id="__next"');
    const hasVueApp = html.includes('id="app"') && html.includes("v-");
    const hasAngular =
      html.includes("ng-app") || html.includes("ng-version");
    const isSPA = hasReactRoot || hasVueApp || hasAngular;

    if (isSPA) {
      console.warn(
        `${url} appears to be a SPA - content may be incomplete. Consider using a headless browser.`
      );
    }

    const baseMetadata = extractMetadata($);
    rawContent = {
      hero: cleanWebsiteText(extractHeroSection($)),
      about: cleanWebsiteText(extractAboutSection($)),
      services: cleanWebsiteText(extractServicesSection($)),
      companyInfo: cleanWebsiteText(extractCompanyInfo($)),
      team: cleanWebsiteText(extractTeamSection($)),
      values: cleanWebsiteText(extractValuesSection($)),
      contact: cleanWebsiteText(extractContactInfo($)),
      metadata: {
        title: baseMetadata.title,
        description: baseMetadata.description,
        isSPA,
      },
    };

    testimonials = extractTestimonials($);
  } catch (error) {
    const errorMessage =
      error instanceof Error ? error.message : "Unknown error";
    console.error(`Error extracting content from URL ${url}:`, errorMessage);
    extractionError = errorMessage;
  }

  let sections: ExtractedWebsiteContent["sections"] = {};
  let overallSummary = "";
  let keyInsights: string[] = [];
  let summarizationError: string | undefined;

  let metrics: ExtractionMetrics | undefined;

  if (rawContent) {
    try {
      const summaryResult = await summarizeWebsiteContent(rawContent);
      sections = summaryResult.sections;
      overallSummary = summaryResult.overallSummary;
      keyInsights = summaryResult.keyInsights || [];
      metrics = summaryResult.metrics;
    } catch (error) {
      const errorMessage =
        error instanceof Error ? error.message : "Unknown error";
      console.error(`Error summarizing website ${url}:`, errorMessage);
      summarizationError = errorMessage;

      if (rawContent.hero) {
        sections.hero = {
          summary: rawContent.hero.substring(0, 200),
          keyPoints: [],
        };
      }
      if (rawContent.about) {
        sections.about = {
          summary: rawContent.about.substring(0, 300),
          keyPoints: [],
        };
      }
      if (rawContent.services) {
        sections.services = {
          summary: rawContent.services.substring(0, 300),
          keyPoints: [],
        };
      }
      overallSummary = rawContent.metadata.description || "";
    }
  }

  if (extractionError && !rawContent) {
    return {
      sections: {},
      overallSummary: "",
      keyInsights: [],
      testimonials: [],
      metadata: {
        title: "",
        description: "",
        extractedAt,
        summarizedAt: new Date().toISOString(),
      },
      error: extractionError,
    };
  }

  const result: ExtractedWebsiteContent = {
    sections,
    overallSummary,
    keyInsights,
    testimonials,
    metadata: {
      title: rawContent?.metadata.title || "",
      description: rawContent?.metadata.description || "",
      extractedAt,
      summarizedAt: new Date().toISOString(),
      isSPA: rawContent?.metadata.isSPA,
    },
    metrics,
    error: summarizationError || extractionError,
  };

  if (!result.error && useCache) {
    extractionCache.set(cacheKey, {
      data: result,
      timestamp: Date.now(),
    });
  }

  return result;
}


export async function extractFromContentLinks(
  contentLinksText: string
): Promise<ExtractedWebsiteContent[]> {
  if (!contentLinksText || contentLinksText.trim() === "") {
    return [];
  }

  const urls = contentLinksText
    .split(/[,\n]/)
    .map((url) => url.trim())
    .filter((url) => {
      try {
        new URL(url);
        return url.startsWith("http://") || url.startsWith("https://");
      } catch {
        return false;
      }
    });

  const extractionPromises = urls.map((url) => extractFromUrl(url));
  return Promise.all(extractionPromises);
}


export async function extractFromMultiple(
  files: FileExtractionInput[] = [],
  urls: string[] = [],
  onProgress?: ProgressCallback
): Promise<BatchExtractionResult> {
  const result: BatchExtractionResult = {
    files: {},
    urls: {},
    errors: [],
  };

  const total = files.length + urls.length;
  let completed = 0;

  const filePromises = files.map(async (file) => {
    try {
      onProgress?.(completed, total, `Extracting ${file.fileName}...`);
      const extracted = await extractFromFile(
        file.url,
        file.fileName,
        file.fileType,
        file.s3Key
      );
      result.files[file.fileName] = extracted;
      completed++;
      onProgress?.(completed, total, `Completed ${file.fileName}`);
      if (extracted.error) {
        result.errors.push({
          source: file.fileName,
          type: "file",
          error: extracted.error,
        });
      }
    } catch (error) {
      const errorMessage =
        error instanceof Error ? error.message : "Unknown error";
      result.errors.push({
        source: file.fileName,
        type: "file",
        error: errorMessage,
      });
      result.files[file.fileName] = {
        summary: "",
        keyPoints: [],
        importantSections: [],
        metadata: {
          fileName: file.fileName,
          fileType: file.fileType || getFileExtension(file.fileName),
          extractedAt: new Date().toISOString(),
          summarizedAt: new Date().toISOString(),
        },
        error: errorMessage,
      };
      completed++;
      onProgress?.(completed, total, `Failed ${file.fileName}`);
    }
  });

  const urlPromises = urls.map(async (url) => {
    try {
      onProgress?.(completed, total, `Extracting ${url}...`);
      const extracted = await extractFromUrl(url);
      result.urls[url] = extracted;
      completed++;
      onProgress?.(completed, total, `Completed ${url}`);
      if (extracted.error) {
        result.errors.push({
          source: url,
          type: "url",
          error: extracted.error,
        });
      }
    } catch (error) {
      const errorMessage =
        error instanceof Error ? error.message : "Unknown error";
      result.errors.push({
        source: url,
        type: "url",
        error: errorMessage,
      });
      result.urls[url] = {
        sections: {},
        overallSummary: "",
        keyInsights: [],
        testimonials: [],
        metadata: {
          title: "",
          description: "",
          extractedAt: new Date().toISOString(),
          summarizedAt: new Date().toISOString(),
        },
        error: errorMessage,
      };
      completed++;
      onProgress?.(completed, total, `Failed ${url}`);
    }
  });

  await Promise.all([...filePromises, ...urlPromises]);

  let totalInputTokens = 0;
  let totalOutputTokens = 0;
  let totalEstimatedCost = 0;

  Object.values(result.files).forEach((file) => {
    if (file.metrics) {
      totalInputTokens += file.metrics.inputTokens;
      totalOutputTokens += file.metrics.outputTokens;
      totalEstimatedCost += file.metrics.estimatedCost;
    }
  });

  Object.values(result.urls).forEach((url) => {
    if (url.metrics) {
      totalInputTokens += url.metrics.inputTokens;
      totalOutputTokens += url.metrics.outputTokens;
      totalEstimatedCost += url.metrics.estimatedCost;
    }
  });

  if (totalInputTokens > 0 || totalOutputTokens > 0) {
    result.totalMetrics = {
      totalInputTokens,
      totalOutputTokens,
      totalEstimatedCost,
    };
  }

  onProgress?.(completed, total, "All extractions completed");

  return result;
}
