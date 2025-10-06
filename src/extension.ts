import * as vscode from 'vscode';

export function activate(context: vscode.ExtensionContext) {
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
    const panel = vscode.window.createWebviewPanel(
      'extensionGrouper',
      'Extension Grouper',
      vscode.ViewColumn.One,
      { enableScripts: true }
    );

    // Get all installed extensions
    const allExtensions = vscode.extensions.all.map(ext => ({
      id: ext.id,
      displayName: ext.packageJSON.displayName || ext.id,
      description: ext.packageJSON.description || '',
      version: ext.packageJSON.version || '',
      active: ext.isActive
    }));

    // Get disabled extensions from user settings
    const disabledIds: string[] = vscode.workspace.getConfiguration('extensions').get('disabled') || [];

    // Separate enabled / disabled
    const enabled = allExtensions.filter(e => !disabledIds.includes(e.id));
    const disabled = allExtensions.filter(e => disabledIds.includes(e.id));

    panel.webview.html = getWebviewContent(enabled, disabled);
  });

  context.subscriptions.push(disposable);
}

function getWebviewContent(enabled: any[], disabled: any[]): string {
  const extToHtml = (list: any[]) =>
    list.map(e => `
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

export function deactivate() {}
