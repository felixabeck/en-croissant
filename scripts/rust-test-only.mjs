import { access, readFile } from "node:fs/promises";
import { basename, dirname, extname, join, resolve } from "node:path";
import { filesBelow } from "./files-below.mjs";
import { matches, normalisePath } from "./coverage-scope.mjs";
import { maskRustSourceWithSpans } from "./rust-source-mask.mjs";

const WORD = /[A-Za-z0-9_]/;
const IDENTIFIER = /^(?:r#)?[A-Za-z_][A-Za-z0-9_]*/;

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
    [" )", "("],
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

function classifyBrace(path, source, code, pairs, open) {
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
  if (
    !/\btry\s*$/.test(compact) &&
    /\b[A-Za-z_][A-Za-z0-9_]*(?:::[A-Za-z_][A-Za-z0-9_]*)*(?:\s*::<[\s\S]*>)?\s*$/.test(compact)
  ) {
    return { kind: "comma-list", form: "struct-literal" };
  }
  if (/^(?:std::)?thread_local\s*!\s*$/.test(compact)) {
    return { kind: "item-list", form: "thread-local-macro" };
  }
  if (
    /\b(?:macro_rules|[A-Za-z_][A-Za-z0-9_]*(?:::[A-Za-z_][A-Za-z0-9_]*)*)\s*!\s*$/.test(compact)
  ) {
    return { kind: "opaque", form: "macro-input" };
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

function openerContexts(path, source, code, pairs) {
  const contexts = new Map();
  for (const [open, close] of pairs) {
    if (open > close) continue;
    const delimiter = code[open];
    if (delimiter === "{") {
      contexts.set(open, classifyBrace(path, source, code, pairs, open));
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

function contextAt(offset, pairs, contexts) {
  let selected;
  for (const [open, close] of pairs) {
    if (open < close && open < offset && offset < close && (!selected || open > selected.open)) {
      selected = { open, close, context: contexts.get(open) };
    }
  }
  return selected ?? { open: null, close: null, context: { kind: "item-list", form: "file" } };
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
      const end = skipQuoted(text, cursor);
      if (end === -1) throw new Error("unterminated cfg value");
      cursor = end;
      return { type: "atom", name: `${name}=value` };
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

function evaluatePredicate(predicate) {
  if (predicate.type === "atom") {
    if (predicate.name === "test") return false;
    return undefined;
  }
  const values = predicate.children.map(evaluatePredicate);
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

function evaluateCfgAttribute(attribute, path, source) {
  const { name, body } = metaParts(attribute.text);
  if (name === "cfg") {
    if (body === undefined)
      fail(path, source, attribute.start, "unparseable cfg predicate (missing parentheses)");
    return evaluatePredicate(parsePredicate(body, path, source, attribute.start)) === false;
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
      const applies =
        conditions.length === 0 ? true : evaluatePredicate({ type: "all", children: conditions });
      const result = evaluatePredicate(nested);
      const effective =
        applies === false ? true : applies === true ? result : result === true ? true : undefined;
      return effective === false;
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
      return nestedArguments
        .slice(1)
        .some((nestedMeta) => visit(nestedMeta, [...conditions, nestedCondition]));
    }
    return false;
  };
  return argumentsList.slice(1).some((nestedMeta) => visit(nestedMeta, [condition]));
}

function parseAttributes(path, source, groups) {
  for (const group of groups) {
    group.testOnly = group.attributes.some((attribute) =>
      evaluateCfgAttribute(attribute, path, source),
    );
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

function findTopLevelTerminator(code, pairs, start, close, wanted, { angleAware = true } = {}) {
  let angle = 0;
  for (let index = start; index < close; index += 1) {
    const character = code[index];
    if (character === "<" && angleAware) {
      const previous = code[index - 1];
      const beforePrevious = code[index - 2];
      if (WORD.test(previous ?? "") || (previous === ":" && beforePrevious === ":")) angle += 1;
      continue;
    }
    if (character === ">" && angleAware && angle > 0) {
      if (code[index - 1] === "-" || code[index - 1] === "=" || code[index + 1] === "=") continue;
      angle = Math.max(0, angle - 1);
      continue;
    }
    if ("([{ ".includes(character) && character !== " ") {
      const end = pairs.get(index);
      if (end === undefined) return -1;
      if (character === "{" && angle === 0 && wanted.has("{")) return index;
      index = end;
      continue;
    }
    if (character === ";" && angle === 0 && wanted.has(";")) return index;
  }
  return -1;
}

function findItemEnd(path, source, code, pairs, start, contextClose) {
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
  const following = skipWhitespace(code, lastClose + 1);
  return code[following] === ";" ? following : lastClose;
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
    return findItemEnd(path, source, code, pairs, cursor, close);
  }
  if (word === "let") {
    const semicolon = findTopLevelTerminator(code, pairs, cursor + 3, close, new Set([";"]));
    if (semicolon < 0)
      fail(path, source, start, "test-only statement reaches its enclosing } without a terminator");
    return semicolon;
  }
  if (word === "if") return findIfChainEnd(path, source, code, pairs, cursor + 2, close);
  if (word === "match") {
    const body = findTopLevelTerminator(code, pairs, cursor + 5, close, new Set(["{"]));
    if (body < 0) fail(path, source, start, "unsupported test-only match form");
    let end = pairs.get(body);
    if (end === undefined) fail(path, source, body, "unbalanced delimiter");
    const following = skipWhitespace(code, end + 1);
    if (code[following] === ";") end = following;
    return end;
  }
  if (code[cursor] === "{") {
    let end = pairs.get(cursor);
    if (end === undefined) fail(path, source, cursor, "unbalanced delimiter");
    const following = skipWhitespace(code, end + 1);
    if (code[following] === ";") end = following;
    return end;
  }
  const macro = code
    .slice(cursor, close)
    .match(/^(?:[A-Za-z_][A-Za-z0-9_]*(?:::[A-Za-z_][A-Za-z0-9_]*)*)\s*!\s*\{/);
  if (macro) {
    const brace = cursor + macro[0].lastIndexOf("{");
    let end = pairs.get(brace);
    if (end === undefined) fail(path, source, brace, "unbalanced delimiter");
    const following = skipWhitespace(code, end + 1);
    if (code[following] === "?")
      fail(
        path,
        source,
        cursor,
        "unsupported test-only form; give it its own item/statement or extend rust-test-only.mjs",
      );
    if (code[following] === ";") end = following;
    return end;
  }
  const semicolon = findTopLevelTerminator(code, pairs, cursor, close, new Set([";"]));
  if (semicolon < 0)
    fail(path, source, start, "test-only statement reaches its enclosing } without a terminator");
  return semicolon;
}

function angleOpens(code, index) {
  const previous = code[index - 1];
  return WORD.test(previous ?? "") || (previous === ":" && code[index - 2] === ":");
}

function findListComma(code, pairs, start, context, sourceLength) {
  const close = context.close ?? sourceLength;
  const stack = [
    { open: context.open, type: context.open === null ? "root" : code[context.open], angle: 0 },
  ];
  for (let index = start; index < close; index += 1) {
    const character = code[index];
    if (character === "<" && angleOpens(code, index)) {
      stack.at(-1).angle += 1;
      continue;
    }
    if (character === ">" && stack.at(-1).angle > 0) {
      if (code[index - 1] === "-" || code[index - 1] === "=" || code[index + 1] === "=") continue;
      stack.at(-1).angle = Math.max(0, stack.at(-1).angle - 1);
      continue;
    }
    if ("([{ ".includes(character) && character !== " ") {
      const end = pairs.get(index);
      if (end === undefined) return { comma: -1, close };
      if (index === context.open) continue;
      index = end;
      continue;
    }
    if (character === "," && stack.length === 1 && stack[0].angle === 0)
      return { comma: index, close };
  }
  return { comma: -1, close };
}

function matchArmEnd(path, source, code, pairs, start, context) {
  const { close } = findListComma(code, pairs, start, context, source.length);
  let arrow = -1;
  let angle = 0;
  for (let index = start; index < close; index += 1) {
    if (code[index] === "<" && angleOpens(code, index)) angle += 1;
    else if (
      code[index] === ">" &&
      angle > 0 &&
      code[index - 1] !== "-" &&
      code[index - 1] !== "=" &&
      code[index + 1] !== "="
    )
      angle -= 1;
    else if (angle === 0 && code.startsWith("=>", index)) {
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
  let nestedAngle = 0;
  for (let index = next; index < close; index += 1) {
    if (code[index] === "<" && angleOpens(code, index)) nestedAngle += 1;
    else if (
      code[index] === ">" &&
      nestedAngle > 0 &&
      code[index - 1] !== "-" &&
      code[index - 1] !== "=" &&
      code[index + 1] !== "="
    )
      nestedAngle -= 1;
    else if (nestedAngle === 0 && code.startsWith("=>", index)) return blockEnd;
    else if (nestedAngle === 0 && code[index] === ",") return index;
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
    end = findItemEnd(path, source, code, pairs, after, context.close ?? code.length);
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

function moduleDeclarations(path, source, code, pairs, contexts, groups, ranges, wholeFile) {
  const declarations = [];
  const regex = /\bmod\s+((?:r#)?[A-Za-z_][A-Za-z0-9_]*)\s*;/g;
  let match;
  while ((match = regex.exec(code))) {
    const keyword = match.index;
    const name = match[1].replace(/^r#/, "");
    const context = contextAt(keyword, pairs, contexts);
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
      if (overlaps && !isWhitespace(source[cursor]) && !commentPosition(comments, cursor)) {
        fail(path, source, cursor, "shared coverage line; give the test-only item its own lines");
      }
    }
    if (!overlaps) continue;
    // The line may start with production code before the excluded item. Validate those characters
    // too; the forward loop above only sees them before `overlaps` became true.
    for (let cursor = start; cursor < end; cursor += 1) {
      let inRange = false;
      for (
        let range = rangeCursor;
        range < sortedRanges.length && sortedRanges[range].start < end;
        range += 1
      ) {
        if (sortedRanges[range].start <= cursor && cursor < sortedRanges[range].end) {
          inRange = true;
          break;
        }
      }
      if (!inRange && !isWhitespace(source[cursor]) && !commentPosition(comments, cursor)) {
        fail(path, source, cursor, "shared coverage line; give the test-only item its own lines");
      }
    }
    excluded.add(lineIndex + 1);
  }
  return excluded;
}

function analyzeRustFile(path, source) {
  const { masked, comments } = maskRustSourceWithSpans(source);
  const pairs = delimiterPairs(path, source, masked);
  const contexts = openerContexts(path, source, masked, pairs);
  const groups = attributeGroups(path, source, masked, pairs);
  parseAttributes(path, source, groups);
  const excludedRanges = [];
  for (const group of groups) {
    if (!group.testOnly) continue;
    const context = contextAt(group.start, pairs, contexts);
    if (context.context?.kind === "opaque") {
      fail(path, source, group.start, "unsupported test-only context inside a macro input");
    }
    if (!context.context || context.context.kind === "unplaced") {
      fail(
        path,
        source,
        group.start,
        "unplaceable test-only context; extend rust-test-only.mjs only for a listed Rust form",
      );
    }
    excludedRanges.push(
      itemRange(path, source, masked, pairs, group, {
        ...context.context,
        open: context.open,
        close: context.close,
      }),
    );
  }

  let wholeFile = false;
  for (let index = 0; index < masked.length; index += 1) {
    if (masked[index] !== "#" || masked[index + 1] !== "!" || masked[index + 2] !== "[") continue;
    const open = index + 2;
    const close = pairs.get(open);
    if (close === undefined) fail(path, source, index, "unbalanced inner attribute delimiter");
    const attribute = { start: index, text: source.slice(open + 1, close) };
    if (!evaluateCfgAttribute(attribute, path, source)) continue;
    const context = contextAt(index, pairs, contexts);
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
  );
  const excludedLines = lineRanges(path, source, comments, excludedRanges, wholeFile);
  return {
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
}

async function resolveModulePath(path, source, declaration, root, includedFiles) {
  if (declaration.inline) {
    fail(
      path,
      source,
      declaration.keyword,
      "unsupported test-only module declaration inside an inline module",
    );
  }
  if (declaration.attributes.some((attribute) => /^\s*path\b/.test(attribute.text))) {
    fail(
      path,
      source,
      declaration.keyword,
      "unsupported #[path] on a test-only module declaration",
    );
  }
  const file = resolve(root, path);
  const fileName = basename(file);
  const base = ["main.rs", "lib.rs", "mod.rs"].includes(fileName)
    ? dirname(file)
    : join(dirname(file), fileName.slice(0, -extname(fileName).length));
  const candidates = [join(base, `${declaration.name}.rs`), join(base, declaration.name, "mod.rs")];
  const found = [];
  for (const candidate of candidates) {
    try {
      await access(candidate);
      found.push(normalisePath(candidate, root));
    } catch {
      // Missing module paths are diagnosed below with the declaring file and line.
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
  const target = found[0];
  if (!includedFiles.has(target)) return target;
  return target;
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
  const analyses = new Map();
  for (const path of included) {
    try {
      const text = await readFile(resolve(root, path), "utf8");
      sourceTexts.set(path, text);
      analyses.set(path, analyzeRustFile(path, text));
    } catch (error) {
      if (error.message?.startsWith(`${path}:`)) throw error;
      throw new Error(`${path}:1: unable to read Rust source: ${error.message}`, { cause: error });
    }
  }

  const testOnlyFiles = new Set(
    [...analyses].filter(([, analysis]) => analysis.wholeFile).map(([path]) => path),
  );
  const includedFiles = new Set(included);
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
    const target = await resolveModulePath(
      item.path,
      item.source,
      item.declaration,
      root,
      includedFiles,
    );
    if (!includedFiles.has(target) || testOnlyFiles.has(target)) continue;
    testOnlyFiles.add(target);
    const targetAnalysis = analyses.get(target);
    if (!targetAnalysis) continue;
    for (const declaration of targetAnalysis.moduleItems) {
      queue.push({
        path: target,
        source: targetAnalysis.source,
        declaration: { ...declaration, testOnly: true },
      });
    }
  }

  const excludedLines = new Map();
  for (const [path, analysis] of analyses) excludedLines.set(path, analysis.excludedLines);
  for (const path of testOnlyFiles) {
    const text = sourceTexts.get(path) ?? "";
    excludedLines.set(path, lineRanges(path, text, [], [], true));
  }
  const excludedLineCounts = new Map([...excludedLines].map(([path, lines]) => [path, lines.size]));
  return { testOnlyFiles, excludedLines, excludedLineCounts };
}

export { validateExclusionConfig };
