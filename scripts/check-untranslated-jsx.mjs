import { parseSync } from "@babel/core";
import { readdir, readFile } from "node:fs/promises";
import { dirname, join, relative } from "node:path";
import { fileURLToPath } from "node:url";

const root = dirname(dirname(fileURLToPath(import.meta.url)));
const sourceRoot = join(root, "src");
const userFacingAttributes = new Set([
  "aria-label",
  "aria-description",
  "aria-valuetext",
  "label",
  "placeholder",
  "description",
  "title",
  "alt",
  // Confirmation copy reaches the user identically whether it is written as a
  // JSX prop or as an object field, so both spellings are the same sink.
  "confirmLabel",
  "cancelLabel",
]);
const userFacingObjectProperties = new Set([
  "label",
  "title",
  "description",
  "placeholder",
  "alt",
  "noRecordsText",
  "message",
  "confirmLabel",
  "cancelLabel",
]);
const userFacingCalls = new Set(["ask", "message"]);

const technicalNotation =
  /^(?:FEN|PGN|ELO|UCI(?:_[A-Za-z]+)?|WDL|ACPL|n\/s|O-O(?:-O)?|\?|\?{4}\.\?{2}\.\?{2})$/u;
const namedAssetRegistries = new Set(["PiecesSelect.tsx", "SoundSelect.tsx", "SettingsPage.tsx"]);
const productIdentitySources = new Set([
  "About.tsx",
  "AccountCard.tsx",
  "Accounts.tsx",
  "LichessLogo.tsx",
  "WebsiteAccountSelector.tsx",
]);

/**
 * A literal with no letter in any script carries no translatable word: scale
 * marks, separators, punctuation and digits. JSX text has always been judged
 * this way; string and template literals are held to the same structural test so
 * the sink a value happens to sit in does not change whether it is copy.
 * Locale-dependent number shaping belongs to `Intl.NumberFormat`, not to a
 * catalogue key.
 */
function hasTranslatableWord(value) {
  return /\p{L}/u.test(value);
}

function isStructuredTechnicalLiteral(value, filename) {
  const basename = filename.split("/").at(-1);
  if (namedAssetRegistries.has(basename))
    return /^\d+%$|^\(\d+\)$/u.test(value) || /^[\p{L}\d .()]+$/u.test(value);
  return (
    productIdentitySources.has(basename) &&
    /^(?:En Croissant|Lichess|Chess\.com|chess\.com|www\.encroissant\.org)$/u.test(value)
  );
}

async function files(directory) {
  const entries = await readdir(directory, { withFileTypes: true });
  const nested = await Promise.all(
    entries.map(async (entry) => {
      const path = join(directory, entry.name);
      if (entry.isDirectory()) return files(path);
      return entry.isFile() && /\.tsx$/u.test(entry.name) && !/\.test\.tsx$/u.test(entry.name)
        ? [path]
        : [];
    }),
  );
  return nested.flat();
}

function isTranslationCall(node) {
  return (
    node?.type === "CallExpression" &&
    node.callee?.type === "Identifier" &&
    node.callee.name === "t"
  );
}

function isUserFacingCall(node) {
  if (node?.type !== "CallExpression") return false;
  if (node.callee?.type === "Identifier") return userFacingCalls.has(node.callee.name);
  return (
    node.callee?.type === "MemberExpression" &&
    node.callee.object?.type === "Identifier" &&
    node.callee.object.name === "notifications" &&
    node.callee.property?.type === "Identifier" &&
    node.callee.property.name === "show"
  );
}

export function findLiterals(source, filename = "source.tsx") {
  const literals = [];
  const ast = parseSync(source, {
    filename,
    parserOpts: { plugins: ["typescript", "jsx"] },
  });

  function visit(node, userFacing = false) {
    if (!node || typeof node !== "object") return;
    if (isTranslationCall(node)) return;
    if (node.type === "JSXText") {
      const value = node.value.trim();
      if (
        value &&
        hasTranslatableWord(value) &&
        !technicalNotation.test(value) &&
        !isStructuredTechnicalLiteral(value, filename)
      )
        literals.push(value);
    }
    if (node.type === "StringLiteral" && userFacing) {
      const value = node.value.trim();
      if (
        value &&
        hasTranslatableWord(value) &&
        !technicalNotation.test(value) &&
        !isStructuredTechnicalLiteral(value, filename)
      )
        literals.push(value);
      return;
    }
    if (node.type === "TemplateLiteral" && userFacing) {
      for (const quasi of node.quasis) {
        const value = quasi.value.cooked?.trim() ?? "";
        if (
          value &&
          hasTranslatableWord(value) &&
          !technicalNotation.test(value) &&
          !isStructuredTechnicalLiteral(value, filename)
        )
          literals.push(value);
      }
      return;
    }
    if (node.type === "ConditionalExpression") {
      // The condition is application state; only the two rendered outcomes are copy.
      visit(node.test, false);
      visit(node.consequent, userFacing);
      visit(node.alternate, userFacing);
      return;
    }
    if (node.type === "JSXExpressionContainer") {
      visit(node.expression, userFacing);
      return;
    }
    if (node.type === "JSXElement" || node.type === "JSXFragment") {
      for (const child of node.children ?? []) visit(child, false);
      if (node.openingElement) visit(node.openingElement, false);
      return;
    }
    const isAttribute =
      node.type === "JSXAttribute" &&
      node.name?.type === "JSXIdentifier" &&
      userFacingAttributes.has(node.name.name);
    const isObjectProperty =
      node.type === "ObjectProperty" &&
      ((node.key?.type === "Identifier" && userFacingObjectProperties.has(node.key.name)) ||
        (node.key?.type === "StringLiteral" && userFacingObjectProperties.has(node.key.value)));
    if (node.type === "ObjectProperty") {
      visit(node.key, false);
      // A recognized field is a UI sink, but its nested object is not. This keeps
      // `{ label: { fontWeight: "normal" } }` from mistaking CSS configuration for copy.
      visit(node.value, isObjectProperty);
      return;
    }
    if (isUserFacingCall(node)) {
      for (const argument of node.arguments)
        visit(
          argument,
          node.callee?.type === "Identifier" && userFacingCalls.has(node.callee.name),
        );
      return;
    }
    const nextUserFacing = userFacing || isAttribute;
    for (const value of Object.values(node)) {
      if (Array.isArray(value)) value.forEach((child) => visit(child, nextUserFacing));
      else visit(value, nextUserFacing);
    }
  }
  visit(ast);
  return literals;
}

const violations = [];
for (const file of await files(sourceRoot)) {
  const source = await readFile(file, "utf8");
  for (const literal of findLiterals(source, file))
    violations.push(`${relative(root, file)}: ${JSON.stringify(literal)}`);
}

if (violations.length) {
  console.error(
    "Untranslated UI literals found. Use t()/Trans; allowed technical exceptions are documented in this script.",
  );
  console.error(violations.join("\n"));
  process.exitCode = 1;
}
