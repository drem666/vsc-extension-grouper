"use strict";
var __createBinding = (this && this.__createBinding) || (Object.create ? (function(o, m, k, k2) {
    if (k2 === undefined) k2 = k;
    var desc = Object.getOwnPropertyDescriptor(m, k);
    if (!desc || ("get" in desc ? !m.__esModule : desc.writable || desc.configurable)) {
      desc = { enumerable: true, get: function() { return m[k]; } };
    }
    Object.defineProperty(o, k2, desc);
}) : (function(o, m, k, k2) {
    if (k2 === undefined) k2 = k;
    o[k2] = m[k];
}));
var __setModuleDefault = (this && this.__setModuleDefault) || (Object.create ? (function(o, v) {
    Object.defineProperty(o, "default", { enumerable: true, value: v });
}) : function(o, v) {
    o["default"] = v;
});
var __importStar = (this && this.__importStar) || (function () {
    var ownKeys = function(o) {
        ownKeys = Object.getOwnPropertyNames || function (o) {
            var ar = [];
            for (var k in o) if (Object.prototype.hasOwnProperty.call(o, k)) ar[ar.length] = k;
            return ar;
        };
        return ownKeys(o);
    };
    return function (mod) {
        if (mod && mod.__esModule) return mod;
        var result = {};
        if (mod != null) for (var k = ownKeys(mod), i = 0; i < k.length; i++) if (k[i] !== "default") __createBinding(result, mod, k[i]);
        __setModuleDefault(result, mod);
        return result;
    };
})();
Object.defineProperty(exports, "__esModule", { value: true });
exports.activate = activate;
exports.deactivate = deactivate;
const vscode = __importStar(require("vscode"));
function activate(context) {
    console.log('Extension Grouper activated.');
    vscode.window.showInformationMessage('Extension Grouper loaded successfully.');
    // Status bar button
    const button = vscode.window.createStatusBarItem(vscode.StatusBarAlignment.Left, 100);
    button.text = '$(extensions) Grouper';
    button.tooltip = 'Open Extension Grouper';
    button.command = 'extension-grouper.open';
    button.show();
    context.subscriptions.push(button);
    // Register command
    const disposable = vscode.commands.registerCommand('extension-grouper.open', async () => {
        const panel = vscode.window.createWebviewPanel('extensionGrouper', 'Extension Grouper', vscode.ViewColumn.One, { enableScripts: true });
        // Get all installed extensions
        const allExtensions = vscode.extensions.all.map(ext => ({
            id: ext.id,
            displayName: ext.packageJSON.displayName || ext.id,
            description: ext.packageJSON.description || '',
            version: ext.packageJSON.version || '',
            active: ext.isActive
        }));
        // Get disabled extensions from user settings
        const disabledIds = vscode.workspace.getConfiguration('extensions').get('disabled') || [];
        // Separate enabled / disabled
        const enabled = allExtensions.filter(e => !disabledIds.includes(e.id));
        const disabled = allExtensions.filter(e => disabledIds.includes(e.id));
        panel.webview.html = getWebviewContent(enabled, disabled);
    });
    context.subscriptions.push(disposable);
}
function getWebviewContent(enabled, disabled) {
    const extToHtml = (list) => list.map(e => `
      <div class="ext">
        <div class="name">${e.displayName}</div>
        <div class="desc">${e.description}</div>
        <div class="ver">v${e.version}</div>
        <div class="state">${e.active ? '🟢 Enabled' : '🔴 Disabled'}</div>
      </div>
    `).join('') || '<i>None</i>';
    return `
  <!DOCTYPE html>
  <html lang="en">
  <head>
    <meta charset="UTF-8">
    <style>
      body { font-family: Segoe UI, sans-serif; background: #1e1e1e; color: #ddd; padding: 12px; }
      h2 { color: #61dafb; border-bottom: 1px solid #333; padding-bottom: 4px; margin-top: 20px; }
      .ext { border: 1px solid #333; border-radius: 6px; margin: 6px 0; padding: 6px 10px; }
      .name { font-weight: bold; color: #fff; }
      .desc { font-size: 0.9em; color: #aaa; }
      .ver, .state { font-size: 0.85em; color: #999; }
    </style>
  </head>
  <body>
    <h2>Enabled Extensions</h2>
    ${extToHtml(enabled)}
    <h2>Disabled Extensions</h2>
    ${extToHtml(disabled)}
  </body>
  </html>
  `;
}
function deactivate() { }
//# sourceMappingURL=extension.js.map