const vscode = acquireVsCodeApi();
let currentGroups = [];
let selectedExtensions = [];

window.addEventListener('message', event => {
	const { command, data, groups } = event.data;
	if (command === 'loadExtensions') {
		renderExtensions(data);
		populateGroups(groups);
	}
	if (command === 'updateGroups') populateGroups(groups);
});

function renderExtensions(extensions) {
	const container = document.getElementById('bottom-panel');
	container.innerHTML = '';
	extensions.forEach(ext => {
		const icon = document.createElement('img');
		icon.src = ext.icon || 'https://code.visualstudio.com/assets/favicon.ico';
		icon.className = 'extension-icon';
		icon.title = ext.displayName;
		icon.addEventListener('mouseenter', () => {
			document.getElementById('top-panel').textContent = `${ext.displayName} — ${ext.description}`;
		});
		icon.addEventListener('click', () => toggleSelect(ext.id, icon));
		container.appendChild(icon);
	});
}

function toggleSelect(id, icon) {
	const idx = selectedExtensions.indexOf(id);
	if (idx > -1) {
		selectedExtensions.splice(idx, 1);
		icon.classList.remove('selected');
	} else {
		selectedExtensions.push(id);
		icon.classList.add('selected');
	}
}

function populateGroups(groups) {
	currentGroups = groups;
	const ddl = document.getElementById('groupList');
	ddl.innerHTML = '';
	groups.forEach(g => {
		const opt = document.createElement('option');
		opt.textContent = g.name;
		opt.value = g.name;
		ddl.appendChild(opt);
	});
}

// Buttons
document.getElementById('createGroup').onclick = () => {
	const name = prompt('Enter group name:');
	if (name) vscode.postMessage({ command: 'createGroup', name });
};
document.getElementById('deleteGroup').onclick = () => {
	const name = document.getElementById('groupList').value;
	if (name) vscode.postMessage({ command: 'deleteGroup', name });
};
document.getElementById('assignGroup').onclick = () => {
	const name = document.getElementById('groupList').value;
	if (name) vscode.postMessage({ command: 'assignGroup', name, selected: selectedExtensions });
};
document.getElementById('activateGroup').onclick = () => {
	const name = document.getElementById('groupList').value;
	if (name) vscode.postMessage({ command: 'activateGroup', name });
};
document.getElementById('deactivateGroup').onclick = () => {
	const name = document.getElementById('groupList').value;
	if (name) vscode.postMessage({ command: 'deactivateGroup', name });
};
document.getElementById('backupGroup').onclick = () => {
	vscode.postMessage({ command: 'backupGroup' });
};
