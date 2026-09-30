/**
 * Rust source masking shared by the release-surface checker and coverage scanner.
 * Masked characters become spaces; line breaks and UTF-16 offsets are preserved.
 */
export function maskRustSource(source, cache) {
  return maskRustSourceWithSpans(source, cache).masked;
}

/**
 * Return masked code and source spans for comments and literals. Comments and literals are
 * separate because coverage line mapping treats comments as non-code and literals as code.
 */
export function maskRustSourceWithSpans(source, cache) {
  if (cache !== undefined && !(cache instanceof Map)) {
    throw new TypeError("Rust source mask cache must be a Map");
  }
  if (cache?.has(source)) return cache.get(source);

  // Indexed code units keep every source offset stable, including astral characters.
  const masked = source.split("");
  const comments = [];
  const literals = [];

  const blank = (start, end, kind) => {
    for (let index = start; index < end; index += 1) {
      if (source[index] !== "\n" && source[index] !== "\r") masked[index] = " ";
    }
    (kind === "comment" ? comments : literals).push({ start, end });
  };

  const literalEnd = (quoteIndex, quote) => {
    let index = quoteIndex + 1;
    while (index < source.length) {
      if (source[index] === "\\") {
        index += 2;
        continue;
      }
      if (source[index] === quote) return index + 1;
      index += 1;
    }
    return source.length;
  };

  const charLiteralEnd = (quoteIndex) => {
    let index = quoteIndex + 1;
    if (index >= source.length || source[index] === "\n" || source[index] === "\r") return null;
    if (source[index] === "\\") {
      index += 1;
      if (source[index] === "u" && source[index + 1] === "{") {
        const braceEnd = source.indexOf("}", index + 2);
        if (braceEnd === -1) return null;
        index = braceEnd + 1;
      } else if (source[index] === "x") {
        index += 3;
      } else {
        index += 1;
      }
    } else {
      const point = source.codePointAt(index);
      index += point > 0xffff ? 2 : 1;
    }
    return source[index] === "'" ? index + 1 : null;
  };

  let index = 0;
  while (index < source.length) {
    if (source.startsWith("//", index)) {
      let end = index + 2;
      while (end < source.length && source[end] !== "\n" && source[end] !== "\r") end += 1;
      blank(index, end, "comment");
      index = end;
      continue;
    }

    if (source.startsWith("/*", index)) {
      const start = index;
      let depth = 1;
      index += 2;
      while (index < source.length && depth > 0) {
        if (source.startsWith("/*", index)) {
          depth += 1;
          index += 2;
        } else if (source.startsWith("*/", index)) {
          depth -= 1;
          index += 2;
        } else {
          index += 1;
        }
      }
      blank(start, index, "comment");
      continue;
    }

    // Rust raw strings may have no hashes. The `b`/`c` prefix stays code and only the literal
    // from its opening quote through its matching quote is blanked.
    const rawStart = source.slice(index).match(/^(?:br|cr|r)(#*)"/);
    if (rawStart) {
      const quoteIndex = index + rawStart[0].length - 1;
      const closing = `"${rawStart[1]}`;
      const found = source.indexOf(closing, quoteIndex + 1);
      const end = found === -1 ? source.length : found + closing.length;
      blank(quoteIndex, end, "literal");
      index = end;
      continue;
    }

    const byteOrCString =
      (source[index] === "b" || source[index] === "c") &&
      (source[index + 1] === '"' || source[index + 1] === "'");
    const quoteIndex = byteOrCString ? index + 1 : index;
    if (source[quoteIndex] === '"') {
      const end = literalEnd(quoteIndex, '"');
      blank(quoteIndex, end, "literal");
      index = end;
      continue;
    }

    if (source[quoteIndex] === "'") {
      const end = charLiteralEnd(quoteIndex);
      if (end !== null) {
        blank(quoteIndex, end, "literal");
        index = end;
        continue;
      }
    }

    index += 1;
  }

  const result = {
    masked: masked.join(""),
    comments,
    literals,
  };
  cache?.set(source, result);
  return result;
}
