import { NextResponse } from "next/server";
import { cookies } from "next/headers";
import OpenAI from "openai";
import { prisma } from "@/lib/prisma";
import { verifyAccessToken } from "@/lib/auth";
import { existsSync, readFileSync } from "fs";
import { join } from "path";
import * as cheerio from "cheerio";

import { mineDeepInsights } from "@/lib/analysis/mineInsights";
import {
  AnalysisContext,
  ComplianceMarkers,
  DocumentAnalysis,
  EnhancedContext,
  FormattingPatterns,
} from "@/lib/analysis/types";
import { generateBrandVoiceCard } from "@/lib/cards/brandVoice";
import { generatePositioningCard } from "@/lib/cards/positioning";
import { generateStyleRulesCard } from "@/lib/cards/styleRules";
import { generateComplianceCard } from "@/lib/cards/compliance";
import { generateGHLCard } from "@/lib/cards/ghl";

export const runtime = "nodejs";

/**
 * ENHANCED BUSINESS PROFILE ANALYSIS SYSTEM
 *
 * This route implements a multi-stage deep analysis architecture:
 *
 * PHASE 1: Deep Content Mining
 * - Extracts 30-50 specific, evidence-backed insights from all content sources
 * - Each insight must have specificity_score >= 7 (rejects generic observations)
 * - Includes exact quotes as evidence (not paraphrased)
 * - Cross-references insights to validate and identify contradictions
 *
 * PHASE 2: Context-Rich Card Generation
 * - Uses deep insights + full content samples (not truncated)
 * - Generates comprehensive, actionable guides (3000+ words for brand voice)
 * - Every rule backed by exact quotes from source material
 * - Confidence scores based on evidence quality
 *
 * Token Usage: 3-5x higher than previous version, justified by output quality
 * - Uses gpt-4o for complex analysis (deep insights, card generation)
 * - Uses gpt-4o-mini for simpler tasks (validation, pattern extraction)
 */

interface ExtractedContent {
  website: {
    hero: string;
    about: string;
    services: string;
    testimonials: string[];
    fullText: string;
    metadata: { title: string; description: string };
  };
  files: DocumentAnalysis[];
  contentLinks: Array<{
    url: string;
    hero: string;
    about: string;
    services: string;
    testimonials: string[];
    fullText: string;
    metadata: { title: string; description: string };
  }>;
}

function safeSplit(
  value: any,
  delimiter: RegExp | string = /,|\n|;/
): string[] {
  if (!value) return [];
  if (Array.isArray(value)) {
    return value.map((v) => String(v).trim()).filter(Boolean);
  }
  if (typeof value === "string") {
    return value
      .split(delimiter)
      .map((v) => v.trim())
      .filter(Boolean);
  }
  return [];
}

function inferComplianceRisk(
  businessType?: string,
  isRegulated?: string | boolean
): string {
  if (isRegulated === "yes" || isRegulated === true) return "HIGH";
  const type = (businessType || "").toLowerCase();
  if (
    type.includes("finance") ||
    type.includes("financial") ||
    type.includes("health") ||
    type.includes("medical") ||
    type.includes("insurance") ||
    type.includes("legal") ||
    type.includes("investment")
  ) {
    return "HIGH";
  }
  if (
    type.includes("coaching") ||
    type.includes("consulting") ||
    type.includes("marketing") ||
    type.includes("education")
  ) {
    return "MEDIUM";
  }
  return "LOW";
}

function buildEnhancedContext(
  intakeData: any = {},
  extractedContent: ExtractedContent
): EnhancedContext {
  const websiteSamples = extractedContent?.website || {
    hero: "",
    about: "",
    services: "",
  };

  const documentSamples =
    extractedContent?.files?.slice(0, 5).map((file) => ({
      source: file.name,
      content:
        file.sections?.[0]?.content?.substring(0, 500) ||
        file.sections?.map((s) => s.content).join(" ").substring(0, 500) ||
        "",
      formatting: file.formattingPatterns
        ? `Headings: ${file.formattingPatterns.headingStyles.join(", ")}; Bullets: ${file.formattingPatterns.listUsage.bulletPoints}; Numbered: ${file.formattingPatterns.listUsage.numberedLists}`
        : "Not detected",
    })) || [];

  const riskLevel = inferComplianceRisk(
    intakeData.businessType,
    intakeData.isRegulated
  );

  const contentLinkSamples = extractedContent?.contentLinks?.slice(0, 5).map((link) => ({
    url: link.url,
    hero: link.hero?.substring(0, 500) || "",
    about: link.about?.substring(0, 500) || "",
    fullText: link.fullText?.substring(0, 2000) || "",
    metadata: link.metadata,
  })) || [];

  return {
    brandVoice: {
      stylePreference: intakeData.brandVoiceStyle || "Balanced and clear",
      riskLevel: intakeData.riskBoldnessLevel || riskLevel,
      goodExamples: safeSplit(intakeData.voiceExamplesGood, /\n{2,}|\n|;/),
      avoidExamples: safeSplit(intakeData.voiceExamplesAvoid, /\n{2,}|\n|;/),
      exampleLinks: safeSplit(intakeData.contentLinks || intakeData.links || ""), // Keep raw URLs for reference
      exampleLinkContent: contentLinkSamples, // Include extracted content for analysis
    },
    positioning: {
      corePitch: intakeData.whatYouSell || "",
      targetAudience: intakeData.idealCustomer || "",
      mainObjection: intakeData.topObjection || "",
      coreOffer: intakeData.coreOffer || "",
      businessStage: intakeData.monthlyRevenue || "",
      uniqueContext: `${intakeData.businessType || ""} | ${intakeData.goal90Day || ""}`.trim(),
    },
    styleRules: {
      voiceStyle: intakeData.brandVoiceStyle || "",
      goodExamples: safeSplit(intakeData.voiceExamplesGood, /\n{2,}|\n|;/),
      avoidExamples: safeSplit(intakeData.voiceExamplesAvoid, /\n{2,}|\n|;/),
      websiteSamples: {
        hero: websiteSamples.hero || "",
        about: websiteSamples.about || "",
        services: websiteSamples.services || "",
      },
      documentSamples,
    },
    compliance: {
      isRegulated:
        intakeData.isRegulated === "yes" || intakeData.isRegulated === true,
      industryType: `${intakeData.regulatedIndustryType || ""} ${intakeData.businessType || ""}`.trim(),
      forbiddenWords: safeSplit(intakeData.forbiddenWords),
      requiredDisclaimers: safeSplit(
        intakeData.disclaimers,
        /\n{2,}|\n|;|,/
      ),
      proofAssets: intakeData.proofAssets || "",
      riskLevel,
    },
    ghlImplementation: {
      crmPlatform: intakeData.primaryCRM || "",
      customerJourney: intakeData.customerJourney || "",
      pipelineStages: intakeData.pipelineStages || "",
      bookingLink: intakeData.bookingLink || "",
      supportEmail: intakeData.supportEmail || "",
      emailSignoff: intakeData.emailSignoff || "",
      coreOffer: intakeData.coreOffer || "",
      goal90Day: intakeData.goal90Day || "",
    },
  };
}

interface CardValidation {
  isValid: boolean;
  missingElements: string[];
  qualityScore: number;
  warnings: string[];
}

function validateCard(card: any, cardType: string): CardValidation {
  const validation: CardValidation = {
    isValid: true,
    missingElements: [],
    qualityScore: 100,
    warnings: [],
  };

  if (!card) {
    return {
      isValid: false,
      missingElements: ["Card payload missing"],
      qualityScore: 0,
      warnings: ["Card not generated"],
    };
  }

  switch (cardType) {
    case "BRAND_VOICE_CARD":
      if (!card.metadata?.core_attributes?.length) {
        validation.missingElements.push("Core voice attributes");
        validation.qualityScore -= 20;
      }
      if (!card.metadata?.examples?.length) {
        validation.missingElements.push("Before/after examples");
        validation.qualityScore -= 15;
      }
      if ((card.description || "").length < 2000) {
        validation.warnings.push("Description seems too short (< 2000 chars)");
        validation.qualityScore -= 10;
      }
      break;
    case "COMPLIANCE_RULES":
      if (!card.metadata?.forbidden_words?.length) {
        validation.missingElements.push("Forbidden words list");
        validation.qualityScore -= 25;
      }
      if (!card.metadata?.disclaimers?.length) {
        validation.warnings.push("No disclaimers found");
        validation.qualityScore -= 10;
      }
      break;
    case "STYLE_RULES":
      if (!card.metadata?.rules?.length) {
        validation.missingElements.push("Formatting rules");
        validation.qualityScore -= 20;
      }
      break;
    case "POSITIONING_CARD":
      if (!card.metadata?.positioning_statement) {
        validation.missingElements.push("Positioning statement");
        validation.qualityScore -= 15;
      }
      break;
    case "GHL_IMPLEMENTATION_NOTES":
      if (!card.metadata?.workflows?.length && !card.metadata?.pipelines?.length) {
        validation.missingElements.push("Workflows/Pipelines");
        validation.qualityScore -= 15;
      }
      break;
  }

  validation.isValid = validation.qualityScore >= 60;
  return validation;
}

function calculateCardConfidence(
  card: any,
  context: EnhancedContext,
  sources: string[]
): number {
  let confidence = 40;

  const normalizedSources = (sources || []).map((s: any) => {
    if (typeof s === "string") return s;
    if (s && typeof s === "object") {
      if ((s as any).source) return String((s as any).source);
      return JSON.stringify(s);
    }
    return String(s ?? "");
  });
  const uniqueSources = new Set(
    normalizedSources.map((s: string) => s.split(":")[0])
  );
  confidence += Math.min(uniqueSources.size * 5, 20);

  const metadataKeys = card?.metadata ? Object.keys(card.metadata) : [];
  confidence += Math.min(metadataKeys.length * 3, 15);

  const attributions = card?.source_attribution?.length || 0;
  confidence += Math.min(attributions * 2, 15);

  const descriptionLength = card?.description?.length || 0;
  if (descriptionLength > 3000) confidence += 10;
  else if (descriptionLength > 2000) confidence += 5;

  if (context?.compliance?.isRegulated) confidence += 5;

  return Math.min(confidence, 100);
}

function extractUrlsFromContentLinks(contentLinks: string | undefined): string[] {
  if (!contentLinks || typeof contentLinks !== "string") {
    return [];
  }

  const urls = safeSplit(contentLinks, /,|\n|;/)
    .map((url) => url.trim())
    .filter((url) => {
      try {
        const parsed = new URL(url);
        return parsed.protocol === "http:" || parsed.protocol === "https:";
      } catch {
        return false;
      }
    });

  return urls;
}

async function extractContentLinkSemanticContent(url: string): Promise<{
  url: string;
  hero: string;
  about: string;
  services: string;
  testimonials: string[];
  fullText: string;
  metadata: { title: string; description: string };
}> {
  try {
    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), 30000);

    const response = await fetch(url, {
      headers: {
        "User-Agent":
          "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36",
      },
      signal: controller.signal,
    });

    clearTimeout(timeoutId);

    if (!response.ok) {
      throw new Error(`Failed to fetch content link: ${response.statusText}`);
    }

    const html = await response.text();
    
    if (!html || html.trim().length === 0) {
      throw new Error("Empty response from content link");
    }

    const $ = cheerio.load(html);

    const extracted = {
      url,
      hero: extractHeroSection($),
      about: extractAboutSection($),
      services: extractServicesSection($),
      testimonials: extractTestimonials($),
      fullText: extractBodyText($, { maxLength: 50000 }),
      metadata: extractMetadata($),
    };

    console.log(`[ContentLinks] Successfully extracted from ${url}: ${extracted.fullText.length} chars, ${extracted.testimonials.length} testimonials`);

    return extracted;
  } catch (error: any) {
    if (error.name === "AbortError") {
      console.error(`[ContentLinks] Timeout extracting content from ${url} (30s limit)`);
    } else {
      console.error(`[ContentLinks] Error extracting content from ${url}:`, error.message || error);
    }
    return {
      url,
      hero: "",
      about: "",
      services: "",
      testimonials: [],
      fullText: "",
      metadata: { title: "", description: "" },
    };
  }
}

async function intelligentContentExtraction(
  websiteUrl: string,
  files: Array<{ url: string; name: string; type?: string }>,
  contentLinks?: string
): Promise<ExtractedContent> {
  const websiteContent = await extractWebsiteSemanticContent(websiteUrl);
  console.log("Extracted Website Content:", websiteContent);

  const processedFiles = await Promise.all(
    files.map((file) => processFileWithChunking(file))
  );
  console.log("Processed Files:", processedFiles);

  const contentLinkUrls = extractUrlsFromContentLinks(contentLinks);
  console.log(`[ContentLinks] Found ${contentLinkUrls.length} URLs to process`);
  
  const urlsToProcess = contentLinkUrls.slice(0, 10);
  if (contentLinkUrls.length > 10) {
    console.log(`[ContentLinks] Limiting to first 10 URLs (${contentLinkUrls.length} total provided)`);
  }

  const processedContentLinks: Array<{
    url: string;
    hero: string;
    about: string;
    services: string;
    testimonials: string[];
    fullText: string;
    metadata: { title: string; description: string };
  }> = [];
  
  for (let i = 0; i < urlsToProcess.length; i += 3) {
    const batch = urlsToProcess.slice(i, i + 3);
    const batchResults = await Promise.all(
      batch.map((url) => extractContentLinkSemanticContent(url))
    );
    processedContentLinks.push(...batchResults);
  }

  const validContentLinks = processedContentLinks.filter(
    (content) => content.fullText.trim().length > 0
  );
  console.log(`[ContentLinks] Successfully extracted content from ${validContentLinks.length}/${urlsToProcess.length} URLs`);

  return {
    website: websiteContent,
    files: processedFiles,
    contentLinks: validContentLinks,
  };
}

async function extractWebsiteSemanticContent(url: string) {
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

    return {
      hero: extractHeroSection($),
      about: extractAboutSection($),
      services: extractServicesSection($),
      testimonials: extractTestimonials($),
      fullText: extractBodyText($, { maxLength: 50000 }),
      metadata: extractMetadata($),
    };
  } catch (error) {
    console.error("Error extracting website content:", error);
    return {
      hero: "",
      about: "",
      services: "",
      testimonials: [],
      fullText: "",
      metadata: { title: "", description: "" },
    };
  }
}

async function processFileWithChunking(file: {
  url: string;
  name: string;
  type?: string;
}) {
  try {
    const fullText = await extractFullFileText(file.url, file.name);

    if (!fullText || fullText.trim().length === 0) {
      return {
        name: file.name,
        type: "other" as const,
        sections: [],
        keyPhrases: [],
      };
    }

    const fileType = await classifyFileType(fullText, file.name);
    const sections = await extractSemanticSections(fullText, fileType);

    const keyPhrases = extractRepeatedPhrases(fullText);
    const formattingPatterns = analyzeFormattingPatterns(fullText);
    const complianceMarkers = extractComplianceMarkers(fullText);
    const voiceSamples = extractVoiceSamples(fullText);

    return {
      name: file.name,
      type: fileType,
      sections,
      keyPhrases,
      formattingPatterns,
      complianceMarkers,
      voiceSamples,
    };
  } catch (error) {
    console.error(`Error processing file ${file.name}:`, error);
    return {
      name: file.name,
      type: "other" as const,
      sections: [],
      keyPhrases: [],
      formattingPatterns: undefined,
      complianceMarkers: undefined,
      voiceSamples: [],
    };
  }
}


async function extractFullFileText(url: string, name: string): Promise<string> {
  try {
    if (url.startsWith("/") || url.startsWith("./") || url.startsWith("../")) {
      const filePath = url.startsWith("/")
        ? join(process.cwd(), "public", url)
        : join(process.cwd(), url);

      if (existsSync(filePath)) {
        const buffer = readFileSync(filePath);
        return await extractTextFromBuffer(buffer, name);
      }
    }

    const response = await fetch(url);
    if (!response.ok) {
      throw new Error(`Failed to fetch file: ${response.statusText}`);
    }

    const arrayBuffer = await response.arrayBuffer();
    const buffer = Buffer.from(arrayBuffer);

    return await extractTextFromBuffer(buffer, name);
  } catch (error) {
    console.error(`Error extracting text from ${name}:`, error);
    return "";
  }
}

async function extractTextFromPdfBuffer(buffer: Buffer, filename: string): Promise<string> {
  try {
    const pdfjsLib = await import("pdfjs-dist/legacy/build/pdf.mjs");
    
    if (typeof window === 'undefined') {
      pdfjsLib.GlobalWorkerOptions.workerSrc = 'pdfjs-dist/legacy/build/pdf.worker.mjs';
    }
    
    console.log(`[PDF Extraction] Loading PDF document: ${filename}, size: ${buffer.length} bytes`);
    
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
    
    console.log(`[PDF Extraction] PDF loaded successfully: ${filename}, pages: ${numPages}`);
    
    let fullText = '';
    for (let pageNum = 1; pageNum <= numPages; pageNum++) {
      try {
        const page = await pdf.getPage(pageNum);
        const textContent = await page.getTextContent();
        
        const pageText = textContent.items
          .map((item: any) => item.str)
          .join(' ');
        
        fullText += pageText;
        
        if (pageNum < numPages) {
          fullText += '\n';
        }
      } catch (pageError: any) {
        console.warn(`[PDF Extraction] Error extracting page ${pageNum} from ${filename}:`, pageError.message);
      }
    }
    
    if (!fullText || fullText.trim().length === 0) {
      throw new Error("PDF parsing returned no text content");
    }
    
    console.log(`[PDF Extraction] Successfully extracted text from ${filename}, length: ${fullText.length} characters`);
    return fullText.trim();
  } catch (error: any) {
    console.error(`[PDF Extraction] Error extracting text from PDF ${filename}:`, error);
    
    if (error.name === "PasswordException") {
      throw new Error(`PDF ${filename} is password-protected and cannot be parsed`);
    } else if (error.name === "InvalidPDFException") {
      throw new Error(`Invalid or corrupted PDF file: ${filename}`);
    } else if (error.message) {
      throw new Error(`Failed to parse PDF ${filename}: ${error.message}`);
    } else {
      throw new Error(`Failed to parse PDF ${filename}: Unknown error`);
    }
  }
}

async function extractTextFromBuffer(
  buffer: Buffer,
  filename: string
): Promise<string> {
  const extension = getFileExtension(filename);

  try {
    if (extension === ".pdf") {
      try {
        const text = await extractTextFromPdfBuffer(buffer, filename);
        return normalizeWhitespace(text);
      } catch (pdfError: any) {
        console.error(`[File Extraction] Error parsing PDF ${filename}:`, pdfError.message);
        return "";
      }
    }

    if (extension === ".docx") {
      try {
        const mammoth = await import("mammoth");
        const result = await mammoth.extractRawText({ buffer });
        if (!result || !result.value) {
          console.warn(`[File Extraction] DOCX ${filename} parsed but returned no text content`);
          return "";
        }
        const text = normalizeWhitespace(result.value);
        console.log(`[File Extraction] Successfully extracted text from DOCX ${filename}, length: ${text.length} characters`);
        return text;
      } catch (docxError: any) {
        console.error(`[File Extraction] Error parsing DOCX ${filename}:`, docxError.message);
        return "";
      }
    }

    if (extension === ".doc") {
      try {
        const WordExtractor = (await import("word-extractor")).default;
        const extractor = new WordExtractor();
        const doc = await extractor.extract(buffer);
        const text =
          typeof doc?.getBody === "function" ? doc.getBody() : String(doc ?? "");
        if (!text || text.trim().length === 0) {
          console.warn(`[File Extraction] DOC ${filename} parsed but returned no text content`);
          return "";
        }
        const normalizedText = normalizeWhitespace(text);
        console.log(`[File Extraction] Successfully extracted text from DOC ${filename}, length: ${normalizedText.length} characters`);
        return normalizedText;
      } catch (docError: any) {
        console.error(`[File Extraction] Error parsing DOC ${filename}:`, docError.message);
        return "";
      }
    }

    if (extension === ".txt") {
      try {
        const text = buffer.toString("utf-8");
        if (!text || text.trim().length === 0) {
          console.warn(`[File Extraction] TXT ${filename} is empty`);
          return "";
        }
        const normalizedText = normalizeWhitespace(text);
        console.log(`[File Extraction] Successfully extracted text from TXT ${filename}, length: ${normalizedText.length} characters`);
        return normalizedText;
      } catch (txtError: any) {
        console.error(`[File Extraction] Error parsing TXT ${filename}:`, txtError.message);
        return "";
      }
    }

    console.warn(`[File Extraction] Unsupported file type for ${filename}: ${extension || "unknown"}`);
    return "";
  } catch (error: any) {
    console.error(`[File Extraction] Unexpected error parsing ${filename}:`, error.message || error);
    return "";
  }
}

function getFileExtension(filename: string): string {
  return filename.substring(filename.lastIndexOf(".")).toLowerCase();
}

function normalizeWhitespace(text: string): string {
  return text.replace(/\s+/g, " ").trim();
}

async function classifyFileType(
  text: string,
  filename: string
): Promise<"brand_guide" | "style_guide" | "other"> {
  const lowerText = text.toLowerCase();
  const lowerFilename = filename.toLowerCase();

  // Check filename patterns
  if (
    lowerFilename.includes("brand") ||
    lowerFilename.includes("voice") ||
    lowerFilename.includes("tone")
  ) {
    return "brand_guide";
  }

  if (lowerFilename.includes("style") || lowerFilename.includes("guide")) {
    return "style_guide";
  }

  // Check content patterns
  if (
    lowerText.includes("brand voice") ||
    lowerText.includes("tone of voice") ||
    lowerText.includes("brand personality")
  ) {
    return "brand_guide";
  }

  if (
    lowerText.includes("style guide") ||
    lowerText.includes("design system") ||
    lowerText.includes("typography")
  ) {
    return "style_guide";
  }

  return "other";
}

async function extractSemanticSections(
  text: string,
  fileType: string
): Promise<{ title: string; content: string; importance: number }[]> {
  if (!text?.trim()) return [];

  const sections: { title: string; content: string; importance: number }[] = [];
  const lines = text.split("\n");
  let currentSection = { title: "Introduction", content: "", importance: 5 };

  const mdHeadingRegex = /^#{1,6}\s+(.+)$/;
  const headingPatterns = [
    /^[A-Z][A-Z\s]{2,}$/, 
    /^\d+\.\s+[A-Z]/, 
    /^[IVX]+\.\s+[A-Z]/, 
    /^(Chapter|Section|Part|Appendix)\s+\d+/i,
  ];

  const highImportance =
    /\b(critical|important|key|essential|required|must|warning|note|summary|conclusion)\b/i;
  const mediumImportance =
    /\b(background|overview|introduction|details|examples?)\b/i;

  for (let i = 0; i < lines.length; i++) {
    const line = lines[i];
    const trimmed = line.trim();

    if (!trimmed) {
      currentSection.content += line + "\n";
      continue;
    }

    let isHeading = false;
    let headingText = trimmed;
    let headingLevel = 0;

    const mdMatch = trimmed.match(mdHeadingRegex);
    if (mdMatch) {
      isHeading = true;
      headingText = mdMatch[1];
      headingLevel = trimmed.indexOf(" "); 
    }
    
    else if (
      trimmed.length >= 3 &&
      trimmed.length <= 100 &&
      headingPatterns.some((pattern) => pattern.test(trimmed))
    ) {
      isHeading = true;
      const nextLine = lines[i + 1]?.trim();
      if (
        !nextLine ||
        lines[i + 1]?.startsWith(" ") ||
        lines[i + 1]?.startsWith("\t")
      ) {
        isHeading = true;
      }
    }

    if (isHeading) {
      if (currentSection.content.trim().length > 50) {
        sections.push(currentSection);
      }
      let importance = 5;
      if (highImportance.test(headingText)) {
        importance = 8;
      } else if (mediumImportance.test(headingText)) {
        importance = 6;
      } else if (headingLevel > 0 && headingLevel <= 2) {
        importance = 7; // Top-level headings are more important
      }

      currentSection = {
        title: headingText,
        content: "",
        importance,
      };
    } else {
      currentSection.content += line + "\n";
    }
  }

  if (currentSection.content.trim().length > 50) {
    sections.push(currentSection);
  }

  if (sections.length === 0 && text.trim().length > 0) {
    const chunkSize = 5000;
    const chunks = Math.ceil(text.length / chunkSize);

    for (let i = 0; i < Math.min(chunks, 20); i++) {
      const start = i * chunkSize;
      const end = Math.min(start + chunkSize, text.length);
      sections.push({
        title: chunks > 1 ? `Content (Part ${i + 1})` : "Content",
        content: text.substring(start, end),
        importance: 5,
      });
    }
  }
  sections.forEach((section) => {
    const contentLower = section.content.toLowerCase();
    if (contentLower.includes("warning") || contentLower.includes("caution")) {
      section.importance = Math.max(section.importance, 7);
    }
    if (
      section.content.match(/^[\s]*[-*•]\s/m) ||
      section.content.match(/^\d+\./m)
    ) {
      section.importance = Math.min(section.importance + 1, 10);
    }
  });

  return sections.slice(0, 20);
}

function extractRepeatedPhrases(text: string): string[] {
  if (!text || text.length < 100) return [];

  const words = text.toLowerCase().match(/\b\w{4,}\b/g) || [];
  const phraseCounts: Record<string, number> = {};

  for (let i = 0; i < words.length - 1; i++) {
    const phrase = `${words[i]} ${words[i + 1]}`;
    phraseCounts[phrase] = (phraseCounts[phrase] || 0) + 1;
  }

  return Object.entries(phraseCounts)
    .filter(([_, count]) => count >= 3)
    .sort(([_, a], [__, b]) => b - a)
    .slice(0, 20)
    .map(([phrase]) => phrase);
}

function analyzeFormattingPatterns(content: string): FormattingPatterns {
  const patterns: FormattingPatterns = {
    headingStyles: [],
    listUsage: { bulletPoints: 0, numberedLists: 0, examples: [] },
    paragraphStructure: { avgLength: 0, avgSentenceLength: 0, examples: [] },
    emphasisPatterns: { bold: [], italic: [], allCaps: [] },
    ctaPatterns: [],
  };

  if (!content) return patterns;

  if (content.match(/^#{1,6}\s/m)) patterns.headingStyles.push("Markdown");
  if (content.match(/^[A-Z][A-Z\s]{5,}$/m)) patterns.headingStyles.push("ALL CAPS");
  if (content.match(/^[A-Z][a-z]+(?:\s[A-Z][a-z]+)*$/m))
    patterns.headingStyles.push("Title Case");

  patterns.listUsage.bulletPoints =
    (content.match(/^[\s]*[-*•]/gm) || []).length;
  patterns.listUsage.numberedLists =
    (content.match(/^[\s]*\d+\./gm) || []).length;

  const listMatches =
    content.match(/^[\s]*[-*•]\s.+(\n[\s]*[-*•]\s.+){2,}/gm) || [];
  if (listMatches.length > 0) {
    patterns.listUsage.examples = listMatches.slice(0, 3);
  }

  const paragraphs = content
    .split(/\n\n+/)
    .map((p) => p.trim())
    .filter((p) => p.length > 20);
  const wordCounts = paragraphs.map((p) => p.split(/\s+/).length);
  if (wordCounts.length > 0) {
    patterns.paragraphStructure.avgLength =
      wordCounts.reduce((a, b) => a + b, 0) / wordCounts.length;
    patterns.paragraphStructure.examples = paragraphs.slice(0, 5);
  }

  const sentences = content
    .split(/[.!?]+/)
    .map((s) => s.trim())
    .filter((s) => s.length > 0);
  const sentenceWordCounts = sentences.map((s) => s.split(/\s+/).length);
  if (sentenceWordCounts.length > 0) {
    patterns.paragraphStructure.avgSentenceLength =
      sentenceWordCounts.reduce((a, b) => a + b, 0) / sentenceWordCounts.length;
  }
  const boldMatches = content.match(/\*\*(.+?)\*\*/g);
  if (boldMatches)
    patterns.emphasisPatterns.bold = boldMatches
      .slice(0, 10)
      .map((m) => m.replace(/\*\*/g, ""));

  const italicMatches = content.match(/\*(.+?)\*/g);
  if (italicMatches)
    patterns.emphasisPatterns.italic = italicMatches
      .slice(0, 10)
      .map((m) => m.replace(/\*/g, ""));

  const capsMatches = content.match(/\b[A-Z]{3,}\b/g);
  if (capsMatches)
    patterns.emphasisPatterns.allCaps = [...new Set(capsMatches)].slice(0, 10);

  const ctaRegexes = [
    /book (your|a|now)/gi,
    /get started/gi,
    /learn more/gi,
    /download/gi,
    /schedule/gi,
    /contact (us|me)/gi,
    /apply now/gi,
  ];
  ctaRegexes.forEach((pattern) => {
    const matches = content.match(pattern);
    if (matches) patterns.ctaPatterns.push(...matches);
  });

  return patterns;
}

function extractComplianceMarkers(content: string): ComplianceMarkers {
  if (!content) {
    return { disclaimers: [], legalTerms: [], warningLanguage: [] };
  }

  const disclaimers =
    content
      .split(/\n+/)
      .map((line) => line.trim())
      .filter(
        (line) =>
          line.toLowerCase().includes("disclaimer") ||
          line.toLowerCase().includes("results may vary") ||
          line.toLowerCase().includes("not financial advice") ||
          line.toLowerCase().includes("not legal advice")
      )
      .slice(0, 10) || [];

  const legalTerms = Array.from(
    new Set(
      (content.match(
        /\b(privacy|terms|liability|indemnity|warranty|guarantee|risk|compliance|regulation|hipaa|finra|sec|fda|ftc|gdpr)\b/gi
      ) || []).map((t) => t.trim())
    )
  ).slice(0, 20);

  const warningLanguage = Array.from(
    new Set(
      (content.match(/\b(important|warning|caution|note|must)\b/gi) || []).map(
        (t) => t.trim()
      )
    )
  ).slice(0, 20);

  return {
    disclaimers,
    legalTerms,
    warningLanguage,
  };
}

function extractVoiceSamples(
  content: string
): Array<{
  type: "testimonial" | "sales_copy" | "explanation" | "other";
  text: string;
  context: string;
}> {
  if (!content) return [];

  const paragraphs = content
    .split(/\n\n+/)
    .map((p) => p.trim())
    .filter((p) => p.split(/\s+/).length >= 40);

  const classify = (text: string) => {
    const lower = text.toLowerCase();
    if (lower.includes("testimonial") || lower.includes("client said"))
      return "testimonial";
    if (lower.includes("offer") || lower.includes("book") || lower.includes("call"))
      return "sales_copy";
    if (lower.includes("how it works") || lower.includes("we help"))
      return "explanation";
    return "other";
  };

  return paragraphs.slice(0, 5).map((p, idx) => ({
    type: classify(p),
    text: p.substring(0, 1200),
    context: `paragraph_${idx + 1}`,
  }));
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

async function generateAndSaveCards(
  openai: OpenAI,
  brainId: string,
  intakeData: any,
  fileUploads: any
): Promise<any[]> {
  console.log("[generateAndSaveCards] Received intakeData:", {
    hasIntakeData: !!intakeData,
    keys: intakeData ? Object.keys(intakeData) : [],
    website: intakeData?.website,
    businessName: intakeData?.businessName,
    businessType: intakeData?.businessType,
    brandVoiceStyle: intakeData?.brandVoiceStyle,
  });

  const websiteUrl = intakeData?.website || "";
  const files: Array<{ url: string; name: string; type?: string }> = [];

  if (fileUploads && Array.isArray(fileUploads)) {
    files.push(
      ...fileUploads.map((f: any) => ({
        url: f.url || "",
        name: f.name || "",
        type: f.type || "",
      }))
    );
  }

  const extractedContent = await intelligentContentExtraction(
    websiteUrl,
    files,
    intakeData?.contentLinks
  );

  const enhancedContext = buildEnhancedContext(intakeData, extractedContent);

  const analysisContext: AnalysisContext = {
    websiteUrl,
    websiteContent: extractedContent.website,
    files: extractedContent.files,
    contentLinks: extractedContent.contentLinks,
    enhancedContext,
    intakeData,
  };
  
  console.log(`[generateAndSaveCards] ContentLinks extracted: ${extractedContent.contentLinks?.length || 0} URLs with content`);

  console.log("[generateAndSaveCards] AnalysisContext intakeData:", {
    hasIntakeData: !!analysisContext.intakeData,
    keys: analysisContext.intakeData
      ? Object.keys(analysisContext.intakeData)
      : [],
    businessName: analysisContext.intakeData?.businessName,
    brandVoiceStyle: analysisContext.intakeData?.brandVoiceStyle,
  });

  console.log("Mining deep insights...");
  console.log(
    `Content available - Website: ${
      analysisContext.websiteContent.fullText.length > 0
    }, Files: ${analysisContext.files.length}`
  );

  const miningResult = await mineDeepInsights(openai, analysisContext);
  console.log(
    `Mined ${miningResult.total_insights} insights (${miningResult.high_confidence_count} high confidence, avg specificity: ${miningResult.specificity_avg})`
  );
  console.log(
    `Categories covered: ${miningResult.categories_covered.join(", ")}`
  );

  if (miningResult.total_insights === 0) {
    console.warn(
      "WARNING: No insights mined. Cards will be generated from content directly."
    );
  }

  console.log("Generating enhanced cards with deep insights...");
  const [
    brandVoiceCard,
    positioningCard,
    styleRulesCard,
    complianceCard,
    ghlCard,
  ] = await Promise.all([
    generateBrandVoiceCard(openai, miningResult.insights, analysisContext),
    generatePositioningCard(openai, miningResult.insights, analysisContext),
    generateStyleRulesCard(openai, miningResult.insights, analysisContext),
    generateComplianceCard(openai, miningResult.insights, analysisContext),
    generateGHLCard(openai, miningResult.insights, analysisContext),
  ]);

  const normalizedForbiddenWords = safeSplit(intakeData?.forbiddenWords, /,|\n|;/);
  const normalizedDisclaimers = safeSplit(intakeData?.disclaimers, /\n{1,}|;|,/);
  const normalizedPipelineStages = safeSplit(intakeData?.pipelineStages, /→|->|,|\n/);

  if (complianceCard) {
    complianceCard.metadata = {
      ...(complianceCard as any).metadata,
      forbidden_words:
        (complianceCard as any).metadata?.forbidden_words?.length
          ? (complianceCard as any).metadata.forbidden_words
          : normalizedForbiddenWords,
      disclaimers:
        (complianceCard as any).metadata?.disclaimers?.length
          ? (complianceCard as any).metadata.disclaimers
          : normalizedDisclaimers,
    };
  }

  if (ghlCard) {
    const existingWorkflows =
      (ghlCard as any).metadata?.workflows || (ghlCard as any).metadata?.pipelines;
    const pipelineList =
      Array.isArray(existingWorkflows) && existingWorkflows.length > 0
        ? existingWorkflows
        : normalizedPipelineStages.map((stage, idx) => ({
            name: `Stage ${idx + 1}`,
            description: stage,
          }));

    ghlCard.metadata = {
      ...(ghlCard as any).metadata,
      pipelines: pipelineList,
      workflows: pipelineList,
    };
  }

  const cardsForScoring = [
    { ref: brandVoiceCard, type: "BRAND_VOICE_CARD" },
    { ref: positioningCard, type: "POSITIONING_CARD" },
    { ref: styleRulesCard, type: "STYLE_RULES" },
    { ref: complianceCard, type: "COMPLIANCE_RULES" },
    { ref: ghlCard, type: "GHL_IMPLEMENTATION_NOTES" },
  ];

  cardsForScoring.forEach(({ ref, type }) => {
    const validationResult = validateCard(ref, type);
    const sources =
      (ref as any)?.source_attribution || (ref as any)?.metadata?.sources || [];
    const computedConfidence = calculateCardConfidence(
      ref,
      enhancedContext,
      sources
    );

    (ref as any).confidence_score = computedConfidence;
    (ref as any).metadata = {
      ...(ref as any).metadata,
      confidence_score: computedConfidence,
      validation: validationResult,
    };

    if (!validationResult.isValid) {
      console.warn(`[${type}] Card validation failed`, validationResult);
    } else if (validationResult.warnings.length > 0) {
      console.warn(`[${type}] Card validation warnings`, validationResult.warnings);
    }
  });

  const cardDefinitions = [
    {
      type: "BRAND_VOICE_CARD",
      data: {
        title: brandVoiceCard.title,
        description: brandVoiceCard.description,
        metadata: brandVoiceCard.metadata,
        confidence_score: brandVoiceCard.confidence_score,
        source_attribution: brandVoiceCard.source_attribution,
      },
      orderIndex: 0,
      priority: 1,
    },
    {
      type: "POSITIONING_CARD",
      data: {
        title: positioningCard.title,
        description: positioningCard.description,
        metadata: positioningCard.metadata,
        confidence_score: positioningCard.confidence_score,
        source_attribution: positioningCard.source_attribution,
      },
      orderIndex: 1,
      priority: 1,
    },
    {
      type: "STYLE_RULES",
      data: {
        title: styleRulesCard.title,
        description: styleRulesCard.description,
        metadata: styleRulesCard.metadata,
        confidence_score: styleRulesCard.confidence_score,
        source_attribution: styleRulesCard.source_attribution,
      },
      orderIndex: 2,
      priority: 2,
    },
    {
      type: "COMPLIANCE_RULES",
      data: {
        title: complianceCard.title,
        description: complianceCard.description,
        metadata: complianceCard.metadata,
        confidence_score: complianceCard.confidence_score,
        source_attribution: complianceCard.source_attribution,
      },
      orderIndex: 3,
      priority: 2,
    },
    {
      type: "GHL_IMPLEMENTATION_NOTES",
      data: {
        title: ghlCard.title,
        description: ghlCard.description,
        metadata: ghlCard.metadata,
        confidence_score: ghlCard.confidence_score,
        source_attribution: ghlCard.source_attribution,
      },
      orderIndex: 4,
      priority: 3,
    },
  ];

  await prisma.businessCard.deleteMany({ where: { brainId } });

  const savedCards = await Promise.all(
    cardDefinitions.map((cardDef) =>
      prisma.businessCard.create({
        data: {
          brainId,
          type: cardDef.type,
          title: cardDef.data.title,
          description: cardDef.data.description || "",
          metadata: {
            ...(cardDef.data.metadata || {}),
            confidence_score: cardDef.data.confidence_score || 0,
          },
          orderIndex: cardDef.orderIndex,
          priority: cardDef.priority,
        },
      })
    )
  );

  const result = savedCards.map((savedCard, index) => ({
    ...savedCard,
    confidence_score: cardDefinitions[index].data.confidence_score || 0,
  }));

  try {
    await prisma.enhancementAnalysis.deleteMany({
      where: { brainId },
    });
    console.log("[Generate-Cards] Invalidated enhancement analysis cache");
  } catch (error) {
    console.error("[Generate-Cards] Error invalidating cache:", error);
  }

  return result;
}

export async function POST(request: Request) {
  console.log("[Generate-Cards] API endpoint called");
  try {
    const cookieStore = await cookies();
    const accessToken = cookieStore.get("accessToken")?.value;

    if (!accessToken) {
      console.error("[Generate-Cards] Not authenticated");
      return NextResponse.json(
        { success: false, error: "Not authenticated." },
        { status: 401 }
      );
    }

    const decoded = await verifyAccessToken(accessToken);
    if (!decoded) {
      console.error("[Generate-Cards] Invalid token");
      return NextResponse.json(
        { success: false, error: "Invalid token." },
        { status: 401 }
      );
    }

    const { searchParams } = new URL(request.url);
    const profileId = searchParams.get("profileId");

    if (!profileId) {
      return NextResponse.json(
        { success: false, error: "profileId query parameter is required." },
        { status: 400 }
      );
    }

    const userOrganizations = await prisma.userOrganization.findMany({
      where: {
        userId: decoded.userId,
        organization: { deactivatedAt: null },
      },
      select: { id: true },
    });

    if (userOrganizations.length === 0) {
      return NextResponse.json(
        {
          success: false,
          error: "User does not belong to any active organization.",
        },
        { status: 403 }
      );
    }

    const userOrganizationIds = userOrganizations.map((uo) => uo.id);

    const businessBrain = await prisma.businessBrain.findFirst({
      where: {
        id: profileId,
        userOrganizationId: { in: userOrganizationIds },
      },
    });

    if (!businessBrain) {
      return NextResponse.json(
        { success: false, error: "Business brain not found or access denied." },
        { status: 404 }
      );
    }

    console.log("[Generate-Cards] Retrieved businessBrain:", {
      id: businessBrain.id,
      hasIntakeData: !!businessBrain.intakeData,
      intakeDataType: typeof businessBrain.intakeData,
      intakeDataIsObject:
        businessBrain.intakeData &&
        typeof businessBrain.intakeData === "object",
      intakeDataKeys:
        businessBrain.intakeData && typeof businessBrain.intakeData === "object"
          ? Object.keys(businessBrain.intakeData as any)
          : "not an object",
    });


    let parsedIntakeData = businessBrain.intakeData;
    if (typeof parsedIntakeData === "string") {
      try {
        parsedIntakeData = JSON.parse(parsedIntakeData);
        console.log("[Generate-Cards] Parsed intakeData from string");
      } catch (e) {
        console.error("[Generate-Cards] Failed to parse intakeData string:", e);
      }
    }

    if (!process.env.OPENAI_API_KEY) {
      return NextResponse.json(
        { success: false, error: "OpenAI API key not configured." },
        { status: 500 }
      );
    }

    const openai = new OpenAI({
      apiKey: process.env.OPENAI_API_KEY,
    });

    console.log("[Generate-Cards] Starting card generation...");
    console.log(
      "[Generate-Cards] Using parsed intakeData with keys:",
      parsedIntakeData ? Object.keys(parsedIntakeData as any) : "NULL"
    );
    console.log("[Generate-Cards] Parsed intakeData sample:", {
      businessName: (parsedIntakeData as any)?.businessName,
      website: (parsedIntakeData as any)?.website,
      whatYouSell: (parsedIntakeData as any)?.whatYouSell?.substring(0, 100),
      businessType: (parsedIntakeData as any)?.businessType,
      brandVoiceStyle: (parsedIntakeData as any)?.brandVoiceStyle,
    });

    const cards = await generateAndSaveCards(
      openai,
      profileId,
      parsedIntakeData as any,
      businessBrain.fileUploads as any
    );

    console.log(
      `[Generate-Cards] Generated ${cards.length} cards successfully`
    );

    return NextResponse.json({
      success: true,
      cards: cards.map((card) => ({
        id: card.id,
        type: card.type,
        title: card.title,
        description: card.description,
        metadata: card.metadata,
        orderIndex: card.orderIndex,
        priority: card.priority,
        confidence_score:
          (card as { confidence_score?: number }).confidence_score || 0,
      })),
    });
  } catch (err: any) {
    console.error("Error generating cards:", err);
    return NextResponse.json(
      {
        success: false,
        error: err.message || "Failed to generate business cards.",
      },
      { status: 500 }
    );
  }
}
