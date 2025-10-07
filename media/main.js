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
    
    console.log('UI initialized, waiting for extension data...');
}

function initializeButtonListeners() {
    console.log('Setting up button listeners');
    
    // Create Group - just sends command, extension handles input
    const createBtn = document.getElementById('createGroup');
    if (createBtn) {
        createBtn.addEventListener('click', () => {
            console.log('Create Group button clicked - sending command to extension');
            vscode.postMessage({ command: 'createGroup' });
        });
        console.log('Create Group button listener attached');
    } else {
        console.error('Create Group button not found!');
    }
    
    // Delete Group
    document.getElementById('deleteGroup').addEventListener('click', () => {
        const groupName = document.getElementById('groupList').value;
        if (groupName) {
            if (confirm(`Delete group "${groupName}"?`)) {
                vscode.postMessage({ command: 'deleteGroup', name: groupName });
            }
        } else {
            alert('Please select a group first');
        }
    });
    
    // Assign to Group
    document.getElementById('assignGroup').addEventListener('click', () => {
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
    });
    
    // Deassign from Group
    document.getElementById('deassignGroup').addEventListener('click', () => {
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
    });
    
    // Activate Group
    document.getElementById('activateGroup').addEventListener('click', () => {
        const groupName = document.getElementById('groupList').value;
        if (groupName) {
            vscode.postMessage({ command: 'activateGroup', name: groupName });
        } else {
            alert('Please select a group first');
        }
    });
    
    // Deactivate Group
    document.getElementById('deactivateGroup').addEventListener('click', () => {
        const groupName = document.getElementById('groupList').value;
        if (groupName) {
            vscode.postMessage({ command: 'deactivateGroup', name: groupName });
        } else {
            alert('Please select a group first');
        }
    });
    
    // Backup Group
    document.getElementById('backupGroup').addEventListener('click', () => {
        vscode.postMessage({ command: 'backupGroup' });
    });
}

// Message handler from extension
window.addEventListener('message', event => {
    const message = event.data;
    console.log('Webview received message:', message.command);
    
    switch (message.command) {
        case 'loadExtensions':
            console.log('Loading extensions and groups');
            renderExtensions(message.data);
            populateGroups(message.groups);
            break;
            
        case 'updateGroups':
            console.log('Updating groups:', message.groups);
            populateGroups(message.groups);
            // Refresh extensions to update group badges
            vscode.postMessage({ command: 'getExtensions' });
            break;
    }
});

function renderExtensions(extensions) {
    console.log('Rendering', extensions.length, 'extensions with group badges');
    const container = document.getElementById('bottom-panel');
    container.innerHTML = '';
    
    extensions.forEach(ext => {
        // Create container for icon and badges
        const iconContainer = document.createElement('div');
        iconContainer.className = 'extension-icon-container';
        iconContainer.dataset.id = ext.id;
        
        const icon = document.createElement('img');
        icon.src = ext.icon;
        icon.className = 'extension-icon';
        icon.alt = ext.displayName;
        icon.title = `${ext.displayName}\n${ext.description}`;
        
        // Handle broken images
        icon.onerror = function() {
            this.src = 'https://code.visualstudio.com/assets/favicon.ico';
        };
        
        // Add group badges if extension has groups
        if (ext.groups && ext.groups.length > 0) {
            const badgeContainer = document.createElement('div');
            badgeContainer.className = 'group-badges';
            
            ext.groups.forEach(groupName => {
                const badge = document.createElement('span');
                badge.className = 'group-badge';
                badge.textContent = groupName;
                badge.title = `Part of group: ${groupName}`;
                badgeContainer.appendChild(badge);
            });
            
            iconContainer.appendChild(badgeContainer);
        }
        
        // Hover to show details
        icon.addEventListener('mouseenter', () => {
            document.getElementById('top-panel').textContent = `${ext.displayName} — ${ext.description}`;
        });
        
        icon.addEventListener('mouseleave', () => {
            document.getElementById('top-panel').textContent = 'Hover over an extension icon to see its details';
        });
        
        // Click behavior: Ctrl+Click for selection, normal click to toggle extension
        icon.addEventListener('click', (e) => {
            if (e.ctrlKey || e.metaKey) {
                // Ctrl+Click: Select for grouping
                e.preventDefault();
                toggleSelect(ext.id, iconContainer);
            } else {
                // Normal click: Toggle extension enable/disable
                vscode.postMessage({ command: 'toggleExtension', id: ext.id });
            }
        });
        
        iconContainer.appendChild(icon);
        container.appendChild(iconContainer);
    });
}

function toggleSelect(id, container) {
    const idx = selectedExtensions.indexOf(id);
    if (idx > -1) {
        selectedExtensions.splice(idx, 1);
        container.classList.remove('selected');
    } else {
        selectedExtensions.push(id);
        container.classList.add('selected');
    }
    console.log('Selected extensions:', selectedExtensions);
}

function clearSelections() {
    selectedExtensions = [];
    document.querySelectorAll('.extension-icon-container.selected').forEach(container => {
        container.classList.remove('selected');
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