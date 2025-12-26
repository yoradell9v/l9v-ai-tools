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
    // String(file) should give us the HTML output
    const html = String(file);
    
    // If the HTML is wrapped in a document structure, extract body content
    // Otherwise, return as-is (it should be just the content)
    if (html.includes('<body>')) {
      const cheerio = await import('cheerio');
      const $ = cheerio.load(html);
      const bodyContent = $('body').html() || '';
      return bodyContent.trim();
    }
    
    return html.trim();
  } catch (error) {
    console.error('[Markdown to HTML] Error:', error);
    // Fallback: return escaped HTML if conversion fails
    return `<pre>${markdown.replace(/</g, '&lt;').replace(/>/g, '&gt;')}</pre>`;
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

