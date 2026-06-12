// --- Real-Time Data Store ---
const socket = io();

let staffList = [];
let shops = [];
let payments = [];
let techPayouts = [];
let eodDistributions = [];
let currentUser = null;
let adminWallet = { balance: 0, pendingTech: 0 };
let commissionSettings = { admin: 60, delivery: 40, tech: 10 };
let dailyAttendance = {}; 
let attendanceHistory = {}; // YYYY-MM-DD -> { staffId: status }
let pendingAudit = null;
let ceoSalariesPaid = [];
let absenteeDeductions = [];
let walletTransfers = [];
let ceoLowPayThreshold = 380;
let dailyDeliveries = {}; // staffId -> orderCount

// Listen for initial state from MongoDB on connection
socket.on('initialState', (state) => {
    if (Object.keys(state).length > 0) {
        staffList = state.staffList || [];
        shops = state.shops || [];
        payments = state.payments || [];
        techPayouts = state.techPayouts || [];
        eodDistributions = state.eodDistributions || [];
        adminWallet = state.adminWallet || { balance: 0, pendingTech: 0 };
        commissionSettings = state.commissionSettings || { admin: 60, delivery: 40, tech: 10 };
        dailyAttendance = state.dailyAttendance || {};
        attendanceHistory = state.attendanceHistory || {};
        pendingAudit = state.pendingAudit || null;
        ceoSalariesPaid = state.ceoSalariesPaid || [];
        absenteeDeductions = state.absenteeDeductions || [];
        walletTransfers = state.walletTransfers || [];
        ceoLowPayThreshold = state.ceoLowPayThreshold || 380;
        dailyDeliveries = state.dailyDeliveries || {};
    } else {
        // Cloud is empty. Automatically check local storage to migrate.
        const localStaff = JSON.parse(localStorage.getItem('aura_staff')) || [];
        if (localStaff.length > 0) {
            console.log("Cloud is empty. Automatically migrating local data to cloud.");
            staffList = JSON.parse(localStorage.getItem('aura_staff')) || [];
            shops = JSON.parse(localStorage.getItem('aura_shops')) || [];
            payments = JSON.parse(localStorage.getItem('aura_payments')) || [];
            techPayouts = JSON.parse(localStorage.getItem('aura_tech_payouts')) || [];
            eodDistributions = JSON.parse(localStorage.getItem('aura_eod_distributions')) || [];
            adminWallet = JSON.parse(localStorage.getItem('aura_admin_wallet')) || { balance: 0, pendingTech: 0 };
            commissionSettings = JSON.parse(localStorage.getItem('aura_commission_settings')) || { admin: 60, delivery: 40, tech: 10 };
            dailyAttendance = JSON.parse(localStorage.getItem('aura_daily_attendance')) || {};
            attendanceHistory = JSON.parse(localStorage.getItem('aura_attendance_history')) || {};
            pendingAudit = JSON.parse(localStorage.getItem('aura_pending_audit')) || null;
            ceoSalariesPaid = JSON.parse(localStorage.getItem('aura_ceo_salaries')) || [];
            absenteeDeductions = JSON.parse(localStorage.getItem('aura_absentee_deductions')) || [];
            walletTransfers = JSON.parse(localStorage.getItem('aura_wallet_transfers')) || [];
            ceoLowPayThreshold = JSON.parse(localStorage.getItem('aura_ceo_lowpay_threshold')) || 380;
            dailyDeliveries = JSON.parse(localStorage.getItem('aura_daily_deliveries')) || {};
            saveData(); // Push to MongoDB immediately
        }
    }
    initApp(); // Start the app once data is loaded
});

// Listen for real-time updates from other computers
socket.on('stateUpdated', (state) => {
    staffList = state.staffList || [];
    shops = state.shops || [];
    payments = state.payments || [];
    techPayouts = state.techPayouts || [];
    eodDistributions = state.eodDistributions || [];
    adminWallet = state.adminWallet || { balance: 0, pendingTech: 0 };
    commissionSettings = state.commissionSettings || { admin: 60, delivery: 40, tech: 10 };
    dailyAttendance = state.dailyAttendance || {};
    attendanceHistory = state.attendanceHistory || {};
    pendingAudit = state.pendingAudit || null;
    ceoSalariesPaid = state.ceoSalariesPaid || [];
    absenteeDeductions = state.absenteeDeductions || [];
    walletTransfers = state.walletTransfers || [];
    ceoLowPayThreshold = state.ceoLowPayThreshold || 380;
    dailyDeliveries = state.dailyDeliveries || {};

    // Refresh UI instantly
    if (currentUser) {
        if (currentUser.role === 'staff' || currentUser.role === 'Delivery' || currentUser.role === 'Technical') {
            refreshStaffData();
        } else {
            refreshAdminData();
        }
    }
});

// Helper: Save Data to Cloud
const saveData = () => {
    const fullState = {
        staffList, shops, payments, techPayouts, eodDistributions,
        adminWallet, commissionSettings, dailyAttendance, pendingAudit,
        ceoSalariesPaid, absenteeDeductions, walletTransfers, ceoLowPayThreshold, dailyDeliveries,
        attendanceHistory
    };
    socket.emit('updateState', fullState);
    
    // Fallback save to localStorage just in case
    localStorage.setItem('aura_staff', JSON.stringify(staffList));
    localStorage.setItem('aura_shops', JSON.stringify(shops));
    localStorage.setItem('aura_payments', JSON.stringify(payments));
    localStorage.setItem('aura_tech_payouts', JSON.stringify(techPayouts));
    localStorage.setItem('aura_eod_distributions', JSON.stringify(eodDistributions));
    localStorage.setItem('aura_admin_wallet', JSON.stringify(adminWallet));
    localStorage.setItem('aura_commission_settings', JSON.stringify(commissionSettings));
    localStorage.setItem('aura_daily_attendance', JSON.stringify(dailyAttendance));
    localStorage.setItem('aura_pending_audit', JSON.stringify(pendingAudit));
    localStorage.setItem('aura_ceo_salaries', JSON.stringify(ceoSalariesPaid));
    localStorage.setItem('aura_absentee_deductions', JSON.stringify(absenteeDeductions));
    localStorage.setItem('aura_wallet_transfers', JSON.stringify(walletTransfers));
    localStorage.setItem('aura_ceo_lowpay_threshold', JSON.stringify(ceoLowPayThreshold));
    localStorage.setItem('aura_daily_deliveries', JSON.stringify(dailyDeliveries));
    localStorage.setItem('aura_attendance_history', JSON.stringify(attendanceHistory));
};

// Helper: Generate ID
const generateId = (prefix) => prefix + Math.floor(Math.random() * 10000).toString().padStart(4, '0');

// Helper: Toast
const showToast = (message) => {
    const container = document.getElementById('toast-container');
    const toast = document.createElement('div');
    toast.className = 'toast';
    toast.textContent = message;
    container.appendChild(toast);
    setTimeout(() => {
        toast.style.opacity = '0';
        setTimeout(() => toast.remove(), 300);
    }, 3000);
};

// --- DOM Elements ---
const screens = {
    auth: document.getElementById('auth-screen'),
    admin: document.getElementById('admin-dashboard'),
    staff: document.getElementById('staff-dashboard')
};

// --- Navigation & Routing ---
const showScreen = (screenName) => {
    Object.values(screens).forEach(s => s.classList.remove('active'));
    screens[screenName].classList.add('active');
    
    if(screenName === 'admin') {
        applyRBAC();
        refreshAdminData();
    }
    if(screenName === 'staff') refreshStaffData();
};

const applyRBAC = () => {
    if (!currentUser || !currentUser.isAdmin) return;
    
    const role = currentUser.role;
    
    // Define tab permissions    // RBAC Map
    const permissions = {
        superadmin: ['admin-register', 'admin-shops', 'admin-assign', 'admin-attendance', 'admin-payments', 'admin-reports'],
        ceo: ['admin-ceo', 'admin-register', 'admin-shops', 'admin-assign', 'admin-attendance', 'admin-payments', 'admin-reports'],
        finance: ['admin-register', 'admin-payments'],
        operations: ['admin-shops', 'admin-assign', 'admin-attendance'],
        auditor: ['admin-reports']
    };
    
    const allowedTabs = permissions[role] || [];
    
    // Hide/Show Analytics
    const analyticsPanel = document.getElementById('analytics-overview');
    if(analyticsPanel) {
        analyticsPanel.style.display = (role === 'superadmin' || role === 'ceo') ? 'block' : 'none';
    }
    
    // Hide/Show Nav Buttons
    document.querySelectorAll('.nav-btn').forEach(btn => {
        if(btn.dataset.target) {
            if(allowedTabs.includes(btn.dataset.target)) {
                btn.style.display = 'inline-block';
            } else {
                btn.style.display = 'none';
            }
        }
    });
    
    // Hide/Show Section Content and automatically click the first allowed tab
    document.querySelectorAll('.dashboard-section').forEach(s => s.classList.remove('active'));
    document.querySelectorAll('.nav-btn').forEach(b => b.classList.remove('active'));
    
    if(allowedTabs.length > 0) {
        const firstAllowed = allowedTabs[0];
        document.getElementById(firstAllowed).classList.add('active');
        const activeBtn = document.querySelector(`.nav-btn[data-target="${firstAllowed}"]`);
        if(activeBtn) activeBtn.classList.add('active');
    }
    
    // Hide manager roles in registration form if not CEO
    document.querySelectorAll('.manager-role-option').forEach(opt => {
        if(role === 'ceo') {
            opt.style.display = '';
            opt.disabled = false;
        } else {
            opt.style.display = 'none';
            opt.disabled = true;
        }
    });
    
    // Show back to staff button if manager
    const backBtn = document.getElementById('btn-back-to-staff');
    if (backBtn) {
        backBtn.style.display = currentUser && currentUser.originalRole ? 'inline-block' : 'none';
    }
};

// --- Attendance Logic ---
const renderAttendanceTable = () => {
    const tbody = document.getElementById('attendance-list-tbody');
    if(!tbody) return;
    
    if(staffList.length === 0) {
        tbody.innerHTML = `<tr><td colspan="4" style="text-align: center; padding: 1rem; color: #94a3b8;">No staff registered yet.</td></tr>`;
        return;
    }
    
    tbody.innerHTML = staffList.map(staff => {
        const status = dailyAttendance[staff.id] || 'Present';
        return `
            <tr style="border-bottom: 1px solid rgba(255,255,255,0.1);">
                <td style="padding: 1rem;">${staff.id}</td>
                <td style="padding: 1rem;">${staff.name}</td>
                <td style="padding: 1rem;"><span class="badge" style="background: ${staff.role === 'Technical' ? 'var(--secondary)' : 'var(--primary)'}">${staff.role}</span></td>
                <td style="padding: 1rem; text-align: center;">
                    <select class="input-group attendance-select" data-id="${staff.id}" style="margin: 0; padding: 0.5rem; width: auto; display: inline-block;">
                        <option value="Present" ${status === 'Present' ? 'selected' : ''}>Present</option>
                        <option value="Half" ${status === 'Half' ? 'selected' : ''}>Half Day</option>
                        <option value="Absent" ${status === 'Absent' ? 'selected' : ''}>Absent</option>
                    </select>
                </td>
            </tr>
        `;
    }).join('');
};

window.saveAttendance = () => {
    const selects = document.querySelectorAll('.attendance-select');
    const todayStr = new Date().toISOString().split('T')[0];
    
    if (!attendanceHistory[todayStr]) {
        attendanceHistory[todayStr] = {};
    }
    
    selects.forEach(select => {
        const id = select.getAttribute('data-id');
        const val = select.value;
        dailyAttendance[id] = val;
        attendanceHistory[todayStr][id] = val;
    });
    
    saveData();
    showToast('Attendance saved for today');
    
    // Refresh to update reports UI
    if (typeof renderAttendanceReports === 'function') {
        renderAttendanceReports();
    }
};

window.renderAttendanceReports = () => {
    const monthlyTbody = document.getElementById('monthly-attendance-tbody');
    const daywiseContainer = document.getElementById('daywise-attendance-container');
    
    if (!monthlyTbody || !daywiseContainer) return;
    
    const now = new Date();
    const currentMonthPrefix = now.toISOString().split('T')[0].substring(0, 7); // YYYY-MM
    
    // 1. Calculate Monthly Aggregations
    const monthlyData = {}; // staffId -> { Present, Half, Absent }
    staffList.forEach(s => monthlyData[s.id] = { Present: 0, Half: 0, Absent: 0 });
    
    Object.keys(attendanceHistory).forEach(date => {
        if (date.startsWith(currentMonthPrefix)) {
            const dailyData = attendanceHistory[date];
            Object.keys(dailyData).forEach(staffId => {
                if (monthlyData[staffId] && monthlyData[staffId][dailyData[staffId]] !== undefined) {
                    monthlyData[staffId][dailyData[staffId]]++;
                }
            });
        }
    });
    
    // 2. Render Monthly Summary
    if (staffList.length === 0) {
        monthlyTbody.innerHTML = `<tr><td colspan="6" style="text-align: center; padding: 1rem; color: #94a3b8;">No staff registered.</td></tr>`;
    } else {
        monthlyTbody.innerHTML = staffList.map(staff => {
            const d = monthlyData[staff.id];
            return `
                <tr style="border-bottom: 1px solid rgba(255,255,255,0.1);">
                    <td style="padding: 1rem;">${staff.id}</td>
                    <td style="padding: 1rem; font-weight: bold;">${staff.name}</td>
                    <td style="padding: 1rem;"><span class="badge" style="background: ${staff.role === 'Technical' ? 'var(--secondary)' : 'var(--primary)'}">${staff.role}</span></td>
                    <td style="padding: 1rem; color: #10b981; font-weight: bold; text-align: center;">${d.Present}</td>
                    <td style="padding: 1rem; color: #f59e0b; font-weight: bold; text-align: center;">${d.Half}</td>
                    <td style="padding: 1rem; color: #ef4444; font-weight: bold; text-align: center;">${d.Absent}</td>
                </tr>
            `;
        }).join('');
    }
    
    // 3. Render Day-wise Log (Most recent first)
    const sortedDates = Object.keys(attendanceHistory)
        .filter(d => d.startsWith(currentMonthPrefix))
        .sort((a, b) => b.localeCompare(a));
        
    if (sortedDates.length === 0) {
        daywiseContainer.innerHTML = `<p style="color: #94a3b8; padding: 1rem;">No attendance data logged for this month yet.</p>`;
    } else {
        daywiseContainer.innerHTML = sortedDates.map(date => {
            const dailyData = attendanceHistory[date];
            
            // Collect people who were absent or half day to highlight
            const exceptions = staffList.filter(s => dailyData[s.id] === 'Absent' || dailyData[s.id] === 'Half');
            
            let exceptionsHTML = '';
            if (exceptions.length === 0) {
                exceptionsHTML = `<span style="color: #10b981; font-weight: bold; font-size: 0.9rem;">All Staff Present</span>`;
            } else {
                exceptionsHTML = exceptions.map(s => {
                    const statusColor = dailyData[s.id] === 'Absent' ? '#ef4444' : '#f59e0b';
                    return `<span style="display: inline-block; padding: 0.2rem 0.5rem; background: rgba(0,0,0,0.3); border-radius: 4px; border-left: 3px solid ${statusColor}; margin-right: 0.5rem; margin-bottom: 0.5rem; font-size: 0.85rem;">${s.name} (${dailyData[s.id]})</span>`;
                }).join('');
            }
            
            return `
                <div style="background: rgba(0,0,0,0.2); padding: 1rem; border-radius: 6px; border: 1px solid rgba(255,255,255,0.1);">
                    <h4 style="margin: 0 0 0.5rem 0; color: #e2e8f0; display: flex; justify-content: space-between;">
                        <span>📅 ${date}</span>
                        <span style="font-size: 0.8rem; color: #94a3b8; font-weight: normal;">${Object.keys(dailyData).length} Records</span>
                    </h4>
                    <div style="margin-top: 0.5rem;">
                        ${exceptionsHTML}
                    </div>
                </div>
            `;
        }).join('');
    }
};

// Auth Tabs
document.querySelectorAll('.tab-btn').forEach(btn => {
    btn.addEventListener('click', (e) => {
        document.querySelectorAll('.tab-btn').forEach(b => b.classList.remove('active'));
        document.querySelectorAll('.auth-form').forEach(f => f.classList.remove('active'));
        
        e.target.classList.add('active');
        document.getElementById(e.target.dataset.tab).classList.add('active');
    });
});

// Admin Navigation
document.querySelectorAll('.nav-btn').forEach(btn => {
    btn.addEventListener('click', (e) => {
        document.querySelectorAll('.nav-btn').forEach(b => b.classList.remove('active'));
        document.querySelectorAll('.dashboard-section').forEach(s => s.classList.remove('active'));
        
        e.target.classList.add('active');
        document.getElementById(e.target.dataset.target).classList.add('active');
    });
});

// Logout
document.querySelectorAll('.btn-logout').forEach(btn => {
    btn.addEventListener('click', () => {
        currentUser = null;
        sessionStorage.removeItem('aura_session');
        showScreen('auth');
        showToast('Logged out successfully');
    });
});

// --- Authentication Logic ---

// Admin Login
const adminAccounts = [
    { id: 'ceo', pass: 'ceo123', role: 'ceo', name: 'Chief Executive Officer' },
    { id: 'aura2026', pass: 'aura2026', role: 'superadmin', name: 'Super Admin' }
];

document.getElementById('admin-login').addEventListener('submit', (e) => {
    e.preventDefault();
    const user = document.getElementById('admin-username').value;
    const pass = document.getElementById('admin-password').value;
    
    const account = adminAccounts.find(a => a.id === user && a.pass === pass);
    
    if(account) {
        currentUser = { role: account.role, name: account.name, isAdmin: true };
        sessionStorage.setItem('aura_session', JSON.stringify(currentUser));
        showScreen('admin');
        showToast(`Welcome, ${account.name}`);
    } else {
        showToast('Invalid admin credentials');
    }
});

// Staff Login
document.getElementById('staff-login').addEventListener('submit', (e) => {
    e.preventDefault();
    const id = document.getElementById('staff-id').value.trim();
    const pass = document.getElementById('staff-password').value.trim();
    
    const staff = staffList.find(s => s.id === id && s.password === pass);
    if(staff) {
        if (['Finance Manager', 'Operations Manager', 'Auditor'].includes(staff.role)) {
            // Map to internal admin roles
            let mappedRole = '';
            if (staff.role === 'Finance Manager') mappedRole = 'finance';
            if (staff.role === 'Operations Manager') mappedRole = 'operations';
            if (staff.role === 'Auditor') mappedRole = 'auditor';
            
            currentUser = { ...staff, role: mappedRole, isAdmin: true, originalRole: staff.role };
            sessionStorage.setItem('aura_session', JSON.stringify(currentUser));
            showScreen('staff');
        } else {
            currentUser = staff;
            sessionStorage.setItem('aura_session', JSON.stringify(currentUser));
            showScreen('staff');
        }
        showToast(`Welcome, ${staff.name}`);
    } else {
        showToast('Invalid ID or password');
    }
});

// --- Admin Features ---

// Register Staff
document.getElementById('register-form').addEventListener('submit', (e) => {
    e.preventDefault();
    const name = document.getElementById('reg-name').value;
    const role = document.getElementById('reg-role').value;
    const upi = document.getElementById('reg-upi').value;
    const isManager = ['Finance Manager', 'Operations Manager', 'Auditor'].includes(role);
    const salaryInput = document.getElementById('reg-salary').value;
    const monthlySalary = isManager ? parseFloat(salaryInput) || 0 : 0;
    
    let prefix = 'MGR-';
    if (role === 'Delivery') prefix = 'DEL-';
    else if (role === 'Technical') prefix = 'TECH-';

    const id = generateId(prefix);
    const password = Math.random().toString(36).slice(-6); // random pass
    
    const newStaff = { 
        id, 
        password, 
        name, 
        role, 
        upi, 
        monthlySalary, 
        earnings: 0, 
        transactions: [], 
        pendingTransactions: [] 
    };
    staffList.push(newStaff);
    saveData();
    
    // Show Joining Letter
    const letter = document.getElementById('joining-letter');
    const content = document.getElementById('letter-content');
    content.innerHTML = `
        <p><strong>Date:</strong> ${new Date().toLocaleDateString()}</p>
        <p><strong>To:</strong> ${name}</p>
        <p>Dear ${name},</p>
        <p>Welcome to AURA Dispatch! We are thrilled to have you join our team as a <strong>${role} Staff</strong>.</p>
        <div style="background: rgba(0,0,0,0.05); padding: 1rem; border-radius: 8px; margin: 1rem 0;">
            <p><strong>Your Staff ID:</strong> ${id}</p>
            <p><strong>Your Password:</strong> ${password}</p>
            <p><strong>Linked UPI:</strong> ${upi}</p>
        </div>
        <p>Please keep your credentials secure. You can log in using the Staff Portal.</p>
        <p>Regards,<br><strong>Admin, AURA Dispatch</strong></p>
    `;
    letter.classList.remove('hidden');
    
    showToast('Staff registered successfully');
    document.getElementById('register-form').reset();
    refreshAdminData(); // update dropdowns
});

document.getElementById('print-letter').addEventListener('click', () => {
    window.print();
    document.getElementById('joining-letter').classList.add('hidden');
});

// Refresh Admin Data (Dropdowns & Lists)
const refreshAdminData = () => {
    // Populate Assign Dropdowns
    const delSelect = document.getElementById('assign-delivery');
    const techSelect = document.getElementById('assign-technical');
    const payShopSelect = document.getElementById('pay-shop');
    const assignShopSelect = document.getElementById('assign-shop-select');
    const allShopsList = document.getElementById('all-shops-list');
    
    const adminWalletBalance = document.getElementById('admin-wallet-balance');
    const adminPendingTech = document.getElementById('admin-pending-tech');
    const adminPendingDelivery = document.getElementById('admin-pending-delivery');
    
    // Update old wallet span if exists
    if(adminWalletBalance) adminWalletBalance.textContent = `₹${adminWallet.balance.toFixed(2)}`;
    if(adminPendingTech) adminPendingTech.textContent = `₹${(adminWallet.pendingTech || 0).toFixed(2)}`;
    
    // Update Analytics Overview
    const aAdminWallet = document.getElementById('analytics-admin-wallet');
    const aTodayEarn = document.getElementById('analytics-today-earn');
    const aMonthEarn = document.getElementById('analytics-month-earn');
    const aTotalDist = document.getElementById('analytics-total-dist');
    
    if(aAdminWallet) aAdminWallet.textContent = `₹${adminWallet.balance.toFixed(2)}`;
    
    const now = new Date();
    const todayStr = now.toISOString().split('T')[0]; // yyyy-mm-dd
    const currentMonth = now.getMonth();
    const currentYear = now.getFullYear();
    
    let todayEarnings = 0;
    let monthEarnings = 0;
    
    payments.forEach(p => {
        // Payment date check
        if(p.isoDate && p.isoDate.startsWith(todayStr)) todayEarnings += p.adminCut;
        
        // Month check
        const pDate = new Date(p.isoDate);
        if(pDate.getMonth() === currentMonth && pDate.getFullYear() === currentYear) {
            monthEarnings += p.adminCut;
        }
    });
    
    let monthSalariesPaid = 0;
    // Deduct Corporate Manager salaries paid from this month's earnings
    ceoSalariesPaid.forEach(s => {
        const sDate = new Date(s.isoDate);
        if(sDate.getMonth() === currentMonth && sDate.getFullYear() === currentYear) {
            monthSalariesPaid += s.amount;
            monthEarnings -= s.amount;
        }
    });

    // Add transfers from Admin Wallet to this month's earnings
    walletTransfers.forEach(t => {
        const tDate = new Date(t.isoDate);
        if(tDate.getMonth() === currentMonth && tDate.getFullYear() === currentYear) {
            monthEarnings += t.amount;
        }
    });

    // Deduct EOD bonuses paid by CEO
    eodDistributions.forEach(e => {
        const eDate = new Date(e.isoDate);
        if(eDate.getMonth() === currentMonth && eDate.getFullYear() === currentYear) {
            monthEarnings -= (e.ceoBonusesAllocated || 0);
        }
    });
    
    if(aTodayEarn) aTodayEarn.textContent = `₹${todayEarnings.toFixed(2)}`;
    if(aMonthEarn) aMonthEarn.textContent = `₹${monthEarnings.toFixed(2)}`;
    
    const totalDist = eodDistributions.reduce((sum, e) => sum + e.totalAmount, 0);
    if(aTotalDist) aTotalDist.textContent = `₹${totalDist.toFixed(2)}`;
    
    const totalPendingPayouts = staffList.filter(s => s.role === 'Delivery').reduce((sum, s) => {
        return sum + (s.pendingTransactions ? s.pendingTransactions.reduce((acc, tx) => acc + tx.amount, 0) : 0);
    }, 0);
    if(adminPendingDelivery) adminPendingDelivery.textContent = `₹${totalPendingPayouts.toFixed(2)}`;
    
    // Render Attendance Table
    renderAttendanceTable();
    if (typeof renderAttendanceReports === 'function') {
        renderAttendanceReports();
    }

    // Render Auditor Verification Panel
    const auditPanel = document.getElementById('audit-verification-panel');
    const auditTbody = document.getElementById('audit-verification-tbody');
    if (auditPanel && auditTbody) {
        if (pendingAudit && pendingAudit.ceoApproved && (currentUser.role === 'auditor' || currentUser.role === 'superadmin')) {
            auditPanel.style.display = 'block';
            
            const verifyBtn = document.getElementById('btn-verify-distribute');
            if (verifyBtn) {
                if (pendingAudit.ceoApproved || currentUser.role === 'superadmin') {
                    verifyBtn.textContent = 'Verify & Distribute Salaries';
                    verifyBtn.disabled = false;
                    verifyBtn.style.opacity = '1';
                    verifyBtn.style.cursor = 'pointer';
                } else {
                    verifyBtn.textContent = 'Waiting for CEO Review...';
                    verifyBtn.disabled = true;
                    verifyBtn.style.opacity = '0.5';
                    verifyBtn.style.cursor = 'not-allowed';
                }
            }
            auditTbody.innerHTML = pendingAudit.staffPayouts.map(p => {
                const deliveriesDone = p.role === 'Delivery' ? (dailyDeliveries[p.staffId] || 0) : 'N/A';
                return `
                <tr style="border-bottom: 1px solid rgba(255,255,255,0.1);">
                    <td style="padding: 1rem;">${p.name} <small class="text-muted">(${p.staffId})</small></td>
                    <td style="padding: 1rem;"><span class="badge ${p.role === 'Technical' ? 'technical' : ''}">${p.role}</span></td>
                    <td style="padding: 1rem; color: #ec4899; font-weight: bold;">${deliveriesDone}</td>
                    <td style="padding: 1rem; font-size: 0.85rem; color: #cbd5e1;">${p.assignedShops}</td>
                    <td style="padding: 1rem; font-weight: bold; color: ${p.status === 'Absent' ? '#ef4444' : (p.status === 'Half' ? '#f59e0b' : '#3b82f6')}">${p.status}</td>
                    <td style="padding: 1rem; color: #10b981; font-weight: bold;">₹${p.amountToPay.toFixed(2)}</td>
                </tr>
                `;
            }).join('');
        } else {
            auditPanel.style.display = 'none';
        }
    }
    
    // Render Auditor Daily Deliveries Log
    const deliveriesLogPanel = document.getElementById('auditor-deliveries-log');
    const deliveriesLogContainer = document.getElementById('deliveries-log-container');
    if (deliveriesLogPanel && deliveriesLogContainer) {
        if (pendingAudit && !pendingAudit.auditorPrecheck && (currentUser.role === 'auditor' || currentUser.role === 'superadmin')) {
            deliveriesLogPanel.style.display = 'block';
            let html = '';
            const activeShops = shops.filter(s => s.deliveryStaff && s.deliveryStaff.length > 0);
            
            if (activeShops.length === 0) {
                html = '<p style="color: #94a3b8;">No delivery boys assigned to any shops today.</p>';
            } else {
                activeShops.forEach(shop => {
                    const deliveryStaff = shop.deliveryStaff || [];
                    if (deliveryStaff.length > 0) {
                        html += `
                        <div style="background: rgba(0,0,0,0.2); padding: 1rem; border-radius: 6px; border: 1px solid rgba(255,255,255,0.1);">
                            <h4 style="margin: 0 0 0.5rem 0; color: #e2e8f0;">${shop.name}</h4>
                            <div style="display: grid; gap: 0.5rem;">
                        `;
                        deliveryStaff.forEach(id => {
                            const staff = staffList.find(s => s.id === id);
                            if (staff) {
                                const currentDeliveries = dailyDeliveries[staff.id] || '';
                                html += `
                                <div style="display: flex; justify-content: space-between; align-items: center; background: rgba(0,0,0,0.2); padding: 0.5rem; border-radius: 4px;">
                                    <span style="color: #cbd5e1; font-size: 0.9rem;">${staff.name} <small>(${staff.id})</small></span>
                                    <div style="display: flex; align-items: center; gap: 0.5rem;">
                                        <label style="font-size: 0.8rem; color: #94a3b8;">Orders:</label>
                                        <input type="number" class="delivery-input" data-staffid="${staff.id}" value="${currentDeliveries}" min="0" placeholder="0" style="width: 80px; padding: 0.3rem; border-radius: 4px; border: 1px solid rgba(255,255,255,0.2); background: rgba(0,0,0,0.4); color: white; text-align: center;">
                                    </div>
                                </div>
                                `;
                            }
                        });
                        html += `</div></div>`;
                    }
                });
                if(html === '') html = '<p style="color: #94a3b8;">No delivery boys assigned to active shops today.</p>';
            }
            deliveriesLogContainer.innerHTML = html;
        } else {
            deliveriesLogPanel.style.display = 'none';
        }
    }
    
    // Render CEO Corporate Payroll
    const ceoMonthlyEarningsUI = document.getElementById('ceo-monthly-earnings');
    const ceoSalaryPaidUI = document.getElementById('ceo-salary-paid');
    const ceoTbody = document.getElementById('ceo-payroll-tbody');
    if (ceoMonthlyEarningsUI && ceoTbody) {
        ceoMonthlyEarningsUI.textContent = `₹${monthEarnings.toFixed(2)}`;
        if (ceoSalaryPaidUI) ceoSalaryPaidUI.textContent = `₹${monthSalariesPaid.toFixed(2)}`;
        
        const managers = staffList.filter(s => ['Finance Manager', 'Operations Manager', 'Auditor'].includes(s.role));
        if (managers.length === 0) {
            ceoTbody.innerHTML = `<tr><td colspan="5" style="text-align: center; padding: 1rem; color: #94a3b8;">No corporate managers registered yet.</td></tr>`;
        } else {
            ceoTbody.innerHTML = managers.map(m => {
                const hasBeenPaidThisMonth = ceoSalariesPaid.some(s => {
                    const sDate = new Date(s.isoDate);
                    return s.managerId === m.id && sDate.getMonth() === currentMonth && sDate.getFullYear() === currentYear;
                });
                
                let actionHTML = '';
                if (hasBeenPaidThisMonth) {
                    actionHTML += `<span style="color: #10b981; font-weight: bold; margin-right: 10px;">Paid ✓</span>`;
                }
                actionHTML += `<button class="btn btn-primary" style="padding: 0.3rem 0.6rem; font-size: 0.85rem;" onclick="payManagerSalary('${m.id}')">Pay Salary</button>`;

                return `
                <tr style="border-bottom: 1px solid rgba(255,255,255,0.1);">
                    <td style="padding: 1rem;">${m.id}</td>
                    <td style="padding: 1rem;">${m.name}</td>
                    <td style="padding: 1rem;"><span class="badge" style="background: var(--primary)">${m.role}</span></td>
                    <td style="padding: 1rem;">₹${(m.monthlySalary || 0).toFixed(2)}</td>
                    <td style="padding: 1rem; text-align: right;">
                        ${actionHTML}
                        <button class="btn btn-secondary" style="padding: 0.3rem 0.6rem; font-size: 0.85rem; margin-left: 0.5rem;" onclick="editManagerSalary('${m.id}')">Edit Salary</button>
                        <button class="btn btn-outline" style="color: white; background: #ef4444; border-color: #ef4444; padding: 0.3rem 0.6rem; font-size: 0.85rem; margin-left: 0.5rem;" onclick="fireEmployee('${m.id}')">Fire</button>
                    </td>
                </tr>
                `;
            }).join('');
        }
    }
    
    // Render CEO EOD Review Panel
    const ceoEodPanel = document.getElementById('ceo-eod-review-panel');
    const ceoEodTbody = document.getElementById('ceo-eod-review-tbody');
    const ceoLowPayInput = document.getElementById('ceo-lowpay-input');
    
    if (ceoEodPanel && ceoEodTbody) {
        if (pendingAudit && pendingAudit.auditorPrecheck && !pendingAudit.ceoApproved) {
            ceoEodPanel.style.display = 'block';
            if (ceoLowPayInput) ceoLowPayInput.value = ceoLowPayThreshold;
            
            const sortedPayouts = [...pendingAudit.staffPayouts].sort((a, b) => {
                const aBase = a.amountToPay - (a.ceoBonus || 0);
                const bBase = b.amountToPay - (b.ceoBonus || 0);
                const aLow = (a.status === 'Present' && aBase < ceoLowPayThreshold) ? 1 : 0;
                const bLow = (b.status === 'Present' && bBase < ceoLowPayThreshold) ? 1 : 0;
                if (aLow !== bLow) return bLow - aLow; // Low pay items bubble to top
                if (aLow && bLow) return aBase - bBase; // Sort lowest base pay first among low pay items
                return 0; // maintain original order for others
            });
            
            ceoEodTbody.innerHTML = sortedPayouts.map(p => {
                const bonus = p.ceoBonus || 0;
                const total = p.amountToPay; // amountToPay already includes the bonus (I will update logic to handle this)
                const base = total - bonus;
                const deliveriesDone = p.role === 'Delivery' ? (dailyDeliveries[p.staffId] || 0) : 'N/A';
                return `
                <tr style="border-bottom: 1px solid rgba(255,255,255,0.1);">
                    <td style="padding: 1rem;">${p.name} <small class="text-muted">(${p.staffId})</small></td>
                    <td style="padding: 1rem;"><span class="badge ${p.role === 'Technical' ? 'technical' : ''}">${p.role}</span></td>
                    <td style="padding: 1rem; color: #ec4899; font-weight: bold;">${deliveriesDone}</td>
                    <td style="padding: 1rem; font-weight: bold; color: ${p.status === 'Absent' ? '#ef4444' : (p.status === 'Half' ? '#f59e0b' : '#3b82f6')}">${p.status}</td>
                    <td style="padding: 1rem;">₹${base.toFixed(2)}</td>
                    <td style="padding: 1rem; color: #10b981;">+₹${bonus.toFixed(2)}</td>
                    <td style="padding: 1rem; font-weight: bold; font-size: 1.1rem;">₹${total.toFixed(2)}</td>
                    <td style="padding: 1rem; text-align: right;">
                        <button class="btn btn-secondary" style="padding: 0.3rem 0.6rem; font-size: 0.85rem;" onclick="addCeoBonus('${p.staffId}')">Add Bonus</button>
                    </td>
                </tr>
                `;
            }).join('');
        } else {
            ceoEodPanel.style.display = 'none';
        }
    }
    
    // Render Admin Wallet Controls & Absentee Refunds
    const ceoWalletBal = document.getElementById('ceo-admin-wallet-balance');
    const ceoAbsenteeTbody = document.getElementById('ceo-absentee-tbody');
    if (ceoWalletBal && ceoAbsenteeTbody) {
        ceoWalletBal.textContent = `₹${adminWallet.balance.toFixed(2)}`;
        
        const unrefunded = absenteeDeductions.filter(d => !d.refunded);
        if (unrefunded.length === 0) {
            ceoAbsenteeTbody.innerHTML = `<tr><td colspan="6" style="text-align: center; padding: 1rem; color: #94a3b8;">No pending absentee deductions.</td></tr>`;
        } else {
            ceoAbsenteeTbody.innerHTML = unrefunded.map(d => `
                <tr style="border-bottom: 1px solid rgba(255,255,255,0.1);">
                    <td style="padding: 1rem;">${d.date}</td>
                    <td style="padding: 1rem;">${d.staffId}</td>
                    <td style="padding: 1rem;">${d.name}</td>
                    <td style="padding: 1rem; color: ${d.status === 'Absent' ? '#ef4444' : '#f59e0b'}; font-weight: bold;">${d.status}</td>
                    <td style="padding: 1rem; color: #ef4444;">-₹${d.amount.toFixed(2)}</td>
                    <td style="padding: 1rem; text-align: right;">
                        <button class="btn btn-primary" style="padding: 0.3rem 0.6rem; font-size: 0.85rem;" onclick="refundStaffSalary('${d.id}')">Refund Salary</button>
                        <button class="btn btn-outline" style="color: white; background: #ef4444; border-color: #ef4444; padding: 0.3rem 0.6rem; font-size: 0.85rem; margin-left: 0.5rem;" onclick="deleteAbsenteeRecord('${d.id}')">Delete</button>
                    </td>
                </tr>
            `).join('');
        }
    }
    
    const delContainer = document.getElementById('assign-delivery-container');
    const techContainer = document.getElementById('assign-technical-container');
    if(delContainer) delContainer.innerHTML = '';
    if(techContainer) techContainer.innerHTML = '';
    payShopSelect.innerHTML = '<option value="">-- Select Shop --</option>';
    if(assignShopSelect) assignShopSelect.innerHTML = '<option value="">-- Select Shop --</option>';
    if(allShopsList) allShopsList.innerHTML = '';
    
    staffList.forEach(s => {
        let isAssigned = false;
        if (s.role === 'Delivery') {
            isAssigned = shops.some(shop => shop.deliveryStaff && shop.deliveryStaff.includes(s.id));
        } else if (s.role === 'Technical') {
            isAssigned = shops.some(shop => {
                const techArr = Array.isArray(shop.technicalStaff) ? shop.technicalStaff : (shop.technicalStaff ? [shop.technicalStaff] : []);
                return techArr.includes(s.id);
            });
        }
        
        const assignedLabel = isAssigned ? ' 🟢 [Assigned]' : '';
        const option = `<label style="display:flex; align-items:center; gap:0.5rem; cursor:pointer;"><input type="checkbox" value="${s.id}"> <span>${s.name} (${s.id})${assignedLabel}</span></label>`;
        if(s.role === 'Delivery' && delContainer) delContainer.innerHTML += option;
        if(s.role === 'Technical' && techContainer) techContainer.innerHTML += option;
    });
    
    // Populate Assignments List
    const assignList = document.getElementById('assignments-list');
    assignList.innerHTML = '';
    
    shops.forEach((shop, index) => {
        payShopSelect.innerHTML += `<option value="${index}">${shop.name}</option>`;
        if(assignShopSelect) assignShopSelect.innerHTML += `<option value="${index}">${shop.name} (Req: ${shop.reqDelivery || 1} Del, ${shop.reqTech !== undefined ? shop.reqTech : 1} Tech)</option>`;
        if(allShopsList) {
            allShopsList.innerHTML += `
                <div class="list-item" style="display: flex; justify-content: space-between; align-items: center;">
                    <div>
                        <strong>${shop.name}</strong>
                        <span class="badge">Req Delivery: ${shop.reqDelivery || 1}</span>
                        <span class="badge technical">Req Tech: ${shop.reqTech !== undefined ? shop.reqTech : 1}</span>
                    </div>
                    <button class="btn btn-outline" style="color: #ef4444; border-color: #ef4444; padding: 0.2rem 0.5rem; font-size: 0.8rem;" onclick="deleteShop(${index})">Delete</button>
                </div>
            `;
        }
        
        let delHTML = '';
        if(shop.deliveryStaff && shop.deliveryStaff.length > 0) {
            delHTML = shop.deliveryStaff.map(id => {
                const s = staffList.find(st => st.id === id);
                const name = s ? s.name : id;
                return `<span class="badge" style="background: rgba(255,255,255,0.1); color: white; display: inline-flex; align-items: center; gap: 0.5rem; margin-right: 0.5rem; margin-top: 0.2rem;">
                    ${name} <span style="cursor: pointer; color: #ef4444; font-weight: bold; font-size: 1.1rem; line-height: 1;" onclick="removeStaffFromShop(${index}, '${id}', 'Delivery')">×</span>
                </span>`;
            }).join('');
        } else {
            delHTML = '<span class="text-muted">None</span>';
        }
        
        const techArr = Array.isArray(shop.technicalStaff) ? shop.technicalStaff : (shop.technicalStaff ? [shop.technicalStaff] : []);
        let techHTML = '';
        if(techArr.length > 0) {
            techHTML = techArr.map(id => {
                const s = staffList.find(st => st.id === id);
                const name = s ? s.name : id;
                return `<span class="badge technical" style="display: inline-flex; align-items: center; gap: 0.5rem; margin-right: 0.5rem; margin-top: 0.2rem;">
                    ${name} <span style="cursor: pointer; color: #ef4444; font-weight: bold; font-size: 1.1rem; line-height: 1;" onclick="removeStaffFromShop(${index}, '${id}', 'Technical')">×</span>
                </span>`;
            }).join('');
        } else {
            techHTML = '<span class="text-muted">None</span>';
        }
        
        assignList.innerHTML += `
            <div class="list-item" style="display: flex; justify-content: space-between; align-items: center;">
                <div>
                    <strong>Shop: ${shop.name}</strong><br>
                    <div style="margin-top: 0.5rem; display: flex; align-items: center; flex-wrap: wrap;"><small style="margin-right:0.5rem;">Delivery:</small> ${delHTML}</div>
                    <div style="margin-top: 0.5rem; display: flex; align-items: center; flex-wrap: wrap;"><small style="margin-right:0.5rem;">Technical:</small> ${techHTML}</div>
                </div>
                <button class="btn btn-secondary" style="padding: 0.2rem 0.5rem; font-size: 0.8rem;" onclick="editAssignment(${index})">Edit</button>
            </div>
        `;
    });

    const adminSett = document.getElementById('setting-admin');
    const delSett = document.getElementById('setting-delivery');
    const techSett = document.getElementById('setting-tech');
    if (adminSett) adminSett.value = commissionSettings.admin;
    if (delSett) delSett.value = commissionSettings.delivery;
    if (techSett) techSett.value = commissionSettings.tech;
    
    const infoCard = document.getElementById('commission-info-card');
    if (infoCard) {
        infoCard.innerHTML = `<strong>Per Shop Commission Structure:</strong> Admin: ${commissionSettings.admin}% | Delivery: ${commissionSettings.delivery}% (split if multiple) | Tech Accumulation: ${commissionSettings.tech}%`;
    }

    // --- Master Report Generation ---
    const reportContent = document.getElementById('master-report-content');
    if (reportContent) {
        const dateFilterInput = document.getElementById('report-date-filter');
        let filterDate = dateFilterInput ? dateFilterInput.value : '';
        
        const isSameDate = (item) => {
            if(!filterDate) return true;
            if(item.isoDate) return item.isoDate.startsWith(filterDate);
            
            const dateString = item.date;
            if(!dateString) return false;
            
            const d = new Date(dateString);
            const ds = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
            if(ds === filterDate) return true;
            
            const parts = dateString.split(',')[0].split('/');
            if(parts.length === 3) {
                const altDs = `${parts[2]}-${parts[1].padStart(2, '0')}-${parts[0].padStart(2, '0')}`;
                if(altDs === filterDate) return true;
            }
            return false;
        };
        
        const filteredPayments = payments.filter(isSameDate);
        const filteredEod = eodDistributions.filter(isSameDate);

        let reportHTML = `
            <div style="text-align:center; margin-bottom: 2rem;">
                <img src="logo.png" alt="AURA Dispatch Logo" style="max-width: 120px;">
            </div>
            <div id="section-shops" class="report-section">
                <div style="display:flex; justify-content:space-between; align-items:center; margin-bottom: 1rem;">
                    <h3 style="margin: 0;">Registered Shops (${shops.length})</h3>
                </div>
        `;
        if(shops.length === 0) reportHTML += '<p>No shops registered.</p>';
        else {
            reportHTML += `<table style="width:100%; text-align:left; border-collapse: collapse; margin-bottom: 2rem;">
                <tr style="border-bottom: 2px solid #ccc;">
                    <th>Shop Name</th>
                    <th>Req. Delivery</th>
                    <th>Req. Tech</th>
                    <th>Assigned Delivery Staff</th>
                    <th>Assigned Technical Staff</th>
                </tr>`;
            shops.forEach(shop => {
                const delNames = shop.deliveryStaff && shop.deliveryStaff.length > 0 ? shop.deliveryStaff.map(id => staffList.find(s => s.id === id)?.name || id).join(', ') : 'None';
                const techArr = Array.isArray(shop.technicalStaff) ? shop.technicalStaff : (shop.technicalStaff ? [shop.technicalStaff] : []);
                const techNames = techArr.length > 0 ? techArr.map(id => staffList.find(s => s.id === id)?.name || id).join(', ') : 'None';
                reportHTML += `
                    <tr style="border-bottom: 1px solid #eee;">
                        <td style="padding: 8px 0;">${shop.name}</td>
                        <td>${shop.reqDelivery || 1}</td>
                        <td>${shop.reqTech !== undefined ? shop.reqTech : 1}</td>
                        <td>${delNames}</td>
                        <td>${techNames}</td>
                    </tr>
                `;
            });
            reportHTML += `</table>`;
        }
        
        reportHTML += `
            </div>
            <div id="section-staff" class="report-section" style="margin-top: 2rem;">
                <div style="display:flex; justify-content:space-between; align-items:center; margin-bottom: 1rem;">
                    <h3 style="margin: 0;">All Registered Staff (${staffList.length})</h3>
                </div>
        `;
        if(staffList.length === 0) reportHTML += '<p>No staff registered.</p>';
        else {
            const isCeo = currentUser && currentUser.role === 'ceo';
            reportHTML += `<table style="width:100%; text-align:left; border-collapse: collapse;">
                <tr style="border-bottom: 2px solid #ccc;">
                    <th>ID</th>
                    <th>Name</th>
                    <th>Role</th>
                    <th>Password</th>
                    <th>UPI</th>
                    ${isCeo ? '<th>Action</th>' : ''}
                </tr>`;
            staffList.forEach(staff => {
                reportHTML += `
                    <tr style="border-bottom: 1px solid #eee;">
                        <td style="padding: 8px 0;">${staff.id}</td>
                        <td>${staff.name}</td>
                        <td><span class="badge ${staff.role === 'Technical' ? 'technical' : ''}">${staff.role}</span></td>
                        <td>${staff.password}</td>
                        <td>${staff.upi}</td>
                        ${isCeo ? `<td><button class="btn btn-outline" style="color: white; background: #ef4444; border-color: #ef4444; padding: 0.2rem 0.5rem; font-size: 0.8rem;" onclick="fireEmployee('${staff.id}')">Fire (Remove Job)</button></td>` : ''}
                    </tr>
                `;
            });
            reportHTML += `</table>`;
        }
        
        reportHTML += `
            </div>
            <div id="section-transactions" class="report-section" style="margin-top: 2rem;">
                <div style="display:flex; justify-content:space-between; align-items:center; margin-bottom: 1rem;">
                    <h3 style="margin: 0;">Shop Commission Transactions (${filteredPayments.length})</h3>
                </div>
        `;
        if(filteredPayments.length === 0) reportHTML += '<p>No payments recorded for this date.</p>';
        else {
            reportHTML += `<table style="width:100%; text-align:left; border-collapse: collapse; margin-bottom: 2rem;">
                <tr style="border-bottom: 2px solid #ccc;">
                    <th>Date</th>
                    <th>Shop Name</th>
                    <th>Total Received</th>
                    <th>Admin (${commissionSettings.admin}%)</th>
                    <th>Delivery (${commissionSettings.delivery}%)</th>
                    <th>Accumulated Tech (${commissionSettings.tech}%)</th>
                </tr>`;
            filteredPayments.forEach(p => {
                reportHTML += `
                    <tr style="border-bottom: 1px solid #eee;">
                        <td style="padding: 8px 0;">${p.date}</td>
                        <td>${p.shopName}</td>
                        <td>₹${p.total.toFixed(2)}</td>
                        <td>₹${p.adminCut.toFixed(2)}</td>
                        <td>₹${p.deliveryCut.toFixed(2)}</td>
                        <td>₹${(p.techCut || 0).toFixed(2)}</td>
                    </tr>
                `;
            });
            reportHTML += `</table>`;
        }
        
        reportHTML += `
            </div>
            <div id="section-shopsummary" class="report-section" style="margin-top: 2rem;">
                <div style="display:flex; justify-content:space-between; align-items:center; margin-bottom: 1rem;">
                    <h3 style="margin: 0;">Shop-Wise Summary (End of Day)</h3>
                </div>
        `;
        if(filteredPayments.length === 0) {
            reportHTML += '<p>No payments recorded to summarize.</p>';
        } else {
            const shopSummary = {};
            filteredPayments.forEach(p => {
                if(!shopSummary[p.shopName]) {
                    shopSummary[p.shopName] = { total: 0, admin: 0, delivery: 0, tech: 0 };
                }
                shopSummary[p.shopName].total += p.total;
                shopSummary[p.shopName].admin += p.adminCut;
                shopSummary[p.shopName].delivery += p.deliveryCut;
                shopSummary[p.shopName].tech += (p.techCut || 0);
            });
            
            reportHTML += `<table style="width:100%; text-align:left; border-collapse: collapse; margin-bottom: 2rem;">
                <tr style="border-bottom: 2px solid #ccc;">
                    <th>Shop Name</th>
                    <th>Delivery Assigned</th>
                    <th>Technical Assigned</th>
                    <th>Total Received</th>
                    <th>Admin Comm.</th>
                    <th>Delivery Comm.</th>
                    <th>Tech Comm.</th>
                </tr>`;
            
            Object.keys(shopSummary).forEach(sName => {
                const sData = shopSummary[sName];
                const shopObj = shops.find(s => s.name === sName);
                let delNames = 'None';
                let techNames = 'None';
                if(shopObj) {
                    delNames = shopObj.deliveryStaff && shopObj.deliveryStaff.length > 0 ? shopObj.deliveryStaff.map(id => {
                        const st = staffList.find(x => x.id === id); return st ? st.name : id;
                    }).join('<br>') : 'None';
                    
                    const tArr = Array.isArray(shopObj.technicalStaff) ? shopObj.technicalStaff : (shopObj.technicalStaff ? [shopObj.technicalStaff] : []);
                    techNames = tArr.length > 0 ? tArr.map(id => {
                        const st = staffList.find(x => x.id === id); return st ? st.name : id;
                    }).join('<br>') : 'None';
                }
                
                reportHTML += `
                    <tr style="border-bottom: 1px solid #eee;">
                        <td style="padding: 8px 0; font-weight:bold;">${sName}</td>
                        <td style="font-size:0.85rem; color:var(--text-color);">${delNames}</td>
                        <td style="font-size:0.85rem; color:var(--text-color);">${techNames}</td>
                        <td style="color:#10b981;">₹${sData.total.toFixed(2)}</td>
                        <td>₹${sData.admin.toFixed(2)}</td>
                        <td>₹${sData.delivery.toFixed(2)}</td>
                        <td>₹${sData.tech.toFixed(2)}</td>
                    </tr>
                `;
            });
            reportHTML += `</table>`;
        }
        
        reportHTML += `
            </div>
            <div id="section-eod" class="report-section" style="margin-top: 2rem;">
                <div style="display:flex; justify-content:space-between; align-items:center; margin-bottom: 1rem;">
                    <h3 style="margin: 0;">End of Day Distributions (${filteredEod.length})</h3>
                </div>
        `;
        if(filteredEod.length === 0) reportHTML += '<p>No distributions recorded for this date.</p>';
        else {
            reportHTML += `<table style="width:100%; text-align:left; border-collapse: collapse; margin-bottom: 2rem;">
                <tr style="border-bottom: 2px solid #ccc;">
                    <th>Date</th>
                    <th>Total Staff Distributed</th>
                    <th>Tech Amount</th>
                    <th>Delivery Amount</th>
                    <th>Admin Withdrawn</th>
                    <th>Absentee Recovery</th>
                </tr>`;
            filteredEod.forEach(p => {
                reportHTML += `
                    <tr style="border-bottom: 1px solid #eee;">
                        <td style="padding: 8px 0;">${p.date}</td>
                        <td>₹${p.totalAmount.toFixed(2)}</td>
                        <td>₹${p.techAmount.toFixed(2)}</td>
                        <td>₹${p.deliveryAmount.toFixed(2)}</td>
                        <td style="color:var(--primary); font-weight:bold;">₹${(p.adminWithdrawn || 0).toFixed(2)}</td>
                        <td style="color:var(--primary); font-weight:bold;">₹${(p.absenteeRecovery || 0).toFixed(2)}</td>
                    </tr>
                `;
            });
            reportHTML += `</table>`;
        }
        
        reportHTML += `
            </div>
            <div id="section-staffearnings" class="report-section" style="margin-top: 2rem;">
                <div style="display:flex; justify-content:space-between; align-items:center; margin-bottom: 1rem;">
                    <h3 style="margin: 0;">Staff Daily Earnings Summary</h3>
                </div>
        `;
        let staffEarningsHTML = '';
        let totalDayStaffEarnings = 0;
        
        staffList.forEach(s => {
            if (s.transactions) {
                const dayTxs = s.transactions.filter(isSameDate);
                const dayTotal = dayTxs.reduce((sum, tx) => sum + (tx.amount || 0), 0);
                
                if (dayTotal > 0) {
                    staffEarningsHTML += `
                        <tr style="border-bottom: 1px solid #eee;">
                            <td style="padding: 8px 0; font-weight:bold;">${s.name}</td>
                            <td>${s.id}</td>
                            <td><span class="badge ${s.role === 'Technical' ? 'technical' : ''}">${s.role}</span></td>
                            <td>${s.upi || 'N/A'}</td>
                            <td style="color:#10b981; font-weight:bold;">₹${dayTotal.toFixed(2)}</td>
                        </tr>
                    `;
                    totalDayStaffEarnings += dayTotal;
                }
            }
        });
        
        if (!staffEarningsHTML) {
            reportHTML += '<p>No staff earnings distributed for this date.</p>';
        } else {
            reportHTML += `<table style="width:100%; text-align:left; border-collapse: collapse; margin-bottom: 2rem;">
                <tr style="border-bottom: 2px solid #ccc;">
                    <th>Staff Name</th>
                    <th>Staff ID</th>
                    <th>Role</th>
                    <th>UPI ID</th>
                    <th>Total Earned (This Date)</th>
                </tr>
                ${staffEarningsHTML}
                <tr style="border-top: 2px solid #ccc; font-weight: bold;">
                    <td colspan="4" style="padding: 8px 0;">Total Staff Payout</td>
                    <td style="color:#10b981;">₹${totalDayStaffEarnings.toFixed(2)}</td>
                </tr>
            </table>`;
        }
        
        reportHTML += `</div>`; // close section-staffearnings
        
        reportContent.innerHTML = reportHTML;
    }
};

// Add Shop
const addShopForm = document.getElementById('add-shop-form');
if (addShopForm) {
    addShopForm.addEventListener('submit', (e) => {
        e.preventDefault();
        const shopNum = document.getElementById('add-shop-number').value;
        const shopName = document.getElementById('add-shop-name').value;
        const fullShopName = `#${shopNum} - ${shopName}`;
        
        const reqDelivery = parseInt(document.getElementById('add-shop-req-delivery').value, 10);
        const reqTech = parseInt(document.getElementById('add-shop-req-tech').value, 10);
        
        if(shops.find(s => s.name === fullShopName)) {
            showToast('Shop already exists!');
            return;
        }

        shops.push({
            name: fullShopName,
            reqDelivery: reqDelivery,
            reqTech: reqTech,
            deliveryStaff: [],
            technicalStaff: []
        });
        
        saveData();
        showToast('Shop added successfully');
        addShopForm.reset();
        refreshAdminData();
    });
}

// Delete Shop function (global)
window.deleteShop = (index) => {
    if(confirm('Are you sure you want to delete this shop?')) {
        shops.splice(index, 1);
        saveData();
        refreshAdminData();
        showToast('Shop deleted successfully');
    }
};

// Edit Assignment function (global)
window.editAssignment = (index) => {
    document.getElementById('assign-form').scrollIntoView({ behavior: 'smooth' });
    document.getElementById('assign-shop-select').value = index;
    
    Array.from(document.querySelectorAll('#assign-delivery-container input[type="checkbox"]')).forEach(cb => {
        cb.checked = shops[index].deliveryStaff && shops[index].deliveryStaff.includes(cb.value);
    });
    
    const techArr = Array.isArray(shops[index].technicalStaff) ? shops[index].technicalStaff : (shops[index].technicalStaff ? [shops[index].technicalStaff] : []);
    Array.from(document.querySelectorAll('#assign-technical-container input[type="checkbox"]')).forEach(cb => {
        cb.checked = techArr.includes(cb.value);
    });
    
    showToast(`Editing assignment for ${shops[index].name}. Make changes and click Assign.`);
};

// Assign Shop
document.getElementById('assign-form').addEventListener('submit', (e) => {
    e.preventDefault();
    const shopIdx = document.getElementById('assign-shop-select').value;
    const selectedDel = Array.from(document.querySelectorAll('#assign-delivery-container input:checked')).map(cb => cb.value);
    const selectedTech = Array.from(document.querySelectorAll('#assign-technical-container input:checked')).map(cb => cb.value);
    
    if(shopIdx === "") {
        showToast('Please select a shop');
        return;
    }
    const requiredDel = shops[shopIdx].reqDelivery || 1;
    if(selectedDel.length !== requiredDel) {
        showToast(`This shop requires exactly ${requiredDel} delivery staff!`);
        return;
    }
    const requiredTech = shops[shopIdx].reqTech !== undefined ? shops[shopIdx].reqTech : 1;
    if(selectedTech.length !== requiredTech) {
        showToast(`This shop requires exactly ${requiredTech} technical staff!`);
        return;
    }
    
    shops[shopIdx].deliveryStaff = selectedDel;
    shops[shopIdx].technicalStaff = selectedTech;
    
    saveData();
    showToast('Staff assigned to shop successfully');
    document.getElementById('assign-form').reset();
    refreshAdminData();
});

// Commission Settings
const settingsForm = document.getElementById('commission-settings-form');
if(settingsForm) {
    settingsForm.addEventListener('submit', (e) => {
        e.preventDefault();
        commissionSettings.admin = parseFloat(document.getElementById('setting-admin').value) || 0;
        commissionSettings.delivery = parseFloat(document.getElementById('setting-delivery').value) || 0;
        commissionSettings.tech = parseFloat(document.getElementById('setting-tech').value) || 0;
        saveData();
        showToast('Commission structure updated!');
        refreshAdminData();
    });
}

// Process Payment
document.getElementById('payment-form').addEventListener('submit', (e) => {
    e.preventDefault();
    const shopIdx = document.getElementById('pay-shop').value;
    const amount = parseFloat(document.getElementById('pay-amount').value);
    
    if(shopIdx === "") {
        showToast('Please select a shop');
        return;
    }
    
    const shop = shops[shopIdx];
    
    const adminCut = amount * (commissionSettings.admin / 100);
    const deliveryTotalCut = amount * (commissionSettings.delivery / 100);
    const techAccumulation = amount * (commissionSettings.tech / 100);
    
    adminWallet.balance += adminCut;
    adminWallet.pendingTech += techAccumulation;
    
    const deliveryIndividualCut = deliveryTotalCut / shop.deliveryStaff.length;
    
    // Apply updates for Delivery Staff
    shop.deliveryStaff.forEach(id => {
        const staff = staffList.find(s => s.id === id);
        if(staff) {
            if(!staff.pendingTransactions) staff.pendingTransactions = [];
            staff.pendingTransactions.push({
                date: new Date().toLocaleDateString(),
                time: new Date().toLocaleTimeString(),
                source: `Commission: ${shop.name}`,
                amount: deliveryIndividualCut
            });
        }
    });
    
    // Record payment
    const paymentRecord = {
        date: new Date().toLocaleString(),
        isoDate: new Date().toISOString(),
        shopName: shop.name,
        total: amount,
        adminCut,
        deliveryCut: deliveryTotalCut,
        techCut: techAccumulation
    };
    payments.push(paymentRecord);
    saveData();
    
    showToast('Payment processed successfully');
    
    // Show breakdown
    const breakdown = document.getElementById('payment-breakdown');
    breakdown.innerHTML = `
        <h3>Payment Breakdown</h3>
        <div class="list-item"><span>Admin Wallet (${commissionSettings.admin}%):</span> <strong>₹${adminCut.toFixed(2)}</strong></div>
        <div class="list-item"><span>Delivery (${commissionSettings.delivery}%):</span> <strong>₹${deliveryTotalCut.toFixed(2)} (₹${deliveryIndividualCut.toFixed(2)} each)</strong></div>
        <div class="list-item"><span>Accumulated for Tech (${commissionSettings.tech}%):</span> <strong>₹${techAccumulation.toFixed(2)}</strong></div>
    `;
    breakdown.classList.remove('hidden');
    
    document.getElementById('payment-form').reset();
    refreshAdminData();
});

// --- Staff Features ---
const refreshStaffData = () => {
    document.getElementById('staff-user-name').textContent = currentUser.name || 'Staff';
    const roleBadge = document.getElementById('staff-user-role');
    roleBadge.textContent = currentUser.originalRole || currentUser.role || 'Unknown';
    roleBadge.className = `badge ${currentUser.role === 'Technical' ? 'technical' : ''}`;
    
    const adminBtn = document.getElementById('btn-admin-workspace');
    if(adminBtn) {
        adminBtn.style.display = currentUser.isAdmin ? 'inline-block' : 'none';
    }
    
    // Hide specific staff-only UI elements if the user is a corporate manager
    const statusCard = document.getElementById('staff-status-card');
    const revenueCard = document.getElementById('staff-revenue-card');
    const shopsPanel = document.getElementById('staff-assigned-shops-panel');
    
    const isManager = !!currentUser.isAdmin;
    
    if (statusCard) statusCard.style.display = isManager ? 'none' : 'block';
    if (revenueCard) revenueCard.style.display = isManager ? 'none' : 'block';
    if (shopsPanel) shopsPanel.style.display = isManager ? 'none' : 'block';
    
    document.getElementById('staff-earnings').textContent = `₹${(currentUser.earnings || 0).toFixed(2)}`;
    document.getElementById('staff-upi-display').textContent = currentUser.upi || 'N/A';
    
    // Find assigned shops
    const myShopsList = document.getElementById('staff-shops');
    myShopsList.innerHTML = '';
    
    const myShops = shops.filter(shop => {
        if(currentUser.role === 'Delivery') {
            return Array.isArray(shop.deliveryStaff) ? shop.deliveryStaff.includes(currentUser.id) : shop.deliveryStaff === currentUser.id;
        }
        const techArr = Array.isArray(shop.technicalStaff) ? shop.technicalStaff : (shop.technicalStaff ? [shop.technicalStaff] : []);
        return techArr.includes(currentUser.id);
    });

    // Analytics Calculation
    const now = new Date();
    const todayLocal = now.toLocaleDateString();
    const currentMonth = now.getMonth();
    const currentYear = now.getFullYear();

    let todayEarn = 0;
    let monthEarn = 0;

    if (currentUser.transactions) {
        currentUser.transactions.forEach(tx => {
            if (tx.date === todayLocal) todayEarn += tx.amount;
            
            // Robust date parsing for monthly to handle DD/MM vs MM/DD locale differences
            const parts = tx.date.split(/[/-]/);
            if (parts.length >= 3) {
                const mStr = String(currentMonth + 1);
                const mStrPad = String(currentMonth + 1).padStart(2, '0');
                
                // Check if either the first or second part matches the current month
                const isCurrentMonth = (parts[0] === mStr || parts[0] === mStrPad || parts[1] === mStr || parts[1] === mStrPad);
                // The year is usually the 3rd part
                const isCurrentYear = parts[2].includes(String(currentYear)) || parts[0].includes(String(currentYear)); // sometimes YYYY/MM/DD
                
                if (isCurrentMonth && isCurrentYear) {
                    monthEarn += tx.amount;
                }
            } else {
                // If completely unparseable structure, add it to month to be safe
                monthEarn += tx.amount;
            }
        });
    }

    const todayStatus = dailyAttendance[currentUser.id] || 'Present';
    
    // Total Revenue for assigned shops
    const myShopNames = myShops.map(s => s.name);
    let myShopsRevenue = 0;
    payments.forEach(p => {
        if (myShopNames.includes(p.shopName)) {
            myShopsRevenue += p.total;
        }
    });

    const elToday = document.getElementById('staff-today-earn');
    const elMonth = document.getElementById('staff-month-earn');
    const elStatus = document.getElementById('staff-attendance-status');
    const elRev = document.getElementById('staff-agency-revenue');
    const elDeliveriesCard = document.getElementById('staff-deliveries-card');
    const elTodayDeliveries = document.getElementById('staff-today-deliveries');

    if (elDeliveriesCard && elTodayDeliveries) {
        if (currentUser.role === 'Delivery') {
            elDeliveriesCard.style.display = 'block';
            elTodayDeliveries.textContent = dailyDeliveries[currentUser.id] || 0;
        } else {
            elDeliveriesCard.style.display = 'none';
        }
    }

    if(elToday) elToday.textContent = `₹${todayEarn.toFixed(2)}`;
    if(elMonth) elMonth.textContent = `₹${monthEarn.toFixed(2)}`;
    if(elStatus) {
        elStatus.textContent = todayStatus;
        if(todayStatus === 'Absent') elStatus.style.color = '#ef4444';
        else if(todayStatus === 'Half') elStatus.style.color = '#f59e0b';
        else elStatus.style.color = '#3b82f6';
    }
    if(elRev) elRev.textContent = `₹${myShopsRevenue.toFixed(2)}`;
    
    if(myShops.length === 0) {
        myShopsList.innerHTML = '<p class="text-muted" style="font-weight: bold; color: #94a3b8;">Not assigned</p>';
    } else {
        myShops.forEach(shop => {
            myShopsList.innerHTML += `
                <div class="list-item">
                    <strong>${shop.name}</strong>
                </div>
            `;
        });
    }
    
    // Fill Earnings Report
    const reportContent = document.getElementById('staff-report-content');
    if (reportContent) {
        if (!currentUser.transactions || currentUser.transactions.length === 0) {
            reportContent.innerHTML = '<p class="text-muted">No earnings recorded yet.</p>';
        } else {
            let html = `
                <div style="text-align:center; margin-bottom: 1.5rem;">
                    <img src="logo.png" alt="AURA Dispatch Logo" style="max-width: 100px;">
                </div>
                <table style="width:100%; text-align:left; border-collapse: collapse;">
                <tr style="border-bottom: 2px solid #ccc;">
                    <th>Date & Time</th>
                    <th>Source / Shop</th>
                    <th>Amount</th>
                </tr>`;
            // Reverse so newest is first
            [...currentUser.transactions].reverse().forEach(tx => {
                html += `
                    <tr style="border-bottom: 1px solid #eee;">
                        <td style="padding: 8px 0;">${tx.date} <small class="text-muted">${tx.time}</small></td>
                        <td>${tx.source}</td>
                        <td style="color: #10b981; font-weight: bold;">+₹${tx.amount.toFixed(2)}</td>
                    </tr>
                `;
            });
            html += `</table>`;
            reportContent.innerHTML = html;
        }
    }
};

// Print Report Listener
const printBtn = document.getElementById('print-report');
if (printBtn) {
    printBtn.addEventListener('click', () => {
        const select = document.getElementById('print-section-select');
        const sectionId = select ? select.value : 'all';
        
        let style = document.getElementById('dynamic-print-style');
        if (!style) {
            style = document.createElement('style');
            style.id = 'dynamic-print-style';
            document.head.appendChild(style);
        }
        
        if (sectionId === 'all') {
            style.innerHTML = '';
        } else {
            style.innerHTML = `
                @media print {
                    .report-section:not(#${sectionId}) {
                        display: none !important;
                    }
                }
            `;
        }
        
        document.body.classList.add('printing-report');
        window.print();
        setTimeout(() => document.body.classList.remove('printing-report'), 1000);
    });
}

// End of Day Distribution
const btnEodDistribute = document.getElementById('btn-eod-distribute');
if (btnEodDistribute) {
    btnEodDistribute.addEventListener('click', () => {
        if (pendingAudit !== null) {
            showToast('An audit is already pending verification. Wait for the Auditor to distribute it.');
            return;
        }

        let totalTechDistributed = 0;
        let totalDelDistributed = 0;
        let totalAbsenteeRecovery = 0;
        let staffPayouts = [];
        
        // 1. Distribute Tech from Global Pool
        if (adminWallet.pendingTech > 0) {
            const allTech = staffList.filter(s => s.role === 'Technical');
            if (allTech.length > 0) {
                const individualCut = adminWallet.pendingTech / allTech.length;
                
                allTech.forEach(t => {
                    const status = dailyAttendance[t.id] || 'Present';
                    let amountToPay = 0;
                    let amountToRecover = 0;

                    if (status === 'Present') {
                        amountToPay = individualCut;
                    } else if (status === 'Half') {
                        amountToPay = individualCut / 2;
                        amountToRecover = individualCut / 2;
                    } else if (status === 'Absent') {
                        amountToRecover = individualCut;
                    }

                    let assignedShops = shops.filter(s => {
                        const techArr = Array.isArray(s.technicalStaff) ? s.technicalStaff : (s.technicalStaff ? [s.technicalStaff] : []);
                        return techArr.includes(t.id);
                    }).map(s => s.name).join(', ') || 'None';

                    staffPayouts.push({
                        staffId: t.id,
                        name: t.name,
                        role: 'Technical',
                        status: status,
                        assignedShops: assignedShops,
                        amountToPay: amountToPay,
                        amountToRecover: amountToRecover,
                        txSource: `Global Tech Distribution (${status})`
                    });

                    totalTechDistributed += amountToPay;
                    totalAbsenteeRecovery += amountToRecover;
                    
                    t.pendingTransactions = []; // Clear any orphaned per-shop transactions from earlier version
                });
                adminWallet.pendingTech = 0;
            }
        } else {
            staffList.filter(s => s.role === 'Technical').forEach(t => t.pendingTransactions = []);
        }
        
        // 2. Distribute Delivery from Pending Transactions
        staffList.filter(s => s.role === 'Delivery').forEach(d => {
            if(d.pendingTransactions && d.pendingTransactions.length > 0) {
                const status = dailyAttendance[d.id] || 'Present';
                let amountToPayTotal = 0;
                let amountToRecoverTotal = 0;
                
                d.pendingTransactions.forEach(tx => {
                    if (status === 'Present') {
                        amountToPayTotal += tx.amount;
                    } else if (status === 'Half') {
                        amountToPayTotal += tx.amount / 2;
                        amountToRecoverTotal += tx.amount / 2;
                    } else if (status === 'Absent') {
                        amountToRecoverTotal += tx.amount;
                    }
                });

                let assignedShops = shops.filter(s => {
                    return Array.isArray(s.deliveryStaff) ? s.deliveryStaff.includes(d.id) : s.deliveryStaff === d.id;
                }).map(s => s.name).join(', ') || 'None';

                staffPayouts.push({
                    staffId: d.id,
                    name: d.name,
                    role: 'Delivery',
                    status: status,
                    assignedShops: assignedShops,
                    amountToPay: amountToPayTotal,
                    amountToRecover: amountToRecoverTotal,
                    txSource: `Daily Delivery Commission (${status})`
                });

                totalDelDistributed += amountToPayTotal;
                totalAbsenteeRecovery += amountToRecoverTotal;
                
                d.pendingTransactions = [];
            }
        });
        
        if (staffPayouts.length === 0 && adminWallet.balance === 0) {
            showToast('No pending amounts to distribute.');
            return;
        }
        
        const adminWithdrawn = adminWallet.balance;
        adminWallet.balance = 0;
        
        // Generate Pending Audit Data
        pendingAudit = {
            date: new Date().toLocaleString(),
            isoDate: new Date().toISOString(),
            staffPayouts: staffPayouts,
            totalTechDistributed: totalTechDistributed,
            totalDelDistributed: totalDelDistributed,
            adminWithdrawn: adminWithdrawn,
            totalAbsenteeRecovery: totalAbsenteeRecovery,
            auditorPrecheck: false, // New Step 1: Auditor must log deliveries
            ceoApproved: false // New Step 2: CEO reviews before Auditor final verify
        };
        
        saveData();
        refreshAdminData();
        
        showToast('Audit Report generated! Awaiting Auditor to log Daily Deliveries.');
    });
}

// Auditor Save Daily Deliveries
window.saveDailyDeliveries = () => {
    const inputs = document.querySelectorAll('.delivery-input');
    inputs.forEach(input => {
        const staffId = input.getAttribute('data-staffid');
        const val = parseInt(input.value);
        if(!isNaN(val) && val >= 0) {
            dailyDeliveries[staffId] = val;
        } else {
            dailyDeliveries[staffId] = 0;
        }
    });
    
    // Move the EOD to the CEO Step
    if (pendingAudit) {
        pendingAudit.auditorPrecheck = true;
    }
    
    saveData();
    showToast('Daily deliveries saved! Sent to CEO for Verification.');
    refreshAdminData();
};

// Auditor Verify and Distribute
window.verifyAndDistribute = () => {
    if (!pendingAudit) return;

    // Distribute to individual staff
    pendingAudit.staffPayouts.forEach(payout => {
        const staff = staffList.find(s => s.id === payout.staffId);
        if (staff) {
            staff.earnings += payout.amountToPay;
            if (!staff.transactions) staff.transactions = [];
            
            // Push receipt even if 0 for absent tracking
            staff.transactions.push({
                date: new Date().toLocaleDateString(),
                time: new Date().toLocaleTimeString(),
                source: payout.txSource,
                amount: payout.amountToPay
            });
            
            // Log absentee deduction for CEO refunding
            if (payout.amountToRecover > 0) {
                absenteeDeductions.push({
                    id: generateId('DED-'),
                    staffId: payout.staffId,
                    name: payout.name,
                    date: new Date().toLocaleDateString(),
                    status: payout.status,
                    amount: payout.amountToRecover,
                    refunded: false
                });
            }
        }
    });

    // Handle Admin Deductions from Absences
    adminWallet.balance += pendingAudit.totalAbsenteeRecovery;

    const totalCeoBonus = pendingAudit.staffPayouts.reduce((sum, p) => sum + (p.ceoBonus || 0), 0);

    // Log the EOD Master Record
    eodDistributions.push({
        date: pendingAudit.date,
        isoDate: pendingAudit.isoDate,
        totalAmount: pendingAudit.totalTechDistributed + pendingAudit.totalDelDistributed + totalCeoBonus,
        techAmount: pendingAudit.totalTechDistributed,
        deliveryAmount: pendingAudit.totalDelDistributed,
        adminWithdrawn: pendingAudit.adminWithdrawn,
        absenteeRecovery: pendingAudit.totalAbsenteeRecovery,
        ceoBonusesAllocated: totalCeoBonus
    });

    // Clear Pending Audit
    pendingAudit = null;
    
    saveData();
    refreshAdminData();
    
    showToast('Audit Verified! Salaries successfully distributed to all staff accounts.');
};

// CEO Corporate Payroll function
window.payManagerSalary = (managerId) => {
    const manager = staffList.find(s => s.id === managerId);
    if (!manager) return;
    
    const salary = manager.monthlySalary || 0;
    if (salary <= 0) {
        showToast('This manager has no monthly salary configured.');
        return;
    }
    
    // Calculate current month earnings
    const now = new Date();
    const currentMonth = now.getMonth();
    const currentYear = now.getFullYear();
    
    let currentMonthEarnings = 0;
    payments.forEach(p => {
        const pDate = new Date(p.isoDate);
        if(pDate.getMonth() === currentMonth && pDate.getFullYear() === currentYear) {
            currentMonthEarnings += p.adminCut;
        }
    });
    
    ceoSalariesPaid.forEach(s => {
        const sDate = new Date(s.isoDate);
        if(sDate.getMonth() === currentMonth && sDate.getFullYear() === currentYear) {
            currentMonthEarnings -= s.amount;
        }
    });
    
    if (currentMonthEarnings < salary) {
        showToast('Insufficient Monthly Earnings Account balance to pay this salary!');
        return;
    }
    
    // Log the salary payment
    ceoSalariesPaid.push({
        isoDate: new Date().toISOString(),
        managerId: manager.id,
        amount: salary
    });
    
    // Pay manager
    manager.earnings += salary;
    if (!manager.transactions) manager.transactions = [];
    manager.transactions.push({
        date: new Date().toLocaleDateString(),
        time: new Date().toLocaleTimeString(),
        source: 'CEO Monthly Salary Distribution',
        amount: salary
    });
    
    saveData();
    refreshAdminData();
    showToast(`Paid ₹${salary.toFixed(2)} monthly salary to ${manager.name} from Monthly Earnings Account.`);
};

// Fire Employee Logic
window.fireEmployee = (staffId) => {
    if (!confirm('Are you sure you want to completely remove (fire) this employee? This action cannot be undone.')) return;
    
    // Remove from staffList
    const staffIndex = staffList.findIndex(s => s.id === staffId);
    if (staffIndex === -1) return;
    
    const firedName = staffList[staffIndex].name;
    staffList.splice(staffIndex, 1);
    
    // Clean up shop assignments
    shops.forEach(shop => {
        if (Array.isArray(shop.deliveryStaff)) {
            shop.deliveryStaff = shop.deliveryStaff.filter(id => id !== staffId);
        } else if (shop.deliveryStaff === staffId) {
            shop.deliveryStaff = null;
        }
        
        if (Array.isArray(shop.technicalStaff)) {
            shop.technicalStaff = shop.technicalStaff.filter(id => id !== staffId);
        } else if (shop.technicalStaff === staffId) {
            shop.technicalStaff = null;
        }
    });
    
    saveData();
    refreshAdminData();
    showToast(`${firedName} has been officially fired and removed from the agency.`);
};

// Staff Report Buttons
const staffPrintBtn = document.getElementById('staff-print-report');
if (staffPrintBtn) {
    staffPrintBtn.addEventListener('click', () => {
        document.body.classList.add('staff-printing');
        window.print();
        setTimeout(() => document.body.classList.remove('staff-printing'), 1000);
    });
}

const staffClearBtn = document.getElementById('staff-clear-report');
if (staffClearBtn) {
    staffClearBtn.addEventListener('click', () => {
        if(confirm('Are you sure you want to delete your earning report history? This cannot be undone.')) {
            currentUser.transactions = [];
            const idx = staffList.findIndex(s => s.id === currentUser.id);
            if(idx > -1) staffList[idx] = currentUser;
            saveData();
            refreshStaffData();
            showToast('Earning report deleted.');
        }
    });
}

// Factory Reset
const factoryResetBtn = document.getElementById('factory-reset-btn');
if (factoryResetBtn) {
    factoryResetBtn.addEventListener('click', () => {
        const confirm1 = confirm('WARNING: Are you absolutely sure you want to delete ALL data? This includes all staff, shops, and financial records.');
        if (confirm1) {
            const confirm2 = confirm('This action CANNOT be undone. Click OK to permanently wipe the local database.');
            if (confirm2) {
                localStorage.clear();
                showToast('All data cleared. Reloading application...');
                setTimeout(() => window.location.reload(), 1500);
            }
        }
    });
}

// Date Filter Listener
const reportDateFilter = document.getElementById('report-date-filter');
if (reportDateFilter) {
    if(!reportDateFilter.value) {
        const today = new Date();
        const ds = `${today.getFullYear()}-${String(today.getMonth() + 1).padStart(2, '0')}-${String(today.getDate()).padStart(2, '0')}`;
        reportDateFilter.value = ds;
    }
    reportDateFilter.addEventListener('change', refreshAdminData);
}

// Clear Day Data
const clearDayBtn = document.getElementById('clear-day-data');
if (clearDayBtn) {
    clearDayBtn.addEventListener('click', () => {
        const filterDate = document.getElementById('report-date-filter').value;
        if(!filterDate) {
            showToast('Please select a date first!');
            return;
        }
        
        if(confirm(`Are you sure you want to delete all financial records for ${filterDate}? This will remove payments, distributions, and reset staff earnings for this date. Staff and Shops will NOT be deleted.`)) {
            const isSameDate = (item) => {
                if(!filterDate) return true;
                if(item.isoDate) return item.isoDate.startsWith(filterDate);
                const dateString = item.date;
                if(!dateString) return false;
                const d = new Date(dateString);
                const ds = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
                if(ds === filterDate) return true;
                const parts = dateString.split(',')[0].split('/');
                if(parts.length === 3) {
                    const altDs = `${parts[2]}-${parts[1].padStart(2, '0')}-${parts[0].padStart(2, '0')}`;
                    if(altDs === filterDate) return true;
                }
                return false;
            };

            // Remove payments
            payments = payments.filter(p => !isSameDate(p));
            // Remove eod
            eodDistributions = eodDistributions.filter(p => !isSameDate(p));
            
            // Fix Staff transactions and earnings
            staffList.forEach(s => {
                if(s.transactions) {
                    const toDelete = s.transactions.filter(tx => isSameDate(tx));
                    const deduction = toDelete.reduce((acc, tx) => acc + tx.amount, 0);
                    s.earnings -= deduction;
                    s.transactions = s.transactions.filter(tx => !isSameDate(tx));
                }
                if(s.pendingTransactions) {
                    s.pendingTransactions = s.pendingTransactions.filter(tx => !isSameDate(tx));
                }
            });
            
            saveData();
            refreshAdminData();
            showToast('Financial data for selected date has been cleared.');
        }
    });
}

// Staff Search and Quick Assign
window.searchStaff = () => {
    const id = document.getElementById('search-staff-id').value.trim();
    if(!id) return;
    const staff = staffList.find(s => s.id === id);
    const resultDiv = document.getElementById('staff-search-result');
    if(!staff) {
        resultDiv.innerHTML = `<p style="color: #ef4444; margin: 0;">No staff found with ID: ${id}</p>`;
        resultDiv.classList.remove('hidden');
        return;
    }
    
    // Find assignments
    const assignedShops = shops.filter(shop => {
        if (staff.role === 'Delivery') return shop.deliveryStaff && shop.deliveryStaff.includes(staff.id);
        if (staff.role === 'Technical') {
            const t = Array.isArray(shop.technicalStaff) ? shop.technicalStaff : (shop.technicalStaff ? [shop.technicalStaff] : []);
            return t.includes(staff.id);
        }
        return false;
    }).map(s => s.name);
    
    resultDiv.innerHTML = `
        <h4 style="margin-top: 0;">Staff Profile: ${staff.name}</h4>
        <div style="display: grid; grid-template-columns: 1fr 1fr; gap: 1rem;">
            <div><strong>ID:</strong> <span style="color: var(--secondary);">${staff.id}</span></div>
            <div><strong>Role:</strong> <span class="badge ${staff.role === 'Technical' ? 'technical' : ''}">${staff.role}</span></div>
            <div><strong>Password:</strong> ${staff.password}</div>
            <div><strong>UPI:</strong> ${staff.upi}</div>
            <div><strong>Total Earnings:</strong> <span style="color: #10b981;">₹${(staff.earnings||0).toFixed(2)}</span></div>
            <div style="grid-column: span 2;"><strong>Current Assignments:</strong> ${assignedShops.length > 0 ? assignedShops.join(', ') : 'None'}</div>
        </div>
        <div class="mt-4" style="border-top: 1px solid rgba(255,255,255,0.1); padding-top: 1rem;">
            <strong>Quick Assign to Shop:</strong>
            <div style="display: flex; gap: 1rem; margin-top: 0.5rem; flex-wrap: wrap;">
                <select id="quick-assign-shop" class="input-group" style="padding: 0.5rem; flex: 1;">
                    <option value="">-- Select Shop --</option>
                    ${shops.map((s, idx) => `<option value="${idx}">${s.name}</option>`).join('')}
                </select>
                <button class="btn btn-primary" onclick="quickAssign('${staff.id}')">Start Assignment</button>
            </div>
        </div>
    `;
    resultDiv.classList.remove('hidden');
};

window.quickAssign = (staffId) => {
    const shopIdx = document.getElementById('quick-assign-shop').value;
    if(shopIdx === "") return showToast("Select a shop first");
    
    const staff = staffList.find(s => s.id === staffId);
    if(!staff) return;
    
    const shop = shops[shopIdx];
    
    if(staff.role === 'Delivery') {
        const requiredDel = shop.reqDelivery || 1;
        if(!shop.deliveryStaff) shop.deliveryStaff = [];
        if(shop.deliveryStaff.includes(staff.id)) return showToast(`${staff.name} is already assigned to ${shop.name}.`);
        
        if(shop.deliveryStaff.length >= requiredDel) {
            showToast(`Invalid: Shop already has maximum (${requiredDel}) Delivery staff! Opening Edit mode...`);
            return window.editAssignment(shopIdx);
        }
        shop.deliveryStaff.push(staff.id);
    } else {
        const requiredTech = shop.reqTech !== undefined ? shop.reqTech : 1;
        if(!shop.technicalStaff) shop.technicalStaff = [];
        if(!Array.isArray(shop.technicalStaff)) shop.technicalStaff = [shop.technicalStaff];
        if(shop.technicalStaff.includes(staff.id)) return showToast(`${staff.name} is already assigned to ${shop.name}.`);
        
        if(shop.technicalStaff.length >= requiredTech) {
            showToast(`Invalid: Shop already has maximum (${requiredTech}) Technical staff! Opening Edit mode...`);
            return window.editAssignment(shopIdx);
        }
        shop.technicalStaff.push(staff.id);
    }
    
    saveData();
    refreshAdminData();
    searchStaff(); // refresh the profile view
    showToast(`Successfully assigned ${staff.name} to ${shop.name}!`);
};

// Remove single staff from shop
window.removeStaffFromShop = (shopIdx, staffId, role) => {
    if(confirm('Are you sure you want to remove this staff member from this shop?')) {
        const shop = shops[shopIdx];
        if(role === 'Delivery' && shop.deliveryStaff) {
            shop.deliveryStaff = shop.deliveryStaff.filter(id => id !== staffId);
        } else if (role === 'Technical') {
            let techArr = Array.isArray(shop.technicalStaff) ? shop.technicalStaff : (shop.technicalStaff ? [shop.technicalStaff] : []);
            techArr = techArr.filter(id => id !== staffId);
            shop.technicalStaff = techArr;
        }
        saveData();
        refreshAdminData();
        if(typeof searchStaff === 'function') searchStaff(); // Refresh search widget just in case
        showToast(`Staff removed from ${shop.name}`);
    }
};

// Global function to print specific sections
window.printSection = (sectionId) => {
    let style = document.getElementById('dynamic-print-style');
    if (!style) {
        style = document.createElement('style');
        style.id = 'dynamic-print-style';
        document.head.appendChild(style);
    }
    style.innerHTML = `
        @media print {
            body.dynamic-printing * {
                visibility: hidden !important;
            }
            body.dynamic-printing #${sectionId}, 
            body.dynamic-printing #${sectionId} * {
                visibility: visible !important;
            }
            body.dynamic-printing #${sectionId} {
                position: absolute;
                left: 0;
                top: 0;
                width: 100%;
                margin: 0;
                padding: 0;
            }
            body.dynamic-printing .print-hide,
            body.dynamic-printing .print-hide * {
                display: none !important;
                visibility: hidden !important;
                height: 0 !important;
                margin: 0 !important;
                padding: 0 !important;
            }
            body.dynamic-printing .print-only {
                display: block !important;
                visibility: visible !important;
            }
        }
    `;
    
    document.body.classList.add('dynamic-printing');
    window.print();
    setTimeout(() => document.body.classList.remove('dynamic-printing'), 1000);
};

// Initialize Application
const initApp = () => {
    const savedSession = sessionStorage.getItem('aura_session');
    if (savedSession) {
        try {
            currentUser = JSON.parse(savedSession);
            if (currentUser.isAdmin) {
                showScreen('admin');
            } else {
                showScreen('staff');
            }
        } catch(e) {
            showScreen('auth');
        }
    } else {
        showScreen('auth');
    }
};

// CEO Wallet Controls
window.refundStaffSalary = (deductionId) => {
    const deduction = absenteeDeductions.find(d => d.id === deductionId);
    if (!deduction || deduction.refunded) return;
    
    if (adminWallet.balance < deduction.amount) {
        showToast('Insufficient funds in Admin Wallet to cover this refund!');
        return;
    }
    
    const staff = staffList.find(s => s.id === deduction.staffId);
    if (!staff) {
        showToast('Cannot refund! This staff member no longer exists in the agency.');
        return;
    }
    
    // Process Refund
    adminWallet.balance -= deduction.amount;
    staff.earnings += deduction.amount;
    
    if (!staff.transactions) staff.transactions = [];
    staff.transactions.push({
        date: new Date().toLocaleDateString(),
        time: new Date().toLocaleTimeString(),
        source: `CEO Refund (Absentee Recovery)`,
        amount: deduction.amount
    });
    
    deduction.refunded = true;
    
    saveData();
    refreshAdminData();
    showToast(`Successfully refunded ₹${deduction.amount.toFixed(2)} to ${staff.name}.`);
};

window.transferAdminWalletToEarnings = () => {
    if (adminWallet.balance <= 0) {
        showToast('Admin Wallet is currently empty.');
        return;
    }
    
    if (!confirm(`Are you sure you want to permanently transfer ₹${adminWallet.balance.toFixed(2)} to the Corporate Monthly Earnings?`)) return;
    
    const amountToTransfer = adminWallet.balance;
    adminWallet.balance = 0;
    
    walletTransfers.push({
        isoDate: new Date().toISOString(),
        amount: amountToTransfer
    });
    
    saveData();
    refreshAdminData();
    showToast(`Successfully transferred ₹${amountToTransfer.toFixed(2)} into Corporate Monthly Earnings.`);
};

window.editManagerSalary = (managerId) => {
    const manager = staffList.find(s => s.id === managerId);
    if (!manager) return;
    
    const newSalaryInput = prompt(`Enter new monthly salary for ${manager.name} (${manager.role}):`, manager.monthlySalary || 0);
    if (newSalaryInput === null) return; // Cancelled
    
    const newSalary = parseFloat(newSalaryInput);
    if (isNaN(newSalary) || newSalary < 0) {
        showToast('Invalid salary amount entered.');
        return;
    }
    
    manager.monthlySalary = newSalary;
    saveData();
    refreshAdminData();
    showToast(`Successfully updated monthly salary to ₹${newSalary.toFixed(2)}.`);
};
window.deleteAbsenteeRecord = (deductionId) => {
    if (!confirm('Are you sure you want to delete this record? The withheld money will remain in the Admin Wallet forever.')) return;
    
    const index = absenteeDeductions.findIndex(d => d.id === deductionId);
    if (index !== -1) {
        absenteeDeductions[index].refunded = true; // Mark as resolved so it hides
        saveData();
        refreshAdminData();
        showToast('Absentee record deleted successfully.');
    }
};

window.addCeoBonus = (staffId) => {
    if (!pendingAudit || pendingAudit.ceoApproved) return;
    
    const payout = pendingAudit.staffPayouts.find(p => p.staffId === staffId);
    if (!payout) return;
    
    const bonusInput = prompt(`Enter CEO Bonus amount for ${payout.name}:`, "0");
    if (bonusInput === null) return;
    
    const bonus = parseFloat(bonusInput);
    if (isNaN(bonus) || bonus < 0) {
        showToast('Invalid bonus amount.');
        return;
    }
    
    if (!payout.ceoBonus) payout.ceoBonus = 0;
    
    // Remove old bonus from amountToPay, add new bonus
    payout.amountToPay -= payout.ceoBonus;
    payout.ceoBonus = bonus;
    payout.amountToPay += bonus;
    
    saveData();
    refreshAdminData();
    showToast(`Successfully allocated ₹${bonus.toFixed(2)} bonus to ${payout.name}.`);
};

window.approvePendingAudit = () => {
    if (!pendingAudit || pendingAudit.ceoApproved) return;
    
    const totalBonuses = pendingAudit.staffPayouts.reduce((sum, p) => sum + (p.ceoBonus || 0), 0);
    
    if (confirm(`Approve End-of-Day Distribution? You have allocated ₹${totalBonuses.toFixed(2)} in total bonuses from the Monthly Earnings account.`)) {
        pendingAudit.ceoApproved = true;
        saveData();
        refreshAdminData();
        showToast('EOD Distribution Approved! The Auditor can now verify and execute it.');
    }
};
window.updateCeoThreshold = () => {
    const val = parseFloat(document.getElementById('ceo-lowpay-input').value);
    if (!isNaN(val) && val >= 0) {
        ceoLowPayThreshold = val;
        saveData();
        refreshAdminData();
        showToast('Low pay threshold updated!');
    }
};

// Note: initApp() is now called inside the socket.on('initialState') event at the top of the file.
window.clearAllData = () => {
    if(!confirm("⚠️ WARNING: You are about to permanently delete ALL data in the agency (Staff, Shops, Transactions, Salaries, Attendance, etc). This cannot be undone. Are you absolutely sure?")) return;
    
    const userConfirm = prompt("To confirm deletion, please type 'DELETE ALL'");
    if(userConfirm !== 'DELETE ALL') {
        alert("Deletion cancelled.");
        return;
    }
    
    // Wipe all global state
    staffList = [];
    shops = [];
    payments = [];
    techPayouts = [];
    eodDistributions = [];
    adminWallet = { balance: 0, pendingTech: 0 };
    commissionSettings = { admin: 60, delivery: 40, tech: 10 };
    dailyAttendance = {};
    attendanceHistory = {};
    pendingAudit = null;
    ceoSalariesPaid = [];
    absenteeDeductions = [];
    walletTransfers = [];
    ceoLowPayThreshold = 380;
    dailyDeliveries = {};
    
    // Save the empty state (which automatically updates MongoDB and broadcasts to all clients)
    saveData();
    
    // Wipe localStorage locally just in case
    localStorage.clear();
    
    alert("System has been completely wiped. The app will now reload.");
    window.location.reload();
};
