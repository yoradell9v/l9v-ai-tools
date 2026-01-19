import { remark } from 'remark';
import remarkGfm from 'remark-gfm';
import remarkRehype from 'remark-rehype';
import rehypeStringify from 'rehype-stringify';
import rehypeSanitize from 'rehype-sanitize';

/**
 * Converts markdown to HTML
 * @param markdown - The markdown string to convert
 * @returns Promise<string> - The HTML string (body content only)
 */
export async function markdownToHtml(markdown: string): Promise<string> {
  try {
    const file = await remark()
      .use(remarkGfm)
      .use(remarkRehype, { allowDangerousHtml: false })
      .use(rehypeSanitize)
      .use(rehypeStringify)
      .process(markdown);

    // Extract HTML content from the VFile
    const html = String(file);
    
    // Check if conversion actually worked - if it's just wrapped in pre/code, it failed
    const trimmed = html.trim();
    if (trimmed.startsWith('<pre><code') && (trimmed.includes('language-markdown') || trimmed.includes('class="language-'))) {
      console.error('[Markdown to HTML] Conversion resulted in code block wrapper - conversion failed');
      throw new Error('Conversion resulted in code block wrapper - conversion likely failed');
    }
    
    // Check if it's just escaped markdown (conversion failed)
    if (trimmed.startsWith('<pre>') && !trimmed.includes('<h') && !trimmed.includes('<p>') && !trimmed.includes('<ul>') && !trimmed.includes('<ol>')) {
      console.error('[Markdown to HTML] Result is escaped markdown, not HTML - conversion failed');
      throw new Error('Result is escaped markdown, not HTML - conversion failed');
    }
    
    // If the HTML is wrapped in a document structure, extract body content
    if (html.includes('<body>')) {
      const cheerio = await import('cheerio');
      const $ = cheerio.load(html);
      const bodyContent = $('body').html() || '';
      const bodyTrimmed = bodyContent.trim();
      if (bodyTrimmed.startsWith('<pre><code') && (bodyTrimmed.includes('language-markdown') || bodyTrimmed.includes('class="language-'))) {
        console.error('[Markdown to HTML] Body content is wrapped in code block - conversion failed');
        throw new Error('Body content is wrapped in code block - conversion failed');
      }
      return bodyContent.trim();
    }
    
    return html.trim();
  } catch (error) {
    console.error('[Markdown to HTML] Error:', error);
    // Don't return fallback - throw error so OpenAI conversion can be used
    throw error;
  }
}

/**
 * Synchronous version for client-side use
 * Note: This uses a simpler approach for client-side
 */
export function markdownToHtmlSync(markdown: string): string {
  // For client-side, we'll use a simpler regex-based approach
  // or we can use the async version with a wrapper
  // For now, return a basic conversion
  try {
    // Basic markdown to HTML conversion (can be enhanced)
    let html = markdown
      // Headers
      .replace(/^### (.*$)/gim, '<h3>$1</h3>')
      .replace(/^## (.*$)/gim, '<h2>$1</h2>')
      .replace(/^# (.*$)/gim, '<h1>$1</h1>')
      // Bold
      .replace(/\*\*(.+?)\*\*/g, '<strong>$1</strong>')
      // Italic
      .replace(/\*(.+?)\*/g, '<em>$1</em>')
      // Code blocks
      .replace(/```([\s\S]*?)```/g, '<pre><code>$1</code></pre>')
      // Inline code
      .replace(/`(.+?)`/g, '<code>$1</code>')
      // Links
      .replace(/\[(.+?)\]\((.+?)\)/g, '<a href="$2">$1</a>')
      // Line breaks
      .replace(/\n\n/g, '</p><p>')
      .replace(/\n/g, '<br>');

    // Wrap in paragraph if not already wrapped
    if (!html.startsWith('<')) {
      html = '<p>' + html + '</p>';
    }

    return html;
  } catch (error) {
    console.error('[Markdown to HTML Sync] Error:', error);
    return `<pre>${markdown.replace(/</g, '&lt;').replace(/>/g, '&gt;')}</pre>`;
  }
}

