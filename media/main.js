const vscode = acquireVsCodeApi();

// State
let currentGroups = [];
let selectedExtensions = [];

// Initialize when DOM is ready
document.addEventListener('DOMContentLoaded', function() {
    console.log('Extension Grouper UI loaded');
    initializeUI();
});

function initializeUI() {
    console.log('Initializing UI components');
    
    // Initialize button event listeners
    initializeButtonListeners();
    
    // Request initial data from extension
    vscode.postMessage({ command: 'getExtensions' });
    
    // Log that we're ready
    console.log('UI initialized, waiting for extension data...');
}

function initializeButtonListeners() {
    console.log('Setting up button listeners');
    
    // Create Group
    const createBtn = document.getElementById('createGroup');
    if (createBtn) {
        createBtn.addEventListener('click', handleCreateGroup);
        console.log('Create Group button listener attached');
    } else {
        console.error('Create Group button not found!');
    }
    
    // Delete Group
    const deleteBtn = document.getElementById('deleteGroup');
    if (deleteBtn) {
        deleteBtn.addEventListener('click', handleDeleteGroup);
    }
    
    // Assign to Group
    const assignBtn = document.getElementById('assignGroup');
    if (assignBtn) {
        assignBtn.addEventListener('click', handleAssignGroup);
    }
    
    // Deassign from Group
    const deassignBtn = document.getElementById('deassignGroup');
    if (deassignBtn) {
        deassignBtn.addEventListener('click', handleDeassignGroup);
    }
    
    // Activate Group
    const activateBtn = document.getElementById('activateGroup');
    if (activateBtn) {
        activateBtn.addEventListener('click', handleActivateGroup);
    }
    
    // Deactivate Group
    const deactivateBtn = document.getElementById('deactivateGroup');
    if (deactivateBtn) {
        deactivateBtn.addEventListener('click', handleDeactivateGroup);
    }
    
    // Backup Group
    const backupBtn = document.getElementById('backupGroup');
    if (backupBtn) {
        backupBtn.addEventListener('click', handleBackupGroup);
    }
}

// Button handlers
function handleCreateGroup() {
    console.log('Create Group button clicked');
    const groupName = prompt('Enter a name for the new group:');
    console.log('User entered:', groupName);
    
    if (groupName && groupName.trim()) {
        console.log('Sending createGroup message:', groupName.trim());
        vscode.postMessage({ 
            command: 'createGroup', 
            name: groupName.trim() 
        });
    } else if (groupName !== null) {
        alert('Please enter a valid group name');
    }
}

function handleDeleteGroup() {
    const groupName = document.getElementById('groupList').value;
    if (groupName) {
        if (confirm(`Delete group "${groupName}"?`)) {
            vscode.postMessage({ command: 'deleteGroup', name: groupName });
        }
    } else {
        alert('Please select a group first');
    }
}

function handleAssignGroup() {
    const groupName = document.getElementById('groupList').value;
    if (groupName && selectedExtensions.length > 0) {
        vscode.postMessage({ 
            command: 'assignGroup', 
            name: groupName, 
            selected: selectedExtensions 
        });
        clearSelections();
    } else {
        alert('Please select a group and at least one extension');
    }
}

function handleDeassignGroup() {
    const groupName = document.getElementById('groupList').value;
    if (groupName && selectedExtensions.length > 0) {
        vscode.postMessage({ 
            command: 'deassignGroup', 
            name: groupName, 
            selected: selectedExtensions 
        });
        clearSelections();
    } else {
        alert('Please select a group and at least one extension');
    }
}

function handleActivateGroup() {
    const groupName = document.getElementById('groupList').value;
    if (groupName) {
        vscode.postMessage({ command: 'activateGroup', name: groupName });
    } else {
        alert('Please select a group first');
    }
}

function handleDeactivateGroup() {
    const groupName = document.getElementById('groupList').value;
    if (groupName) {
        vscode.postMessage({ command: 'deactivateGroup', name: groupName });
    } else {
        alert('Please select a group first');
    }
}

function handleBackupGroup() {
    vscode.postMessage({ command: 'backupGroup' });
}

// Message handler from extension
window.addEventListener('message', event => {
    const message = event.data;
    console.log('Webview received message:', message.command, message);
    
    switch (message.command) {
        case 'loadExtensions':
            console.log('Loading extensions:', message.data.length);
            console.log('Loading groups:', message.groups);
            renderExtensions(message.data);
            populateGroups(message.groups);
            break;
            
        case 'updateGroups':
            console.log('Updating groups:', message.groups);
            populateGroups(message.groups);
            break;
    }
});

function renderExtensions(extensions) {
    console.log('Rendering', extensions.length, 'extensions');
    const container = document.getElementById('bottom-panel');
    container.innerHTML = '';
    
    extensions.forEach(ext => {
        const icon = document.createElement('img');
        icon.src = ext.icon;
        icon.className = 'extension-icon';
        icon.alt = ext.displayName;
        icon.title = `${ext.displayName}\n${ext.description}`;
        
        // Handle broken images
        icon.onerror = function() {
            console.log('Image failed to load for:', ext.displayName);
            this.src = 'https://code.visualstudio.com/assets/favicon.ico';
        };
        
        // Hover to show details
        icon.addEventListener('mouseenter', () => {
            document.getElementById('top-panel').textContent = `${ext.displayName} — ${ext.description}`;
        });
        
        icon.addEventListener('mouseleave', () => {
            document.getElementById('top-panel').textContent = 'Hover over an extension icon to see its details';
        });
        
        // Click to select (Ctrl for multi-select)
        icon.addEventListener('click', (e) => {
            if (e.ctrlKey || e.metaKey) {
                toggleSelect(ext.id, icon);
            } else {
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
    console.log('Populating groups dropdown with:', groups);
    currentGroups = groups;
    const dropdown = document.getElementById('groupList');
    const currentSelection = dropdown.value;
    
    dropdown.innerHTML = '<option value="">Select a group</option>';
    
    groups.forEach(group => {
        const option = document.createElement('option');
        option.value = group.name;
        option.textContent = `${group.name} (${group.extensions.length} extensions)`;
        dropdown.appendChild(option);
    });
    
    // Restore previous selection if it still exists
    if (currentSelection && groups.find(g => g.name === currentSelection)) {
        dropdown.value = currentSelection;
    }
    
    console.log('Groups dropdown updated');
}