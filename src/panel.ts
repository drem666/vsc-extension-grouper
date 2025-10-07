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
