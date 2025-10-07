import * as vscode from "vscode";
import * as fs from "fs";
import * as path from "path";

interface ExtensionInfo {
  id: string;
  displayName: string;
  description: string;
  icon: string;
  active: boolean;
}

interface Group {
  name: string;
  extensions: string[];
}

let groups: Group[] = [];
let groupFilePath: string;

export function activate(context: vscode.ExtensionContext) {
  console.log("Extension Grouper activated.");

  // Initialize groups file path and load existing groups
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

  // Command to open panel
  const disposable = vscode.commands.registerCommand("extension-grouper.open", async () => {
    console.log("Opening Extension Grouper panel");
    
    const panel = vscode.window.createWebviewPanel(
      "extensionGrouper",
      "Extension Grouper",
      vscode.ViewColumn.One,
      { 
        enableScripts: true, 
        retainContextWhenHidden: true,
        localResourceRoots: [
          vscode.Uri.joinPath(context.extensionUri, "media")
        ]
      }
    );

    // Get webview URIs
    const jsUri = panel.webview.asWebviewUri(vscode.Uri.joinPath(context.extensionUri, "media", "main.js"));
    const cssUri = panel.webview.asWebviewUri(vscode.Uri.joinPath(context.extensionUri, "media", "style.css"));
    
    // Read and prepare HTML
    const htmlPath = vscode.Uri.joinPath(context.extensionUri, "media", "main.html");
    let html = fs.readFileSync(htmlPath.fsPath, "utf8");
    html = html.replace(/src="main.js"/g, `src="${jsUri}"`)
              .replace(/href="style.css"/g, `href="${cssUri}"`);

    panel.webview.html = html;

    // Send initial data to webview
    const extensions = collectExtensions(panel, context);
    panel.webview.postMessage({ 
      command: "loadExtensions", 
      data: extensions, 
      groups: groups 
    });

    // Handle messages from webview
    panel.webview.onDidReceiveMessage(async (message) => {
      console.log("Extension received message:", message.command, message);
      
      try {
        switch (message.command) {
          case "getExtensions":
            const updatedExtensions = collectExtensions(panel, context);
            panel.webview.postMessage({ 
              command: "loadExtensions", 
              data: updatedExtensions, 
              groups: groups 
            });
            break;

          case "createGroup":
            if (message.name && message.name.trim()) {
              const groupName = message.name.trim();
              if (!groups.find(g => g.name === groupName)) {
                groups.push({ 
                  name: groupName, 
                  extensions: [] 
                });
                saveGroups();
                vscode.window.showInformationMessage(`Created group: ${groupName}`);
                // Send updated groups back to webview
                panel.webview.postMessage({ 
                  command: "updateGroups", 
                  groups: groups 
                });
              } else {
                vscode.window.showWarningMessage(`Group "${groupName}" already exists`);
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
                panel.webview.postMessage({ 
                  command: "updateGroups", 
                  groups: groups 
                });
              }
            }
            break;

          case "assignGroup":
            if (message.name && Array.isArray(message.selected)) {
              const group = groups.find(g => g.name === message.name);
              if (group) {
                let addedCount = 0;
                message.selected.forEach((id: string) => {
                  if (!group.extensions.includes(id)) {
                    group.extensions.push(id);
                    addedCount++;
                  }
                });
                if (addedCount > 0) {
                  saveGroups();
                  vscode.window.showInformationMessage(`Assigned ${addedCount} extensions to ${message.name}`);
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
                }
              }
            }
            break;

          case "activateGroup":
            if (message.name) {
              await toggleGroup(message.name, true);
            }
            break;

          case "deactivateGroup":
            if (message.name) {
              await toggleGroup(message.name, false);
            }
            break;

          case "backupGroup":
            backupGroups();
            break;
        }
      } catch (error) {
        console.error("Error handling message:", error);
        vscode.window.showErrorMessage(`Error: ${error}`);
      }
    }, undefined, context.subscriptions);
  });

  context.subscriptions.push(disposable);
}

// Helper functions
function ensureStorageDir(dir: string) {
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
    } else {
      groups = [];
      console.log("No existing groups found, starting fresh");
    }
  } catch (error) {
    console.error("Error loading groups:", error);
    groups = [];
  }
}

function saveGroups() {
  try {
    fs.writeFileSync(groupFilePath, JSON.stringify({ groups }, null, 2));
    console.log(`Saved ${groups.length} groups to storage`);
  } catch (error) {
    console.error("Error saving groups:", error);
    vscode.window.showErrorMessage("Failed to save groups");
  }
}

function backupGroups() {
  try {
    const backupPath = path.join(
      process.env.USERPROFILE || process.env.HOME || "",
      `extension_groups_backup_${Date.now()}.json`
    );
    fs.writeFileSync(backupPath, JSON.stringify({ groups }, null, 2));
    vscode.window.showInformationMessage(`Groups backed up to: ${backupPath}`);
  } catch (error) {
    vscode.window.showErrorMessage(`Backup failed: ${error}`);
  }
}

function collectExtensions(panel: vscode.WebviewPanel, context: vscode.ExtensionContext): ExtensionInfo[] {
  const defaultIcon = panel.webview.asWebviewUri(
    vscode.Uri.joinPath(context.extensionUri, "media", "default-icon.png")
  ).toString();

  const disabledIds = getDisabledExtensions();

  return vscode.extensions.all.map(ext => {
    let iconUri = defaultIcon;
    
    // Try to load extension icon
    if (ext.packageJSON.icon) {
      try {
        const iconPath = path.join(ext.extensionPath, ext.packageJSON.icon);
        if (fs.existsSync(iconPath)) {
          iconUri = panel.webview.asWebviewUri(vscode.Uri.file(iconPath)).toString();
        }
      } catch (error) {
        console.log(`Could not load icon for ${ext.id}:`, error);
      }
    }

    return {
      id: ext.id,
      displayName: ext.packageJSON.displayName || ext.id,
      description: ext.packageJSON.description || "No description available",
      icon: iconUri,
      active: !disabledIds.includes(ext.id)
    };
  });
}

function getDisabledExtensions(): string[] {
  try {
    const config = vscode.workspace.getConfiguration('extensions');
    return config.get<string[]>('disabled') || [];
  } catch (error) {
    console.error("Error getting disabled extensions:", error);
    return [];
  }
}

async function toggleGroup(groupName: string, enable: boolean) {
  const group = groups.find(g => g.name === groupName);
  if (!group) {
    vscode.window.showErrorMessage(`Group "${groupName}" not found`);
    return;
  }

  try {
    for (const extensionId of group.extensions) {
      if (enable) {
        await vscode.commands.executeCommand('workbench.extensions.enableExtension', extensionId);
      } else {
        await vscode.commands.executeCommand('workbench.extensions.disableExtension', extensionId);
      }
    }
    
    vscode.window.showInformationMessage(
      `${enable ? "Activated" : "Deactivated"} group "${groupName}"`,
      "Reload Window"
    ).then(selection => {
      if (selection === "Reload Window") {
        vscode.commands.executeCommand("workbench.action.reloadWindow");
      }
    });
  } catch (error) {
    vscode.window.showErrorMessage(`Failed to toggle group: ${error}`);
  }
}

export function deactivate() {}