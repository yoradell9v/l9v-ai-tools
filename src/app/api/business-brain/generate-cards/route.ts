import { NextResponse } from "next/server";
import { cookies } from "next/headers";
import OpenAI from "openai";
import { prisma } from "@/lib/prisma";
import { verifyAccessToken } from "@/lib/auth";
import { existsSync, readFileSync } from "fs";
import { join } from "path";
import * as cheerio from "cheerio";

import { mineDeepInsights } from "@/lib/analysis/mineInsights";
import { AnalysisContext } from "@/lib/analysis/types";
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
  files: {
    name: string;
    type: "brand_guide" | "style_guide" | "other";
    sections: { title: string; content: string; importance: number }[];
    keyPhrases: string[];
  }[];
}

interface VoiceSample {
  text: string;
  source: string;
  characteristics: string[];
  confidence: number;
  sample_id?: number;
}

interface VoicePatterns {
  sentence_stats: {
    avg_length: number;
    complexity_score: number;
  };
  vocabulary: {
    power_words: string[];
    jargon: string[];
    formality_score: number;
  };
  tone: {
    primary_emotion: string;
    consistency_score: number;
  };
  consistency_score?: number;
}

// ============================================================================
// STAGE 1: INTELLIGENT CONTENT EXTRACTION
// ============================================================================

async function intelligentContentExtraction(
  websiteUrl: string,
  files: Array<{ url: string; name: string; type?: string }>
): Promise<ExtractedContent> {
  const websiteContent = await extractWebsiteSemanticContent(websiteUrl);
  console.log("Extracted Website Content:", websiteContent);

  const processedFiles = await Promise.all(
    files.map((file) => processFileWithChunking(file))
  );
  console.log("Processed Files:", processedFiles);

  return {
    website: websiteContent,
    files: processedFiles,
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

    // Classify file type
    const fileType = await classifyFileType(fullText, file.name);

    // Split into semantic sections
    const sections = await extractSemanticSections(fullText, fileType);

    // Extract key phrases
    const keyPhrases = extractRepeatedPhrases(fullText);

    return {
      name: file.name,
      type: fileType,
      sections,
      keyPhrases,
    };
  } catch (error) {
    console.error(`Error processing file ${file.name}:`, error);
    return {
      name: file.name,
      type: "other" as const,
      sections: [],
      keyPhrases: [],
    };
  }
}

// ============================================================================
// FILE EXTRACTION FUNCTIONS
// ============================================================================

async function extractFullFileText(url: string, name: string): Promise<string> {
  try {
    // Check if it's a local file path
    if (url.startsWith("/") || url.startsWith("./") || url.startsWith("../")) {
      const filePath = url.startsWith("/")
        ? join(process.cwd(), "public", url)
        : join(process.cwd(), url);

      if (existsSync(filePath)) {
        const buffer = readFileSync(filePath);
        return await extractTextFromBuffer(buffer, name);
      }
    }

    // Fetch remote file
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

async function extractTextFromBuffer(
  buffer: Buffer,
  filename: string
): Promise<string> {
  const extension = getFileExtension(filename);

  try {
    if (extension === ".pdf") {
      try {
        const pdfModule: any = await import("pdf-parse");
        // Handle different export formats for pdf-parse
        let pdfParse: any;
        
        // Try different ways to access the function
        if (typeof pdfModule === "function") {
          pdfParse = pdfModule;
        } else if (pdfModule.default) {
          pdfParse = typeof pdfModule.default === "function" ? pdfModule.default : pdfModule.default.default;
        } else if (pdfModule.pdfParse) {
          pdfParse = pdfModule.pdfParse;
        } else if (pdfModule.PDFParse) {
          // Try capitalized version (newer pdf-parse versions)
          pdfParse = pdfModule.PDFParse;
        } else {
          // Last resort: try accessing the module directly
          pdfParse = pdfModule;
        }
        
        if (typeof pdfParse !== "function") {
          console.error(`pdf-parse is not a function for ${filename}. Module keys:`, Object.keys(pdfModule || {}));
          // Try using PDFParse class if available
          if (pdfModule.PDFParse && typeof pdfModule.PDFParse === "function") {
            const pdfParser = new pdfModule.PDFParse(buffer);
            const result = await pdfParser.parse();
            if (!result || !result.text) {
              console.warn(`PDF ${filename} parsed but returned no text content`);
              return "";
            }
            return normalizeWhitespace(result.text);
          }
          return "";
        }
        
        const result = await pdfParse(buffer);
        if (!result || !result.text) {
          console.warn(`PDF ${filename} parsed but returned no text content`);
          return "";
        }
        return normalizeWhitespace(result.text);
      } catch (pdfError) {
        console.error(`Error parsing PDF ${filename}:`, pdfError);
        return "";
      }
    }

    if (extension === ".docx") {
      const mammoth = await import("mammoth");
      const result = await mammoth.extractRawText({ buffer });
      return normalizeWhitespace(result?.value || "");
    }

    if (extension === ".doc") {
      const WordExtractor = (await import("word-extractor")).default;
      const extractor = new WordExtractor();
      const doc = await extractor.extract(buffer);
      const text =
        typeof doc?.getBody === "function" ? doc.getBody() : String(doc ?? "");
      return normalizeWhitespace(text);
    }

    if (extension === ".txt") {
      return normalizeWhitespace(buffer.toString("utf-8"));
    }

    return "";
  } catch (error) {
    console.error(`Error parsing ${filename}:`, error);
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

  // Markdown heading patterns
  const mdHeadingRegex = /^#{1,6}\s+(.+)$/;
  // Common document heading patterns
  const headingPatterns = [
    /^[A-Z][A-Z\s]{2,}$/, // ALL CAPS (min 3 chars)
    /^\d+\.\s+[A-Z]/, // "1. Title" or "1.1 Title"
    /^[IVX]+\.\s+[A-Z]/, // "I. Title" (Roman numerals)
    /^(Chapter|Section|Part|Appendix)\s+\d+/i,
  ];

  // Keywords for importance scoring
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

    // Check for Markdown headings
    const mdMatch = trimmed.match(mdHeadingRegex);
    if (mdMatch) {
      isHeading = true;
      headingText = mdMatch[1];
      headingLevel = trimmed.indexOf(" "); // Number of #'s
    }
    // Check other heading patterns
    else if (
      trimmed.length >= 3 &&
      trimmed.length <= 100 &&
      headingPatterns.some((pattern) => pattern.test(trimmed))
    ) {
      isHeading = true;
      // Check if next line is empty or next line is indented (common heading pattern)
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
      // Save previous section if it has content
      if (currentSection.content.trim().length > 50) {
        sections.push(currentSection);
      }

      // Calculate importance
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

  // Add final section
  if (currentSection.content.trim().length > 50) {
    sections.push(currentSection);
  }

  // Fallback: no sections found, create chunks
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

  // Enhance importance based on content characteristics
  sections.forEach((section) => {
    const contentLower = section.content.toLowerCase();
    if (contentLower.includes("warning") || contentLower.includes("caution")) {
      section.importance = Math.max(section.importance, 7);
    }
    // Boost sections with lists or structured data
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

  // Extract 2-3 word phrases
  for (let i = 0; i < words.length - 1; i++) {
    const phrase = `${words[i]} ${words[i + 1]}`;
    phraseCounts[phrase] = (phraseCounts[phrase] || 0) + 1;
  }

  // Return phrases that appear 3+ times, sorted by frequency
  return Object.entries(phraseCounts)
    .filter(([_, count]) => count >= 3)
    .sort(([_, a], [__, b]) => b - a)
    .slice(0, 20)
    .map(([phrase]) => phrase);
}

// ============================================================================
// HTML PARSING FUNCTIONS (Using Cheerio)
// ============================================================================

function extractHeroSection($: cheerio.CheerioAPI): string {
  // Try multiple selectors for hero section
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

  // If no hero found, try getting h1 text
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

  // Try multiple testimonial selectors
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

  // Remove duplicates and return
  return [...new Set(testimonials)].slice(0, 10);
}

function extractBodyText(
  $: cheerio.CheerioAPI,
  options: { maxLength: number }
): string {
  // Remove script and style elements
  $("script, style, noscript").remove();

  // Get text from body
  const body = $("body");
  if (body.length > 0) {
    let text = body.text();
    // Normalize whitespace
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

// ============================================================================
// STAGE 2: SPECIALIZED ANALYSIS PER CARD TYPE
// ============================================================================

async function analyzeBrandVoice(
  openai: OpenAI,
  content: ExtractedContent,
  intakeData: any
): Promise<any> {
  try {
    // First pass: Extract voice samples
    const voiceSamples = await extractVoiceSamples(openai, content);

    // Second pass: Analyze patterns
    const voicePatterns = await analyzeVoicePatterns(openai, voiceSamples);

    // Third pass: Generate rules with validation
    const voiceRules = await generateVoiceRules(
      openai,
      voicePatterns,
      intakeData,
      voiceSamples
    );
    return {
      title: "Brand Voice & Communication Style",
      description:
        voiceRules.description ||
        "Brand voice guidelines based on your content and preferences.",
      metadata: voiceRules.metadata || {},
      confidence_score: calculateConfidenceScore(voiceSamples, voicePatterns),
      source_attribution: voiceRules.sources || [],
    };
  } catch (error) {
    console.error("Error analyzing brand voice:", error);
    return {
      title: "Brand Voice & Communication Style",
      description: "Brand voice guidelines based on your intake form data.",
      metadata: {},
      confidence_score: 50,
      source_attribution: [],
    };
  }
}

async function extractVoiceSamples(
  openai: OpenAI,
  content: ExtractedContent
): Promise<VoiceSample[]> {
  const systemPrompt = `You are a linguistic analyst. Extract 10-15 representative text samples that showcase the brand's voice.
  
  For each sample, identify:
  - The exact text (quote it precisely)
  - Where it came from (hero, about page, email, etc.)
  - What voice characteristics it demonstrates
  - Confidence that this represents their authentic voice (1-10)
  
  Only extract samples that are clearly written BY the brand, not ABOUT them.
  
  Return JSON with format: { "samples": [{ "text": "...", "source": "...", "characteristics": [...], "confidence": 8 }] }`;

  const samples: VoiceSample[] = [];

  // Extract from website sections
  const websiteText = [
    { section: "hero", text: content.website.hero },
    { section: "about", text: content.website.about },
    { section: "services", text: content.website.services },
  ].filter((item) => item.text && item.text.length > 50);

  if (websiteText.length > 0) {
    try {
      const combinedText = websiteText
        .map((item) => `${item.section}:\n${item.text}`)
        .join("\n\n");
      const result = await openai.chat.completions.create({
        model: "gpt-4o-mini",
        messages: [
          { role: "system", content: systemPrompt },
          {
            role: "user",
            content: `Extract voice samples from these website sections:\n\n${combinedText.substring(
              0,
              8000
            )}`,
          },
        ],
        response_format: { type: "json_object" },
        temperature: 0.3,
      });

      const extracted = JSON.parse(result.choices[0].message.content || "{}");
      if (extracted.samples && Array.isArray(extracted.samples)) {
        samples.push(...extracted.samples);
      }
    } catch (error) {
      console.error("Error extracting voice samples from website:", error);
    }
  }

  // Extract from files
  for (const file of content.files) {
    if (file.type === "brand_guide" || file.type === "style_guide") {
      for (const section of file.sections.slice(0, 5)) {
        if (section.content && section.content.length > 100) {
          try {
            const result = await openai.chat.completions.create({
              model: "gpt-4o-mini",
              messages: [
                { role: "system", content: systemPrompt },
                {
                  role: "user",
                  content: `Extract voice samples from "${
                    section.title
                  }":\n\n${section.content.substring(0, 4000)}`,
                },
              ],
              response_format: { type: "json_object" },
              temperature: 0.3,
            });

            const extracted = JSON.parse(
              result.choices[0].message.content || "{}"
            );
            if (extracted.samples && Array.isArray(extracted.samples)) {
              samples.push(...extracted.samples);
            }
          } catch (error) {
            console.error(
              `Error extracting voice samples from ${file.name}:`,
              error
            );
          }
        }
      }
    }
  }

  return samples.slice(0, 20); // Limit to 20 samples
}

async function analyzeVoicePatterns(
  openai: OpenAI,
  samples: VoiceSample[]
): Promise<VoicePatterns> {
  if (samples.length === 0) {
    return {
      sentence_stats: { avg_length: 15, complexity_score: 5 },
      vocabulary: { power_words: [], jargon: [], formality_score: 5 },
      tone: { primary_emotion: "neutral", consistency_score: 0.5 },
    };
  }

  const systemPrompt = `You are a linguistic pattern analyst. Given these voice samples, identify:
  
  1. Sentence structure patterns (avg length, complexity, rhythm)
  2. Vocabulary patterns (power words, jargon, formality level)
  3. Emotional tone patterns (consistency, range, authenticity)
  4. Rhetorical devices used (questions, imperatives, storytelling)
  5. Quantitative metrics (reading level, sentence variety, vocabulary diversity)
  
  Be specific and data-driven. Calculate actual statistics.
  
  Return JSON with format matching VoicePatterns interface.`;

  try {
    const result = await openai.chat.completions.create({
      model: "gpt-4o-mini",
      messages: [
        { role: "system", content: systemPrompt },
        {
          role: "user",
          content: JSON.stringify(samples.slice(0, 15), null, 2),
        },
      ],
      response_format: { type: "json_object" },
      temperature: 0.2,
      max_tokens: 2000,
    });

    return JSON.parse(result.choices[0].message.content || "{}");
  } catch (error) {
    console.error("Error analyzing voice patterns:", error);
    return {
      sentence_stats: { avg_length: 15, complexity_score: 5 },
      vocabulary: { power_words: [], jargon: [], formality_score: 5 },
      tone: { primary_emotion: "neutral", consistency_score: 0.5 },
    };
  }
}

async function generateVoiceRules(
  openai: OpenAI,
  patterns: VoicePatterns,
  intakeData: any,
  samples: VoiceSample[]
): Promise<any> {
  const systemPrompt = `You are a brand voice architect. Create actionable writing rules.
  
  Rules must be:
  - Specific enough to guide AI content generation
  - Backed by examples from the provided samples
  - Validated against the slider values from intake data
  - Include source attribution for every claim
  
  Format: JSON with description, metadata (rules array), and sources array.`;

  try {
    const result = await openai.chat.completions.create({
      model: "gpt-4o",
      messages: [
        { role: "system", content: systemPrompt },
        {
          role: "user",
          content: JSON.stringify(
            {
              patterns,
              intakeData: {
                formalCasual: intakeData?.formalCasual || 50,
                playfulSerious: intakeData?.playfulSerious || 50,
                directStoryDriven: intakeData?.directStoryDriven || 50,
                punchyDetailed: intakeData?.punchyDetailed || 50,
                inspirationalAnalytical:
                  intakeData?.inspirationalAnalytical || 50,
                soundsLike: intakeData?.soundsLike || "",
              },
              samples: samples
                .map((s, i) => ({ ...s, sample_id: i }))
                .slice(0, 10),
            },
            null,
            2
          ),
        },
      ],
      response_format: { type: "json_object" },
      temperature: 0.4,
      max_tokens: 4000,
    });

    return JSON.parse(result.choices[0].message.content || "{}");
  } catch (error) {
    console.error("Error generating voice rules:", error);
    return {
      description: "Brand voice guidelines based on your preferences.",
      metadata: {},
      sources: [],
    };
  }
}

async function analyzePositioning(
  openai: OpenAI,
  content: ExtractedContent,
  intakeData: any
): Promise<any> {
  try {
    const positioningSignals = await extractPositioningSignals(openai, content);
    const competitiveIntel = await analyzeCompetitors(
      openai,
      intakeData?.competitors || "",
      positioningSignals
    );
    const positioningFramework = await buildPositioningFramework(
      openai,
      positioningSignals,
      competitiveIntel,
      intakeData
    );

    return {
      title: "Market Position & Competitive Strategy",
      description:
        positioningFramework.description ||
        "Market positioning based on your business information.",
      metadata: positioningFramework.metadata || {},
      confidence_score: calculatePositioningConfidence(positioningSignals),
      source_attribution: positioningFramework.sources || [],
    };
  } catch (error) {
    console.error("Error analyzing positioning:", error);
    return {
      title: "Market Position & Competitive Strategy",
      description: "Market positioning based on your intake form data.",
      metadata: {},
      confidence_score: 50,
      source_attribution: [],
    };
  }
}

async function extractPositioningSignals(
  openai: OpenAI,
  content: ExtractedContent
): Promise<any> {
  try {
    const result = await openai.chat.completions.create({
      model: "gpt-4o-mini",
      messages: [
        {
          role: "system",
          content:
            "Extract positioning signals from business content. Return JSON with value_proposition, target_audience, differentiation, and market_position.",
        },
        {
          role: "user",
          content: `Extract positioning from:\n\nWebsite: ${content.website.fullText.substring(
            0,
            4000
          )}`,
        },
      ],
      response_format: { type: "json_object" },
      temperature: 0.3,
    });

    return JSON.parse(result.choices[0].message.content || "{}");
  } catch (error) {
    console.error("Error extracting positioning signals:", error);
    return {};
  }
}

async function analyzeCompetitors(
  openai: OpenAI,
  competitors: any,
  signals: any
): Promise<any> {
  if (!competitors || competitors.trim().length === 0) {
    return {};
  }

  try {
    const result = await openai.chat.completions.create({
      model: "gpt-4o-mini",
      messages: [
        {
          role: "system",
          content:
            "Analyze competitive landscape. Return JSON with competitor_analysis and differentiation_points.",
        },
        {
          role: "user",
          content: `Competitors mentioned: ${competitors}\n\nPositioning signals: ${JSON.stringify(
            signals
          )}`,
        },
      ],
      response_format: { type: "json_object" },
      temperature: 0.3,
    });

    return JSON.parse(result.choices[0].message.content || "{}");
  } catch (error) {
    console.error("Error analyzing competitors:", error);
    return {};
  }
}

async function buildPositioningFramework(
  openai: OpenAI,
  signals: any,
  intel: any,
  intake: any
): Promise<any> {
  try {
    const result = await openai.chat.completions.create({
      model: "gpt-4o",
      messages: [
        {
          role: "system",
          content:
            "Build a comprehensive positioning framework. Return JSON with description, metadata (framework details), and sources.",
        },
        {
          role: "user",
          content: JSON.stringify(
            {
              signals,
              competitiveIntel: intel,
              intakeData: {
                offers: intake?.offers || "",
                outcomePromise: intake?.outcomePromise || "",
                icps: intake?.icps || [],
                topCompetitor: intake?.topCompetitor || "",
              },
            },
            null,
            2
          ),
        },
      ],
      response_format: { type: "json_object" },
      temperature: 0.4,
      max_tokens: 3000,
    });

    return JSON.parse(result.choices[0].message.content || "{}");
  } catch (error) {
    console.error("Error building positioning framework:", error);
    return { metadata: {}, sources: [] };
  }
}

// ============================================================================
// STAGE 4: VALIDATION & CONFIDENCE SCORING
// ============================================================================

function calculateConfidenceScore(
  samples: VoiceSample[],
  patterns: VoicePatterns
): number {
  let score = 0;
  let maxScore = 0;

  // Factor 1: Sample quantity (max 30 points)
  maxScore += 30;
  score += Math.min(samples.length * 2, 30);

  // Factor 2: Sample diversity (max 25 points)
  maxScore += 25;
  const uniqueSources = new Set(samples.map((s) => s.source)).size;
  score += Math.min(uniqueSources * 5, 25);

  // Factor 3: High-confidence samples (max 25 points)
  maxScore += 25;
  const highConfSamples = samples.filter((s) => s.confidence >= 8).length;
  score += Math.min(highConfSamples * 3, 25);

  // Factor 4: Pattern consistency (max 20 points)
  maxScore += 20;
  if (patterns.consistency_score) {
    score += patterns.consistency_score * 20;
  } else {
    score += 10; // Default middle score
  }

  return Math.round((score / maxScore) * 100);
}

function calculatePositioningConfidence(signals: any): number {
  if (!signals || Object.keys(signals).length === 0) {
    return 30;
  }

  let score = 50; // Base score

  if (signals.value_proposition) score += 15;
  if (signals.target_audience) score += 15;
  if (signals.differentiation) score += 10;
  if (signals.market_position) score += 10;

  return Math.min(score, 100);
}

function calculateOverallConfidence(cards: any[]): number {
  const scores = cards.map((c) => c.confidence_score || 0);
  if (scores.length === 0) return 0;
  return Math.round(scores.reduce((a, b) => a + b, 0) / scores.length);
}

function calculateTotalLength(content: ExtractedContent): number {
  let length = content.website.fullText.length;
  content.files.forEach((file) => {
    file.sections.forEach((section) => {
      length += section.content.length;
    });
  });
  return length;
}

// ============================================================================
// CARD GENERATION AND SAVING
// ============================================================================

// ============================================================================
// IMPROVED CARD GENERATION WITH AI ANALYSIS
// ============================================================================

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
    legalName: intakeData?.legalName,
    formalCasual: intakeData?.formalCasual,
    soundsLike: intakeData?.soundsLike,
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

  // Extract content ONCE - use it for ALL cards
  const extractedContent = await intelligentContentExtraction(
    websiteUrl,
    files
  );

  // Build analysis context for deep insights
  const analysisContext: AnalysisContext = {
    websiteUrl,
    websiteContent: extractedContent.website,
    files: extractedContent.files,
    intakeData,
  };
  
  console.log("[generateAndSaveCards] AnalysisContext intakeData:", {
    hasIntakeData: !!analysisContext.intakeData,
    keys: analysisContext.intakeData ? Object.keys(analysisContext.intakeData) : [],
    formalCasual: analysisContext.intakeData?.formalCasual,
    soundsLike: analysisContext.intakeData?.soundsLike,
  });

  // PHASE 1: Mine deep insights from all content sources
  console.log("Mining deep insights...");
  console.log(`Content available - Website: ${analysisContext.websiteContent.fullText.length > 0}, Files: ${analysisContext.files.length}`);
  
  const miningResult = await mineDeepInsights(openai, analysisContext);
  console.log(`Mined ${miningResult.total_insights} insights (${miningResult.high_confidence_count} high confidence, avg specificity: ${miningResult.specificity_avg})`);
  console.log(`Categories covered: ${miningResult.categories_covered.join(", ")}`);
  
  if (miningResult.total_insights === 0) {
    console.warn("WARNING: No insights mined. Cards will be generated from content directly.");
  }

  // PHASE 2: Generate enhanced cards using deep insights
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

  // Transform new card structures to match expected format
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

  // Map saved cards with their confidence scores
  return savedCards.map((savedCard, index) => ({
    ...savedCard,
    confidence_score: cardDefinitions[index].data.confidence_score || 0,
  }));
}

// ============================================================================
// NEW: AI-POWERED STYLE RULES ANALYSIS
// ============================================================================

async function analyzeStyleRules(
  openai: OpenAI,
  content: ExtractedContent,
  intakeData: any
): Promise<any> {
  try {
    // Extract formatting patterns from files
    const formattingPatterns = extractFormattingPatterns(content);

    // AI analysis of style preferences
    const styleAnalysis = await analyzeStylePatterns(
      openai,
      content,
      formattingPatterns,
      intakeData
    );

    return {
      title: "Style Rules & Guidelines",
      description:
        styleAnalysis.description || "Style guidelines based on your content.",
      metadata: styleAnalysis.metadata || {},
      confidence_score: calculateStyleConfidence(
        formattingPatterns,
        styleAnalysis
      ),
      source_attribution: styleAnalysis.sources || [],
    };
  } catch (error) {
    console.error("Error analyzing style rules:", error);
    return {
      title: "Style Rules & Guidelines",
      description: generateStyleRulesFallback(intakeData),
      metadata: {},
      confidence_score: 30,
      source_attribution: [],
    };
  }
}

function extractFormattingPatterns(content: ExtractedContent): any {
  const patterns = {
    heading_styles: [] as string[],
    list_usage: { bullet: 0, numbered: 0 },
    paragraph_length: [] as number[],
    formatting_markers: [] as string[],
    structure_types: [] as string[],
  };

  // Analyze files for formatting patterns
  content.files.forEach((file) => {
    file.sections.forEach((section) => {
      const lines = section.content.split("\n");

      // Detect heading styles
      lines.forEach((line) => {
        if (line.match(/^#{1,6}\s/)) patterns.heading_styles.push("markdown");
        if (line.match(/^[A-Z][A-Z\s]{2,}$/))
          patterns.heading_styles.push("all_caps");
        if (line.match(/^\d+\.\s/)) patterns.list_usage.numbered++;
        if (line.match(/^[\s]*[-*•]\s/)) patterns.list_usage.bullet++;
      });

      // Measure paragraph lengths
      const paragraphs = section.content
        .split("\n\n")
        .filter((p) => p.trim().length > 0);
      paragraphs.forEach((p) => {
        patterns.paragraph_length.push(p.split(" ").length);
      });

      // Detect formatting markers
      if (section.content.includes("**"))
        patterns.formatting_markers.push("bold_markdown");
      if (section.content.includes("_"))
        patterns.formatting_markers.push("italic_markdown");
      if (section.content.match(/\[.+\]\(.+\)/))
        patterns.formatting_markers.push("links");
    });
  });

  return patterns;
}

async function analyzeStylePatterns(
  openai: OpenAI,
  content: ExtractedContent,
  patterns: any,
  intakeData: any
): Promise<any> {
  const systemPrompt = `You are a content style analyst. Analyze the brand's style preferences and create specific, actionable rules.

Rules should cover:
1. Formatting conventions (headings, lists, emphasis)
2. Paragraph structure (length, rhythm, white space)
3. Visual presentation (how content should look)
4. Forbidden phrases and preferred alternatives
5. Examples of good vs. bad style from their content

Return JSON with:
- description: Comprehensive style guide (markdown formatted)
- metadata: { rules: [...], examples: [...], forbidden: [...], preferred: [...] }
- sources: Attribution for each rule`;

  // Prepare content samples
  const styleSamples = content.files
    .filter((f) => f.type === "style_guide" || f.type === "brand_guide")
    .flatMap((f) => f.sections.slice(0, 3))
    .map((s) => ({ title: s.title, content: s.content.substring(0, 1000) }));

  try {
    const result = await openai.chat.completions.create({
      model: "gpt-4o",
      messages: [
        { role: "system", content: systemPrompt },
        {
          role: "user",
          content: JSON.stringify(
            {
              formattingPatterns: patterns,
              intakeData: {
                forbiddenWords: intakeData?.forbiddenWords || "",
                soundsLike: intakeData?.soundsLike || "",
                favoriteParagraphs: intakeData?.favoriteParagraphs || "",
                avoidParagraphs: intakeData?.avoidParagraphs || "",
              },
              styleSamples: styleSamples.slice(0, 5),
              websiteExcerpts: {
                hero: content.website.hero.substring(0, 500),
                about: content.website.about.substring(0, 500),
              },
            },
            null,
            2
          ),
        },
      ],
      response_format: { type: "json_object" },
      temperature: 0.3,
      max_tokens: 3000,
    });

    return JSON.parse(result.choices[0].message.content || "{}");
  } catch (error) {
    console.error("Error analyzing style patterns:", error);
    return { metadata: {}, sources: [] };
  }
}

// ============================================================================
// NEW: AI-POWERED COMPLIANCE ANALYSIS
// ============================================================================

async function analyzeComplianceRules(
  openai: OpenAI,
  content: ExtractedContent,
  intakeData: any
): Promise<any> {
  try {
    // Detect compliance signals in content
    const complianceSignals = detectComplianceSignals(content);

    // AI analysis of compliance requirements
    const complianceAnalysis = await analyzeComplianceRequirements(
      openai,
      content,
      complianceSignals,
      intakeData
    );

    return {
      title: "Compliance & Legal Guidelines",
      description: complianceAnalysis.description || "Compliance guidelines.",
      metadata: complianceAnalysis.metadata || {},
      confidence_score: calculateComplianceConfidence(complianceSignals),
      source_attribution: complianceAnalysis.sources || [],
    };
  } catch (error) {
    console.error("Error analyzing compliance:", error);
    return {
      title: "Compliance & Legal Guidelines",
      description: generateComplianceRulesFallback(intakeData),
      metadata: {},
      confidence_score: 30,
      source_attribution: [],
    };
  }
}

function detectComplianceSignals(content: ExtractedContent): any {
  const signals = {
    disclaimers_found: [] as string[],
    legal_terms: [] as string[],
    regulatory_keywords: [] as string[],
    risk_level: "low" as "low" | "medium" | "high",
  };

  const legalKeywords = [
    "disclaimer",
    "terms",
    "conditions",
    "privacy",
    "gdpr",
    "hipaa",
    "compliance",
    "regulation",
    "legal",
    "liability",
    "warranty",
  ];

  const regulatoryKeywords = [
    "fda",
    "sec",
    "finra",
    "medical",
    "healthcare",
    "financial",
    "pharmaceutical",
    "clinical",
    "certified",
    "licensed",
  ];

  // Scan all content
  const allText = [
    content.website.fullText,
    ...content.files.flatMap((f) => f.sections.map((s) => s.content)),
  ]
    .join(" ")
    .toLowerCase();

  // Detect legal terms
  legalKeywords.forEach((keyword) => {
    if (allText.includes(keyword)) {
      signals.legal_terms.push(keyword);
    }
  });

  // Detect regulatory keywords
  regulatoryKeywords.forEach((keyword) => {
    if (allText.includes(keyword)) {
      signals.regulatory_keywords.push(keyword);
    }
  });

  // Extract actual disclaimers
  content.files.forEach((file) => {
    file.sections.forEach((section) => {
      if (
        section.title.toLowerCase().includes("disclaimer") ||
        section.title.toLowerCase().includes("legal")
      ) {
        signals.disclaimers_found.push(section.content.substring(0, 500));
      }
    });
  });

  // Calculate risk level
  if (
    signals.regulatory_keywords.length > 3 ||
    signals.disclaimers_found.length > 2
  ) {
    signals.risk_level = "high";
  } else if (signals.legal_terms.length > 5) {
    signals.risk_level = "medium";
  }

  return signals;
}

async function analyzeComplianceRequirements(
  openai: OpenAI,
  content: ExtractedContent,
  signals: any,
  intakeData: any
): Promise<any> {
  const systemPrompt = `You are a compliance and legal content analyst. Create specific compliance rules.

Analyze:
1. Required disclaimers and when to use them
2. Forbidden claims or language (especially for regulated industries)
3. Legal terminology that must be used correctly
4. Risk mitigation strategies in content
5. Industry-specific compliance requirements

Return JSON with:
- description: Comprehensive compliance guide
- metadata: { required_disclaimers: [...], forbidden_claims: [...], legal_terms: {...}, risk_areas: [...] }
- sources: Attribution for each requirement`;

  try {
    const result = await openai.chat.completions.create({
      model: "gpt-4o",
      messages: [
        { role: "system", content: systemPrompt },
        {
          role: "user",
          content: JSON.stringify(
            {
              complianceSignals: signals,
              intakeData: {
                isRegulated: intakeData?.isRegulated,
                regulatedIndustryType: intakeData?.regulatedIndustryType,
                disclaimers: intakeData?.disclaimers,
                forbiddenWords: intakeData?.forbiddenWords,
              },
              existingDisclaimers: signals.disclaimers_found,
            },
            null,
            2
          ),
        },
      ],
      response_format: { type: "json_object" },
      temperature: 0.2,
      max_tokens: 3000,
    });

    return JSON.parse(result.choices[0].message.content || "{}");
  } catch (error) {
    console.error("Error analyzing compliance requirements:", error);
    return { metadata: {}, sources: [] };
  }
}

// ============================================================================
// NEW: AI-POWERED GHL IMPLEMENTATION ANALYSIS
// ============================================================================

async function analyzeGHLImplementation(
  openai: OpenAI,
  content: ExtractedContent,
  intakeData: any
): Promise<any> {
  try {
    // Extract CRM-relevant patterns
    const crmPatterns = extractCRMPatterns(content);

    // AI analysis of implementation strategy
    const ghlStrategy = await analyzeGHLStrategy(
      openai,
      content,
      crmPatterns,
      intakeData
    );

    return {
      title: "GoHighLevel Implementation Notes",
      description: ghlStrategy.description || "GHL implementation strategy.",
      metadata: ghlStrategy.metadata || {},
      confidence_score: calculateGHLConfidence(crmPatterns),
      source_attribution: ghlStrategy.sources || [],
    };
  } catch (error) {
    console.error("Error analyzing GHL implementation:", error);
    return {
      title: "GoHighLevel Implementation Notes",
      description: generateGHLNotesFallback(intakeData),
      metadata: {},
      confidence_score: 30,
      source_attribution: [],
    };
  }
}

function extractCRMPatterns(content: ExtractedContent): any {
  const patterns = {
    customer_journey_stages: [] as string[],
    touchpoints: [] as string[],
    automation_opportunities: [] as string[],
    communication_channels: [] as string[],
  };

  const journeyKeywords = [
    "lead",
    "prospect",
    "customer",
    "onboarding",
    "nurture",
    "conversion",
  ];
  const touchpointKeywords = [
    "email",
    "sms",
    "call",
    "meeting",
    "follow-up",
    "reminder",
  ];
  const automationKeywords = [
    "workflow",
    "sequence",
    "trigger",
    "automated",
    "scheduled",
  ];

  const allText = content.website.fullText.toLowerCase();

  journeyKeywords.forEach((kw) => {
    if (allText.includes(kw)) patterns.customer_journey_stages.push(kw);
  });

  touchpointKeywords.forEach((kw) => {
    if (allText.includes(kw)) patterns.touchpoints.push(kw);
  });

  automationKeywords.forEach((kw) => {
    if (allText.includes(kw)) patterns.automation_opportunities.push(kw);
  });

  return patterns;
}

async function analyzeGHLStrategy(
  openai: OpenAI,
  content: ExtractedContent,
  patterns: any,
  intakeData: any
): Promise<any> {
  const systemPrompt = `You are a CRM implementation strategist. Create GHL-specific implementation notes.

Focus on:
1. Workflow automation opportunities based on their business model
2. Customer journey mapping for GHL pipelines
3. Communication sequences and templates
4. Integration points with their existing tools
5. Specific GHL features they should leverage

Return JSON with:
- description: Implementation strategy guide
- metadata: { workflows: [...], pipelines: [...], automations: [...], templates: [...] }
- sources: Attribution for each recommendation`;

  try {
    const result = await openai.chat.completions.create({
      model: "gpt-4o",
      messages: [
        { role: "system", content: systemPrompt },
        {
          role: "user",
          content: JSON.stringify(
            {
              crmPatterns: patterns,
              intakeData: {
                crmPlatform: intakeData?.crmPlatform,
                crmSubaccount: intakeData?.crmSubaccount,
                pipelineStages: intakeData?.pipelineStages,
                supportEmail: intakeData?.supportEmail,
                emailSignoff: intakeData?.emailSignoff,
              },
              businessModel: {
                services: content.website.services.substring(0, 1000),
                customerJourney: patterns.customer_journey_stages,
              },
            },
            null,
            2
          ),
        },
      ],
      response_format: { type: "json_object" },
      temperature: 0.3,
      max_tokens: 3000,
    });

    return JSON.parse(result.choices[0].message.content || "{}");
  } catch (error) {
    console.error("Error analyzing GHL strategy:", error);
    return { metadata: {}, sources: [] };
  }
}

// ============================================================================
// CONFIDENCE SCORING
// ============================================================================

function calculateStyleConfidence(patterns: any, analysis: any): number {
  let score = 40; // Base score

  if (patterns.heading_styles.length > 0) score += 15;
  if (patterns.paragraph_length.length > 5) score += 15;
  if (patterns.formatting_markers.length > 0) score += 10;
  if (analysis.metadata?.rules?.length > 3) score += 20;

  return Math.min(score, 100);
}

function calculateComplianceConfidence(signals: any): number {
  let score = 30; // Base score

  if (signals.disclaimers_found.length > 0) score += 25;
  if (signals.legal_terms.length > 3) score += 20;
  if (signals.regulatory_keywords.length > 0) score += 15;
  if (signals.risk_level === "high") score += 10;

  return Math.min(score, 100);
}

function calculateGHLConfidence(patterns: any): number {
  let score = 35; // Base score

  if (patterns.customer_journey_stages.length > 2) score += 20;
  if (patterns.touchpoints.length > 2) score += 20;
  if (patterns.automation_opportunities.length > 0) score += 15;
  if (patterns.communication_channels.length > 1) score += 10;

  return Math.min(score, 100);
}

// ============================================================================
// FALLBACK FUNCTIONS (existing simple versions)
// ============================================================================

function generateStyleRulesFallback(intakeData: any): string {
  const rules: string[] = [];
  if (intakeData?.forbiddenWords)
    rules.push(`Forbidden Words: ${intakeData.forbiddenWords}`);
  if (intakeData?.soundsLike)
    rules.push(`Sound Like: ${intakeData.soundsLike}`);
  return rules.length > 0
    ? rules.join("\n\n")
    : "Style rules based on your preferences.";
}

function generateComplianceRulesFallback(intakeData: any): string {
  const rules: string[] = [];
  if (intakeData?.disclaimers)
    rules.push(`Required Disclaimers:\n${intakeData.disclaimers}`);
  if (intakeData?.forbiddenWords)
    rules.push(`Never Use: ${intakeData.forbiddenWords}`);
  return rules.length > 0 ? rules.join("\n\n") : "Compliance guidelines.";
}

function generateGHLNotesFallback(intakeData: any): string {
  const notes: string[] = [];
  if (intakeData?.crmPlatform) notes.push(`CRM: ${intakeData.crmPlatform}`);
  if (intakeData?.pipelineStages)
    notes.push(`Pipelines: ${intakeData.pipelineStages}`);
  return notes.length > 0 ? notes.join("\n\n") : "GHL implementation notes.";
}

// ============================================================================
// API ROUTE HANDLER
// ============================================================================

export async function POST(request: Request) {
  console.log("[Generate-Cards] API endpoint called");
  try {
    // Authentication
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

    // Get profileId from query params
    const { searchParams } = new URL(request.url);
    const profileId = searchParams.get("profileId");

    if (!profileId) {
      return NextResponse.json(
        { success: false, error: "profileId query parameter is required." },
        { status: 400 }
      );
    }

    // Verify access to organization
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

    // Fetch business brain
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

    // Log retrieved data
    console.log("[Generate-Cards] Retrieved businessBrain:", {
      id: businessBrain.id,
      hasIntakeData: !!businessBrain.intakeData,
      intakeDataType: typeof businessBrain.intakeData,
      intakeDataIsObject: businessBrain.intakeData && typeof businessBrain.intakeData === 'object',
      intakeDataKeys: businessBrain.intakeData && typeof businessBrain.intakeData === 'object' 
        ? Object.keys(businessBrain.intakeData as any) 
        : 'not an object',
    });
    
    // Ensure intakeData is properly parsed (Prisma JSON fields might be strings)
    let parsedIntakeData = businessBrain.intakeData;
    if (typeof parsedIntakeData === 'string') {
      try {
        parsedIntakeData = JSON.parse(parsedIntakeData);
        console.log("[Generate-Cards] Parsed intakeData from string");
      } catch (e) {
        console.error("[Generate-Cards] Failed to parse intakeData string:", e);
      }
    }

    // Initialize OpenAI
    if (!process.env.OPENAI_API_KEY) {
      return NextResponse.json(
        { success: false, error: "OpenAI API key not configured." },
        { status: 500 }
      );
    }

    const openai = new OpenAI({
      apiKey: process.env.OPENAI_API_KEY,
    });

    // Generate and save cards
    console.log("[Generate-Cards] Starting card generation...");
    console.log("[Generate-Cards] Using parsed intakeData with keys:", parsedIntakeData ? Object.keys(parsedIntakeData as any) : "NULL");
    console.log("[Generate-Cards] Parsed intakeData sample:", {
      legalName: (parsedIntakeData as any)?.legalName,
      website: (parsedIntakeData as any)?.website,
      offers: (parsedIntakeData as any)?.offers?.substring(0, 100),
      formalCasual: (parsedIntakeData as any)?.formalCasual,
      soundsLike: (parsedIntakeData as any)?.soundsLike,
      icps: (parsedIntakeData as any)?.icps?.length,
    });
    
    const cards = await generateAndSaveCards(
      openai,
      profileId,
      parsedIntakeData as any,
      businessBrain.fileUploads as any
    );

    console.log(`[Generate-Cards] Generated ${cards.length} cards successfully`);

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
        confidence_score: (card as { confidence_score?: number }).confidence_score || 0,
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
