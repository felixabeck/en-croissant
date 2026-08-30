#!/bin/bash
# Block access to secrets files (.env, .mcp.json, *.secrets/*) across all tools.
# Only block actual file access patterns, not incidental mentions in text.

INPUT=$(cat)

# Parse all relevant fields at once to avoid multiple Python calls.
# Resolve a Python interpreter robustly so parser failure degrades to the raw scan below.
PYBIN="$(command -v python3 || command -v python)"
eval "$(echo "$INPUT" | "$PYBIN" -c "
import sys, json, shlex
data = json.load(sys.stdin)
tool = data.get('tool_name', '')
inp = data.get('tool_input', {})
print(f'TOOL_NAME={shlex.quote(tool)}')
print(f'FILE_PATH={shlex.quote(inp.get(\"file_path\", \"\"))}')
print(f'COMMAND={shlex.quote(inp.get(\"command\", \"\"))}')
print(f'GREP_PATH={shlex.quote(inp.get(\"path\", \"\"))}')
print(f'AGENT_PROMPT={shlex.quote(inp.get(\"prompt\", \"\"))}')
" 2>/dev/null)"

# Fail closed when a non-empty payload cannot be parsed. The coarse scan still blocks obvious
# secret access while allowing unrelated malformed payloads and readable example templates.
if [[ -n "$INPUT" && -z "$TOOL_NAME" ]]; then
  if { echo "$INPUT" | grep -qiE '"(file_path|path)"[[:space:]]*:[[:space:]]*"[^"]*(\.env|\.mcp\.json|\.secrets/)' \
       || echo "$INPUT" | grep -qiE '(cat|head|tail|less|more|type|source|grep|rg|sed|awk|open)[^"]*(\.env|\.mcp\.json|\.secrets/)'; } \
     && ! echo "$INPUT" | grep -qiE '\.env[^"]*\.example'; then
    echo "BLOCKED: secrets file access denied (fail-closed: input parser unavailable)" >&2
    exit 2
  fi
  exit 0
fi

is_secrets_file() {
  shopt -s extglob
  # Strip the entire template family first: .env.example, .env.production.example, and so on.
  # A string containing a template and a real secret still retains the real secret in the residue.
  local stripped="${1//.env*(.+([[:alnum:]_-])).example/}"
  # Environment-variable accessors are code, not file paths. Strip them before the file check,
  # while leaving any real secret path elsewhere in the same string intact.
  stripped="${stripped//process.env/}"
  stripped="${stripped//import.meta.env/}"
  stripped="${stripped//os.environ/}"
  stripped="${stripped//os.getenv/}"
  [[ "$stripped" == *".env"* ]] ||
  [[ "$stripped" == *".mcp.json"* ]] ||
  [[ "$stripped" == *".secrets/"* ]]
}

# Block UNC/WebDAV paths (\\server\share or //server/share). Such paths can become silent network
# requests outside the permission system; local paths and scheme:// URLs remain allowed.
is_unc_path() {
  # shellcheck disable=SC1003 # Exact UNC backslash literals are intentional here.
  [[ "${1:0:2}" == '\\' ]] || [[ "${1:0:2}" == '//' ]]
}

if is_unc_path "$FILE_PATH" || is_unc_path "$GREP_PATH"; then
  echo "BLOCKED: UNC/WebDAV path access denied" >&2
  exit 2
fi

if [[ -n "$COMMAND" ]] && echo "$COMMAND" | grep -qiE '(cat|head|tail|less|more|type|nano|vim|code|source|\bgrep\b|\brg\b|sed|awk)\b[^|;]*[^:[:alnum:]](\\\\|//)[A-Za-z0-9._-]+[/\\]'; then
  echo "BLOCKED: UNC/WebDAV path in command denied" >&2
  exit 2
fi

# Read/Edit/Write use file_path; Grep uses path.
if is_secrets_file "$FILE_PATH" || is_secrets_file "$GREP_PATH"; then
  echo "BLOCKED: secrets file access denied" >&2
  exit 2
fi

# Bash is blocked only when a command actually reads a secret path, not for every mention of one.
if [[ -n "$COMMAND" ]] && is_secrets_file "$COMMAND"; then
  if echo "$COMMAND" | grep -qiE '(\b(cat|head|tail|less|more|type|nano|vim|code|source|grep|rg|sed|awk)\b|python3?.*open).*(\.env|\.mcp\.json|\.secrets/)'; then
    echo "BLOCKED: secrets file access denied" >&2
    exit 2
  fi
fi

# Defense in depth for obvious remote secret reads and environment dumps over SSH.
if [[ -n "$COMMAND" ]] && echo "$COMMAND" | grep -qE '\bssh\b'; then
  if echo "$COMMAND" | grep -qiE '\b(cat|head|tail|less|more|grep|rg|awk|sed|source|printenv|export)\b[^|;]*(\.env|\.mcp\.json|\.secrets/)'; then
    echo "BLOCKED: SSH command would read remote secrets file" >&2
    exit 2
  fi
  if echo "$COMMAND" | grep -qiE 'docker (compose )?(exec|run)[^|;]*\b(env|printenv)\b'; then
    echo "BLOCKED: SSH command would dump container env vars" >&2
    exit 2
  fi
fi

# Agent/Task prompts are an early catch. Negated instructions remain allowed because the nested
# tool calls are independently checked by this hook.
if [[ -n "$AGENT_PROMPT" ]] && is_secrets_file "$AGENT_PROMPT"; then
  if echo "$AGENT_PROMPT" | grep -qiE '(read|open|cat|print|show|display|access|fetch|get).*(\.env|\.mcp\.json|\.secrets/)' \
     && ! echo "$AGENT_PROMPT" | grep -qiE "(do not|don'?t|never|must not|must never|cannot|without|avoid|no need to|should not|shouldn'?t|forbidden|not allowed)[^.]{0,25}(read|open|cat|grep|access|view|print|show|display|fetch|get|touch|reading|opening|accessing|viewing)"; then
    echo "BLOCKED: secrets file access denied" >&2
    exit 2
  fi
fi

exit 0
