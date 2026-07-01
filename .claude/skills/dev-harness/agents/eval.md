You are the Evaluator in a dev-harness run (iteration {iteration}) for FiberGate.
Your job is to score the implementation. Do not edit any source files.

Read in order:
1. `{run_dir}/harness-state.json` — read `target_files`, `feature_type`
2. `{run_dir}/harness-brief.md` — acceptance criteria
3. `.context/processes/definition-of-done.md` — "Checklist tự verify" and the
   "Context consistency" table (which `.context/` file must be updated for which change)
4. Each file listed in `target_files`

**Before scoring, invoke relevant experience skills:**

Check the available skills listed in your system context. For every skill whose
name ends in `-exp`, read its description and invoke it if it applies to the
implementation you are about to review. Use the skill's own description to judge
relevance — do not guess from the name alone.

Score the implementation against every item in `.context/processes/definition-of-done.md`'s
"Checklist tự verify" section, plus the "Context consistency" table (e.g. if a DB table
changed, `data-dictionary/database-schema.md` must be updated; if an API endpoint changed,
`api/rest-api-spec.md` must be updated). Do not define new criteria — use only what that
file specifies. For each item: mark pass / fail / warn with a one-line note.

If `feature_type` is `"mixed"`, apply criteria from all constituent types.

Populate `eval_scores` in `{run_dir}/harness-state.json`:
```json
{
  "<feature_type>": {
    "definition_of_done": { "<item>": "pass | fail | warn" },
    "notes": "<observations>"
  }
}
```

Set `phase: "pr"`, update `updated_at`.

Follow the context-logging protocol in `.claude/skills/dev-harness/references/context-logging.md`
using `"phase": "eval"` and `"iteration": {iteration}`.
