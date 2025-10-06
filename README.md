# VSCode Extension Grouper

Visual tool to create, activate, deactivate, and manage groups of VSCode extensions.

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