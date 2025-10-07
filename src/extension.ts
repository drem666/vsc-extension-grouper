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
    const panel = vscode.window.createWebviewPanel(
      "extensionGrouper",
      "Extension Grouper",
      vscode.ViewColumn.One,
      { 
        enableScripts: true, 
        localResourceRoots: [
          vscode.Uri.joinPath(context.extensionUri, "media"),
          context.extensionUri
        ]
      }
    );

    const htmlPath = vscode.Uri.joinPath(context.extensionUri, "media", "main.html");
    let html = fs.readFileSync(htmlPath.fsPath, "utf8");

    const jsUri = panel.webview.asWebviewUri(vscode.Uri.joinPath(context.extensionUri, "media", "main.js"));
    const cssUri = panel.webview.asWebviewUri(vscode.Uri.joinPath(context.extensionUri, "media", "style.css"));
    const defaultIconUri = panel.webview.asWebviewUri(vscode.Uri.joinPath(context.extensionUri, "media", "default-icon.png"));
    
    html = html.replace(/src="main.js"/g, `src="${jsUri}"`)
              .replace(/href="style.css"/g, `href="${cssUri}"`);

    panel.webview.html = html;

    // Initial send of data
    const data = collectExtensions(panel, context, defaultIconUri.toString());
    panel.webview.postMessage({ command: "loadExtensions", data, groups });

    // Message handler from webview
    panel.webview.onDidReceiveMessage(async (msg) => {
      console.log("Received message:", msg.command); // Debug log
      
      switch (msg.command) {
        case "getExtensions":
          panel.webview.postMessage({ command: "loadExtensions", data: collectExtensions(panel, context, defaultIconUri.toString()), groups });
          break;

        case "createGroup":
          if (!groups.find((g) => g.name === msg.name)) {
            groups.push({ name: msg.name, extensions: [] });
            vscode.window.showInformationMessage(`Created group: ${msg.name}`);
          }
          saveGroups();
          panel.webview.postMessage({ command: "updateGroups", groups });
          break;

        case "deleteGroup":
          const groupToDelete = groups.find(g => g.name === msg.name);
          if (groupToDelete) {
            groups = groups.filter((g) => g.name !== msg.name);
            vscode.window.showInformationMessage(`Deleted group: ${msg.name}`);
            saveGroups();
            panel.webview.postMessage({ command: "updateGroups", groups });
          }
          break;

        case "assignGroup":
          {
            const g = groups.find((x) => x.name === msg.name);
            if (g && Array.isArray(msg.selected)) {
              msg.selected.forEach((id: string) => {
                if (!g.extensions.includes(id)) g.extensions.push(id);
              });
              vscode.window.showInformationMessage(`Assigned ${msg.selected.length} extensions to ${msg.name}`);
              saveGroups();
            }
          }
          break;

        case "activateGroup":
          await toggleGroup(msg.name, true);
          break;

        case "deactivateGroup":
          await toggleGroup(msg.name, false);
          break;

        case "backupGroup":
          backupGroups();
          break;
      }
    });
  });

  context.subscriptions.push(disposable);
}

// ────────────────────────────────────────────────
// Helpers
// ────────────────────────────────────────────────
function ensureStorageDir(dir: string) {
  if (!fs.existsSync(dir)) fs.mkdirSync(dir, { recursive: true });
}

function loadGroups() {
  try {
    if (fs.existsSync(groupFilePath)) {
      const data = fs.readFileSync(groupFilePath, "utf8");
      groups = JSON.parse(data).groups || [];
    }
  } catch (err) {
    console.error("Error loading groups:", err);
    groups = [];
  }
}

function saveGroups() {
  try {
    fs.writeFileSync(groupFilePath, JSON.stringify({ groups }, null, 2));
  } catch (err) {
    console.error("Failed to save groups:", err);
  }
}

function backupGroups() {
  try {
    const backupPath = path.join(
      process.env.USERPROFILE || process.env.HOME || "",
      "extension_groups_backup.json"
    );
    fs.writeFileSync(backupPath, JSON.stringify({ groups }, null, 2));
    vscode.window.showInformationMessage(`Groups backed up to ${backupPath}`);
  } catch (err) {
    vscode.window.showErrorMessage(`Failed to backup groups: ${err}`);
  }
}

// Gather info on all extensions
function collectExtensions(panel: vscode.WebviewPanel, context: vscode.ExtensionContext, defaultIcon: string): ExtensionInfo[] {
  const disabledIds = getDisabledExtensions();
  
  return vscode.extensions.all.map((ext) => {
    let iconUri = defaultIcon;
    
    // Try to get the extension's icon
    if (ext.packageJSON.icon) {
      try {
        const iconPath = path.join(ext.extensionPath, ext.packageJSON.icon);
        if (fs.existsSync(iconPath)) {
          iconUri = panel.webview.asWebviewUri(vscode.Uri.file(iconPath)).toString();
        }
      } catch (err) {
        console.log(`Could not load icon for ${ext.id}:`, err);
      }
    }

    return {
      id: ext.id,
      displayName: ext.packageJSON.displayName || ext.id,
      description: ext.packageJSON.description || "No description",
      icon: iconUri,
      active: !disabledIds.includes(ext.id),
    };
  });
}

function getDisabledExtensions(): string[] {
  try {
    const settingsPath = path.join(process.env.APPDATA || "", "Code", "User", "settings.json");
    if (fs.existsSync(settingsPath)) {
      const settings = JSON.parse(fs.readFileSync(settingsPath, "utf8"));
      return settings["extensions.disabled"] || [];
    }
  } catch (err) {
    console.error("Error reading disabled extensions:", err);
  }
  return [];
}

// Enable / disable a full group
async function toggleGroup(name: string, enable: boolean) {
  const g = groups.find((x) => x.name === name);
  if (!g) {
    vscode.window.showErrorMessage(`Group "${name}" not found`);
    return;
  }
  
  for (const id of g.extensions) {
    try {
      if (enable) {
        await vscode.commands.executeCommand("workbench.extensions.enableExtension", id);
      } else {
        await vscode.commands.executeCommand("workbench.extensions.disableExtension", id);
      }
    } catch (err) {
      console.error(`Failed to toggle ${id}:`, err);
    }
  }
  
  vscode.window.showInformationMessage(`${enable ? "Activated" : "Deactivated"} group "${name}"`);
  // Reload window to see changes
  vscode.window.showInformationMessage("Reload window to see extension changes", "Reload")
    .then(selection => {
      if (selection === "Reload") {
        vscode.commands.executeCommand("workbench.action.reloadWindow");
      }
    });
}

export function deactivate() {}