export function parseCleanJSON(str: string): any {
  if (!str) return null;
  let cleaned = str.replace(/^```json\n?/gi, "").replace(/```\n?$/g, "").trim();
  cleaned = cleaned.replace(/\/\/.*/g, "");
  cleaned = cleaned.replace(/\/\*[\s\S]*?\*\//g, "");
  cleaned = cleaned.replace(/,\s*([\]}])/g, "$1");
  try {
    return JSON.parse(cleaned);
  } catch (err) {
    try {
      let withinString = false;
      let fixed = "";
      for (let i = 0; i < cleaned.length; i++) {
        const char = cleaned[i];
        if (char === '"' && (i === 0 || cleaned[i - 1] !== "\\")) {
          withinString = !withinString;
          fixed += char;
        } else if (char === "\n" && withinString) {
          fixed += "\\n";
        } else if (char === "\r" && withinString) {
          fixed += "\\r";
        } else {
          fixed += char;
        }
      }
      return JSON.parse(fixed);
    } catch {
      console.error("[parseCleanJSON] Failed to parse cleaned JSON.");
      throw err;
    }
  }
}
