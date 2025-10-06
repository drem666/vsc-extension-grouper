# Extension Grouper for VSCode

A simple but powerful tool to **group, activate, deactivate, and back up your VSCode extensions**.

## Features
- Create named groups of extensions
- Assign extensions via click selection
- Activate/deactivate groups with one click
- Backup group configuration to JSON

## Usage
1. Open Command Palette → “Open Extension Grouper”
2. Use the GUI to manage groups
3. Hover icons to view details in the top panel
4. Backup creates `extensionGroups.json` for persistence

---

**Tech stack:** TypeScript, VSCode Webview Toolkit, HTML, CSS  
**Build:**  
```bash
npm install
npm run compile
vsce package
