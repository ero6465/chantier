// Configuration settings for the Chantier Planning Tool
const config = {
    // Assignees that can be selected for chantiers
    // Initial assignee list is empty; users can add employees via the UI
    assignees: [],
    
    // Urgency levels for chantiers
    urgencyLevels: [
        { id: 1, name: 'Low', color: '#4CAF50' },
        { id: 2, name: 'Medium', color: '#FFC107' },
        { id: 3, name: 'High', color: '#F44336' }
    ],
    
    // Status options for chantiers
    statusOptions: [
        { id: 1, name: 'Not Started', color: '#9E9E9E' },
        { id: 2, name: 'In Progress', color: '#2196F3' },
        { id: 3, name: 'Completed', color: '#4CAF50' }
    ],
    
    // Working hours
    workingHours: {
        workDays: [1, 2, 3, 4, 5], // Monday to Friday
        startTime: '08:00',
        endTime: '17:00'
    }
};

// Make config available globally
window.config = config;