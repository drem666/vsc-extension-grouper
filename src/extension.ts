import * as vscode from "vscode";
import * as fs from "fs";
import * as path from "path";

interface ExtensionGroup {
    name: string;
    extensions: string[];
}

let groups: ExtensionGroup[] = [];
let groupFilePath: string;
let currentPanel: vscode.WebviewPanel | undefined;

export function activate(context: vscode.ExtensionContext) {
    console.log("Extension Grouper activated.");

    groupFilePath = path.join(context.globalStorageUri.fsPath, "groups.json");
    ensureStorageDir(context.globalStorageUri.fsPath);
    loadGroups();

    // Status-bar button
    const button = vscode.window.createStatusBarItem(
        vscode.StatusBarAlignment.Left,
        100
    );
    button.text = "$(extensions) Grouper";
    button.tooltip = "Open Extension Grouper";
    button.command = "extension-grouper.open";
    button.show();
    context.subscriptions.push(button);

    const disposable = vscode.commands.registerCommand(
        "extension-grouper.open",
        async () => {
            console.log("Opening Extension Grouper panel");

            if (currentPanel) {
                currentPanel.reveal(vscode.ViewColumn.One);
                return;
            }

            currentPanel = vscode.window.createWebviewPanel(
                "extensionGrouper",
                "Extension Grouper",
                vscode.ViewColumn.One,
                {
                    enableScripts: true,
                    retainContextWhenHidden: true,
                    localResourceRoots: [
                        vscode.Uri.joinPath(context.extensionUri, "media"),
                        ...vscode.extensions.all.map(ext =>
                            vscode.Uri.file(ext.extensionPath)
                        )
                    ]
                }
            );

            const jsUri = currentPanel.webview.asWebviewUri(
                vscode.Uri.joinPath(context.extensionUri, "media", "main.js")
            );
            const cssUri = currentPanel.webview.asWebviewUri(
                vscode.Uri.joinPath(context.extensionUri, "media", "style.css")
            );
            const htmlPath = vscode.Uri.joinPath(
                context.extensionUri,
                "media",
                "main.html"
            );

            let html = fs.readFileSync(htmlPath.fsPath, "utf8");
            html = html
                .replace(/src="main.js"/g, `src="${jsUri}"`)
                .replace(/href="style.css"/g, `href="${cssUri}"`);

            currentPanel.webview.html = html;

            const extensions = collectExtensions(currentPanel, context);
            currentPanel.webview.postMessage({
                command: "loadExtensions",
                data: extensions,
                groups
            });

            currentPanel.webview.onDidReceiveMessage(
                async (message: any) => {
                    try {
                        switch (message.command) {
                            case "getExtensions": {
                                const updatedExtensions = collectExtensions(
                                    currentPanel!,
                                    context
                                );
                                currentPanel!.webview.postMessage({
                                    command: "loadExtensions",
                                    data: updatedExtensions,
                                    groups
                                });
                                break;
                            }

                            case "createGroup": {
                                const groupName =
                                    await vscode.window.showInputBox({
                                        prompt:
                                            "Enter a name for the new group",
                                        placeHolder: "Group name"
                                    });
                                if (groupName && groupName.trim()) {
                                    const trimmedName = groupName.trim();
                                    if (
                                        !groups.find(
                                            g => g.name === trimmedName
                                        )
                                    ) {
                                        groups.push({
                                            name: trimmedName,
                                            extensions: []
                                        });
                                        saveGroups();
                                        vscode.window.showInformationMessage(
                                            `Created group: ${trimmedName}`
                                        );
                                        currentPanel!.webview.postMessage({
                                            command: "updateGroups",
                                            groups
                                        });
                                    } else {
                                        vscode.window.showWarningMessage(
                                            `Group "${trimmedName}" already exists`
                                        );
                                    }
                                }
                                break;
                            }

                            case "deleteGroup": {
                                if (message.name) {
                                    const initialLength = groups.length;
                                    groups = groups.filter(
                                        g => g.name !== message.name
                                    );
                                    if (groups.length < initialLength) {
                                        saveGroups();
                                        vscode.window.showInformationMessage(
                                            `Deleted group: ${message.name}`
                                        );
                                        currentPanel!.webview.postMessage({
                                            command: "updateGroups",
                                            groups
                                        });
                                    }
                                }
                                break;
                            }

                            case "assignGroup": {
                                if (
                                    message.name &&
                                    Array.isArray(message.selected)
                                ) {
                                    const group = groups.find(
                                        g => g.name === message.name
                                    );
                                    if (group) {
                                        let addedCount = 0;
                                        message.selected.forEach(
                                            (id: string) => {
                                                if (
                                                    !group.extensions.includes(
                                                        id
                                                    )
                                                ) {
                                                    group.extensions.push(id);
                                                    addedCount++;
                                                }
                                            }
                                        );
                                        if (addedCount > 0) {
                                            saveGroups();
                                            vscode.window.showInformationMessage(
                                                `Assigned ${addedCount} extensions to ${message.name}`
                                            );
                                            currentPanel!.webview.postMessage({
                                                command: "updateGroups",
                                                groups
                                            });
                                        }
                                    }
                                }
                                break;
                            }

                            case "deassignGroup": {
                                if (
                                    message.name &&
                                    Array.isArray(message.selected)
                                ) {
                                    const group = groups.find(
                                        g => g.name === message.name
                                    );
                                    if (group) {
                                        const initialLength =
                                            group.extensions.length;
                                        group.extensions = group.extensions.filter(
                                            id =>
                                                !message.selected.includes(id)
                                        );
                                        const removedCount =
                                            initialLength -
                                            group.extensions.length;
                                        if (removedCount > 0) {
                                            saveGroups();
                                            vscode.window.showInformationMessage(
                                                `Removed ${removedCount} extensions from ${message.name}`
                                            );
                                            currentPanel!.webview.postMessage({
                                                command: "updateGroups",
                                                groups
                                            });
                                        }
                                    }
                                }
                                break;
                            }

                            case "activateGroup": {
                                if (message.name) {
                                    await activateGroup(message.name);
                                }
                                break;
                            }

                            case "deactivateGroup": {
                                if (message.name) {
                                    await deactivateGroup(message.name);
                                }
                                break;
                            }

                            case "toggleExtension": {
                                if (message.id) {
                                    await toggleExtension(message.id);
                                }
                                break;
                            }

                            case "backupGroup": {
                                backupGroups();
                                break;
                            }
                        }
                    } catch (error: any) {
                        vscode.window.showErrorMessage(`Error: ${error}`);
                    }
                },
                undefined,
                context.subscriptions
            );

            currentPanel.onDidDispose(
                () => {
                    currentPanel = undefined;
                },
                null,
                context.subscriptions
            );
        }
    );

    context.subscriptions.push(disposable);
}

// --------------------------------------------------------
// DATA STORAGE HELPERS
// --------------------------------------------------------

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
        } else {
            groups = [];
        }
    } catch {
        groups = [];
    }
}

function saveGroups() {
    try {
        fs.writeFileSync(
            groupFilePath,
            JSON.stringify({ groups }, null, 2),
            "utf8"
        );
    } catch {
        vscode.window.showErrorMessage("Failed to save groups");
    }
}

function backupGroups() {
    try {
        const backupPath = path.join(
            process.env.USERPROFILE || process.env.HOME || "",
            `extension_groups_backup_${Date.now()}.json`
        );
        fs.writeFileSync(
            backupPath,
            JSON.stringify({ groups }, null, 2),
            "utf8"
        );
        vscode.window.showInformationMessage(
            `Groups backed up to: ${backupPath}`
        );
    } catch (error: any) {
        vscode.window.showErrorMessage(`Backup failed: ${error}`);
    }
}

// --------------------------------------------------------
// EXTENSION DATA COLLECTION
// --------------------------------------------------------

function collectExtensions(
    panel: vscode.WebviewPanel,
    context: vscode.ExtensionContext
) {
    const defaultIcon = panel.webview
        .asWebviewUri(
            vscode.Uri.joinPath(
                context.extensionUri,
                "media",
                "default-icon.png"
            )
        )
        .toString();

    return vscode.extensions.all.map(ext => {
        let iconUri = defaultIcon;
        const pkg: any = ext.packageJSON;

        if (pkg?.icon) {
            try {
                const iconPath = path.join(ext.extensionPath, pkg.icon);
                if (fs.existsSync(iconPath)) {
                    iconUri = panel.webview
                        .asWebviewUri(vscode.Uri.file(iconPath))
                        .toString();
                }
            } catch {}
        }

        const extensionGroups = groups
            .filter(group => group.extensions.includes(ext.id))
            .map(group => group.name);

        return {
            id: ext.id,
            displayName: pkg.displayName || ext.id,
            description: pkg.description || "No description available",
            icon: iconUri,
            active: ext.isActive,
            groups: extensionGroups
        };
    });
}

// --------------------------------------------------------
// PRESENT COMMANDS TO USER
// --------------------------------------------------------

async function offerCommandActions(title: string, commands: string) {
    const choice = await vscode.window.showInformationMessage(
        title,
        "Copy to Clipboard",
        "Show Commands",
        "Cancel"
    );

    if (choice === "Copy to Clipboard") {
        await vscode.env.clipboard.writeText(commands);
        vscode.window.showInformationMessage("Commands copied to clipboard.");
    } else if (choice === "Show Commands") {
        vscode.window.showInformationMessage(
            "Commands:",
            { modal: true, detail: commands }
        );
    }
}

// --------------------------------------------------------
// ACTION LOGIC (NOW: GENERATE COMMANDS)
// --------------------------------------------------------

async function toggleExtension(extensionId: string) {
    const ext = vscode.extensions.getExtension(extensionId);
    if (!ext) {
        vscode.window.showErrorMessage(`Extension not found: ${extensionId}`);
        return;
    }

    const cmd = ext.isActive
        ? `code --disable-extension ${extensionId}`
        : `code --enable-extension ${extensionId}`;

    await offerCommandActions(
        `${ext.isActive ? "Disable" : "Enable"} Extension`,
        cmd
    );
}

async function activateGroup(groupName: string) {
    const group = groups.find(g => g.name === groupName);
    if (!group) {
        vscode.window.showErrorMessage(`Group "${groupName}" not found`);
        return;
    }

    const commands = group.extensions
        .map(id => `code --enable-extension ${id}`)
        .join("\n");

    await offerCommandActions(
        `Enable all extensions in group "${groupName}"`,
        commands
    );
}

async function deactivateGroup(groupName: string) {
    const group = groups.find(g => g.name === groupName);
    if (!group) {
        vscode.window.showErrorMessage(`Group "${groupName}" not found`);
        return;
    }

    const commands = group.extensions
        .map(id => `code --disable-extension ${id}`)
        .join("\n");

    await offerCommandActions(
        `Disable all extensions in group "${groupName}"`,
        commands
    );
}

export function deactivate() {}
