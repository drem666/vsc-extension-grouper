# VSCode Extension Grouper

Visual tool to create, activate, deactivate, and manage groups of VSCode extensions.

## Folder Structure
vsc-extension-grouper
├── LICENSE (0.0 B)
├── README.md (831.0 B)
├── extensionGroups.json (22.0 B)
├── package-lock.json (1.8 KB)
├── package.json (783.0 B)
├── tsconfig.json (380.0 B)
├── dist/
│   ├── extension.js (6.3 KB)
│   └── extension.js.map (4.4 KB)
├── media/
│   ├── default-icon.png (12.3 KB)
│   ├── main.html (781.0 B)
│   ├── main.js (2.6 KB)
│   └── style.css (1.2 KB)
├── out/
│   ├── extension.js (7.4 KB)
│   └── extension.js.map (5.8 KB)
└── src/
    └── extension.ts (5.8 KB)

## Running in Development

1. Open this folder in VSCode.
2. Run `npm install`.
3. Press **F5** → launches the Extension Development Host.
4. In the new window → `Ctrl+Shift+P` → “Open Extension Grouper”.

## Building for Release

npm run compile
vsce package


This generates a `.vsix` bundle for distribution.

## License

MIT — free and open-source.

🧩 .gitignore
node_modules/
out/
*.vsix

✅ Final Step — Test
cd Y:\coder_tools\vsc-extension-grouper
npm install
npm run compile


Then open in VSCode → F5 → Ctrl+Shift+P → Open Extension Grouper.

You’ll see your 3-panel UI working, icons populating, hover info shown, and full extension list loaded.