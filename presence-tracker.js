// Constants
const DEFAULT_HOURS = 8; // Default working hours per day
const MAX_HISTORY_MONTHS = 2; // Keep only 2 months of history

// Worker data structure – always sourced from MongoDB
let workers = [];

// --- Load all workers from MongoDB on startup ---
async function loadWorkersFromDb(){
    try{
        const res = await fetch(WORKERS_API_URL);
        if(!res.ok){ console.error('Failed to fetch workers',res.status); return; }
        const list = await res.json();
        if(Array.isArray(list)){
            workers = list.map(w=>({
                id: w._id || w.id,
                name: w.name || w.worker,
                monthlyPay: w.monthlyPay || w.salary || 0,
                presence: w.presence || {},
                note: w.note || '',
                worker: w.name || w.worker
            }));
        }
    }catch(err){console.error('Error loading workers',err);}
}

let currentDate = new Date();
let selectedDate = null;
// Default working days (Monday to Friday) and hours
let workingDays = [1, 2, 3, 4, 5]; // Monday to Friday by default
let workingHours = { start: '08:00', end: '17:00' };
let tempWorkerStates = {}; // Store temporary worker states before saving
// Group edit mode flag
let groupEditMode = false;

// Presence API sync ------------------------------
const CLEAR_ALL_URL = 'http://127.0.0.1:5000/api/presence/all';
const PRESENCE_API_URL = 'http://127.0.0.1:5000/api/presence';
const WORKER_RENAME_URL = 'http://127.0.0.1:5000/api/worker/rename';
const PRESENCE_RENAME_URL = 'http://127.0.0.1:5000/api/presence/renameWorker';
// Worker CRUD endpoints
const WORKERS_API_URL = 'http://127.0.0.1:5000/api/workers';

// Kick off DB load after constants are initialized
loadWorkersFromDb().then(()=>{
    try{
        updateCalendar();
        updateMonthlySummary();
    }catch(e){}
});

// ----- Generic helper to tolerate differing REST verbs (POST/PUT/PATCH)
async function sendJsonWithFallback(url, data, methods=['POST','PUT','PATCH']){
    let lastErr;
    for(const m of methods){
        try{
            const res = await fetch(url, {
                method: m,
                headers:{'Content-Type':'application/json'},
                body: JSON.stringify(data)
            });
            if(res.ok) return res;
            if(res.status!==405){ // unexpected error, break early
                const txt = await res.text();
                console.error(`${m} ${url} failed`, res.status, txt);
                return res;
            }
            // if 405, try next verb
        }catch(e){ lastErr=e; }
    }
    if(lastErr) console.error('All HTTP verb attempts failed for',url,lastErr);
    return null;
}

// Create a worker in DB. Some back-ends may only accept PUT /api/workers/:id.
async function ensureWorkerSchema(obj){
    if(obj && obj.name!==undefined){
        obj.worker = obj.name; // backend expects field 'worker'
    }
}

// Create worker in DB, return created doc or null
async function createWorkerInDb(worker) {
    ensureWorkerSchema(worker);
    try {
        // First try POST on collection endpoint
        let res = await sendJsonWithFallback(WORKERS_API_URL, worker, ['POST']);
        if (!res || res.status === 405) {
            // Fallback to ID-specific endpoint with PUT or POST
            res = await sendJsonWithFallback(`${WORKERS_API_URL}/${worker.id}`, worker, ['PUT','POST']);
        }
        if (res && res.ok) {
            try {
                return await res.json();
            } catch(_){}
        }
        if (!res || !res.ok) {
            const txt = res ? await res.text() : 'no response';
            console.error('Create worker failed', res ? res.status : '', txt);
        }
    } catch (err) {
        console.error('Failed to create worker in DB', err);
    }
}

// Update worker document in DB; if it doesn't exist, create it instead.
async function updateWorkerInDb(workerId, workerData) {
    ensureWorkerSchema(workerData);
    try {
        let res = await sendJsonWithFallback(`${WORKERS_API_URL}/${workerId}`, workerData, ['PUT','PATCH','POST']);
        if (res && res.ok) return true; // updated successfully
        // If the document does not exist (404) or bad request, attempt to create
        if (res && (res.status === 404 || res.status === 400)) {
            await createWorkerInDb(workerData);
            return false; // indicates created instead of updated
        }
    } catch (err) {
        console.error('Failed to update worker in DB', err);
        // Attempt to create as a fallback
        try { await createWorkerInDb(workerData); } catch (e) { /* ignore */ }
    }
    return false;
}

async function deleteWorkerInDb(workerId){
    try{
        const response = await fetch(`${WORKERS_API_URL}/${workerId}`, {method:'DELETE'});
        if(!response.ok){
            const txt = await response.text();
            console.error('Failed to delete worker in DB',response.status,txt);
        }
    }catch(err){console.error('Error deleting worker',err);}    
}

/**
 * Rename worker reference inside presence collection.
 */
async function renamePresenceWorkerInDb(oldName, newName) {
    try {
        await sendJsonWithFallback(PRESENCE_RENAME_URL,{ oldName, newName },['POST','PATCH','PUT']);
    } catch (err) { console.error('Failed to rename worker in presence DB', err); }
}

/**
 * Rename a worker server-side (MongoDB).
 * Backend should accept { oldName, newName } via PUT/PATCH/POST.
 */
async function renameWorkerInDb(oldName, newName) {
    // some backends only implement POST here
    try {
        await sendJsonWithFallback(WORKER_RENAME_URL,{ oldName, newName },['POST','PATCH','PUT']);
    } catch (err) { console.error('Failed to rename worker in DB', err); }
}

async function sendPresenceUpdate(worker, monthlyPay, dateStr, present, supHours) {
    try {
        const payload = { worker, monthlyPay, date: dateStr, present, supHours };
        await fetch(PRESENCE_API_URL, {
            method: 'POST',
            headers: { 'Content-Type':'application/json' },
            body: JSON.stringify(payload)
        });
    } catch(err){
        console.error('Presence sync failed', err);
    }
}
async function fetchPresenceAll(){
    try {
        const res = await fetch(PRESENCE_API_URL);
        if(!res.ok) return;
        const docs = await res.json();
        docs.forEach(doc=>{
            const worker = workers.find(w=>w.name === doc.worker);
            if(!worker) return;
            if(!worker.presence) worker.presence = {};
            const presObj = doc.presence || {};
            Object.entries(presObj).forEach(([d, val])=>{
                worker.presence[d] = { present: !!val.present, hours: val.supHours||0 };
            });
        });
    }catch(err){console.error('Presence fetch failed',err);}    
}

// ------------------------------------------------
// Clear all presence data (button handler)
async function clearAllPresenceData(){
    if(!confirm('Are you sure you want to delete ALL presence data?')) return;
    try{
        const res = await fetch(CLEAR_ALL_URL,{method:'DELETE'});
        if(res.ok){
            // wipe local cache
            workers.forEach(w=>{w.presence={};});
            updateCalendar();
            updateMonthlySummary();
            alert('All presence data deleted');
        } else {
            const msg = await res.text();
            throw new Error(msg);
        }
    }catch(err){
        console.error('Failed to clear presence collection',err);
        alert('Failed to clear presence data');
    }
}

// ------------------------------------------------

// ------- Initial load presence sync --------
window.addEventListener('load', () => {
    fetchPresenceAll().then(()=>{
        updateCalendar();
        updateMonthlySummary();
    });
});
// Initialize date range for summary
let summaryDateRange = {
    start: new Date(currentDate.getFullYear(), currentDate.getMonth(), 1),
    end: new Date(currentDate.getFullYear(), currentDate.getMonth() + 1, 0)
};

// Calculate working hours from start and end time
function calculateWorkingHours(start, end) {
    const [startHour, startMinute] = start.split(':').map(Number);
    const [endHour, endMinute] = end.split(':').map(Number);
    
    let hours = endHour - startHour;
    let minutes = endMinute - startMinute;
    
    if (minutes < 0) {
        hours -= 1;
        minutes += 60;
    }
    
    return hours + (minutes / 60);
}

// Calculate hourly rate from daily rate
function calculateHourlyRate(dailyRate) {
    return dailyRate / calculateWorkingHours(workingHours.start, workingHours.end);
}

// Calculate pay for a worker on a specific date
function calculatePay(worker, dateStr) {
    if (!worker || !dateStr) return 0;
    
    const presence = worker.presence[dateStr] || { hours: 0, present: false };
    if (!presence.present) return 0;
    
    const baseHours = calculateWorkingHours(workingHours.start, workingHours.end);
    // If sup hours is -baseHours, treat as absence (worked 0 hours)
    if (presence.hours === -baseHours) return 0;
    if (worker.calculationMode === 'hourly') {
        const hourlyRate = calculateHourlyRate(worker.dayRate);
        const totalHours = baseHours + presence.hours;
        return hourlyRate * totalHours;
    } else {
        // daily mode
        return worker.dayRate;
    }
}

// Reset all workers for the current day
function resetDay() {
    if (!selectedDate) return;
    
    const dateStr = formatDate(selectedDate);
    workers.forEach(worker => {
        delete worker.presence[dateStr];
        // Update backend for each worker
        fetch(`${PRESENCE_API_URL}/day?worker=${encodeURIComponent(worker.name)}&date=${encodeURIComponent(dateStr)}`, { method: 'DELETE' });
    });
    
    updateCalendar();
    updateMonthlySummary();
    closeDayEditModal();
}

// Save the current day's changes
function saveDay() {
    if (!selectedDate) return;
    
    const dateStr = formatDate(selectedDate);
    workers.forEach(worker => {
        if (tempWorkerStates[worker.id]) {
            const state = tempWorkerStates[worker.id];
            worker.presence[dateStr] = state;
            // backend sync
            sendPresenceUpdate(worker.name, worker.monthlyPay, dateStr, state.present, state.hours);
        }
    });
    
    updateCalendar();
    updateMonthlySummary();
    closeDayEditModal();
}

// Open day edit modal
function openDayEditModal(date) {
    selectedDate = date;
    const dateStr = formatDate(date);
    const modal = document.getElementById('day-edit-modal');
    const title = document.getElementById('day-edit-title');
    const workersContainer = document.getElementById('day-edit-workers');
    
    title.textContent = `Edit ${date.toLocaleDateString()}`;
    workersContainer.innerHTML = '';
    tempWorkerStates = {};
    
    workers.forEach(worker => {
        const presence = worker.presence[dateStr] || { hours: 0, present: false };
        tempWorkerStates[worker.id] = { ...presence };
        
        const control = document.createElement('div');
        control.className = 'worker-presence-control';
        
        const toggle = document.createElement('div');
        toggle.className = 'presence-toggle';
        
        const switchDiv = document.createElement('div');
        switchDiv.className = `presence-switch ${presence.present ? 'active' : ''}`;
        switchDiv.onclick = () => {
            presence.present = !presence.present;
            switchDiv.classList.toggle('active');
            hoursInput.disabled = !presence.present;
            tempWorkerStates[worker.id] = presence;
        };
        
        const name = document.createElement('span');
        name.textContent = worker.name;
        
        const supHoursSpan = document.createElement('span');
        supHoursSpan.className = 'worker-sup-hours';
        supHoursSpan.textContent = ` (Sup: ${presence.hours >= 0 ? '+' : ''}${presence.hours})`;
        name.appendChild(supHoursSpan);
        
        toggle.appendChild(switchDiv);
        toggle.appendChild(name);
        
        const hours = document.createElement('div');
        hours.className = 'hours-adjustment';
        
        const hoursInput = document.createElement('input');
        hoursInput.type = 'number';
        hoursInput.className = 'hours-input';
        const baseHours = calculateWorkingHours(workingHours.start, workingHours.end);
        hoursInput.min = -baseHours;
        hoursInput.max = baseHours;
        hoursInput.step = '0.5';
        hoursInput.value = presence.hours;
        hoursInput.disabled = !presence.present;
        hoursInput.placeholder = 'Extra/Reduced hours';
        hoursInput.onchange = () => {
            const newHours = parseFloat(hoursInput.value);
            if (!isNaN(newHours) && newHours >= -baseHours && newHours <= baseHours) {
                presence.hours = newHours;
                tempWorkerStates[worker.id] = presence;
            } else {
                hoursInput.value = presence.hours;
            }
        };
        
        hours.appendChild(hoursInput);
        hours.appendChild(document.createTextNode('hours'));
        
        control.appendChild(toggle);
        control.appendChild(hours);
        workersContainer.appendChild(control);
    });
    
    modal.style.display = 'block';
}

// Close day edit modal
function closeDayEditModal() {
    document.getElementById('day-edit-modal').style.display = 'none';
    selectedDate = null;
    tempWorkerStates = {};
}

// Initialize workers - only from MongoDB, no local config dependency
async function initializeWorkers() {
    if (workers.length === 0) {
        try {
            await loadWorkersFromDb();
            // If still no workers after loading from DB, we'll just have an empty list
            // Users can add workers through the UI
        } catch (error) {
            console.error('Error initializing workers:', error);
        }
    }
}

// Save working days (in-memory only)
function saveWorkingDays() {
    updateCalendar();
    updateMonthlySummary();
}

// Save working hours (in-memory only)
function saveWorkingHours() {
    const start = document.getElementById('work-start')?.value || workingHours.start;
    const end = document.getElementById('work-end')?.value || workingHours.end;
    workingHours = { start, end };
    updateCalendar();
    updateMonthlySummary();
}

// Clear all worker data from MongoDB
async function clearAllData() {
    if (confirm('Are you sure you want to clear all worker data? This cannot be undone.')) {
        try {
            const response = await fetch(WORKERS_API_URL + '/all', { method: 'DELETE' });
            if (response.ok) {
                workers = [];
                await initializeWorkers();
                updateCalendar();
                updateMonthlySummary();
            } else {
                throw new Error('Failed to clear worker data');
            }
        } catch (error) {
            console.error('Error clearing worker data:', error);
            alert('Failed to clear worker data. Please try again.');
        }
    }
}

// Initialize working days UI
function initializeWorkingDays() {
    const daysContainer = document.getElementById('working-days');
    const days = daysContainer.children;
    
    for (let day of days) {
        const dayNum = parseInt(day.dataset.day);
        if (workingDays.includes(dayNum)) {
            day.classList.add('active');
        }
        
        day.onclick = () => {
            day.classList.toggle('active');
            workingDays = Array.from(days)
                .filter(d => d.classList.contains('active'))
                .map(d => parseInt(d.dataset.day));
            saveWorkingDays();
            updateCalendar();
        };
    }
    
    // Set working hours inputs
    document.getElementById('work-start').value = workingHours.start;
    document.getElementById('work-end').value = workingHours.end;
}

// Get working days for the current month
function getWorkingDays(year, month) {
    const days = [];
    const date = new Date(year, month, 1);
    
    while (date.getMonth() === month) {
        if (workingDays.includes(date.getDay())) {
            days.push(new Date(date));
        }
        date.setDate(date.getDate() + 1);
    }
    return days;
}

// Helper function to set time to midnight
function setToMidnight(date) {
    const newDate = new Date(date);
    newDate.setHours(0, 0, 0, 0);
    return newDate;
}

// Update summary date range from inputs
function updateSummaryDateRange() {
    const startDate = document.getElementById('summary-start-date').value;
    const endDate = document.getElementById('summary-end-date').value;
    
    if (startDate && endDate) {
        let start = new Date(startDate);
        let end = new Date(endDate);
        
        // Swap dates if end is before start
        if (end < start) {
            [start, end] = [end, start];
            // Update input values to reflect the swap
            document.getElementById('summary-start-date').value = formatDate(start);
            document.getElementById('summary-end-date').value = formatDate(end);
        }
        
        summaryDateRange.start = setToMidnight(start);
        summaryDateRange.end = setToMidnight(end);
        updateMonthlySummary();
    }
}

// Reset summary date range to current month
function resetSummaryDateRange() {
    summaryDateRange.start = setToMidnight(new Date(currentDate.getFullYear(), currentDate.getMonth(), 1));
    summaryDateRange.end = setToMidnight(new Date(currentDate.getFullYear(), currentDate.getMonth() + 1, 0));
    
    updateDateRangeLabel();
    updateMonthlySummary();
}

// Initialize date range inputs
function initializeDateRangeInputs() {
    updateDateRangeLabel();
}

function updateDateRangeLabel() {
    const start = summaryDateRange.start;
    const end = summaryDateRange.end;
    const label = `${start.toLocaleDateString()} - ${end.toLocaleDateString()}`;
    const labelEl = document.getElementById('date-range-label');
    if (labelEl) labelEl.textContent = label;
}

// Mini calendar logic for range selection
let calendarSelecting = false;
let calendarStart = null;
let calendarEnd = null;

// ... (mini calendar and UI functions unchanged) ...

// Calculate worked days and extra hours for a worker in the selected date range
function calculateWorkerStats(worker) {
    // Count worked days the same way as the hover popup breakdown
    let workedDays = 0;
    let supHours = 0;
    const startDate = new Date(summaryDateRange.start);
    const endDate = new Date(summaryDateRange.end);
    const baseHours = calculateWorkingHours(workingHours.start, workingHours.end);

    // Build list of *scheduled* working days within range
    const workingDaysInRange = [];
    const dateCursor = new Date(startDate);
    while (dateCursor <= endDate) {
        if (workingDays.includes(dateCursor.getDay())) {
            workingDaysInRange.push(new Date(dateCursor));
        }
        dateCursor.setDate(dateCursor.getDate() + 1);
    }

    // Evaluate each scheduled day
    workingDaysInRange.forEach(d => {
        const dateStr = formatDate(d);
        const presence = worker.presence[dateStr];
        if (presence && presence.present && presence.hours !== -baseHours) {
            workedDays++;
            supHours += presence.hours;
        } else if (presence && presence.present) {
            supHours += presence.hours;
        }
    });

    // Add supplementary hours from non-working days (extra work)
    const cursor2 = new Date(startDate);
    while (cursor2 <= endDate) {
        if (!workingDays.includes(cursor2.getDay())) {
            const dateStr = formatDate(cursor2);
            const presence = worker.presence[dateStr];
            if (presence && presence.present) {
                supHours += presence.hours;
            }
        }
        cursor2.setDate(cursor2.getDate() + 1);
    }

    return { workedDays, supHours };
}

// Calculate monthly pay with fair salary calculation
function calculateMonthlyPay(worker) {
    if (!worker) return 0;
    
    const startDate = new Date(summaryDateRange.start);
    const endDate = new Date(summaryDateRange.end);
    const baseHours = calculateWorkingHours(workingHours.start, workingHours.end);
    
    // Get all working days in the selected range
    const workingDaysInRange = [];
    let currentDate = new Date(startDate);
    
    while (currentDate <= endDate) {
        // Check if this day is a working day
        const dayOfWeek = currentDate.getDay();
        if (workingDays.includes(dayOfWeek)) {
            workingDaysInRange.push(new Date(currentDate));
        }
        currentDate.setDate(currentDate.getDate() + 1);
    }
    
    const totalWorkingDaysInRange = workingDaysInRange.length;
    if (totalWorkingDaysInRange === 0) return 0;
    
    // Calculate base salary (prorated for the date range)
    const daysInMonth = new Date(startDate.getFullYear(), startDate.getMonth() + 1, 0).getDate();
    const proratedMonthlyPay = (worker.monthlyPay / daysInMonth) * (endDate - startDate + 1) / (1000 * 60 * 60 * 24);
    
    // Count actual worked days and supplementary hours
    let workedDays = 0;
    let totalSupHours = 0;
    
    // Process each working day in range
    workingDaysInRange.forEach(date => {
        const dateStr = formatDate(date);
        const presence = worker.presence[dateStr];
        
        if (presence && presence.present) {
            workedDays++;
            totalSupHours += presence.hours;
        }
    });
    
    // Process non-working days (all hours are supplementary)
    const allDatesInRange = [];
    const currentDate2 = new Date(startDate);
    while (currentDate2 <= endDate) {
        const dayOfWeek = currentDate2.getDay();
        if (!workingDays.includes(dayOfWeek)) {
            const dateStr = formatDate(new Date(currentDate2));
            const presence = worker.presence[dateStr];
            if (presence && presence.present) {
                totalSupHours += presence.hours;
            }
        }
        currentDate2.setDate(currentDate2.getDate() + 1);
    }
    
    const dailyPay = worker.monthlyPay / 26;
    const hourlyRate = dailyPay / baseHours;
    const total = (workedDays * dailyPay) + (totalSupHours * hourlyRate);
    return total;
}

// Calculate total pay for all workers in the current month
function calculateGlobalMonthlyPay() {
    return workers.reduce((total, worker) => total + calculateMonthlyPay(worker), 0);
}

// Format date as YYYY-MM-DD
function formatDate(date){
    const y = date.getFullYear();
    const m = String(date.getMonth()+1).padStart(2,'0');
    const d = String(date.getDate()).padStart(2,'0');
    return `${y}-${m}-${d}`;
}

// Format currency
function formatCurrency(amount) {
    if (amount === undefined || amount === null || isNaN(amount)) {
        return '€0.00';
    }
    return `€${Number(amount).toFixed(2)}`;
}

// Move this to the top-level scope so it is available everywhere
function getCurrentRangeDailyPay(worker) {
    const startDate = summaryDateRange.start;
    const endDate = summaryDateRange.end;
    
    // Get all working days in the selected range (same logic as calculateMonthlyPay)
    const workingDaysInRange = [];
    let currentDate = new Date(startDate);
    
    while (currentDate <= endDate) {
        // Check if this day is a working day
        const dayOfWeek = currentDate.getDay();
        if (workingDays.includes(dayOfWeek)) {
            workingDaysInRange.push(new Date(currentDate));
        }
        currentDate.setDate(currentDate.getDate() + 1);
    }
    
    const theoreticalDays = workingDaysInRange.length;
    
    if (!worker || !worker.monthlyPay || theoreticalDays === 0) return 0;
    
    // Calculate prorated monthly pay for this range
    const typicalMonthWorkingDays = getWorkingDays(startDate.getFullYear(), startDate.getMonth()).length;
    const rangeToMonthRatio = typicalMonthWorkingDays > 0 ? theoreticalDays / typicalMonthWorkingDays : 0;
    const proratedMonthlyPay = worker.monthlyPay * rangeToMonthRatio;
    
    return worker.monthlyPay / 26;
}

// Update the calendar display
function updateCalendar() {
    const year = currentDate.getFullYear();
    const month = currentDate.getMonth();
    
    // Update month display
    const monthNames = ["January", "February", "March", "April", "May", "June",
        "July", "August", "September", "October", "November", "December"];
    document.getElementById('current-month').textContent = `${monthNames[month]} ${year}`;
    
    // Get first day of month and total days
    const firstDay = new Date(year, month, 1);
    const lastDay = new Date(year, month + 1, 0);
    const totalDays = lastDay.getDate();
    
    // Get current date for highlighting
    const today = new Date();
    const isCurrentMonth = today.getFullYear() === year && today.getMonth() === month;
    
    // Create calendar grid
    const calendarGrid = document.getElementById('calendar-grid');
    calendarGrid.innerHTML = '';
    
    // Update button label based on mode
    const groupBtn = document.getElementById('group-edit-btn');
    if (groupBtn) {
        groupBtn.textContent = groupEditMode ? 'Exit Group Edit' : 'Group Edit';
    }

    // Add day headers
    const dayNames = ['Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat', 'Sun'];
    dayNames.forEach(day => {
        const dayHeader = document.createElement('div');
        dayHeader.className = 'calendar-day-header';
        dayHeader.textContent = day;
        calendarGrid.appendChild(dayHeader);
    });
    
    // Add empty cells for days before first day of month
    let firstDayIndex = firstDay.getDay() === 0 ? 6 : firstDay.getDay() - 1;
    for (let i = 0; i < firstDayIndex; i++) {
        const emptyDay = document.createElement('div');
        emptyDay.className = 'calendar-day';
        calendarGrid.appendChild(emptyDay);
    }
    
    // Add days of the month
    for (let day = 1; day <= totalDays; day++) {
        const date = new Date(year, month, day);
        const dateStr = formatDate(date);
        
        const dayCell = document.createElement('div');
        dayCell.className = 'calendar-day';
        
        // Check if this is a non-working day
        const dayOfWeek = date.getDay();
        const isNonWorkingDay = !workingDays.includes(dayOfWeek);
        
        if (isNonWorkingDay) {
            dayCell.classList.add('non-working');
        }
        
        // Add blue border for current day
        if (isCurrentMonth && day === today.getDate()) {
            dayCell.style.background = '';
            dayCell.style.color = '';
            dayCell.style.border = '2px solid #007bff';
            dayCell.style.borderRadius = '4px';
        }
        
        if (!groupEditMode && !isNonWorkingDay) {
            dayCell.onclick = () => openDayEditModal(date);
        }
        
        const dayHeader = document.createElement('div');
        dayHeader.className = 'calendar-day-header';
        dayHeader.textContent = day;
        dayCell.appendChild(dayHeader);
        
        // Add present workers for this day
        workers.forEach(worker => {
            let presence = worker.presence[dateStr];
            const baseHours = calculateWorkingHours(workingHours.start, workingHours.end);
            if (!presence) {
                presence = { hours: 0, present: false };
            }
            if (groupEditMode || presence.present) {
                const workerPresence = document.createElement('div');
                workerPresence.className = 'worker-presence';
                
                const nameSpan = document.createElement('span');
                nameSpan.className = 'worker-name';
                nameSpan.textContent = worker.name;
                workerPresence.appendChild(nameSpan);
                
                if (groupEditMode) {
                    const switchDiv = document.createElement('div');
                    switchDiv.className = `presence-switch ${presence.present ? 'active' : ''}`;
                    switchDiv.style.marginLeft = '4px';
                    switchDiv.onclick = () => {
                        presence.present = !presence.present;
                        switchDiv.classList.toggle('active');
                        presence.hours = 0;
                        worker.presence[dateStr] = presence;
                        sendPresenceUpdate(worker.name, worker.monthlyPay, dateStr, presence.present, presence.hours);
                        updateMonthlySummary();
                        updateCalendar();
                    };
                    workerPresence.appendChild(switchDiv);
                } else {
                    const supHours = presence.hours;
                    if (supHours !== 0) {
                        const supHoursSpan = document.createElement('span');
                        supHoursSpan.className = 'worker-sup-hours';
                        supHoursSpan.style.display = 'block';
                        supHoursSpan.textContent = `Sup: ${supHours >= 0 ? '+' : ''}${supHours}`;
                        workerPresence.appendChild(supHoursSpan);
                    }
                }
                
                dayCell.appendChild(workerPresence);
            }
        });
        
        calendarGrid.appendChild(dayCell);
    }
}

// Update monthly summary
function updateMonthlySummary() {
    const summariesContainer = document.getElementById('worker-summaries');
    summariesContainer.innerHTML = '';
    
    const dateRangeText = `${summaryDateRange.start.toLocaleDateString()} - ${summaryDateRange.end.toLocaleDateString()}`;
    document.querySelector('.monthly-summary h3').textContent = `Summary (${dateRangeText})`;
    
    workers.forEach(worker => {
        const monthlyPay = calculateMonthlyPay(worker);
        const stats = calculateWorkerStats(worker);
        const summary = document.createElement('div');
        summary.className = 'worker-summary';
        summary.innerHTML = `
            <div class="worker-info">
                <span class="worker-name">${worker.name}</span>
                <div class="worker-stats">
                    <span>Worked Days: ${stats.workedDays}</span>
                    <span>Sup Hours: ${stats.supHours >= 0 ? '+' : ''}${stats.supHours.toFixed(1)}h</span>
                </div>
                <div class="worker-pay-info">
                    Monthly Pay: ${formatCurrency(worker.monthlyPay || 0)} |
                    Average Daily Pay: ${formatCurrency(getCurrentRangeDailyPay(worker))}
                </div>
            </div>
            <span class="worker-pay">${formatCurrency(monthlyPay)}</span>
        `;
        summariesContainer.appendChild(summary);
        
        let popupTimeout;
        summary.addEventListener('mouseenter', (e) => {
            popupTimeout = setTimeout(() => showCalculationPopup(worker, e), 500);
        });
        summary.addEventListener('mouseleave', () => {
            if (popupTimeout) {
                clearTimeout(popupTimeout);
                popupTimeout = null;
            }
            const existing = document.getElementById('calc-popup');
            if (existing) existing.remove();
        });
    });
    
    const globalTotal = document.getElementById('global-total');
    globalTotal.textContent = `Total Cost: ${formatCurrency(calculateGlobalMonthlyPay())}`;
}

// Navigation functions
function previousMonth() {
    currentDate.setMonth(currentDate.getMonth() - 1);
    updateCalendar();
    updateMonthlySummary();
}

function nextMonth() {
    currentDate.setMonth(currentDate.getMonth() + 1);
    updateCalendar();
    updateMonthlySummary();
}

// Employee modal functions
function openEmployeeModal() {
    const modal = document.getElementById('employee-modal');
    const employeeList = document.getElementById('employee-list');
    document.getElementById('employee-form').reset();
    document.getElementById('form-title').textContent = 'Add New Employee';
    employeeList.innerHTML = '';
    workers.forEach(worker => {
        if (!worker) return;
        const item = document.createElement('div');
        item.className = 'employee-item';
        const info = document.createElement('div');
        const monthlyPay = calculateMonthlyPay(worker);
        info.innerHTML = `
            <strong>${worker.name || 'Unnamed'}</strong><br>
            Monthly Pay: ${formatCurrency(worker.monthlyPay || 0)} |
            Average Daily Pay: ${formatCurrency(getCurrentRangeDailyPay(worker))}<br>
            Note: ${worker.note || ''}
        `;
        item.appendChild(info);
        const actions = document.createElement('div');
        const modBtn = document.createElement('button');
        modBtn.className = 'modify-btn';
        modBtn.textContent = 'Modifier';
        modBtn.onclick = () => toggleModifier(worker.id, modBtn);
        actions.appendChild(modBtn);
        const deleteBtn = document.createElement('button');
        deleteBtn.className = 'delete-btn';
        deleteBtn.textContent = 'Delete';
        deleteBtn.onclick = () => deleteEmployee(worker.id);
        actions.appendChild(deleteBtn);
        item.appendChild(actions);
        employeeList.appendChild(item);
    });
    modal.style.display = 'block';
}

function closeEmployeeModal() {
    const modal = document.getElementById('employee-modal');
    if (modal) modal.style.display = 'none';
    const form = document.getElementById('employee-form');
    if (form) form.reset();
    const nameInput = document.getElementById('employee-name');
    if (nameInput) nameInput.disabled = false;
    document.getElementById('form-title').textContent = 'Add New Employee';
}

let currentModifierId = null;
function toggleModifier(workerId, btn){
    const form = document.getElementById('employee-form');
    const nameInput = document.getElementById('employee-name');
    if(currentModifierId===workerId){
        form.reset();
        nameInput.disabled=false;
        currentModifierId=null;
        btn.textContent='Modifier';
        document.getElementById('form-title').textContent='Add New Employee';
        return;
    }
    currentModifierId=workerId;
    form.reset();
    const worker=workers.find(w=>w.id===workerId);
    if(!worker) return;
    document.getElementById('employee-id').value=worker.id;
    nameInput.value=worker.name;
    nameInput.disabled=false;
    document.getElementById('employee-monthly-pay').value=worker.monthlyPay;
    document.getElementById('employee-note').value=worker.note||'';
    document.getElementById('form-title').textContent='Modifier Employee';
    btn.textContent='Cancel';
}

async function deleteEmployee(workerId) {
    if (confirm('Are you sure you want to delete this employee?')) {
        await deleteWorkerInDb(workerId);
        const worker = workers.find(w => w.id === workerId);
        workers = workers.filter(w => w.id !== workerId);
        updateCalendar();
        updateMonthlySummary();
        openEmployeeModal();
    }
}

// Handle employee form submission
document.getElementById('employee-form').addEventListener('submit', async function (e) {
    e.preventDefault();

    const id = document.getElementById('employee-id').value;
    const name = document.getElementById('employee-name').value;
    const monthlyPay = parseFloat(document.getElementById('employee-monthly-pay').value);
    const note = document.getElementById('employee-note').value;

    if (currentModifierId) {
        const workerToUpdate = workers.find(w => w.id === currentModifierId);
        if (workerToUpdate) {
            const updatedData = { name, monthlyPay, note };
            const updatedWorker = await updateWorkerInDb(currentModifierId, updatedData);

            if (updatedWorker && updatedWorker._id) {
                const index = workers.findIndex(w => w.id === updatedWorker._id);
                if (index !== -1) {
                    workers[index] = { ...updatedWorker, id: updatedWorker._id };
                }
            } else {
                console.error('Failed to update worker.');
            }
        }
    } else {
        const newWorkerData = { name, monthlyPay, note };
        const createdWorker = await createWorkerInDb(newWorkerData);

        if (createdWorker && createdWorker._id) {
            const newWorkerWithId = { ...createdWorker, id: createdWorker._id };
            workers.push(newWorkerWithId);
            sendPresenceUpdate(newWorkerWithId.name, newWorkerWithId.monthlyPay, 'none', false, 0);
        } else {
            console.error('Failed to create worker.');
        }
    }

    closeEmployeeModal();
    updateCalendar();
    updateMonthlySummary();
    if (selectedDate) {
        const tempDate = selectedDate;
        closeDayEditModal();
        openDayEditModal(tempDate);
    }
    openEmployeeModal();
});

// Add a function to create and show a calculation popup
function showCalculationPopup(worker, event) {
    const existing = document.getElementById('calc-popup');
    if (existing) existing.remove();
    
    const startDate = summaryDateRange.start;
    const endDate = summaryDateRange.end;
    const workingDaysInRange = getWorkingDays(startDate.getFullYear(), startDate.getMonth())
        .filter(d => d >= startDate && d <= endDate);
    const theoreticalDays = workingDaysInRange.length;
    const baseHours = calculateWorkingHours(workingHours.start, workingHours.end);
    let actualWorkedDays = 0;
    let totalSupHours = 0;
    for (const d of workingDaysInRange) {
        const dateStr = formatDate(d);
        const presence = worker.presence[dateStr];
        if (presence && presence.present && presence.hours !== -baseHours) {
            actualWorkedDays++;
            totalSupHours += presence.hours;
        }
    }
    let prorata = theoreticalDays > 0 ? actualWorkedDays / theoreticalDays : 0;
    let baseSalary = worker.monthlyPay * prorata;
    let supHourRatio = theoreticalDays > 0 ? totalSupHours / (baseHours * theoreticalDays) : 0;
    let supHourAdjustment = worker.monthlyPay * supHourRatio;
    let total = baseSalary + supHourAdjustment;
    
    const popup = document.createElement('div');
    popup.id = 'calc-popup';
    popup.style.position = 'fixed';
    popup.style.left = event.clientX + 10 + 'px';
    popup.style.top = event.clientY + 10 + 'px';
    popup.style.background = '#fff';
    popup.style.border = '1px solid #ccc';
    popup.style.borderRadius = '6px';
    popup.style.boxShadow = '0 2px 8px rgba(0,0,0,0.15)';
    popup.style.padding = '16px';
    popup.style.zIndex = 1000;
    popup.style.minWidth = '260px';
    popup.style.pointerEvents = 'none';
    popup.innerHTML = `
        <strong>Calculation Breakdown</strong><br><br>
        Monthly Pay: ${formatCurrency(worker.monthlyPay)}<br>
        Theoretical Days: ${theoreticalDays}<br>
        Actual Worked Days: ${actualWorkedDays}<br>
        Sup Hours: ${totalSupHours}h<br>
        Base Salary: ${formatCurrency(baseSalary)}<br>
        Sup Hour Pay: ${formatCurrency(supHourAdjustment)}<br>
        <hr>
        <strong>Total: ${formatCurrency(total)}</strong><br>
        <small>Formula:<br>
        base = monthlyPay × (worked/theoretical)<br>
        sup = monthlyPay × (supHours/(baseHours×theoretical))<br>
        total = base + sup<br>
        <br>dailyPay = monthlyPay / 26<br>
        hourly = dailyPay / workingHours<br>
        total = dailyPay × workedDays ± supHours × hourly<br>
        Note: Days with -${baseHours.toFixed(1)}h sup are not counted as worked</small>
    `;
    document.body.appendChild(popup);
}

// Toggle group edit mode
function toggleGroupEditMode() {
    groupEditMode = !groupEditMode;
    updateCalendar();
}
window.toggleGroupEditMode = toggleGroupEditMode;

// Initialize the page
function initializePage() {
    initializeWorkers();
    initializeWorkingDays();
    initializeDateRangeInputs();
    updateCalendar();
    updateMonthlySummary();
}

document.addEventListener('DOMContentLoaded', initializePage);