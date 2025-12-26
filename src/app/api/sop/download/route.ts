import { NextResponse } from "next/server";
import {
  PDFDocument,
  PDFPage,
  PDFFont,
  StandardFonts,
  rgb,
  RGB,
} from "pdf-lib";
import { markdownToHtml } from "@/lib/markdown-to-html";
import * as cheerio from "cheerio";
import OpenAI from "openai";

const openai = new OpenAI({
  apiKey: process.env.OPENAI_API_KEY,
});

// System prompt for markdown to HTML conversion using OpenAI (fallback)
const MARKDOWN_TO_HTML_SYSTEM_PROMPT = `You are a markdown to HTML converter. Your job is to convert markdown content into clean, semantic HTML.

Rules:
1. Convert ALL markdown syntax to proper HTML tags
2. Use semantic HTML5 tags (article, section, header, etc.) where appropriate
3. Preserve all content exactly as provided
4. Add appropriate structure:
   - Headings: h1, h2, h3, h4, h5, h6
   - Paragraphs: <p> tags
   - Lists: <ul> and <ol> with <li> items
   - Code blocks: <pre><code>
   - Inline code: <code>
   - Tables: <table> with <thead>, <tbody>, <tr>, <th>, <td>
   - Bold: <strong>
   - Italic: <em>
   - Links: <a href="...">
   - Blockquotes: <blockquote>
5. Return ONLY the HTML content, no markdown backticks or explanations
6. Do not add <!DOCTYPE>, <html>, <head>, or <body> tags - just the content HTML
7. Ensure proper HTML entity encoding for special characters`;

/**
 * Convert markdown to HTML using OpenAI as a fallback
 */
async function convertMarkdownToHtmlWithOpenAI(markdown: string): Promise<string> {
  try {
    console.log("[SOP Download] Converting markdown to HTML with OpenAI, length:", markdown.length);
    
    const completion = await openai.chat.completions.create({
      model: "gpt-4o-mini", // Fast and cheap for conversion
      messages: [
        { role: "system", content: MARKDOWN_TO_HTML_SYSTEM_PROMPT },
        { role: "user", content: markdown },
      ],
      temperature: 0, // Deterministic output
      max_tokens: 16000, // Large enough for full SOP HTML
    });

    let html = completion.choices[0].message.content || "";
    
    // Remove any markdown code fences that might have slipped through
    html = html.replace(/```html\n?/g, "").replace(/```\n?/g, "").trim();
    
    console.log("[SOP Download] OpenAI HTML conversion complete, length:", html.length);
    
    return html;
  } catch (error) {
    console.error("[SOP Download] Error converting markdown to HTML with OpenAI:", error);
    throw error;
  }
}

export async function POST(request: Request) {
  try {
    const data = await request.json();
    const { sopContent, title: sopTitle } = data;

    if (!sopContent || typeof sopContent !== "string") {
      return NextResponse.json(
        { error: "sopContent is required and must be a string" },
        { status: 400 }
      );
    }

    // Generate filename
    const title = sopTitle || "Standard_Operating_Procedure";
    const timestamp = new Date().toISOString().replace(/[:.]/g, "-").split("T")[0];
    const filename = `${title.replace(/[^a-zA-Z0-9]/g, "_")}_${timestamp}.pdf`;

    // Convert markdown to HTML first
    // Try library-based conversion first (fast and free), fallback to OpenAI if needed
    let htmlContent: string;
    try {
      console.log("[SOP Download] Converting markdown to HTML, input length:", sopContent.length);
      
      // First, try the library-based conversion
      try {
        htmlContent = await markdownToHtml(sopContent);
        console.log("[SOP Download] Library conversion successful, output length:", htmlContent.length);
        
        // Verify we got valid HTML
        if (!htmlContent || htmlContent.trim().length === 0) {
          throw new Error("Library conversion returned empty result");
        }
        
        // Check if it actually looks like HTML (has tags)
        if (!htmlContent.includes("<")) {
          throw new Error("Library conversion did not produce HTML tags");
        }
        
        // Check if it still contains markdown syntax (indicates conversion failed)
        if (htmlContent.includes("```") && !htmlContent.includes("<code>")) {
          throw new Error("Library conversion may have failed (contains markdown code fences)");
        }
      } catch (libraryError: any) {
        console.warn("[SOP Download] Library conversion failed or produced poor results, falling back to OpenAI:", libraryError.message);
        
        // Fallback to OpenAI conversion
        htmlContent = await convertMarkdownToHtmlWithOpenAI(sopContent);
        console.log("[SOP Download] OpenAI fallback conversion successful, output length:", htmlContent.length);
      }
      
      // Final verification
      if (!htmlContent || htmlContent.trim().length === 0) {
        throw new Error("All HTML conversion methods failed");
      }
    } catch (error) {
      console.error("[SOP Download] Error converting markdown to HTML:", error);
      return NextResponse.json(
        { error: `Failed to convert markdown to HTML: ${error instanceof Error ? error.message : "Unknown error"}` },
        { status: 500 }
      );
    }

    // Parse HTML using cheerio
    const $ = cheerio.load(htmlContent);

    // Create PDF
    const pdfDoc = await PDFDocument.create();
    let page = pdfDoc.addPage();
    const { width, height } = page.getSize();
    const font = await pdfDoc.embedFont(StandardFonts.Helvetica);
    const fontBold = await pdfDoc.embedFont(StandardFonts.HelveticaBold);
    const fontItalic = await pdfDoc.embedFont(StandardFonts.HelveticaOblique);
    const fontBoldItalic = await pdfDoc.embedFont(StandardFonts.HelveticaBoldOblique);

    const margin = 50;
    let y = height - margin;
    const lineHeight = 14;
    const paragraphSpacing = 8;

    // Helper function to sanitize text for PDF encoding (remove emojis and non-ASCII characters)
    const sanitizeText = (text: string): string => {
      if (!text) return '';
      
      // First, replace common special characters with ASCII equivalents
      const replacements: { [key: string]: string } = {
        '\u2014': '--',  // em dash
        '\u2013': '-',   // en dash
        '\u201C': '"',   // left double quote
        '\u201D': '"',   // right double quote
        '\u2018': "'",   // left single quote
        '\u2019': "'",   // right single quote
        '\u2026': '...', // ellipsis
        '\u00A9': '(c)', // copyright
        '\u00AE': '(R)', // registered
        '\u2122': '(TM)', // trademark
        '\u20AC': 'EUR', // euro
        '\u00A3': 'GBP', // pound
        '\u00A5': 'JPY', // yen
        '\u00B0': 'deg', // degree
        '\u00B1': '+/-', // plus-minus
        '\u00D7': 'x',   // multiplication
        '\u00F7': '/',   // division
        '\u00BD': '1/2', // one half
        '\u00BC': '1/4', // one quarter
        '\u00BE': '3/4', // three quarters
        '\u2153': '1/3', // one third
        '\u2154': '2/3', // two thirds
      };
      
      let sanitized = text;
      
      // Replace known special characters
      for (const [char, replacement] of Object.entries(replacements)) {
        sanitized = sanitized.replace(new RegExp(char, 'g'), replacement);
      }
      
      // Remove emojis and other non-ASCII characters that can't be encoded in WinAnsi
      // This regex matches any character outside the basic ASCII range (0-127)
      sanitized = sanitized.replace(/[^\x00-\x7F]/g, '');
      
      return sanitized.trim();
    };

    // Helper function to split text into lines
    const splitTextIntoLines = (
      text: string,
      maxWidth: number,
      fontSize: number,
      fontToUse: PDFFont
    ): string[] => {
      // Sanitize text before processing
      const sanitizedText = sanitizeText(text);
      const words = sanitizedText.split(/\s+/);
      const lines: string[] = [];
      let line = "";
      for (const word of words) {
        const testLine = line + (line ? " " : "") + word;
        const width = fontToUse.widthOfTextAtSize(testLine, fontSize);
        if (width > maxWidth && line !== "") {
          lines.push(line.trim());
          line = word;
        } else {
          line = testLine;
        }
      }
      if (line) lines.push(line.trim());
      return lines;
    };

    // Helper to draw text and handle page breaks
    const drawText = (
      text: string,
      opts: {
        size?: number;
        bold?: boolean;
        italic?: boolean;
        color?: RGB;
        spacing?: number;
      } = {}
    ) => {
      const {
        size = 12,
        bold = false,
        italic = false,
        color = rgb(0, 0, 0),
        spacing = lineHeight,
      } = opts;

      // Sanitize text before processing
      const sanitizedText = sanitizeText(text);
      if (!sanitizedText) return; // Skip empty text after sanitization

      let fontToUse = font;
      if (bold && italic) {
        fontToUse = fontBoldItalic;
      } else if (bold) {
        fontToUse = fontBold;
      } else if (italic) {
        fontToUse = fontItalic;
      }

      const lines = splitTextIntoLines(sanitizedText, width - margin * 2, size, fontToUse);
      
      for (const line of lines) {
        if (y < margin + size) {
          // New page if we run out of space
          const newPage = pdfDoc.addPage();
          y = height - margin;
          page = newPage;
        }
        // Ensure line is safe for PDF encoding
        const safeLine = sanitizeText(line);
        if (safeLine) {
          page.drawText(safeLine, { x: margin, y, size, font: fontToUse, color });
        }
        y -= spacing;
      }
    };

    // Parse HTML and convert to PDF
    const parseHtml = () => {
      // Extract text content from HTML elements
      // Handle both full documents and HTML fragments
      const rootElements = $('body').length > 0 ? $('body').children() : $.root().children();
      
      rootElements.each((_, element) => {
        const $el = $(element);
        const tagName = element.tagName?.toLowerCase();

        // Handle headers
        if (tagName === 'h1') {
          y -= 10;
          const text = sanitizeText($el.text());
          if (text) {
            drawText(text, {
              size: 20,
              bold: true,
              color: rgb(0.1, 0.1, 0.5),
              spacing: 16,
            });
            y -= 5;
          }
        } else if (tagName === 'h2') {
          y -= 8;
          const text = sanitizeText($el.text());
          if (text) {
            drawText(text, {
              size: 16,
              bold: true,
              color: rgb(0.1, 0.1, 0.5),
              spacing: 14,
            });
            y -= 5;
          }
        } else if (tagName === 'h3') {
          y -= 6;
          const text = sanitizeText($el.text());
          if (text) {
            drawText(text, {
              size: 14,
              bold: true,
              color: rgb(0.2, 0.2, 0.4),
              spacing: 13,
            });
            y -= 4;
          }
        } else if (tagName === 'h4' || tagName === 'h5' || tagName === 'h6') {
          y -= 4;
          const text = sanitizeText($el.text());
          if (text) {
            drawText(text, {
              size: 12,
              bold: true,
              color: rgb(0.2, 0.2, 0.4),
              spacing: 12,
            });
            y -= 3;
          }
        } else if (tagName === 'p') {
          const text = sanitizeText($el.text());
          if (text) {
            drawText(text, {
              size: 11,
              spacing: 13,
            });
          }
          y -= paragraphSpacing / 2;
        } else if (tagName === 'ul' || tagName === 'ol') {
          let listCounter = 1;
          $el.find('li').each((_, li) => {
            const listItemText = sanitizeText($(li).text());
            if (listItemText) {
              const prefix = tagName === 'ol' ? `${listCounter}. ` : '• ';
              drawText(`${prefix}${listItemText}`, {
                size: 11,
                spacing: 13,
              });
              if (tagName === 'ol') listCounter++;
            }
          });
          y -= paragraphSpacing;
        } else if (tagName === 'pre' || tagName === 'code') {
          const codeText = sanitizeText($el.text());
          if (codeText) {
            y -= 5;
            drawText(codeText, {
              size: 10,
              color: rgb(0.2, 0.2, 0.2),
              spacing: 12,
            });
            y -= 5;
          }
        } else if (tagName === 'hr') {
          y -= 10;
          page.drawLine({
            start: { x: margin, y },
            end: { x: width - margin, y },
            thickness: 1,
            color: rgb(0.7, 0.7, 0.7),
          });
          y -= 10;
        } else if (tagName === 'blockquote') {
          const text = sanitizeText($el.text());
          if (text) {
            drawText(text, {
              size: 11,
              italic: true,
              color: rgb(0.4, 0.4, 0.4),
              spacing: 13,
            });
            y -= paragraphSpacing;
          }
        } else if (tagName === 'table') {
          // Handle tables - extract text from cells
          $el.find('tr').each((_, row) => {
            const cells: string[] = [];
            $(row).find('td, th').each((_, cell) => {
              const cellText = sanitizeText($(cell).text());
              if (cellText) {
                cells.push(cellText);
              }
            });
            if (cells.length > 0) {
              drawText(cells.join(' | '), {
                size: 10,
                spacing: 12,
              });
            }
          });
          y -= paragraphSpacing;
        } else {
          // For any other element, just extract text
          const text = sanitizeText($el.text());
          if (text && text.trim()) {
            drawText(text, {
              size: 11,
              spacing: 13,
            });
            y -= paragraphSpacing / 2;
          }
        }
      });
    };

    // Draw header
    drawText(sopTitle || "Standard Operating Procedure", {
      size: 20,
      bold: true,
      color: rgb(0.1, 0.1, 0.5),
      spacing: 16,
    });
    y -= 5;
    drawText(`Generated: ${new Date().toLocaleDateString()}`, {
      size: 10,
      color: rgb(0.5, 0.5, 0.5),
      spacing: 12,
    });
    y -= 20;

    // Parse and draw HTML content
    parseHtml();

    // Save PDF
    const pdfBytes = await pdfDoc.save();
    const buffer = Buffer.from(pdfBytes);

    return new NextResponse(buffer, {
      headers: {
        "Content-Type": "application/pdf",
        "Content-Disposition": `attachment; filename="${filename}"`,
      },
    });
  } catch (error: any) {
    console.error("[SOP Download] PDF generation error:", error);
    return NextResponse.json(
      { error: error.message || "Failed to generate PDF" },
      { status: 500 }
    );
  }
}

