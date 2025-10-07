const vscode = acquireVsCodeApi();
let currentGroups = [];
let selectedExtensions = [];

// Wait for DOM to be fully loaded before attaching event listeners
document.addEventListener('DOMContentLoaded', function() {
    initializeEventListeners();
    
    // Request initial data
    vscode.postMessage({ command: 'getExtensions' });
});

function initializeEventListeners() {
    // Debug: Check if elements exist
    console.log('createGroup element:', document.getElementById('createGroup'));
    console.log('deleteGroup element:', document.getElementById('deleteGroup'));
    console.log('groupList element:', document.getElementById('groupList'));
    
    // Button event listeners
    document.getElementById('createGroup').addEventListener('click', () => {
        console.log('Create Group clicked');
        const name = prompt('Enter group name:');
        if (name) {
            vscode.postMessage({ command: 'createGroup', name });
        }
    });
    
    document.getElementById('deleteGroup').addEventListener('click', () => {
        console.log('Delete Group clicked');
        const name = document.getElementById('groupList').value;
        if (name) {
            vscode.postMessage({ command: 'deleteGroup', name });
        } else {
            alert('Please select a group first');
        }
    });
    
    document.getElementById('assignGroup').addEventListener('click', () => {
        console.log('Assign Group clicked');
        const name = document.getElementById('groupList').value;
        if (name && selectedExtensions.length > 0) {
            vscode.postMessage({ command: 'assignGroup', name, selected: selectedExtensions });
        } else {
            alert('Please select a group and at least one extension');
        }
    });
    
    document.getElementById('deassignGroup').addEventListener('click', () => {
        console.log('Deassign Group clicked');
        const name = document.getElementById('groupList').value;
        if (name && selectedExtensions.length > 0) {
            vscode.postMessage({ command: 'deassignGroup', name, selected: selectedExtensions });
        } else {
            alert('Please select a group and at least one extension');
        }
    });
    
    document.getElementById('activateGroup').addEventListener('click', () => {
        console.log('Activate Group clicked');
        const name = document.getElementById('groupList').value;
        if (name) {
            vscode.postMessage({ command: 'activateGroup', name });
        } else {
            alert('Please select a group first');
        }
    });
    
    document.getElementById('deactivateGroup').addEventListener('click', () => {
        console.log('Deactivate Group clicked');
        const name = document.getElementById('groupList').value;
        if (name) {
            vscode.postMessage({ command: 'deactivateGroup', name });
        } else {
            alert('Please select a group first');
        }
    });
    
    document.getElementById('backupGroup').addEventListener('click', () => {
        console.log('Backup Group clicked');
        vscode.postMessage({ command: 'backupGroup' });
    });
}

// Message handler from extension
window.addEventListener('message', event => {
    const { command, data, groups } = event.data;
    console.log('Webview received message:', command);
    
    if (command === 'loadExtensions') {
        renderExtensions(data);
        populateGroups(groups);
    }
    if (command === 'updateGroups') {
        populateGroups(groups);
    }
});

function renderExtensions(extensions) {
    const container = document.getElementById('bottom-panel');
    container.innerHTML = '';
    
    extensions.forEach(ext => {
        const icon = document.createElement('img');
        icon.src = ext.icon;
        icon.className = 'extension-icon';
        icon.alt = ext.displayName;
        icon.title = `${ext.displayName}\n${ext.description}`;
        
        // Handle image loading errors
        icon.onerror = function() {
            this.src = 'https://code.visualstudio.com/assets/favicon.ico';
        };
        
        // Hover events
        icon.addEventListener('mouseenter', () => {
            document.getElementById('top-panel').textContent = `${ext.displayName} — ${ext.description}`;
        });
        
        icon.addEventListener('mouseleave', () => {
            document.getElementById('top-panel').textContent = 'Hover over an extension icon to see its details';
        });
        
        // Click to select for grouping
        icon.addEventListener('click', (e) => {
            // Use Ctrl/Cmd for multi-select
            if (e.ctrlKey || e.metaKey) {
                toggleSelect(ext.id, icon);
            } else {
                // Single click - clear others and select this one
                clearSelections();
                toggleSelect(ext.id, icon);
            }
        });
        
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
    console.log('Selected extensions:', selectedExtensions);
}

function clearSelections() {
    selectedExtensions = [];
    document.querySelectorAll('.extension-icon.selected').forEach(icon => {
        icon.classList.remove('selected');
    });
}

function populateGroups(groups) {
    currentGroups = groups;
    const ddl = document.getElementById('groupList');
    const currentValue = ddl.value; // Remember current selection
    
    ddl.innerHTML = '<option value="">Select a group</option>';
    
    groups.forEach(g => {
        const opt = document.createElement('option');
        opt.textContent = `${g.name} (${g.extensions.length} extensions)`;
        opt.value = g.name;
        ddl.appendChild(opt);
    });
    
    // Restore selection if it still exists
    if (currentValue && groups.find(g => g.name === currentValue)) {
        ddl.value = currentValue;
    }
}