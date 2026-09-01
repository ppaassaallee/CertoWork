import type { ReactNode } from "react";

function splitKeep(text: string, pattern: RegExp) {
  return String(text || "").split(pattern);
}

function inlineMarkup(text: string, keyPrefix: string): ReactNode[] {
  const nodes: ReactNode[] = [];
  const token = /(`[^`]+`|\*\*[^*]+\*\*|__[^_]+__|\*[^*]+\*|_[^_]+_|~~[^~]+~~)/g;
  const parts = splitKeep(text, token);
  parts.forEach((part, index) => {
    if (!part) return;
    const key = `${keyPrefix}-${index}`;
    if (part.startsWith("`") && part.endsWith("`") && part.length >= 2) {
      nodes.push(<code key={key}>{part.slice(1, -1)}</code>);
      return;
    }
    if ((part.startsWith("**") && part.endsWith("**") && part.length >= 4) ||
        (part.startsWith("__") && part.endsWith("__") && part.length >= 4)) {
      nodes.push(<strong key={key}>{inlineMarkup(part.slice(2, -2), key)}</strong>);
      return;
    }
    if ((part.startsWith("*") && part.endsWith("*") && part.length >= 2) ||
        (part.startsWith("_") && part.endsWith("_") && part.length >= 2)) {
      nodes.push(<em key={key}>{inlineMarkup(part.slice(1, -1), key)}</em>);
      return;
    }
    if (part.startsWith("~~") && part.endsWith("~~") && part.length >= 4) {
      nodes.push(<s key={key}>{inlineMarkup(part.slice(2, -2), key)}</s>);
      return;
    }
    nodes.push(<span key={key}>{part}</span>);
  });
  return nodes;
}

export function plainNoteText(text: string) {
  return String(text || "")
    .replace(/[`*_~#]/g, "")
    .replace(/\s+/g, " ")
    .trim();
}

function escapeHtml(value: string) {
  return value
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;");
}

function decodeEntities(value: string) {
  return value
    .replace(/&nbsp;/gi, " ")
    .replace(/&amp;/g, "&")
    .replace(/&lt;/g, "<")
    .replace(/&gt;/g, ">")
    .replace(/&quot;/g, '"')
    .replace(/&#39;/g, "'");
}

function inlineHtml(text: string): string {
  const token = /(`[^`]+`|\*\*[^*]+\*\*|__[^_]+__|\*[^*]+\*|_[^_]+_|~~[^~]+~~)/g;
  return splitKeep(text, token)
    .map((part) => {
      if (!part) return "";
      if (part.startsWith("`") && part.endsWith("`") && part.length >= 2) {
        return `<code>${escapeHtml(part.slice(1, -1))}</code>`;
      }
      if ((part.startsWith("**") && part.endsWith("**") && part.length >= 4) ||
          (part.startsWith("__") && part.endsWith("__") && part.length >= 4)) {
        return `<strong>${inlineHtml(part.slice(2, -2))}</strong>`;
      }
      if ((part.startsWith("*") && part.endsWith("*") && part.length >= 2) ||
          (part.startsWith("_") && part.endsWith("_") && part.length >= 2)) {
        return `<em>${inlineHtml(part.slice(1, -1))}</em>`;
      }
      if (part.startsWith("~~") && part.endsWith("~~") && part.length >= 4) {
        return `<s>${inlineHtml(part.slice(2, -2))}</s>`;
      }
      return escapeHtml(part);
    })
    .join("");
}

export function markdownToHtml(text: string) {
  const lines = String(text || "").split(/\n/);
  const blocks: string[] = [];
  let list: string[] = [];

  const flushList = () => {
    if (!list.length) return;
    blocks.push(`<ul>${list.map((item) => `<li>${inlineHtml(item)}</li>`).join("")}</ul>`);
    list = [];
  };

  lines.forEach((line) => {
    const heading = line.match(/^(#{1,3})\s+(.+)$/);
    const bullet = line.match(/^\s*[-*+]\s+(.+)$/);
    if (heading) {
      flushList();
      const tag = heading[1].length === 1 ? "h1" : heading[1].length === 2 ? "h2" : "h3";
      blocks.push(`<${tag}>${inlineHtml(heading[2])}</${tag}>`);
      return;
    }
    if (bullet) {
      list.push(bullet[1]);
      return;
    }
    flushList();
    if (!line.trim()) {
      blocks.push("<p><br></p>");
      return;
    }
    blocks.push(`<p>${inlineHtml(line)}</p>`);
  });
  flushList();
  return blocks.join("");
}

function unwrapInlineHtml(html: string) {
  let current = html;
  for (let i = 0; i < 12; i += 1) {
    const next = current
      .replace(/<(strong|b)(?:\s[^>]*)?>([\s\S]*?)<\/\1>/gi, "**$2**")
      .replace(/<(em|i)(?:\s[^>]*)?>([\s\S]*?)<\/\1>/gi, "*$2*")
      .replace(/<(s|strike|del)(?:\s[^>]*)?>([\s\S]*?)<\/\1>/gi, "~~$2~~")
      .replace(/<code(?:\s[^>]*)?>([\s\S]*?)<\/code>/gi, "`$1`");
    if (next === current) break;
    current = next;
  }
  return current.replace(/<[^>]+>/g, "");
}

export function htmlToMarkdown(html: string) {
  let value = String(html || "")
    .replace(/\u00a0/g, " ")
    .replace(/<br\s*\/?>/gi, "\n");

  value = value.replace(/<h1(?:\s[^>]*)?>([\s\S]*?)<\/h1>/gi, (_, inner) => `\n# ${unwrapInlineHtml(inner).replace(/\n+/g, " ").trim()}\n`);
  value = value.replace(/<h2(?:\s[^>]*)?>([\s\S]*?)<\/h2>/gi, (_, inner) => `\n## ${unwrapInlineHtml(inner).replace(/\n+/g, " ").trim()}\n`);
  value = value.replace(/<h3(?:\s[^>]*)?>([\s\S]*?)<\/h3>/gi, (_, inner) => `\n### ${unwrapInlineHtml(inner).replace(/\n+/g, " ").trim()}\n`);
  value = value.replace(/<h[4-6](?:\s[^>]*)?>([\s\S]*?)<\/h[4-6]>/gi, (_, inner) => `\n### ${unwrapInlineHtml(inner).replace(/\n+/g, " ").trim()}\n`);
  value = value.replace(/<li(?:\s[^>]*)?>([\s\S]*?)<\/li>/gi, (_, inner) => `- ${unwrapInlineHtml(inner).replace(/\n+/g, " ").trim()}\n`);
  value = value.replace(/<\/?(ul|ol)(?:\s[^>]*)?>/gi, "\n");
  value = value.replace(/<p(?:\s[^>]*)?>([\s\S]*?)<\/p>/gi, (_, inner) => `\n${unwrapInlineHtml(inner).trim()}\n`);
  value = value.replace(/<div(?:\s[^>]*)?>([\s\S]*?)<\/div>/gi, (_, inner) => `\n${unwrapInlineHtml(inner)}\n`);
  value = unwrapInlineHtml(value);
  value = decodeEntities(value);
  return value.replace(/\n{3,}/g, "\n\n").trim();
}

export function renderNoteMarkup(text: string) {
  const lines = String(text || "").split(/\n/);
  const blocks: ReactNode[] = [];
  let list: string[] = [];

  const flushList = () => {
    if (!list.length) return;
    blocks.push(
      <ul key={`list-${blocks.length}`}>
        {list.map((item, index) => (
          <li key={index}>{inlineMarkup(item, `li-${blocks.length}-${index}`)}</li>
        ))}
      </ul>,
    );
    list = [];
  };

  lines.forEach((line, index) => {
    const heading = line.match(/^(#{1,3})\s+(.+)$/);
    const bullet = line.match(/^\s*[-*+]\s+(.+)$/);
    if (heading) {
      flushList();
      const Tag = heading[1].length === 1 ? "h1" : heading[1].length === 2 ? "h2" : "h3";
      blocks.push(<Tag key={`h-${index}`}>{inlineMarkup(heading[2], `h-${index}`)}</Tag>);
      return;
    }
    if (bullet) {
      list.push(bullet[1]);
      return;
    }
    flushList();
    if (!line.trim()) {
      blocks.push(<div className="do-note-break" key={`br-${index}`} />);
      return;
    }
    blocks.push(<p key={`p-${index}`}>{inlineMarkup(line, `p-${index}`)}</p>);
  });
  flushList();
  return blocks;
}
