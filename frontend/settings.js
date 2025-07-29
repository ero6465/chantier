// import config from './config.js';
import { exportData } from './app.js';

// Define API_URL and showSyncStatus
const API_URL = 'http://127.0.0.1:5000/api';

// Define listViewType
let listViewType = 'list';

function showSyncStatus(message, syncing, type = 'info') {
    const syncStatusElement = document.getElementById('sync-status');
    if (!syncStatusElement) return;

    syncStatusElement.textContent = message;
    syncStatusElement.className = `sync-status ${type}`;

    if (message) {
        syncStatusElement.classList.add('visible');
    } else {
        syncStatusElement.classList.remove('visible');
    }
}

// Initialize settings from localStorage or defaults
function initSettings() {
    // Load working hours object
    const savedWorkingHours = localStorage.getItem('workingHours');
    if (savedWorkingHours) {
        try {
            const parsedHours = JSON.parse(savedWorkingHours);
            // Update config, ensuring defaults if parts are missing
            window.config.workingHours.start = parsedHours.start || '08:00';
            window.config.workingHours.end = parsedHours.end || '17:00';
            window.config.workingHours.workDays = Array.isArray(parsedHours.workDays) ? parsedHours.workDays : [1, 2, 3, 4, 5];
        } catch (error) {
            console.error('Error parsing workingHours:', error);
            // Reset to defaults if parsing fails
            window.config.workingHours = { start: '08:00', end: '17:00', workDays: [1, 2, 3, 4, 5] };
        }
    } // If not found in localStorage, defaults from config.js are used
    
    // Load assignees (remains the same)
    if (localStorage.getItem('assignees')) {
        try {
            // Make sure config.assignees is updated correctly
            const savedAssignees = JSON.parse(localStorage.getItem('assignees'));
            if (Array.isArray(savedAssignees)) {
                window.config.assignees = savedAssignees;
            }
        } catch (error) {
            console.error('Error parsing assignees:', error);
            // Use default assignees from config if parsing fails
            // (Assuming config.js provides defaults)
        }
    }
}

// Save assignee with updated image
function updateAssigneeImage(assigneeId, imageData) {
    const assignee = window.config.assignees.find(a => a.id === assigneeId);
    if (assignee) {
        assignee.image = imageData;
        localStorage.setItem('assignees', JSON.stringify(window.config.assignees));
    }
}

// Update working hours settings
function updateWorkingHours(workingHours) {
    window.config.workingHours = { ...window.config.workingHours, ...workingHours };
    localStorage.setItem('workingHours', JSON.stringify(window.config.workingHours));
}

// Open settings modal
function openSettingsModal() {
    const settingsModal = document.getElementById('settings-modal');
    if (!settingsModal) return;
    
    // Fill form with current values
    document.getElementById('work-start-time').value = window.config.workingHours.start;
    document.getElementById('work-end-time').value = window.config.workingHours.end;
    
    // Set workday checkboxes
    const workDays = window.config.workingHours.workDays || [1, 2, 3, 4, 5];
    document.querySelectorAll('.workday-checkbox').forEach(checkbox => {
        checkbox.checked = workDays.includes(parseInt(checkbox.value));
    });
    
    // Initialize assignee image options
    populateAssigneeImages();
    
    // Add event listener for the clear media button
    const clearMediaBtn = document.getElementById('clear-media-btn');
    if (clearMediaBtn) {
        // Remove existing listeners to prevent duplicates
        const newBtn = clearMediaBtn.cloneNode(true);
        clearMediaBtn.parentNode.replaceChild(newBtn, clearMediaBtn);
        newBtn.addEventListener('click', handleClearMedia);
    }
    
    // Show the modal
    settingsModal.style.display = 'block';
}

// Close settings modal
function closeSettingsModal() {
    const settingsModal = document.getElementById('settings-modal');
    settingsModal.style.display = 'none';
}

// Save settings
function saveSettings() {
    // Save working hours
    const startTime = document.getElementById('work-start-time').value;
    const endTime = document.getElementById('work-end-time').value;
    const workDaysCheckboxes = document.querySelectorAll('.workday-checkbox:checked');
    const workDays = Array.from(workDaysCheckboxes).map(checkbox => parseInt(checkbox.value));
    
    // Call updateWorkingHours which saves working hours to localStorage
    updateWorkingHours({
        start: startTime,
        end: endTime,
        workDays
    });

    // --- Save Assignees to localStorage --- 
    try {
        // The config.assignees array was modified by image upload/remove handlers
        // Now we explicitly save its current state to localStorage
        localStorage.setItem('assignees', JSON.stringify(window.config.assignees));
        console.log('Assignee data saved to localStorage.');
    } catch (error) {
        console.error('Error saving assignee data to localStorage:', error);
        // Handle potential storage errors (e.g., quota exceeded)
        alert('Error saving assignee settings. Changes might not persist.');
    }
    
    closeSettingsModal();
}

// Ensure handleModalClose is available
function handleModalClose() {
    const modal = document.getElementById('chantier-modal');
    if (modal) {
        modal.style.display = 'none';
    }
}

// Define setListViewType
function setListViewType(type) {
    listViewType = type;
    renderChantierList();
}

// Function to handle clearing all media
async function handleClearMedia() {
    if (!confirm('Are you sure you want to clear all PDFs and images from all chantiers? This action cannot be undone.')) {
        return;
    }
    
    try {
        const response = await fetch(`${API_URL}/clear-media`, {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json'
            }
        });
        
        if (!response.ok) {
            const data = await response.json();
            throw new Error(data.error || 'Failed to clear media');
        }
        
        const result = await response.json();
        alert(`Successfully cleared media from ${result.modified_count} chantiers.`);
        
        // Refresh the data
        window.location.reload();
    } catch (error) {
        console.error('Error clearing media:', error);
        alert(`Error: ${error.message}`);
    }
}

// Populate assignee images in settings
function populateAssigneeImages() {
    const container = document.getElementById('assignee-images-container');
    if (!container) return;
    
    container.innerHTML = ''; // Clear previous entries
    
    window.config.assignees.forEach(assignee => {
        const assigneeContainer = document.createElement('div');
        assigneeContainer.className = 'assignee-setting';
        
        const nameLabel = document.createElement('div');
        nameLabel.className = 'assignee-name';
        nameLabel.textContent = assignee.name;
        
        // Image preview container
        const imageControlsContainer = document.createElement('div');
        imageControlsContainer.className = 'assignee-image-controls';
        
        const currentImage = document.createElement('div');
        currentImage.className = 'current-assignee-image';
        
        // Remove button (created later if image exists)
        let removeButton = null;
        
        if (assignee.image) {
            const img = document.createElement('img');
            img.src = assignee.image;
            img.alt = assignee.name;
            currentImage.appendChild(img);
            
            // Create remove button only if image exists
            removeButton = document.createElement('button');
            removeButton.textContent = 'Remove';
            removeButton.className = 'btn btn-small btn-danger assignee-remove-btn';
            removeButton.type = 'button';
            removeButton.addEventListener('click', () => handleRemoveAssigneeImage(assignee.name));
            
        } else {
            currentImage.textContent = 'No image set';
        }
        
        // Input for uploading a new image
        const imageUpload = document.createElement('input');
        imageUpload.type = 'file';
        imageUpload.className = 'assignee-image-upload';
        imageUpload.setAttribute('data-name', assignee.name);
        imageUpload.accept = 'image/*';
        imageUpload.addEventListener('change', (e) => {
            handleAssigneeImageUpload(e, assignee.name);
        });
        const imageUploadLabel = document.createElement('label');
        imageUploadLabel.className = 'btn btn-small';
        imageUploadLabel.textContent = assignee.image ? 'Change Image' : 'Upload Image';
        imageUploadLabel.appendChild(imageUpload);
        
        // Append elements
        assigneeContainer.appendChild(nameLabel);
        imageControlsContainer.appendChild(currentImage);
        imageControlsContainer.appendChild(imageUploadLabel);
        if (removeButton) {
            imageControlsContainer.appendChild(removeButton); // Add remove button if created
        }
        assigneeContainer.appendChild(imageControlsContainer);
        
        container.appendChild(assigneeContainer);
    });
}

// Handle assignee image upload
function handleAssigneeImageUpload(event, assigneeName) {
    const file = event.target.files[0];
    if (!file) return;
    
    const reader = new FileReader();
    reader.onload = function(e) {
        // Update assignee image in config
        const assigneeIndex = window.config.assignees.findIndex(a => a.name === assigneeName);
        if (assigneeIndex !== -1) {
            window.config.assignees[assigneeIndex].image = e.target.result;
        } else {
            // This case shouldn't happen if config.assignees is accurate
            console.warn('Assignee not found in config while uploading image:', assigneeName);
            // Optionally add if needed: config.assignees.push({ name: assigneeName, image: e.target.result });
        }
        
        // Refresh UI
        populateAssigneeImages();
        saveSettings(); // Save changes immediately
    };
    
    reader.readAsDataURL(file);
}

// Handle removing an assignee image
function handleRemoveAssigneeImage(assigneeName) {
    const assigneeIndex = window.config.assignees.findIndex(a => a.name === assigneeName);
    if (assigneeIndex !== -1) {
        window.config.assignees[assigneeIndex].image = null; // Set image to null
        populateAssigneeImages(); // Refresh the UI
        saveSettings(); // Save changes immediately
    }
}

export { initSettings, openSettingsModal, closeSettingsModal, saveSettings, handleClearMedia };