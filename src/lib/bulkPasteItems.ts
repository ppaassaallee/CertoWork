export type BulkPasteKind = "pbi" | "subtask";

export type BulkPasteNode = {
  title: string;
  kind: BulkPasteKind;
  depth: number;
  children: BulkPasteNode[];
};

const BULLET = /^(?:[-*+]|#{1,6}|\d+[.)])\s+/;

export function indentDepth(line: string) {
  const leading = line.match(/^[\t ]*/)?.[0] || "";
  if (!leading) return 0;
  const expanded = leading.replace(/\t/g, "  ");
  return Math.floor(expanded.length / 2);
}

export function cleanBulkPasteTitle(line: string) {
  return line.replace(/^[\t ]+/, "").replace(BULLET, "").trim();
}

export function parseBulkPasteItems(text: string): BulkPasteNode[] {
  const roots: BulkPasteNode[] = [];
  const stack: BulkPasteNode[] = [];

  for (const raw of String(text || "").split(/\r?\n/)) {
    if (!raw.trim()) continue;
    const depth = indentDepth(raw);
    const title = cleanBulkPasteTitle(raw);
    if (!title) continue;
    const node: BulkPasteNode = {
      title: title.slice(0, 500),
      kind: depth > 0 ? "subtask" : "pbi",
      depth,
      children: [],
    };
    while (stack.length && stack[stack.length - 1].depth >= depth) stack.pop();
    if (!stack.length) {
      node.kind = "pbi";
      roots.push(node);
    } else {
      node.kind = "subtask";
      stack[stack.length - 1].children.push(node);
    }
    stack.push(node);
  }

  return roots;
}

export function countBulkPasteItems(nodes: BulkPasteNode[]): { pbis: number; subtasks: number } {
  let pbis = 0;
  let subtasks = 0;
  const walk = (items: BulkPasteNode[]) => {
    for (const item of items) {
      if (item.kind === "pbi") pbis += 1;
      else subtasks += 1;
      walk(item.children);
    }
  };
  walk(nodes);
  return { pbis, subtasks };
}
