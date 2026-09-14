document.addEventListener('DOMContentLoaded', () => {
    // -------------------------------------------------------------
    // 1. GLOBAL STATE & THRESHOLDS
    // -------------------------------------------------------------
    let acceptanceTests = [];
    let maintenanceTickets = [];

    let thresholds = {
        minVolt: 42.0,
        maxVolt: 52.0,
        minCurr: 15.0,
        maxCurr: 45.0,
        maxAtt: 15.0
    };

    // -------------------------------------------------------------
    // 2. NAVIGATION & VIEW SWITCHING
    // -------------------------------------------------------------
    const navItems = document.querySelectorAll('.nav-item');
    const viewPanels = document.querySelectorAll('.view-panel');

    function switchView(targetViewId) {
        navItems.forEach(item => {
            if (item.getAttribute('data-view') === targetViewId) {
                item.classList.add('active');
            } else {
                item.classList.remove('active');
            }
        });

        viewPanels.forEach(panel => {
            if (panel.id === `view-${targetViewId}`) {
                panel.classList.add('active');
            } else {
                panel.classList.remove('active');
            }
        });
    }

    navItems.forEach(item => {
        item.addEventListener('click', (e) => {
            e.preventDefault();
            const targetView = item.getAttribute('data-view');
            switchView(targetView);
        });
    });

    document.querySelectorAll('.nav-switch').forEach(link => {
        link.addEventListener('click', (e) => {
            e.preventDefault();
            const target = link.getAttribute('data-target');
            switchView(target);
        });
    });

    const btnRunTestFromView = document.getElementById('btnRunTestFromView');
    const btnLogTicketFromView = document.getElementById('btnLogTicketFromView');
    if (btnRunTestFromView) btnRunTestFromView.addEventListener('click', () => openModal('testModal'));
    if (btnLogTicketFromView) btnLogTicketFromView.addEventListener('click', () => openModal('ticketModal'));

    // -------------------------------------------------------------
    // 3. DYNAMIC EXCHANGE STATUS CONTROL & UI SYNCHRONIZATION
    // -------------------------------------------------------------
    function updateExchangeStatus(serviceKey, status) {
        const dotElement = document.getElementById(`dot-${serviceKey}`);
        const badgeElement = document.getElementById(`badge-${serviceKey}`);
        
        // Also sync main dashboard metric cards
        const mainCardStatMap = {
            'asterisk': 'stat-exchange',
            'sip': 'stat-voip',
            'isdn': 'stat-isdn',
            'pstn': 'stat-pstn'
        };
        const mainCardElement = document.getElementById(mainCardStatMap[serviceKey]);

        if (!dotElement || !badgeElement) return;

        const upperStatus = status.toUpperCase();

        dotElement.classList.remove('green', 'orange', 'red');
        badgeElement.classList.remove('green', 'orange', 'red');

        if (['ONLINE', 'ACTIVE', 'NORMAL'].includes(upperStatus)) {
            dotElement.classList.add('green');
            badgeElement.classList.add('green');
            if (mainCardElement) {
                mainCardElement.textContent = upperStatus;
                mainCardElement.className = 'green-text';
            }
        } else if (['DEGRADED', 'WARNING', 'MEDIUM'].includes(upperStatus)) {
            dotElement.classList.add('orange');
            badgeElement.classList.add('orange');
            if (mainCardElement) {
                mainCardElement.textContent = upperStatus;
                mainCardElement.className = 'orange-text';
            }
        } else {
            dotElement.classList.add('red');
            badgeElement.classList.add('red');
            if (mainCardElement) {
                mainCardElement.textContent = upperStatus;
                mainCardElement.className = 'red-text';
            }
        }

        badgeElement.textContent = upperStatus;
        reevaluateOverallStatus();
        updateNotificationsDropdown();
    }

    function reevaluateOverallStatus() {
        const statuses = [
            document.getElementById('badge-asterisk')?.textContent,
            document.getElementById('badge-sip')?.textContent,
            document.getElementById('badge-isdn')?.textContent,
            document.getElementById('badge-pstn')?.textContent,
            document.getElementById('badge-gateway')?.textContent
        ];

        const overallElement = document.getElementById('stat-overall');
        if (!overallElement) return;

        if (statuses.includes('OFFLINE') || statuses.includes('FAIL') || statuses.includes('HIGH')) {
            overallElement.textContent = 'FAIL';
            overallElement.className = 'red-text';
        } else if (statuses.includes('DEGRADED') || statuses.includes('WARNING')) {
            overallElement.textContent = 'WARN';
            overallElement.className = 'orange-text';
        } else {
            overallElement.textContent = 'PASS';
            overallElement.className = 'green-text';
        }
    }

    window.updateExchangeStatus = updateExchangeStatus;

    // -------------------------------------------------------------
    // 4. CHART INITIALIZATIONS & REAL-TIME UPDATES
    // -------------------------------------------------------------
    let trendsChart, acceptanceChart, ticketsChart, telemetryChart;

    function initCharts() {
        const ctxTrends = document.getElementById('trendsChart')?.getContext('2d');
        if (ctxTrends) {
            trendsChart = new Chart(ctxTrends, {
                type: 'line',
                data: {
                    labels: ['Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat', 'Sun'],
                    datasets: [
                        { label: 'Avg Voltage (V)', data: [48.1, 48.0, 47.9, 48.2, 48.1, 48.3, 48.2], borderColor: '#2563eb', tension: 0.4, fill: false },
                        { label: 'Avg Current (mA)', data: [24.0, 24.2, 24.1, 24.5, 24.3, 24.4, 24.5], borderColor: '#16a34a', tension: 0.4, fill: false },
                        { label: 'Avg Attenuation (dB)', data: [1.8, 1.9, 2.1, 1.9, 2.0, 1.8, 1.9], borderColor: '#ea580c', tension: 0.4, fill: false }
                    ]
                },
                options: { responsive: true, maintainAspectRatio: false }
            });
        }

        const ctxAcceptance = document.getElementById('acceptanceChart')?.getContext('2d');
        if (ctxAcceptance) {
            acceptanceChart = new Chart(ctxAcceptance, {
                type: 'doughnut',
                data: {
                    labels: ['PASS', 'FAIL'],
                    datasets: [{ data: [0, 0], backgroundColor: ['#16a34a', '#dc2626'] }]
                },
                options: { responsive: true, maintainAspectRatio: false }
            });
        }

        const ctxTickets = document.getElementById('ticketsChart')?.getContext('2d');
        if (ctxTickets) {
            ticketsChart = new Chart(ctxTickets, {
                type: 'doughnut',
                data: {
                    labels: ['High', 'Medium', 'Low'],
                    datasets: [{ data: [0, 0, 0], backgroundColor: ['#dc2626', '#ea580c', '#2563eb'] }]
                },
                options: { responsive: true, maintainAspectRatio: false }
            });
        }

        const ctxTelemetry = document.getElementById('telemetryChart')?.getContext('2d');
        if (ctxTelemetry) {
            telemetryChart = new Chart(ctxTelemetry, {
                type: 'line',
                data: {
                    labels: ['00:00', '03:00', '06:00', '09:00', '12:00', '15:00', '18:00', '21:00', 'Now'],
                    datasets: [
                        {
                            label: 'Line Voltage (V)',
                            data: [48.0, 50.1, 48.0, 45.9, 45.0, 48.0, 50.1, 48.0, 48.2],
                            borderColor: '#2563eb',
                            borderWidth: 2,
                            tension: 0.45,
                            fill: false,
                            yAxisID: 'y'
                        },
                        {
                            label: 'Loop Current (mA)',
                            data: [25.0, 31.3, 25.0, 18.7, 16.2, 25.0, 31.3, 25.0, 24.5],
                            borderColor: '#16a34a',
                            borderWidth: 2,
                            tension: 0.45,
                            fill: false,
                            yAxisID: 'y'
                        },
                        {
                            label: 'Attenuation (dB)',
                            data: [5.0, 8.5, 5.0, 1.5, 0.0, 5.0, 8.5, 5.0, 2.1],
                            borderColor: '#ea580c',
                            borderWidth: 2,
                            tension: 0.45,
                            fill: false,
                            yAxisID: 'y1'
                        }
                    ]
                },
                options: {
                    responsive: true,
                    maintainAspectRatio: false,
                    scales: {
                        x: { title: { display: true, text: 'Test Timeline' } },
                        y: { type: 'linear', display: true, position: 'left', min: 0, max: 60, title: { display: true, text: 'Voltage (V) / Current (mA)' } },
                        y1: { type: 'linear', display: true, position: 'right', min: 0, max: 20, grid: { drawOnChartArea: false }, title: { display: true, text: 'Attenuation (dB)' } }
                    }
                }
            });
        }
    }

    initCharts();

    function updateTelemetryChart(voltage, current, attenuation) {
        if (!telemetryChart) return;
        const nowStr = new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit', second: '2-digit' });
        
        telemetryChart.data.labels.push(nowStr);
        telemetryChart.data.datasets[0].data.push(voltage);
        telemetryChart.data.datasets[1].data.push(current);
        telemetryChart.data.datasets[2].data.push(attenuation);

        // Keep last 10 points for clean real-time view
        if (telemetryChart.data.labels.length > 10) {
            telemetryChart.data.labels.shift();
            telemetryChart.data.datasets[0].data.shift();
            telemetryChart.data.datasets[1].data.shift();
            telemetryChart.data.datasets[2].data.shift();
        }
        telemetryChart.update();
    }

    // -------------------------------------------------------------
    // 5. INTERACTIVE NOTIFICATIONS & ADMIN DROPDOWNS
    // -------------------------------------------------------------
    function updateNotificationsDropdown() {
        const notifDropdown = document.getElementById('notifDropdown');
        const notifBadge = document.getElementById('notifBadge');
        if (!notifDropdown) return;

        let activeAlerts = maintenanceTickets.filter(t => t.status === 'Open');
        if (notifBadge) notifBadge.textContent = activeAlerts.length;

        let alertsHtml = `<div class="dropdown-header">SYSTEM ALERTS (${activeAlerts.length})</div>`;
        if (activeAlerts.length === 0) {
            alertsHtml += `<div class="dropdown-item"><small>No active system faults.</small></div>`;
        } else {
            alertsHtml += activeAlerts.slice(0, 4).map(tk => `
                <div class="dropdown-item">
                    <i class="fa-solid fa-triangle-exclamation orange-text"></i>
                    <div><strong>${tk.id}: ${tk.equipment}</strong><br><small>${tk.fault}</small></div>
                </div>
            `).join('');
        }
        notifDropdown.innerHTML = alertsHtml;
    }

    // Refresh Button Animation & Action
    const refreshBtn = document.getElementById('refreshBtn');
    if (refreshBtn) {
        refreshBtn.addEventListener('click', () => {
            refreshBtn.style.transition = 'transform 0.6s ease';
            refreshBtn.style.transform = 'rotate(360deg)';
            setTimeout(() => { refreshBtn.style.transform = 'rotate(0deg)'; }, 600);
            updateDashboard();
        });
    }

    // -------------------------------------------------------------
    // 6. MODALS & FORMS
    // -------------------------------------------------------------
    const openTestModalBtn = document.getElementById('openTestModalBtn');
    const openTicketModalBtn = document.getElementById('openTicketModalBtn');
    const modals = document.querySelectorAll('.modal-overlay');
    const closeBtns = document.querySelectorAll('.close-modal');

    function openModal(modalId) {
        const modal = document.getElementById(modalId);
        if (modal) modal.style.display = 'flex';
    }

    function closeModal() {
        modals.forEach(modal => modal.style.display = 'none');
    }

    if (openTestModalBtn) openTestModalBtn.addEventListener('click', () => openModal('testModal'));
    if (openTicketModalBtn) openTicketModalBtn.addEventListener('click', () => openModal('ticketModal'));
    closeBtns.forEach(btn => btn.addEventListener('click', closeModal));

    window.addEventListener('click', (e) => {
        modals.forEach(modal => {
            if (e.target === modal) modal.style.display = 'none';
        });
    });

    // -------------------------------------------------------------
    // 7. DASHBOARD & DATA UPDATES
    // -------------------------------------------------------------
    function updateDashboard() {
        document.getElementById('stat-tests').textContent = acceptanceTests.length;
        document.getElementById('stat-tickets').textContent = maintenanceTickets.filter(t => t.status !== 'Resolved').length;

        const recentTestBody = document.getElementById('acceptanceTableBody');
        const fullTestBody = document.getElementById('fullAcceptanceTableBody');

        let testRowsHTML = acceptanceTests.map(t => `
            <tr>
                <td class="link-id">${t.id}</td>
                <td>${t.site}</td>
                <td>${t.equipment}</td>
                <td>${t.timestamp}</td>
                <td>${t.voltage} V</td>
                <td>${t.current} mA</td>
                <td>${t.attenuation} dB</td>
                <td><span class="status-pill ${t.status === 'PASS' ? 'pass' : 'fail'}">${t.status}</span></td>
            </tr>
        `).join('');

        if (recentTestBody) recentTestBody.innerHTML = testRowsHTML;
        if (fullTestBody) fullTestBody.innerHTML = testRowsHTML;

        const recentTicketBody = document.getElementById('ticketsTableBody');
        const fullTicketBody = document.getElementById('fullTicketsTableBody');

        let ticketRowsHTML = maintenanceTickets.map(tk => `
            <tr>
                <td class="link-id">${tk.id}</td>
                <td>${tk.equipment}</td>
                <td>${tk.fault}</td>
                <td><span class="severity-tag ${tk.severity.toLowerCase()}">${tk.severity}</span></td>
                <td><span class="status-pill ${tk.status === 'Open' ? 'fail' : 'pass'}">${tk.status}</span></td>
                ${fullTicketBody ? `<td><button class="action-btn small resolve-btn" data-id="${tk.id}">Resolve</button></td>` : ''}
            </tr>
        `).join('');

        if (recentTicketBody) recentTicketBody.innerHTML = ticketRowsHTML;
        if (fullTicketBody) fullTicketBody.innerHTML = ticketRowsHTML;

        document.querySelectorAll('.resolve-btn').forEach(btn => {
            btn.addEventListener('click', () => {
                const id = btn.getAttribute('data-id');
                const ticket = maintenanceTickets.find(t => t.id === id);
                if (ticket) {
                    ticket.status = 'Resolved';
                    updateDashboard();
                    updateNotificationsDropdown();
                }
            });
        });

        if (acceptanceChart) {
            const passCount = acceptanceTests.filter(t => t.status === 'PASS').length;
            const failCount = acceptanceTests.length - passCount;
            acceptanceChart.data.datasets[0].data = [passCount, failCount];
            acceptanceChart.update();
        }

        if (ticketsChart) {
            const highCount = maintenanceTickets.filter(t => t.severity === 'High' && t.status === 'Open').length;
            const medCount = maintenanceTickets.filter(t => t.severity === 'Medium' && t.status === 'Open').length;
            const lowCount = maintenanceTickets.filter(t => t.severity === 'Low' && t.status === 'Open').length;
            ticketsChart.data.datasets[0].data = [highCount, medCount, lowCount];
            ticketsChart.update();
        }

        updateNotificationsDropdown();
    }

    // Corrected equipment keyword mapping (ISDN evaluated before trunk)
    function getServiceKeyFromEquipment(equipStr) {
        const str = equipStr.toLowerCase().trim();
        if (str.includes('isdn') || str.includes('pri') || str.includes('bri')) return 'isdn';
        if (str.includes('pstn') || str.includes('line') || str.includes('analog')) return 'pstn';
        if (str.includes('sip') || str.includes('voip')) return 'sip';
        if (str.includes('asterisk') || str.includes('pbx') || str.includes('server')) return 'asterisk';
        if (str.includes('trunk')) return 'sip'; // default generic trunk to sip
        if (str.includes('gateway') || str.includes('router') || str.includes('ata')) return 'gateway';
        return 'asterisk';
    }

    // -------------------------------------------------------------
    // 8. FORM SUBMISSIONS
    // -------------------------------------------------------------
    const testForm = document.getElementById('testForm');
    if (testForm) {
        testForm.addEventListener('submit', (e) => {
            e.preventDefault();

            const site = document.getElementById('testSite').value;
            const equip = document.getElementById('testEquip').value;
            const volt = parseFloat(document.getElementById('testVoltage').value);
            const curr = parseFloat(document.getElementById('testCurrent').value);
            const pin = parseFloat(document.getElementById('testPin').value);
            const pout = parseFloat(document.getElementById('testPout').value);

            let att = 0;
            if (pin > 0 && pout > 0) {
                att = (10 * Math.log10(pin / pout)).toFixed(2);
            }

            const isPass = (volt >= thresholds.minVolt && volt <= thresholds.maxVolt) &&
                           (curr >= thresholds.minCurr && curr <= thresholds.maxCurr) &&
                           (att <= thresholds.maxAtt);

            const testResult = isPass ? 'PASS' : 'FAIL';
            const testId = `AT-${String(acceptanceTests.length + 1).padStart(4, '0')}`;

            acceptanceTests.unshift({
                id: testId,
                site: site,
                equipment: equip,
                timestamp: new Date().toLocaleString(),
                voltage: volt,
                current: curr,
                attenuation: att,
                status: testResult
            });

            const targetKey = getServiceKeyFromEquipment(equip);
            if (!isPass) {
                updateExchangeStatus(targetKey, 'OFFLINE');
                maintenanceTickets.unshift({
                    id: `TK-${String(maintenanceTickets.length + 1).padStart(4, '0')}`,
                    equipment: equip,
                    fault: `Automated Test Failure (${volt}V, ${att}dB)`,
                    severity: 'High',
                    status: 'Open'
                });
            } else {
                updateExchangeStatus(targetKey, 'ONLINE');
            }

            updateTelemetryChart(volt, curr, parseFloat(att));
            updateDashboard();
            closeModal();
            testForm.reset();
        });
    }

    const ticketForm = document.getElementById('ticketForm');
    if (ticketForm) {
        ticketForm.addEventListener('submit', (e) => {
            e.preventDefault();

            const equipInput = document.getElementById('ticketEquip');
            const severityInput = document.getElementById('ticketSeverity');
            const faultInput = document.getElementById('ticketFault');

            const equip = equipInput ? equipInput.value : '';
            const severity = severityInput ? severityInput.value : 'High';
            const fault = faultInput ? faultInput.value : 'System Issue';

            const ticketId = `TK-${String(maintenanceTickets.length + 1).padStart(4, '0')}`;

            maintenanceTickets.unshift({
                id: ticketId,
                equipment: equip,
                fault: fault,
                severity: severity,
                status: 'Open'
            });

            const targetKey = getServiceKeyFromEquipment(equip);

            if (severity.toLowerCase() === 'high') {
                updateExchangeStatus(targetKey, 'OFFLINE');
            } else if (severity.toLowerCase() === 'medium') {
                updateExchangeStatus(targetKey, 'DEGRADED');
            } else {
                updateExchangeStatus(targetKey, 'ONLINE');
            }

            updateDashboard();
            closeModal();
            ticketForm.reset();
        });
    }

    const saveSettingsBtn = document.getElementById('saveSettingsBtn');
    if (saveSettingsBtn) {
        saveSettingsBtn.addEventListener('click', () => {
            thresholds.minVolt = parseFloat(document.getElementById('cfgMinVolt').value) || thresholds.minVolt;
            thresholds.maxVolt = parseFloat(document.getElementById('cfgMaxVolt').value) || thresholds.maxVolt;
            thresholds.minCurr = parseFloat(document.getElementById('cfgMinCurr').value) || thresholds.minCurr;
            thresholds.maxCurr = parseFloat(document.getElementById('cfgMaxCurr').value) || thresholds.maxCurr;
            thresholds.maxAtt = parseFloat(document.getElementById('cfgMaxAtt').value) || thresholds.maxAtt;

            alert('System Settings updated successfully!');
        });
    }

    // -------------------------------------------------------------
    // 9. INITIAL DATA LOAD
    // -------------------------------------------------------------
    acceptanceTests = [
        { id: 'AT-0001', site: 'Kampala Exchange', equipment: 'SIP Trunk Primary', timestamp: '28 Aug 2026, 08:30', voltage: 48.2, current: 24.5, attenuation: 1.2, status: 'PASS' },
        { id: 'AT-0002', site: 'Entebbe Branch', equipment: 'ISDN PRI Line', timestamp: '28 Aug 2026, 09:15', voltage: 47.9, current: 22.1, attenuation: 2.1, status: 'PASS' }
    ];

    maintenanceTickets = [
        { id: 'TK-0001', equipment: 'Entebbe Branch ATA', fault: 'Intermittent line voltage drop', severity: 'Medium', status: 'Open' }
    ];

    updateDashboard();
});