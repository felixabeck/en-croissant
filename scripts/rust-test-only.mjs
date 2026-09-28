import { accessSync } from "node:fs";
import { readFile } from "node:fs/promises";
import { extname, resolve } from "node:path";
import { posix as posixPath } from "node:path";
import { filesBelow } from "./files-below.mjs";
import { matches, normalisePath } from "./coverage-scope.mjs";
import { maskRustSourceWithSpans } from "./rust-source-mask.mjs";

const WORD = /[A-Za-z0-9_]/;
const IDENTIFIER = /^(?:r#)?[A-Za-z_][A-Za-z0-9_]*/;
const DEFAULT_ATOM_VALUATION = Object.freeze({ test: false });

function hasAttributeMetavariable(text) {
  return maskRustSourceWithSpans(text).masked.includes("$");
}

function lineAt(source, offset) {
  let line = 1;
  for (let index = 0; index < offset; index += 1) {
    if (source[index] === "\n") line += 1;
  }
  return line;
}

function fail(path, source, offset, message) {
  throw new Error(`${path}:${lineAt(source, offset)}: ${message}`);
}

function isWhitespace(character) {
  return (
    character === " " ||
    character === "\t" ||
    character === "\n" ||
    character === "\r" ||
    character === "\f"
  );
}

function skipWhitespace(code, offset) {
  while (offset < code.length && isWhitespace(code[offset])) offset += 1;
  return offset;
}

function nextWord(code, offset) {
  const match = code.slice(offset).match(IDENTIFIER);
  return match ? { word: match[0].replace(/^r#/, ""), end: offset + match[0].length } : null;
}

function skipTriviaAndAttributes(code, pairs, offset) {
  let cursor = skipWhitespace(code, offset);
  while (code[cursor] === "#" && code[cursor + 1] === "[") {
    const open = cursor + 1;
    const close = pairs.get(open);
    if (close === undefined) return cursor;
    cursor = skipWhitespace(code, close + 1);
  }
  return cursor;
}

function delimiterPairs(path, source, code) {
  const pairs = new Map();
  const stack = [];
  const openers = new Set(["(", "[", "{"]);
  const closers = new Map([
    [")", "("],
    ["]", "["],
    ["}", "{"],
  ]);

  for (let index = 0; index < code.length; index += 1) {
    const character = code[index];
    if (openers.has(character)) {
      stack.push({ character, offset: index });
      continue;
    }
    const expected = closers.get(character);
    if (!expected) continue;
    const opener = stack.pop();
    if (!opener || opener.character !== expected) {
      fail(path, source, index, "unbalanced delimiter");
    }
    pairs.set(opener.offset, index);
    pairs.set(index, opener.offset);
  }

  if (stack.length) {
    const opener = stack.at(-1);
    fail(path, source, opener.offset, "unbalanced delimiter at end of file");
  }
  return pairs;
}

function previousTokenStart(code, pairs, offset) {
  let cursor = offset - 1;
  while (cursor >= 0 && isWhitespace(code[cursor])) cursor -= 1;
  if (cursor < 0) return -1;
  if ([")", "]", "}"].includes(code[cursor])) return pairs.get(cursor) ?? cursor;
  return cursor;
}

function headerBeforeBrace(path, source, code, pairs, open) {
  let cursor = open - 1;
  while (cursor >= 0) {
    if (isWhitespace(code[cursor])) {
      cursor -= 1;
      continue;
    }
    if (code[cursor] === "}") break;
    if ([")", "]"].includes(code[cursor])) {
      const pair = pairs.get(cursor);
      if (pair === undefined) fail(path, source, cursor, "unbalanced delimiter");
      cursor = pair - 1;
      continue;
    }
    if (code[cursor] === ";" || code[cursor] === "{") break;
    if (code.startsWith("=>", cursor - 1)) {
      cursor -= 2;
      break;
    }
    cursor -= 1;
  }
  return code.slice(cursor + 1, open).trim();
}

function classifyBrace(path, source, code, pairs, open, includeAnalysis = false) {
  const header = headerBeforeBrace(path, source, code, pairs, open);
  const compact = header
    .replace(/\s+/g, " ")
    .trim()
    .replace(/^(?:#\s*\[[^\]]*\]\s*)+/, "");

  if (/^(?:(?:pub(?:\s*\([^)]*\))?\s+)?(?:unsafe\s+)?)?(mod|impl|trait)\b/.test(compact)) {
    const keyword = compact.match(
      /^(?:(?:pub(?:\s*\([^)]*\))?\s+)?(?:unsafe\s+)?)?(mod|impl|trait)\b/,
    )?.[1];
    if (keyword) return { kind: "item-list", form: keyword === "mod" ? "inline-module" : keyword };
  }
  if (/^(?:unsafe\s+)?extern\s*$/.test(compact)) return { kind: "item-list", form: "extern-block" };
  if (
    /^(?:pub(?:\s*\([^)]*\))?\s+)?(?:struct|enum|union)\s+(?:r#)?[A-Za-z_][A-Za-z0-9_]*(?:[\s\S]*)$/.test(
      compact,
    )
  ) {
    return { kind: "comma-list", form: "type-body" };
  }
  const pipeEnd = compact.lastIndexOf("|");
  const pipeStart = pipeEnd > 0 ? compact.lastIndexOf("|", pipeEnd - 1) : -1;
  if (pipeStart >= 0 && /^(?:\s*->\s*[\s\S]+)?$/.test(compact.slice(pipeEnd + 1))) {
    return { kind: "statement-list", form: "closure-body" };
  }
  if (/\bmatch\b[\s\S]*$/.test(compact) && !compact.includes("=>")) {
    return { kind: "match-arm-list", form: "match" };
  }
  if (/\bfn\s+(?:r#)?[A-Za-z_][A-Za-z0-9_]*\b[\s\S]*$/.test(compact)) {
    return { kind: "statement-list", form: "function-body" };
  }
  if (/\b(?:if|else|loop|while|for|unsafe|async)\b[\s\S]*$/.test(compact)) {
    return { kind: "statement-list", form: "block-expression" };
  }
  if (/\|\s*(?:[^|]|\|\|)*\|\s*$/.test(compact) || /\bmove\s*\|\|\s*$/.test(compact)) {
    return { kind: "statement-list", form: "closure-body" };
  }
  if (/^(?:std::)?thread_local\s*!\s*$/.test(compact)) {
    return { kind: "item-list", form: "thread-local-macro" };
  }
  const macroRulesBody = /\bmacro_rules\s*!\s*[A-Za-z_][A-Za-z0-9_]*\s*$/.test(compact);
  const macroInvocation = /\b[A-Za-z_][A-Za-z0-9_]*(?:::[A-Za-z_][A-Za-z0-9_]*)*\s*!\s*$/.test(
    compact,
  );
  if (includeAnalysis && macroRulesBody) {
    return { kind: "opaque", form: "macro-input" };
  }
  const structLiteral =
    !/\btry\s*$/.test(compact) &&
    /\b[A-Za-z_][A-Za-z0-9_]*(?:::[A-Za-z_][A-Za-z0-9_]*)*(?:\s*::<[\s\S]*>)?\s*$/.test(compact);
  if (!includeAnalysis && structLiteral) {
    return { kind: "comma-list", form: "struct-literal" };
  }
  if (macroInvocation) return { kind: "opaque", form: "macro-input" };
  if (includeAnalysis && structLiteral) {
    return { kind: "comma-list", form: "struct-literal" };
  }
  if (
    compact === "" ||
    /(?:=|=>|\b(?:return|break|yield|move|async)|\b[A-Za-z_][A-Za-z0-9_]*\s*:)$/.test(compact) ||
    /\|\s*\|\s*$/.test(compact)
  ) {
    return { kind: "statement-list", form: "block-expression" };
  }
  return { kind: "unplaced", form: "unknown-brace-context", offset: open };
}

function openerContexts(path, source, code, pairs, includeAnalysis = false) {
  const contexts = new Map();
  for (const [open, close] of pairs) {
    if (open > close) continue;
    const delimiter = code[open];
    if (delimiter === "{") {
      contexts.set(open, classifyBrace(path, source, code, pairs, open, includeAnalysis));
    } else if (delimiter === "(" || delimiter === "[") {
      const previous = previousTokenStart(code, pairs, open);
      contexts.set(
        open,
        previous >= 0 && code[previous] === "!"
          ? { kind: "opaque", form: "macro-input" }
          : { kind: "comma-list", form: delimiter === "(" ? "parentheses" : "brackets" },
      );
    }
  }
  return contexts;
}

function contextAt(offset, pairs, contexts, includeOpaqueAncestors = false) {
  let selected;
  let opaque;
  for (const [open, close] of pairs) {
    if (open < close && open < offset && offset < close && (!selected || open > selected.open)) {
      selected = { open, close, context: contexts.get(open) };
    }
    const context = contexts.get(open);
    if (
      includeOpaqueAncestors &&
      open < close &&
      open < offset &&
      offset < close &&
      context?.kind === "opaque" &&
      (!opaque || open > opaque.open)
    ) {
      opaque = { open, close, context };
    }
  }
  return (
    (includeOpaqueAncestors ? opaque : null) ??
    selected ?? { open: null, close: null, context: { kind: "item-list", form: "file" } }
  );
}

function attributeGroups(path, source, code, pairs) {
  const groups = [];
  for (let index = 0; index < code.length; index += 1) {
    if (code[index] !== "#" || code[index + 1] !== "[") continue;
    if (index > 0 && code[index - 1] === "#") continue;
    const start = index;
    const attributes = [];
    let cursor = index;
    let end = index;
    while (code[cursor] === "#" && code[cursor + 1] === "[") {
      const open = cursor + 1;
      const close = pairs.get(open);
      if (close === undefined) fail(path, source, cursor, "unbalanced attribute delimiter");
      attributes.push({ start: cursor, open, close, text: source.slice(open + 1, close) });
      end = close + 1;
      let next = skipWhitespace(code, end);
      if (!/^\s*$/.test(source.slice(end, next))) break;
      if (code[next] !== "#" || code[next + 1] !== "[") break;
      cursor = next;
    }
    groups.push({ start, end, attributes });
    index = end - 1;
  }
  return groups;
}

function skipQuoted(text, offset) {
  let index = offset + 1;
  while (index < text.length) {
    if (text[index] === "\\") {
      index += 2;
    } else if (text[index] === '"') {
      return index + 1;
    } else {
      index += 1;
    }
  }
  return -1;
}

function parsePredicate(text, path, source, offset) {
  let cursor = 0;
  const whitespace = () => {
    while (isWhitespace(text[cursor])) cursor += 1;
  };
  const parse = () => {
    whitespace();
    const match = text.slice(cursor).match(/^[A-Za-z_][A-Za-z0-9_]*/);
    if (!match) throw new Error("invalid cfg predicate");
    const name = match[0];
    cursor += name.length;
    whitespace();
    if (text[cursor] === "=") {
      cursor += 1;
      whitespace();
      if (text[cursor] !== '"') throw new Error("invalid cfg value");
      const valueStart = cursor;
      const end = skipQuoted(text, cursor);
      if (end === -1) throw new Error("unterminated cfg value");
      cursor = end;
      return { type: "atom", name: `${name}=${text.slice(valueStart, end)}` };
    }
    if (text[cursor] !== "(") return { type: "atom", name };
    cursor += 1;
    whitespace();
    const children = [];
    if (text[cursor] !== ")") {
      while (true) {
        children.push(parse());
        whitespace();
        if (text[cursor] === ")") break;
        if (text[cursor] !== ",") throw new Error("invalid cfg argument list");
        cursor += 1;
        whitespace();
        if (text[cursor] === ")") break;
      }
    }
    if (text[cursor] !== ")") throw new Error("unclosed cfg predicate");
    cursor += 1;
    if (name === "not" && children.length !== 1)
      throw new Error("not() requires one cfg predicate");
    if (!["all", "any", "not"].includes(name)) throw new Error(`unknown cfg function ${name}`);
    return { type: name, children };
  };

  try {
    const predicate = parse();
    whitespace();
    if (cursor !== text.length) throw new Error("trailing cfg predicate text");
    return predicate;
  } catch (error) {
    fail(path, source, offset, `unparseable cfg predicate (${error.message})`);
  }
}

function splitMetaArguments(text) {
  const result = [];
  let start = 0;
  let depth = 0;
  for (let index = 0; index < text.length; index += 1) {
    if (text[index] === '"') {
      const end = skipQuoted(text, index);
      if (end === -1) throw new Error("unterminated string");
      index = end - 1;
      continue;
    }
    if ("([{<".includes(text[index])) depth += 1;
    else if (")]}>".includes(text[index])) depth -= 1;
    else if (text[index] === "," && depth === 0) {
      result.push(text.slice(start, index).trim());
      start = index + 1;
    }
    if (depth < 0) throw new Error("unbalanced meta arguments");
  }
  if (depth !== 0) throw new Error("unbalanced meta arguments");
  const tail = text.slice(start).trim();
  if (tail) result.push(tail);
  else if (text.trim().endsWith(",")) result.push("");
  return result;
}

function metaParts(text) {
  const trimmed = text.trim();
  const match = trimmed.match(
    /^([A-Za-z_][A-Za-z0-9_]*(?:::[A-Za-z_][A-Za-z0-9_]*)*)(?:\s*(?:\(([\s\S]*)\)|=[\s\S]+))?$/,
  );
  if (!match) throw new Error(`invalid meta attribute: ${trimmed}`);
  return { name: match[1], body: match[2] };
}

function evaluatePredicate(predicate, atomValuation) {
  if (predicate.type === "atom") {
    return Object.hasOwn(atomValuation, predicate.name) ? atomValuation[predicate.name] : undefined;
  }
  const values = predicate.children.map((child) => evaluatePredicate(child, atomValuation));
  if (predicate.type === "not") return values[0] === undefined ? undefined : !values[0];
  if (predicate.type === "all") {
    if (values.includes(false)) return false;
    if (values.every((value) => value === true)) return true;
    return undefined;
  }
  if (values.includes(true)) return true;
  if (values.every((value) => value === false)) return false;
  return undefined;
}

function evaluateCfgAttribute(attribute, path, source, atomValuation) {
  const { name, body } = metaParts(attribute.text);
  const details = attribute.details;
  const collectAtoms = (predicate) => {
    if (predicate.type === "atom") {
      details?.atoms.push(predicate.name);
      return;
    }
    for (const child of predicate.children) collectAtoms(child);
  };
  if (name === "cfg") {
    if (body === undefined)
      fail(path, source, attribute.start, "unparseable cfg predicate (missing parentheses)");
    const predicate = parsePredicate(body, path, source, attribute.start);
    collectAtoms(predicate);
    const excluded = evaluatePredicate(predicate, atomValuation) === false;
    if (details) {
      details.kind = "cfg";
      details.excluded = excluded;
      details.inactive = excluded;
    }
    return excluded;
  }
  if (name !== "cfg_attr") return false;
  if (body === undefined)
    fail(path, source, attribute.start, "unparseable cfg_attr predicate (missing parentheses)");
  let argumentsList;
  try {
    argumentsList = splitMetaArguments(body);
  } catch (error) {
    fail(path, source, attribute.start, `unparseable cfg_attr predicate (${error.message})`);
  }
  if (argumentsList.length < 2 || !argumentsList[0]) {
    fail(
      path,
      source,
      attribute.start,
      "unparseable cfg_attr predicate (expected a condition and attribute)",
    );
  }
  const condition = parsePredicate(argumentsList[0], path, source, attribute.start);
  collectAtoms(condition);
  const conditionValue = evaluatePredicate(condition, atomValuation);
  if (details) {
    details.kind = "cfg_attr";
    details.conditionExcluded = conditionValue === false;
    details.inactive = conditionValue === false;
  }
  const visit = (meta, conditions) => {
    let parts;
    try {
      parts = metaParts(meta);
    } catch {
      fail(
        path,
        source,
        attribute.start,
        "unparseable cfg_attr predicate (invalid nested attribute)",
      );
    }
    if (parts.name === "cfg") {
      if (parts.body === undefined) {
        fail(
          path,
          source,
          attribute.start,
          "unparseable cfg_attr predicate (nested cfg has no predicate)",
        );
      }
      const nested = parsePredicate(parts.body, path, source, attribute.start);
      collectAtoms(nested);
      if (details) details.containsCfgPayload = true;
      const applies =
        conditions.length === 0
          ? true
          : evaluatePredicate({ type: "all", children: conditions }, atomValuation);
      const result = evaluatePredicate(nested, atomValuation);
      const effective =
        applies === false ? true : applies === true ? result : result === true ? true : undefined;
      const excluded = effective === false;
      if (excluded && details) details.excluded = true;
      return excluded;
    }
    if (parts.name === "cfg_attr") {
      if (parts.body === undefined)
        fail(
          path,
          source,
          attribute.start,
          "unparseable cfg_attr predicate (nested cfg_attr has no predicate)",
        );
      let nestedArguments;
      try {
        nestedArguments = splitMetaArguments(parts.body);
      } catch (error) {
        fail(path, source, attribute.start, `unparseable cfg_attr predicate (${error.message})`);
      }
      if (nestedArguments.length < 2 || !nestedArguments[0]) {
        fail(
          path,
          source,
          attribute.start,
          "unparseable cfg_attr predicate (nested cfg_attr needs an attribute)",
        );
      }
      const nestedCondition = parsePredicate(nestedArguments[0], path, source, attribute.start);
      collectAtoms(nestedCondition);
      return nestedArguments
        .slice(1)
        .some((nestedMeta) => visit(nestedMeta, [...conditions, nestedCondition]));
    }
    return false;
  };
  const excluded = argumentsList.slice(1).some((nestedMeta) => visit(nestedMeta, [condition]));
  if (details) details.excluded = excluded;
  return excluded;
}

function parseAttributes(path, source, groups, atomValuation, allowAttributeMetavariables) {
  for (const group of groups) {
    for (const attribute of group.attributes) {
      attribute.details = {
        atoms: [],
        excluded: false,
        inactive: false,
        containsCfgPayload: false,
      };
    }
    group.testOnly = group.attributes.some((attribute) => {
      if (allowAttributeMetavariables && hasAttributeMetavariable(attribute.text)) {
        attribute.details.kind = "metavariable";
        return false;
      }
      return evaluateCfgAttribute(attribute, path, source, atomValuation);
    });
  }
}

function skipVisibilityAndModifiers(code, pairs, offset) {
  let cursor = skipWhitespace(code, offset);
  let token = nextWord(code, cursor);
  if (token?.word === "pub") {
    cursor = skipWhitespace(code, token.end);
    if (code[cursor] === "(") cursor = (pairs.get(cursor) ?? cursor) + 1;
    cursor = skipWhitespace(code, cursor);
  }
  while (true) {
    token = nextWord(code, cursor);
    if (!token || !["async", "unsafe", "extern", "const"].includes(token.word)) break;
    if (token.word === "const") {
      let look = skipWhitespace(code, token.end);
      while (true) {
        const next = nextWord(code, look);
        if (!next || !["async", "unsafe", "extern"].includes(next.word)) break;
        look = skipWhitespace(code, next.end);
      }
      if (nextWord(code, look)?.word !== "fn") break;
    }
    cursor = skipWhitespace(code, token.end);
  }
  return cursor;
}

function transitionAngleDepth(code, index, angleDepth) {
  const character = code[index];
  if (character === ";") return 0;
  if (character === "<") {
    const previous = code[index - 1];
    if (WORD.test(previous ?? "") || (previous === ":" && code[index - 2] === ":"))
      return angleDepth + 1;
  } else if (character === ">" && angleDepth > 0) {
    if (code[index - 1] === "-" || code[index - 1] === "=" || code[index + 1] === "=")
      return angleDepth;
    return angleDepth - 1;
  }
  return angleDepth;
}

function findTopLevelTerminator(code, pairs, start, close, wanted) {
  let angleDepth = 0;
  for (let index = start; index < close; index += 1) {
    const character = code[index];
    angleDepth = transitionAngleDepth(code, index, angleDepth);
    if (character === "<" || character === ">") continue;
    if ("([{ ".includes(character) && character !== " ") {
      const end = pairs.get(index);
      if (end === undefined) return -1;
      if (character === "{" && angleDepth === 0 && wanted.has("{")) return index;
      index = end;
      continue;
    }
    if (character === ";" && angleDepth === 0 && wanted.has(";")) return index;
  }
  return -1;
}

function findItemEnd(path, source, code, pairs, start, contextClose, includeAnalysis = false) {
  const cursor = skipVisibilityAndModifiers(code, pairs, start);
  const word = nextWord(code, cursor)?.word;
  const itemWords = new Set([
    "fn",
    "mod",
    "impl",
    "trait",
    "struct",
    "enum",
    "union",
    "use",
    "type",
    "const",
    "static",
  ]);
  if (itemWords.has(word)) {
    if (word === "fn") {
      const terminator = findTopLevelTerminator(
        code,
        pairs,
        cursor + 2,
        contextClose,
        new Set(["{", ";"]),
      );
      if (terminator < 0)
        fail(
          path,
          source,
          start,
          "unsupported test-only form; give it its own item/statement or extend rust-test-only.mjs",
        );
      return code[terminator] === "{" ? pairs.get(terminator) : terminator;
    }
    if (["mod", "impl", "trait", "enum", "union"].includes(word)) {
      const terminator = findTopLevelTerminator(
        code,
        pairs,
        cursor + word.length,
        contextClose,
        new Set(["{", ";"]),
      );
      if (terminator < 0)
        fail(
          path,
          source,
          start,
          "unsupported test-only form; give it its own item/statement or extend rust-test-only.mjs",
        );
      return code[terminator] === "{" ? pairs.get(terminator) : terminator;
    }
    if (word === "struct") {
      const terminator = findTopLevelTerminator(
        code,
        pairs,
        cursor + word.length,
        contextClose,
        new Set(["{", ";"]),
      );
      if (terminator < 0)
        fail(
          path,
          source,
          start,
          "unsupported test-only form; give it its own item/statement or extend rust-test-only.mjs",
        );
      return code[terminator] === "{" ? pairs.get(terminator) : terminator;
    }
    const semicolon = findTopLevelTerminator(
      code,
      pairs,
      cursor + word.length,
      contextClose,
      new Set([";"]),
    );
    if (semicolon < 0)
      fail(
        path,
        source,
        start,
        "unsupported test-only form; give it its own item/statement or extend rust-test-only.mjs",
      );
    return semicolon;
  }

  if (!includeAnalysis) {
    const macro = code
      .slice(cursor, contextClose)
      .match(/^(?:[A-Za-z_][A-Za-z0-9_]*(?:::[A-Za-z_][A-Za-z0-9_]*)*)\s*!\s*\{/);
    if (macro) {
      const brace = cursor + macro[0].lastIndexOf("{");
      const end = pairs.get(brace);
      if (end === undefined) fail(path, source, brace, "unbalanced delimiter");
      let final = end;
      const following = skipWhitespace(code, end + 1);
      if (code[following] === ";") final = following;
      return final;
    }
    fail(
      path,
      source,
      start,
      "unsupported test-only form; give it its own item/statement or extend rust-test-only.mjs",
    );
  }

  const macroRules = code
    .slice(cursor, contextClose)
    .match(/^macro_rules\s*!\s*[A-Za-z_][A-Za-z0-9_]*\s*/);
  const macroRulesOpen = macroRules ? cursor + macroRules[0].length : -1;
  if (macroRules && code[macroRulesOpen] === "{") {
    const end = pairs.get(macroRulesOpen);
    if (end === undefined) fail(path, source, macroRulesOpen, "unbalanced delimiter");
    const following = skipWhitespace(code, end + 1);
    return code[following] === ";" ? following : end;
  }

  const macro = code
    .slice(cursor, contextClose)
    .match(/^(?:[A-Za-z_][A-Za-z0-9_]*(?:::[A-Za-z_][A-Za-z0-9_]*)*)\s*!\s*/);
  const macroOpen = macro ? cursor + macro[0].length : -1;
  if (macro && ["{", "(", "["].includes(code[macroOpen])) {
    const end = pairs.get(macroOpen);
    if (end === undefined) fail(path, source, macroOpen, "unbalanced delimiter");
    const following = skipWhitespace(code, end + 1);
    if (code[following] === ";") return following;
    if (code[macroOpen] === "{") return end;
    const semicolon = findTopLevelTerminator(code, pairs, end + 1, contextClose, new Set([";"]));
    if (semicolon >= 0) return semicolon;
  }
  fail(
    path,
    source,
    start,
    "unsupported test-only form; give it its own item/statement or extend rust-test-only.mjs",
  );
}

function findIfChainEnd(path, source, code, pairs, start, contextClose) {
  let cursor = start;
  let lastClose = -1;
  while (true) {
    let body = findTopLevelTerminator(code, pairs, cursor, contextClose, new Set(["{"]));
    if (body < 0 || body >= contextClose)
      fail(path, source, start, "unsupported test-only if/else form");
    const bodyClose = pairs.get(body);
    if (bodyClose === undefined) fail(path, source, body, "unbalanced delimiter");
    lastClose = bodyClose;
    cursor = skipWhitespace(code, bodyClose + 1);
    const elseWord = nextWord(code, cursor);
    if (elseWord?.word !== "else") break;
    cursor = skipWhitespace(code, elseWord.end);
    const next = nextWord(code, cursor);
    if (next?.word === "if") {
      cursor = skipWhitespace(code, next.end);
      continue;
    }
    if (code[cursor] !== "{") fail(path, source, cursor, "unsupported test-only if/else form");
    lastClose = pairs.get(cursor);
    if (lastClose === undefined) fail(path, source, cursor, "unbalanced delimiter");
    break;
  }
  assertNoBlockContinuation(path, source, code, lastClose);
  const following = skipWhitespace(code, lastClose + 1);
  return code[following] === ";" ? following : lastClose;
}

function assertNoBlockContinuation(path, source, code, end) {
  const following = skipWhitespace(code, end + 1);
  if (code[following] === "." || code[following] === "?" || /^as\b/.test(code.slice(following))) {
    fail(
      path,
      source,
      following,
      "unsupported test-only form; give it its own item/statement or extend rust-test-only.mjs",
    );
  }
}

function findStatementEnd(path, source, code, pairs, start, context) {
  const close = context.close ?? code.length;
  const cursor = skipTriviaAndAttributes(code, pairs, start);
  const word = nextWord(code, cursor)?.word;

  const itemStart = skipVisibilityAndModifiers(code, pairs, cursor);
  if (
    nextWord(code, itemStart) &&
    [
      "fn",
      "mod",
      "impl",
      "trait",
      "struct",
      "enum",
      "union",
      "use",
      "type",
      "const",
      "static",
    ].includes(nextWord(code, itemStart).word)
  ) {
    return findItemEnd(path, source, code, pairs, cursor, close, context.includeAnalysis);
  }
  if (word === "let") {
    const semicolon = findTopLevelTerminator(code, pairs, cursor + 3, close, new Set([";"]));
    if (semicolon < 0)
      fail(path, source, start, "test-only statement reaches its enclosing } without a terminator");
    return semicolon;
  }
  if (word === "return" && context.includeAnalysis) {
    const semicolon = findTopLevelTerminator(
      code,
      pairs,
      cursor + word.length,
      close,
      new Set([";"]),
    );
    if (semicolon < 0)
      fail(
        path,
        source,
        start,
        "test-only return statement reaches its enclosing } without a terminator",
      );
    return semicolon;
  }
  if (word === "if") return findIfChainEnd(path, source, code, pairs, cursor + 2, close);
  if (word === "match") {
    const body = findTopLevelTerminator(code, pairs, cursor + 5, close, new Set(["{"]));
    if (body < 0) fail(path, source, start, "unsupported test-only match form");
    let end = pairs.get(body);
    if (end === undefined) fail(path, source, body, "unbalanced delimiter");
    assertNoBlockContinuation(path, source, code, end);
    const following = skipWhitespace(code, end + 1);
    if (code[following] === ";") end = following;
    return end;
  }
  if (code[cursor] === "{") {
    let end = pairs.get(cursor);
    if (end === undefined) fail(path, source, cursor, "unbalanced delimiter");
    assertNoBlockContinuation(path, source, code, end);
    const following = skipWhitespace(code, end + 1);
    if (code[following] === ";") end = following;
    return end;
  }
  if (context.includeAnalysis) {
    const macro = code
      .slice(cursor, close)
      .match(/^(?:[A-Za-z_][A-Za-z0-9_]*(?:::[A-Za-z_][A-Za-z0-9_]*)*)\s*!\s*/);
    const macroOpen = macro ? cursor + macro[0].length : -1;
    if (macro && ["{", "(", "["].includes(code[macroOpen])) {
      const end = pairs.get(macroOpen);
      if (end === undefined) fail(path, source, macroOpen, "unbalanced delimiter");
      const following = skipWhitespace(code, end + 1);
      if (code[following] === ";") return following;
      if (code[macroOpen] === "{") return end;
      const semicolon = findTopLevelTerminator(code, pairs, end + 1, close, new Set([";"]));
      if (semicolon >= 0) return semicolon;
    }
  } else {
    const macro = code
      .slice(cursor, close)
      .match(/^(?:[A-Za-z_][A-Za-z0-9_]*(?:::[A-Za-z_][A-Za-z0-9_]*)*)\s*!\s*\{/);
    if (macro) {
      const brace = cursor + macro[0].lastIndexOf("{");
      let end = pairs.get(brace);
      if (end === undefined) fail(path, source, brace, "unbalanced delimiter");
      assertNoBlockContinuation(path, source, code, end);
      const following = skipWhitespace(code, end + 1);
      if (code[following] === ";") end = following;
      return end;
    }
  }
  const semicolon = findTopLevelTerminator(code, pairs, cursor, close, new Set([";"]));
  if (
    context.includeAnalysis &&
    semicolon < 0 &&
    context.close !== undefined &&
    skipWhitespace(code, cursor) < close
  ) {
    return close - 1;
  }
  if (semicolon < 0)
    fail(path, source, start, "test-only statement reaches its enclosing } without a terminator");
  return semicolon;
}

function findListComma(code, pairs, start, context, sourceLength) {
  const close = context.close ?? sourceLength;
  let angleDepth = 0;
  for (let index = start; index < close; index += 1) {
    const character = code[index];
    angleDepth = transitionAngleDepth(code, index, angleDepth);
    if (character === "<" || character === ">") continue;
    if ("([{ ".includes(character) && character !== " ") {
      const end = pairs.get(index);
      if (end === undefined) return { comma: -1, close };
      if (index === context.open) continue;
      index = end;
      continue;
    }
    if (character === "," && angleDepth === 0) return { comma: index, close };
  }
  return { comma: -1, close };
}

function matchArmEnd(path, source, code, pairs, start, context) {
  const { close } = findListComma(code, pairs, start, context, source.length);
  let arrow = -1;
  let angleDepth = 0;
  for (let index = start; index < close; index += 1) {
    angleDepth = transitionAngleDepth(code, index, angleDepth);
    if (code[index] === "<" || code[index] === ">") continue;
    if (angleDepth === 0 && code.startsWith("=>", index)) {
      arrow = index;
      break;
    }
    if ("([{ ".includes(code[index]) && code[index] !== " ") {
      const end = pairs.get(index);
      if (end !== undefined) index = end;
    }
  }
  if (arrow < 0) fail(path, source, start, "unsupported test-only match arm");
  const rhs = skipWhitespace(code, arrow + 2);
  let blockEnd;
  if (code[rhs] === "{") blockEnd = pairs.get(rhs);
  else if (nextWord(code, rhs)?.word === "if") {
    blockEnd = findIfChainEnd(path, source, code, pairs, rhs + 2, close);
  }
  if (blockEnd === undefined && code[rhs] === "{") {
    fail(path, source, rhs, "unbalanced delimiter");
  }

  const next = blockEnd === undefined ? start : skipWhitespace(code, blockEnd + 1);
  if (blockEnd !== undefined && code[next] === ",") return next;
  if (blockEnd !== undefined && next >= close) return close - 1;

  let comma = -1;
  if (blockEnd === undefined) {
    comma = findListComma(code, pairs, start, context, source.length).comma;
    return comma >= 0 ? comma : close - 1;
  }

  // A block-like RHS may omit its separator before the next arm. Do not mistake the next arm's
  // comma for this arm's extent.
  angleDepth = 0;
  for (let index = next; index < close; index += 1) {
    angleDepth = transitionAngleDepth(code, index, angleDepth);
    if (code[index] === "<" || code[index] === ">") continue;
    if (angleDepth === 0 && code.startsWith("=>", index)) return blockEnd;
    if (angleDepth === 0 && code[index] === ",") return index;
    if ("([{ ".includes(code[index]) && code[index] !== " ") {
      const end = pairs.get(index);
      if (end !== undefined) index = end;
    }
  }
  return close - 1;
}

function itemRange(path, source, code, pairs, group, context) {
  const start = group.start;
  const after = skipTriviaAndAttributes(code, pairs, group.end);
  let end;
  if (context.kind === "item-list") {
    end = findItemEnd(
      path,
      source,
      code,
      pairs,
      after,
      context.close ?? code.length,
      context.includeAnalysis,
    );
  } else if (context.kind === "statement-list")
    end = findStatementEnd(path, source, code, pairs, after, context);
  else if (context.kind === "comma-list") {
    const list = findListComma(code, pairs, after, context, source.length);
    end = list.comma >= 0 ? list.comma : list.close - 1;
  } else if (context.kind === "match-arm-list") {
    end = matchArmEnd(path, source, code, pairs, after, context);
  } else {
    fail(
      path,
      source,
      group.start,
      "unsupported test-only context; give the test-only item its own lines",
    );
  }
  while (end >= start && isWhitespace(source[end])) end -= 1;
  if (end < start)
    fail(
      path,
      source,
      start,
      "unsupported test-only form; give it its own item/statement or extend rust-test-only.mjs",
    );
  return { start, end: end + 1 };
}

function attachedAttributes(path, source, code, pairs, offset) {
  const attrs = [];
  let cursor = offset - 1;
  while (cursor >= 0 && isWhitespace(code[cursor])) cursor -= 1;
  while (cursor >= 0 && code[cursor] === "]") {
    const open = pairs.get(cursor);
    if (open === undefined || code[open - 1] !== "#") break;
    const hash = open - 1;
    attrs.unshift({ start: hash, open, close: cursor, text: source.slice(open + 1, cursor) });
    cursor = hash - 1;
    while (cursor >= 0 && isWhitespace(code[cursor])) cursor -= 1;
  }
  return attrs;
}

function moduleDeclarations(
  path,
  source,
  code,
  pairs,
  contexts,
  groups,
  ranges,
  wholeFile,
  includeAnalysis = false,
) {
  const declarations = [];
  const regex = /\bmod\s+((?:r#)?[A-Za-z_][A-Za-z0-9_]*)\s*;/g;
  let match;
  while ((match = regex.exec(code))) {
    const keyword = match.index;
    const name = match[1].replace(/^r#/, "");
    const context = contextAt(keyword, pairs, contexts, includeAnalysis);
    if (context.context?.kind !== "item-list") continue;
    const attributes = attachedAttributes(path, source, code, pairs, keyword);
    const associatedGroups = groups.filter((group) => {
      const next = skipTriviaAndAttributes(code, pairs, group.end);
      return next === keyword;
    });
    const directTestOnly = associatedGroups.some((group) => group.testOnly);
    const insideExcludedRange = ranges.some(
      (range) => range.start <= keyword && keyword < range.end,
    );
    const testOnly = wholeFile || directTestOnly || insideExcludedRange;
    declarations.push({
      name,
      keyword,
      line: lineAt(source, keyword),
      testOnly,
      inline: context.open !== null && contexts.get(context.open)?.form === "inline-module",
      attributes,
      attributeGroupStarts: associatedGroups.map((group) => group.start),
    });
  }
  return declarations;
}

function commentPosition(spans, cursor) {
  let low = 0;
  let high = spans.length - 1;
  while (low <= high) {
    const middle = (low + high) >> 1;
    const span = spans[middle];
    if (cursor < span.start) high = middle - 1;
    else if (cursor >= span.end) low = middle + 1;
    else return true;
  }
  return false;
}

function lineRanges(path, source, comments, ranges, wholeFile) {
  const excluded = new Set();
  const lineStarts = [0];
  for (let index = 0; index < source.length; index += 1) {
    if (source[index] === "\n") lineStarts.push(index + 1);
  }
  const sortedRanges = wholeFile
    ? [{ start: 0, end: source.length }]
    : [...ranges].sort((a, b) => a.start - b.start);
  let rangeCursor = 0;
  for (let lineIndex = 0; lineIndex < lineStarts.length; lineIndex += 1) {
    const start = lineStarts[lineIndex];
    let end = lineIndex + 1 < lineStarts.length ? lineStarts[lineIndex + 1] : source.length;
    while (end > start && (source[end - 1] === "\n" || source[end - 1] === "\r")) end -= 1;
    while (rangeCursor < sortedRanges.length && sortedRanges[rangeCursor].end <= start)
      rangeCursor += 1;
    if (start === end) {
      // An empty line has no character of its own, only its line break at `start`. Inside a test
      // item (a blank line in a test body or a multi-line string) it still carries a `DA` record
      // whenever an enclosing coverage region spans it, so it is excluded when that break lies in
      // an excluded range; between items it lies outside every range and stays.
      const range = sortedRanges[rangeCursor];
      if (range && range.start <= start && start < range.end) excluded.add(lineIndex + 1);
      continue;
    }
    let overlaps = false;
    let firstOutsideCode = -1;
    let currentRange = rangeCursor;
    for (let cursor = start; cursor < end; cursor += 1) {
      while (currentRange < sortedRanges.length && sortedRanges[currentRange].end <= cursor)
        currentRange += 1;
      const inside =
        currentRange < sortedRanges.length &&
        sortedRanges[currentRange].start <= cursor &&
        cursor < sortedRanges[currentRange].end;
      if (inside) {
        overlaps = true;
        continue;
      }
      if (
        firstOutsideCode < 0 &&
        !isWhitespace(source[cursor]) &&
        !commentPosition(comments, cursor)
      )
        firstOutsideCode = cursor;
    }
    rangeCursor = currentRange;
    if (!overlaps) continue;
    if (firstOutsideCode >= 0)
      fail(
        path,
        source,
        firstOutsideCode,
        "shared coverage line; give the test-only item its own lines",
      );
    excluded.add(lineIndex + 1);
  }
  return excluded;
}

function analyzeRustFile(path, source, atomValuation, includeAnalysis = false) {
  const { masked, comments } = maskRustSourceWithSpans(source);
  const pairs = delimiterPairs(path, source, masked);
  const contexts = openerContexts(path, source, masked, pairs, includeAnalysis);
  const groups = attributeGroups(path, source, masked, pairs);
  const macroRegions = [...pairs]
    .filter(([open, close]) => open < close && masked[open] === "{")
    .map(([open, close]) => {
      if (contexts.get(open)?.kind !== "opaque") return null;
      const header = headerBeforeBrace(path, source, masked, pairs, open);
      if (!/\bmacro_rules\s*!/.test(header)) return null;
      return { start: open, end: close + 1 };
    })
    .filter(Boolean);
  parseAttributes(path, source, groups, atomValuation, includeAnalysis);
  const excludedRanges = [];
  const sourceRegions = [];
  for (const group of groups) {
    if (
      includeAnalysis &&
      excludedRanges.some((range) => range.start <= group.start && group.start < range.end)
    )
      continue;
    let relevant = false;
    if (includeAnalysis) {
      relevant = group.attributes.some((attribute) => {
        if (hasAttributeMetavariable(attribute.text)) return true;
        try {
          const meta = metaParts(attribute.text);
          return (
            ["cfg", "cfg_attr", "path"].includes(meta.name) ||
            (["allow", "expect"].includes(meta.name) &&
              /\bclippy\s*::\s*disallowed_methods\b/.test(
                maskRustSourceWithSpans(attribute.text).masked,
              ))
          );
        } catch {
          return false;
        }
      });
    }
    if (!group.testOnly && !relevant) continue;
    const context = contextAt(group.start, pairs, contexts, includeAnalysis);
    if (context.context?.kind === "opaque") {
      const inMacroRulesBody = macroRegions.some(
        ({ start, end }) => start <= group.start && group.start < end,
      );
      const testOnlyByDefault = includeAnalysis
        ? group.attributes.some(
            (attribute) =>
              attribute.details?.kind !== "metavariable" &&
              evaluateCfgAttribute(
                { start: attribute.start, text: attribute.text },
                path,
                source,
                DEFAULT_ATOM_VALUATION,
              ),
          )
        : group.testOnly;
      if (testOnlyByDefault)
        fail(path, source, group.start, "unsupported test-only context inside a macro input");
      const cfgAttribute = group.attributes.some((attribute) =>
        ["cfg", "cfg_attr"].includes(attribute.details?.kind),
      );
      const nestedCfgPayload = group.attributes.some(
        (attribute) => attribute.details?.containsCfgPayload,
      );
      if (includeAnalysis && cfgAttribute && !(inMacroRulesBody && nestedCfgPayload)) {
        fail(path, source, group.start, "unsupported cfg attribute inside a macro input");
      }
      if (group.testOnly && !includeAnalysis) {
        fail(path, source, group.start, "unsupported test-only context inside a macro input");
      }
      if (group.testOnly) excludedRanges.push({ start: group.start, end: group.end });
      sourceRegions.push({
        start: group.start,
        end: group.end,
        range: { start: group.start, end: group.end },
        attributes: group.attributes,
        text: source.slice(group.start, group.end),
        testOnly: false,
        context: context.context,
      });
      continue;
    }
    if (!context.context || context.context.kind === "unplaced") {
      fail(
        path,
        source,
        group.start,
        "unplaceable test-only context; extend rust-test-only.mjs only for a listed Rust form",
      );
    }
    const range = itemRange(path, source, masked, pairs, group, {
      ...context.context,
      open: context.open,
      close: context.close,
      includeAnalysis,
    });
    if (group.testOnly) excludedRanges.push(range);
    if (relevant) {
      sourceRegions.push({
        start: group.start,
        end: group.end,
        range,
        attributes: group.attributes,
        text: source.slice(group.start, group.end),
        testOnly: group.testOnly,
        context: context.context,
      });
    }
  }

  let wholeFile = false;
  const innerAttributes = [];
  for (let index = 0; index < masked.length; index += 1) {
    if (masked[index] !== "#" || masked[index + 1] !== "!" || masked[index + 2] !== "[") continue;
    const open = index + 2;
    const close = pairs.get(open);
    if (close === undefined) fail(path, source, index, "unbalanced inner attribute delimiter");
    const attribute = {
      start: index,
      text: source.slice(open + 1, close),
      details: { atoms: [], excluded: false, inactive: false, containsCfgPayload: false },
    };
    if (
      includeAnalysis &&
      excludedRanges.some((range) => range.start <= index && index < range.end)
    )
      continue;
    const excluded =
      includeAnalysis && hasAttributeMetavariable(attribute.text)
        ? false
        : evaluateCfgAttribute(attribute, path, source, atomValuation);
    if (includeAnalysis) {
      innerAttributes.push({
        start: index,
        end: close + 1,
        text: source.slice(index, close + 1),
        attribute,
        range: { start: index, end: close + 1 },
        root: contextAt(index, pairs, contexts, includeAnalysis).open === null,
      });
    }
    if (!excluded) continue;
    const context = contextAt(index, pairs, contexts, includeAnalysis);
    if (context.context?.kind === "opaque")
      fail(path, source, index, "unsupported inner cfg attribute context");
    if (context.open === null) {
      wholeFile = true;
      excludedRanges.push({ start: 0, end: source.length });
    } else if (masked[context.open] === "{") {
      excludedRanges.push({ start: context.open, end: context.close + 1 });
    } else {
      fail(path, source, index, "inner cfg attribute has no enclosing block");
    }
  }

  const moduleItems = moduleDeclarations(
    path,
    source,
    masked,
    pairs,
    contexts,
    groups,
    excludedRanges,
    wholeFile,
    includeAnalysis,
  );
  const excludedLines = lineRanges(path, source, comments, excludedRanges, wholeFile);
  const analysis = {
    source,
    masked,
    pairs,
    contexts,
    groups,
    excludedRanges,
    excludedLines,
    wholeFile,
    moduleItems,
  };
  if (includeAnalysis) {
    analysis.sourceRegions = sourceRegions;
    analysis.innerAttributes = innerAttributes;
    analysis.macroRegions = macroRegions;
    analysis.functionItems = [...pairs]
      .filter(([open, close]) => open < close && masked[open] === "{")
      .map(([open, close]) => {
        if (contexts.get(open)?.form !== "function-body") return null;
        const header = headerBeforeBrace(path, source, masked, pairs, open);
        const name = header.match(/\bfn\s+(?:r#)?([A-Za-z_][A-Za-z0-9_]*)/)?.[1];
        if (!name) return null;
        const start = open - header.length;
        return { name, start, end: close + 1, text: source.slice(start, close + 1) };
      })
      .filter(Boolean);
    for (const region of sourceRegions) {
      const containing = analysis.functionItems
        .filter((item) => item.start <= region.start && region.start < item.end)
        .sort((left, right) => left.end - left.start - (right.end - right.start))[0];
      region.function = containing;
    }
  }
  return analysis;
}

function hasPathAttribute(attributes) {
  const hasPathMeta = (meta) => {
    let parts;
    try {
      parts = metaParts(meta);
    } catch {
      return false;
    }
    if (parts.name === "path") return true;
    if (parts.name !== "cfg_attr" || parts.body === undefined) return false;
    let argumentsList;
    try {
      argumentsList = splitMetaArguments(parts.body);
    } catch {
      return false;
    }
    return argumentsList.slice(1).some(hasPathMeta);
  };
  return attributes.some((attribute) => hasPathMeta(attribute.text));
}

function moduleCandidatePaths(path, name) {
  const fileName = posixPath.basename(path);
  const base = ["main.rs", "lib.rs", "mod.rs"].includes(fileName)
    ? posixPath.dirname(path)
    : posixPath.join(
        posixPath.dirname(path),
        fileName.slice(0, -posixPath.extname(fileName).length),
      );
  return [posixPath.join(base, `${name}.rs`), posixPath.join(base, name, "mod.rs")];
}

function validateModuleDeclaration(path, source, declaration) {
  if (declaration.inline) {
    fail(
      path,
      source,
      declaration.keyword,
      "unsupported test-only module declaration inside an inline module",
    );
  }
  if (hasPathAttribute(declaration.attributes)) {
    fail(
      path,
      source,
      declaration.keyword,
      "unsupported #[path] on a test-only module declaration",
    );
  }
}

function resolveModulePath(path, source, declaration, sourcesByPath, resolveModule) {
  validateModuleDeclaration(path, source, declaration);
  const candidates = moduleCandidatePaths(path, declaration.name);
  if (resolveModule) return resolveModule(path, source, declaration, candidates);

  const found = candidates.filter((candidate) => sourcesByPath.has(candidate));
  if (found.length !== 1) {
    fail(
      path,
      source,
      declaration.keyword,
      found.length === 0
        ? `cannot resolve test-only module ${declaration.name}`
        : `ambiguous test-only module ${declaration.name}: ${found.join(", ")}`,
    );
  }
  return found[0];
}

function resolveModulePathOnDisk(path, source, declaration, candidates, root) {
  const found = [];
  for (const candidate of candidates) {
    const filePath = resolve(root, candidate);
    try {
      accessSync(filePath);
      found.push(candidate);
    } catch (error) {
      if (error.code === "ENOENT" || error.code === "ENOTDIR") continue;
      const details =
        error.code && !error.message?.startsWith(`${error.code}:`)
          ? `${error.code}: ${error.message}`
          : error.message;
      fail(
        path,
        source,
        declaration.keyword,
        `unable to access test-only module candidate ${filePath}: ${details}`,
      );
    }
  }
  if (found.length !== 1) {
    fail(
      path,
      source,
      declaration.keyword,
      found.length === 0
        ? `cannot resolve test-only module ${declaration.name}`
        : `ambiguous test-only module ${declaration.name}: ${found.join(", ")}`,
    );
  }
  return found[0];
}

function prepareAtomValuation(atomValuation) {
  if (atomValuation === null || typeof atomValuation !== "object" || Array.isArray(atomValuation)) {
    throw new TypeError("Rust cfg atom valuation must be an object");
  }
  const result = { ...DEFAULT_ATOM_VALUATION, ...atomValuation };
  for (const [atom, value] of Object.entries(result)) {
    if (value !== undefined && typeof value !== "boolean") {
      throw new TypeError(`Rust cfg atom valuation for ${atom} must be a boolean or undefined`);
    }
  }
  return result;
}

function sourceEntries(sources) {
  if (sources instanceof Map)
    return [...sources.entries()].map(([path, contents]) => ({ path, contents }));
  return [...sources];
}

/**
 * Classify test-only Rust lines and module files from in-memory source contents.
 * Atom valuation keys are cfg atom names; string-valued atoms use `name="value"` keys.
 */
export function classifyRustTestOnlySources(
  sources,
  atomValuation = DEFAULT_ATOM_VALUATION,
  options = {},
) {
  if (!options || typeof options !== "object" || Array.isArray(options)) {
    throw new TypeError("Rust test-only classifier options must be an object");
  }
  if (options.resolveModule !== undefined && typeof options.resolveModule !== "function") {
    throw new TypeError("Rust test-only module resolver must be a function");
  }
  const evaluatedAtoms = prepareAtomValuation(atomValuation);
  const entries = sourceEntries(sources);
  const analyses = new Map();
  for (const { path, contents } of entries) {
    if (typeof path !== "string" || typeof contents !== "string") {
      throw new TypeError("Rust source entries must contain string path and contents fields");
    }
    if (extname(path) !== ".rs") {
      throw new Error(`${path}:1: excludeTestOnlyItems can scan only .rs files`);
    }
    if (analyses.has(path)) throw new Error(`${path}:1: duplicate Rust source path`);
    analyses.set(
      path,
      analyzeRustFile(path, contents, evaluatedAtoms, options.includeAnalysis === true),
    );
  }

  const testOnlyFiles = new Set(
    [...analyses].filter(([, analysis]) => analysis.wholeFile).map(([path]) => path),
  );
  const sourcesByPath = new Map(entries.map(({ path, contents }) => [path, contents]));
  const queue = [];
  for (const [path, analysis] of analyses) {
    for (const declaration of analysis.moduleItems) {
      if (declaration.testOnly) queue.push({ path, source: analysis.source, declaration });
    }
  }
  const processed = new Set();
  while (queue.length) {
    const item = queue.shift();
    const key = `${item.path}:${item.declaration.keyword}`;
    if (processed.has(key)) continue;
    processed.add(key);
    const target = resolveModulePath(
      item.path,
      item.source,
      item.declaration,
      sourcesByPath,
      options.resolveModule,
    );
    item.declaration.targetPath = target;
    if (!sourcesByPath.has(target) || testOnlyFiles.has(target)) continue;
    testOnlyFiles.add(target);
    const targetAnalysis = analyses.get(target);
    for (const declaration of targetAnalysis.moduleItems) {
      queue.push({
        path: target,
        source: targetAnalysis.source,
        declaration: { ...declaration, testOnly: true },
      });
    }
  }

  const excludedLines = new Map(
    [...analyses].map(([path, analysis]) => [path, analysis.excludedLines]),
  );
  for (const path of testOnlyFiles) {
    excludedLines.set(path, lineRanges(path, sourcesByPath.get(path), [], [], true));
  }
  const excludedLineCounts = new Map([...excludedLines].map(([path, lines]) => [path, lines.size]));
  const result = { testOnlyFiles, excludedLines, excludedLineCounts };
  if (options.includeAnalysis) result.analysis = analyses;
  return result;
}

function validateExclusionConfig(source) {
  if (source.excludeTestOnlyItems === undefined) return false;
  const field = source.excludeTestOnlyItems;
  if (
    !field ||
    typeof field !== "object" ||
    Array.isArray(field) ||
    typeof field.reason !== "string" ||
    !field.reason.trim()
  ) {
    throw new Error(
      `Coverage source ${source.id} excludeTestOnlyItems must be an object with a non-empty reason string`,
    );
  }
  return true;
}

/**
 * Scan all include-matched files for one configured Rust source before its exclude globs are
 * applied. `files` may be supplied by the caller to reuse its directory walk.
 */
export async function scanRustTestOnly({ root, source, files }) {
  if (!validateExclusionConfig(source)) {
    return { testOnlyFiles: new Set(), excludedLines: new Map(), excludedLineCounts: new Map() };
  }
  const sourceRoot = resolve(root, source.root);
  let candidateFiles;
  try {
    candidateFiles = files ?? (await filesBelow(sourceRoot));
  } catch (error) {
    throw new Error(`${source.root}:1: unable to scan Rust source tree: ${error.message}`, {
      cause: error,
    });
  }
  const included = candidateFiles
    .map((file) => normalisePath(file, root))
    .filter((file) => matches(file, source.include));
  for (const file of included) {
    if (extname(file) !== ".rs") {
      throw new Error(`${file}:1: excludeTestOnlyItems can scan only .rs files`);
    }
  }

  const sourceTexts = new Map();
  for (const path of included) {
    try {
      const text = await readFile(resolve(root, path), "utf8");
      sourceTexts.set(path, text);
    } catch (error) {
      if (error.message?.startsWith(`${path}:`)) throw error;
      throw new Error(`${path}:1: unable to read Rust source: ${error.message}`, { cause: error });
    }
  }
  return classifyRustTestOnlySources(
    [...sourceTexts].map(([path, contents]) => ({ path, contents })),
    DEFAULT_ATOM_VALUATION,
    {
      resolveModule: (path, text, declaration, candidates) =>
        resolveModulePathOnDisk(path, text, declaration, candidates, root),
    },
  );
}

export { validateExclusionConfig };
