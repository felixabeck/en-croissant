// Staged failures (2026-09-21, every run exit 1; scratch inputs only, checker logic unchanged):
// C1: `C1: command X has no production consumer`.
// C2: `C2: allowlist entry X has a production consumer; remove the allowlist entry`.
// C3: `C3: allowlist entry gone names a command that is not exported`.
// C4.1: `C4.1: allowlist entry X has invalid finding id not-a-finding`.
// C4.2: `C4.2: finding f-20990101-99 for allowlisted command X does not exist as an unfenced ledger entry`.
// C4.3: `C4.3: finding f-20260829-01 for allowlisted command coverage is not open (status: handled)`.
// C4.4: `C4.4: finding f-20260829-02 for allowlisted command getMagicThing does not name getMagicThing or get_magic_thing`.
// C5: `C5: src/consumer.ts:1: facade reach is not statically resolvable: tauri[key]`.
// Enumeration: `src/bindings/generated.ts: exported commands declaration is missing`;
// `src/bindings/generated.ts: exported commands initializer is not an ObjectExpression`;
// `src/bindings/generated.ts: commands object member 0 is not an ObjectMethod with a plain Identifier key`.
// Allowlist input: absent `Cannot read ipc-command-consumer-allowlist.json: ENOENT: no such file or directory, open '<scratch>/ipc-command-consumer-allowlist.json'`;
// malformed `Cannot parse ipc-command-consumer-allowlist.json: Expected property name or '}' in JSON at position 1 (line 1 column 2)`;
// shape `Invalid ipc-command-consumer-allowlist.json: expected an array`.
// Allowlist entry shape: `Invalid ipc-command-consumer-allowlist.json: entry 0 must contain string command and finding`.
// Parse/read: `Cannot parse src/consumer.ts: Unexpected token (1:6)\n\n> 1 | const = ;\n    |       ^`;
// generated permission `Cannot read src/bindings/generated.ts: EACCES: permission denied, open '<scratch>/src/bindings/generated.ts'`;
// generated absent `Cannot read src/bindings/generated.ts: ENOENT: no such file or directory, open '<scratch>/src/bindings/generated.ts'`;
// allowlist permission `Cannot read ipc-command-consumer-allowlist.json: EACCES: permission denied, open '<scratch>/ipc-command-consumer-allowlist.json'`;
// renderer permission `Cannot read src/consumer.ts: EACCES: permission denied, open '<scratch>/src/consumer.ts'`;
// ledger permission `Cannot read tasks/findings.md: EACCES: permission denied, open '<scratch>/tasks/findings.md'`;
// ledger absent `Cannot read tasks/findings.md: ENOENT: no such file or directory, open '<scratch>/tasks/findings.md'`.
// Findings projection: malformed `Cannot parse findings projection for <scratch>/scripts/findings.py list --json --body --strict: Unexpected token 'o', "not-json\n" is not valid JSON`;
// non-array `Invalid <scratch>/scripts/findings.py list --json --body --strict: expected an array`;
// malformed shape `Invalid <scratch>/scripts/findings.py list --json --body --strict: entry 0 must contain string id, status and body`;
// non-zero `Cannot read findings projection for <scratch>/scripts/findings.py list --json --body --strict: REFUSING: malformed ledger`;
// spawn `Cannot read findings projection for <scratch>/scripts/findings.py list --json --body --strict: spawnSync <scratch>/scripts/findings.py ENOENT`.
// Working-tree enumeration: non-zero `Cannot enumerate working-tree files: git ls-files --others --exclude-standard -- src failed (fatal: not a git repository (or any of the parent directories): .git)`;
// spawn `Cannot enumerate working-tree files: git ls-files --others --exclude-standard -- src failed (spawnSync git ENOENT)`.

import { spawnSync } from "node:child_process";
import { readFileSync } from "node:fs";
import { posix, resolve } from "node:path";
import { traverse } from "@babel/core";
import { isEntrypoint } from "./entrypoint.mjs";
import { listWorkingTreeFiles } from "./working-tree-files.mjs";
import {
  PARAM_OF,
  VALUE_WRAPPERS,
  followsAlias,
  parseTsSource,
  resolveChain,
} from "./parse-ts-source.mjs";

const GENERATED_PATH = "src/bindings/generated.ts";
const ALLOWLIST_PATH = "ipc-command-consumer-allowlist.json";
const LEDGER_PATH = "tasks/findings.md";
const FACADE_PATH = "src/platform/tauri.ts";
const BINDINGS_PATH = GENERATED_PATH;
const TYPE_NODES = new Set([
  "TSTypeQuery",
  "TSQualifiedName",
  "TSTypeReference",
  "TSImportType",
  "TSTypeAnnotation",
  "TSExpressionWithTypeArguments",
]);
const MAX_LEDGER_BUFFER = 64 * 1024 * 1024;

function errorDetail(error) {
  return error instanceof Error ? error.message : String(error);
}

function nodeText(source, node) {
  if (node?.start !== undefined && node?.end !== undefined)
    return source.slice(node.start, node.end).replace(/\s+/gu, " ").trim();
  return node?.type ?? "<unknown>";
}

function nodeLine(node) {
  return node?.loc?.start?.line ?? "?";
}

function resolveSpecifier(specifier, importingPath) {
  if (typeof specifier !== "string") return null;
  if (specifier.startsWith("@/")) return `${posix.normalize(`src/${specifier.slice(2)}`)}.ts`;
  if (specifier.startsWith("."))
    return `${posix.normalize(posix.join(posix.dirname(importingPath), specifier))}.ts`;
  return null;
}

function acceptedModule(specifier, importingPath) {
  const resolved = resolveSpecifier(specifier, importingPath);
  if (resolved === FACADE_PATH) return "tauri";
  if (resolved === BINDINGS_PATH && importingPath.startsWith("src/platform/")) return "commands";
  return null;
}

function parseSource(source, workspaceRoot, listedPath) {
  try {
    return parseTsSource(source, resolve(workspaceRoot, listedPath));
  } catch (error) {
    const absolutePath = resolve(workspaceRoot, listedPath);
    const detail = errorDetail(error).replace(`${absolutePath}: `, "");
    throw new Error(`Cannot parse ${listedPath}: ${detail}`);
  }
}

export function enumerateCommands(ast, path = GENERATED_PATH) {
  let declarator;
  for (const statement of ast.program?.body ?? []) {
    if (statement.type !== "ExportNamedDeclaration") continue;
    const declaration = statement.declaration;
    if (declaration?.type !== "VariableDeclaration") continue;
    const candidate = declaration.declarations.find(
      (item) => item.id?.type === "Identifier" && item.id.name === "commands",
    );
    if (candidate) {
      declarator = candidate;
      break;
    }
  }
  if (!declarator) throw new Error(`${path}: exported commands declaration is missing`);
  if (declarator.init?.type !== "ObjectExpression")
    throw new Error(`${path}: exported commands initializer is not an ObjectExpression`);

  const commands = [];
  for (const [index, member] of declarator.init.properties.entries()) {
    if (member.type !== "ObjectMethod" || member.computed || member.key?.type !== "Identifier") {
      throw new Error(
        `${path}: commands object member ${index} is not an ObjectMethod with a plain Identifier key`,
      );
    }
    if (member.async) commands.push(member.key.name);
  }
  return commands;
}

function readRequired(readFile, workspaceRoot, path) {
  try {
    return readFile(resolve(workspaceRoot, path));
  } catch (error) {
    throw new Error(`Cannot read ${path}: ${errorDetail(error)}`);
  }
}

function parseAllowlist(source) {
  let value;
  try {
    value = JSON.parse(source);
  } catch (error) {
    throw new Error(`Cannot parse ${ALLOWLIST_PATH}: ${errorDetail(error)}`);
  }
  return validateAllowlist(value);
}

function validateAllowlist(allowlist) {
  if (!Array.isArray(allowlist)) throw new Error(`Invalid ${ALLOWLIST_PATH}: expected an array`);
  for (const [index, entry] of allowlist.entries()) {
    if (
      !entry ||
      typeof entry !== "object" ||
      typeof entry.command !== "string" ||
      typeof entry.finding !== "string"
    ) {
      throw new Error(
        `Invalid ${ALLOWLIST_PATH}: entry ${index} must contain string command and finding`,
      );
    }
  }
  return allowlist;
}

function readLedgerProjection(workspaceRoot) {
  const script = resolve(workspaceRoot, "scripts/findings.py");
  const command = `${script} list --json --body --strict`;
  const result = spawnSync(script, ["list", "--json", "--body", "--strict"], {
    cwd: workspaceRoot,
    encoding: "utf8",
    maxBuffer: MAX_LEDGER_BUFFER,
  });
  if (result.error)
    throw new Error(`Cannot read findings projection for ${command}: ${result.error.message}`);
  if (result.status !== 0) {
    const detail = String(result.stderr ?? "").trim() || `exit status ${result.status}`;
    throw new Error(`Cannot read findings projection for ${command}: ${detail}`);
  }
  let projection;
  try {
    projection = JSON.parse(result.stdout);
  } catch (error) {
    throw new Error(`Cannot parse findings projection for ${command}: ${errorDetail(error)}`);
  }
  return projection;
}

function validateLedgerProjection(projection, command = "findings projection") {
  if (!Array.isArray(projection)) throw new Error(`Invalid ${command}: expected an array`);
  for (const [index, entry] of projection.entries()) {
    if (
      !entry ||
      typeof entry !== "object" ||
      typeof entry.id !== "string" ||
      typeof entry.status !== "string" ||
      typeof entry.body !== "string"
    ) {
      throw new Error(`Invalid ${command}: entry ${index} must contain string id, status and body`);
    }
  }
  return projection;
}

function effective(referencePath) {
  let path = referencePath;
  while (
    path.parentPath &&
    VALUE_WRAPPERS.has(path.parentPath.node.type) &&
    path.parentPath.node.expression === path.node
  ) {
    path = path.parentPath;
  }
  return path;
}

function isTypeOnlyReference(referencePath) {
  const path = effective(referencePath);
  const parent = path.parentPath;
  if (!parent) return false;
  const node = parent.node;
  if (TYPE_NODES.has(node.type)) return true;
  return (
    node.type === "ExportSpecifier" &&
    (node.exportKind === "type" || parent.parentPath?.node.exportKind === "type")
  );
}

function isGlobalProxy(parentPath) {
  const callee = parentPath.node.callee;
  return (
    callee?.type === "Identifier" &&
    callee.name === "Proxy" &&
    !parentPath.scope.getBinding("Proxy")
  );
}

function importedMember(specifier) {
  return specifier.imported?.type === "Identifier"
    ? specifier.imported.name
    : specifier.imported?.value;
}

function isFacadeTerminal(result, importingPath) {
  if (!result || result.cyclic || result.node?.type !== "ImportSpecifier" || !result.binding)
    return null;
  const specifier = result.node;
  const declaration = result.binding.path.parentPath?.node;
  if (
    specifier.importKind === "type" ||
    declaration?.type !== "ImportDeclaration" ||
    declaration.importKind === "type"
  )
    return null;
  const imported = importedMember(specifier);
  const module = acceptedModule(declaration.source?.value, importingPath);
  if (
    (imported === "tauri" && module === "tauri") ||
    (imported === "commands" && module === "commands")
  )
    return imported;
  return null;
}

function sourceForProperty(property) {
  if (property.type !== "ObjectProperty" || property.computed) return null;
  if (property.key.type === "Identifier") return property.key.name;
  if (property.key.type === "StringLiteral") return property.key.value;
  return null;
}

function classifySource(path) {
  const node = path.parentPath?.node;
  const target =
    node?.type === "VariableDeclarator"
      ? node.id
      : node?.type === "AssignmentExpression" || node?.type === "AssignmentPattern"
        ? node.left
        : null;
  const isSource =
    (node?.type === "VariableDeclarator" && node.init === path.node) ||
    ((node?.type === "AssignmentExpression" || node?.type === "AssignmentPattern") &&
      node.right === path.node);
  if (!isSource) return null;
  if (target?.type === "ObjectPattern") return { kind: "object-pattern", target };
  if (target?.type === "Identifier") return { kind: "alias", target };
  return null;
}

function dynamicImportIsDiscarded(callPath) {
  let parent = callPath.parentPath;
  // A TS value wrapper is transparent here exactly as it is to the resolver: measured,
  // `void (await import("@/platform/tauri") as any);` reported C5 while the same statement
  // without the `as any` reported nothing.
  while (
    parent &&
    (parent.node.type === "AwaitExpression" ||
      (parent.node.type === "UnaryExpression" && parent.node.operator === "void") ||
      VALUE_WRAPPERS.has(parent.node.type))
  ) {
    parent = parent.parentPath;
  }
  return parent?.node.type === "ExpressionStatement";
}

function dynamicSpecifier(result) {
  const node = result?.node;
  if (node?.type === "StringLiteral") return node.value;
  if (node?.type === "TemplateLiteral" && node.expressions.length === 0)
    return node.quasis[0]?.value.cooked ?? node.quasis[0]?.value.raw;
  return null;
}

function camelToSnake(command) {
  return command.replace(/[A-Z]/gu, (letter) => `_${letter.toLowerCase()}`);
}

function namesWholeToken(body, command) {
  const snake = camelToSnake(command);
  return [command, snake].some((name) => {
    const escaped = name.replace(/[.*+?^${}()|[\]\\]/gu, "\\$&");
    return new RegExp(`(?:^|[^A-Za-z0-9_])${escaped}(?:$|[^A-Za-z0-9_])`, "u").test(body);
  });
}

function validateAllowlistOwnership(allowlist, ledger) {
  const violations = [];
  for (const entry of allowlist) {
    if (!/^f-\d{8}-\d{2}$/u.test(entry.finding)) {
      violations.push(
        `C4.1: allowlist entry ${entry.command} has invalid finding id ${entry.finding}`,
      );
      continue;
    }
    const finding = ledger.find(({ id }) => id === entry.finding);
    if (!finding) {
      violations.push(
        `C4.2: finding ${entry.finding} for allowlisted command ${entry.command} does not exist as an unfenced ledger entry`,
      );
      continue;
    }
    if (finding.status !== "open") {
      violations.push(
        `C4.3: finding ${entry.finding} for allowlisted command ${entry.command} is not open (status: ${finding.status})`,
      );
    }
    if (!namesWholeToken(finding.body, entry.command)) {
      violations.push(
        `C4.4: finding ${entry.finding} for allowlisted command ${entry.command} does not name ${entry.command} or ${camelToSnake(entry.command)}`,
      );
    }
  }
  return violations;
}

export function runIpcCommandConsumerCheck({
  workspaceRoot = process.cwd(),
  listFiles = (root) => listWorkingTreeFiles({ workspaceRoot: root, pathspec: "src" }),
  readFile = (path) => readFileSync(path, "utf8"),
  allowlist: suppliedAllowlist,
  readLedger,
} = {}) {
  const generatedSource = readRequired(readFile, workspaceRoot, GENERATED_PATH);
  const generatedAst = parseSource(generatedSource, workspaceRoot, GENERATED_PATH);
  const commandNames = enumerateCommands(generatedAst, GENERATED_PATH);
  const commandSet = new Set(commandNames);
  const allowlist =
    suppliedAllowlist === undefined
      ? parseAllowlist(readRequired(readFile, workspaceRoot, ALLOWLIST_PATH))
      : validateAllowlist(suppliedAllowlist);

  // The ledger is an authoritative input and fails closed whatever the allowlist holds:
  // once f-20260906-11 empties the allowlist, a conditional read would stop checking it.
  readRequired(readFile, workspaceRoot, LEDGER_PATH);
  const ledgerProjection = readLedger
    ? readLedger(workspaceRoot)
    : readLedgerProjection(workspaceRoot);
  const ledger = validateLedgerProjection(
    ledgerProjection,
    readLedger
      ? "findings projection"
      : `${resolve(workspaceRoot, "scripts/findings.py")} list --json --body --strict`,
  );

  const listed = listFiles(workspaceRoot);
  const productionFiles = [...new Set(listed)]
    .filter(
      (path) =>
        /^src\/.*\.tsx?$/u.test(path) &&
        !/\.(?:test|spec)\.tsx?$/u.test(path) &&
        !/\/tests\//u.test(path) &&
        path !== GENERATED_PATH,
    )
    .sort();
  const consumers = new Map(commandNames.map((name) => [name, 0]));
  const violations = [];
  const seenC5 = new Set();

  const addC5 = (listedPath, source, node) => {
    const key = `${listedPath}:${node?.start ?? "?"}`;
    if (seenC5.has(key)) return;
    seenC5.add(key);
    violations.push(
      `C5: ${listedPath}:${nodeLine(node)}: facade reach is not statically resolvable: ${nodeText(source, node)}`,
    );
  };
  const consume = (name) => {
    if (commandSet.has(name)) consumers.set(name, consumers.get(name) + 1);
  };

  for (const listedPath of productionFiles) {
    let source;
    try {
      source = readFile(resolve(workspaceRoot, listedPath));
    } catch (error) {
      if (error?.code === "ENOENT") continue;
      throw new Error(`Cannot read ${listedPath}: ${errorDetail(error)}`);
    }
    const ast = parseSource(source, workspaceRoot, listedPath);
    const seenBindings = new Set();

    const classifyMember = (memberPath) => {
      const member = memberPath.node;
      const objectPath = memberPath.get("object");
      const result = resolveChain(objectPath.node, objectPath.scope);
      const module = isFacadeTerminal(result, listedPath);
      const property =
        !member.computed && member.property?.type === "Identifier" ? member.property.name : null;
      if (module && property && commandSet.has(property)) consume(property);
      else if (module && (!property || member.computed)) addC5(listedPath, source, member);
    };

    const visitBinding = (binding) => {
      if (!binding || seenBindings.has(binding)) return;
      seenBindings.add(binding);
      for (const reference of binding.referencePaths) visitReference(reference);
    };

    const visitReference = (referencePath) => {
      const path = effective(referencePath);
      const parentPath = path.parentPath;
      if (!parentPath || isTypeOnlyReference(path)) return;
      const parent = parentPath.node;

      if (
        parent.type === "NewExpression" &&
        parent.arguments[0] === path.node &&
        listedPath === "src/platform/tauri.ts" &&
        isGlobalProxy(parentPath)
      ) {
        return;
      }

      if (
        (parent.type === "MemberExpression" || parent.type === "OptionalMemberExpression") &&
        parent.object === path.node
      ) {
        return;
      }

      const classifiedSource = classifySource(path);
      if (classifiedSource?.kind === "object-pattern") {
        const pattern = classifiedSource.target;
        const module = isFacadeTerminal(resolveChain(path.node, path.scope), listedPath);
        if (!module) return;
        for (const property of pattern.properties) {
          if (property.type === "RestElement") {
            addC5(listedPath, source, property);
            continue;
          }
          const command = sourceForProperty(property);
          if (command && commandSet.has(command)) consume(command);
          else addC5(listedPath, source, property);
        }
        return;
      }

      if (classifiedSource?.kind === "alias") {
        const binding = path.scope.getBinding(classifiedSource.target.name);
        const isParameterDefault =
          path.parentPath.node.type === "AssignmentPattern" &&
          PARAM_OF.has(path.parentPath.parentPath?.node.type);
        if (
          followsAlias(binding) &&
          (path.parentPath.node.type !== "AssignmentPattern" || isParameterDefault)
        )
          visitBinding(binding);
        else addC5(listedPath, source, path.node);
        return;
      }

      addC5(listedPath, source, path.node);
    };

    traverse(ast, {
      // Member reaches are classified HERE and only here, by resolving the member object
      // through resolveChain. The reference walk below answers the other B1 classes and
      // deliberately does not re-resolve a member it would only resolve identically.
      MemberExpression(path) {
        classifyMember(path);
      },
      OptionalMemberExpression(path) {
        classifyMember(path);
      },
      ImportDeclaration(path) {
        const declaration = path.node;
        if (declaration.importKind === "type") return;
        const module = acceptedModule(declaration.source?.value, listedPath);
        if (!module) return;
        for (const specifier of declaration.specifiers) {
          const imported = importedMember(specifier);
          if (specifier.type === "ImportNamespaceSpecifier") {
            const binding = path.scope.getBinding(specifier.local.name);
            for (const reference of binding?.referencePaths ?? []) {
              if (!isTypeOnlyReference(reference)) addC5(listedPath, source, reference.node);
            }
            continue;
          }
          if (
            specifier.type !== "ImportSpecifier" ||
            specifier.importKind === "type" ||
            (module === "tauri" && imported !== "tauri") ||
            (module === "commands" && imported !== "commands")
          )
            continue;
          visitBinding(path.scope.getBinding(specifier.local.name));
        }
      },
      ExportNamedDeclaration(path) {
        const declaration = path.node;
        if (!declaration.source || declaration.exportKind === "type") return;
        const module = acceptedModule(declaration.source.value, listedPath);
        if (!module) return;
        for (const specifier of declaration.specifiers) {
          if (specifier.exportKind === "type") continue;
          if (specifier.type === "ExportNamespaceSpecifier") {
            addC5(listedPath, source, specifier);
            continue;
          }
          if (specifier.type !== "ExportSpecifier") continue;
          const local =
            specifier.local?.type === "Identifier" ? specifier.local.name : specifier.local?.value;
          if (
            (module === "tauri" && local === "tauri") ||
            (module === "commands" && local === "commands")
          )
            addC5(listedPath, source, specifier);
        }
      },
      ExportAllDeclaration(path) {
        if (path.node.exportKind === "type") return;
        if (acceptedModule(path.node.source?.value, listedPath))
          addC5(listedPath, source, path.node);
      },
      CallExpression(path) {
        if (path.node.callee?.type !== "Import" || dynamicImportIsDiscarded(path)) return;
        const terminal = resolveChain(path.node.arguments[0], path.scope);
        const specifier = dynamicSpecifier(terminal);
        if (specifier === null || !acceptedModule(specifier, listedPath)) return;
        addC5(listedPath, source, path.node);
      },
    });
  }

  const allowlisted = new Set(allowlist.map(({ command }) => command));
  for (const command of commandNames) {
    if (consumers.get(command) === 0 && !allowlisted.has(command))
      violations.push(`C1: command ${command} has no production consumer`);
  }
  for (const entry of allowlist) {
    if (!commandSet.has(entry.command)) {
      violations.push(`C3: allowlist entry ${entry.command} names a command that is not exported`);
    } else if (consumers.get(entry.command) > 0) {
      violations.push(
        `C2: allowlist entry ${entry.command} has a production consumer; remove the allowlist entry`,
      );
    }
  }
  violations.push(...validateAllowlistOwnership(allowlist, ledger));
  return violations.sort();
}

if (isEntrypoint(import.meta.url)) {
  try {
    const violations = runIpcCommandConsumerCheck();
    if (violations.length) {
      for (const violation of violations) console.error(violation);
      process.exitCode = 1;
    }
  } catch (error) {
    console.error(errorDetail(error));
    process.exitCode = 1;
  }
}
