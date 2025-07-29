// Global state
let chantiers = [];
let currentDate = moment();
window.editingChantierId = null;
window.uploadedImages = [];
window.uploadedPdfs = [];
window.isEditingImage = false;
let draggedChantier = null;
let listViewType = 'list';
let showPastChantiers = false;
let hasUnsavedChanges = false;
let isSyncing = false;

// Import modules
import { toggleView, openAddChantierModal, openEditChantierModal, closeModal, toggleListView, navigateToAddress, populateParentChantierDropdown, loadParentChantierInfo } from './ui-controller.js';
import { initSettings, openSettingsModal, closeSettingsModal, saveSettings } from './settings.js';
import { initClock, stopClock } from './clock.js';
import { handlePdfUpload, createPdfFacture } from './pdf-handler.js';
import { initDrawingTools, handleImageUpload, addImageToPreview, createNewDrawing, showImagePreview, getImageThumbnail } from './image-handler.js';

// Change API URL to local backend
const API_URL = 'http://127.0.0.1:5000/api'; // Changed from PythonAnywhere

// Initialize
document.addEventListener('DOMContentLoaded', init);

async function init() {
    console.log("Initializing application...");
    showSyncStatus("Loading data from cloud...", true, 'info');
    try {
        const response = await fetch(`${API_URL}/chantiers`);
        if (!response.ok) {
            throw new Error(`HTTP error! status: ${response.status}`);
        }
        const backendChantiers = await response.json();
        
        // Ensure chantiers is an array and handle potential null/undefined
        chantiers = Array.isArray(backendChantiers) ? backendChantiers : [];
        
        // Update localStorage as backup
        localStorage.setItem('chantiers', JSON.stringify(chantiers));
        
        console.log("Data loaded successfully:", chantiers);
        showSyncStatus("Data loaded.", false, 'success');
        setTimeout(() => showSyncStatus("", false), 2000);

    } catch (error) {
        console.error('Error loading data from backend:', error);
        showSyncStatus(`Error loading data: ${error.message}`, false, 'error');
        // Fallback to localStorage
        chantiers = JSON.parse(localStorage.getItem('chantiers')) || [];
    }

    // Initialize settings
    initSettings();

    // Initialize clock
    initClock();

    initDrawingTools();

    renderCalendar();
    renderChantierList();
    setupEventListeners();
    setupDragAndDrop();

    // Force re-initialize drag-drop on any DOM changes
    const observer = new MutationObserver(() => {
        setupDragAndDrop();
    });

    if (document.getElementById('chantier-list')) {
        observer.observe(document.getElementById('chantier-list'), {
            childList: true,
            subtree: true
        });
    }

    console.log("Initialization complete.");
}

// Event Listeners
function setupEventListeners() {
    // View toggling
    const calendarViewBtn = document.getElementById('calendar-view-btn');
    if (calendarViewBtn) {
        calendarViewBtn.addEventListener('click', () => {
            toggleView('calendar');
        });
    }
    
    // Calendar navigation
    const prevMonthBtn = document.getElementById('prev-month');
    const nextMonthBtn = document.getElementById('next-month');
    
    if (prevMonthBtn) {
        prevMonthBtn.addEventListener('click', () => {
            currentDate = currentDate.subtract(1, 'month');
            renderCalendar();
        });
    }
    
    if (nextMonthBtn) {
        nextMonthBtn.addEventListener('click', () => {
            currentDate = currentDate.add(1, 'month');
            renderCalendar();
        });
    }
    
    // Arrow indicator for list view
    const arrowIndicator = document.getElementById('arrow-indicator');
    if (arrowIndicator) {
        arrowIndicator.addEventListener('click', toggleListView);
    }
    
    // Modal actions
    const addChantierBtn = document.getElementById('add-chantier-btn');
    const addListChantierBtn = document.getElementById('add-list-chantier-btn');
    const closeModalBtn = document.querySelector('.close');
    const chantierModal = document.getElementById('chantier-modal');
    
    if (addChantierBtn) {
        addChantierBtn.addEventListener('click', () => {
            openAddChantierModal();
        });
    }
    
    if (addListChantierBtn) {
        addListChantierBtn.addEventListener('click', () => {
            openAddChantierModal();
        });
    }
    
    if (closeModalBtn) {
        closeModalBtn.addEventListener('click', () => closeModal(false));
    }
    
    // Close modal when clicking outside
    window.addEventListener('click', (e) => {
        if (e.target === chantierModal) {
            closeModal(false);
        }
        
        const settingsModal = document.getElementById('settings-modal');
        if (e.target === settingsModal) {
            closeSettingsModal();
        }
    });
    
    // Form submission
    const chantierForm = document.getElementById('chantier-form');
    if (chantierForm) {
        chantierForm.addEventListener('submit', handleChantierFormSubmit);
    }
    
    // Delete button
    const deleteChantierBtn = document.getElementById('delete-chantier');
    if (deleteChantierBtn) {
        deleteChantierBtn.addEventListener('click', handleDeleteChantier);
    }
    
    // List filters
    const filterStatus = document.getElementById('filter-status');
    const searchChantier = document.getElementById('search-chantier');
    
    if (filterStatus) {
        filterStatus.addEventListener('change', renderChantierList);
    }
    
    if (searchChantier) {
        searchChantier.addEventListener('input', renderChantierList);
    }
    
    // Image upload
    const imageInput = document.getElementById('chantier-images');
    if (imageInput) {
        imageInput.addEventListener('change', handleImageUpload);
    }

    // Add new drawing button
    const addDrawingBtn = document.createElement('button');
    addDrawingBtn.type = 'button';
    addDrawingBtn.className = 'btn';
    addDrawingBtn.textContent = 'Create New Drawing';
    addDrawingBtn.addEventListener('click', createNewDrawing);
    
    if (document.getElementById('chantier-photos')) {
        const imageUploadGroup = document.getElementById('chantier-images').parentElement;
        imageUploadGroup.appendChild(addDrawingBtn);
    }
    
    // PDF upload
    const pdfInput = document.getElementById('chantier-pdfs');
    if (pdfInput) {
        pdfInput.addEventListener('change', handlePdfUpload);
    }
    
    // Form tabs
    const formTabs = document.querySelectorAll('.form-tab');
    const formPanels = document.querySelectorAll('.form-panel');
    
    if (formTabs) {
        formTabs.forEach(tab => {
            tab.addEventListener('click', () => {
                formTabs.forEach(t => t.classList.remove('active'));
                formPanels.forEach(p => p.classList.remove('active'));
                
                tab.classList.add('active');
                const panelId = tab.getAttribute('data-panel');
                document.getElementById(panelId).classList.add('active');
            });
        });
    }
    
    // Toggle list/grid view
    const listViewTypeBtn = document.getElementById('list-view-type-btn');
    const gridViewTypeBtn = document.getElementById('grid-view-type-btn');
    
    if (listViewTypeBtn) {
        listViewTypeBtn.addEventListener('click', () => {
            setListViewType('list');
        });
    }
    
    if (gridViewTypeBtn) {
        gridViewTypeBtn.addEventListener('click', () => {
            setListViewType('grid');
        });
    }
    
    // Show/hide past chantiers
    const showPastChantiersBtn = document.getElementById('show-past-chantiers');
    if (showPastChantiersBtn) {
        showPastChantiersBtn.addEventListener('click', () => {
            showPastChantiers = !showPastChantiers;
            showPastChantiersBtn.textContent = showPastChantiers ? 'Hide Past Chantiers' : 'Show Past Chantiers';
            renderChantierList();
        });
    }
    
    // Settings button
    const settingsBtn = document.getElementById('settings-btn');
    if (settingsBtn) {
        settingsBtn.addEventListener('click', openSettingsModal);
    }
    
    // Save settings button
    const saveSettingsBtn = document.getElementById('save-settings');
    if (saveSettingsBtn) {
        saveSettingsBtn.addEventListener('click', saveSettings);
    }
    
    // Close settings button
    const closeSettingsBtn = document.getElementById('close-settings');
    if (closeSettingsBtn) {
        closeSettingsBtn.addEventListener('click', closeSettingsModal);
    }
    
    // Create facture button (updated)
    const createFactureBtn = document.getElementById('create-facture');
    if (createFactureBtn) {
        createFactureBtn.addEventListener('click', async () => {
            try {
                showSyncStatus("Opening invoice tool...", true, 'info');
                const response = await fetch(`${API_URL}/open-invoice`);
                if (!response.ok) {
                    const data = await response.json();
                    throw new Error(data.error || 'Failed to open invoice tool');
                }
                showSyncStatus("Invoice tool opened", false, 'success');
                setTimeout(() => showSyncStatus("", false), 2000);
            } catch (error) {
                console.error('Error opening invoice tool:', error);
                showSyncStatus(`Error: ${error.message}`, false, 'error');
                // Fallback to direct open if backend fails
                window.open('INVOICE_DSMETAL/index.html', '_blank');
            }
        });
    }

    // Send Gmail button
    const sendGmailBtn = document.getElementById('send-gmail-btn');
    if (sendGmailBtn) {
        sendGmailBtn.addEventListener('click', handleSendGmail);
    }

    // Add global keyboard shortcuts
    window.addEventListener('keydown', handleGlobalKeyDown);
}

// Global Keydown Handler
function handleGlobalKeyDown(e) {
    // Ignore keypresses if focused on an input, textarea, or select
    const activeElement = document.activeElement;
    const isInputFocused = activeElement && (activeElement.tagName === 'INPUT' || activeElement.tagName === 'TEXTAREA' || activeElement.tagName === 'SELECT');
    
    if (isInputFocused && e.key !== 'Escape') { // Allow Escape even when focused
        return; 
    }

    switch (e.key) {
        case 'n':
        case 'N': // Handle uppercase N too
            e.preventDefault(); // Prevent default browser behavior (if any)
            // Check which view is active
            const calendarView = document.getElementById('calendar-view');
            if (calendarView && calendarView.classList.contains('active')) {
                // If Calendar is active, toggle the list sidebar
                toggleListView(); 
            } else {
                // Otherwise (likely List/Grid view is active), toggle between list and grid
                const listViewButton = document.getElementById('list-view-type-btn');
                const gridViewButton = document.getElementById('grid-view-type-btn');
                if (listViewType === 'list') {
                    if(gridViewButton) gridViewButton.click();
                } else {
                    if(listViewButton) listViewButton.click();
                }
            }
            break;

        case 'Escape':
            // Close open modals (order might matter if both could be open)
            const settingsModal = document.getElementById('settings-modal');
            const chantierModal = document.getElementById('chantier-modal');
            if (settingsModal && settingsModal.style.display === 'block') {
                closeSettingsModal();
            } else if (chantierModal && chantierModal.style.display === 'block') {
                closeModal(false); // Use closeModal with check for unsaved changes
            }
            break;
        
        // Add other global shortcuts here if needed
    }
}

// Drag and Drop
function setupDragAndDrop() {
    // Make list items draggable
    document.addEventListener('dragstart', handleDragStart);
    document.addEventListener('dragend', handleDragEnd);
    
    // Make calendar items draggable
    const calendarItems = document.querySelectorAll('.chantier-item');
    calendarItems.forEach(item => {
        item.setAttribute('draggable', true);
    });
    
    // Set up calendar day drop zones
    const calendarDaysEl = document.getElementById('calendar-days');
    if (calendarDaysEl) {
        calendarDaysEl.addEventListener('dragover', handleDragOver);
        calendarDaysEl.addEventListener('dragleave', handleDragLeave);
        calendarDaysEl.addEventListener('drop', handleDrop);
    }
}

function handleDragStart(e) {
    // Handle drag from list view
    if (e.target.closest('.list-item')) {
        const chantierId = e.target.closest('.list-item').getAttribute('data-id');
        draggedChantier = chantiers.find(c => c.id === chantierId);
        e.dataTransfer.setData('text/plain', chantierId);
        e.target.classList.add('dragging');
        return;
    }
    
    // Handle drag from grid view
    if (e.target.closest('.grid-item')) {
        const chantierId = e.target.closest('.grid-item').getAttribute('data-id');
        draggedChantier = chantiers.find(c => c.id === chantierId);
        e.dataTransfer.setData('text/plain', chantierId);
        e.target.classList.add('dragging');
        return;
    }
    
    // Handle drag from calendar
    if (e.target.closest('.chantier-item')) {
        const chantierId = e.target.closest('.chantier-item').getAttribute('data-id');
        draggedChantier = chantiers.find(c => c.id === chantierId);
        e.dataTransfer.setData('text/plain', chantierId);
        e.target.classList.add('dragging');
    }
}

function handleDragEnd(e) {
    if (!e.target.classList.contains('list-item') && !e.target.classList.contains('grid-item') && !e.target.classList.contains('chantier-item')) return;
    
    e.target.classList.remove('dragging');
    draggedChantier = null;
    
    // Remove any placeholders
    document.querySelectorAll('.drag-placeholder').forEach(el => el.remove());
}

function handleDragOver(e) {
    e.preventDefault();
    const dayEl = e.target.closest('.calendar-day');
    if (!dayEl || !draggedChantier) return;
    
    // Add placeholder if not already present
    if (!dayEl.querySelector('.drag-placeholder')) {
        const placeholder = document.createElement('div');
        placeholder.className = 'drag-placeholder';
        dayEl.appendChild(placeholder);
    }
}

function handleDragLeave(e) {
    const dayEl = e.target.closest('.calendar-day');
    if (!dayEl) return;
    
    // Only remove if we're actually leaving the day element
    const relatedTarget = e.relatedTarget;
    if (!dayEl.contains(relatedTarget)) {
        const placeholder = dayEl.querySelector('.drag-placeholder');
        if (placeholder) placeholder.remove();
    }
}

function handleDrop(e) {
    e.preventDefault();
    const dayEl = e.target.closest('.calendar-day');
    if (!dayEl || !draggedChantier) return;
    
    // Remove placeholder
    const placeholder = dayEl.querySelector('.drag-placeholder');
    if (placeholder) placeholder.remove();
    
    // Get the date of the day we're dropping onto
    const newStartDateStr = dayEl.getAttribute('data-date');
    
    // Calculate duration of the original chantier
    const originalStartDate = moment(draggedChantier.startDate);
    const originalEndDate = moment(draggedChantier.endDate);
    
    let duration = 0; // Default duration is 0 days (single day event)
    if (originalStartDate.isValid() && originalEndDate.isValid()) {
        duration = originalEndDate.diff(originalStartDate, 'days');
        // Ensure duration is at least 0
        if (duration < 0) duration = 0;
    }
    
    // Calculate new end date
    const newStartDate = moment(newStartDateStr);
    const newEndDate = newStartDate.clone().add(duration, 'days');
    
    // Prepare updated data
    const updatedChantierData = {
            ...draggedChantier,
        startDate: newStartDate.format('YYYY-MM-DD'),
        endDate: newEndDate.format('YYYY-MM-DD')
    };

    // Update the local chantiers array immediately for UI responsiveness
    const chantierIndex = chantiers.findIndex(c => c.id === draggedChantier.id);
    if (chantierIndex !== -1) {
        chantiers[chantierIndex] = updatedChantierData;
        // Re-render the calendar and list to reflect the change
        renderCalendar();
        renderChantierList();
    }

    // Trigger save to backend
    saveChantierUpdate(draggedChantier.id, { 
        startDate: updatedChantierData.startDate, 
        endDate: updatedChantierData.endDate 
    });
}

// Helper function to save a single chantier update to the backend
async function saveChantierUpdate(chantierId, updateData) {
    showSyncStatus("Updating chantier...", true, 'info');
    try {
        // Ensure images/pdfs are stringified if present in updateData (though unlikely for date changes)
        const preparedData = { ...updateData };
        if ('images' in preparedData && Array.isArray(preparedData.images)) {
            preparedData.images = JSON.stringify(preparedData.images);
        }
        if ('pdfs' in preparedData && Array.isArray(preparedData.pdfs)) {
            preparedData.pdfs = JSON.stringify(preparedData.pdfs);
        }

        const response = await fetch(`${API_URL}/chantiers/${chantierId}`, {
            method: 'PUT',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify(preparedData)
        });

        if (!response.ok) {
            const errorData = await response.json();
            throw new Error(errorData.error || `HTTP error: ${response.status}`);
        }

        const savedChantier = await response.json();
        
        // Update the specific chantier in the local array again with the full response
        const index = chantiers.findIndex(c => c.id === chantierId);
        if (index !== -1) {
            chantiers[index] = savedChantier;
            localStorage.setItem('chantiers', JSON.stringify(chantiers)); // Update backup
        }

        showSyncStatus("Chantier updated successfully!", false, 'success');
        setTimeout(() => showSyncStatus("", false), 2000);

    } catch (error) {
        console.error('Error updating chantier:', error);
        showSyncStatus(`Error updating chantier: ${error.message}`, false, 'error');
        // Optionally, revert the change in the UI or fetch fresh data
        // renderCalendar();
        // renderChantierList();
        setTimeout(() => showSyncStatus("", false), 5000);
    }
}

// Calendar functions
function renderCalendar() {
    const currentMonthEl = document.getElementById('current-month');
    const calendarDaysEl = document.getElementById('calendar-days');
    
    currentMonthEl.textContent = currentDate.format('MMMM YYYY');
    
    // Clear the calendar
    calendarDaysEl.innerHTML = '';
    
    // Get start and end dates
    const firstDay = moment(currentDate).startOf('month');
    const startDate = moment(firstDay).startOf('week').day(1); // Start from Monday
    if (startDate.isAfter(firstDay)) {
        startDate.subtract(7, 'days');
    }
    
    const endDate = moment(firstDay).endOf('month').endOf('week');
    
    // Generate calendar days
    let date = moment(startDate);
    
    while (date.isSameOrBefore(endDate)) {
        const isCurrentMonth = date.month() === currentDate.month();
        const isToday = date.isSame(moment(), 'day');
        
        const dayEl = document.createElement('div');
        dayEl.className = `calendar-day${isCurrentMonth ? '' : ' other-month'}${isToday ? ' today' : ''}`;
        dayEl.setAttribute('data-date', date.format('YYYY-MM-DD'));
        // Add tooltip to the day itself for drag-and-drop hint
        dayEl.title = "Glisser-déposer un chantier ici pour changer sa date";

        // Add blue border for current day
        if (isToday) {
            dayEl.style.border = '2px solid #007bff';
            dayEl.style.borderRadius = '4px';
        }
        
        // Add day number
        const dayNumber = document.createElement('div');
        dayNumber.className = 'day-number';
        dayNumber.textContent = date.date();
        dayEl.appendChild(dayNumber);
        
        // Add event to allow adding chantier on this day
        dayEl.addEventListener('click', (e) => {
            if (e.target.closest('.chantier-item')) return; // Don't trigger if clicking on an existing chantier
            const selectedDate = e.currentTarget.getAttribute('data-date');
            handleDayClick(selectedDate);
        });
        
        // Add chantiers for this day
        const dayChantiers = getChantiersByDate(date.format('YYYY-MM-DD'));
        dayChantiers.forEach(chantier => {
            const chantierEl = document.createElement('div');
            // Add description to title attribute for hover tooltip (updated default text)
            const description = chantier.description ? chantier.description.substring(0, 100) + (chantier.description.length > 100 ? '...' : '') : 'Pas de description';
            chantierEl.title = `${chantier.title}\n${description}`;
            chantierEl.className = `chantier-item${chantier.status === 'completed' ? ' completed' : ''}`;
            chantierEl.textContent = chantier.title;
            chantierEl.setAttribute('draggable', true);
            chantierEl.setAttribute('data-id', chantier.id);
            chantierEl.addEventListener('click', (e) => {
                e.stopPropagation();
                openEditChantierModal(chantier.id);
            });

            // Apply urgency class for border color
            const urgency = chantier.urgency || 'medium'; // Default to medium if undefined
            const urgencyClass = `urgency-border-${urgency}`;
            chantierEl.classList.add('chantier-item', urgencyClass);

            dayEl.appendChild(chantierEl);
        });
        
        calendarDaysEl.appendChild(dayEl);
        date.add(1, 'day');
    }
}

function getChantiersByDate(dateStr) {
    return chantiers.filter(chantier => {
        const startDate = moment(chantier.startDate);
        const endDate = moment(chantier.endDate);
        const checkDate = moment(dateStr);
        
        return checkDate.isBetween(startDate, endDate, null, '[]');
    });
}

// Set list view type (list or grid)
function setListViewType(type) {
    listViewType = type;
    
    // Update active button
    if (type === 'list') {
        document.getElementById('list-view-type-btn').classList.add('active');
        document.getElementById('grid-view-type-btn').classList.remove('active');
        document.getElementById('chantier-list').className = 'chantier-list list-view-container';
    } else {
        document.getElementById('grid-view-type-btn').classList.add('active');
        document.getElementById('list-view-type-btn').classList.remove('active');
        document.getElementById('chantier-list').className = 'chantier-list grid-view-container';
    }
    
    renderChantierList();
}

// List functions
function renderChantierList() {
    const statusFilter = document.getElementById('filter-status').value;
    const searchQuery = document.getElementById('search-chantier').value.toLowerCase();
    const today = moment().startOf('day');
    
    // Filter chantiers
    let filteredChantiers = chantiers;
    
    if (statusFilter !== 'all') {
        filteredChantiers = filteredChantiers.filter(chantier => chantier.status === statusFilter);
    }
    
    // Filter past chantiers if not showing them
    if (!showPastChantiers) {
        filteredChantiers = filteredChantiers.filter(chantier => {
            const endDate = moment(chantier.endDate);
            return endDate.isSameOrAfter(today);
        });
    }
    
    if (searchQuery) {
        // First, find all chantiers that match the search
        const matchingChantiers = filteredChantiers.filter(chantier => 
            chantier.title.toLowerCase().includes(searchQuery) || 
            chantier.description.toLowerCase().includes(searchQuery)
        );
        
        // Create a set of all IDs that should be included
        const idsToInclude = new Set();
        
        // Add all matching chantiers and their related chantiers
        matchingChantiers.forEach(chantier => {
            // Add the matching chantier
            idsToInclude.add(chantier.id);
            
            if (!chantier.parent_chantier_id) {
                // If it's a parent, add all its children
                const children = chantiers.filter(c => c.parent_chantier_id === chantier.id);
                children.forEach(child => idsToInclude.add(child.id));
            } else {
                // If it's a child, add its parent and all siblings
                const parent = chantiers.find(c => c.id === chantier.parent_chantier_id);
                if (parent) {
                    idsToInclude.add(parent.id);
                    const siblings = chantiers.filter(c => c.parent_chantier_id === parent.id);
                    siblings.forEach(sibling => idsToInclude.add(sibling.id));
                }
            }
        });
        
        // Filter chantiers to only include those in our set
        filteredChantiers = filteredChantiers.filter(chantier => idsToInclude.has(chantier.id));
    }
    
    // Sort chantiers by start date (most recent first)
    filteredChantiers.sort((a, b) => moment(b.startDate) - moment(a.startDate));
    
    // Clear the list
    document.getElementById('chantier-list').innerHTML = '';
    
    // Render based on view type
    if (listViewType === 'list') {
        renderListView(filteredChantiers);
    } else {
        renderGridView(filteredChantiers);
    }
    
    // Show empty message if no chantiers
    if (filteredChantiers.length === 0) {
        document.getElementById('chantier-list').innerHTML = '<div class="list-empty">No chantiers found</div>';
    }
}

// Function to organize chantiers by parent-child relationships
function organizeChantiersByParent(chantiers) {
    const parentMap = new Map();
    const rootChantiers = [];

    // First pass: Create a map of parent IDs to their children
    chantiers.forEach(chantier => {
        if (chantier.parentChantierId) {
            if (!parentMap.has(chantier.parentChantierId)) {
                parentMap.set(chantier.parentChantierId, []);
            }
            parentMap.get(chantier.parentChantierId).push(chantier);
        } else {
            rootChantiers.push(chantier);
        }
    });

    // Sort root chantiers by start date
    rootChantiers.sort((a, b) => moment(a.startDate) - moment(b.startDate));

    // Sort children for each parent
    parentMap.forEach(children => {
        children.sort((a, b) => moment(a.startDate) - moment(b.startDate));
    });

    return { rootChantiers, parentMap };
}

// Helper function to create a chantier list item
function createChantierListItem(chantier, isParent, parentMap) {
        const listItem = document.createElement('div');
    const urgency = chantier.urgency || 'medium'; // Default to medium
    const urgencyBorderClass = `urgency-border-${urgency}`;
    listItem.className = `list-item ${isParent ? 'parent-item' : 'child-item'} ${urgencyBorderClass}`;
        listItem.setAttribute('draggable', true);
        listItem.setAttribute('data-id', chantier.id);
        
    // For child items, only show the title
    if (!isParent) {
        listItem.innerHTML = `
            <div class="list-item-info">
                <div class="list-item-title">${chantier.title}</div>
            </div>
            <div class="list-item-actions">
                <button class="edit-btn" data-id="${chantier.id}" title="Modifier ce chantier">
                    <i class="fas fa-edit"></i>
                </button>
            </div>
        `;
    } else {
        // For parent items, show full details
        let listItemDateRange = 'Invalid date range'; // Default message for invalid dates
        const dateRange = `${moment(chantier.startDate).format('MMM D, YYYY')} - ${moment(chantier.endDate).format('MMM D, YYYY')}`;
        const assignees = chantier.assignees ? chantier.assignees.join(', ') : 'None';
        
        // Create image element if chantier has images
        let imageHtml = '';
        if (chantier.images && chantier.images.length > 0) {
            const imageSrc = getImageThumbnail(chantier.images);
            if (imageSrc) {
                imageHtml = `<img src="${imageSrc}" class="list-item-image" alt="Chantier">`;
            }
        }
        
        // Add address and navigation buttons if address exists
        let addressHtml = '';
        if (chantier.address) {
            const encodedAddress = encodeURIComponent(chantier.address);
            const mapsUrl = `https://www.google.com/maps/search/?api=1&query=${encodedAddress}`;
            addressHtml = `
                <div class="list-item-address">
                    <a href="${mapsUrl}" target="_blank" title="Ouvrir dans Google Maps">
                        <i class="fas fa-map-marked-alt"></i> ${chantier.address}
                    </a>
                    <button class="navigate-btn" 
                            onclick="event.stopPropagation(); navigateToAddress('${chantier.address.replace(/'/g, "\\'")}', this)" 
                            title="Copier le lien Waze">
                        <i class="fas fa-copy"></i> Waze
                    </button>
                </div>
            `;
        }
        
        // Get children for this parent
        const children = parentMap.get(chantier.id) || [];
        let childrenHtml = '';
        if (children.length > 0) {
            childrenHtml = `
                <div class="sub-chantiers">
                    <div class="sub-chantiers-title">Sous-chantiers:</div>
                    ${children.map(child => {
                        const childUrgency = child.urgency || 'medium';
                        const childUrgencyClass = `urgency-border-${childUrgency}`;
                        return `
                            <div class="sub-chantier ${childUrgencyClass}" data-id="${child.id}">
                                <div class="sub-chantier-title">${child.title}</div>
                                <button class="edit-btn" data-id="${child.id}" title="Modifier ce sous-chantier">
                                    <i class="fas fa-edit"></i>
                                </button>
                            </div>
                        `;
                    }).join('')}
                </div>
            `;
        }
        
        // Format date display, check for validity
        const mStartDate = moment(chantier.startDate);
        const mEndDate = moment(chantier.endDate);
        if (mStartDate.isValid() && mEndDate.isValid()) {
            listItemDateRange = `${mStartDate.format('MMM D, YYYY')} - ${mEndDate.format('MMM D, YYYY')}`;
        } else if (mStartDate.isValid()) {
            // If only start date is valid, show only that
            listItemDateRange = `Starts: ${mStartDate.format('MMM D, YYYY')}`;
        } else if (mEndDate.isValid()) {
             // If only end date is valid, show only that
            listItemDateRange = `Ends: ${mEndDate.format('MMM D, YYYY')}`;
        }
        
        listItem.innerHTML = `
            ${imageHtml}
            <div class="list-item-info">
                <div class="list-item-title">${chantier.title} ${chantier.estimatedDuration ? `(${chantier.estimatedDuration} days)` : ''}</div>
                <div class="list-item-dates">${listItemDateRange}</div>
                <div class="list-item-assignees">Assignees: ${assignees}</div>
                ${addressHtml}
                <div class="list-item-description">${chantier.description}</div>
                ${childrenHtml}
            </div>
            <div class="list-item-actions">
                <div class="status-badge ${chantier.status}">${chantier.status === 'ongoing' ? 'En cours' : 'Facture envoyé'}</div>
                <button class="edit-btn" data-id="${chantier.id}" title="Modifier ce chantier">
                    <i class="fas fa-edit"></i>
                </button>
            </div>
        `;
    }
    
    // Add event listeners (ensure sub-chantier edit buttons work)
    const editBtns = listItem.querySelectorAll('.edit-btn');
    editBtns.forEach(btn => {
        btn.addEventListener('click', (e) => {
            e.stopPropagation(); // Prevent event from bubbling up
            const chantierId = btn.getAttribute('data-id');
            openEditChantierModal(chantierId);
        });
    });
    
    // Make the whole item clickable for editing (only for parent items)
    if (isParent) {
        listItem.addEventListener('click', (e) => {
            // Only trigger if we didn't click on a sub-chantier or its edit button
            if (!e.target.closest('.sub-chantier') && !e.target.closest('.edit-btn')) {
            openEditChantierModal(chantier.id);
            }
        });
    }
    
    return listItem;
}

// Update renderListView function
function renderListView(filteredChantiers) {
    const chantierList = document.getElementById('chantier-list');
    chantierList.innerHTML = '';

    // Organize chantiers by parent-child relationships
    const { rootChantiers, parentMap } = organizeChantiersByParent(filteredChantiers);

    // Render each root chantier and its children
    rootChantiers.forEach(chantier => {
        // Create parent chantier item
        const parentItem = createChantierListItem(chantier, true, parentMap);
        chantierList.appendChild(parentItem);
    });

    // Show empty message if no chantiers
    if (filteredChantiers.length === 0) {
        chantierList.innerHTML = '<div class="list-empty">No chantiers found</div>';
    }
}

function renderGridView(filteredChantiers) {
    const chantierList = document.getElementById('chantier-list');
    chantierList.innerHTML = '';
    
    // Organize chantiers by parent-child relationships
    const { rootChantiers, parentMap } = organizeChantiersByParent(filteredChantiers);
    
    // Render each root chantier and its children
    rootChantiers.forEach(chantier => {
        // Create parent chantier item
        const parentItem = document.createElement('div');
        parentItem.className = 'grid-item parent-item';
        parentItem.setAttribute('draggable', true);
        parentItem.setAttribute('data-id', chantier.id);
        
        const dateRange = `${moment(chantier.startDate).format('MMM D')} - ${moment(chantier.endDate).format('MMM D')}`;
        
        // Create image element if chantier has images
        let imageHtml = '';
        if (chantier.images && chantier.images.length > 0) {
            const imageSrc = getImageThumbnail(chantier.images);
            if (imageSrc) {
                imageHtml = `<img src="${imageSrc}" class="grid-item-image" alt="Chantier image">`;
            }
        }
        
        // Add address if exists
        let addressHtml = '';
        if (chantier.address) {
            addressHtml = `
                <div class="grid-item-address">
                    <i class="fas fa-map-marker-alt"></i> ${chantier.address.substring(0, 20)}...
                    <button class="navigate-btn small" onclick="event.stopPropagation(); navigateToAddress('${chantier.address.replace(/'/g, "\\'")}')">
                        <i class="fas fa-location-arrow"></i>
                    </button>
                </div>
            `;
        }
        
        // Get children for this parent
        const children = parentMap.get(chantier.id) || [];
        let childrenHtml = '';
        if (children.length > 0) {
            childrenHtml = `
                <div class="sub-chantiers">
                    <div class="sub-chantiers-title">Sous-chantiers:</div>
                    ${children.map(child => `
                        <div class="sub-chantier">
                            <div class="sub-chantier-title">${child.title}</div>
                            <button class="edit-btn" data-id="${child.id}" title="Modifier ce sous-chantier">
                                <i class="fas fa-edit"></i>
                            </button>
                        </div>
                    `).join('')}
                </div>
            `;
        }
        
        // Format date display, check for validity
        let gridItemDateRange = 'Invalid date range'; // Default message for invalid dates
        const mStartDate = moment(chantier.startDate);
        const mEndDate = moment(chantier.endDate);
        if (mStartDate.isValid() && mEndDate.isValid()) {
            gridItemDateRange = `${mStartDate.format('MMM D')} - ${mEndDate.format('MMM D')}`;
        } else if (mStartDate.isValid()) {
            gridItemDateRange = `Starts: ${mStartDate.format('MMM D')}`;
        } else if (mEndDate.isValid()) {
            gridItemDateRange = `Ends: ${mEndDate.format('MMM D')}`;
        }

        parentItem.innerHTML = `
            ${imageHtml}
            <div class="status-badge ${chantier.status}">${chantier.status === 'ongoing' ? 'En cours' : 'Facture envoyé'}</div>
            <div class="grid-item-title">${chantier.title}</div>
            <div class="grid-item-dates">${gridItemDateRange}</div>
            <div class="grid-item-assignees">${chantier.assignees ? chantier.assignees.join(', ') : ''}</div>
            ${addressHtml}
            ${childrenHtml}
        `;
        
        parentItem.addEventListener('click', () => {
            openEditChantierModal(chantier.id);
        });
        
        chantierList.appendChild(parentItem);
    });
    
    // Show empty message if no chantiers
    if (filteredChantiers.length === 0) {
        chantierList.innerHTML = '<div class="list-empty">No chantiers found</div>';
    }
}

// Form handling
async function handleChantierFormSubmit(e) {
    e.preventDefault();
    showSyncStatus("Saving chantier...", true, 'info');

    // Basic validation
    const title = document.getElementById('chantier-title').value;
    const startDate = document.getElementById('chantier-start-date').value;
    const endDate = document.getElementById('chantier-end-date').value;

    if (!title || !startDate || !endDate) {
        showSyncStatus("Error: Title, Start Date, and End Date are required.", false, 'error');
        setTimeout(() => showSyncStatus("", false), 3000);
        return;
    }

    // Collect assignees from checkboxes
    const assigneeCheckboxes = document.querySelectorAll('.assignee-checkbox');
    const selectedAssignees = Array.from(assigneeCheckboxes)
        .filter(checkbox => checkbox.checked)
        .map(checkbox => checkbox.value);

    // Get parent chantier
    const parentChantierId = document.getElementById('parent-chantier').value;

    // Ensure images and pdfs are properly stringified
    const imgArray = window.uploadedImages || [];
    const pdfArray = window.uploadedPdfs || [];

    // Gather data from form
    const chantierData = {
        title: title,
        description: document.getElementById('chantier-description').value,
        startDate: startDate,
        endDate: endDate,
        status: document.getElementById('chantier-status').value,
        estimatedDuration: parseInt(document.getElementById('chantier-estimated-duration').value) || null,
        urgency: document.getElementById('chantier-urgency').value,
        address: document.getElementById('chantier-address').value,
        contactPhone: document.getElementById('chantier-contact-phone').value,
        contactEmail: document.getElementById('chantier-contact-email').value,
        assignees: selectedAssignees,
        devis: document.getElementById('chantier-devis').value,
        images: JSON.stringify(imgArray),
        pdfs: JSON.stringify(pdfArray),
        parentChantierId: parentChantierId || null
    };

    const method = window.editingChantierId ? 'PUT' : 'POST';
    const url = window.editingChantierId
        ? `${API_URL}/chantiers/${window.editingChantierId}`
        : `${API_URL}/chantiers`;

    try {
        const response = await fetch(url, {
            method: method,
            headers: {
                'Content-Type': 'application/json',
            },
            body: JSON.stringify(chantierData),
        });

        if (!response.ok) {
            const errorData = await response.json();
            throw new Error(`HTTP error! status: ${response.status} - ${errorData.error || 'Unknown error'}`);
        }

        const savedChantier = await response.json(); // Backend should return the saved/updated chantier

        if (method === 'PUT') {
            // Update the existing chantier in the local array
            const index = chantiers.findIndex(c => c.id === window.editingChantierId);
            if (index !== -1) {
                chantiers[index] = savedChantier;
            }
        } else {
            // Add the new chantier to the local array
            chantiers.push(savedChantier);
        }

        // Update localStorage as a backup *after* successful API call
        localStorage.setItem('chantiers', JSON.stringify(chantiers));

        showSyncStatus("Chantier saved successfully!", false, 'success');
        // Force close without prompt after successful save
        closeModal(true); 
        renderCalendar();
        renderChantierList();
        setTimeout(() => showSyncStatus("", false), 2000); // Clear status

    } catch (error) {
        console.error('Error saving chantier:', error);
        showSyncStatus(`Error saving chantier: ${error.message}`, false, 'error');
        // Don't close modal on error
    }
}

async function handleDeleteChantier() {
    // Check if we're editing an existing chantier
    if (!window.editingChantierId) {
        closeModal();
        return;
    }
    
    if (!confirm('Are you sure you want to delete this chantier? This cannot be undone.')) {
        return;
    }
    
    const chantierIdToDelete = window.editingChantierId;
    
    try {
        showSyncStatus("Deleting chantier...", true, 'info');
        
        // Send delete request to API
        const response = await fetch(`${API_URL}/chantiers/${chantierIdToDelete}`, {
            method: 'DELETE'
        });
        
        let deletionSuccessful = false;
        
        // Check response status
        if (response.ok) {
            const data = await response.json();
            console.log('Server delete successful:', data);
            deletionSuccessful = true;
            showSyncStatus("Chantier deleted successfully from server", false, 'success');
        } else if (response.status === 404) {
            console.warn(`Chantier ${chantierIdToDelete} not found on server. Assuming deleted.`);
            deletionSuccessful = true; // Treat as success for local removal
            showSyncStatus("Chantier not found on server, removed locally", false, 'warning');
        } else {
            // Handle other errors (e.g., 500)
                 const errorData = await response.json();
            throw new Error(errorData.error || `Server error: ${response.status}`);
        }
        
        // If deletion was successful (API or 404), update local state and UI
        if (deletionSuccessful) {
            // --- Update local state FIRST --- 
            chantiers = chantiers.filter(c => c.id !== chantierIdToDelete);
            
            // --- Then update localStorage --- 
            localStorage.setItem('chantiers', JSON.stringify(chantiers));

            // --- Then close modal and re-render --- 
            closeModal(true);
            renderChantierList();
            renderCalendar();
            
            // Clear status message after a delay
            setTimeout(() => showSyncStatus("", false), 2000);
        }

        } catch (error) {
            console.error('Error deleting chantier:', error);
        showSyncStatus(`Error deleting: ${error.message}`, false, 'error');
        // Don't close modal or update UI on error
        setTimeout(() => showSyncStatus("", false), 5000);
    }
}

// Utility functions
function initializeFormChangeTracking() {
    const form = document.getElementById('chantier-form');
    const formInputs = form.querySelectorAll('input, textarea, select');
    
    formInputs.forEach(input => {
        input.addEventListener('change', () => {
            hasUnsavedChanges = true;
        });
        input.addEventListener('input', () => {
            hasUnsavedChanges = true;
        });
    });
}

function resetUnsavedChangesFlag() {
    hasUnsavedChanges = false;
}

function handleModalClose(e) {
    if (e) e.preventDefault();
    closeModal(hasUnsavedChanges);
    resetUnsavedChangesFlag();
}

// Update the openModal function
function openModal(chantier = null) {
    const modal = document.getElementById('chantier-modal');
    const form = document.getElementById('chantier-form');
    const modalTitle = document.getElementById('modal-title');
    
    resetUnsavedChangesFlag();
    initializeFormChangeTracking();
    
    if (chantier) {
        modalTitle.textContent = 'Modifier le Chantier';
        populateForm(chantier);
    } else {
        modalTitle.textContent = 'Ajouter un Nouveau Chantier';
        form.reset();
    }
    
    modal.style.display = 'block';
}

// Handle calendar day clicks
function handleDayClick(date) {
    if (hasUnsavedChanges) {
        if (!confirm('Vous avez des modifications non enregistrées. Voulez-vous vraiment continuer ?')) {
            return;
        }
        resetUnsavedChangesFlag();
    }
    openAddChantierModal(date);
}

// Export to CSV function
function exportToCSV() {
    // This function needs the data passed to it.
    // We'll call it from the new exportData function.
    if (!chantiers || chantiers.length === 0) {
        alert("No data available to export.");
        return;
    }
    console.log("Exporting data:", chantiers); // Debug log

    const dataToExport = chantiers; // Use the current in-memory data

    // ... rest of exportToCSV logic seems okay, ensure headers match data keys after potential serialization
    const headers = [
        "id", "title", "description", "startDate", "endDate", "status",
        "estimatedDuration", "urgency", "address", "contactPhone",
        "assignees", "devis", "images", "pdfs", "createdAt", "updatedAt"
    ];

    // Create CSV content
    let csvContent = "data:text/csv;charset=utf-8," + headers.join(",") + "\\n";

    dataToExport.forEach(chantier => {
        const row = headers.map(header => {
            let value = chantier[header];

            // Handle potential complex types (like arrays/objects stored as JSON strings)
            if (typeof value === 'object' && value !== null) {
                value = JSON.stringify(value);
            }

            // Escape double quotes and handle commas within fields
            if (typeof value === 'string') {
                value = `"${value.replace(/"/g, '""')}"`;
            } else if (value === null || value === undefined) {
                value = "";
            }

            return value;
        });
        csvContent += row.join(",") + "\\n";
    });

    // Create a download link
    const encodedUri = encodeURI(csvContent);
    const link = document.createElement("a");
    link.setAttribute("href", encodedUri);
    link.setAttribute("download", "chantiers_export.csv");
    document.body.appendChild(link); // Required for Firefox

    link.click(); // Trigger the download
    document.body.removeChild(link); // Clean up
    console.log("Export triggered.");
}

// New function to fetch data and trigger export
async function exportData() {
    showSyncStatus("Exporting data...", true, 'info');
    try {
        // Fetch the latest data from the backend just before exporting
        // This ensures the export reflects the current state in MongoDB
        const response = await fetch(`${API_URL}/chantiers`);
         if (!response.ok) {
            throw new Error(`HTTP error! status: ${response.status}`);
        }
        const currentBackendChantiers = await response.json();

        if (!currentBackendChantiers || currentBackendChantiers.length === 0) {
            alert("No data found in the cloud to export.");
            showSyncStatus("Export failed: No data.", false, 'error');
            setTimeout(() => showSyncStatus("", false), 3000);
            return;
        }

        // Use the freshly fetched data for the export
        // NOTE: The existing exportToCSV function uses the global 'chantiers'.
        // For maximum accuracy, we should either pass the fetched data to exportToCSV
        // or update the global 'chantiers' first. Let's update the global for simplicity,
        // though passing it would be cleaner.
        chantiers = currentBackendChantiers;
        exportToCSV(); // Call the existing function which uses the global 'chantiers'
        showSyncStatus("Data exported successfully.", false, 'success');
        setTimeout(() => showSyncStatus("", false), 2000);

    } catch (error) {
        console.error("Error fetching data for export:", error);
        alert(`Failed to fetch data for export: ${error.message}`);
        showSyncStatus(`Export failed: ${error.message}`, false, 'error');
        setTimeout(() => showSyncStatus("", false), 3000);
    }
}

// Status indicator function
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

// Add auto-sync functionality
function setupAutoSync() {
    // Sync on page load
    setTimeout(() => syncWithBackend(), 2000);
    
    // Sync every 5 minutes
    setInterval(() => {
        // Only sync if not already syncing
        if (!isSyncing) {
            syncWithBackend();
        }
    }, 5 * 60 * 1000);
    
    // Sync before user leaves the page
    window.addEventListener('beforeunload', () => {
        if (hasUnsavedChanges) {
            syncWithBackend();
        }
    });
}

// Sync with backend function
async function syncWithBackend(retryCount = 0) {
    showSyncStatus('Synchronisation en cours...', true);
    
    try {
        const chantiers = JSON.parse(localStorage.getItem('chantiers')) || [];
        
        // Get all chantiers from backend
        const response = await fetch(`${API_URL}/chantiers`, {
            headers: {
                'Cache-Control': 'no-cache'
            }
        });
        
        if (!response.ok) {
            throw new Error(`Erreur serveur: ${response.status}`);
        }
        
        const backendChantiers = await response.json();
        
        // Track successful operations
        let successCount = 0;
        let totalOperations = chantiers.length;
        
        // Compare and update
        for (const chantier of chantiers) {
            try {
                if (chantier.id && backendChantiers.some(bc => bc.id === chantier.id)) {
                    // Update existing chantier
                    const updateResponse = await fetch(`${API_URL}/chantiers/${chantier.id}`, {
                        method: 'PUT',
                        headers: {
                            'Content-Type': 'application/json',
                        },
                        body: JSON.stringify(chantier)
                    });
                    
                    if (updateResponse.ok) successCount++;
                } else {
                    // Create new chantier
                    const createResponse = await fetch(`${API_URL}/chantiers`, {
                        method: 'POST',
                        headers: {
                            'Content-Type': 'application/json',
                        },
                        body: JSON.stringify(chantier)
                    });
                    
                    if (createResponse.ok) {
                        const result = await createResponse.json();
                        // Update local ID with server ID if needed
                        if (result.id && !chantier.id) {
                            chantier.id = result.id;
                        }
                        successCount++;
                    }
                }
            } catch (err) {
                console.error('Error syncing chantier:', err);
            }
        }
        
        // Delete chantiers that are no longer in localStorage
        for (const backendChantier of backendChantiers) {
            if (!chantiers.find(c => c.id === backendChantier.id)) {
                totalOperations++;
                try {
                    const deleteResponse = await fetch(`${API_URL}/chantiers/${backendChantier.id}`, {
                        method: 'DELETE'
                    });
                    if (deleteResponse.ok) successCount++;
                } catch (err) {
                    console.error('Error deleting chantier:', err);
                }
            }
        }
        
        // Update localStorage with the latest IDs
        localStorage.setItem('chantiers', JSON.stringify(chantiers));
        
        const success = successCount === totalOperations;
        if (success) {
            showSyncStatus('Synchronisé avec succès', false, 'success');
        } else {
            showSyncStatus(`Synchronisé partiellement (${successCount}/${totalOperations})`, false, 
                successCount > 0 ? 'success' : 'error');
        }
        return success;
    } catch (error) {
        console.error('Sync error:', error);
        
        // Retry logic (up to 3 times)
        if (retryCount < 3) {
            showSyncStatus(`Tentative de reconnexion (${retryCount + 1}/3)...`, true);
            return new Promise(resolve => {
                setTimeout(() => {
                    resolve(syncWithBackend(retryCount + 1));
                }, 2000);
            });
        }
        
        showSyncStatus('Erreur de synchronisation. Mode hors ligne activé.', false, 'error');
        return false;
    }
}

// Ensure exportData is exported
// If using modules, make sure it's exported, e.g.:
// export { exportData, /* other exports */ };
// Or if not using modules explicitly, ensure it's globally accessible
// (It seems modules are used, so adding export)

// Find the end of the file or appropriate place for exports
// If other exports exist, add it there.
// Assuming no other exports, add at the end:
export { exportData, initializeFormChangeTracking, resetUnsavedChangesFlag }; // Make functions available for import

// Add saveChantiers function
async function saveChantiers() {
    showSyncStatus("Saving to backend...", true, 'info');
    
    try {
        // Get chantiers from localStorage
        const chantiers = JSON.parse(localStorage.getItem('chantiers')) || [];
        
        // Save each chantier to the backend
        const promises = chantiers.map(async (chantier) => {
            try {
                // Skip chantiers without IDs
                if (!chantier.id) {
                    console.warn('Skipping chantier without ID:', chantier);
                    return;
                }
                
                // Check if the ID is valid
                if (!/^[0-9a-fA-F]{24}$/.test(chantier.id)) {
                    console.warn('Skipping chantier with invalid ID format:', chantier.id);
                    return;
                }
                
                // Fix images and pdfs serialization
                const preparedChantier = {
                    ...chantier,
                    images: typeof chantier.images === 'string' ? chantier.images : JSON.stringify(chantier.images || []),
                    pdfs: typeof chantier.pdfs === 'string' ? chantier.pdfs : JSON.stringify(chantier.pdfs || [])
                };

                const response = await fetch(`${API_URL}/chantiers/${chantier.id}`, {
                    method: 'PUT',
                    headers: {
                        'Content-Type': 'application/json',
                    },
                    body: JSON.stringify(preparedChantier)
                });
                
                // Check if chantier was found (404) or other error
                if (response.status === 404) {
                    console.warn(`Chantier not found in database: ${chantier.id}. It may have been deleted on the server.`);
                    // Try to create it instead
                    return await createChantierOnBackend(chantier);
                }
                
                if (!response.ok) {
                    const errorData = await response.json();
                    console.error(`Server error (${response.status}) for chantier ${chantier.id}:`, errorData);
                    throw new Error(`Server error: ${errorData.error || response.statusText}`);
                }
                
                return await response.json();
            } catch (error) {
                console.error(`Error saving chantier ${chantier.id}:`, error);
                throw new Error(`Failed to save chantier ${chantier.id}: ${error.message}`);
            }
        });
        
        await Promise.all(promises);
        showSyncStatus("All chantiers saved successfully", false, 'success');
        setTimeout(() => showSyncStatus("", false), 2000);
    } catch (error) {
        console.error('Error saving chantiers:', error);
        showSyncStatus(`Error: ${error.message}`, false, 'error');
        setTimeout(() => showSyncStatus("", false), 5000);
    }
}

// Helper function to create a chantier if updating fails with 404
async function createChantierOnBackend(chantier) {
    try {
        // Create a copy of the chantier without the id field
        const { id, ...chantierWithoutId } = chantier;
        
        // Ensure images and pdfs are stringified properly
        const preparedChantier = {
            ...chantierWithoutId,
            images: typeof chantierWithoutId.images === 'string' ? chantierWithoutId.images : JSON.stringify(chantierWithoutId.images || []),
            pdfs: typeof chantierWithoutId.pdfs === 'string' ? chantierWithoutId.pdfs : JSON.stringify(chantierWithoutId.pdfs || [])
        };
        
        const response = await fetch(`${API_URL}/chantiers`, {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
            },
            body: JSON.stringify(preparedChantier)
        });
        
        if (!response.ok) {
            const errorData = await response.json();
            throw new Error(errorData.error || response.statusText);
        }
        
        const newChantier = await response.json();
        console.log(`Recreated chantier with new ID: ${newChantier.id}`);
        
        // Update the ID in localStorage
        const chantiers = JSON.parse(localStorage.getItem('chantiers')) || [];
        const updatedChantiers = chantiers.map(c => c.id === id ? { ...c, id: newChantier.id } : c);
        localStorage.setItem('chantiers', JSON.stringify(updatedChantiers));
        
        return newChantier;
    } catch (error) {
        console.error('Error creating chantier:', error);
        throw new Error(`Failed to create chantier: ${error.message}`);
    }
}

// New function to handle sending email via Gmail
function handleSendGmail() {
    if (!window.editingChantierId) {
        alert("Please save the chantier before sending an email.");
        return;
    }

    const currentChantier = chantiers.find(c => c.id === window.editingChantierId);
    if (!currentChantier) {
        alert("Could not find the current chantier data.");
        return;
    }

    const recipientEmail = document.getElementById('chantier-contact-email').value || currentChantier.contactEmail;
    if (!recipientEmail) {
        alert("Please enter a contact email for this chantier.");
        return;
    }

    const subject = encodeURIComponent("Facture DS METAL");
    const body = encodeURIComponent(
        `Bonjour,\n\nComme convenu, voici la facture Ci-jointe.\n\n[Facture]\n\nCordialement`
    );

    const gmailUrl = `https://mail.google.com/mail/?view=cm&to=${encodeURIComponent(recipientEmail)}&su=${subject}&body=${body}`;

    window.open(gmailUrl, '_blank');
}