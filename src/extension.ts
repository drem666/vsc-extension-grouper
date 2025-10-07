import * as vscode from 'vscode';
import * as fs from 'fs';
import * as path from 'path';

interface ExtensionInfo {
    id: string;
    displayName: string;
    description: string;
    version: string;
    icon: string;
    enabled: boolean;
}

interface ExtensionGroup {
    name: string;
    extensions: string[]; // extension IDs
    enabled: boolean;
}

export function activate(context: vscode.ExtensionContext) {
    console.log('Extension Grouper activated.');

    // Status bar button
    const button = vscode.window.createStatusBarItem(vscode.StatusBarAlignment.Left, 100);
    button.text = '$(extensions) Grouper';
    button.tooltip = 'Open Extension Grouper';
    button.command = 'extension-grouper.open';
    button.show();
    context.subscriptions.push(button);

    // Register command
    const disposable = vscode.commands.registerCommand('extension-grouper.open', async () => {
        const panel = vscode.window.createWebviewPanel(
            'extensionGrouper',
            'Extension Grouper',
            vscode.ViewColumn.One,
            {
                enableScripts: true,
                retainContextWhenHidden: true
            }
        );

        // Load initial data
        const extensions = await getExtensions();
        const groups = loadGroups(context);

        panel.webview.html = getWebviewContent(extensions, groups);

        // Handle messages from webview
        panel.webview.onDidReceiveMessage(async (message) => {
            switch (message.command) {
                case 'toggleExtension':
                    await toggleExtension(message.extensionId);
                    // Refresh the view
                    const updatedExtensions = await getExtensions();
                    panel.webview.html = getWebviewContent(updatedExtensions, loadGroups(context));
                    break;

                case 'createGroup':
                    const groupName = await vscode.window.showInputBox({
                        prompt: 'Enter group name',
                        placeHolder: 'My Extension Group'
                    });
                    if (groupName) {
                        createGroup(context, groupName);
                        panel.webview.html = getWebviewContent(extensions, loadGroups(context));
                    }
                    break;

                case 'deleteGroup':
                    if (message.groupName) {
                        deleteGroup(context, message.groupName);
                        panel.webview.html = getWebviewContent(extensions, loadGroups(context));
                    }
                    break;

                case 'assignToGroup':
                    if (message.groupName && message.extensionIds) {
                        assignToGroup(context, message.groupName, message.extensionIds);
                        panel.webview.html = getWebviewContent(extensions, loadGroups(context));
                    }
                    break;

                case 'activateGroup':
                    if (message.groupName) {
                        await activateGroup(context, message.groupName);
                        const updatedExts = await getExtensions();
                        panel.webview.html = getWebviewContent(updatedExts, loadGroups(context));
                    }
                    break;

                case 'deactivateGroup':
                    if (message.groupName) {
                        await deactivateGroup(context, message.groupName);
                        const updatedExts = await getExtensions();
                        panel.webview.html = getWebviewContent(updatedExts, loadGroups(context));
                    }
                    break;
            }
        });
    });

    context.subscriptions.push(disposable);
}

async function getExtensions(): Promise<ExtensionInfo[]> {
    const allExtensions = vscode.extensions.all;
    const disabledExtensions = await getDisabledExtensions();
    
    return allExtensions.map(ext => ({
        id: ext.id,
        displayName: ext.packageJSON.displayName || ext.id,
        description: ext.packageJSON.description || '',
        version: ext.packageJSON.version || '',
        icon: ext.packageJSON.icon ? 
            `vscode-file://vscode-app/${ext.extensionPath.replace(/\\/g, '/')}/${ext.packageJSON.icon}` : 
            '',
        enabled: !disabledExtensions.includes(ext.id)
    }));
}

async function getDisabledExtensions(): Promise<string[]> {
    try {
        const config = vscode.workspace.getConfiguration('extensions');
        return config.get('disabled') || [];
    } catch (err) {
        console.error('Error getting disabled extensions:', err);
        return [];
    }
}

async function toggleExtension(extensionId: string): Promise<void> {
    try {
        const disabledExtensions = await getDisabledExtensions();
        const isCurrentlyDisabled = disabledExtensions.includes(extensionId);

        if (isCurrentlyDisabled) {
            // Enable extension
            const updatedDisabled = disabledExtensions.filter(id => id !== extensionId);
            await vscode.workspace.getConfiguration('extensions').update('disabled', updatedDisabled, true);
            vscode.window.showInformationMessage(`Enabled ${extensionId}`);
        } else {
            // Disable extension
            disabledExtensions.push(extensionId);
            await vscode.workspace.getConfiguration('extensions').update('disabled', disabledExtensions, true);
            vscode.window.showInformationMessage(`Disabled ${extensionId}`);
        }
    } catch (err) {
        vscode.window.showErrorMessage(`Failed to toggle extension: ${err}`);
    }
}

// Group management functions
function loadGroups(context: vscode.ExtensionContext): ExtensionGroup[] {
    return context.globalState.get('extensionGroups', []);
}

function saveGroups(context: vscode.ExtensionContext, groups: ExtensionGroup[]): void {
    context.globalState.update('extensionGroups', groups);
}

function createGroup(context: vscode.ExtensionContext, name: string): void {
    const groups = loadGroups(context);
    if (!groups.find(g => g.name === name)) {
        groups.push({ name, extensions: [], enabled: true });
        saveGroups(context, groups);
        vscode.window.showInformationMessage(`Created group: ${name}`);
    }
}

function deleteGroup(context: vscode.ExtensionContext, name: string): void {
    let groups = loadGroups(context);
    groups = groups.filter(g => g.name !== name);
    saveGroups(context, groups);
    vscode.window.showInformationMessage(`Deleted group: ${name}`);
}

function assignToGroup(context: vscode.ExtensionContext, groupName: string, extensionIds: string[]): void {
    const groups = loadGroups(context);
    const group = groups.find(g => g.name === groupName);
    if (group) {
        group.extensions = extensionIds;
        saveGroups(context, groups);
        vscode.window.showInformationMessage(`Assigned ${extensionIds.length} extensions to ${groupName}`);
    }
}

async function activateGroup(context: vscode.ExtensionContext, groupName: string): Promise<void> {
    const groups = loadGroups(context);
    const group = groups.find(g => g.name === groupName);
    if (group) {
        const disabledExtensions = await getDisabledExtensions();
        const updatedDisabled = disabledExtensions.filter(id => !group.extensions.includes(id));
        
        await vscode.workspace.getConfiguration('extensions').update('disabled', updatedDisabled, true);
        group.enabled = true;
        saveGroups(context, groups);
        vscode.window.showInformationMessage(`Activated group: ${groupName}`);
    }
}

async function deactivateGroup(context: vscode.ExtensionContext, groupName: string): Promise<void> {
    const groups = loadGroups(context);
    const group = groups.find(g => g.name === groupName);
    if (group) {
        const disabledExtensions = await getDisabledExtensions();
        group.extensions.forEach(id => {
            if (!disabledExtensions.includes(id)) {
                disabledExtensions.push(id);
            }
        });
        
        await vscode.workspace.getConfiguration('extensions').update('disabled', disabledExtensions, true);
        group.enabled = false;
        saveGroups(context, groups);
        vscode.window.showInformationMessage(`Deactivated group: ${groupName}`);
    }
}

function getExtensionIcon(extension: vscode.Extension<any>): string {
  try {
    const iconPath = extension.packageJSON.icon;
    if (!iconPath) return getDefaultIcon();
    const extPath = extension.extensionPath.replace(/\\/g, '/');
    const fullIconPath = vscode.Uri.file(`${extPath}/${iconPath}`);
    return fullIconPath.with({ scheme: 'vscode-resource' }).toString();
  } catch {
    return getDefaultIcon();
  }
}

function getDefaultIcon(): string {
  return vscode.Uri.joinPath(
    vscode.Uri.file(context.extensionPath),
    'media',
    'default-icon.png'
  ).with({ scheme: 'vscode-resource' }).toString();
}

function getWebviewContent(extensions: ExtensionInfo[], groups: ExtensionGroup[]): string {
    // Create group assignment map for UI
    const extensionGroups: {[key: string]: string[]} = {};
    groups.forEach(group => {
        group.extensions.forEach(extId => {
            if (!extensionGroups[extId]) {
                extensionGroups[extId] = [];
            }
            extensionGroups[extId].push(group.name);
        });
    });

    const extensionHtml = extensions.map(ext => {
        const groupNames = extensionGroups[ext.id] || [];
        const groupText = groupNames.length > 0 ? 
            `<div class="group-badges">${groupNames.map(g => `<span class="group-badge">${g}</span>`).join('')}</div>` : 
            '';
        
        return `
            <div class="ext-icon ${ext.enabled ? 'enabled' : 'disabled'}" data-id="${ext.id}">
                <img src="${ext.icon || 'https://via.placeholder.com/48?text=📦'}" 
                     onerror="this.src='https://via.placeholder.com/48?text=📦'" />
                ${groupText}
            </div>
        `;
    }).join('');

    const groupOptions = groups.map(group => 
        `<option value="${group.name}">${group.name} (${group.extensions.length} extensions)</option>`
    ).join('');

    return `
<!DOCTYPE html>
<html lang="en">
<head>
    <meta charset="UTF-8">
    <meta name="viewport" content="width=device-width, initial-scale=1.0">
    <style>
        body { 
            font-family: Segoe UI, sans-serif; 
            margin:0; 
            padding:0; 
            background:#1e1e1e; 
            color:#ddd; 
            display:flex; 
            flex-direction:column; 
            height:100vh; 
        }
        #top { 
            flex:0 0 60px; 
            background:#252526; 
            padding:10px; 
            border-bottom:1px solid #333; 
        }
        #top h2 { 
            margin:0; 
            font-size:1em; 
            color:#61dafb; 
        }
        #top p { 
            margin:2px 0 0 0; 
            font-size:0.9em; 
            color:#ccc; 
        }
        #middle { 
            flex:0 0 60px; 
            padding:10px; 
            display:flex; 
            align-items:center; 
            gap:8px; 
            border-bottom:1px solid #333; 
            background:#2c2c2c; 
        }
        #middle button, #middle select {
            padding: 5px 10px;
            background: #0e639c;
            color: white;
            border: none;
            border-radius: 3px;
            cursor: pointer;
        }
        #middle button:hover {
            background: #1177bb;
        }
        #lower { 
            flex:1; 
            overflow:auto; 
            padding:10px; 
            display:flex; 
            flex-wrap:wrap; 
            gap:8px; 
            align-content: flex-start;
        }
        .ext-icon { 
            width: 64px; 
            height: 80px; 
            border-radius:6px; 
            display:flex; 
            flex-direction: column;
            justify-content:center; 
            align-items:center; 
            cursor:pointer; 
            border:2px solid transparent; 
            transition:0.1s; 
            padding: 5px;
            position: relative;
        }
        .ext-icon.enabled { 
            border-color: #3c8611;
        }
        .ext-icon.disabled { 
            opacity:0.5; 
            border-color: #cccccc;
        }
        .ext-icon.enabled:hover { 
            border-color:#61dafb; 
        }
        .ext-icon img { 
            width:48px; 
            height:48px; 
            object-fit: contain;
        }
        .group-badges {
            position: absolute;
            bottom: 2px;
            left: 2px;
            right: 2px;
            display: flex;
            flex-wrap: wrap;
            gap: 2px;
        }
        .group-badge {
            background: #0e639c;
            color: white;
            font-size: 8px;
            padding: 1px 3px;
            border-radius: 3px;
            white-space: nowrap;
            overflow: hidden;
            text-overflow: ellipsis;
            max-width: 50px;
        }
        .selected {
            border-color: #ffa500 !important;
            background: #2a2a2a;
        }
    </style>
</head>
<body>
    <div id="top">
        <h2 id="name">Hover an extension icon</h2>
        <p id="desc"></p>
    </div>
    <div id="middle">
        <button id="create-group">Create Group</button>
        <button id="delete-group">Delete Group</button>
        <select id="group-dropdown">
            <option value="">Select a group</option>
            ${groupOptions}
        </select>
        <button id="assign-group">Assign to Group</button>
        <button id="activate-group">Activate Group</button>
        <button id="deactivate-group">Deactivate Group</button>
    </div>
    <div id="lower">${extensionHtml}</div>

    <script>
        const vscode = acquireVsCodeApi();
        let selectedExtensions = new Set();
        
        // Extension hover and selection
        document.querySelectorAll('.ext-icon').forEach(el => {
            const extId = el.dataset.id;
            
            el.addEventListener('mouseenter', () => {
                const nameEl = document.getElementById('name');
                const descEl = document.getElementById('desc');
                // In a real implementation, you'd want to store the name/description in data attributes
                nameEl.textContent = 'Extension ' + extId;
                descEl.textContent = 'Click to toggle, Ctrl+Click to select for grouping';
            });
            
            el.addEventListener('mouseleave', () => {
                document.getElementById('name').textContent = 'Hover an extension icon';
                document.getElementById('desc').textContent = '';
            });
            
            el.addEventListener('click', (e) => {
                if (e.ctrlKey || e.metaKey) {
                    // Multi-select for grouping
                    el.classList.toggle('selected');
                    if (selectedExtensions.has(extId)) {
                        selectedExtensions.delete(extId);
                    } else {
                        selectedExtensions.add(extId);
                    }
                } else {
                    // Single click - toggle extension
                    vscode.postMessage({ command: 'toggleExtension', extensionId: extId });
                }
            });
        });
        
        // Group management
        document.getElementById('create-group').addEventListener('click', () => {
            vscode.postMessage({ command: 'createGroup' });
        });
        
        document.getElementById('delete-group').addEventListener('click', () => {
            const dropdown = document.getElementById('group-dropdown');
            const selectedGroup = dropdown.value;
            if (selectedGroup) {
                vscode.postMessage({ command: 'deleteGroup', groupName: selectedGroup });
            }
        });
        
        document.getElementById('assign-group').addEventListener('click', () => {
            const dropdown = document.getElementById('group-dropdown');
            const selectedGroup = dropdown.value;
            if (selectedGroup && selectedExtensions.size > 0) {
                vscode.postMessage({ 
                    command: 'assignToGroup', 
                    groupName: selectedGroup,
                    extensionIds: Array.from(selectedExtensions)
                });
                // Clear selection
                selectedExtensions.clear();
                document.querySelectorAll('.ext-icon.selected').forEach(el => {
                    el.classList.remove('selected');
                });
            }
        });
        
        document.getElementById('activate-group').addEventListener('click', () => {
            const dropdown = document.getElementById('group-dropdown');
            const selectedGroup = dropdown.value;
            if (selectedGroup) {
                vscode.postMessage({ command: 'activateGroup', groupName: selectedGroup });
            }
        });
        
        document.getElementById('deactivate-group').addEventListener('click', () => {
            const dropdown = document.getElementById('group-dropdown');
            const selectedGroup = dropdown.value;
            if (selectedGroup) {
                vscode.postMessage({ command: 'deactivateGroup', groupName: selectedGroup });
            }
        });
    </script>
</body>
</html>`;
}

export function deactivate() {}