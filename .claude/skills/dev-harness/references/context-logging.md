# Context Logging Protocol

Before finishing your work, append one entry to `context_log` in the `harness-state.json` at the run directory provided in your instructions:

```json
{
  "phase": "<your phase name: planner | implementer | checker | eval | pr>",
  "iteration": <N>,
  "files_read": ["<every file path you opened with the Read tool>"],
  "skills_used": [{ "name": "<skill-name>", "source": "project | marketplace | system" }],
  "mcp_used": [{ "tool": "<tool-name>", "server": "<server-name>" }]
}
```

**`source` values:**
- `"project"` — skills in `.agents/skills/` or `.claude/skills/`
- `"marketplace"` — FleetView skills (run, verify, code-review, simplify, etc.)
- `"system"` — built-in Claude Code capabilities

Use empty arrays for `skills_used` and `mcp_used` if nothing was used in that category.
