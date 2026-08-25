/**
 * JSON source mapping: convert a JSON path (as returned by the backend
 * validators, e.g. `["actions", 3, "button"]`) into a 1-based line in
 * the raw text, and character offsets into `{line, col}` — used to
 * place Diffs editor markers on validation errors.
 *
 * A tiny tokenizer + walker instead of `JSON.parse` because the latter
 * exposes no position information.
 */

export type LineCol = { line: number; col: number };

export function positionToLineCol(text: string, pos: number): LineCol {
  const clamped = Math.max(0, Math.min(pos, text.length));
  let line = 1;
  let lineStart = 0;
  for (let i = 0; i < clamped; i++) {
    if (text.charCodeAt(i) === 10) {
      line += 1;
      lineStart = i + 1;
    }
  }
  return { line, col: clamped - lineStart + 1 };
}

type Token = {
  kind: "punct" | "string" | "number" | "literal";
  value: string;
  line: number;
};

/** Tokenize JSON enough to walk its structure. String tokens carry their
 * (escape-undecoded) content in `value`; numbers/literals their text. */
function tokenize(text: string): Token[] | null {
  const tokens: Token[] = [];
  let i = 0;
  let line = 1;
  const n = text.length;

  while (i < n) {
    const ch = text[i];
    if (ch === "\n") {
      line += 1;
      i += 1;
      continue;
    }
    if (ch === " " || ch === "\t" || ch === "\r") {
      i += 1;
      continue;
    }
    if ("{}[]:,".includes(ch)) {
      tokens.push({ kind: "punct", value: ch, line });
      i += 1;
      continue;
    }
    if (ch === '"') {
      const startLine = line;
      i += 1;
      let value = "";
      let closed = false;
      while (i < n) {
        const c = text[i];
        if (c === "\\") {
          // Keep the escape sequence verbatim; enough for key comparison.
          value += text.slice(i, i + 2);
          if (text[i + 1] === "\n") line += 1;
          i += 2;
          continue;
        }
        if (c === "\n") line += 1;
        if (c === '"') {
          i += 1;
          closed = true;
          break;
        }
        value += c;
        i += 1;
      }
      if (!closed) return null;
      tokens.push({ kind: "string", value, line: startLine });
      continue;
    }
    if (/[0-9+.-]/.test(ch)) {
      const startLine = line;
      let value = "";
      while (i < n && /[0-9eE+.-]/.test(text[i])) {
        if (text[i] === "\n") line += 1;
        value += text[i];
        i += 1;
      }
      tokens.push({ kind: "number", value, line: startLine });
      continue;
    }
    if (/[a-zA-Z_]/.test(ch)) {
      const startLine = line;
      let value = "";
      while (i < n && /[a-zA-Z_]/.test(text[i])) {
        value += text[i];
        i += 1;
      }
      tokens.push({ kind: "literal", value, line: startLine });
      continue;
    }
    return null; // unexpected character
  }
  return tokens;
}

const isValueStart = (t: Token | undefined): boolean =>
  t !== undefined && t.kind !== "punct";

/** Index just past the value starting at token index `t`. */
function skipValue(tokens: Token[], t: number): number {
  const tok = tokens[t];
  if (tok === undefined) return t;
  if (tok.kind !== "punct") return t + 1;
  if (tok.value === "{" || tok.value === "[") {
    let depth = 0;
    let i = t;
    while (i < tokens.length) {
      const v = tokens[i].value;
      if (v === "{" || v === "[") depth += 1;
      else if (v === "}" || v === "]") {
        depth -= 1;
        if (depth === 0) return i + 1;
      }
      i += 1;
    }
    return i;
  }
  return t + 1;
}

/**
 * Find the 1-based line of the value addressed by `path` in `text`.
 * Object keys are matched as strings ("buttons", "3"); array indices as
 * numbers. Returns null when the text is not well-formed JSON or the
 * path does not resolve.
 */
export function locatePathLine(
  text: string,
  path: (string | number)[],
): number | null {
  const tokens = tokenize(text);
  if (tokens === null || tokens.length === 0) return null;

  let at = 0;
  for (const seg of path) {
    const tok = tokens[at];
    if (tok === undefined) return null;

    if (typeof seg === "string") {
      // Walk object entries: string key, ':', value, ',' ...
      if (tok.value !== "{") return null;
      let i = at + 1;
      let found: number | null = null;
      while (i < tokens.length && tokens[i].value !== "}") {
        const keyTok = tokens[i];
        if (keyTok.kind !== "string") return null;
        if (tokens[i + 1]?.value !== ":") return null;
        const valueIdx = i + 2;
        if (keyTok.value === seg) {
          found = valueIdx;
          break;
        }
        i = skipValue(tokens, valueIdx);
        if (tokens[i]?.value === ",") i += 1;
      }
      if (found === null || !isValueStart(tokens[found])) return null;
      at = found;
      continue;
    }

    // Walk array entries.
    if (tok.value !== "[") return null;
    let i = at + 1;
    let idx = 0;
    let found: number | null = null;
    while (i < tokens.length && tokens[i].value !== "]") {
      if (!isValueStart(tokens[i])) return null;
      if (idx === seg) {
        found = i;
        break;
      }
      idx += 1;
      i = skipValue(tokens, i);
      if (tokens[i]?.value === ",") i += 1;
    }
    if (found === null) return null;
    at = found;
  }

  return tokens[at]?.line ?? null;
}
