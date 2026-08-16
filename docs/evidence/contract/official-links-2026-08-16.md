# Official-source link validation — 2026-08-16

- Result: pass
- Command: `npm run check:links -- --external`
- Execution boundary: repository working tree on `agent/goal-1-contract`, based on approval
  checkpoint `116d83f`
- Local link result: 0 issues
- Official-source result: 27 unique URLs checked, 0 failures
- Timeout per request: 10 seconds
- Redirect policy: followed and reported

## Results

| Source URL | Result | Final URL when redirected |
|---|---|---|
| `https://cdn.openai.com/business-guides-and-resources/a-practical-guide-to-building-agents.pdf` | pass | unchanged |
| `https://claude.com/blog/artifacts-in-claude-code` | pass | unchanged |
| `https://code.claude.com/docs/en/artifacts` | pass | unchanged |
| `https://code.claude.com/docs/en/changelog` | pass | unchanged |
| `https://code.claude.com/docs/en/env-vars` | pass | unchanged |
| `https://code.claude.com/docs/en/feature-availability` | pass | unchanged |
| `https://code.claude.com/docs/en/interactive-mode` | pass | unchanged |
| `https://code.claude.com/docs/en/permissions` | pass | unchanged |
| `https://code.claude.com/docs/en/settings` | pass | unchanged |
| `https://code.claude.com/docs/en/setup` | pass | unchanged |
| `https://code.claude.com/docs/en/tools-reference` | pass | unchanged |
| `https://code.claude.com/docs/en/whats-new/2026-w25` | pass | unchanged |
| `https://code.claude.com/docs/en/whats-new/2026-w29` | pass | unchanged |
| `https://code.claude.com/docs/llms.txt` | pass | unchanged |
| `https://developers.openai.com/codex/guides/agents-md` | pass | `https://learn.chatgpt.com/docs/agent-configuration/agents-md` |
| `https://learn.chatgpt.com/use-cases/follow-goals` | pass | unchanged |
| `https://opencode.ai` | pass | `https://opencode.ai/` |
| `https://opencode.ai/docs` | pass | unchanged |
| `https://opencode.ai/docs/cli/` | pass | unchanged |
| `https://opencode.ai/docs/custom-tools/` | pass | unchanged |
| `https://opencode.ai/docs/permissions/` | pass | unchanged |
| `https://opencode.ai/docs/plugins/` | pass | unchanged |
| `https://opencode.ai/docs/server/` | pass | unchanged |
| `https://opencode.ai/docs/skills` | pass | unchanged |
| `https://platform.claude.com/docs/en/api/compliance/code/artifacts` | pass | unchanged |
| `https://www.anthropic.com/engineering/effective-context-engineering-for-ai-agents` | pass | unchanged |
| `https://www.anthropic.com/engineering/equipping-agents-for-the-real-world-with-agent-skills` | pass | unchanged |

The retained table records reachability only. It does not claim that linked prose is correct,
that redirects will remain stable, or that a successful request establishes product parity.
