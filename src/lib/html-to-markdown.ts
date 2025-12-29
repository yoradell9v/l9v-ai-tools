import * as cheerio from "cheerio";

/**
 * Converts HTML to markdown
 * @param html - The HTML string to convert
 * @returns string - The markdown string
 */
export function htmlToMarkdown(html: string): string {
  try {
    const $ = cheerio.load(html);
    let markdown = "";

    // Convert inline HTML elements to markdown
    const convertInlineElements = ($el: cheerio.Cheerio<any>): string => {
      let result = "";
      
      $el.contents().each((_, node) => {
        if (node.type === "text") {
          result += node.data || "";
        } else if (node.type === "tag") {
          const $node = $(node);
          const tagName = node.tagName?.toLowerCase();
          
          switch (tagName) {
            case "strong":
            case "b":
              result += `**${$node.text()}**`;
              break;
            case "em":
            case "i":
              result += `*${$node.text()}*`;
              break;
            case "code":
              result += `\`${$node.text()}\``;
              break;
            case "a":
              const linkText = $node.text();
              const href = $node.attr("href") || "";
              result += `[${linkText}](${href})`;
              break;
            case "br":
              result += "\n";
              break;
            default:
              result += $node.text();
          }
        }
      });
      
      return result.trim();
    };

    // Process top-level elements
    const processElement = ($el: cheerio.Cheerio<any>): string => {
      const tagName = $el[0]?.tagName?.toLowerCase();
      if (!tagName) return "";

      switch (tagName) {
        case "h1":
          return `# ${convertInlineElements($el)}\n\n`;
        case "h2":
          return `## ${convertInlineElements($el)}\n\n`;
        case "h3":
          return `### ${convertInlineElements($el)}\n\n`;
        case "h4":
          return `#### ${convertInlineElements($el)}\n\n`;
        case "h5":
          return `##### ${convertInlineElements($el)}\n\n`;
        case "h6":
          return `###### ${convertInlineElements($el)}\n\n`;
        case "p":
          return `${convertInlineElements($el)}\n\n`;
        case "ul":
          let ulMarkdown = "";
          $el.find("> li").each((_, li) => {
            const $li = $(li);
            ulMarkdown += `- ${convertInlineElements($li)}\n`;
          });
          return ulMarkdown + "\n";
        case "ol":
          let olMarkdown = "";
          let counter = 1;
          $el.find("> li").each((_, li) => {
            const $li = $(li);
            olMarkdown += `${counter}. ${convertInlineElements($li)}\n`;
            counter++;
          });
          return olMarkdown + "\n";
        case "blockquote":
          const blockquoteText = convertInlineElements($el);
          return `> ${blockquoteText.split("\n").join("\n> ")}\n\n`;
        case "pre":
          const code = $el.find("code").text() || $el.text();
          return "```\n" + code + "\n```\n\n";
        case "hr":
          return "---\n\n";
        case "table":
          const rows: string[][] = [];
          $el.find("tr").each((_, tr) => {
            const row: string[] = [];
            $(tr)
              .find("th, td")
              .each((_, cell) => {
                row.push($(cell).text().trim());
              });
            if (row.length > 0) {
              rows.push(row);
            }
          });
          if (rows.length > 0) {
            let tableMarkdown = "| " + rows[0].join(" | ") + " |\n";
            tableMarkdown += "| " + rows[0].map(() => "---").join(" | ") + " |\n";
            for (let i = 1; i < rows.length; i++) {
              tableMarkdown += "| " + rows[i].join(" | ") + " |\n";
            }
            return tableMarkdown + "\n";
          }
          return "";
        default:
          // For other block elements, process children
          if ($el.children().length > 0) {
            let result = "";
            $el.children().each((_, child) => {
              result += processElement($(child));
            });
            return result;
          }
          // For inline elements, just get text
          return $el.text().trim() + "\n\n";
      }
    };

    // Process body or root elements
    const $body = $("body");
    if ($body.length > 0) {
      $body.children().each((_, element) => {
        markdown += processElement($(element));
      });
    } else {
      // No body tag, process root elements
      $("*").filter((_, el) => {
        const $el = $(el);
        return $el.parent().length === 0 || $el.parent()[0]?.tagName === "body";
      }).each((_, element) => {
        markdown += processElement($(element));
      });
    }

    // Clean up extra newlines
    markdown = markdown.replace(/\n{3,}/g, "\n\n").trim();

    return markdown;
  } catch (error) {
    console.error("[HTML to Markdown] Error:", error);
    // Fallback: return plain text with HTML tags stripped
    return html.replace(/<[^>]*>/g, "").trim();
  }
}


