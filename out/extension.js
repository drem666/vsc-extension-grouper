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
let groups = [];
let groupFilePath;
let currentPanel;
function activate(context) {
    console.log("Extension Grouper activated.");
    groupFilePath = path.join(context.globalStorageUri.fsPath, "groups.json");
    ensureStorageDir(context.globalStorageUri.fsPath);
    loadGroups();
    // Status-bar button
    const button = vscode.window.createStatusBarItem(vscode.StatusBarAlignment.Left, 100);
    button.text = "$(extensions) Grouper";
    button.tooltip = "Open Extension Grouper";
    button.command = "extension-grouper.open";
    button.show();
    context.subscriptions.push(button);
    const disposable = vscode.commands.registerCommand("extension-grouper.open", async () => {
        console.log("Opening Extension Grouper panel");
        if (currentPanel) {
            currentPanel.reveal(vscode.ViewColumn.One);
            return;
        }
        currentPanel = vscode.window.createWebviewPanel("extensionGrouper", "Extension Grouper", vscode.ViewColumn.One, {
            enableScripts: true,
            retainContextWhenHidden: true,
            localResourceRoots: [
                vscode.Uri.joinPath(context.extensionUri, "media")
            ]
        });
        const jsUri = currentPanel.webview.asWebviewUri(vscode.Uri.joinPath(context.extensionUri, "media", "main.js"));
        const cssUri = currentPanel.webview.asWebviewUri(vscode.Uri.joinPath(context.extensionUri, "media", "style.css"));
        const htmlPath = vscode.Uri.joinPath(context.extensionUri, "media", "main.html");
        let html = fs.readFileSync(htmlPath.fsPath, "utf8");
        html = html.replace(/src="main.js"/g, `src="${jsUri}"`)
            .replace(/href="style.css"/g, `href="${cssUri}"`);
        currentPanel.webview.html = html;
        const extensions = collectExtensions(currentPanel, context);
        currentPanel.webview.postMessage({
            command: "loadExtensions",
            data: extensions,
            groups: groups
        });
        currentPanel.webview.onDidReceiveMessage(async (message) => {
            console.log("Extension received message:", message.command, message);
            try {
                switch (message.command) {
                    case "getExtensions":
                        const updatedExtensions = collectExtensions(currentPanel, context);
                        currentPanel.webview.postMessage({
                            command: "loadExtensions",
                            data: updatedExtensions,
                            groups: groups
                        });
                        break;
                    case "createGroup":
                        const groupName = await vscode.window.showInputBox({
                            prompt: "Enter a name for the new group",
                            placeHolder: "Group name"
                        });
                        if (groupName && groupName.trim()) {
                            const trimmedName = groupName.trim();
                            if (!groups.find(g => g.name === trimmedName)) {
                                groups.push({ name: trimmedName, extensions: [] });
                                saveGroups();
                                vscode.window.showInformationMessage(`Created group: ${trimmedName}`);
                                currentPanel.webview.postMessage({ command: "updateGroups", groups: groups });
                            }
                            else {
                                vscode.window.showWarningMessage(`Group "${trimmedName}" already exists`);
                            }
                        }
                        break;
                    case "deleteGroup":
                        if (message.name) {
                            const initialLength = groups.length;
                            groups = groups.filter(g => g.name !== message.name);
                            if (groups.length < initialLength) {
                                saveGroups();
                                vscode.window.showInformationMessage(`Deleted group: ${message.name}`);
                                currentPanel.webview.postMessage({ command: "updateGroups", groups: groups });
                            }
                        }
                        break;
                    case "assignGroup":
                        if (message.name && Array.isArray(message.selected)) {
                            const group = groups.find(g => g.name === message.name);
                            if (group) {
                                let addedCount = 0;
                                message.selected.forEach((id) => {
                                    if (!group.extensions.includes(id)) {
                                        group.extensions.push(id);
                                        addedCount++;
                                    }
                                });
                                if (addedCount > 0) {
                                    saveGroups();
                                    vscode.window.showInformationMessage(`Assigned ${addedCount} extensions to ${message.name}`);
                                    currentPanel.webview.postMessage({ command: "updateGroups", groups: groups });
                                }
                            }
                        }
                        break;
                    case "deassignGroup":
                        if (message.name && Array.isArray(message.selected)) {
                            const group = groups.find(g => g.name === message.name);
                            if (group) {
                                const initialLength = group.extensions.length;
                                group.extensions = group.extensions.filter(id => !message.selected.includes(id));
                                const removedCount = initialLength - group.extensions.length;
                                if (removedCount > 0) {
                                    saveGroups();
                                    vscode.window.showInformationMessage(`Removed ${removedCount} extensions from ${message.name}`);
                                    currentPanel.webview.postMessage({ command: "updateGroups", groups: groups });
                                }
                            }
                        }
                        break;
                    case "activateGroup":
                        if (message.name) {
                            await activateGroup(message.name);
                        }
                        break;
                    case "deactivateGroup":
                        if (message.name) {
                            await deactivateGroup(message.name);
                        }
                        break;
                    case "toggleExtension":
                        if (message.id) {
                            await toggleExtension(message.id);
                        }
                        break;
                    case "backupGroup":
                        backupGroups();
                        break;
                }
            }
            catch (error) {
                console.error("Error handling message:", error);
                vscode.window.showErrorMessage(`Error: ${error}`);
            }
        }, undefined, context.subscriptions);
        currentPanel.onDidDispose(() => {
            currentPanel = undefined;
        }, null, context.subscriptions);
    });
    context.subscriptions.push(disposable);
}
// Helper functions
function ensureStorageDir(dir) {
    if (!fs.existsSync(dir)) {
        fs.mkdirSync(dir, { recursive: true });
    }
}
function loadGroups() {
    try {
        if (fs.existsSync(groupFilePath)) {
            const data = fs.readFileSync(groupFilePath, "utf8");
            const parsed = JSON.parse(data);
            groups = parsed.groups || [];
            console.log(`Loaded ${groups.length} groups from storage`);
        }
        else {
            groups = [];
            console.log("No existing groups found, starting fresh");
        }
    }
    catch (error) {
        console.error("Error loading groups:", error);
        groups = [];
    }
}
function saveGroups() {
    try {
        fs.writeFileSync(groupFilePath, JSON.stringify({ groups }, null, 2));
        console.log(`Saved ${groups.length} groups to storage`);
    }
    catch (error) {
        console.error("Error saving groups:", error);
        vscode.window.showErrorMessage("Failed to save groups");
    }
}
function backupGroups() {
    try {
        const backupPath = path.join(process.env.USERPROFILE || process.env.HOME || "", `extension_groups_backup_${Date.now()}.json`);
        fs.writeFileSync(backupPath, JSON.stringify({ groups }, null, 2));
        vscode.window.showInformationMessage(`Groups backed up to: ${backupPath}`);
    }
    catch (error) {
        vscode.window.showErrorMessage(`Backup failed: ${error}`);
    }
}
function collectExtensions(panel, context) {
    const defaultIcon = panel.webview.asWebviewUri(vscode.Uri.joinPath(context.extensionUri, "media", "default-icon.png")).toString();
    const disabledIds = getDisabledExtensions();
    return vscode.extensions.all.map(ext => {
        let iconUri = defaultIcon;
        if (ext.packageJSON.icon) {
            try {
                const iconPath = path.join(ext.extensionPath, ext.packageJSON.icon);
                if (fs.existsSync(iconPath)) {
                    iconUri = panel.webview.asWebviewUri(vscode.Uri.file(iconPath)).toString();
                }
            }
            catch (error) {
                console.log(`Could not load icon for ${ext.id}:`, error);
            }
        }
        const extensionGroups = groups
            .filter(group => group.extensions.includes(ext.id))
            .map(group => group.name);
        return {
            id: ext.id,
            displayName: ext.packageJSON.displayName || ext.id,
            description: ext.packageJSON.description || "No description available",
            icon: iconUri,
            active: !disabledIds.includes(ext.id),
            groups: extensionGroups
        };
    });
}
function getDisabledExtensions() {
    try {
        const config = vscode.workspace.getConfiguration('extensions');
        return config.get('disabled') || [];
    }
    catch (error) {
        console.error("Error getting disabled extensions:", error);
        return [];
    }
}
// FIXED: Use correct command names
async function activateGroup(groupName) {
    const group = groups.find(g => g.name === groupName);
    if (!group) {
        vscode.window.showErrorMessage(`Group "${groupName}" not found`);
        return;
    }
    try {
        for (const extensionId of group.extensions) {
            try {
                // CORRECT COMMAND: workbench.extensions.enableExtension
                await vscode.commands.executeCommand('workbench.extensions.enableExtension', extensionId);
                console.log(`Enabled extension: ${extensionId}`);
            }
            catch (error) {
                console.error(`Failed to enable extension ${extensionId}:`, error);
            }
        }
        vscode.window.showInformationMessage(`Activated group "${groupName}"`, "Reload Window").then(selection => {
            if (selection === "Reload Window") {
                vscode.commands.executeCommand("workbench.action.reloadWindow");
            }
        });
    }
    catch (error) {
        console.error("Error in activateGroup:", error);
        vscode.window.showErrorMessage(`Failed to activate group: ${error}`);
    }
}
// FIXED: Use correct command names
async function deactivateGroup(groupName) {
    const group = groups.find(g => g.name === groupName);
    if (!group) {
        vscode.window.showErrorMessage(`Group "${groupName}" not found`);
        return;
    }
    try {
        for (const extensionId of group.extensions) {
            try {
                // CORRECT COMMAND: workbench.extensions.disableExtension
                await vscode.commands.executeCommand('workbench.extensions.disableExtension', extensionId);
                console.log(`Disabled extension: ${extensionId}`);
            }
            catch (error) {
                console.error(`Failed to disable extension ${extensionId}:`, error);
            }
        }
        vscode.window.showInformationMessage(`Deactivated group "${groupName}"`, "Reload Window").then(selection => {
            if (selection === "Reload Window") {
                vscode.commands.executeCommand("workbench.action.reloadWindow");
            }
        });
    }
    catch (error) {
        console.error("Error in deactivateGroup:", error);
        vscode.window.showErrorMessage(`Failed to deactivate group: ${error}`);
    }
}
// FIXED: Use correct command names
async function toggleExtension(extensionId) {
    try {
        const disabledIds = getDisabledExtensions();
        const isDisabled = disabledIds.includes(extensionId);
        if (isDisabled) {
            // CORRECT COMMAND: workbench.extensions.enableExtension
            await vscode.commands.executeCommand('workbench.extensions.enableExtension', extensionId);
            vscode.window.showInformationMessage(`Enabled extension`);
        }
        else {
            // CORRECT COMMAND: workbench.extensions.disableExtension
            await vscode.commands.executeCommand('workbench.extensions.disableExtension', extensionId);
            vscode.window.showInformationMessage(`Disabled extension`);
        }
    }
    catch (error) {
        console.error(`Failed to toggle extension ${extensionId}:`, error);
        vscode.window.showErrorMessage(`Failed to toggle extension: ${error}`);
    }
}
function deactivate() { }
//# sourceMappingURL=extension.js.map