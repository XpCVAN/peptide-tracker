// State management with localization
const state = {
    peptides: [],
    pins: [],
    settings: {
        apiKey: '',
        userName: 'User',
        notificationsEnabled: false,
        discreetMode: false,
        notificationTimes: {
            Night: '04:00',
            Morning: '08:00',
            Afternoon: '13:00',
            Evening: '20:00'
        }
    },
    currentPage: 'dashboard',
    scheduleOffset: 0,
    lastNotified: '',
    legalAccepted: false,
    plotterOffsetDays: 0,
    plotterMode: 'actual' // 'actual' or 'projected'
};

function loadState() {
    try {
        const p = localStorage.getItem('peptides');
        if(p) state.peptides = JSON.parse(p) || [];
        
        const pi = localStorage.getItem('pins');
        if(pi) state.pins = JSON.parse(pi) || [];
        
        const s = localStorage.getItem('settings');
        if(s) {
            const parsed = JSON.parse(s);
            state.settings = { ...state.settings, ...parsed };
        }
        
        const la = localStorage.getItem('legalAccepted');
        if(la) state.legalAccepted = JSON.parse(la);
    } catch (e) {
        console.error("State loading error:", e);
    }
}

function saveState() {
    localStorage.setItem('peptides', JSON.stringify(state.peptides));
    localStorage.setItem('pins', JSON.stringify(state.pins));
    localStorage.setItem('settings', JSON.stringify(state.settings));
    localStorage.setItem('legalAccepted', JSON.stringify(state.legalAccepted));
}

// --- Gemini API ---
async function callGemini(prompt) {
    if(!state.settings.apiKey) return null;
    try {
        const response = await fetch(`https://generativelanguage.googleapis.com/v1beta/models/gemini-1.5-flash:generateContent?key=${state.settings.apiKey}`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
                contents: [{ parts: [{ text: prompt }] }]
            })
        });
        const data = await response.json();
        return data.candidates[0].content.parts[0].text;
    } catch (e) {
        console.error("Gemini Error:", e);
        return "Error connecting to Gemini. Check your API key.";
    }
}

// Peptide Knowledge Base
const PEPTIDE_DB = {
    'BPC-157': {
        description: 'Body Protective Compound 157. Specialized for multi-tissue healing (tendons, muscles, gut, and ligaments).',
        commonDosage: '250',
        recommended: '250-500 mcg',
        unit: 'mcg',
        frequency: 'Daily',
        notes: 'Inject near site of injury or subcutaneously in abdomen.',
        presets: [
            { label: 'Standard Repair', desc: 'Consistent daily administration is the most studied protocol for chronic tissue repair.', type: 'interval', val: 1, timings: ['Morning'] },
            { label: 'Intense Healing', desc: 'Splitting doses (2x daily) maintains steady serum levels for continuous recovery pulses.', type: 'interval', val: 1, timings: ['Morning', 'Evening'] }
        ]
    },
    'TB-500': {
        description: 'Thymosin Beta-4. Promotes flexibility, muscle recovery, and powerful systemic healing.',
        commonDosage: '2.5',
        recommended: '2-5 mg',
        unit: 'mg',
        frequency: 'Twice weekly',
        notes: 'Systemic effect, can be injected subcutaneously anywhere.',
        presets: [
            { label: 'Twice Weekly', desc: 'The gold standard systemic protocol for inflammation and muscle flexibility.', type: 'weekly', val: 2, timings: ['Morning'] },
            { label: 'Maintenance', desc: 'A lower frequency to maintain anti-inflammatory benefits after initial healing.', type: 'weekly', val: 1, timings: ['Morning'] }
        ]
    },
    'CJC-1295 + Ipamorelin': {
        description: 'Growth hormone secretagogue blend. Increases natural GH production for anti-aging and recovery.',
        commonDosage: '200',
        recommended: '100-300 mcg',
        unit: 'mcg',
        frequency: 'Daily',
        notes: 'Best taken before bed or first thing in morning on empty stomach.',
        presets: [
            { label: '5/2 Anti-Aging', desc: '5 days on, 2 days off prevents receptor desensitization and maintains pituitary health.', type: 'weekly', val: 5, timings: ['Evening'] },
            { label: 'Nightly Pulse', desc: 'Timed before sleep to synergize with the body\'s natural growth hormone release.', type: 'interval', val: 1, timings: ['Evening'] }
        ]
    },

    'Semaglutide': {
        description: 'GLP-1 receptor agonist. Gold standard for metabolic health and weight management.',
        commonDosage: '0.25',
        recommended: '0.25 mg - 2.4 mg',
        unit: 'mg',
        halfLife: 7,
        tMax: 1.5,
        ka: 2.1,
        frequency: 'Weekly',
        notes: 'Clinical Tmax is typically 24-36 hours.',
        presets: [
            { label: 'Standard Weekly', desc: 'Administer every 7 days to maintain stable glycemic and appetite control.', type: 'interval', val: 7, timings: ['Morning'] }
        ]
    },
    'Retatrutide': {
        description: 'Triple agonist (GLP-1, GIP, GCGR). Potent next-gen metabolic and fat loss research compound.',
        commonDosage: '2',
        recommended: '1 mg (Start) up to 12 mg (Max)',
        unit: 'mg',
        halfLife: 6,
        tMax: 1.5,
        ka: 3.0,
        frequency: 'Weekly',
        notes: 'Clinical half-life ~6d (Phase 2/3 data). Tmax ~36h. Ka derived from Tmax formula.',
        presets: [
            { label: 'Standard Weekly', desc: 'Long-acting triple agonist requires only one administration every 7 days.', type: 'interval', val: 7, timings: ['Morning'] },
            { label: '5-Day Optimization', desc: 'Minimizes peak/trough variance for improved metabolic stability.', type: 'interval', val: 5, timings: ['Evening'] }
        ]
    },
    'Tirzepatide': {
        description: 'Dual GIP/GLP-1 agonist. Extremely potent for weight loss and blood sugar stability.',
        commonDosage: '2.5',
        recommended: '2.5 mg - 15 mg',
        unit: 'mg',
        halfLife: 5,
        tMax: 2,
        ka: 1.2,
        frequency: 'Weekly',
        notes: 'Clinical Tmax is typically 24-48 hours.',
        presets: [
            { label: 'Standard Weekly', desc: 'Dual agonist pathway is optimally engaged with a 7-day steady interval.', type: 'interval', val: 7, timings: ['Morning'] }
        ]
    },
    'GHK-Cu': {
        description: 'Copper Peptide. Enhances collagen production, skin health, and wound healing.',
        commonDosage: '1',
        recommended: '1-2 mg',
        unit: 'mg',
        frequency: 'Daily',
        notes: 'Can be slightly painful at injection site (sting). Use dilute solutions.',
        presets: [
            { label: '30-Day Cyclical', desc: 'Cycles of 30 days are standard to maximize collagen synthesis without copper saturation.', type: 'interval', val: 1, timings: ['Morning'] }
        ]
    },
    'Tesamorelin': {
        description: 'GHRH analogue. Primarily used for visceral fat loss and cognitive health.',
        commonDosage: '2',
        recommended: '2 mg',
        unit: 'mg',
        frequency: 'Daily',
        notes: '5 days on, 2 days off is a common experimental protocol.',
        presets: [
            { label: '5/2 Fat Loss', desc: 'Focuses on visceral adipose tissue reduction while allowing 2 days of recovery.', type: 'weekly', val: 5, timings: ['Evening'] }
        ]
    },
    'Epitalon': {
        description: 'The "longevity peptide". Stimulates telomerase production to slow cellular aging.',
        commonDosage: '10',
        recommended: '10 mg',
        unit: 'mg',
        frequency: 'Daily',
        notes: 'Often used for 10-day cycles every 6 months.',
        presets: [
            { label: '10-Day Burst', desc: 'High-intensity short cycle designed to trigger telomerase activity annually.', type: 'interval', val: 1, timings: ['Evening'] }
        ]
    }
};

function startApp() {
    loadState();
    initNavigation();
    
    if (!state.legalAccepted) {
        showLegalModal();
    } else {
        renderPage('dashboard');
    }
    
    initRipples();
    initNotifications();
    
    document.querySelector('.settings-btn')?.addEventListener('click', showSettingsModal);
}

function initRipples() {
    document.addEventListener('click', (e) => {
        const target = e.target.closest('.ripple');
        if (!target) return;
        const ripple = document.createElement('span');
        ripple.classList.add('ripple-effect');
        const rect = target.getBoundingClientRect();
        const size = Math.max(rect.width, rect.height);
        ripple.style.width = ripple.style.height = `${size}px`;
        ripple.style.left = `${e.clientX - rect.left - size/2}px`;
        ripple.style.top = `${e.clientY - rect.top - size/2}px`;
        target.appendChild(ripple);
        setTimeout(() => ripple.remove(), 600);
    });
}

function initNavigation() {
    document.querySelectorAll('.nav-item, .tab-item').forEach(item => {
        item.addEventListener('click', () => {
            const page = item.getAttribute('data-page');
            document.querySelectorAll('.nav-item, .tab-item').forEach(nav => {
                nav.classList.toggle('active', nav.getAttribute('data-page') === page);
            });
            renderPage(page);
        });
    });
}

function renderPage(page) {
    state.currentPage = page;
    const contentArea = document.getElementById('content-area');
    const pageTitle = document.getElementById('page-title');
    contentArea.style.opacity = '0';
    contentArea.style.transform = 'translateY(10px)';
    
    setTimeout(() => {
        try {
            switch(page) {
                case 'dashboard': pageTitle.innerText = 'Field Status'; renderDashboard(contentArea); break;
                case 'peptides': pageTitle.innerText = 'Research Suite'; renderPeptides(contentArea); break;
                case 'calendar': pageTitle.innerText = 'Research Log'; renderCalendar(contentArea); break;
                case 'plotter': pageTitle.innerText = 'GLP Plotter'; renderPlotter(contentArea); break;
                case 'assistant': pageTitle.innerText = 'Peptide AI Research'; renderAssistant(contentArea); break;
            }
        } catch (err) {
            console.error("Render error:", err);
            contentArea.innerHTML = `<div class="glass-card">Error: ${err.message}</div>`;
        }
        contentArea.style.transition = 'all 0.3s var(--ease-out)';
        contentArea.style.opacity = '1';
        contentArea.style.transform = 'translateY(0)';
    }, 100);
}

// --- Logic ---
function generateScheduleForDate(date) {
    const pinsForDay = [];
    const dateStr = date.toISOString().split('T')[0];
    
    state.peptides.forEach((p, pIdx) => {
        let shouldPinOnDay = false;
        
        const anchorDate = p.startDate ? new Date(p.startDate) : new Date();
        anchorDate.setHours(0,0,0,0);
        const currentTargetDate = new Date(date);
        currentTargetDate.setHours(0,0,0,0);
        
        const diffDays = Math.floor((currentTargetDate - anchorDate) / (1000 * 60 * 60 * 24));
        
        if (p.freqType === 'interval' || p.freqType === 'custom') {
            const interval = p.intervalDays || 1;
            if (diffDays >= 0 && diffDays % interval === 0) shouldPinOnDay = true;
        } else {
            const dayOfWeek = (currentTargetDate.getDay() + 6) % 7;
            const count = p.weekly || 7;
            if (count === 7) shouldPinOnDay = true;
            else if (count === 1 && dayOfWeek === 0) shouldPinOnDay = true;
            else if (count === 2 && (dayOfWeek === 0 || dayOfWeek === 3)) shouldPinOnDay = true;
            else if (count === 3 && (dayOfWeek === 0 || dayOfWeek === 2 || dayOfWeek === 4)) shouldPinOnDay = true;
            else if (dayOfWeek < count) shouldPinOnDay = true;
        }
        
        if(shouldPinOnDay) {
            const timings = p.timings && p.timings.length > 0 ? p.timings : ['Scheduled'];
            timings.forEach((time) => {
                const pinId = `${dateStr}|${p.name}|${time}`;
                const log = state.pins.find(pin => pin.pinId === pinId);
                const unitInfo = p.recon && p.recon.units ? ` | <span style="color: var(--accent-cyan); font-weight: 700;">${p.recon.units} Units</span>` : '';
                
                pinsForDay.push({ 
                    id: pinId,
                    name: p.name, 
                    timing: time,
                    dosage: `${p.dosage}${p.unit || 'mcg'}${unitInfo}`,
                    rawDosage: p.dosage,
                    unit: p.unit,
                    isTaken: !!log,
                    takenAt: log ? log.timestamp : null
                });
            });
        }
    });
    return pinsForDay;
}

window.logDose = function(id, name, dosage, timing) {
    const existingIndex = state.pins.findIndex(p => p.pinId === id);
    if (existingIndex > -1) {
        // Toggle off (Undo)
        state.pins.splice(existingIndex, 1);
    } else {
        // Log at current time
        state.pins.push({
            pinId: id,
            name: name,
            dosage: dosage,
            timing: timing,
            timestamp: new Date().toISOString()
        });
    }
    saveState();
    renderPage(state.currentPage);
};

window.editDoseTime = function(id) {
    showEditDoseModal(id);
};

// --- Notifications ---
// Helper: send notification via the service worker so it works in background
async function showPWANotification(title, body, tag = 'peptai-reminder') {
    if (Notification.permission !== 'granted') return;
    
    try {
        const reg = await navigator.serviceWorker.ready;
        reg.active.postMessage({
            type: 'SHOW_NOTIFICATION',
            title,
            body,
            tag,
            icon: '/icon-192.png'
        });
    } catch (err) {
        // Fallback to basic Notification if SW not available
        new Notification(title, { body, icon: '/icon-192.png', tag });
    }
}

function initNotifications() {
    if ('Notification' in window) {
        if (Notification.permission === 'default' && state.settings.notificationsEnabled) {
            Notification.requestPermission();
        }
    }
    
    // Check reminders every 60 seconds
    setInterval(checkReminders, 60000);
    checkReminders();
}

function checkReminders() {
    if (!state.settings.notificationsEnabled || Notification.permission !== "granted") return;

    const now = new Date();
    const h = now.getHours();
    const m = now.getMinutes();
    const dateStr = now.toISOString().split('T')[0];
    
    // Defined Windows from settings
    const times = state.settings.notificationTimes || { Morning: '08:00', Afternoon: '13:00', Evening: '20:00' };
    const windows = Object.entries(times).map(([key, time]) => ({ key, hour: parseInt(time.split(':')[0]) }));

    const pins = generateScheduleForDate(now);

    windows.forEach(win => {
        // Trigger if current hour >= window hour AND dose not taken
        if (h >= win.hour) {
            const pending = pins.filter(p => p.timing === win.key && !p.isTaken);
            
            // Filter by individual peptide reminders
            const toNotify = pending.filter(p => {
                const parent = state.peptides[p.pIndex];
                return parent && parent.remindersEnabled !== false;
            });

            if (toNotify.length > 0) {
                const bucketKey = `${dateStr}-${win.key}-${h}`;

                if (!state.notifiedBuckets[bucketKey]) {
                    const title = state.settings.discreetMode ? 'Lab Testing Due' : 'Peptide Protocol Reminder';
                    const body = state.settings.discreetMode
                        ? 'Research administration is scheduled for this window.'
                        : `Time for your ${toNotify.map(p => p.name).join(', ')} dose.`;

                    showPWANotification(title, body, win.key);

                    state.notifiedBuckets[bucketKey] = true;
                    saveState();
                }
            }
        }
    });
}

window.testNotification = function() {
    if (Notification.permission !== 'granted') {
        Notification.requestPermission().then(res => {
            if (res === 'granted') {
                showPWANotification('PeptAI', 'Laboratory alerts are now active. Research synchronized.');
            }
        });
    } else {
        showPWANotification('PeptAI', 'Laboratory alerts are active. Research synchronized.');
    }
};

function getNextPin() {
    const today = new Date();
    for(let i = 0; i < 30; i++) {
        const d = new Date(today);
        d.setDate(today.getDate() + i);
        const pins = generateScheduleForDate(d);
        if(pins.length > 0) {
            const untaken = pins.find(p => !p.isTaken);
            if (untaken || i > 0) {
                const target = untaken || pins[0];
                return { 
                    date: d.toLocaleDateString('en-US', {month: 'short', day: 'numeric'}), 
                    peptide: `${target.name} (${target.timing})`,
                    rawPin: target 
                };
            }
        }
    }
    return null;
}

// --- Renderers ---
function renderDashboard(container) {
    const today = new Date();
    const todayPins = generateScheduleForDate(today);
    const count = state.peptides.length;
    
    // Adherence Calculation
    const total = todayPins.length;
    const taken = todayPins.filter(p => p.isTaken).length;
    const progress = total > 0 ? (taken / total) * 100 : 0;

    // Grouping
    const buckets = {
        'Morning': todayPins.filter(p => p.timing === 'Morning'),
        'Afternoon': todayPins.filter(p => p.timing === 'Afternoon'),
        'Evening': todayPins.filter(p => p.timing === 'Evening'),
        'Scheduled': todayPins.filter(p => !['Morning', 'Afternoon', 'Evening'].includes(p.timing))
    };

    const bucketIcons = { 'Morning': '🌅', 'Afternoon': '☀️', 'Evening': '🌙', 'Scheduled': '📋' };

    container.innerHTML = `
        <div class="progress-header">
            <div class="progress-info">
                <div>
                    <span style="font-size: 0.8rem; color: var(--text-secondary);">Today's Adherence</span>
                    <div style="font-size: 1.2rem; font-weight: 800;">${taken} of ${total} Doses Logged</div>
                </div>
                <div style="text-align: right;">
                    <span style="font-size: 1.2rem; font-weight: 800; color: var(--accent-cyan);">${Math.round(progress)}%</span>
                </div>
            </div>
            <div class="progress-track">
                <div class="progress-fill" style="width: ${progress}%"></div>
            </div>
        </div>

        <div class="dashboard-stats" style="margin-bottom: 30px; display: block;">
            <div class="glass-card stat-card" style="width: 100%; text-align: center;">
                <span class="stat-label">Active Research Trials</span>
                <span class="stat-value">${count}</span>
            </div>
        </div>
      </div>

        <div class="section-header">
            <h2>Today's Sequence</h2>
        </div>

        <div class="timeline-container">
            ${total === 0 ? `
                <div class="glass-card" style="padding: 3rem; text-align: center; opacity: 0.6;">
                    <div style="font-size: 3rem; margin-bottom: 10px;">🧪</div>
                    <p>No research scheduled for today.</p>
                </div>
            ` : Object.keys(buckets).map(b => {
                if (buckets[b].length === 0) return '';
                return `
                    <div class="timeline-bucket">
                        <div class="bucket-header">${bucketIcons[b]} ${b}</div>
                        ${buckets[b].map(p => `
                            <div class="glass-card timeline-item" style="border-left: 3px solid ${p.isTaken ? 'var(--accent-cyan)' : 'rgba(255,255,255,0.1)'}; display: flex; justify-content: space-between; align-items: center; padding: 15px; opacity: ${p.isTaken ? '0.7' : '1'}">
                                <div>
                                    <div style="font-weight: 700; ${p.isTaken ? 'text-decoration: line-through;' : ''}">${p.name}</div>
                                    <div style="font-size: 0.75rem; color: var(--text-secondary);">${p.isTaken ? `✅ Logged at ${new Date(p.takenAt).toLocaleTimeString([], {hour: '2-digit', minute:'2-digit'})}` : p.dosage}</div>
                                </div>
                                <div>
                                    ${p.isTaken ? `
                                        <button class="chat-input ripple" onclick="editDoseTime('${p.id}')" style="font-size: 0.7rem; border: none; background: rgba(255,255,255,0.05);">Edit</button>
                                    ` : `
                                        <button class="send-btn ripple" onclick="logDose('${p.id}', '${p.name}', '${p.rawDosage}', '${p.timing}')" style="padding: 8px 15px; font-size: 0.7rem;">Log</button>
                                    `}
                                </div>
                            </div>
                        `).join('')}
                    </div>
                `;
            }).join('')}
        </div>
    `;
}

function renderPeptides(container) {
    container.innerHTML = `
        <div style="display: flex; justify-content: space-between; align-items: center; margin-bottom: 30px;">
            <div>
                <p style="font-size: 0.8rem; color: var(--text-secondary); margin: 0;">Active Sequences</p>
                <h2 style="margin: 0;">Research Library</h2>
            </div>
            <button class="send-btn ripple" onclick="showAddPeptideModal()" style="padding: 10px 20px;">+ New Protocol</button>
        </div>
        <div class="peptide-grid" style="display: grid; grid-template-columns: repeat(auto-fill, minmax(300px, 1fr)); gap: 20px;">
            ${state.peptides.length === 0 ? `
                <div class="glass-card" style="padding: 60px 20px; text-align: center; grid-column: 1 / -1;">
                    <div style="font-size: 4rem; opacity: 0.2; margin-bottom: 20px;">🔬</div>
                    <h3 style="margin-bottom: 10px;">Laboratory Empty</h3>
                    <p style="color: var(--text-secondary); margin-bottom: 25px;">No research protocols have been initialized in this environment.</p>
                    <button class="send-btn ripple" onclick="showAddPeptideModal()" style="width: auto; padding: 12px 30px;">Initialize First Protocol</button>
                </div>
            ` : state.peptides.map((p, i) => `
                <div class="glass-card peptide-card" style="transition: all 0.3s ease; position: relative; padding-top: 25px;">
                    <button onclick="showProtocolOptions(${i})" style="position: absolute; top: 12px; right: 12px; background: rgba(255,255,255,0.05); border: none; border-radius: 6px; width: 28px; height: 28px; display: flex; align-items: center; justify-content: center; cursor:pointer; color: var(--accent-cyan); font-size: 0.9rem;" title="Manage Protocol">⚙️</button>
                    <div style="display: flex; justify-content: space-between; align-items: start;">
                        <div>
                            <h3 style="color: var(--accent-cyan); margin: 0; font-size: 1.2rem;">${p.name}</h3>
                            <div style="font-size: 0.75rem; color: var(--text-secondary); margin-top: 4px;">${p.freqType === 'weekly' ? `${p.weekly} Days/Week` : `Every ${p.intervalDays} Days`}</div>
                        </div>
                    </div>
                    <div style="font-size: 0.85rem; margin-top: 20px; line-height: 1.8; padding-top: 15px; border-top: 1px dashed rgba(255,255,255,0.1);">
                        <div style="display: flex; justify-content: space-between; margin-bottom: 5px;">
                            <span style="color: var(--text-secondary);">Target Dosage:</span> 
                            <span style="font-weight: 700; color: #fff;">${p.dosage}${p.unit}</span>
                        </div>
                        <div style="display: flex; justify-content: space-between; margin-bottom: 5px;">
                            <span style="color: var(--text-secondary);">Admin Window:</span> 
                            <span style="font-weight: 700; color: #fff;">${p.timings.join(' & ')}</span>
                        </div>
                        ${p.recon && p.recon.units ? `
                        <div style="margin-top: 12px; padding: 10px; background: rgba(0, 242, 254, 0.05); border-radius: 8px; border-left: 3px solid var(--accent-cyan);">
                            <span style="font-size: 0.75rem; display: block; color: var(--accent-cyan); font-weight: 700;">RECONSTITUTION GUIDE</span>
                            <span style="font-size: 0.9rem; font-weight: 800;">${p.recon.units} Units</span> <span style="font-size: 0.7rem; color: var(--text-secondary);">per injection (U-100)</span>
                        </div>` : ''}
                    </div>
                </div>
            `).join('')}
        </div>
    `;
}

function renderCalendar(container) {
    const today = new Date();
    const target = new Date(today);
    target.setDate(today.getDate() + (state.scheduleOffset || 0));
    const pins = generateScheduleForDate(target);

    container.innerHTML = `
        <div class="glass-card" style="text-align: center; margin-bottom: 20px;">
            <div style="display: flex; justify-content: space-between; align-items: center; margin-bottom: 25px;">
                <button class="chat-input ripple" onclick="changeDay(-1)" style="border:none; background: rgba(255,255,255,0.05); padding: 5px 15px;">←</button>
                <div onclick="setDay(0)" style="cursor:pointer;">
                    <h2 style="color: var(--accent-cyan); margin: 0;">${target.toLocaleDateString('en-US', {month: 'long', day: 'numeric'})}</h2>
                    <div style="font-size: 0.8rem; color: var(--text-secondary);">${target.toLocaleDateString('en-US', {weekday: 'long'})}</div>
                </div>
                <button class="chat-input ripple" onclick="changeDay(1)" style="border:none; background: rgba(255,255,255,0.05); padding: 5px 15px;">→</button>
            </div>
            
            <div style="display: flex; flex-direction: column; gap: 12px;">
                ${pins.length === 0 ? `
                    <div style="padding: 40px 20px; color: var(--text-secondary); opacity: 0.5;">
                        <div style="font-size: 2rem; margin-bottom: 10px;">🍃</div>
                        No pinning research scheduled for this date.
                    </div>
                ` : pins.map(p => {
                    const takenTime = p.takenAt ? new Date(p.takenAt).toLocaleTimeString([], {hour: '2-digit', minute:'2-digit'}) : '';
                    return `
                        <div class="glass-card" style="text-align: left; padding: 15px; border-left: 4px solid ${p.isTaken ? 'var(--accent-cyan)' : 'rgba(255,255,255,0.1)'}; display: flex; justify-content: space-between; align-items: center; opacity: ${p.isTaken ? '0.7' : '1'}">
                            <div style="flex: 1;">
                                <div style="font-weight: 700; ${p.isTaken ? 'text-decoration: line-through;' : ''}">${p.name} <span style="font-size: 0.7rem; color: var(--text-secondary); font-weight: normal;">(${p.timing})</span></div>
                                <div style="font-size: 0.75rem; color: ${p.isTaken ? 'var(--accent-cyan)' : 'var(--text-secondary)'}; margin-top: 2px;">
                                    ${p.isTaken ? `✅ Taken at ${takenTime}` : p.dosage}
                                </div>
                            </div>
                            <div style="display: flex; gap: 8px;">
                                ${p.isTaken ? `
                                    <button class="chat-input ripple" onclick="editDoseTime('${p.id}')" style="font-size: 0.7rem; padding: 8px; border:none; background: rgba(255,255,255,0.05);">Edit</button>
                                    <button class="chat-input ripple" onclick="logDose('${p.id}', '${p.name}', '${p.rawDosage}', '${p.timing}')" style="font-size: 0.7rem; padding: 8px; border:none; background: rgba(255, 107, 107, 0.1); color: #ff6b6b;">Undo</button>
                                ` : `
                                    <button class="send-btn ripple" onclick="logDose('${p.id}', '${p.name}', '${p.rawDosage}', '${p.timing}')" style="font-size: 0.75rem; padding: 8px 15px;">Mark Taken</button>
                                `}
                            </div>
                        </div>
                    `;
                }).join('')}
            </div>
        </div>
        
        ${state.scheduleOffset !== 0 ? `
            <button class="chat-input ripple" onclick="setDay(0)" style="width: 100%; border: none; background: rgba(0, 242, 254, 0.1); color: var(--accent-cyan); font-weight: 700; margin-top: 10px;">Reset to Today</button>
        ` : ''}
    `;
}

function renderAssistant(container) {
    container.innerHTML = `
        <div class="glass-card chat-window">
            <div class="chat-messages" id="chat-messages">
                <div class="message ai">Hello ${state.settings.userName}. I am the Peptide AI Research system. I have indexed your current protocols and administration windows. How can I assist your laboratory work today?</div>
            </div>
            <div class="chat-input-area">
                <input type="text" id="chat-input" class="chat-input" placeholder="Ask about dosages or timing...">
                <button class="send-btn" onclick="handleChatMessage()">Send</button>
            </div>
            <p style="font-size: 0.65rem; color: var(--text-secondary); text-align: center; margin-top: 15px; opacity: 0.6; line-height: 1.4; padding: 0 20px;">
                ⚠️ <strong>Regulatory Notice:</strong> Peptide AI Research is an automated analytical system. Content generated is for informational research purposes only and strictly does not constitute medical advice, diagnosis, or clinical guidance.
            </p>
        </div>
    `;
}

// --- Modals ---
function showAddPeptideModal(editIndex = -1) {
    const modal = document.getElementById('modal-container');
    const modalContent = modal.querySelector('.modal-content');
    modal.classList.remove('hidden');
    
    let currentStep = 1;
    let wizardData = editIndex > -1 ? { ...state.peptides[editIndex] } : {
        name: '',
        dosage: '',
        unit: 'mcg',
        freqType: 'interval',
        intervalDays: 7,
        weekly: 7,
        label: 'Standard Weekly',
        timings: ['Morning'],
        startDate: new Date().toISOString().split('T')[0],
        notes: '',
        remindersEnabled: true,
        recon: { units: 0 },
        halfLife: 7
    };

    const renderWizard = () => {
        const progress = (currentStep / 5) * 100;
        
        modalContent.innerHTML = `
            <div class="wizard-progress"><div class="wizard-progress-fill" style="width: ${progress}%"></div></div>
            <div style="position: absolute; top: 16px; right: 20px; z-index: 30;">
                <button class="chat-input ripple" onclick="closeModal()" style="border: none; background: rgba(255,255,255,0.08); width: 32px; height: 32px; border-radius: 50%; display: flex; align-items: center; justify-content: center; padding: 0; color: #fff;">✕</button>
            </div>
            <div class="wizard-container" style="padding-top: 15px;">
                ${renderStepContent()}
            </div>
            <div class="wizard-nav">
                <button class="chat-input ripple" id="wiz-prev" ${currentStep === 1 ? 'style="opacity:0; pointer-events:none;"' : ''}>Back</button>
                <div style="flex: 1;"></div>
                <button class="send-btn ripple" id="wiz-next">${currentStep === 5 ? 'Launch Protocol' : 'Next'}</button>
            </div>
        `;
        
        attachWizardEvents();
    };

    const renderStepContent = () => {
        switch(currentStep) {
            case 1: return `
                <div class="wizard-step active">
                    <h2 style="margin-bottom: 5px;">Choose Compound</h2>
                    <p style="color: var(--text-secondary); font-size: 0.85rem; margin-bottom: 20px;">Select your primary research substance.</p>
                    <div style="display: grid; grid-template-columns: 1fr; gap: 10px; max-height: 300px; overflow-y: auto; padding-right: 5px;">
                        ${Object.keys(PEPTIDE_DB).map(k => `
                            <div class="glass-card ripple peptide-opt ${wizardData.name === k ? 'active' : ''}" data-name="${k}" style="margin:0; cursor:pointer; padding: 15px; border: 1px solid ${wizardData.name === k ? 'var(--accent-cyan)' : 'var(--glass-border)'};">
                                <div style="display: flex; justify-content: center; align-items: center;">
                                    <span style="font-weight: 700; color: ${wizardData.name === k ? 'var(--accent-cyan)' : 'inherit'}">${k}</span>
                                </div>
                            </div>
                        `).join('')}
                        <div class="glass-card ripple peptide-opt" data-name="Custom" style="margin:0; cursor:pointer; padding: 15px; border: 1px dashed var(--glass-border); text-align: center;">
                            <span style="font-size: 0.8rem; color: var(--text-secondary);">+ Custom Compound</span>
                        </div>
                    </div>
                </div>
            `;
            case 2: return `
                <div class="wizard-step active">
                    <h2 style="margin-bottom: 5px;">Set Dosage</h2>
                    <p style="color: var(--text-secondary); font-size: 0.85rem; margin-bottom: 20px;">Precision amount for ${wizardData.name}.</p>
                    <div style="background: rgba(0,0,0,0.2); padding: 20px; border-radius: 16px; border: 1px solid var(--glass-border);">
                        <div style="display: flex; justify-content: space-between; margin-bottom: 8px;">
                            <label style="font-size: 0.75rem; color: var(--text-secondary);">Target Dose</label>
                            <span style="font-size: 0.75rem; color: var(--accent-cyan); font-weight: 600;">${PEPTIDE_DB[wizardData.name]?.recommended || ''}</span>
                        </div>
                        <div style="display: flex; gap: 10px; align-items: center;">
                            <input type="number" id="w-dose" class="chat-input" style="font-size: 1.5rem; text-align: center;" value="${wizardData.dosage || PEPTIDE_DB[wizardData.name]?.commonDosage || ''}">
                            <span style="color: var(--text-secondary); font-weight: 600;">${wizardData.unit}</span>
                        </div>
                        
                        </div>

                        <div style="margin-top: 20px; border-top: 1px dashed var(--glass-border); padding-top: 15px;">
                            <button id="w-calc-toggle" style="background:transparent; border:none; color:var(--accent-cyan); font-size:0.75rem; cursor:pointer; padding:0;">Optional: Use Reconstitution Calculator</button>
                            <div id="w-calc-fields" style="display:none; flex-direction:column; gap:10px; margin-top:15px;">
                                <div style="display: grid; grid-template-columns: 1fr 1fr; gap: 10px;">
                                    <input type="number" id="w-vial" class="chat-input" placeholder="Vial mg">
                                    <input type="number" id="w-water" class="chat-input" placeholder="BAC ml" step="0.5">
                                </div>
                                <div id="w-calc-res" style="background:rgba(0,242,254,0.1); padding:10px; border-radius:12px; text-align:center; display:none;">
                                    <span style="font-size: 0.8rem;">Result:</span> <strong id="w-units" style="color: var(--accent-cyan); font-size: 1.1rem;">0</strong> <span style="font-size: 0.7rem;">Units (U-100)</span>
                                </div>
                            </div>
                        </div>
                    </div>
                </div>
            `;
            case 3: 
                const presets = PEPTIDE_DB[wizardData.name]?.presets || [
                    { label: 'Daily', desc: 'Standard 24-hour administration cycle.', type: 'interval', val: 1, timings: ['Morning'] },
                    { label: 'EOD', desc: 'Every Other Day protocol to minimize injection frequency.', type: 'interval', val: 2, timings: ['Morning'] },
                    { label: 'Weekly', desc: 'Maintenance administration every 7 days.', type: 'interval', val: 7, timings: ['Morning'] }
                ];
                return `
                <div class="wizard-step active">
                    <h2 style="margin-bottom: 5px;">Pinning Pattern</h2>
                    <p style="color: var(--text-secondary); font-size: 0.85rem; margin-bottom: 20px;">Clinically-informed cycles for ${wizardData.name}.</p>
                    
                    <div style="display: flex; flex-wrap: wrap; gap: 8px; margin-bottom: 15px;">
                        ${presets.map(p => `
                            <div class="preset-chip ${wizardData.label === p.label ? 'active' : ''}" 
                                 data-type="${p.type}" 
                                 data-val="${p.val}" 
                                 data-timings="${p.timings.join(',')}"
                                 data-label="${p.label}"
                                 data-desc="${p.desc}">
                                ${p.label}
                            </div>
                        `).join('')}
                        <div class="preset-chip" data-type="custom">Custom</div>
                    </div>

                    <div id="wiz-explainer" style="background: rgba(0, 242, 254, 0.05); padding: 15px; border-radius: 12px; border: 1px solid rgba(0, 242, 254, 0.2); margin-bottom: 15px; min-height: 60px;">
                        <span style="font-size: 0.7rem; color: var(--accent-cyan); text-transform: uppercase; font-weight: 700; display: block; margin-bottom: 5px;">Why this protocol?</span>
                        <p id="wiz-desc" style="font-size: 0.8rem; line-height: 1.4; color: var(--text-secondary);">Select a preset to view clinical reasoning.</p>
                    </div>

                    <div id="custom-freq-box" style="display: ${wizardData.freqType === 'custom' ? 'block' : 'none'}; background: rgba(0,0,0,0.2); padding: 15px; border-radius: 12px; border: 1px solid var(--glass-border);">
                        <label style="font-size: 0.7rem; color: var(--text-secondary); display: block; margin-bottom: 8px;">Custom Interval (Days)</label>
                        <input type="number" id="w-interval" class="chat-input" style="width: 100%;" value="${wizardData.intervalDays}">
                    </div>
                </div>
            `;
            case 4: return `
                <div class="wizard-step active">
                    <h2 style="margin-bottom: 5px;">Timing & Intensity</h2>
                    <p style="color: var(--accent-cyan); font-size: 1.1rem; font-weight: 800; margin-bottom: 20px;"><strong id="w-intensity">${wizardData.timings.length} Pin${wizardData.timings.length !== 1 ? 's' : ''} per Day</strong></p>
                    
                    <label style="font-size: 0.75rem; color: var(--text-secondary); display: block; margin-bottom: 10px;">Administration Slots</label>
                    <div style="display: grid; grid-template-columns: repeat(2, 1fr); gap: 10px; margin-bottom: 25px;">
                        <label class="timing-opt"><input type="checkbox" value="Morning" ${wizardData.timings.includes('Morning') ? 'checked' : ''}> 🌅<span>Morning</span></label>
                        <label class="timing-opt"><input type="checkbox" value="Afternoon" ${wizardData.timings.includes('Afternoon') ? 'checked' : ''}> ☀️<span>Afternoon</span></label>
                        <label class="timing-opt"><input type="checkbox" value="Evening" ${wizardData.timings.includes('Evening') ? 'checked' : ''}> 🌙<span>Evening</span></label>
                        <label class="timing-opt"><input type="checkbox" value="Night" ${wizardData.timings.includes('Night') ? 'checked' : ''}> 🌌<span>Night</span></label>
                    </div>

                    <label style="font-size: 0.75rem; color: var(--text-secondary); display: block; margin-bottom: 10px;">Sequence Start Date</label>
                    <input type="date" id="w-start" class="chat-input" value="${wizardData.startDate}">
                </div>
            `;
            case 5: return `
                <div class="wizard-step active" style="text-align: center;">
                    <div style="font-size: 3.5rem; margin-bottom: 12px; opacity: 0.9;">🧬</div>
                    <h2 style="margin-bottom: 5px;">Protocol Verification</h2>
                    <p style="color: var(--text-secondary); font-size: 0.85rem; margin-bottom: 25px;">Confirm research parameters for sequence initialization.</p>
                    
                    <div class="glass-card" style="text-align: left; background: rgba(0, 242, 254, 0.05); border: 1px solid rgba(0, 242, 254, 0.3); position: relative; overflow: hidden;">
                        <div style="font-weight: 700; color: var(--accent-cyan); font-size: 1.1rem; margin-bottom: 10px;">${wizardData.name}</div>
                        <div style="font-size: 0.85rem; line-height: 1.8;">
                            <div>• Dosage: <strong style="color:#fff;">${wizardData.dosage}${wizardData.unit}</strong></div>
                            <div>• Pattern: <strong style="color:#fff;">${wizardData.label || 'Custom'}</strong></div>
                            <div>• Frequency: <strong style="color:#fff;">${wizardData.freqType === 'interval' || wizardData.freqType === 'custom' ? `Every ${wizardData.intervalDays} Days` : `${wizardData.weekly} Days/Week`}</strong></div>
                            <div>• Intensity: <strong style="color:#fff;">${wizardData.timings.length} dose(s) daily</strong></div>
                            ${wizardData.recon.units ? `<div>• Syringe: <strong style="color: var(--accent-cyan);">${wizardData.recon.units} Units</strong></div>` : ''}
                        </div>
                    </div>
                </div>
            `;
        }
    };

    const attachWizardEvents = () => {
        // Step 1: Peptide Selection
        document.querySelectorAll('.peptide-opt').forEach(opt => {
            opt.onclick = () => {
                const name = opt.getAttribute('data-name');
                wizardData.name = name;
                if(name !== 'Custom') {
                    wizardData.dosage = PEPTIDE_DB[name].commonDosage;
                    wizardData.unit = PEPTIDE_DB[name].unit;
                }
                currentStep = 2;
                renderWizard();
            };
        });

        // Step 2: Dosage
        const doseInp = document.getElementById('w-dose');
        if(doseInp) doseInp.oninput = (e) => wizardData.dosage = e.target.value;

        const calcTog = document.getElementById('w-calc-toggle');
        const calcFields = document.getElementById('w-calc-fields');
        if(calcTog) {
            calcTog.onclick = () => {
                calcFields.style.display = calcFields.style.display === 'none' ? 'flex' : 'none';
            };
        }

        const updateUnits = () => {
            const mg = parseFloat(document.getElementById('w-vial')?.value);
            const ml = parseFloat(document.getElementById('w-water')?.value);
            const dose = parseFloat(doseInp.value);
            if(mg && ml && dose) {
                let target = wizardData.unit === 'mg' ? dose * 1000 : dose;
                wizardData.recon.units = Math.round((target / (mg * 1000)) * (ml * 100) * 10) / 10;
                document.getElementById('w-units').innerText = wizardData.recon.units;
                document.getElementById('w-calc-res').style.display = 'block';
            }
        };
        ['w-vial', 'w-water'].forEach(id => document.getElementById(id)?.addEventListener('input', updateUnits));

        // Step 3: Progressive Presets
        document.querySelectorAll('.preset-chip').forEach(chip => {
            chip.onclick = () => {
                const type = chip.getAttribute('data-type');
                const customBox = document.getElementById('custom-freq-box');
                
                document.querySelectorAll('.preset-chip').forEach(c => c.classList.remove('active'));
                chip.classList.add('active');

                if(type === 'custom') {
                    wizardData.freqType = 'interval'; 
                    wizardData.label = 'Custom';
                    if(customBox) customBox.style.display = 'block';
                    document.getElementById('wiz-desc').innerText = "Manual interval entry selected.";
                    const inv = document.getElementById('w-interval');
                    if(inv) {
                        inv.value = wizardData.intervalDays || 1;
                        inv.oninput = (e) => {
                            wizardData.intervalDays = parseInt(e.target.value) || 1;
                        };
                    }
                    return;
                }
                
                if(customBox) customBox.style.display = 'none';
                wizardData.label = chip.getAttribute('data-label');
                wizardData.freqType = type;
                if(type === 'interval') wizardData.intervalDays = parseInt(chip.getAttribute('data-val'));
                else wizardData.weekly = parseInt(chip.getAttribute('data-val'));
                
                wizardData.timings = chip.getAttribute('data-timings').split(',');
                document.getElementById('wiz-desc').innerText = chip.getAttribute('data-desc');
            };
        });

        // Step 4: Timing Sync
        document.querySelectorAll('.timing-opt input').forEach(cb => {
            cb.onchange = () => {
                wizardData.timings = [...document.querySelectorAll('.timing-opt input:checked')].map(i => i.value);
                const count = wizardData.timings.length;
                const el = document.getElementById('w-intensity');
                if(el) el.innerText = `${count} Pin${count !== 1 ? 's' : ''} per Day`;
            };
        });
        const startInp = document.getElementById('w-start');
        if(startInp) startInp.onchange = (e) => wizardData.startDate = e.target.value;

        // Nav
        document.getElementById('wiz-prev').onclick = () => { if(currentStep > 1) { currentStep--; renderWizard(); } };
        document.getElementById('wiz-next').onclick = () => {
            if(currentStep < 5) { currentStep++; renderWizard(); }
            else {
                if(editIndex > -1) {
                    state.peptides[editIndex] = { ...wizardData };
                } else {
                    state.peptides.push({ ...wizardData });
                }
                saveState();
                
                modalContent.innerHTML = `
                    <div style="text-align: center; padding: 40px 20px;">
                        <div style="font-size: 5rem; animation: bounce 1s infinite;">✅</div>
                        <h2 style="margin-top: 20px;">Protocol ${editIndex > -1 ? 'Updated' : 'Locked'}</h2>
                        <p style="color: var(--text-secondary);">Your sequence is now synchronized.</p>
                        <button class="send-btn ripple" onclick="closeModal()" style="margin-top: 30px; width: 100%;">Return to Suite</button>
                    </div>
                `;
                renderPage('peptides');
            }
        };
    };

    renderWizard();
}

function showSettingsModal() {
    const modal = document.getElementById('modal-container');
    const modalContent = modal.querySelector('.modal-content');
    modal.classList.remove('hidden');
    const times = state.settings.notificationTimes || { Morning: '08:00', Afternoon: '13:00', Evening: '20:00' };
    modalContent.innerHTML = `
        <div style="padding: 5px;">
            <div style="text-align: center; margin-bottom: 25px;">
                <h3 style="margin: 0; font-size: 1.1rem; color: #fff;">Laboratory Settings</h3>
                <p style="margin: 5px 0 0; font-size: 0.75rem; color: var(--text-secondary);">System identity & alert preferences</p>
            </div>

            <div style="font-size: 0.7rem; color: var(--text-secondary); margin: 0 0 8px 16px; text-transform: uppercase; letter-spacing: 0.5px;">System Access</div>
            <div class="glass-card" style="padding: 0; overflow: hidden; border-radius: 14px; margin-bottom: 25px; background: rgba(255,255,255,0.03);">
                <div style="padding: 12px 16px; border-bottom: 1px solid rgba(255,255,255,0.05); display: flex; align-items: center; gap: 15px;">
                    <span style="font-size: 0.95rem; min-width: 80px;">Name</span>
                    <input type="text" id="s-user" class="chat-input" value="${state.settings.userName}" placeholder="Username" style="border:none; background:transparent; padding:0; height:auto; text-align:right;">
                </div>
                <div style="padding: 12px 16px; display: flex; align-items: center; gap: 15px;">
                    <span style="font-size: 0.95rem; min-width: 80px;">API Key</span>
                    <input type="password" id="s-key" class="chat-input" value="${state.settings.apiKey}" placeholder="Gemini Key" style="border:none; background:transparent; padding:0; height:auto; text-align:right;">
                </div>
            </div>

            <div style="font-size: 0.7rem; color: var(--text-secondary); margin: 0 0 8px 16px; text-transform: uppercase; letter-spacing: 0.5px;">Compliance</div>
            <div class="glass-card" style="padding: 0; overflow: hidden; border-radius: 14px; margin-bottom: 25px; background: rgba(255,255,255,0.03);">
                <div style="padding: 12px 16px; border-bottom: 1px solid rgba(255,255,255,0.05); display: flex; justify-content: space-between; align-items: center;">
                    <span style="font-size: 0.95rem;">Dose Reminder</span>
                    <label class="switch">
                        <input type="checkbox" id="s-notify" ${state.settings.notificationsEnabled ? 'checked' : ''} onchange="toggleAlertTimesSection()">
                        <span class="slider round"></span>
                    </label>
                </div>
                <div id="alert-times-section" style="display: ${state.settings.notificationsEnabled ? 'block' : 'none'}; border-top: 1px solid rgba(255,255,255,0.05);">
                    <div style="padding: 14px 16px 6px; font-size: 0.6rem; color: rgba(255,255,255,0.35); text-transform: uppercase; letter-spacing: 1px;">Alert Windows</div>
                    ${['Night', 'Morning', 'Afternoon', 'Evening'].map((win, idx) => {
                        const icons = ['🌌', '🌅', '☀️', '🌙'];
                        const labels = ['Night', 'AM', 'Mid', 'PM'];
                        const t = times[win] || (win === 'Night' ? '04:00' : '08:00');
                        const [h, m] = t.split(':').map(Number);
                        const ampm = h >= 12 ? 'PM' : 'AM';
                        const h12 = h % 12 || 12;
                        const display = `${h12}:${m.toString().padStart(2,'0')} ${ampm}`;
                        const isLast = idx === 3;
                        return `
                        <div style="padding: 10px 16px; display: flex; align-items: center; justify-content: space-between; ${!isLast ? 'border-bottom: 1px solid rgba(255,255,255,0.04);' : ''}">
                            <div style="display: flex; align-items: center; gap: 8px;">
                                <span style="font-size: 1rem;">${icons[idx]}</span>
                                <span style="font-size: 0.85rem; color: rgba(255,255,255,0.7);">${labels[idx]}</span>
                            </div>
                            <div style="display: flex; align-items: center; gap: 10px;">
                                <button onclick="stepTime('${win}', -30)" style="background: rgba(255,255,255,0.06); border: 1px solid rgba(255,255,255,0.08); border-radius: 50%; width: 32px; height: 32px; color: #fff; cursor: pointer; font-size: 1rem; display:flex; align-items:center; justify-content:center; flex-shrink:0;">−</button>
                                <div style="position: relative; cursor: pointer; min-width: 80px; text-align:center;" onclick="document.getElementById('n-${win.toLowerCase()}-s').showPicker()">
                                    <span style="font-size: 0.95rem; font-weight: 700; color: var(--accent);">${display}</span>
                                    <input type="time" id="n-${win.toLowerCase()}-s" onchange="updateTime('${win}', this.value)" value="${t}" style="position:absolute; opacity:0; pointer-events:none; width:0; height:0;">
                                </div>
                                <button onclick="stepTime('${win}', 30)" style="background: rgba(255,255,255,0.06); border: 1px solid rgba(255,255,255,0.08); border-radius: 50%; width: 32px; height: 32px; color: #fff; cursor: pointer; font-size: 1rem; display:flex; align-items:center; justify-content:center; flex-shrink:0;">+</button>
                            </div>
                        </div>`;
                    }).join('')}
                </div>
                <div style="padding: 12px 16px; display: flex; justify-content: space-between; align-items: center;">
                    <div>
                        <span style="font-size: 0.95rem; display: block;">Discreet Mode</span>
                        <span style="font-size: 0.7rem; color: var(--text-secondary);">Masks substance names</span>
                    </div>
                    <label class="switch">
                        <input type="checkbox" id="s-discreet" ${state.settings.discreetMode ? 'checked' : ''}>
                        <span class="slider round"></span>
                    </label>
                </div>
            </div>

            <div style="font-size: 0.7rem; color: var(--text-secondary); margin: 0 0 8px 16px; text-transform: uppercase; letter-spacing: 0.5px;">Legal & Compliance</div>
            <div class="glass-card" style="padding: 0; overflow: hidden; border-radius: 14px; margin-bottom: 25px; background: rgba(255,255,255,0.03);">
                <button onclick="showLegalModal(true)" style="width: 100%; padding: 12px 16px; background: none; border: none; color: var(--accent-cyan); font-weight: 600; font-size: 0.9rem; cursor: pointer; text-align: left;" class="ripple">Review Research Agreement</button>
            </div>

            <button onclick="testNotification()" style="width: 100%; padding: 12px; background: none; border: 1px dashed var(--accent); border-radius: 12px; color: var(--accent); font-size: 0.85rem; margin-bottom: 20px; cursor: pointer;">Send Test Notification</button>

            <div style="display: flex; flex-direction: column; gap: 10px;">
                <button onclick="saveSettings()" style="width: 100%; padding: 16px; background: var(--accent); border: none; border-radius: 14px; color: #000; font-weight: 700; font-size: 1rem; cursor: pointer;" class="ripple">Apply Settings</button>
                <button onclick="closeModal()" style="width: 100%; padding: 16px; background: rgba(255,255,255,0.05); border: none; border-radius: 14px; color: #fff; font-weight: 700; font-size: 1rem; cursor: pointer;" class="ripple">Dismiss</button>
            </div>
        </div>
    `;

    // Wire up the live toggle to show/hide alert time section
    // (done via inline onchange for simplicity)
}

window.saveSettings = function() {
    state.settings.apiKey = document.getElementById('s-key').value;
    state.settings.userName = document.getElementById('s-user').value;
    state.settings.notificationsEnabled = document.getElementById('s-notify').checked;
    state.settings.discreetMode = document.getElementById('s-discreet').checked;
    
    if (state.settings.notificationsEnabled) {
        initNotifications();
    }
    
    saveState();
    closeModal();
    renderPage('dashboard');
};

window.changeDay = function(d) { state.scheduleOffset = (state.scheduleOffset || 0) + d; renderPage('calendar'); };
window.setDay = function(d) { state.scheduleOffset = d; renderPage('calendar'); };
window.closeModal = function() { document.getElementById('modal-container').classList.add('hidden'); };

window.showProtocolOptions = function(i) {
    const p = state.peptides[i];
    const modal = document.getElementById('modal-container');
    const modalContent = modal.querySelector('.modal-content');
    modal.classList.remove('hidden');
    
    modalContent.innerHTML = `
        <div style="padding: 5px;">
            <div style="text-align: center; margin-bottom: 20px;">
                <h3 style="margin: 0; font-size: 1.1rem; color: #fff;">${p.name}</h3>
                <p style="margin: 5px 0 0; font-size: 0.75rem; color: var(--text-secondary);">Manage research protocol parameters</p>
            </div>
            
            <div class="glass-card" style="padding: 0; overflow: hidden; border-radius: 14px; margin-bottom: 25px; background: rgba(255,255,255,0.03);">
                <button onclick="showAddPeptideModal(${i})" style="width: 100%; padding: 16px; background: none; border: none; border-bottom: 1px solid rgba(255,255,255,0.05); color: var(--accent-cyan); font-weight: 600; font-size: 1rem; cursor: pointer;" class="ripple">Edit Sequence</button>
                
                <button onclick="showNotificationSettingsModal()" style="width: 100%; padding: 16px; background: none; border: none; border-bottom: 1px solid rgba(255,255,255,0.05); color: var(--accent-cyan); font-weight: 600; font-size: 1rem; cursor: pointer;" class="ripple">Notification Lab</button>
                
                <div style="width: 100%; padding: 16px; background: none; border: none; border-bottom: 1px solid rgba(255,255,255,0.05); display: flex; justify-content: center; align-items: center; position: relative;">
                    <span style="font-weight: 600; font-size: 1rem; color: var(--accent-cyan); font-family: inherit; text-align: center;">Receive Alerts</span>
                    <label class="switch" style="position: absolute; right: 16px;">
                        <input type="checkbox" onchange="togglePeptideRemindersInMenu(${i})" ${p.remindersEnabled !== false ? 'checked' : ''}>
                        <span class="slider round"></span>
                    </label>
                </div>
                
                <button onclick="confirmDeletePeptide(${i})" style="width: 100%; padding: 16px; background: none; border: none; color: #ff3b30; font-weight: 600; font-size: 1rem; cursor: pointer;" class="ripple">Terminate Protocol</button>
            </div>

            <button onclick="closeModal()" style="width: 100%; padding: 16px; background: rgba(255,255,255,0.05); border: none; border-radius: 14px; color: #fff; font-weight: 700; font-size: 1rem; cursor: pointer;" class="ripple">Cancel</button>
        </div>
    `;
};

window.confirmDeletePeptide = function(i) {
    const p = state.peptides[i];
    const modal = document.getElementById('modal-container');
    const modalContent = modal.querySelector('.modal-content');
    
    modalContent.innerHTML = `
        <div style="text-align: center; padding: 10px;">
            <div style="font-size: 3rem; margin-bottom: 20px;">⚠️</div>
            <h3 style="color: #fff; margin-bottom: 10px;">Terminate Protocol?</h3>
            <p style="color: var(--text-secondary); font-size: 0.85rem; margin-bottom: 25px; line-height: 1.5;">This will permanently purge the <b>${p.name}</b> research sequence and all historical injection data from your laboratory suite.</p>
            
            <div style="display: flex; flex-direction: column; gap: 10px;">
                <button onclick="deletePeptide(${i})" style="width: 100%; padding: 16px; background: #ff3b30; border: none; border-radius: 14px; color: #fff; font-weight: 700; font-size: 1rem; cursor: pointer;" class="ripple">Purge Sequence</button>
                <button onclick="showProtocolOptions(${i})" style="width: 100%; padding: 16px; background: rgba(255,255,255,0.05); border: none; border-radius: 14px; color: #fff; font-weight: 700; font-size: 1rem; cursor: pointer;" class="ripple">Go Back</button>
            </div>
        </div>
    `;
};

window.deletePeptide = function(i) {
    state.peptides.splice(i, 1);
    saveState();
    closeModal();
    renderPage('peptides');
};

const formatTimeForDisplay = (timeStr) => {
    const [h, m] = timeStr.split(':');
    const hour = parseInt(h);
    const ampm = hour >= 12 ? 'PM' : 'AM';
    const h12 = hour % 12 || 12;
    return `<span style="font-size: 1.5rem; font-weight: 800; color:var(--accent-cyan);">${h12}:${m}</span> <span style="font-size: 0.8rem; opacity: 0.6;">${ampm}</span>`;
};

window.showNotificationSettingsModal = function() {
    const modal = document.getElementById('modal-container');
    const modalContent = modal.querySelector('.modal-content');
    modal.classList.remove('hidden');
    
    const times = state.settings.notificationTimes || { Morning: '08:00', Afternoon: '13:00', Evening: '20:00' };

    modalContent.innerHTML = `
        <div style="padding: 5px;">
            <div style="text-align: center; margin-bottom: 25px;">
                <h3 style="margin: 0; font-size: 1.1rem; color: #fff;">Notification Lab</h3>
                <p style="margin: 5px 0 0; font-size: 0.75rem; color: var(--text-secondary);">Calibrate research window signals</p>
            </div>

            <div style="display: flex; flex-direction: column; gap: 15px; margin-bottom: 25px;">
                ${['Morning', 'Afternoon', 'Evening'].map(win => `
                    <div class="glass-card" style="padding: 15px; border-radius: 16px; background: rgba(255,255,255,0.02); border: 1px solid rgba(255,255,255,0.05);">
                        <div style="font-size: 0.7rem; color: var(--text-secondary); text-transform: uppercase; letter-spacing: 1px; margin-bottom: 12px; text-align: center;">${win} Cycle</div>
                        <div style="display: flex; justify-content: center; align-items: center; gap: 20px;">
                            <button onclick="stepTime('${win}', -15)" style="background: rgba(255,255,255,0.05); border: none; border-radius: 50%; width: 32px; height: 32px; color: #fff; cursor: pointer;">-</button>
                            <div style="position: relative; cursor: pointer;" onclick="document.getElementById('n-${win.toLowerCase()}').showPicker()">
                                ${formatTimeForDisplay(times[win])}
                                <input type="time" id="n-${win.toLowerCase()}" onchange="updateTime('${win}', this.value)" value="${times[win]}" style="position: absolute; opacity: 0; pointer-events: none; width:0; height:0;">
                            </div>
                            <button onclick="stepTime('${win}', 15)" style="background: rgba(255,255,255,0.05); border: none; border-radius: 50%; width: 32px; height: 32px; color: #fff; cursor: pointer;">+</button>
                        </div>
                    </div>
                `).join('')}
            </div>
            
            <div style="display: flex; flex-direction: column; gap: 10px;">
                <button onclick="closeModal()" style="width: 100%; padding: 16px; background: var(--accent-cyan); border: none; border-radius: 14px; color: #000; font-weight: 700; font-size: 1rem; cursor: pointer;" class="ripple">Synchronize Cycle</button>
            </div>

            <p style="font-size: 0.7rem; color: var(--text-secondary); text-align: center; margin-top: 15px; opacity: 0.5;">
                * Re-notifies every hour until synchronized
            </p>
        </div>
    `;
};

window.updateTime = function(win, val) {
    if(!state.settings.notificationTimes) state.settings.notificationTimes = {};
    state.settings.notificationTimes[win] = val;
    saveState();
    
    // Refresh whatever settings view is currently open
    if (document.querySelector('h3')?.innerText.includes('Laboratory Settings')) {
        showSettingsModal();
    } else {
        showNotificationSettingsModal();
    }
};

window.stepTime = function(win, mins) {
    const times = state.settings.notificationTimes || { Night: '04:00', Morning: '08:00', Afternoon: '13:00', Evening: '20:00' };
    let [h, m] = times[win].split(':').map(Number);
    // Snap to nearest 30-min then step
    let totalMins = h * 60 + m;
    totalMins = Math.round(totalMins / 30) * 30 + mins;
    totalMins = ((totalMins % 1440) + 1440) % 1440;
    const newH = Math.floor(totalMins / 60).toString().padStart(2, '0');
    const newM = (totalMins % 60).toString().padStart(2, '0');
    updateTime(win, `${newH}:${newM}`);
};

window.toggleAlertTimesSection = function() {
    const section = document.getElementById('alert-times-section');
    const toggle = document.getElementById('s-notify');
    if (section) section.style.display = toggle?.checked ? 'block' : 'none';
};

window.togglePeptideRemindersInMenu = function(i) {
    state.peptides[i].remindersEnabled = !state.peptides[i].remindersEnabled;
    saveState();
    showProtocolOptions(i); 
};

// Removed saveNotificationSettings as it is now live-synced via updateTime

window.confirmDeletePeptide = function(i) {
    const p = state.peptides[i];
    const modal = document.getElementById('modal-container');
    const modalContent = modal.querySelector('.modal-content');
    modalContent.innerHTML = `
        <div style="text-align: center; padding: 10px;">
            <div style="font-size: 3rem; margin-bottom: 20px;">⚠️</div>
            <h2 style="margin-bottom: 10px;">Protocol Termination</h2>
            <p style="color: var(--text-secondary); font-size: 0.9rem; line-height: 1.6; margin-bottom: 30px;">
                Are you sure you want to permanently terminate the <strong style="color: #fff;">${p.name}</strong> sequence? This action is irreversible.
            </p>
            <div style="display: flex; flex-direction: column; gap: 10px;">
                <button class="send-btn ripple" onclick="deletePeptide(${i})" style="background: #ff6b6b; padding: 15px;">Confirm Termination</button>
                <button class="chat-input ripple" onclick="showProtocolOptions(${i})" style="border: none; background: rgba(255,255,255,0.05); padding: 15px;">Abort</button>
            </div>
        </div>
    `;
};
window.togglePeptideReminders = function(i) { state.peptides[i].remindersEnabled = !state.peptides[i].remindersEnabled; saveState(); };

async function handleChatMessage() {
    const inp = document.getElementById('chat-input');
    const msg = inp.value.trim();
    if(!msg) return;
    addMessage('user', msg);
    inp.value = '';
    const loading = addMessage('ai', 'Thinking...', true);
    if(state.settings.apiKey) {
        const ctx = `You are a peptide medical assistant. Context: ${JSON.stringify(state.peptides)}. DB: ${JSON.stringify(PEPTIDE_DB)}. User: ${msg}`;
        const res = await callGemini(ctx);
        if(res) { loading.innerHTML = res.replace(/\n/g, '<br>'); return; }
    }
    setTimeout(() => { loading.innerHTML = "Local AI: I can help with information about your current sequences. Add an API Key for deeper research."; }, 600);
}

function addMessage(sender, text, isLoad = false) {
    const c = document.getElementById('chat-messages');
    const div = document.createElement('div');
    div.className = `message ${sender}`;
    div.innerHTML = text;
    c.appendChild(div);
    c.scrollTop = c.scrollHeight;
    return div;
}

window.showLegalModal = function(isReview = false) {
    const modal = document.getElementById('modal-container');
    const modalContent = modal.querySelector('.modal-content');
    modal.classList.remove('hidden');
    
    modalContent.innerHTML = `
        <div style="padding: 10px;">
            <div style="text-align: center; margin-bottom: 25px;">
                <div style="font-size: 0.6rem; color: var(--accent-cyan); font-weight: 800; letter-spacing: 2px; margin-bottom: 8px;">REGULATORY COMPLIANCE SUITE</div>
                <h2 style="margin: 0; font-size: 1.3rem; letter-spacing: -0.5px;">Laboratory Agreement</h2>
                <p style="font-size: 0.7rem; color: var(--text-secondary); margin-top: 5px; opacity: 0.6;">PeptAI Protocol v2.1.0 • Research Intent Verified</p>
            </div>

            <div class="legal-scroll-box" style="line-height: 1.6; font-size: 0.8rem;">
                <h4 style="color: var(--accent-cyan); font-size: 0.75rem; letter-spacing: 0.5px; margin-bottom: 10px;">1. RESEARCH PROTOCOL LIMITATION</h4>
                PeptAI operates strictly as an analytical instrumentation interface for laboratory research and developmental tracking. All data recorded remains the sole responsibility of the primary researcher.
                
                <h4 style="color: var(--accent-cyan); font-size: 0.75rem; letter-spacing: 0.5px; margin: 20px 0 10px;">2. NON-CLINICAL DISPOSITION</h4>
                Substances tracked within this environment are documented as research chemicals exclusively. They are NOT intended for human consumption, clinical application, or use in any therapeutic, food, or drug-related context.
                
                <h4 style="color: var(--accent-cyan); font-size: 0.75rem; letter-spacing: 0.5px; margin: 20px 0 10px;">3. ANALYTICAL DISCLAIMER</h4>
                All dosages, timings, and analytical insights generated by the <strong>Peptide AI Research</strong> system are informational models. They strictly do NOT constitute medical advice, diagnosis, or therapeutic recommendation.
                
                <h4 style="color: var(--accent-cyan); font-size: 0.75rem; letter-spacing: 0.5px; margin: 20px 0 10px;">4. INDEMNIFICATION & RISK</h4>
                The researcher affirms full comprehension of chemical handling protocols and assumes total liability for all experimental outcomes. The developers of PeptAI disclaim all responsibility for downstream consequences of research activities.
                
                <h4 style="color: var(--accent-cyan); font-size: 0.75rem; letter-spacing: 0.5px; margin: 20px 0 10px;">5. DATA SOVEREIGNTY</h4>
                Laboratory logs are persisted in local secure-memory only. No external transmission, cloud backup, or third-party analysis of your personal research data is performed.
            </div>

            <div style="margin-bottom: 25px; padding-top: 15px; border-top: 1px solid rgba(255,255,255,0.05);">
                <label class="legal-checkbox-row">
                    <input type="checkbox" id="legal-18" style="display:none;" ${state.legalAccepted ? 'checked' : ''}>
                    <div class="custom-checkbox"></div>
                    <span style="font-size: 0.85rem;">Affirm Age: I am 18 years of age or older.</span>
                </label>
                <label class="legal-checkbox-row">
                    <input type="checkbox" id="legal-ruo" style="display:none;" ${state.legalAccepted ? 'checked' : ''}>
                    <div class="custom-checkbox"></div>
                    <span style="font-size: 0.85rem;">Verify Intent: All research is for RUO purposes only.</span>
                </label>
                <label class="legal-checkbox-row">
                    <input type="checkbox" id="legal-risk" style="display:none;" ${state.legalAccepted ? 'checked' : ''}>
                    <div class="custom-checkbox"></div>
                    <span style="font-size: 0.85rem;">Assume Risk: I acknowledge the liability waiver.</span>
                </label>
            </div>

            <div style="display: flex; flex-direction: column; gap: 10px;">
                <button onclick="acceptLegal(${isReview})" id="legal-accept-btn" class="send-btn ripple" style="width: 100%; padding: 16px; font-weight: 800;">${isReview ? 'Acknowledge' : 'Accept & Enter Lab'}</button>
                ${isReview ? `
                    <button onclick="closeModal()" class="chat-input ripple" style="border:none; background: rgba(255,255,255,0.05); padding: 12px;">Dismiss</button>
                ` : ''}
            </div>
        </div>
    `;
};

window.acceptLegal = function(isReview) {
    const ageBox = document.getElementById('legal-18');
    const ruoBox = document.getElementById('legal-ruo');
    const riskBox = document.getElementById('legal-risk');
    
    if (!ageBox.checked || !ruoBox.checked || !riskBox.checked) {
        alert("Compliance Required: Please affirm your age, RUO status, and liability acknowledgement to proceed.");
        return;
    }
    
    state.legalAccepted = true;
    saveState();
    
    if (!isReview) {
        closeModal();
        renderPage('dashboard');
    } else {
        closeModal();
    }
};

window.showEditDoseModal = function(id) {
    const pin = state.pins.find(p => p.pinId === id);
    if(!pin) return;
    
    const modal = document.getElementById('modal-container');
    const modalContent = modal.querySelector('.modal-content');
    modal.classList.remove('hidden');
    
    const dateObj = new Date(pin.timestamp);
    const timeStr = dateObj.toLocaleTimeString([], {hour: '2-digit', minute:'2-digit', hour12: false});

    modalContent.innerHTML = `
        <div style="padding: 5px;">
            <div style="text-align: center; margin-bottom: 25px;">
                <h3 style="margin: 0; font-size: 1.1rem; color: #fff;">Edit Research Log</h3>
                <p style="margin: 5px 0 0; font-size: 0.75rem; color: var(--accent-cyan); font-weight: 700; text-transform: uppercase;">${pin.name}</p>
            </div>

            <div class="glass-card" style="padding: 25px; border-radius: 16px; background: rgba(255,255,255,0.02); border: 1px solid rgba(255,255,255,0.05); margin-bottom: 25px;">
                <div style="font-size: 0.7rem; color: var(--text-secondary); text-transform: uppercase; letter-spacing: 1px; margin-bottom: 15px; text-align: center;">Logged Administration Time</div>
                <div style="display: flex; justify-content: center; align-items: center; gap: 20px;">
                    <button onclick="stepPinTime('${id}', -30)" style="background: rgba(255,255,255,0.06); border: 1px solid rgba(255,255,255,0.08); border-radius: 50%; width: 44px; height: 44px; color: #fff; cursor: pointer; font-size: 1.3rem; display:flex; align-items:center; justify-content:center;">−</button>
                    <div style="text-align: center; min-width: 120px;">
                        ${formatTimeForDisplay(timeStr)}
                    </div>
                    <button onclick="stepPinTime('${id}', 30)" style="background: rgba(255,255,255,0.06); border: 1px solid rgba(255,255,255,0.08); border-radius: 50%; width: 44px; height: 44px; color: #fff; cursor: pointer; font-size: 1.3rem; display:flex; align-items:center; justify-content:center;">+</button>
                </div>
            </div>
            
            <div style="display: flex; flex-direction: column; gap: 10px;">
                <button onclick="closeModal(); renderPage(state.currentPage);" style="width: 100%; padding: 16px; background: var(--accent-cyan); border: none; border-radius: 14px; color: #000; font-weight: 800; font-size: 1rem; cursor: pointer;" class="ripple">Synchronize Log</button>
                <button onclick="closeModal()" style="width: 100%; padding: 14px; background: rgba(255,255,255,0.05); border: none; border-radius: 14px; color: #fff; font-weight: 600; font-size: 0.9rem; cursor: pointer;" class="ripple">Cancel Changes</button>
            </div>
        </div>
    `;
};

window.stepPinTime = function(id, mins) {
    const pin = state.pins.find(p => p.pinId === id);
    if(!pin) return;
    
    const dateObj = new Date(pin.timestamp);
    // Snap to nearest 30-min boundary first, then step
    const currentMins = dateObj.getMinutes();
    const snappedMins = Math.round(currentMins / 30) * 30;
    dateObj.setMinutes(snappedMins + mins, 0, 0);
    pin.timestamp = dateObj.toISOString();
    
    saveState();
    showEditDoseModal(id);
};

// --- GLP Plotter Engine ---
function renderPlotter(container) {
    const now = new Date();
    state.plotterMode = 'projected';
    const glp1List = ['Retatrutide', 'Semaglutide', 'Tirzepatide'];
    const activeGLP1s = state.peptides.filter(p => glp1List.some(name => p.name.toLowerCase() === name.toLowerCase()));

    if (activeGLP1s.length === 0) {
        container.innerHTML = `
            <div style="background: rgba(255,255,255,0.02); border: 1px solid rgba(255,255,255,0.07); border-radius: 20px; padding: 60px 20px; text-align: center; opacity: 0.5;">
                <div style="font-size: 2.5rem; margin-bottom: 12px;">🔬</div>
                <div style="font-size: 0.85rem;">No active GLP-1 protocols for biosaturation analysis.</div>
                <div style="font-size: 0.7rem; color: rgba(255,255,255,0.3); margin-top: 8px;">Add Retatrutide, Semaglutide or Tirzepatide in your Research Suite to begin.</div>
            </div>
        `;
        return;
    }

    let html = '';

    activeGLP1s.forEach((p, idx) => {
        const canvasId = `plotter-canvas-${idx}`;
        const areaId = `plotter-area-${idx}`;
        const db = PEPTIDE_DB[p.name] || {};

        // Stat calculations (actual logs)
        const currentLevel = calculateLevelAt(now, false, p.name, 'actual');

        // Titration Status
        const start = new Date(p.startDate || now);
        start.setHours(0,0,0,0);
        const today = new Date(now);
        today.setHours(0,0,0,0);
        const diffDays = Math.max(1, Math.floor((today - start) / (1000 * 60 * 60 * 24)) + 1);
        const weekNum = Math.ceil(diffDays / 7);

        html += `
            <div style="background: rgba(255,255,255,0.02); border: 1px solid rgba(255,255,255,0.07); border-radius: 20px; padding: 22px; margin-bottom: 20px; user-select: none; overflow: hidden; position: relative;">

                <!-- Compound Header -->
                <div style="display: flex; justify-content: space-between; align-items: flex-start; margin-bottom: 20px;">
                    <div>
                        <div style="font-size: 0.55rem; color: var(--accent-cyan); text-transform: uppercase; letter-spacing: 1.5px; font-weight: 700; margin-bottom: 4px;">${p.name}</div>
                        <div style="font-size: 0.65rem; color: rgba(255,255,255,0.3);">${db.halfLife || '?'}d t½ &nbsp;·&nbsp; ${db.tMax || '?'}d Tmax &nbsp;·&nbsp; ${p.dosage}${p.unit || 'mg'} dose</div>
                    </div>
                    <div style="text-align: right;">
                        <div style="font-size: 1.6rem; font-weight: 900; color: #fff; line-height: 1;">${currentLevel.toFixed(2)}<span style="font-size:0.7rem; font-weight: 400; color: rgba(255,255,255,0.35); margin-left: 2px;">mg</span></div>
                        <div style="font-size: 0.5rem; color: rgba(255,255,255,0.3); letter-spacing: 0.8px; margin-top: 2px;">ACTIVE SATURATION</div>
                        <div style="display: flex; justify-content: flex-end; gap: 5px; margin-top: 6px;">
                            <span style="background: rgba(0,242,254,0.15); color: var(--accent-cyan); padding: 2px 8px; border-radius: 20px; font-size: 0.55rem; font-weight: 700;">DAY ${diffDays}</span>
                            <span style="background: rgba(255,255,255,0.05); color: rgba(255,255,255,0.4); padding: 2px 8px; border-radius: 20px; font-size: 0.55rem; font-weight: 600;">WK ${weekNum}</span>
                        </div>
                    </div>
                </div>

                <!-- Canvas -->
                <div style="width: 100%; height: 240px; position: relative; background: rgba(0,0,0,0.25); border-radius: 14px; border: 1px solid rgba(255,255,255,0.04); cursor: grab; overflow: hidden;" id="${areaId}">
                    <canvas id="${canvasId}" style="width: 100%; height: 100%;"></canvas>
                    <div style="position: absolute; bottom: 8px; right: 12px; font-size: 0.5rem; color: rgba(255,255,255,0.18); pointer-events: none; letter-spacing: 0.8px;">← DRAG TO SCROLL →</div>
                </div>

                <!-- Legend -->
                <div style="display: flex; align-items: center; gap: 8px; margin-top: 12px;">
                    <div style="width: 14px; height: 2px; background: var(--accent-cyan); border-radius: 2px; opacity: 0.7;"></div>
                    <span style="font-size: 0.55rem; color: rgba(255,255,255,0.25); text-transform: uppercase; letter-spacing: 0.5px;">60-day projected biosaturation</span>
                </div>
            </div>
        `;
    });

    container.innerHTML = html;

    // Init a plotter for each compound
    activeGLP1s.forEach((p, idx) => {
        setTimeout(() => initPlotter(`plotter-canvas-${idx}`, `plotter-area-${idx}`, p.name), 50);
    });
}

window.setPlotterMode = function(mode) {
    state.plotterMode = mode;
    saveState();
    renderPage('plotter');
};

window.resetPlotterOffset = function() {
    state.plotterOffsetDays = 0;
    renderPage('plotter');
};

function initPlotter(canvasId, areaId, compoundName) {
    const canvas = document.getElementById(canvasId);
    if(!canvas) return;

    const interactionArea = document.getElementById(areaId);

    const dpr = window.devicePixelRatio || 1;
    const rect = canvas.getBoundingClientRect();
    canvas.width = rect.width * dpr;
    canvas.height = rect.height * dpr;
    const ctx = canvas.getContext('2d');
    ctx.scale(dpr, dpr);

    const w = rect.width;
    const h = rect.height;
    const pad = 40;
    const daysRange = 60; 

    const now = new Date();

    // Per-compound independent scroll offset
    if (!state.plotterOffsets) state.plotterOffsets = {};
    if (state.plotterOffsets[compoundName] === undefined) state.plotterOffsets[compoundName] = 0;


    // Interaction State (scoped to THIS chart's area, no global handlers)
    let isDragging = false;
    let startX = 0;
    let hoverX = null;

    interactionArea.addEventListener('pointerdown', (e) => {
        isDragging = true;
        startX = e.clientX;
        interactionArea.setPointerCapture(e.pointerId);
        interactionArea.style.cursor = 'grabbing';
    });

    interactionArea.addEventListener('pointermove', (e) => {
        const areaRect = interactionArea.getBoundingClientRect();
        hoverX = e.clientX - areaRect.left;
        if (isDragging) {
            const deltaX = e.clientX - startX;
            const pixelsPerDay = (w - 2 * pad) / daysRange;
            state.plotterOffsets[compoundName] -= deltaX / pixelsPerDay;
            startX = e.clientX;
        }
        draw();
    });

    interactionArea.addEventListener('pointerup', () => {
        isDragging = false;
        hoverX = null;
        interactionArea.style.cursor = 'grab';
        draw();
    });

    interactionArea.addEventListener('pointerleave', () => {
        if (!isDragging) { hoverX = null; draw(); }
    });

    function draw() {
        ctx.clearRect(0, 0, w, h);
        
        const currentStartDate = new Date(now);
        currentStartDate.setDate(now.getDate() - 30 + (state.plotterOffsets[compoundName] || 0));
        currentStartDate.setHours(0,0,0,0);

        // Data Calculation
        const points = 200; 
        const dataPoints = [];

        for(let i = 0; i <= points; i++) {
            const t = new Date(currentStartDate.getTime() + (i / points) * daysRange * 24 * 60 * 60 * 1000);
            dataPoints.push({ x: i, y: calculateLevelAt(t, false, compoundName) });
        }

        const maxY = Math.ceil(Math.max(...dataPoints.map(d => d.y), 3));

        const getX = (i) => pad + (i / points) * (w - 2 * pad);
        const getY = (v) => h - pad - (v / maxY) * (h - 2 * pad);

        // Grid & Axis Labels
        ctx.strokeStyle = 'rgba(255,255,255,0.05)';
        ctx.fillStyle = 'rgba(255,255,255,0.5)';
        ctx.font = '10px Roboto, sans-serif';
        ctx.lineWidth = 1;
        
        for(let i = 0; i <= maxY; i++) {
            const y = getY(i);
            ctx.beginPath(); ctx.moveTo(pad, y); ctx.lineTo(w - pad, y); ctx.stroke();
            ctx.fillText(i, pad - 15, y + 3);
        }

        // Y Axis Title
        ctx.save();
        ctx.translate(12, h / 2);
        ctx.rotate(-Math.PI / 2);
        ctx.textAlign = 'center';
        ctx.fillStyle = 'var(--text-secondary)';
        ctx.fillText('Milligrams', 0, 0);
        ctx.restore();

        // X Axis Dates
        ctx.textAlign = 'center';
        for(let i = 0; i <= 4; i++) {
            const d = new Date(currentStartDate.getTime() + (i / 4) * daysRange * 24 * 60 * 60 * 1000);
            const x = pad + (i / 4) * (w - 2 * pad);
            const label = d.toLocaleDateString('en-US', { month: 'short', day: 'numeric' });
            ctx.fillText(label, x, h - pad + 20);
        }

        // REH-NOW Marker
        const nowIdx = ((now - currentStartDate) / (daysRange * 24 * 60 * 60 * 1000)) * points;
        const nowX = getX(nowIdx);
        
        if (nowX >= pad && nowX <= w - pad) {
            ctx.strokeStyle = '#fff';
            ctx.setLineDash([5, 5]);
            ctx.beginPath(); ctx.moveTo(nowX, pad); ctx.lineTo(nowX, h - pad); ctx.stroke();
            ctx.setLineDash([]);
            ctx.save();
            ctx.fillStyle = 'var(--accent-cyan)';
            ctx.fillText('NOW', nowX, pad - 10);
            ctx.restore();
        }

        // Actual Curve (Filled)
        const fillGradient = ctx.createLinearGradient(0, pad, 0, h - pad);
        fillGradient.addColorStop(0, 'rgba(0, 242, 254, 0.4)');
        fillGradient.addColorStop(1, 'rgba(0, 242, 254, 0)');
        
        ctx.fillStyle = fillGradient;
        ctx.beginPath();
        ctx.moveTo(getX(0), getY(0));
        dataPoints.forEach(d => ctx.lineTo(getX(d.x), getY(d.y)));
        ctx.lineTo(getX(points), getY(0));
        ctx.closePath();
        ctx.fill();

        ctx.strokeStyle = 'var(--accent-cyan)';
        ctx.lineWidth = 2.5;
        ctx.beginPath();
        dataPoints.forEach((d, i) => {
            if(i === 0) ctx.moveTo(getX(d.x), getY(d.y));
            else ctx.lineTo(getX(d.x), getY(d.y));
        });
        ctx.stroke();

        // --- PEAK IDENTIFICATION & LABELING ---
        const peaks = [];
        for (let i = 2; i < dataPoints.length - 2; i++) {
            if (dataPoints[i].y > dataPoints[i - 1].y && 
                dataPoints[i].y > dataPoints[i - 2].y &&
                dataPoints[i].y > dataPoints[i + 1].y &&
                dataPoints[i].y > dataPoints[i + 2].y &&
                dataPoints[i].y > 0.05) { // Threshold to ignore noise
                peaks.push(dataPoints[i]);
            }
        }

        // Draw Peak Markers
        peaks.forEach(p => {
            const px = getX(p.x);
            const py = getY(p.y);
            
            if (px < pad || px > w - pad) return;

            // Marker Point
            ctx.fillStyle = 'var(--accent-cyan)';
            ctx.beginPath(); ctx.arc(px, py, 3, 0, Math.PI * 2); ctx.fill();
            
            // Halo Glow
            ctx.shadowBlur = 10; ctx.shadowColor = 'var(--accent-cyan)';
            ctx.beginPath(); ctx.arc(px, py, 1.5, 0, Math.PI * 2); ctx.fill();
            ctx.shadowBlur = 0;

            // Elegant Label
            ctx.font = '700 0.6rem "Inter"';
            ctx.textAlign = 'center';
            ctx.fillText(`${p.y.toFixed(2)}mg`, px, py - 12);
        });

        // --- INTERACTIVE SCRUBBER ---
        if (hoverX !== undefined && hoverX !== null) {
            drawScrubber(hoverX);
        }
    }

    function drawScrubber(canvasX) {
        if (canvasX < pad || canvasX > w - pad) return;
        
        const normalizedIdx = ((canvasX - pad) / (w - 2 * pad)) * points;
        const dataIdx = Math.round(normalizedIdx);
        if (dataIdx < 0 || dataIdx >= dataPoints.length) return;
        
        const point = dataPoints[dataIdx];
        const px = getX(point.x);
        const py = getY(point.y);

        // Vertical Guide
        ctx.strokeStyle = 'rgba(255,255,255,0.2)';
        ctx.setLineDash([2, 4]);
        ctx.beginPath(); ctx.moveTo(px, pad); ctx.lineTo(px, h - pad); ctx.stroke();
        ctx.setLineDash([]);

        // Scrub Point
        ctx.fillStyle = '#fff';
        ctx.beginPath(); ctx.arc(px, py, 4, 0, Math.PI * 2); ctx.fill();

        // Value Indicated Bubble
        const timeAtX = new Date(currentStartDate.getTime() + (point.x / points) * daysRange * 24 * 60 * 60 * 1000);
        const timeLabel = timeAtX.toLocaleDateString([], { month: 'short', day: 'numeric', hour: '2-digit', minute: '2-digit' });
        
        ctx.fillStyle = 'rgba(0,0,0,0.85)';
        ctx.beginPath();
        ctx.roundRect(px - 60, pad + 10, 120, 40, 8);
        ctx.fill();
        ctx.strokeStyle = 'var(--accent-cyan)';
        ctx.stroke();

        ctx.fillStyle = '#fff';
        ctx.textAlign = 'center';
        ctx.font = '700 0.8rem "Inter"';
        ctx.fillText(`${point.y.toFixed(3)} mg`, px, pad + 28);
        ctx.font = '500 0.5rem "Inter"';
        ctx.fillStyle = 'var(--text-secondary)';
        ctx.fillText(timeLabel.toUpperCase(), px, pad + 40);
    }
    
    draw();
}

function calculateLevelAt(time, includeSim, filterName = null, forcedMode = null) {
    let total = 0;
    const glp1List = ['Retatrutide', 'Semaglutide', 'Tirzepatide'];
    let allPins = [];
    
    const mode = forcedMode || state.plotterMode;
    if (mode === 'projected') {
        allPins = getProjectedPins();
    } else {
        allPins = [...state.pins];
    }

    allPins = allPins.filter(pin => glp1List.some(name => pin.name.toLowerCase() === name.toLowerCase()));
    
    if (filterName) {
        allPins = allPins.filter(p => p.name.toLowerCase() === filterName.toLowerCase());
    }

    allPins.forEach(pin => {
        const pinDate = new Date(pin.timestamp);
        if(time < pinDate) return;

        const pData = PEPTIDE_DB[pin.name];
        const halfLife = pData?.halfLife || 7;
        const ka = pData?.ka || 2.0; // Default absorption rate
        const dose = parseFloat(pin.dosage) || 0;
        
        const ke = Math.log(2) / halfLife;
        const diffDays = (time - pinDate) / (1000 * 60 * 60 * 24);
        
        // --- Bateman Equation: First-order absorption model ---
        // C(t) = D * Ka / (Ka - Ke) * (exp(-Ke * t) - exp(-Ka * t))
        const level = dose * (ka / (ka - ke)) * (Math.exp(-ke * diffDays) - Math.exp(-ka * diffDays));
        total += level;
    });

    return total;
}

function getProjectedPins() {
    const pins = [];
    const glp1List = ['Retatrutide', 'Semaglutide', 'Tirzepatide'];
    const activeGLP1s = state.peptides.filter(p => glp1List.some(name => p.name.toLowerCase() === name.toLowerCase()));

    activeGLP1s.forEach(p => {
        const startDate = new Date(p.startDate || new Date());
        const horizon = 120; // Project 120 days into future
        const interval = parseInt(p.interval) || 7;
        
        for (let day = 0; day <= horizon; day += interval) {
            const doseDate = new Date(startDate.getTime() + day * 24 * 60 * 60 * 1000);
            
            p.timings.forEach(timing => {
                const timeStr = state.settings.notificationTimes[timing] || "08:00";
                const [h, m] = timeStr.split(':').map(Number);
                const timestamp = new Date(doseDate);
                timestamp.setHours(h, m, 0, 0);

                pins.push({
                    name: p.name,
                    dosage: p.dosage,
                    unit: p.unit,
                    timestamp: timestamp.toISOString()
                });
            });
        }
    });
    return pins;
}

startApp();
