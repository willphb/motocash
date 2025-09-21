/**
 * MotoCash App v3.3 (Correção de Referência de DOM)
 * Aplicação offline-first completa com planejamento, personalização e relatórios.
 */
document.addEventListener('DOMContentLoaded', () => {
    const App = (() => {
        // --- 1. ESTADO DA APLICAÇÃO ---
        const state = {
            records: [],
            categories: { income: [], expense: [] },
            settings: { monthlyGoal: 0, maintenancePlan: [], fixedExpenses: [], theme: 'theme-dark' },
            derivedMetrics: { consumption: {} }
        };

        // --- 2. CONSTANTES E SELETORES ---
        const KEYS = { RECORDS: 'motoCashRecords', CATEGORIES: 'motoCashCategories', SETTINGS: 'motoCashSettings' };
        const DOMElements = {};

        // --- 3. FUNÇÕES DE INICIALIZAÇÃO E SETUP ---
        function init() {
            cacheDOMElements();
            storage.loadState();
            view.applyTheme();
            bindEvents();
            render.all();
        }

        function cacheDOMElements() {
            const toCamelCase = s => s.replace(/-./g, x => x[1].toUpperCase());
            const ids = ['main-dashboard', 'add-day-btn', 'export-btn', 'import-file', 'settings-btn', 'day-modal', 'settings-modal', 'day-form', 'modal-title', 'record-id', 'history-list', 'history-view', 'reports-view', 'show-history-btn', 'show-reports-btn', 'report-period', 'profit-chart-container', 'income-pie-chart', 'income-legend', 'expense-pie-chart', 'expense-legend', 'monthly-goal', 'maintenance-form', 'maintenance-plan-list', 'date', 'time-start', 'time-end', 'km-initial', 'km-final', 'income-entries', 'add-income-btn', 'expense-entries', 'add-expense-btn', 'income-category-list', 'expense-category-list', 'theme-toggle-btn', 'fixed-expense-list', 'fixed-expense-form', 'export-pdf-btn', 'loader-overlay', 'loader-message'];
            ids.forEach(id => {
                DOMElements[toCamelCase(id)] = document.getElementById(id);
            });
        }

        // --- 4. MÓDULOS (DEFINIDOS ANTES DO USO) ---

        const storage = {
            saveAll: () => { localStorage.setItem(KEYS.RECORDS, JSON.stringify(state.records)); localStorage.setItem(KEYS.CATEGORIES, JSON.stringify(state.categories)); localStorage.setItem(KEYS.SETTINGS, JSON.stringify(state.settings)); },
            loadState: () => {
                state.records = JSON.parse(localStorage.getItem(KEYS.RECORDS)) || [];
                state.categories = JSON.parse(localStorage.getItem(KEYS.CATEGORIES)) || { income: ['Uber', 'iFood', 'Particular'], expense: ['Combustível', 'Manutenção', 'Alimentação'] };
                const savedSettings = JSON.parse(localStorage.getItem(KEYS.SETTINGS)) || {};
                state.settings = { monthlyGoal: 0, maintenancePlan: [], fixedExpenses: [], theme: 'theme-dark', ...savedSettings };
            }
        };

        const logic = {
            formatCurrency: (value) => (value || 0).toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' }),
            calculateHours: (start, end) => (new Date(`1970-01-01T${end}`) - new Date(`1970-01-01T${start}`)) / 3600000,
            calculateConsumption: () => {
                const fuelings = state.records.flatMap(rec => rec.expenses.filter(exp => exp.category === 'Combustível' && exp.liters > 0).map(exp => ({ recordId: rec.id, km: rec.kmFinal, liters: exp.liters }))).sort((a, b) => a.km - b.km);
                const metrics = {}; let totalKm = 0, totalLiters = 0;
                for (let i = 1; i < fuelings.length; i++) {
                    const prev = fuelings[i-1], current = fuelings[i], kmDiff = current.km - prev.km;
                    if (kmDiff > 0) { metrics[current.recordId] = { kmL: kmDiff / current.liters }; totalKm += kmDiff; totalLiters += current.liters; }
                }
                return { overallAvgKmL: totalLiters > 0 ? totalKm / totalLiters : 0, fuelings: metrics };
            }
        };

        const view = {
            applyTheme: () => { document.body.className = state.settings.theme; DOMElements.themeToggleBtn.textContent = state.settings.theme === 'theme-dark' ? '☀️' : '🌙'; }
        };

        const render = {
            all: () => { state.derivedMetrics.consumption = logic.calculateConsumption(); render.dashboard(); render.history(); if (DOMElements.reportsView.style.display === 'block') render.reports(); },
            dashboard: () => {
                const today = new Date(); const currentMonthStr = `${today.getFullYear()}-${String(today.getMonth() + 1).padStart(2, '0')}`;
                const currentMonthRecords = state.records.filter(r => r.date.startsWith(currentMonthStr));
                const profitData = currentMonthRecords.reduce((acc, rec) => { const profit = rec.totalIncome - rec.totalExpense; acc.totalProfit += profit; if (rec.timeStart && rec.timeEnd) { const hours = logic.calculateHours(rec.timeStart, rec.timeEnd); if (hours > 0) { acc.totalHours += hours; acc.profitWithTime += profit; } } return acc; }, { totalProfit: 0, totalHours: 0, profitWithTime: 0 });
                const totalFixedExpenses = state.settings.fixedExpenses.reduce((sum, exp) => sum + exp.amount, 0);
                const netProfit = profitData.totalProfit - totalFixedExpenses;
                const avgHourly = profitData.totalHours > 0 ? profitData.profitWithTime / profitData.totalHours : 0;
                DOMElements.mainDashboard.innerHTML = `${render.goalCard(netProfit)} <div class="card"><h3>Lucro Líquido (Mês)</h3><p>${logic.formatCurrency(netProfit)}</p></div> <div class="card"><h3>Despesas Fixas</h3><p>${logic.formatCurrency(totalFixedExpenses)}</p></div> <div class="card"><h3>Média R$/h</h3><p>${logic.formatCurrency(avgHourly)}</p></div> <div class="card"><h3>Consumo Médio</h3><p>${state.derivedMetrics.consumption.overallAvgKmL.toFixed(2)} km/L</p></div> ${render.maintenanceCard()}`;
            },
            history: () => {
                DOMElements.historyList.innerHTML = '';
                if (state.records.length === 0) { DOMElements.historyList.innerHTML = '<p style="text-align: center; color: var(--text-secondary);">Nenhum registro encontrado.</p>'; return; }
                const sortedRecords = [...state.records].sort((a, b) => new Date(b.date) - new Date(a.date));
                sortedRecords.forEach(record => {
                    const profit = record.totalIncome - record.totalExpense; const item = document.createElement('div'); item.className = 'history-item'; item.dataset.id = record.id;
                    const profitClass = profit >= 0 ? 'positive' : 'negative';
                    const date = new Date(record.date); const formattedDate = new Intl.DateTimeFormat('pt-BR', { timeZone: 'UTC' }).format(date);
                    let metricsHTML = `<span class="metric-km">${record.kmFinal - record.kmInitial} km</span>`;
                    if (record.timeStart && record.timeEnd) { const hours = logic.calculateHours(record.timeStart, record.timeEnd); if (hours > 0) metricsHTML += `<span>${logic.formatCurrency(profit / hours)}/h</span>`; }
                    const fuelingMetric = state.derivedMetrics.consumption.fuelings[record.id];
                    if (fuelingMetric) metricsHTML += `<span>${fuelingMetric.kmL.toFixed(2)} km/L</span>`;
                    item.innerHTML = `<div class="history-item-date">${formattedDate}</div><div class="history-item-details"><div class="history-profit ${profitClass}">${logic.formatCurrency(profit)}</div><div class="history-metrics">${metricsHTML}</div></div>`;
                    DOMElements.historyList.appendChild(item);
                });
            },
            goalCard: (netProfit) => {
                const goal = state.settings.monthlyGoal; if (!goal || goal <= 0) return '';
                const progress = Math.min((netProfit / goal) * 100, 100);
                return `<div class="card goal-card"><h3>Meta do Mês</h3><div class="goal-text">${logic.formatCurrency(netProfit)} / ${logic.formatCurrency(goal)}</div><div class="progress-bar-container"><div class="progress-bar" style="width: ${progress}%;"></div></div></div>`;
            },
            maintenanceCard: () => { /* ... Inalterado ... */ return ''; },
            reports: () => { /* ... Inalterado ... */ },
            categoryManager: () => { /* ... Inalterado ... */ },
            maintenancePlan: () => { /* ... Inalterado ... */ },
            fixedExpenses: () => { /* ... Inalterado ... */ }
        };

        const modals = { /* ... Inalterado ... */ };
        const backup = { /* ... Inalterado ... */ };
        
        const handlers = {
            handleDayFormSubmit: e => {
                e.preventDefault();
                const kmInitial = parseFloat(DOMElements.kmInitial.value) || 0; const kmFinal = parseFloat(DOMElements.kmFinal.value) || 0;
                if (kmFinal <= kmInitial) { alert('O KM final deve ser maior que o KM inicial.'); return; }
                const id = DOMElements.recordIdInput.value ? parseInt(DOMElements.recordIdInput.value) : Date.now();
                const incomes = Array.from(DOMElements.incomeEntries.querySelectorAll('.dynamic-entry')).map(div => ({ category: div.querySelector('select').value, amount: parseFloat(div.querySelector('.amount')?.value) || 0 })).filter(item => item.amount > 0);
                const expenses = Array.from(DOMElements.expenseEntries.querySelectorAll('.dynamic-entry')).map(div => {
                    const category = div.querySelector('select').value;
                    if (category === 'Combustível') { const liters = parseFloat(div.querySelector('.liters')?.value) || 0; const price = parseFloat(div.querySelector('.pricePerLiter')?.value) || 0; return { category, liters, pricePerLiter: price, amount: liters * price }; }
                    return { category, amount: parseFloat(div.querySelector('.amount')?.value) || 0 };
                }).filter(item => item.amount > 0);
                const record = { id, date: DOMElements.date.value, kmInitial, kmFinal, timeStart: DOMElements.timeStart.value, timeEnd: DOMElements.timeEnd.value, incomes, expenses, totalIncome: incomes.reduce((sum, item) => sum + item.amount, 0), totalExpense: expenses.reduce((sum, item) => sum + item.amount, 0) };
                if (DOMElements.recordIdInput.value) { state.records = state.records.map(rec => rec.id === id ? record : rec); } else { state.records.push(record); }
                storage.saveAll(); render.all(); modals.close(DOMElements.dayModal);
            },
            handleHistoryClick: e => { const item = e.target.closest('.history-item'); if (item) { const record = state.records.find(rec => rec.id === parseInt(item.dataset.id)); if (record) modals.open(DOMElements.dayModal, record); } },
            handleSettingsClick: e => { /* ... Inalterado ... */ },
            handleSettingsSave: () => { /* ... Inalterado ... */ },
            handleMaintenanceFormSubmit: e => { /* ... Inalterado ... */ },
            switchView: viewId => { /* ... Inalterado ... */ },
            handleThemeToggle: () => { state.settings.theme = document.body.classList.contains('theme-dark') ? 'theme-light' : 'theme-dark'; storage.saveAll(); view.applyTheme(); },
            handleFixedExpenseSubmit: e => { /* ... Inalterado ... */ },
            handlePdfExport: () => { /* ... Inalterado ... */ }
        };

        function bindEvents() {
            DOMElements.addDayBtn.addEventListener('click', () => modals.open(DOMElements.dayModal));
            DOMElements.settingsBtn.addEventListener('click', () => modals.open(DOMElements.settingsModal));
            DOMElements.exportBtn.addEventListener('click', backup.exportData);
            DOMElements.importFile.addEventListener('change', backup.importData);
            DOMElements.dayModal.querySelector('.close-btn').addEventListener('click', () => modals.close(DOMElements.dayModal));
            DOMElements.settingsModal.querySelector('.close-btn').addEventListener('click', () => modals.close(DOMElements.settingsModal));
            window.addEventListener('click', e => { if (e.target === DOMElements.dayModal) modals.close(DOMElements.dayModal); if (e.target === DOMElements.settingsModal) modals.close(DOMElements.settingsModal); });
            DOMElements.dayForm.addEventListener('submit', handlers.handleDayFormSubmit);
            DOMElements.addIncomeBtn.addEventListener('click', () => modals.addDynamicEntry('income'));
            DOMElements.addExpenseBtn.addEventListener('click', () => modals.addDynamicEntry('expense'));
            DOMElements.historyList.addEventListener('click', handlers.handleHistoryClick);
            DOMElements.settingsModal.addEventListener('click', handlers.handleSettingsClick);
            DOMElements.monthlyGoal.addEventListener('change', handlers.handleSettingsSave);
            DOMElements.maintenanceForm.addEventListener('submit', handlers.handleMaintenanceFormSubmit);
            DOMElements.showHistoryBtn.addEventListener('click', () => handlers.switchView('history'));
            DOMElements.showReportsBtn.addEventListener('click', () => handlers.switchView('reports'));
            DOMElements.reportPeriodSelect.addEventListener('change', render.reports);
            DOMElements.themeToggleBtn.addEventListener('click', handlers.handleThemeToggle);
            DOMElements.fixedExpenseForm.addEventListener('submit', handlers.handleFixedExpenseSubmit);
            DOMElements.exportPdfBtn.addEventListener('click', handlers.handlePdfExport);
        }
        
        init();
    })();
});
