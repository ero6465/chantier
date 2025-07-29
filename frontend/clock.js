// Remove ES6 import and use window.config
// import config from './config.js';

let clockInterval;

function initClock() {
    updateClock();
    clockInterval = setInterval(updateClock, 1000);
}

function updateClock() {
    const clockElement = document.getElementById('clock');
    const timeLeftElement = document.getElementById('time-left');
    
    if (!clockElement || !timeLeftElement) return;
    
    const now = new Date();
    const hours = now.getHours().toString().padStart(2, '0');
    const minutes = now.getMinutes().toString().padStart(2, '0');
    const seconds = now.getSeconds().toString().padStart(2, '0');
    
    clockElement.textContent = `${hours}:${minutes}:${seconds}`;
    
    // Calculate time left
    const dayOfWeek = now.getDay(); // 0 = Sunday, 1 = Monday, etc.
    
    // Check if today is a working day
    if (window.config.workingHours.workDays.includes(dayOfWeek)) {
        const endTime = new Date();
        const [endHours, endMinutes] = window.config.workingHours.startTime.split(':').map(Number);
        endTime.setHours(endHours, endMinutes, 0);
        
        // If current time is before work start time
        if (now < endTime) {
            timeLeftElement.textContent = 'Work hasn\'t started yet';
            return;
        }
        
        const workEnd = new Date();
        const [workEndHours, workEndMinutes] = window.config.workingHours.endTime.split(':').map(Number);
        workEnd.setHours(workEndHours, workEndMinutes, 0);
        
        // If work has already ended
        if (now > workEnd) {
            timeLeftElement.textContent = 'Work day has ended';
            return;
        }
        
        // Calculate time left
        const timeLeftMs = workEnd - now;
        const hoursLeft = Math.floor(timeLeftMs / (1000 * 60 * 60));
        const minutesLeft = Math.floor((timeLeftMs % (1000 * 60 * 60)) / (1000 * 60));
        
        timeLeftElement.textContent = `Time left: ${hoursLeft}h ${minutesLeft}m`;
    } else {
        timeLeftElement.textContent = 'Not a working day';
    }
}

function stopClock() {
    if (clockInterval) {
        clearInterval(clockInterval);
    }
}

export { initClock, stopClock };