# Claude Skills — VS Code sidebar extension (spec)

Date: 2026-07-21

## Goal
Activity-bar sidebar (like Explorer/Search/Git) listing the user's Claude Code
skills with a search box and inline-expanding descriptions.

## Scope
- Global: `~/.claude/skills/*/SKILL.md` (follows symlinks)
- Project: each workspace folder's `.claude/skills/*/SKILL.md`
- Plugin skills excluded (third-party, not user-created)

## Behavior
- Search box filters by name + description as you type.
- Click a row → expand full description inline (no editor tab).
- Refresh button re-scans; also auto-rescans when the view becomes visible.
- Source tag (Global / Project) on each row.

## Architecture
- Plain JS, no build step. Single `extension.js`.
- `package.json` contributes an activitybar `viewsContainer` + one webview `view`.
- Webview HTML/CSS/JS inlined with a nonce'd CSP, themed via VS Code CSS vars.
- Frontmatter parsed by regex (single-line name:/description:).

## Ceilings / deferred
- Regex frontmatter parser truncates folded/multi-line YAML values to first
  line. Swap in a yaml lib only if that appears. (marked `ponytail:` in code)
- No dedup if the same skill name exists in both Global and Project (unlikely).

## Packaging
`@vscode/vsce package` → `.vsix`, installed via "Install from VSIX".
