const vscode = require('vscode');
const fs = require('fs');
const path = require('path');
const os = require('os');

// ponytail: single-line frontmatter parser (no yaml dep). SKILL.md frontmatter
// uses single-line name:/description:. If folded/multi-line values appear,
// this truncates to the first line — swap in a yaml lib then.
function parseFrontmatter(text) {
  const block = (text.match(/^---\s*\n([\s\S]*?)\n---/) || [])[1] || '';
  const name = (block.match(/^name:\s*(.+)$/m) || [])[1];
  const description = (block.match(/^description:\s*(.+)$/m) || [])[1];
  return {
    name: name ? name.trim() : '',
    description: description ? description.trim() : '',
  };
}

// readFileSync resolves symlinks, so this covers both real skill dirs and the
// symlinked ones in ~/.claude/skills without dirent type checks.
function scanDir(baseDir, source) {
  const out = [];
  let entries;
  try {
    entries = fs.readdirSync(baseDir);
  } catch {
    return out; // dir doesn't exist — fine
  }
  for (const entry of entries) {
    if (entry.startsWith('.')) continue;
    const skillFile = path.join(baseDir, entry, 'SKILL.md');
    let text;
    try {
      text = fs.readFileSync(skillFile, 'utf8');
    } catch {
      continue; // no SKILL.md here
    }
    const fm = parseFrontmatter(text);
    out.push({
      name: fm.name || entry,
      description: fm.description || '(no description)',
      source,
      file: skillFile,
    });
  }
  return out;
}

// Slash commands are flat `.claude/commands/*.md` files (name = filename),
// unlike skills which are `<dir>/SKILL.md`. User invokes both via /name, so
// we list them together — commands get a leading '/' to tell them apart.
function scanCommands(baseDir, source) {
  const out = [];
  let entries;
  try {
    entries = fs.readdirSync(baseDir);
  } catch {
    return out;
  }
  for (const entry of entries) {
    if (!entry.endsWith('.md') || entry.startsWith('.')) continue;
    let text;
    try {
      text = fs.readFileSync(path.join(baseDir, entry), 'utf8');
    } catch {
      continue;
    }
    const fm = parseFrontmatter(text);
    out.push({
      name: '/' + entry.replace(/\.md$/, ''),
      description: fm.description || '(no description)',
      source,
      file: path.join(baseDir, entry),
    });
  }
  return out;
}

function collectSkills() {
  const home = os.homedir();
  const items = [];
  items.push(...scanDir(path.join(home, '.claude', 'skills'), 'Global'));
  items.push(...scanCommands(path.join(home, '.claude', 'commands'), 'Global'));
  for (const folder of vscode.workspace.workspaceFolders || []) {
    const root = folder.uri.fsPath;
    items.push(...scanDir(path.join(root, '.claude', 'skills'), 'Project'));
    items.push(...scanCommands(path.join(root, '.claude', 'commands'), 'Project'));
  }
  items.sort((a, b) => a.name.localeCompare(b.name));
  return items;
}

function nonce() {
  let s = '';
  const chars = 'ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789';
  for (let i = 0; i < 24; i++) s += chars.charAt(Math.floor(Math.random() * chars.length));
  return s;
}

class SkillsViewProvider {
  constructor() {
    this.view = undefined;
  }

  resolveWebviewView(webviewView) {
    this.view = webviewView;
    webviewView.webview.options = { enableScripts: true };
    webviewView.webview.html = this.getHtml(webviewView.webview);

    webviewView.webview.onDidReceiveMessage((msg) => {
      if (msg && msg.type === 'ready') this.refresh();
    });

    webviewView.onDidChangeVisibility(() => {
      if (webviewView.visible) this.refresh();
    });
  }

  refresh() {
    if (this.view) {
      this.view.webview.postMessage({ type: 'skills', skills: collectSkills() });
    }
  }

  getHtml(webview) {
    const n = nonce();
    const csp = [
      `default-src 'none'`,
      `style-src 'nonce-${n}'`,
      `script-src 'nonce-${n}'`,
    ].join('; ');
    return `<!DOCTYPE html>
<html lang="en">
<head>
<meta charset="UTF-8" />
<meta http-equiv="Content-Security-Policy" content="${csp}" />
<meta name="viewport" content="width=device-width, initial-scale=1.0" />
<style nonce="${n}">
  body { padding: 0; margin: 0; color: var(--vscode-foreground); font-family: var(--vscode-font-family); }
  #search {
    box-sizing: border-box; width: 100%; padding: 6px 8px; margin: 8px 0;
    color: var(--vscode-input-foreground); background: var(--vscode-input-background);
    border: 1px solid var(--vscode-input-border, transparent); border-radius: 4px; outline: none;
  }
  #search:focus { border-color: var(--vscode-focusBorder); }
  #count { font-size: 11px; opacity: 0.6; padding: 0 2px 6px; }
  .row { border-radius: 4px; cursor: pointer; user-select: none; }
  .row:hover { background: var(--vscode-list-hoverBackground); }
  .head { display: flex; align-items: center; gap: 6px; padding: 6px 8px; }
  .name { font-weight: 600; overflow: hidden; text-overflow: ellipsis; white-space: nowrap; }
  .tag {
    margin-left: auto; flex: none; font-size: 10px; text-transform: uppercase; letter-spacing: 0.5px;
    padding: 1px 6px; border-radius: 8px;
    background: var(--vscode-badge-background); color: var(--vscode-badge-foreground);
  }
  .arrow { flex: none; opacity: 0.6; transition: transform 0.1s; }
  .row.open .arrow { transform: rotate(90deg); }
  .desc {
    display: none; padding: 0 8px 8px 20px; font-size: 12px; line-height: 1.45;
    opacity: 0.85; white-space: pre-wrap; word-break: break-word;
  }
  .row.open .desc { display: block; }
  #empty { padding: 12px 8px; opacity: 0.6; font-size: 12px; }
  .divider { border: none; border-top: 1px solid var(--vscode-panel-border, var(--vscode-editorWidget-border, rgba(128,128,128,0.35))); margin: 8px 4px; }
</style>
</head>
<body>
  <input id="search" type="text" placeholder="Search skills…" autocomplete="off" />
  <div id="count"></div>
  <div id="list"></div>
  <div id="empty" style="display:none">No skills or commands found in ~/.claude or the project's .claude folder.</div>
<script nonce="${n}">
  const vscodeApi = acquireVsCodeApi();
  let skills = [];
  const listEl = document.getElementById('list');
  const searchEl = document.getElementById('search');
  const countEl = document.getElementById('count');
  const emptyEl = document.getElementById('empty');

  function esc(s) {
    return String(s).replace(/[&<>"]/g, c => ({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;'}[c]));
  }

  function render() {
    const q = searchEl.value.trim().toLowerCase();
    const filtered = skills.filter(s =>
      !q || s.name.toLowerCase().includes(q) || s.description.toLowerCase().includes(q)
    );
    emptyEl.style.display = skills.length === 0 ? 'block' : 'none';
    countEl.textContent = filtered.length + (filtered.length === 1 ? ' item' : ' items')
      + (q && filtered.length !== skills.length ? ' (of ' + skills.length + ')' : '');
    const rank = { Project: 0, Global: 1 };
    filtered.sort((a, b) => (rank[a.source] - rank[b.source]) || a.name.localeCompare(b.name));
    let html = '';
    let prev = null;
    for (const s of filtered) {
      if (prev !== null && s.source !== prev) html += '<hr class="divider" />';
      html +=
        '<div class="row">' +
          '<div class="head">' +
            '<span class="arrow">›</span>' +
            '<span class="name">' + esc(s.name) + '</span>' +
            '<span class="tag">' + esc(s.source) + '</span>' +
          '</div>' +
          '<div class="desc">' + esc(s.description) + '</div>' +
        '</div>';
      prev = s.source;
    }
    listEl.innerHTML = html;
    for (const row of listEl.querySelectorAll('.row')) {
      row.addEventListener('click', () => row.classList.toggle('open'));
    }
  }

  searchEl.addEventListener('input', render);
  window.addEventListener('message', (e) => {
    if (e.data && e.data.type === 'skills') { skills = e.data.skills; render(); }
  });
  vscodeApi.postMessage({ type: 'ready' });
</script>
</body>
</html>`;
  }
}

function activate(context) {
  const provider = new SkillsViewProvider();
  context.subscriptions.push(
    vscode.window.registerWebviewViewProvider('claudeSkillsExplorer.skillsView', provider),
    vscode.commands.registerCommand('claudeSkillsExplorer.refresh', () => provider.refresh())
  );
}

function deactivate() {}

module.exports = { activate, deactivate };
