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
      const Tag = heading[1].length === 1 ? "h3" : heading[1].length === 2 ? "h4" : "h5";
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
