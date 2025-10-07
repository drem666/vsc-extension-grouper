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
      { enableScripts: true, localResourceRoots: [vscode.Uri.joinPath(context.extensionUri, "media")] }
    );

    const htmlPath = vscode.Uri.joinPath(context.extensionUri, "media", "main.html");
    let html = fs.readFileSync(htmlPath.fsPath, "utf8");

    const jsUri = panel.webview.asWebviewUri(vscode.Uri.joinPath(context.extensionUri, "media", "main.js"));
    const cssUri = panel.webview.asWebviewUri(vscode.Uri.joinPath(context.extensionUri, "media", "style.css"));
    html = html.replace(/src="main.js"/g, `src="${jsUri}"`).replace(/href="style.css"/g, `href="${cssUri}"`);

    panel.webview.html = html;

    // Initial send of data - USE THE CORRECT COMMAND NAME
    const data = collectExtensions(panel, context);
    panel.webview.postMessage({ command: "loadExtensions", data, groups });

    // Message handler from webview
    panel.webview.onDidReceiveMessage(async (msg) => {
      switch (msg.command) {
        case "getExtensions":
          panel.webview.postMessage({ command: "loadExtensions", data: collectExtensions(panel, context), groups });
          break;

        case "createGroup":
          if (!groups.find((g) => g.name === msg.name)) {
            groups.push({ name: msg.name, extensions: [] });
          }
          saveGroups();
          panel.webview.postMessage({ command: "updateGroups", groups });
          break;

        case "deleteGroup":
          groups = groups.filter((g) => g.name !== msg.name);
          saveGroups();
          panel.webview.postMessage({ command: "updateGroups", groups });
          break;

        case "assignGroup":
          {
            const g = groups.find((x) => x.name === msg.name);
            if (g && Array.isArray(msg.selected)) {
              msg.selected.forEach((id: string) => {
                if (!g.extensions.includes(id)) g.extensions.push(id);
              });
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
      groups = JSON.parse(fs.readFileSync(groupFilePath, "utf8"));
    }
  } catch {
    groups = [];
  }
}

function saveGroups() {
  try {
    fs.writeFileSync(groupFilePath, JSON.stringify(groups, null, 2));
  } catch (err) {
    console.error("Failed to save groups:", err);
  }
}

function backupGroups() {
  const backupPath = path.join(
    process.env.USERPROFILE || process.env.HOME || "",
    "extension_groups_backup.json"
  );
  fs.writeFileSync(backupPath, JSON.stringify(groups, null, 2));
  vscode.window.showInformationMessage(`Groups backed up to ${backupPath}`);
}

// Gather info on all extensions
function collectExtensions(panel: vscode.WebviewPanel, context: vscode.ExtensionContext): ExtensionInfo[] {
  const defaultIcon = panel.webview.asWebviewUri(
    vscode.Uri.joinPath(context.extensionUri, "media", "default-icon.png")
  ).toString();

  return vscode.extensions.all.map((ext) => {
    const iconRel = ext.packageJSON.icon
      ? panel.webview.asWebviewUri(vscode.Uri.file(path.join(ext.extensionPath, ext.packageJSON.icon))).toString()
      : defaultIcon;
    return {
      id: ext.id,
      displayName: ext.packageJSON.displayName || ext.id,
      description: ext.packageJSON.description || "",
      icon: iconRel,
      active: ext.isActive,
    };
  });
}

// Enable / disable a full group
async function toggleGroup(name: string, enable: boolean) {
  const g = groups.find((x) => x.name === name);
  if (!g) return;
  for (const id of g.extensions) {
    try {
      if (enable)
        await vscode.commands.executeCommand("workbench.extensions.enableExtension", id);
      else
        await vscode.commands.executeCommand("workbench.extensions.disableExtension", id);
    } catch (err) {
      console.error(`Failed to toggle ${id}:`, err);
    }
  }
  vscode.window.showInformationMessage(`${enable ? "Activated" : "Deactivated"} group "${name}"`);
}

export function deactivate() {}