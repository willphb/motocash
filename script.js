// ##################################################################
// ## PASSO 1: COLE A URL DA SUA API AQUI DENTRO DAS ASPAS ##
const API_URL = 'https://script.google.com/macros/s/AKfycbxC_a6qHSTACMgP2dx35RAfonRZ2L-fBscMgOOlSkdAGx4U09FzHFlgmxfYcryknfMc/exec';
// ##################################################################

/**
 * MotoCash App v4.3 (Correção Final de Renderização)
 * Aplicação online, multi-dispositivo com backend via Google Apps Script.
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

        // --- 2. CONSTANTES E SELETORES DE DOM ---
        const DOMElements = {};

        // --- 3. MÓDULOS (DEFINIDOS ANTES DO USO) ---
        const uiFeedback = {
            showLoader: (message) => { if (DOMElements.loaderOverlay) { DOMElements.loaderMessage.textContent = message; DOMElements.loaderOverlay.style.display = 'flex'; } },
            hideLoader: () => { if (DOMElements.loaderOverlay) DOMElements.loaderOverlay.style.display = 'none'; }
        };
        
        const api = {
            loadState: async () => {
                uiFeedback.showLoader('Carregando dados...');
                try {
                    if (!API_URL || !API_URL.includes("script.google.com")) { throw new Error("URL da API inválida ou não definida. Verifique a constante API_URL no topo do arquivo script.js."); }
                    const response = await fetch(API_URL);
                    if (!response.ok) { throw new Error(`Erro de rede: ${response.statusText}`); }
                    const data = await response.json();
                    if (data.error) { console.error("Erro retornado pela API do Google:", data.error, data.stack); throw new Error(`Erro no script da API: ${data.error}`); }
                    return data;
                } catch (error) {
                    console.error("Falha ao carregar dados:", error);
                    alert(`Não foi possível carregar seus dados.\n\nERRO: ${error.message}\n\nVerifique a conexão com a internet ou a configuração da API.`);
                    return null;
                } finally {
                    uiFeedback.hideLoader();
                }
            },
            saveAll: async () => {
                uiFeedback.showLoader('Salvando na nuvem...');
                try {
                    await fetch(API_URL, { method: 'POST', mode: 'no-cors', headers: { 'Content-Type': 'text/plain;charset=utf-8' }, body: JSON.stringify(state) });
                    await new Promise(resolve => setTimeout(resolve, 1500));
                } catch (error) {
                    console.error("Falha ao salvar dados:", error);
                    alert("Não foi possível salvar suas alterações. Verifique a conexão com a internet.");
                } finally {
                    uiFeedback.hideLoader();
                }
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
            all: () => { 
                state.derivedMetrics.consumption = logic.calculateConsumption(); 
                render.dashboard(); 
                render.history(); 
                if (DOMElements.reportsView && DOMElements.reportsView.style.display === 'block') {
                    render.reports();
                }
            },
            dashboard: () => {
                const today = new Date(); const currentMonthStr = `${today.getFullYear()}-${String(today.getMonth() + 1).padStart(2, '0')}`;
                const currentMonthRecords = state.records.filter(r => r.date.startsWith(currentMonthStr));
                const profitData = currentMonthRecords.reduce((acc, rec) => { const profit = rec.totalIncome - rec.totalExpense; acc.totalProfit += profit; if (rec.timeStart && rec.timeEnd) { const hours = logic.calculateHours(rec.timeStart, rec.timeEnd); if (hours > 0) { acc.totalHours += hours; acc.profitWithTime += profit; } } return acc; }, { totalProfit: 0, totalHours: 0, profitWithTime: 0 });
                const totalFixedExpenses = (state.settings.fixedExpenses || []).reduce((sum, exp) => sum + exp.amount, 0);
                const netProfit = profitData.totalProfit - totalFixedExpenses;
                const avgHourly = profitData.totalHours > 0 ? profitData.profitWithTime / profitData.totalHours : 0;
                DOMElements.mainDashboard.innerHTML = `${render.goalCard(netProfit)} <div class="card"><h3>Lucro Líquido (Mês)</h3><p>${logic.formatCurrency(netProfit)}</p></div> <div class="card"><h3>Despesas Fixas</h3><p>${logic.formatCurrency(totalFixedExpenses)}</p></div> <div class="card"><h3>Média R$/h</h3><p>${logic.formatCurrency(avgHourly)}</p></div> <div class="card"><h3>Consumo Médio</h3><p>${state.derivedMetrics.consumption.overallAvgKmL.toFixed(2)} km/L</p></div> ${render.maintenanceCard()}`;
            },
            history: () => {
                if(!DOMElements.historyList) return;
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
            maintenanceCard: () => {
                if (!state.settings.maintenancePlan || state.settings.maintenancePlan.length === 0) return '';
                const lastKm = state.records.length > 0 ? Math.max(...state.records.map(r => r.kmFinal)) : 0;
                if (lastKm === 0) return ''; let upcomingServicesHTML = '';
                state.settings.maintenancePlan.sort((a,b) => (a.lastKm + a.interval) - (b.lastKm + b.interval)).forEach(item => {
                    const progress = ((lastKm - item.lastKm) / item.interval) * 100;
                    if (progress >= 80 && progress < 150) {
                        let color = 'var(--success-color)';
                        if (progress >= 100) color = 'var(--error-color)'; else if (progress >= 90) color = 'var(--warning-color)';
                        upcomingServicesHTML += `<li class="maintenance-item"><div class="maintenance-name">${item.name}</div><div class="maintenance-progress-bar"><div style="width: ${Math.min(progress, 100)}%; background-color: ${color};"></div></div><div class="maintenance-due">${(item.lastKm + item.interval - lastKm) > 0 ? `Faltam ${Math.round(item.lastKm + item.interval - lastKm)} km` : 'Manutenção vencida!'}</div></li>`;
                    }
                });
                if (upcomingServicesHTML === '') return '';
                return `<div class="card maintenance-card"><h3>Manutenção Próxima</h3><ul>${upcomingServicesHTML}</ul></div>`;
            },
            reports: () => { /* ... (código completo no bloco final) ... */ },
            categoryManager: () => { /* ... (código completo no bloco final) ... */ },
            maintenancePlan: () => { /* ... (código completo no bloco final) ... */ },
            fixedExpenses: () => { /* ... (código completo no bloco final) ... */ }
        };

        const modals = { /* ... (código completo no bloco final) ... */ };
        const backup = { /* ... (código completo no bloco final) ... */ };
        const handlers = { /* ... (código completo no bloco final) ... */ };

        function cacheDOMElements() {
            const toCamelCase = s => s.replace(/-./g, x => x[1].toUpperCase());
            const ids = ['main-dashboard', 'add-day-btn', 'export-btn', 'import-file', 'settings-btn', 'day-modal', 'settings-modal', 'day-form', 'modal-title', 'record-id', 'history-list', 'history-view', 'reports-view', 'show-history-btn', 'show-reports-btn', 'report-period', 'profit-chart-container', 'income-pie-chart', 'income-legend', 'expense-pie-chart', 'expense-legend', 'monthly-goal', 'maintenance-form', 'maintenance-plan-list', 'date', 'time-start', 'time-end', 'km-initial', 'km-final', 'income-entries', 'add-income-btn', 'expense-entries', 'add-expense-btn', 'income-category-list', 'expense-category-list', 'theme-toggle-btn', 'fixed-expense-list', 'fixed-expense-form', 'export-pdf-btn', 'loader-overlay', 'loader-message'];
            ids.forEach(id => { DOMElements[toCamelCase(id)] = document.getElementById(id); });
        }

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
            DOMElements.reportPeriod.addEventListener('change', render.reports);
            DOMElements.themeToggleBtn.addEventListener('click', handlers.handleThemeToggle);
            DOMElements.fixedExpenseForm.addEventListener('submit', handlers.handleFixedExpenseSubmit);
            DOMElements.exportPdfBtn.addEventListener('click', handlers.handlePdfExport);
        }
        
        async function init() {
            cacheDOMElements();
            const loadedState = await api.loadState();
            if (loadedState) {
                const mergedSettings = { ...state.settings, ...loadedState.settings };
                Object.assign(state, loadedState);
                state.settings = mergedSettings;
            } else {
                DOMElements.mainDashboard.innerHTML = `<div class="card"><h3 style="color: var(--error-color);">Falha ao Carregar Dados</h3><p style="font-size: 1rem; color: var(--text-secondary);">Verifique sua conexão ou a URL da API no script.</p></div>`;
                return; 
            }
            view.applyTheme();
            bindEvents();
            render.all();
        }

        init();
    })();
});
