// --- โครงสร้างข้อมูลหลักและสถานะของแอปพลิเคชัน ---
const APP_NAME = 'budgetTrackerPro';
let currentProfile = 'default';

// ข้อมูลที่ดึงมาจาก API และจะถูกใช้ในการแสดงผล
let budgetData = [];
let columnStructure = { income: [], expense: [], savings: [] };
let expenseDueDates = {}; // key: categoryId, value: day
let incomeDueDates = {}; // key: categoryId, value: day
let savingsGoals = [];
let recurringTransactions = {}; // key: categoryId, value: amount

// ใช้สำหรับป้องกันการแจ้งเตือนซ้ำใน Session ปัจจุบัน
let sessionNotifications = new Set();
let saveTimer = null;
const DEBOUNCE_DELAY = 800; // 800 มิลลิวินาที

// --- START: เพิ่มตัวแปรสำหรับ Sidebar Resizer ---
const sidebar = document.querySelector('.sidebar');
const resizer = document.querySelector('.resizer');
// --- END: เพิ่มตัวแปร ---


const thaiMonths = [
    'มกราคม', 'กุมภาพันธ์', 'มีนาคม', 'เมษายน', 'พฤษภาคม', 'มิถุนายน',
    'กรกฎาคม', 'สิงหาคม', 'กันยายน', 'ตุลาคม', 'พฤศจิกายน', 'ธันวาคม'
];

// ===================================================================================
// --- 1. ระบบจัดการข้อมูลผ่าน API (API Communication & Data Management) ---
// ===================================================================================

/**
 * ฟังก์ชันกลางสำหรับสื่อสารกับ Backend API
 * @param {string} action - ชื่อ action ที่ต้องการเรียกใน api.php
 * @param {string} method - 'GET' หรือ 'POST'
 * @param {object|null} body - ข้อมูลที่จะส่งไปในรูปแบบ JSON (สำหรับ POST)
 * @returns {Promise<object>} - ข้อมูลที่ได้จาก API
 */
async function callApi(action, method = 'GET', body = null) {
    showLoader();

    let url = `api.php?action=${action}`;
    const options = {
        method: method,
        headers: {
            'Content-Type': 'application/json',
            'Accept': 'application/json'
        },
    };

    if (method === 'POST' && body) {
        options.body = JSON.stringify(body);
    } else if (method === 'GET' && body) {
        const params = new URLSearchParams(body);
        url += `&${params.toString()}`;
    }

    try {
        const response = await fetch(url, options);
        if (!response.ok) {
            const errorData = await response.json().catch(() => ({ message: response.statusText }));
            throw new Error(errorData.message || `Network response was not ok (${response.status})`);
        }
        const result = await response.json();
        if (!result.success) {
            throw new Error(result.message || 'An unknown API error occurred.');
        }
        return result;
    } catch (error) {
        console.error(`API Error (${action}):`, error);
        showNotification('เกิดข้อผิดพลาด', `การสื่อสารกับเซิร์ฟเวอร์ล้มเหลว: ${error.message}`, 'danger');
        throw error;
    } finally {
        hideLoader();
    }
}

/**
 * โหลดข้อมูลทั้งหมดจากฐานข้อมูลสำหรับโปรไฟล์และปีที่กำหนด
 */
async function loadDataFromAPI() {
    try {
        const selectedYear = document.getElementById('itemYear').value;
        const result = await callApi('get_all_data', 'GET', {
            profile: currentProfile,
            year: selectedYear
        });
        
        const data = result.data;
        budgetData = data.budgetData || [];
        columnStructure = data.columnStructure || { income: [], expense: [], savings: [] };
        expenseDueDates = data.expenseDueDates || {};
        incomeDueDates = data.incomeDueDates || {};
        savingsGoals = data.savingsGoals || [];
        recurringTransactions = data.recurringTransactions || {};

        fullRender();

    } catch (error) {
        console.error("ไม่สามารถโหลดข้อมูลจาก API ได้:", error);
    }
}

/**
 * บันทึกข้อมูล transaction หนึ่งรายการ (จำนวนเงิน, สถานะจ่าย, โน้ต)
 * @param {number} monthId - ID ของเดือน (1-12)
 * @param {number} categoryId - ID ของหมวดหมู่ (Category)
 */
async function saveTransactionData(monthId, categoryId) {
    const item = budgetData.find(d => d.id === monthId);
    if (!item) return;

    // หาชื่อหมวดหมู่จาก categoryId
    let categoryName = '';
    for (const type in columnStructure) {
        const category = columnStructure[type].find(cat => cat.id === categoryId);
        if (category) {
            categoryName = category.name;
            break;
        }
    }
    if (!categoryName) return;

    try {
        // ไม่ต้องแสดง Loader ที่นี่ เพราะ Debounce ทำให้การบันทึกเกิดเบื้องหลัง
        // showLoader();
        await callApi('save_transaction', 'POST', {
            profileName: currentProfile,
            year: item.year,
            monthId: item.id,
            categoryId: categoryId,
            amount: item[categoryName] || 0,
            is_paid: item.paid[categoryName] || false,
            note: item.notes[categoryName] || ''
        });
        // hideLoader();
    } catch (error) {
        showNotification('บันทึกไม่สำเร็จ', `กำลังคืนค่าข้อมูล "${categoryName}"`, 'danger');
        await loadDataFromAPI(); // โหลดข้อมูลที่ถูกต้องจากเซิร์ฟเวอร์มาแสดงผลใหม่
    }
}


// --- การจัดการโปรไฟล์ (Client-side) ---
function saveCurrentProfile() {
    localStorage.setItem(`${APP_NAME}_lastProfile`, currentProfile);
}

function loadLastProfile() {
    currentProfile = localStorage.getItem(`${APP_NAME}_lastProfile`) || 'default';
    const profileInput = document.getElementById('profileName');
    if (profileInput) profileInput.value = currentProfile;
}


// ===================================================================================
// --- การเริ่มต้นและจัดการหน้าเว็บ (Initialization & Page Handlers) ---
// ===================================================================================

document.addEventListener('DOMContentLoaded', async function () {
    loadLastProfile();
    loadTheme();
    populateYearDropdown();
    
    await loadDataFromAPI();

    setupEventListeners();

    updateClock();
    setInterval(updateClock, 1000);

    setTimeout(checkDueDates, 1500); // หน่วงเวลาเล็กน้อยเพื่อให้ UI พร้อม
    setInterval(checkDueDates, 3600 * 1000); // เช็คทุกชั่วโมง

    // --- START: เรียกใช้ฟังก์ชันจัดการการปรับขนาด Sidebar ---
    setupSidebarResizer();
    loadSidebarWidth();
    // --- END: เรียกใช้ฟังก์ชัน ---
});

function fullRender() {
    renderTable();
    updateSummary();
    renderSavingsGoals();
}

async function handleYearChange() {
    await loadDataFromAPI();
}

async function handleProfileChange() {
    const profileInput = document.getElementById('profileName');
    const newProfile = profileInput.value.trim();
    
    if (!newProfile) {
        showNotification('ชื่อโปรไฟล์ว่าง', 'กรุณากรอกชื่อโปรไฟล์', 'warning');
        profileInput.value = currentProfile;
        return;
    }

    if (newProfile !== currentProfile) {
        currentProfile = newProfile;
        saveCurrentProfile();
        showNotification('เปลี่ยนโปรไฟล์สำเร็จ', `กำลังโหลดข้อมูลโปรไฟล์: ${currentProfile}`, 'success');
        await loadDataFromAPI();
    }
}

function populateYearDropdown() {
    const yearSelect = document.getElementById('itemYear');
    const currentBuddhistYear = new Date().getFullYear() + 543;
    
    const startYear = 2568;
    const endYear = 2588;

    yearSelect.innerHTML = '';
    for (let year = startYear; year <= endYear; year++) {
        const option = document.createElement('option');
        option.value = year;
        option.textContent = `พ.ศ. ${year}`;
        yearSelect.appendChild(option);
    }
    
    if (currentBuddhistYear >= startYear && currentBuddhistYear <= endYear) {
        yearSelect.value = currentBuddhistYear;
    } else {
        yearSelect.value = startYear;
    }
}


// ===================================================================================
// --- 2. ระบบรายการประจำ (Recurring Transactions) ---
// ===================================================================================

/**
 * @param {boolean} showSuccessAlert - กำหนดว่าจะให้แสดงการแจ้งเตือนเมื่อสำเร็จหรือไม่
 */
async function autoApplyRecurringTransactions(showSuccessAlert = false) {
    let hasChanged = false;
    const savePromises = [];

    // 1. อ่านค่าล่าสุดจากฟอร์มใน Modal โดยตรง
    const currentRecurringData = {};
    ['income', 'expense', 'savings'].forEach(type => {
        columnStructure[type].forEach(col => {
            const input = document.getElementById(`recurring-input-${col.id}`);
            if (input) {
                const amount = parseFloat(input.value) || 0;
                currentRecurringData[col.id] = amount;
            }
        });
    });

    // 2. วนลูปเพื่ออัปเดตข้อมูลใน budgetData
    budgetData.forEach(monthData => {
        for (const categoryId in currentRecurringData) {
            const amount = currentRecurringData[categoryId];
            let categoryName = '';
            
            for (const type in columnStructure) {
                const category = columnStructure[type].find(c => c.id == categoryId);
                if (category) {
                    categoryName = category.name;
                    break;
                }
            }

            // 3. เงื่อนไข: อนุญาตให้เขียนทับข้อมูลเดิมได้ ตราบใดที่รายการนั้นยังไม่ได้ถูกติ๊กว่า 'จ่ายแล้ว'
            if (categoryName && monthData.hasOwnProperty(categoryName) && !monthData.paid[categoryName]) {
                if (monthData[categoryName] !== amount) {
                    monthData[categoryName] = amount;
                    hasChanged = true;
                    savePromises.push(saveTransactionData(monthData.id, parseInt(categoryId)));
                }
            }
        }
    });
    
    if (hasChanged) {
        await Promise.all(savePromises);
        fullRender();
        if (showSuccessAlert) {
            showNotification('ใช้รายการประจำสำเร็จ', 'นำข้อมูลรายการประจำไปใช้กับตารางเรียบร้อยแล้ว', 'success');
        }
        closeModal('recurringModal');
    } else {
        if (showSuccessAlert) {
            showNotification('ไม่พบรายการที่ต้องอัปเดต', 'ข้อมูลในตารางตรงกับค่าที่กรอกไว้แล้ว หรือรายการถูกจ่ายแล้ว', 'info');
        }
    }
}


async function saveRecurringTransaction() {
    const recurringData = {};
    
    ['income', 'expense', 'savings'].forEach(type => {
        columnStructure[type].forEach(col => {
            const input = document.getElementById(`recurring-input-${col.id}`);
            if (input) {
                const amount = parseFloat(input.value) || 0;
                if (amount >= 0) { // Allow saving 0 to clear a recurring value
                    recurringData[col.id] = amount;
                }
            }
        });
    });

    try {
        await callApi('save_recurring', 'POST', {
            profileName: currentProfile,
            recurringData: recurringData
        });
        
        // Update local state to match saved data
        const localRecurringState = {};
        for(const id in recurringData){
            if(recurringData[id] > 0){
                 localRecurringState[id] = recurringData[id];
            }
        }
        recurringTransactions = localRecurringState;

        showNotification('บันทึกสำเร็จ', 'ข้อมูลรายการประจำถูกบันทึกแล้ว', 'success');
        closeModal('recurringModal');
    } catch (error) {
        await loadDataFromAPI();
    }
}


// ===================================================================================
// --- การจัดการคอลัมน์ (Column Management) ---
// ===================================================================================

async function addColumn(type) {
    if (type === 'savings') {
        showNotification('ไม่สามารถทำได้', 'กรุณาเพิ่ม "เป้าหมายการออม" เพื่อสร้างคอลัมน์เงินออม', 'info');
        return;
    }
    const columnNameInput = document.getElementById('newColumnName');
    const columnName = columnNameInput.value.trim();

    if (!columnName) {
        showNotification('กรุณากรอกชื่อคอลัมน์', 'กรุณาตั้งชื่อคอลัมน์ที่ต้องการเพิ่ม', 'warning');
        return;
    }
    const isDuplicate = Object.values(columnStructure).flat().some(c => c.name === columnName);
    if (isDuplicate) {
        showNotification('ชื่อคอลัมน์ซ้ำ', `คอลัมน์ชื่อ "${columnName}" มีอยู่แล้ว`, 'warning');
        return;
    }

    try {
        const result = await callApi('add_category', 'POST', {
            profileName: currentProfile, name: columnName, type: type
        });
        
        const newCategory = result.newCategory;
        columnStructure[type].push({ id: newCategory.id, name: newCategory.name, goalId: null });
        
        budgetData.forEach(item => {
            item[columnName] = 0;
            item.paid[columnName] = false;
            item.notes[columnName] = '';
        });
        
        columnNameInput.value = '';
        fullRender();
        showNotification('เพิ่มคอลัมน์สำเร็จ', `คอลัมน์ "${columnName}" ถูกเพิ่มแล้ว`, 'success');

    } catch (error) {
        await loadDataFromAPI();
    }
}

function deleteColumn(type, categoryId) {
     if (type === 'savings') {
        showNotification('ไม่สามารถทำได้', 'กรุณาลบ "เป้าหมายการออม" ที่เกี่ยวข้องแทน', 'info');
        return;
    }
    const category = columnStructure[type].find(c => c.id === categoryId);
    if (!category) return;
    const columnName = category.name;

    showConfirmationModal(
        'ยืนยันการลบคอลัมน์',
        `คุณแน่ใจหรือไม่ว่าต้องการลบคอลัมน์ "${columnName}"? ข้อมูลทั้งหมดในคอลัมน์นี้จะถูกลบออกอย่างถาวร`,
        async () => {
            try {
                 await callApi('delete_category', 'POST', {
                    profileName: currentProfile, categoryId: categoryId
                });

                columnStructure[type] = columnStructure[type].filter(c => c.id !== categoryId);
                
                budgetData.forEach(item => {
                    delete item[columnName];
                    delete item.paid[columnName];
                    delete item.notes[columnName];
                });
                delete recurringTransactions[categoryId];
                delete incomeDueDates[categoryId];
                delete expenseDueDates[categoryId];

                fullRender();
                showNotification('ลบคอลัมน์สำเร็จ', `คอลัมน์ "${columnName}" ถูกลบแล้ว`, 'success');

            } catch(error) {
                await loadDataFromAPI();
            }
        }
    );
}

async function updateColumnName(type, categoryId, oldName, newName, element) {
    if (type === 'savings') {
        showNotification('ไม่สามารถทำได้', 'ชื่อคอลัมน์เงินออมจะถูกเปลี่ยนตามชื่อเป้าหมายโดยอัตโนมัติ', 'info');
        toggleColumnEdit(element.closest('.column-name-container'), false, oldName);
        return;
    }
    newName = newName.trim();
    if (!newName || newName === oldName) {
        toggleColumnEdit(element.closest('.column-name-container'), false, oldName);
        return;
    }
    if (Object.values(columnStructure).flat().some(c => c.name === newName && c.id !== categoryId)) {
        showNotification('ชื่อคอลัมน์ซ้ำ', `คอลัมน์ชื่อ "${newName}" มีอยู่แล้ว`, 'warning');
        toggleColumnEdit(element.closest('.column-name-container'), false, oldName);
        return;
    }
    
    try {
        await callApi('update_category_name', 'POST', {
            profileName: currentProfile, categoryId: categoryId, newName: newName
        });
        const category = columnStructure[type].find(c => c.id === categoryId);
        if (category) category.name = newName;
        budgetData.forEach(item => {
            if (Object.prototype.hasOwnProperty.call(item, oldName)) {
                item[newName] = item[oldName]; delete item[oldName];
            }
            if (item.paid && Object.prototype.hasOwnProperty.call(item.paid, oldName)) {
                item.paid[newName] = item.paid[oldName]; delete item.paid[oldName];
            }
            if (item.notes && Object.prototype.hasOwnProperty.call(item.notes, oldName)) {
                item.notes[newName] = item.notes[oldName]; delete item.notes[oldName];
            }
        });
        
        fullRender();
        showNotification('เปลี่ยนชื่อสำเร็จ', `เปลี่ยนชื่อคอลัมน์เป็น "${newName}" เรียบร้อย`, 'success');

    } catch (error) {
        toggleColumnEdit(element.closest('.column-name-container'), false, oldName);
        await loadDataFromAPI();
    }
}

async function moveColumn(type, categoryId, direction) {
    const columns = columnStructure[type];
    const index = columns.findIndex(c => c.id === categoryId);
    
    if (direction === 'left' && index > 0) {
        [columns[index], columns[index - 1]] = [columns[index - 1], columns[index]];
    } else if (direction === 'right' && index < columns.length - 1) {
        [columns[index], columns[index + 1]] = [columns[index + 1], columns[index]];
    } else {
        return;
    }
    try {
        await callApi('update_category_order', 'POST', {
            profileName: currentProfile, categoryIds: columns.map(c => c.id)
        });
        fullRender();
    } catch (error) {
        await loadDataFromAPI();
    }
}


// ===================================================================================
// --- เครื่องคิดเลขในตาราง และการอัปเดตข้อมูล (In-cell Calculator & Data Update) ---
// ===================================================================================

function evaluateExpression(expression) {
    try {
        if (/^[0-9+\-*/.() ]+$/.test(expression)) {
            const result = new Function('return ' + expression)();
            if (!isFinite(result)) {
                showNotification('คำนวณผิดพลาด', 'ไม่สามารถหารด้วยศูนย์ได้', 'warning');
                return null;
            }
            return result;
        }
        return null;
    } catch (e) { return null; }
}

function updateValue(id, categoryId, categoryName, value) {
    const item = budgetData.find(item => item.id === id);
    if (item) {
        let calculatedValue = evaluateExpression(String(value));
        item[categoryName] = (calculatedValue !== null) ? calculatedValue : (parseFloat(value) || 0);

        const row = document.querySelector(`input[data-category-id='${categoryId}'][data-month-id='${id}']`).closest('tr');
        if (row) {
            row.querySelector('.income-cell.total-cell').textContent = formatNumber(calculateTotalIncome(item));
            row.querySelector('.expense-cell.total-cell').textContent = formatNumber(calculateTotalExpense(item));
            row.querySelector('.savings-cell.total-cell').textContent = formatNumber(calculateTotalSavings(item));
            const balance = calculateBalance(item);
            const balanceCell = row.querySelector('.balance-cell.total-cell');
            balanceCell.textContent = formatNumber(balance);
            balanceCell.className = `balance-cell total-cell ${balance >= 0 ? 'income-amount' : 'expense-amount'}`;
        }
        updateSummary();

        clearTimeout(saveTimer);
        saveTimer = setTimeout(() => {
            saveTransactionData(id, categoryId);
        }, DEBOUNCE_DELAY);
    }
}

function togglePaidStatus(id, categoryId, categoryName) {
    const item = budgetData.find(item => item.id === id);
    if (item) {
        item.paid[categoryName] = !item.paid[categoryName];
        renderTable(); 
        saveTransactionData(id, categoryId);
    }
}

// ===================================================================================
// --- ระบบบันทึกข้อความ (Notes/Memo) ---
// ===================================================================================
function saveNote() {
    const modal = document.getElementById('noteModal');
    const monthId = parseInt(modal.dataset.monthId);
    const categoryId = parseInt(modal.dataset.categoryId);
    const categoryName = modal.dataset.categoryName;
    const noteText = document.getElementById('noteTextarea').value;
    const item = budgetData.find(item => item.id === monthId);
    if (item) {
        item.notes[categoryName] = noteText;
        const noteIcon = document.getElementById(`note-icon-${monthId}-${categoryId}`);
        if (noteIcon) noteIcon.classList.toggle('active', !!noteText);
        closeModal('noteModal');
        saveTransactionData(monthId, categoryId);
    }
}
function deleteNote() {
    document.getElementById('noteTextarea').value = '';
    saveNote();
}

// ===================================================================================
// --- การคำนวณและสรุปผล (Calculations & Summary) ---
// ===================================================================================
function calculateTotalIncome(item) {
    return columnStructure.income.reduce((sum, col) => sum + (item[col.name] || 0), 0);
}
function calculateTotalExpense(item) {
    return columnStructure.expense.reduce((sum, col) => sum + (item[col.name] || 0), 0);
}
function calculateTotalSavings(item) {
    return columnStructure.savings.reduce((sum, col) => sum + (item[col.name] || 0), 0);
}

function calculateBalance(item) {
    return calculateTotalIncome(item) - calculateTotalExpense(item) - calculateTotalSavings(item);
}
function formatNumber(num) {
    return new Intl.NumberFormat('th-TH', { minimumFractionDigits: 2, maximumFractionDigits: 2 }).format(num);
}

function updateSummary() {
    const totalIncome = budgetData.reduce((sum, item) => sum + calculateTotalIncome(item), 0);
    const totalExpense = budgetData.reduce((sum, item) => sum + calculateTotalExpense(item), 0);
    const totalSavings = budgetData.reduce((sum, item) => sum + calculateTotalSavings(item), 0);
    const netBalance = totalIncome - totalExpense - totalSavings;

    document.getElementById('totalIncome').textContent = formatNumber(totalIncome);
    document.getElementById('totalExpense').textContent = formatNumber(totalExpense);
    document.getElementById('totalSavings').textContent = formatNumber(totalSavings);
    document.getElementById('netBalance').textContent = formatNumber(netBalance);
    
    for (const type in columnStructure) {
        columnStructure[type].forEach(col => {
            const total = budgetData.reduce((sum, item) => sum + (item[col.name] || 0), 0);
            const cell = document.querySelector(`#footer-col-${col.id} strong`);
            if (cell) {
                cell.textContent = formatNumber(total);
            }
        });
    }

    const footerTotalIncome = document.querySelector('#footer-total-income strong');
    if (footerTotalIncome) footerTotalIncome.textContent = formatNumber(totalIncome);

    const footerTotalExpense = document.querySelector('#footer-total-expense strong');
    if (footerTotalExpense) footerTotalExpense.textContent = formatNumber(totalExpense);

    const footerTotalSavings = document.querySelector('#footer-total-savings strong');
    if (footerTotalSavings) footerTotalSavings.textContent = formatNumber(totalSavings);

    const footerTotalBalance = document.querySelector('#footer-total-balance strong');
    if (footerTotalBalance) footerTotalBalance.textContent = formatNumber(netBalance);
    
    updateSavingsGoalsProgress();
    if (document.getElementById('dashboardModal').classList.contains('active')) {
        renderCharts();
    }
}


// ===================================================================================
// --- ระบบเป้าหมายการออม (Savings Goals Tracker) ---
// ===================================================================================

async function addOrUpdateSavingsGoal() {
    const goalId = document.getElementById('goalId').value || null;
    const name = document.getElementById('goalName').value.trim();
    const amount = parseFloat(document.getElementById('goalAmount').value);

    if (!name || isNaN(amount) || amount < 0) { // Allow 0 for general savings
        showNotification('ข้อมูลไม่ถูกต้อง', 'กรุณากรอกชื่อและจำนวนเงินเป้าหมายให้ถูกต้อง', 'warning');
        return;
    }
    const isDuplicate = savingsGoals.some(g => g.name === name && g.id != goalId) || 
                        Object.values(columnStructure).flat().some(c => c.name === name && (!c.goalId || c.goalId != goalId));
    if (isDuplicate) {
        showNotification('ชื่อซ้ำ', `ชื่อ "${name}" ถูกใช้เป็นชื่อเป้าหมายหรือชื่อคอลัมน์อื่นแล้ว`, 'warning');
        return;
    }

    try {
        const result = await callApi('save_savings_goal', 'POST', {
            profileName: currentProfile, id: goalId, name: name, amount: amount
        });

        if (goalId) { // Update
            const goal = savingsGoals.find(g => g.id == goalId);
            if (goal) {
                const oldName = goal.name;
                goal.name = name;
                goal.amount = amount;
                const category = columnStructure.savings.find(c => c.goalId == goalId);
                if (category) {
                    category.name = name;
                    budgetData.forEach(item => {
                        if (Object.prototype.hasOwnProperty.call(item, oldName)) {
                             item[name] = item[oldName]; delete item[oldName];
                             item.paid[name] = item.paid[oldName]; delete item.paid[oldName];
                             item.notes[name] = item.notes[oldName]; delete item.notes[oldName];
                        }
                    });
                }
            }
        } else { // Insert
            savingsGoals.push(result.newGoal);
            columnStructure.savings.push(result.newCategory);
            budgetData.forEach(item => {
                item[result.newCategory.name] = 0;
                item.paid[result.newCategory.name] = false;
                item.notes[result.newCategory.name] = '';
            });
        }
        
        fullRender();
        closeModal('savingsGoalModal');
        showNotification('บันทึกเป้าหมายสำเร็จ', 'ข้อมูลเป้าหมายการออมถูกอัปเดตแล้ว', 'success');

    } catch (error) {
        await loadDataFromAPI();
    }
}

function deleteSavingsGoal(goalId) {
    const goal = savingsGoals.find(g => g.id == goalId);
    if (!goal) return;
    showConfirmationModal('ยืนยันการลบเป้าหมาย', `คุณแน่ใจหรือไม่ว่าต้องการลบเป้าหมาย "${goal.name}"? คอลัมน์ที่เกี่ยวข้องจะถูกซ่อน แต่ข้อมูลเก่าจะยังคงอยู่`, async () => {
        try {
            await callApi('delete_savings_goal', 'POST', {
                profileName: currentProfile, id: goalId
            });
            savingsGoals = savingsGoals.filter(g => g.id != goalId);
            columnStructure.savings = columnStructure.savings.filter(c => c.goalId != goalId);
            fullRender();
            showNotification('ลบเป้าหมายสำเร็จ', `เป้าหมาย "${goal.name}" ถูกลบแล้ว`, 'success');
        } catch (error) {
            await loadDataFromAPI();
        }
    });
}

function renderSavingsGoals() {
    const container = document.getElementById('savingsGoalsContainer');
    if (!container) return;
    container.innerHTML = savingsGoals.length === 0 ? '<p class="no-goals">ยังไม่มีเป้าหมายการออม</p>' : '';
    
    savingsGoals.forEach(goal => {
        const currentAmount = goal.currentAmount || 0;
        const percentage = goal.amount > 0 ? Math.min((currentAmount / goal.amount) * 100, 100) : 0;
        container.innerHTML += `
            <div class="goal-item">
                <div class="goal-info">
                    <span class="goal-name">${goal.name}</span>
                    <span class="goal-amount">${formatNumber(currentAmount)} / ${formatNumber(goal.amount)}</span>
                </div>
                <div class="goal-progress-bar">
                    <div class="goal-progress" style="width: ${percentage.toFixed(2)}%;"></div>
                </div>
                <div class="goal-actions">
                    <button class="btn-icon" onclick="openSavingsGoalModal('${goal.id}')"><i class="ph ph-pencil-simple"></i></button>
                    <button class="btn-icon" onclick="deleteSavingsGoal('${goal.id}')"><i class="ph ph-trash"></i></button>
                </div>
            </div>`;
    });
}

function updateSavingsGoalsProgress() {
    savingsGoals.forEach(goal => {
        const linkedCategory = columnStructure.savings.find(c => c.goalId === goal.id);
        if (linkedCategory) {
            const totalSavedForThisGoal = budgetData.reduce((sum, month) => {
                return sum + (month[linkedCategory.name] || 0);
            }, 0);
            goal.currentAmount = totalSavedForThisGoal;
        } else {
            goal.currentAmount = 0;
        }
    });
    renderSavingsGoals();
}

// ===================================================================================
// --- ส่วนที่เหลือ (UI, Theming, Modals, Helpers) ---
// ===================================================================================

// --- START: เพิ่มฟังก์ชันจัดการการปรับขนาด Sidebar ---
function setupSidebarResizer() {
    let isResizing = false;

    resizer.addEventListener('mousedown', (e) => {
        isResizing = true;
        resizer.classList.add('is-resizing');
        document.body.style.cursor = 'col-resize';
        document.body.style.userSelect = 'none';

        document.addEventListener('mousemove', handleMouseMove);
        document.addEventListener('mouseup', () => {
            isResizing = false;
            resizer.classList.remove('is-resizing');
            document.body.style.cursor = '';
            document.body.style.userSelect = '';
            document.removeEventListener('mousemove', handleMouseMove);
            // Save final width to localStorage
            localStorage.setItem(`${APP_NAME}_sidebarWidth`, sidebar.style.width);
        });
    });

    function handleMouseMove(e) {
        if (!isResizing) return;
        const newWidth = e.clientX - sidebar.getBoundingClientRect().left;
        const minWidth = parseInt(getComputedStyle(sidebar).minWidth, 10);
        const maxWidth = parseInt(getComputedStyle(sidebar).maxWidth, 10);
        
        if (newWidth >= minWidth && newWidth <= maxWidth) {
            const newWidthPx = `${newWidth}px`;
            sidebar.style.width = newWidthPx;
            document.documentElement.style.setProperty('--sidebar-width', newWidthPx);
        }
    }
}

function loadSidebarWidth() {
    const savedWidth = localStorage.getItem(`${APP_NAME}_sidebarWidth`);
    if (savedWidth) {
        sidebar.style.width = savedWidth;
        document.documentElement.style.setProperty('--sidebar-width', savedWidth);
    }
}
// --- END: เพิ่มฟังก์ชัน ---

function toggleTheme() {
    document.body.classList.toggle('dark-mode');
    const theme = document.body.classList.contains('dark-mode') ? 'dark' : 'light';
    localStorage.setItem(`${APP_NAME}_theme`, theme);
    if (document.getElementById('dashboardModal').classList.contains('active')) {
        renderCharts();
    }
}
function loadTheme() {
    const savedTheme = localStorage.getItem(`${APP_NAME}_theme`);
    if (savedTheme === 'dark') document.body.classList.add('dark-mode');
    const themeToggle = document.getElementById('themeToggle');
    if (themeToggle) themeToggle.checked = (savedTheme === 'dark');
}

function renderTable() {
    const table = document.getElementById('budgetTable');
    if (!table) return;
    table.innerHTML = '';
    const now = new Date();
    const currentBuddhistYear = now.getFullYear() + 543;
    const currentMonthName = thaiMonths[now.getMonth()];
    const selectedYear = parseInt(document.getElementById('itemYear').value, 10);
    const thead = document.createElement('thead');
    const headerRow1 = document.createElement('tr');
    
    headerRow1.innerHTML = `<th rowspan="2">ปี</th><th rowspan="2">รายการ/เดือน</th>
        <th colspan="${columnStructure.income.length + 1}" class="income-header"><div class="header-main">รายรับ</div></th>
        <th colspan="${columnStructure.expense.length + 1}" class="expense-header"><div class="header-main">รายจ่าย</div></th>
        <th colspan="${columnStructure.savings.length + 1}" class="savings-header"><div class="header-main">เงินออม</div></th>
        <th rowspan="2">คงเหลือใช้จ่าย</th>`;
        
    const headerRow2 = document.createElement('tr');
    
    const generateColumnHeaderHTML = (type, col) => {
        const dueDate = type === 'income' ? incomeDueDates[col.id] : expenseDueDates[col.id];
        const dateDisplay = dueDate ? `<div class="due-date-display ${type === 'income' ? 'income' : 'expense'}">${type === 'income' ? 'รับเงิน' : 'ชำระ'}: วันที่ ${dueDate}</div>` : '';
        
        const isSavingsCol = type === 'savings';
        
        let editControls;
        if (isSavingsCol) {
            editControls = `
                <div class="column-name-container" style="padding: 0;">
                     <span class="column-title" title="ชื่อคอลัมน์เงินออมจะถูกเปลี่ยนตามชื่อเป้าหมาย">${col.name}</span>
                </div>`;
        } else {
            editControls = `
                <button class="move-col-btn" onclick="moveColumn('${type}', ${col.id}, 'left')" title="ย้ายไปทางซ้าย"><i class="ph-bold ph-caret-left"></i></button>
                <div class="column-name-container">
                    <span class="column-title" ondblclick="toggleColumnEdit(this.parentElement, true)" title="ดับเบิลคลิกเพื่อแก้ไขชื่อ">${col.name}</span>
                    <input type="text" value="${col.name}" class="column-name-input" style="display: none;" onblur="updateColumnName('${type}', ${col.id}, '${col.name.replace(/'/g, "\\'")}', this.value, this)" onkeydown="if(event.key==='Enter') this.blur();">
                </div>
                <button class="delete-col-btn" onclick="deleteColumn('${type}', ${col.id})" title="ลบคอลัมน์"><i class="ph-bold ph-trash"></i></button>
                <button class="move-col-btn" onclick="moveColumn('${type}', ${col.id}, 'right')" title="ย้ายไปทางขวา"><i class="ph-bold ph-caret-right"></i></button>`;
        }
        
        return `<th><div class="header-sub">
                <div class="column-title-wrapper">${editControls}</div>
                ${dateDisplay}</div></th>`;
    };
    
    let subHeaderHTML = '';
    columnStructure.income.forEach(col => { subHeaderHTML += generateColumnHeaderHTML('income', col); });
    subHeaderHTML += `<th class="income-header total-header" rowspan="1">รวมรายรับ</th>`;
    columnStructure.expense.forEach(col => { subHeaderHTML += generateColumnHeaderHTML('expense', col); });
    subHeaderHTML += `<th class="expense-header total-header" rowspan="1">รวมรายจ่าย</th>`;
    columnStructure.savings.forEach(col => { subHeaderHTML += generateColumnHeaderHTML('savings', col); });
    subHeaderHTML += `<th class="savings-header total-header" rowspan="1">รวมเงินออม</th>`;
    headerRow2.innerHTML = subHeaderHTML;
    thead.appendChild(headerRow1);
    thead.appendChild(headerRow2);
    table.appendChild(thead);
    
    const tbody = document.createElement('tbody');
    const generateCellHTML = (item, col, type) => {
        const isPaid = item.paid[col.name];
        const hasNote = item.notes && item.notes[col.name];
        const checkboxId = `${type}-check-${item.id}-${col.id}`;
        return `<td class="${type}-cell ${isPaid ? 'is-paid' : ''}">
            <div class="amount-cell-wrapper">
                <input type="checkbox" class="amount-checkbox" id="${checkboxId}" onchange="togglePaidStatus(${item.id}, ${col.id}, '${col.name.replace(/'/g, "\\'")}')" ${isPaid ? 'checked' : ''}>
                <label for="${checkboxId}" class="custom-checkbox-label"><div class="custom-checkbox"></div></label>
                <input type="text" class="amount-input" value="${item[col.name]}" 
                       placeholder="ใส่เลข หรือ 50+25" data-month-id="${item.id}" data-category-id="${col.id}"
                       onchange="updateValue(${item.id}, ${col.id}, '${col.name.replace(/'/g, "\\'")}', this.value)" 
                       onfocus="this.select()">
                <button id="note-icon-${item.id}-${col.id}" class="note-btn ${hasNote ? 'active' : ''}" onclick="openNoteModal(${item.id}, ${col.id}, '${col.name.replace(/'/g, "\\'")}')"><i class="ph ph-note-pencil"></i></button>
            </div></td>`;
    };

    budgetData.forEach(item => {
        const row = document.createElement('tr');
        if (selectedYear === currentBuddhistYear && item.name === currentMonthName) row.classList.add('current-month-row');
        let rowHTML = `<td>${item.year}</td><td>${item.name}</td>`;
        columnStructure.income.forEach(col => { rowHTML += generateCellHTML(item, col, 'income'); });
        rowHTML += `<td class="income-cell total-cell">${formatNumber(calculateTotalIncome(item))}</td>`;
        columnStructure.expense.forEach(col => { rowHTML += generateCellHTML(item, col, 'expense'); });
        rowHTML += `<td class="expense-cell total-cell">${formatNumber(calculateTotalExpense(item))}</td>`;
        columnStructure.savings.forEach(col => { rowHTML += generateCellHTML(item, col, 'savings'); });
        rowHTML += `<td class="savings-cell total-cell">${formatNumber(calculateTotalSavings(item))}</td>`;
        const balance = calculateBalance(item);
        rowHTML += `<td class="balance-cell ${balance >= 0 ? 'income-amount' : 'expense-amount'} total-cell">${formatNumber(balance)}</td>`;
        row.innerHTML = rowHTML;
        tbody.appendChild(row);
    });
    table.appendChild(tbody);
    
    const tfoot = document.createElement('tfoot');
    const footerRow = document.createElement('tr');
    let footerHTML = `<td colspan="2"><strong>รวมทั้งปี</strong></td>`;
    
    columnStructure.income.forEach(col => {
        footerHTML += `<td id="footer-col-${col.id}"><strong>${formatNumber(budgetData.reduce((s, i) => s + (i[col.name] || 0), 0))}</strong></td>`;
    });
    footerHTML += `<td class="income-cell total-cell" id="footer-total-income"><strong>${formatNumber(budgetData.reduce((s, i) => s + calculateTotalIncome(i), 0))}</strong></td>`;
    
    columnStructure.expense.forEach(col => {
        footerHTML += `<td id="footer-col-${col.id}"><strong>${formatNumber(budgetData.reduce((s, i) => s + (i[col.name] || 0), 0))}</strong></td>`;
    });
    footerHTML += `<td class="expense-cell total-cell" id="footer-total-expense"><strong>${formatNumber(budgetData.reduce((s, i) => s + calculateTotalExpense(i), 0))}</strong></td>`;

    columnStructure.savings.forEach(col => {
        footerHTML += `<td id="footer-col-${col.id}"><strong>${formatNumber(budgetData.reduce((s, i) => s + (i[col.name] || 0), 0))}</strong></td>`;
    });
    footerHTML += `<td class="savings-cell total-cell" id="footer-total-savings"><strong>${formatNumber(budgetData.reduce((s, i) => s + calculateTotalSavings(i), 0))}</strong></td>`;
    
    const totalIncomeAll = budgetData.reduce((s, i) => s + calculateTotalIncome(i), 0);
    const totalExpenseAll = budgetData.reduce((s, i) => s + calculateTotalExpense(i), 0);
    const totalSavingsAll = budgetData.reduce((s, i) => s + calculateTotalSavings(i), 0);
    const netBalanceAll = totalIncomeAll - totalExpenseAll - totalSavingsAll;
    footerHTML += `<td class="balance-cell total-cell" id="footer-total-balance"><strong>${formatNumber(netBalanceAll)}</strong></td>`;
    
    footerRow.innerHTML = footerHTML;
    tfoot.appendChild(footerRow);
    table.appendChild(tfoot);
}

function toggleColumnEdit(wrapper, isEditing) {
    const titleSpan = wrapper.querySelector('.column-title');
    const inputField = wrapper.querySelector('.column-name-input');
    if (isEditing) {
        titleSpan.style.display = 'none';
        inputField.style.display = 'inline-block';
        inputField.focus();
        inputField.select();
    } else {
        inputField.style.display = 'none';
        titleSpan.style.display = 'inline-block';
    }
}

// --- Dashboard & Charts ---
let expensePieChart = null;
let monthlyTrendChart = null;

function prepareChartData() {
    const expenseByCategory = columnStructure.expense.reduce((acc, col) => {
        acc[col.name] = budgetData.reduce((sum, month) => sum + (month[col.name] || 0), 0);
        return acc;
    }, {});
    return {
        pieLabels: Object.keys(expenseByCategory).filter(key => expenseByCategory[key] > 0),
        pieData: Object.values(expenseByCategory).filter(value => value > 0),
        lineLabels: thaiMonths,
        incomeData: budgetData.map(month => calculateTotalIncome(month)),
        expenseData: budgetData.map(month => calculateTotalExpense(month)),
        savingsData: budgetData.map(month => calculateTotalSavings(month)),
    };
}

function renderCharts() {
    if (typeof Chart === 'undefined') return;
    const { pieLabels, pieData, lineLabels, incomeData, expenseData, savingsData } = prepareChartData();
    const isDarkMode = document.body.classList.contains('dark-mode');
    const gridColor = isDarkMode ? 'rgba(255, 255, 255, 0.1)' : 'rgba(0, 0, 0, 0.1)';
    const textColor = isDarkMode ? '#f2f2f7' : '#1d1d1f';
    Chart.defaults.font.family = "'Sarabun', sans-serif";
    Chart.defaults.color = textColor;
    
    const pieCtx = document.getElementById('expensePieChart').getContext('2d');
    if (expensePieChart) expensePieChart.destroy();
    expensePieChart = new Chart(pieCtx, {
        type: 'doughnut', data: { labels: pieLabels, datasets: [{ data: pieData, backgroundColor: ['#ff3b30', '#ff9500', '#ffcc00', '#34c759', '#007aff', '#5e5ce6', '#af52de'], borderColor: isDarkMode ? '#2c2c2e' : '#ffffff', borderWidth: 4 }] },
        options: { responsive: true, maintainAspectRatio: false, plugins: { legend: { position: 'bottom', labels: { padding: 20, boxWidth: 15, font: { size: 14 } } } }, cutout: '60%' }
    });
    
    const lineCtx = document.getElementById('monthlyTrendChart').getContext('2d');
    if (monthlyTrendChart) monthlyTrendChart.destroy();
    monthlyTrendChart = new Chart(lineCtx, {
        type: 'line', 
        data: { 
            labels: lineLabels, 
            datasets: [
                { label: 'รายรับ', data: incomeData, borderColor: '#34c759', backgroundColor: 'rgba(52, 199, 89, 0.1)', fill: true, tension: 0.4 }, 
                { label: 'รายจ่าย', data: expenseData, borderColor: '#ff3b30', backgroundColor: 'rgba(255, 59, 48, 0.1)', fill: true, tension: 0.4 },
                { label: 'เงินออม', data: savingsData, borderColor: '#007aff', backgroundColor: 'rgba(0, 122, 255, 0.1)', fill: true, tension: 0.4 }
            ] 
        },
        options: { responsive: true, maintainAspectRatio: false, scales: { y: { beginAtZero: true, grid: { color: gridColor }, ticks: { callback: v => v.toLocaleString('th-TH') } }, x: { grid: { display: false } } }, plugins: { legend: { position: 'top', align: 'end', labels: { usePointStyle: true, boxWidth: 8 } } }, interaction: { intersect: false, mode: 'index' } }
    });
}

function exportData() {
    try {
        const selectedYear = document.getElementById('itemYear').value;
        const fileName = `Budget_Tracker_Pro_${currentProfile}_${selectedYear}.xlsx`;
        const dataForSheet = [];
        const header = ['เดือน', ...columnStructure.income.map(c => c.name), 'รวมรายรับ', ...columnStructure.expense.map(c => c.name), 'รวมรายจ่าย', ...columnStructure.savings.map(c => c.name), 'รวมเงินออม', 'คงเหลือใช้จ่าย'];
        dataForSheet.push(header);
        budgetData.forEach(item => {
            const row = [item.name];
            columnStructure.income.forEach(col => row.push(item[col.name] || 0));
            row.push(calculateTotalIncome(item));
            columnStructure.expense.forEach(col => row.push(item[col.name] || 0));
            row.push(calculateTotalExpense(item));
            columnStructure.savings.forEach(col => row.push(item[col.name] || 0));
            row.push(calculateTotalSavings(item));
            row.push(calculateBalance(item));
            dataForSheet.push(row);
        });
        const ws = XLSX.utils.aoa_to_sheet(dataForSheet);
        const wb = XLSX.utils.book_new();
        XLSX.utils.book_append_sheet(wb, ws, `สรุปปี ${selectedYear}`);
        XLSX.writeFile(wb, fileName);
    } catch (error) {
        showNotification('ส่งออกล้มเหลว', 'เกิดข้อผิดพลาดขณะสร้างไฟล์ Excel', 'danger');
    }
}

// --- Modal & Event Listeners ---
function setupEventListeners() {
    document.getElementById('themeToggle').addEventListener('change', toggleTheme);
    document.getElementById('saveProfileBtn').addEventListener('click', handleProfileChange);
    document.getElementById('profileName').addEventListener('keydown', e => { if (e.key === 'Enter') handleProfileChange(); });
    document.getElementById('openDashboardModalBtn').addEventListener('click', () => {
        openModal('dashboardModal');
        if (expensePieChart) expensePieChart.destroy();
        if (monthlyTrendChart) monthlyTrendChart.destroy();
        setTimeout(() => { renderCharts(); }, 450);
    });
    document.getElementById('openSavingsGoalModalBtn').addEventListener('click', () => openSavingsGoalModal());
    document.getElementById('openRecurringModalBtn').addEventListener('click', openRecurringModal);
    document.getElementById('openIncomeDateModalBtn').addEventListener('click', () => openDueDateModal('income'));
    document.getElementById('openDueDateModalBtn').addEventListener('click', () => openDueDateModal('expense'));
    document.querySelectorAll('.close-btn').forEach(btn => btn.addEventListener('click', () => closeModal(btn.closest('.modal-overlay').id)));
    document.getElementById('saveGoalBtn').addEventListener('click', addOrUpdateSavingsGoal);
    document.getElementById('saveNoteBtn').addEventListener('click', saveNote);
    document.getElementById('deleteNoteBtn').addEventListener('click', deleteNote);
    document.getElementById('saveRecurringBtn').addEventListener('click', saveRecurringTransaction);
    document.getElementById('applyRecurringBtn').addEventListener('click', () => autoApplyRecurringTransactions(true));
    document.getElementById('saveIncomeDateBtn').addEventListener('click', () => saveDueDates('income'));
    document.getElementById('saveDueDateBtn').addEventListener('click', () => saveDueDates('expense'));
    document.getElementById('cancelBtn').addEventListener('click', () => closeModal('confirmationModal'));
    document.getElementById('confirmBtn').addEventListener('click', () => {
        const modal = document.getElementById('confirmationModal');
        if (modal.confirmCallback) modal.confirmCallback();
        closeModal('confirmationModal');
    });
    document.querySelectorAll('.modal-overlay').forEach(m => m.addEventListener('click', e => { if (e.target === m) closeModal(m.id); }));
}
function openModal(modalId) { document.getElementById(modalId)?.classList.add('active'); }
function closeModal(modalId) { document.getElementById(modalId)?.classList.remove('active'); }
function showConfirmationModal(title, message, onConfirm) {
    document.getElementById('confirmTitle').textContent = title;
    document.getElementById('confirmMessage').textContent = message;
    document.getElementById('confirmationModal').confirmCallback = onConfirm;
    openModal('confirmationModal');
}
function openNoteModal(monthId, categoryId, categoryName) {
    const item = budgetData.find(item => item.id === monthId);
    if (item) {
        document.getElementById('noteModalTitle').textContent = `บันทึกสำหรับ: ${categoryName} - ${item.name}`;
        document.getElementById('noteTextarea').value = item.notes[categoryName] || '';
        const modal = document.getElementById('noteModal');
        modal.dataset.monthId = monthId;
        modal.dataset.categoryId = categoryId;
        modal.dataset.categoryName = categoryName;
        openModal('noteModal');
    }
}
function openSavingsGoalModal(goalId = null) {
    const modalTitle = document.getElementById('goalModalTitle');
    const goalIdInput = document.getElementById('goalId');
    const goalNameInput = document.getElementById('goalName');
    const goalAmountInput = document.getElementById('goalAmount');
    if (goalId) {
        const goal = savingsGoals.find(g => g.id == goalId);
        if (goal) {
            modalTitle.textContent = 'แก้ไขเป้าหมายการออม';
            goalIdInput.value = goal.id;
            goalNameInput.value = goal.name;
            goalAmountInput.value = goal.amount;
        }
    } else {
        modalTitle.textContent = 'เพิ่มเป้าหมายการออม';
        goalIdInput.value = '';
        goalNameInput.value = '';
        goalAmountInput.value = '';
    }
    openModal('savingsGoalModal');
}

function openRecurringModal() {
    const list = document.getElementById('recurringList');
    list.innerHTML = ''; // Clear previous content

    const generateListForType = (type, title, iconClass) => {
        if (columnStructure[type].length > 0) {
            // Create the main section container
            const section = document.createElement('div');
            section.className = `recurring-section ${type}-section`;

            // Create and add the header
            const header = document.createElement('h4');
            header.innerHTML = `<i class="ph-bold ${iconClass}"></i> ${title}`;
            section.appendChild(header);

            // Create a container for the items
            const itemsList = document.createElement('div');
            itemsList.className = 'recurring-items-list';

            // Add each item to the list
            columnStructure[type].forEach(c => {
                const itemDiv = document.createElement('div');
                itemDiv.className = 'recurring-item';
                itemDiv.innerHTML = `<label for="recurring-input-${c.id}">${c.name}</label>
                                     <input type="number" id="recurring-input-${c.id}" value="${recurringTransactions[c.id] || ''}" placeholder="จำนวนเงิน">`;
                itemsList.appendChild(itemDiv);
            });
            
            section.appendChild(itemsList);
            list.appendChild(section);
        }
    };

    generateListForType('income', 'รายรับ', 'ph-arrow-circle-down');
    generateListForType('expense', 'รายจ่าย', 'ph-arrow-circle-up');
    generateListForType('savings', 'เงินออม', 'ph-piggy-bank');

    openModal('recurringModal');
}

function openDueDateModal(type) {
    const isIncome = type === 'income';
    const modalId = isIncome ? 'incomeDateModal' : 'dueDateModal';
    const list = document.getElementById(isIncome ? 'incomeDateList' : 'dueDateList');
    const columns = isIncome ? columnStructure.income : columnStructure.expense;
    const dates = isIncome ? incomeDueDates : expenseDueDates;
    list.innerHTML = '';
    columns.forEach(col => {
        list.innerHTML += `<div class="due-date-item"><label>${col.name}</label><input type="number" id="date-${type}-${col.id}" min="1" max="31" placeholder="วันที่ (1-31)" value="${dates[col.id] || ''}"></div>`;
    });
    openModal(modalId);
}

async function saveDueDates(type) {
    const isIncome = type === 'income';
    const modalId = isIncome ? 'incomeDateModal' : 'dueDateModal';
    const columns = isIncome ? columnStructure.income : columnStructure.expense;
    
    const datesForApi = {};
    
    columns.forEach(col => {
        const inputElement = document.getElementById(`date-${type}-${col.id}`);
        const day = parseInt(inputElement.value.trim(), 10);
        datesForApi[col.id] = (day >= 1 && day <= 31) ? day : null;
    });

    try {
        await callApi('save_due_dates', 'POST', {
            profileName: currentProfile,
            dates: datesForApi
        });
        
        const newDatesState = {};
        for(const id in datesForApi){
            if(datesForApi[id] !== null){
                newDatesState[id] = datesForApi[id];
            }
        }
        if (isIncome) {
            incomeDueDates = newDatesState;
        } else {
            expenseDueDates = newDatesState;
        }

        closeModal(modalId);
        showNotification('บันทึกสำเร็จ', `ข้อมูลกำหนดวัน${isIncome ? 'รับเงิน' : 'ชำระ'}ถูกบันทึกแล้ว`, 'success');
        fullRender();
    } catch(error) {
        await loadDataFromAPI();
    }
}

// --- Helpers & Notifications ---
function updateClock() {
    const clock = document.getElementById('realtime-clock');
    if (!clock) return;
    const now = new Date();
    clock.innerHTML = `<div class="date">${String(now.getDate()).padStart(2, '0')} ${thaiMonths[now.getMonth()]} ${now.getFullYear() + 543}</div>
        <div class="time"><i class="ph ph-clock"></i> เวลา ${String(now.getHours()).padStart(2,'0')}.${String(now.getMinutes()).padStart(2,'0')}.${String(now.getSeconds()).padStart(2,'0')}</div>`;
}

// START: ### แก้ไขฟังก์ชัน checkDueDates ทั้งหมด ###
function checkDueDates() {
    const today = new Date();
    const currentDay = today.getDate();
    const currentMonth = today.getMonth();
    const selectedYear = parseInt(document.getElementById('itemYear').value, 10);
    const currentYear = today.getFullYear() + 543;

    // ไม่ต้องแจ้งเตือนหากดูข้อมูลของปีอื่นอยู่
    if (selectedYear !== currentYear) return;
    
    // 1. ตรวจสอบกำหนด "รับเงิน" (Income)
    Object.entries(incomeDueDates).forEach(([categoryId, day]) => {
        const category = columnStructure.income.find(c => c.id == categoryId);
        if(!category) return;
        
        const colName = category.name;
        const diff = day - currentDay;
        const key = `${currentYear}-${currentMonth}-income-${colName}`;

        // ป้องกันการแจ้งเตือนซ้ำ
        if (sessionNotifications.has(key)) return;
        
        if (diff >= 0 && diff <= 2) { // แจ้งเตือนล่วงหน้า 2 วัน และวันจริง
            const message = diff === 0 
                ? `รายการ "${colName}" ถึงกำหนดรับเงินวันนี้!`
                : `รายการ "${colName}" จะถึงกำหนดรับเงินในอีก ${diff} วัน`;
            // ใช้สี 'success' สำหรับการรับเงิน
            showNotification('แจ้งเตือนกำหนดรับเงิน', message, 'success');
            sessionNotifications.add(key);
        }
    });

    // 2. ตรวจสอบกำหนด "ชำระ" (Expense)
    Object.entries(expenseDueDates).forEach(([categoryId, day]) => {
        const category = columnStructure.expense.find(c => c.id == categoryId);
        if(!category) return;

        const colName = category.name;
        const diff = day - currentDay;
        const key = `${currentYear}-${currentMonth}-expense-${colName}`;

        if (sessionNotifications.has(key)) return;
        
        if (diff >= 0 && diff <= 3) { // แจ้งเตือนล่วงหน้า 3 วัน และวันจริง
            if (diff === 0) {
                showNotification('แจ้งเตือนกำหนดชำระ', `รายการ "${colName}" ครบกำหนดชำระวันนี้!`, 'danger');
            } else {
                showNotification('แจ้งเตือนกำหนดชำระ', `รายการ "${colName}" จะครบกำหนดในอีก ${diff} วัน`, 'warning');
            }
            sessionNotifications.add(key);
        }
    });
}
// END: ### แก้ไขฟังก์ชัน ###


function showNotification(title, message, type = 'info') {
    const container = document.getElementById('notification-container');
    if (!container) return;
    const noti = document.createElement('div');
    noti.className = `notification-card ${type}`;
    const icon = type === 'success' ? 'ph-check-circle' : (type === 'danger' ? 'ph-x-circle' : (type === 'warning' ? 'ph-warning-circle' : 'ph-info'));
    noti.innerHTML = `<i class="ph-bold ${icon} noti-icon"></i><div class="noti-content"><h4>${title}</h4><p>${message}</p></div>`;
    container.appendChild(noti);
    setTimeout(() => {
        noti.classList.add('fade-out');
        noti.addEventListener('animationend', () => noti.remove());
    }, 5000);
}

function showLoader() {
    document.getElementById('loading-overlay').classList.add('visible');
}

function hideLoader() {
    document.getElementById('loading-overlay').classList.remove('visible');
}
