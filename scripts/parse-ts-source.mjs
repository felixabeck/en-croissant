import { parseSync } from "@babel/core";

export function parseTsSource(source, path) {
  return parseSync(source, {
    filename: path,
    // A parse failure's code frame is colorized whenever Babel thinks the terminal wants
    // it, and GitHub Actions sets FORCE_COLOR=1: measured, the same source yields a plain
    // frame locally and an ANSI-escaped one on the runner, so a checker whose diagnostic is
    // asserted exactly is red on CI and green here. Pinning it plain makes the message the
    // same string in both environments.
    highlightCode: false,
    parserOpts: {
      plugins: path.endsWith(".tsx") ? ["typescript", "jsx"] : ["typescript"],
      sourceType: "module",
    },
    babelrc: false,
    configFile: false,
    presets: [],
    plugins: [],
  });
}

// THE binding walk. One file, required by every probe in the plan and, in the
// implementation, exported from scripts/parse-ts-source.mjs with the same text and ESM
// export syntax. Divergence between copies of this walk caused FF1, FF2, GG1, GG2, GG3,
// HH1 and HH2; there is now nothing to diverge.
const VALUE_WRAPPERS = new Set([
  "TSAsExpression",
  "TSSatisfiesExpression",
  "TSNonNullExpression",
  "TSInstantiationExpression",
  "TSTypeAssertion",
]);
const PARAM_OF = new Set([
  "ArrowFunctionExpression",
  "FunctionDeclaration",
  "FunctionExpression",
  "ObjectMethod",
  "ClassMethod",
  "ClassPrivateMethod",
]);
function unwrap(node) {
  while (node && VALUE_WRAPPERS.has(node.type)) node = node.expression;
  return node;
}
/**
 * The one constancy rule: whether the walk follows this binding onwards.
 * `constant` is Babel's "never reassigned", not `const`: measured, both bindings of
 * `let a = b; let b = a;` are constant, and `let a = tauri; a = editor;` is not.
 */
function followsAlias(binding) {
  if (!binding || !binding.constant) return false;
  const node = binding.path.node;
  if (node.type === "VariableDeclarator") return true;
  return node.type === "AssignmentPattern" && PARAM_OF.has(binding.path.parentPath.node.type);
}
/**
 * Walk a constant alias chain to its terminal node.
 * Returns `{ node, scope, binding, cyclic }`: `node` is the terminal — an ImportSpecifier,
 * a literal, or the last Identifier the walk could not follow — `binding` the binding it
 * stopped on, if any, and `cyclic` true when it stopped because the chain revisited a
 * binding. A cycle is UNRESOLVABLE INPUT, not a failure: the walk reports "I could not get
 * there", and each caller already knows what an unresolvable terminal means for it (a member
 * object that is not an accepted ImportSpecifier is not a consumer; a module specifier that
 * names nothing is out of reach). It is never C5 — a cyclic chain cannot hold the facade
 * binding, because a chain that reaches an ImportSpecifier stops there. Throwing instead
 * would redden the gate on a cycle in code that has nothing to do with the facade.
 */
function resolveChain(node, scope, seen = new Set()) {
  node = unwrap(node);
  if (!node || node.type !== "Identifier") return { node, scope };
  const binding = scope.getBinding(node.name);
  if (!binding) return { node, scope };
  if (seen.has(binding)) return { node, scope, binding, cyclic: true };
  seen.add(binding);
  const bindingNode = binding.path.node;
  if (bindingNode.type === "ImportSpecifier") return { node: bindingNode, scope, binding };
  if (!followsAlias(binding)) return { node, scope, binding };
  return resolveChain(
    bindingNode.type === "VariableDeclarator" ? bindingNode.init : bindingNode.right,
    binding.scope,
    seen,
  );
}

export { VALUE_WRAPPERS, PARAM_OF, followsAlias, resolveChain };
