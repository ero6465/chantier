// Contains UI-related functions moved from app.js
// import config from './config.js';
import { initDrawingTools, handleImageUpload, addImageToPreview, createNewDrawing, showImagePreview } from './image-handler.js';
import { resetUnsavedChangesFlag, initializeFormChangeTracking } from './app.js'; // Import change tracking functions

// Match API_URL from app.js
const API_URL = 'http://127.0.0.1:5000/api';

// View functions
function toggleView(view) {
    const calendarView = document.getElementById('calendar-view');
    const listView = document.getElementById('list-view');
    const calendarViewBtn = document.getElementById('calendar-view-btn');
    const listViewBtn = document.getElementById('list-view-btn');
    
    if (view === 'calendar') {
        if (calendarView) calendarView.classList.add('active');
        if (listView) listView.classList.remove('active');
        if (calendarViewBtn) calendarViewBtn.classList.add('active');
        if (listViewBtn) listViewBtn.classList.remove('active');
    } else {
        if (listView) listView.classList.add('active');
        if (calendarView) calendarView.classList.remove('active');
        if (listViewBtn) listViewBtn.classList.add('active');
        if (calendarViewBtn) calendarViewBtn.classList.remove('active');
    }
}

// Toggle list view display
function toggleListView() {
    const listView = document.getElementById('list-view');
    const arrowIndicator = document.getElementById('arrow-indicator');
    
    if (listView) {
        listView.classList.toggle('active');
        
        if (arrowIndicator) {
            if (listView.classList.contains('active')) {
                arrowIndicator.innerHTML = '❯';
                arrowIndicator.classList.add('expanded');
            } else {
                arrowIndicator.innerHTML = '❮';
                arrowIndicator.classList.remove('expanded');
            }
        }
    }
}

// Modal functions
function openAddChantierModal(selectedDate = null) {
    try {
    const modalTitle = document.getElementById('modal-title');
    const chantierForm = document.getElementById('chantier-form');
    const imagePreview = document.getElementById('image-preview');
    const pdfPreview = document.getElementById('pdf-preview');
    const deleteChantierBtn = document.getElementById('delete-chantier');
    const chantierModal = document.getElementById('chantier-modal');
    
        if (!chantierModal) {
            console.error("Chantier modal element not found");
            return;
        }
        
        if (modalTitle) modalTitle.textContent = 'Add New Chantier';
    window.editingChantierId = null;
        resetUnsavedChangesFlag(); // Reset changes flag
    
    // Reset form
        if (chantierForm) chantierForm.reset();
        if (imagePreview) imagePreview.innerHTML = '';
        if (pdfPreview) pdfPreview.innerHTML = '';
    window.uploadedImages = [];
    window.uploadedPdfs = [];
    
    // Set default dates
        const startDateInput = document.getElementById('chantier-start-date');
        const endDateInput = document.getElementById('chantier-end-date');
        
        if (selectedDate) {
            if (startDateInput) startDateInput.value = selectedDate;
            if (endDateInput) endDateInput.value = selectedDate;
        } else {
            const today = moment().format('YYYY-MM-DD');
            if (startDateInput) startDateInput.value = today;
            if (endDateInput) endDateInput.value = today;
        }
        
        // Populate parent chantier dropdown
        populateParentChantierDropdown();
        
        // Add event listener for parent chantier selection
        const parentDropdown = document.getElementById('parent-chantier');
        if (parentDropdown) {
            // Remove existing listeners to prevent duplicates
            const newDropdown = parentDropdown.cloneNode(true);
            parentDropdown.parentNode.replaceChild(newDropdown, parentDropdown);
            
            newDropdown.addEventListener('change', (e) => {
                loadParentChantierInfo(e.target.value);
            });
        }
        
        // Reset tab selection
        const defaultTab = document.querySelector('.form-tab[data-panel="chantier-details"]');
        if (defaultTab) defaultTab.click();
        
        // Hide delete button for new chantiers
        if (deleteChantierBtn) deleteChantierBtn.style.display = 'none';
        
        // Reset image editing state
        window.isEditingImage = false;
        
        // Show modal
        chantierModal.style.display = 'block';
        
        // Initialize change tracking after form is populated/reset
        initializeFormChangeTracking(); 

        // Update assignee checkboxes with images
        updateAssigneeCheckboxes();
    } catch (error) {
        console.error('Error in openAddChantierModal:', error);
        alert('Error opening the modal. Please try again.');
    }
}

function openEditChantierModal(chantierId) {
    if (!chantierId) {
        console.error('No chantier ID provided');
        return;
    }
    
    window.editingChantierId = chantierId; // Set this first for fetch
    resetUnsavedChangesFlag(); // Reset changes flag
    showModal(true);
    
    // First try to get data from localStorage as a fallback
    const chantiers = JSON.parse(localStorage.getItem('chantiers')) || [];
    let localChantier = chantiers.find(c => c.id === chantierId);
    
    // Fetch the latest chantier data from backend
    fetch(`${API_URL}/chantiers/${chantierId}`)
        .then(response => {
            if (!response.ok) {
                throw new Error(`HTTP error: ${response.status}`);
            }
            return response.json();
        })
        .then(chantier => {
            console.log('Loaded chantier:', chantier); // Debug
            populateForm(chantier);
            // Initialize change tracking AFTER form is populated
            initializeFormChangeTracking(); 
        })
        .catch(error => {
            console.error('Error fetching chantier data:', error);
            
            // Use localStorage data if available (fallback)
            if (localChantier) {
                console.log('Using local data as fallback');
                populateForm(localChantier);
            } else {
                alert('Could not load chantier data. The item may have been deleted.');
                closeModal();
            }
        });
}

function updateAssigneeCheckboxes() {
    const assigneeContainer = document.getElementById('assignee-checkboxes');
    if (!assigneeContainer) return;
    
    assigneeContainer.innerHTML = '';
    
    window.config.assignees.forEach(assignee => {
        const checkboxItem = document.createElement('div');
        checkboxItem.className = 'checkbox-item';
        
        const checkbox = document.createElement('input');
        checkbox.type = 'checkbox';
        checkbox.id = `assignee-${assignee.id}`;
        checkbox.value = assignee.name;
        checkbox.className = 'assignee-checkbox';
        
        const label = document.createElement('label');
        label.htmlFor = `assignee-${assignee.id}`;
        
        // Add image if available
        if (assignee.image) {
            const img = document.createElement('img');
            img.src = assignee.image;
            img.className = 'assignee-checkbox-img';
            img.alt = assignee.name;
            label.appendChild(img);
        }
        
        const nameSpan = document.createElement('span');
        nameSpan.textContent = assignee.name;
        label.appendChild(nameSpan);
        
        checkboxItem.appendChild(checkbox);
        checkboxItem.appendChild(label);
        assigneeContainer.appendChild(checkboxItem);
    });
}

// Helper function to setup images and PDFs in the modal
function setupImagesAndPdfs(chantier) {
    // Reset image and PDF lists
    window.uploadedImages = [];
    window.uploadedPdfs = [];
    
    // Handle images
    if (chantier.images) {
        try {
            // Ensure images is an array
            const images = Array.isArray(chantier.images) ? chantier.images : JSON.parse(chantier.images);
            window.uploadedImages = images;
            
            // Clear existing images
    const imagePreview = document.getElementById('image-preview');
    if (imagePreview) {
        imagePreview.innerHTML = '';
            }
            
            // Add each image to preview
            images.forEach(image => {
                if (image) {
                    addImageToPreview(image);
                }
            });
        } catch (error) {
            console.error('Error processing images:', error);
            window.uploadedImages = [];
        }
    }
    
    // Handle PDFs
    if (chantier.pdfs) {
        try {
            // Ensure pdfs is an array
            const pdfs = Array.isArray(chantier.pdfs) ? chantier.pdfs : JSON.parse(chantier.pdfs);
            window.uploadedPdfs = pdfs;
            
            // Clear existing PDFs
    const pdfPreview = document.getElementById('pdf-preview');
    if (pdfPreview) {
        pdfPreview.innerHTML = '';
            }
            
            // Add each PDF to preview
            pdfs.forEach(pdf => {
                if (pdf) {
                    handlePdfUpload(pdf);
                }
            });
        } catch (error) {
            console.error('Error processing PDFs:', error);
            window.uploadedPdfs = [];
        }
    }
}

// Convert data URI to Blob
function dataURItoBlob(dataURI) {
    const byteString = atob(dataURI.split(',')[1]);
    const mimeString = dataURI.split(',')[0].split(':')[1].split(';')[0];
    const ab = new ArrayBuffer(byteString.length);
    const ia = new Uint8Array(ab);
    
    for (let i = 0; i < byteString.length; i++) {
        ia[i] = byteString.charCodeAt(i);
    }
    
    return new Blob([ab], { type: mimeString });
}

function closeModal(forceClose = false) { // Added forceClose parameter
    // Check if currently editing an image
    if (window.isEditingImage) {
        if (confirm('Vous avez des modifications non enregistrées sur une image. Voulez-vous abandonner les modifications et fermer ?')) {
            window.isEditingImage = false;
            const chantierModal = document.getElementById('chantier-modal');
            chantierModal.style.display = 'none';
        }
        return;
    }

    // Check for unsaved changes only if not forcing close
    if (!forceClose && window.hasUnsavedChanges) { // Use window.hasUnsavedChanges
        if (!confirm('Vous avez des modifications non enregistrées. Êtes-vous sûr de vouloir fermer ?')) {
            return; // Don't close if user cancels
        }
    }
    
    const chantierModal = document.getElementById('chantier-modal');
    if (chantierModal) {
    chantierModal.style.display = 'none';
    }
    
    // Always reset the flag when closing
    resetUnsavedChangesFlag(); 
    window.editingChantierId = null; // Clear editing ID
    
    // Optional: Stop any ongoing drawing/editing
    const drawingCanvas = document.getElementById('drawing-canvas');
    if (drawingCanvas && drawingCanvas.style.display !== 'none') {
        const cancelBtn = document.getElementById('drawing-cancel-btn');
        if (cancelBtn) cancelBtn.click();
    }
}

// Function to copy Waze link to clipboard
async function navigateToAddress(address, buttonElement) { // Renamed conceptually, accepts button
    if (!address) {
        console.warn("No address provided for navigation link.");
        return;
    }
    if (!buttonElement) {
        console.warn("Button element not provided for feedback.");
        return;
    }
    
    try {
        const encodedAddress = encodeURIComponent(address);
        const url = `https://waze.com/ul?q=${encodedAddress}&navigate=yes`;
        console.log("Waze URL to copy:", url);

        // Use the Clipboard API
        await navigator.clipboard.writeText(url);

        // Visual Feedback on the button
        const originalContent = buttonElement.innerHTML;
        const originalTitle = buttonElement.title;
        buttonElement.innerHTML = '<i class="fas fa-check"></i> Copied!';
        buttonElement.title = 'Link Copied!';
        buttonElement.disabled = true; // Briefly disable to prevent rapid clicks

        // Restore button state after a short delay
        setTimeout(() => {
            try { // Add try-catch in case button is removed from DOM
                buttonElement.innerHTML = originalContent;
                buttonElement.title = originalTitle;
                buttonElement.disabled = false;
            } catch (innerError) {
                 console.warn("Button no longer available to restore state.");
            }
        }, 1500); // Restore after 1.5 seconds

    } catch (error) {
        console.error('Failed to copy Waze link:', error);
        alert("Could not copy Waze link to clipboard. Check browser permissions.");
    }
}

// Function to populate parent chantier dropdown
function populateParentChantierDropdown(currentChantierId = null) {
    const parentDropdown = document.getElementById('parent-chantier');
    if (!parentDropdown) return;

    // Clear existing options except the first one
    while (parentDropdown.options.length > 1) {
        parentDropdown.remove(1);
    }

    // Add all chantiers as options, excluding the current one
    const chantiers = JSON.parse(localStorage.getItem('chantiers')) || [];
    chantiers.forEach(chantier => {
        if (chantier.id !== currentChantierId) {
            const option = document.createElement('option');
            option.value = chantier.id;
            option.textContent = chantier.title;
            parentDropdown.appendChild(option);
        }
    });
}

// Function to load parent chantier info
function loadParentChantierInfo(parentId) {
    if (!parentId) return;

    const chantiers = JSON.parse(localStorage.getItem('chantiers')) || [];
    const parentChantier = chantiers.find(c => c.id === parentId);
    if (!parentChantier) return;

    // Copy relevant info from parent
    const form = document.getElementById('chantier-form');
    if (form) {
        document.getElementById('chantier-address').value = parentChantier.address || '';
        document.getElementById('chantier-contact-phone').value = parentChantier.contactPhone || '';
        document.getElementById('chantier-description').value = parentChantier.description || '';
        
        // Copy assignees
        if (parentChantier.assignees) {
            const assigneeCheckboxes = document.querySelectorAll('.assignee-checkbox');
            assigneeCheckboxes.forEach(checkbox => {
                checkbox.checked = parentChantier.assignees.includes(checkbox.value);
            });
        }
    }
}

function populateForm(chantier) {
    try {
        // Basic details
        const titleInput = document.getElementById('chantier-title');
        if (titleInput) titleInput.value = chantier.title || '';
        
        const descInput = document.getElementById('chantier-description');
        if (descInput) descInput.value = chantier.description || '';
        
        const startDateInput = document.getElementById('chantier-start-date');
        if (startDateInput) startDateInput.value = chantier.startDate ? moment(chantier.startDate).format('YYYY-MM-DD') : '';
        
        const endDateInput = document.getElementById('chantier-end-date');
        if (endDateInput) endDateInput.value = chantier.endDate ? moment(chantier.endDate).format('YYYY-MM-DD') : '';
        
        const durationInput = document.getElementById('chantier-estimated-duration');
        if (durationInput) durationInput.value = chantier.estimatedDuration || '';
        
        const statusInput = document.getElementById('chantier-status');
        if (statusInput) statusInput.value = chantier.status || 'ongoing';
        
        const urgencyInput = document.getElementById('chantier-urgency');
        if (urgencyInput) urgencyInput.value = chantier.urgency || 'medium';
        
        const addressInput = document.getElementById('chantier-address');
        if (addressInput) addressInput.value = chantier.address || '';
        
        const phoneInput = document.getElementById('chantier-contact-phone');
        if (phoneInput) phoneInput.value = chantier.contactPhone || '';
        
        const emailInput = document.getElementById('chantier-contact-email');
        if (emailInput) emailInput.value = chantier.contactEmail || '';
        
        // Parent chantier
        const parentInput = document.getElementById('parent-chantier');
        if (parentInput) {
            populateParentChantierDropdown(chantier.id);
            parentInput.value = chantier.parentChantierId || '';
        }
        
        // Assignees
        const assigneesContainer = document.getElementById('assignee-checkboxes');
        if (assigneesContainer) {
            // Update assignee checkboxes with the current data
            updateAssigneeCheckboxes();
            
            // Check the appropriate boxes
            setTimeout(() => {
                if (chantier.assignees && Array.isArray(chantier.assignees)) {
                    const checkboxes = document.querySelectorAll('.assignee-checkbox');
                    checkboxes.forEach(checkbox => {
                        checkbox.checked = chantier.assignees.includes(checkbox.value);
                    });
                }
            }, 50);
        }
        
        // Devis/Facture Notes
        const devisInput = document.getElementById('chantier-devis');
        if (devisInput) devisInput.value = chantier.devis || '';

        // Clear and populate photos/drawings
        const photosPreview = document.getElementById('image-preview');
        if (photosPreview) {
            photosPreview.innerHTML = '';
            window.uploadedImages = chantier.images ? chantier.images : [];
            if (Array.isArray(window.uploadedImages)) {
                window.uploadedImages.forEach((imgData, index) => {
                    if (imgData) addImageToPreview(imgData, index);
                });
            }
        }

        // Clear and populate PDFs
    const pdfPreview = document.getElementById('pdf-preview');
        if (pdfPreview) {
            pdfPreview.innerHTML = '';
            window.uploadedPdfs = chantier.pdfs ? chantier.pdfs : [];
            if (Array.isArray(window.uploadedPdfs)) {
                window.uploadedPdfs.forEach((pdfData, index) => {
                    if (pdfData && typeof addPdfToPreview === 'function') {
                        addPdfToPreview(pdfData, index);
                    }
                });
            }
        }

        // Show delete button
        const deleteBtn = document.getElementById('delete-chantier');
        if (deleteBtn) deleteBtn.style.display = 'inline-block';
        
    } catch (error) {
        console.error('Error in populateForm:', error);
    }
}

// Helper function to show modal
function showModal(isEditing) {
    const chantierModal = document.getElementById('chantier-modal');
    const modalTitle = document.getElementById('modal-title');
    
    if (isEditing) {
        modalTitle.textContent = 'Modifier le Chantier';
    } else {
        modalTitle.textContent = 'Ajouter un Nouveau Chantier';
    }
    
    // Show modal
    chantierModal.style.display = 'block';
    
    // Reset tab selection to first tab
    const defaultTab = document.querySelector('.form-tab[data-panel="chantier-details"]');
    if (defaultTab) defaultTab.click();
    
    // Show/hide delete button based on if editing
    const deleteChantierBtn = document.getElementById('delete-chantier');
    if (deleteChantierBtn) {
        deleteChantierBtn.style.display = isEditing ? 'block' : 'none';
    }
}

window.toggleListView = toggleListView;
window.openAddChantierModal = openAddChantierModal;
window.openEditChantierModal = openEditChantierModal;
window.navigateToAddress = navigateToAddress;

export { 
    toggleView, 
    openAddChantierModal, 
    openEditChantierModal, 
    closeModal, 
    toggleListView, 
    navigateToAddress,
    populateParentChantierDropdown,
    loadParentChantierInfo,
    showModal
};