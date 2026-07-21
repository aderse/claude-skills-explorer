# Claude Skills

A VS Code sidebar that lists your Claude Code skills with a search box.

Adds a star icon to the activity bar. Click it to see every skill from:

- **Global** — `~/.claude/skills/*/SKILL.md`
- **Project** — `<workspace>/.claude/skills/*/SKILL.md`

Type in the search box to filter by name or description. Click a skill row to
expand its full description inline. The refresh button (title bar) re-scans.

Plugin skills (superpowers, caveman, etc.) are intentionally excluded — this
shows the skills you created or added.

## Install

```
code --install-extension claude-skills-explorer-0.1.0.vsix
```

Or in VS Code: **Extensions** panel → **⋯** → **Install from VSIX…**

## Develop

Open this folder in VS Code and press **F5** to launch an Extension Development
Host with the extension loaded.

## Rebuild the VSIX

```
npx @vscode/vsce package
```
