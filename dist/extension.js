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
const fs = __importStar(require("fs"));
const path = __importStar(require("path"));
function activate(context) {
    console.log('Extension Grouper activated.');
    const groupsFile = path.join(context.globalStorageUri.fsPath, 'extensionGroups.json');
    // Ensure storage dir
    fs.mkdirSync(context.globalStorageUri.fsPath, { recursive: true });
    if (!fs.existsSync(groupsFile)) {
        fs.writeFileSync(groupsFile, JSON.stringify({ groups: [] }, null, 2));
    }
    const loadGroups = () => {
        try {
            return JSON.parse(fs.readFileSync(groupsFile, 'utf8')).groups || [];
        }
        catch {
            return [];
        }
    };
    const saveGroups = (groups) => {
        fs.writeFileSync(groupsFile, JSON.stringify({ groups }, null, 2));
    };
    context.subscriptions.push(vscode.commands.registerCommand('extensionGrouper.openPanel', async () => {
        const panel = vscode.window.createWebviewPanel('extensionGrouper', 'Extension Grouper', vscode.ViewColumn.One, { enableScripts: true });
        const extPath = vscode.Uri.joinPath(context.extensionUri, 'media');
        const cssUri = panel.webview.asWebviewUri(vscode.Uri.joinPath(extPath, 'style.css'));
        const jsUri = panel.webview.asWebviewUri(vscode.Uri.joinPath(extPath, 'main.js'));
        panel.webview.html = getHtml(cssUri, jsUri);
        const extensions = vscode.extensions.all.map(e => ({
            id: e.id,
            displayName: e.packageJSON.displayName || e.id,
            description: e.packageJSON.description || '',
            icon: e.packageJSON.icon
                ? panel.webview.asWebviewUri(vscode.Uri.joinPath(e.extensionUri, e.packageJSON.icon)).toString()
                : ''
        }));
        panel.webview.postMessage({ command: 'loadExtensions', data: extensions, groups: loadGroups() });
        panel.webview.onDidReceiveMessage(async (msg) => {
            let groups = loadGroups();
            switch (msg.command) {
                case 'createGroup':
                    if (!groups.find(g => g.name === msg.name)) {
                        groups.push({ name: msg.name, extensions: [] });
                        saveGroups(groups);
                    }
                    break;
                case 'deleteGroup':
                    groups = groups.filter(g => g.name !== msg.name);
                    saveGroups(groups);
                    break;
                case 'assignGroup':
                    const grp = groups.find(g => g.name === msg.name);
                    if (grp) {
                        grp.extensions = Array.from(new Set([...grp.extensions, ...msg.selected]));
                        saveGroups(groups);
                    }
                    break;
                case 'activateGroup':
                    await activateDeactivate(msg.name, true, groups);
                    break;
                case 'deactivateGroup':
                    await activateDeactivate(msg.name, false, groups);
                    break;
                case 'backupGroup':
                    const dest = await vscode.window.showSaveDialog({
                        filters: { JSON: ['json'] },
                        defaultUri: vscode.Uri.file(path.join(context.globalStorageUri.fsPath, 'extensionGroups.json'))
                    });
                    if (dest)
                        fs.copyFileSync(groupsFile, dest.fsPath);
                    break;
            }
            panel.webview.postMessage({ command: 'updateGroups', groups: loadGroups() });
        });
    }));
}
function deactivate() { }
async function activateDeactivate(name, enable, groups) {
    const group = groups.find(g => g.name === name);
    if (!group)
        return;
    for (const id of group.extensions) {
        try {
            await vscode.commands.executeCommand(enable ? 'workbench.extensions.enableExtension' : 'workbench.extensions.disableExtension', id);
        }
        catch (err) {
            console.error(`Failed to ${enable ? 'enable' : 'disable'} ${id}`, err);
        }
    }
}
function getHtml(cssUri, jsUri) {
    return `<!DOCTYPE html>
<html lang="en">
<head>
<meta charset="UTF-8">
<meta name="viewport" content="width=device-width, initial-scale=1.0">
<link rel="stylesheet" href="${cssUri}">
<title>Extension Grouper</title>
</head>
<body>
<div id="top-panel">Hover over an extension icon to view details.</div>
<div id="middle-panel">
	<button id="createGroup">Create Group</button>
	<button id="deleteGroup">Delete Group</button>
	<select id="groupList"></select>
	<button id="assignGroup">Assign to Group</button>
	<button id="activateGroup">Activate Group</button>
	<button id="deactivateGroup">Deactivate Group</button>
	<button id="backupGroup">Backup Group</button>
</div>
<div id="bottom-panel"></div>
<script src="${jsUri}"></script>
</body>
</html>`;
}
//# sourceMappingURL=extension.js.map