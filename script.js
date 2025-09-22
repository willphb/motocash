/**
 * MotoCash App v4.0 (Conectado ao Google Sheets)
 * Aplicação online, multi-dispositivo com backend via Google Apps Script.
 */
document.addEventListener('DOMContentLoaded', () => {
    // ##################################################################
    // ## COLE A URL DA SUA API DO GOOGLE APPS SCRIPT AQUI DENTRO DAS ASPAS ##
    const API_URL = 'https://script.google.com/macros/s/AKfycbxC_a6qHSTACMgP2dx35RAfonRZ2L-fBscMgOOlSkdAGx4U09FzHFlgmxfYcryknfMc/exec';
    // ##################################################################

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

        // --- 3. MÓDULOS ---

        const uiFeedback = {
            showLoader: (message) => { DOMElements.loaderMessage.textContent = message; DOMElements.loaderOverlay.style.display = 'flex'; },
            hideLoader: () => { DOMElements.loaderOverlay.style.display = 'none'; }
        };
        
        const api = {
            loadState: async () => {
                uiFeedback.showLoader('Carregando dados...');
                try {
                    if (!API_URL || !API_URL.includes("script.google.com")) { throw new Error("URL da API inválida ou não definida. Verifique a constante API_URL no script.js."); }
                    const response = await fetch(API_URL);
                    if (!response.ok) { throw new Error(`Erro de rede: ${response.statusText}`); }
                    const data = await response.json();
                    if (data.error) { console.error("Erro retornado pela API do Google:", data.error, data.stack); throw new Error(`Erro no script da API: ${data.error}`); }
                    return data;
                } catch (error) {
                    console.error("Falha ao carregar dados:", error);
                    alert("Não foi possível carregar seus dados. Verifique a conexão com a internet ou a configuração da API.");
                    return null;
                } finally {
                    uiFeedback.hideLoader();
                }
            },
            saveAll: async () => {
                uiFeedback.showLoader('Salvando na nuvem...');
                try {
                    await fetch(API_URL, {
                        method: 'POST',
                        mode: 'no-cors',
                        headers: { 'Content-Type': 'text/plain;charset=utf-8' },
                        body: JSON.stringify(state)
                    });
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
            all: () => { state.derivedMetrics = logic.calculateConsumption(); render.dashboard(); render.history(); if (DOMElements.reportsView.style.display === 'block') render.reports(); },
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
            maintenanceCard: () => {
                if (state.settings.maintenancePlan.length === 0) return '';
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
            reports: () => { /* ... Inalterado ... */ },
            categoryManager: () => { /* ... Inalterado ... */ },
            maintenancePlan: () => { /* ... Inalterado ... */ },
            fixedExpenses: () => { /* ... Inalterado ... */ }
        };

        const modals = {
            open: (modalEl, context = null) => {
                if (modalEl === DOMElements.dayModal) {
                    DOMElements.dayForm.reset(); DOMElements.incomeEntries.innerHTML = ''; DOMElements.expenseEntries.innerHTML = '';
                    const record = context;
                    if (record) {
                        DOMElements.modalTitle.textContent = 'Editar Registro'; DOMElements.recordId.value = record.id; DOMElements.date.value = record.date; DOMElements.kmInitial.value = record.kmInitial; DOMElements.kmFinal.value = record.kmFinal; DOMElements.timeStart.value = record.timeStart || ''; DOMElements.timeEnd.value = record.timeEnd || '';
                        record.incomes.forEach(inc => modals.addDynamicEntry('income', inc)); record.expenses.forEach(exp => modals.addDynamicEntry('expense', exp));
                    } else {
                        DOMElements.modalTitle.textContent = 'Registrar Novo Dia'; DOMElements.recordId.value = ''; DOMElements.date.value = new Date().toISOString().split('T')[0];
                        if (state.records.length > 0) { const lastRecord = [...state.records].sort((a, b) => new Date(b.date) - new Date(a.date))[0]; DOMElements.kmInitial.value = lastRecord.kmFinal; }
                        modals.addDynamicEntry('income'); modals.addDynamicEntry('expense');
                    }
                    setTimeout(() => DOMElements.date.focus(), 100);
                }
                if (modalEl === DOMElements.settingsModal) {
                    DOMElements.monthlyGoal.value = state.settings.monthlyGoal > 0 ? state.settings.monthlyGoal : '';
                    render.categoryManager(); render.maintenancePlan(); render.fixedExpenses();
                    const tab = context || 'general';
                    document.querySelectorAll('.settings-tab, .settings-tab-content').forEach(el => el.classList.remove('active'));
                    document.querySelector(`.settings-tab[data-tab="${tab}"]`).classList.add('active'); document.querySelector(`#tab-${tab}`).classList.add('active');
                    setTimeout(() => DOMElements.monthlyGoal.focus(), 100);
                }
                modalEl.style.display = 'block';
            },
            close: modalEl => { if (modalEl) modalEl.style.display = 'none'; },
            addDynamicEntry: (type, entry = {}) => { /* ... Inalterado ... */ }
        };

        const backup = {
            exportData: () => { /* ... Inalterado ... */ },
            importData: async (e) => { // Agora é async
                const file = e.target.files[0]; if (!file) return;
                const reader = new FileReader();
                reader.onload = async (ev) => {
                    try {
                        const data = JSON.parse(ev.target.result);
                        if (data.records && data.categories && data.settings) {
                            if (confirm('Atenção: Isso substituirá todos os dados na nuvem. Deseja continuar?')) {
                                Object.assign(state, data); // Carrega os dados localmente
                                await api.saveAll(); // Envia os novos dados para a nuvem
                                view.applyTheme(); render.all();
                                alert('Dados importados e salvos na nuvem com sucesso!');
                            }
                        } else { alert('Erro: Arquivo de backup inválido.'); }
                    } catch (error) { console.error("Erro ao importar dados:", error); alert('Erro ao ler o arquivo de backup.'); }
                };
                reader.readAsText(file); e.target.value = '';
            }
        };
        
        const handlers = {
            handleDayFormSubmit: async (e) => {
                e.preventDefault();
                const kmInitial = parseFloat(DOMElements.kmInitial.value) || 0; const kmFinal = parseFloat(DOMElements.kmFinal.value) || 0;
                if (kmFinal <= kmInitial) { alert('O KM final deve ser maior que o KM inicial.'); return; }
                const id = DOMElements.recordId.value ? parseInt(DOMElements.recordId.value) : Date.now();
                const incomes = Array.from(DOMElements.incomeEntries.querySelectorAll('.dynamic-entry')).map(div => ({ category: div.querySelector('select').value, amount: parseFloat(div.querySelector('.amount')?.value) || 0 })).filter(item => item.amount > 0);
                const expenses = Array.from(DOMElements.expenseEntries.querySelectorAll('.dynamic-entry')).map(div => {
                    const category = div.querySelector('select').value;
                    if (category === 'Combustível') { const liters = parseFloat(div.querySelector('.liters')?.value) || 0; const price = parseFloat(div.querySelector('.pricePerLiter')?.value) || 0; return { category, liters, pricePerLiter: price, amount: liters * price }; }
                    return { category, amount: parseFloat(div.querySelector('.amount')?.value) || 0 };
                }).filter(item => item.amount > 0);
                const record = { id, date: DOMElements.date.value, kmInitial, kmFinal, timeStart: DOMElements.timeStart.value, timeEnd: DOMElements.timeEnd.value, incomes, expenses, totalIncome: incomes.reduce((sum, item) => sum + item.amount, 0), totalExpense: expenses.reduce((sum, item) => sum + item.amount, 0) };
                if (DOMElements.recordId.value) { state.records = state.records.map(rec => rec.id === id ? record : rec); } else { state.records.push(record); }
                await api.saveAll(); render.all(); modals.close(DOMElements.dayModal);
            },
            handleSettingsClick: async (e) => {
                const button = e.target.closest('button'); if (!button) return;
                const { tab, type, name, id } = button.dataset;
                if (tab) { document.querySelectorAll('.settings-tab, .settings-tab-content').forEach(el => el.classList.remove('active')); button.classList.add('active'); document.getElementById(`tab-${tab}`).classList.add('active'); }
                if (type && name) {
                    if (button.classList.contains('rename-cat-btn')) { const newName = prompt(`Novo nome para "${name}":`, name); if (newName && newName.trim() !== '' && newName !== name) { const index = state.categories[type].indexOf(name); if (index > -1) state.categories[type][index] = newName; state.records.forEach(rec => rec[type === 'income' ? 'incomes' : 'expenses'].forEach(entry => { if (entry.category === name) entry.category = newName; })); await api.saveAll(); render.all(); render.categoryManager(); }
                    } else if (button.classList.contains('delete-cat-btn')) { if (confirm(`Excluir a categoria "${name}"?`)) { state.categories[type] = state.categories[type].filter(cat => cat !== name); await api.saveAll(); render.categoryManager(); } }
                }
                if (button.classList.contains('delete-maintenance-btn')) { if (confirm('Excluir este lembrete?')) { state.settings.maintenancePlan = state.settings.maintenancePlan.filter(item => item.id !== parseInt(id)); await api.saveAll(); render.all(); modals.open(DOMElements.settingsModal, 'maintenance'); } }
                if (button.classList.contains('delete-fixed-expense-btn')) { if (confirm('Excluir esta despesa fixa?')) { state.settings.fixedExpenses = state.settings.fixedExpenses.filter(item => item.id !== parseInt(id)); await api.saveAll(); render.all(); modals.open(DOMElements.settingsModal, 'fixed-expenses'); } }
            },
            handleSettingsSave: async () => { state.settings.monthlyGoal = parseFloat(DOMElements.monthlyGoal.value) || 0; await api.saveAll(); render.all(); },
            handleMaintenanceFormSubmit: async (e) => {
                e.preventDefault();
                const name = DOMElements.maintenanceForm.querySelector('#maintenance-name').value; const lastKm = parseFloat(DOMElements.maintenanceForm.querySelector('#maintenance-last-km').value); const interval = parseFloat(DOMElements.maintenanceForm.querySelector('#maintenance-interval').value);
                if (name.trim() && !isNaN(lastKm) && interval > 0) {
                    state.settings.maintenancePlan.push({ id: Date.now(), name: name.trim(), lastKm, interval });
                    await api.saveAll(); DOMElements.maintenanceForm.reset(); render.all(); modals.open(DOMElements.settingsModal, 'maintenance');
                } else { alert('Preencha todos os campos do lembrete corretamente.'); }
            },
            handleThemeToggle: async () => { state.settings.theme = document.body.classList.contains('theme-dark') ? 'theme-light' : 'theme-dark'; view.applyTheme(); await api.saveAll(); },
            handleFixedExpenseSubmit: async (e) => {
                e.preventDefault();
                const name = DOMElements.fixedExpenseForm.querySelector('#fixed-expense-name').value;
                const amount = parseFloat(DOMElements.fixedExpenseForm.querySelector('#fixed-expense-amount').value);
                if (name.trim() && amount > 0) {
                    state.settings.fixedExpenses.push({ id: Date.now(), name: name.trim(), amount });
                    await api.saveAll(); DOMElements.fixedExpenseForm.reset(); render.all(); modals.open(DOMElements.settingsModal, 'fixed-expenses');
                } else { alert('Preencha a descrição e o valor da despesa.'); }
            },
            handleHistoryClick: (e) => { /* ... Inalterado ... */ },
            switchView: (viewId) => { /* ... Inalterado ... */ },
            handlePdfExport: () => { /* ... Inalterado ... */ }
        };
        
        async function init() {
            cacheDOMElements();
            const loadedState = await api.loadState();
            if (loadedState) { Object.assign(state, loadedState); } 
            else { DOMElements.mainDashboard.innerHTML = `<div class="card"><h3 style="color: var(--error-color);">Falha ao Carregar Dados</h3><p style="font-size: 1rem; color: var(--text-secondary);">Verifique sua conexão ou a URL da API no script.</p></div>`; }
            view.applyTheme();
            bindEvents();
            render.all();
        }

        init();
    })();
});

