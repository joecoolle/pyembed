# Python Snippet Widget

A lightweight, static, embeddable Python code runner styled after IDLE. Visitors can edit and run Python directly in the browser — no server required. Python executes via [Skulpt](https://skulpt.org) (Python compiled to JavaScript) and the editor is powered by [CodeMirror 6](https://codemirror.net).

---

## How embedding works

Embed a snippet on any page with a single `<iframe>`:

```html
<iframe
  src="https://USERNAME.github.io/REPO/viewer.html?src=basic-examples/hello.json"
  width="100%"
  height="540"
  style="border:none;border-radius:8px;"
  loading="lazy"
  allowfullscreen
></iframe>
```

- Replace `USERNAME` and `REPO` with your GitHub username and repository name
- The `src` parameter is relative to the `snippets/` folder
- Use the **🔗 Copy URL** button on any widget to copy its viewer URL to the clipboard

---

## Browsing snippets

Four pages are available for navigating snippets:

| URL | What it shows |
|-----|---------------|
| `gallery.html` | All courses and categories as clickable cards |
| `gallery.html?cat=basic-examples` | All snippets in a single category |
| `lecture.html?course=lectures&n=1` | All examples for a specific lesson inline |
| `viewer.html?src=basic-examples/hello.json` | A single snippet, full-page |

### Course URLs

| Course | URL |
|--------|-----|
| DD1310 Lecture Examples | `lecture.html?course=lectures&n=1` |
| Möbius DD100N | `lecture.html?course=mobius-dd100n&n=1` |
| Möbius DD1310 | `lecture.html?course=mobius-dd1310&n=1` |
| DD1310 Tutorials | `lecture.html?course=tutorials-dd1310&n=1` |

Change `n=1` to the lesson number you want.

---

## Snippet JSON format

Each snippet is a JSON file in the `snippets/` folder.

### Single file

```json
{
  "title": "Hello World",
  "description": "Optional subtitle shown below the title.",
  "files": [
    { "name": "main.py", "content": "print('Hello, world!')" }
  ]
}
```

### Multi-file project

```json
{
  "title": "My Project",
  "files": [
    { "name": "main.py",   "content": "from helper import greet\ngreet()" },
    { "name": "helper.py", "content": "def greet():\n    print('Hello!')" },
    { "name": "data.txt",  "content": "some data" }
  ]
}
```

| Field | Required | Description |
|-------|----------|-------------|
| `title` | No | Displayed as the widget heading |
| `description` | No | Displayed as a subtitle |
| `files` | Yes | Array of `{ name, content }` objects |

The first file named `main.py` is always the entry point executed when ▶ Run is clicked.

---

## Adding a new snippet

1. Create a JSON file in the appropriate subfolder under `snippets/`
2. Add an entry to `snippets/index.json` under the matching category
3. Run `sync_index.py` to pull titles from the JSON files into the index:

```bash
python3 sync_index.py
```

4. Commit and push:

```bash
git add snippets/
git commit -m "Add new snippet"
git push
```

---

## Utility scripts

### `sync_index.py`

Reads the `title` field from each snippet JSON file and updates the matching entry in `index.json`. Run this after editing snippet titles directly in their JSON files.

```bash
python3 sync_index.py
```

### `generate_lecture_snippets.py`

Converts source folders of `.py` files (and multi-file subfolders) into snippet JSON files and registers them in `index.json`. Used for bulk-importing lecture examples from Möbius/Trinket exports. Not committed to git — kept local only.

---

## File structure

```
/
├── index.html                  ← demo page (GitHub Pages homepage)
├── gallery.html                ← course/category browser
├── lecture.html                ← inline lesson viewer (all examples for one lesson)
├── viewer.html                 ← single-snippet full-page viewer
├── embed.js                    ← the widget script (self-contained)
├── sync_index.py               ← syncs titles from JSON files into index.json
├── snippets/
│   ├── index.json              ← master list of all categories and snippets
│   ├── basic-examples/
│   ├── lecture-examples/
│   │   ├── lecture01/
│   │   │   ├── 01.json … 04.json
│   │   └── lecture02/ … lecture15/
│   ├── mobius-DD100N/
│   │   ├── lesson01/ … lesson06/
│   ├── mobius-DD1310/
│   │   ├── lektion01/ … lektion12/
│   ├── tutorials-DD1310/
│   │   ├── tutorial01/ … tutorial04/
│   └── dd1320/
│       └── 1/
├── .nojekyll                   ← disables Jekyll on GitHub Pages
└── README.md
```

---

## Widget features

| Feature | Details |
|---------|---------|
| **Editor** | CodeMirror 6 with IDLE-style syntax highlighting and Menlo font |
| **Syntax colours** | Keywords orange, strings green, comments red, built-ins purple, def/class names blue |
| **▶ Run** | Executes `main.py` via Skulpt; also triggered by **Ctrl+Enter** / **Cmd+Enter** |
| **⏹ Stop** | Interrupts a running program |
| **↺ Reset** | Restores all files to their original state and clears output |
| **↓ Download** | Saves the currently active file |
| **Fullscreen** | Browser fullscreen via the ⛶ button |
| **Output resize** | Drag the bar between editor and output to resize the output panel |
| **`input()`** | Rendered inline in the output panel — type and press Enter |
| **File I/O** | Virtual filesystem: `open()`, `read()`, `write()`, `readline()`, `for line in file` all work; written files update in the editor |
| **Multi-file** | Import across files; file panel on the left switches between them |
| **Turtle graphics** | `import turtle` opens a canvas overlay automatically |
| **🔗 Copy URL** | Copies the viewer URL for the current snippet to the clipboard |

---

## Deploying to GitHub Pages

### First-time setup

1. Create a new public repository on GitHub

2. Push this project to it:

```bash
cd py-snippet-widget
git init
git add .
git commit -m "Initial commit"
git remote add origin https://github.com/USERNAME/REPO.git
git branch -M main
git push -u origin main
```

3. Enable GitHub Pages:
   - Go to your repo → **Settings** → **Pages**
   - Under **Source**, select **Deploy from a branch**
   - Set branch to `main`, folder to `/ (root)`
   - Click **Save**

4. Visit `https://USERNAME.github.io/REPO/` after ~60 seconds

### Updating

Any `git push` to `main` automatically redeploys within 30–60 seconds.

---

## Browser support

Works in all modern browsers: Chrome, Firefox, Safari, Edge.
Requires ES modules support (universally available since 2019).

---

## Limitations

- Only standard Python built-ins and a subset of the standard library are available (no `numpy`, `pandas`, etc.) — see [Skulpt's supported modules](https://skulpt.org/docs/index.html)
- Non-ASCII variable names (e.g. Swedish `å`, `ä`, `ö`) are supported via the skulpt.org build
- `input()` pauses execution and waits for the user to type
- Only one snippet can run at a time per page
- Network access from Python code is not available
- `turtle` fill with `begin_fill()`/`end_fill()` only works reliably for one shape per run

---

## Open-source dependencies

### Skulpt
- **What it is**: Python 3 interpreter compiled to JavaScript
- **CDN**: `https://skulpt.org/js/skulpt.min.js`
- **Licence**: MIT / Python Software Foundation License v2
- **Source**: https://github.com/skulpt/skulpt

### CodeMirror 6
- **What it is**: Code editor with syntax highlighting, line numbers, bracket matching
- **Version**: 6.0.1
- **CDN**: `https://esm.sh/codemirror@6.0.1`
- **Licence**: MIT
- **Source**: https://github.com/codemirror/codemirror.next

### esm.sh
- A CDN that serves npm packages as ES modules — used to load CodeMirror 6
- **Source**: https://github.com/esm-dev/esm.sh

---

## Licence

Released under the [MIT License](https://opensource.org/licenses/MIT).
