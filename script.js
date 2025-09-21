/**
 * MotoCash App v3.4 (Correção Final de Inicialização)
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

        // --- 2. CONSTANTES E SELETORES DE DOM ---
        const KEYS = { RECORDS: 'motoCashRecords', CATEGORIES: 'motoCashCategories', SETTINGS: 'motoCashSettings' };
        const COLORS = { CHART: ['#03dac6', '#bb86fc', '#f9a825', '#ff7043', '#29b6f6', '#ef5350'], STATUS: { OK: 'var(--success-color)', WARN: 'var(--warning-color)', DANGER: 'var(--error-color)' } };
        const DOMElements = {};

        // --- 3. MÓDULOS (DEFINIDOS ANTES DO USO) ---
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
            maintenanceCard: () => {
                if (state.settings.maintenancePlan.length === 0) return '';
                const lastKm = state.records.length > 0 ? Math.max(...state.records.map(r => r.kmFinal)) : 0;
                if (lastKm === 0) return ''; let upcomingServicesHTML = '';
                state.settings.maintenancePlan.sort((a,b) => (a.lastKm + a.interval) - (b.lastKm + b.interval)).forEach(item => {
                    const progress = ((lastKm - item.lastKm) / item.interval) * 100;
                    if (progress >= 80 && progress < 150) {
                        let color = COLORS.STATUS.OK;
                        if (progress >= 100) color = COLORS.STATUS.DANGER; else if (progress >= 90) color = COLORS.STATUS.WARN;
                        upcomingServicesHTML += `<li class="maintenance-item"><div class="maintenance-name">${item.name}</div><div class="maintenance-progress-bar"><div style="width: ${Math.min(progress, 100)}%; background-color: ${color};"></div></div><div class="maintenance-due">${(item.lastKm + item.interval - lastKm) > 0 ? `Faltam ${Math.round(item.lastKm + item.interval - lastKm)} km` : 'Manutenção vencida!'}</div></li>`;
                    }
                });
                if (upcomingServicesHTML === '') return '';
                return `<div class="card maintenance-card"><h3>Manutenção Próxima</h3><ul>${upcomingServicesHTML}</ul></div>`;
            },
            reports: () => {
                const populatePeriodSelector = () => {
                    const currentSelection = DOMElements.reportPeriodSelect.value;
                    const periods = new Set(state.records.map(rec => rec.date.substring(0, 7)));
                    const sortedPeriods = Array.from(periods).sort().reverse();
                    DOMElements.reportPeriodSelect.innerHTML = '<option value="all">Ano Inteiro</option>';
                    sortedPeriods.forEach(period => {
                        const option = document.createElement('option'); option.value = period;
                        const [year, month] = period.split('-');
                        option.textContent = new Date(period + '-02').toLocaleDateString('pt-BR', {month:'long', year:'numeric'});
                        DOMElements.reportPeriodSelect.appendChild(option);
                    });
                    if (Array.from(DOMElements.reportPeriodSelect.options).some(opt => opt.value === currentSelection)) { DOMElements.reportPeriodSelect.value = currentSelection; }
                };
                populatePeriodSelector();
                const period = DOMElements.reportPeriodSelect.value;
                const recordsForReport = state.records.filter(r => period === 'all' || r.date.startsWith(period));
                DOMElements.exportPdfBtn.disabled = recordsForReport.length === 0;
            },
            categoryManager: () => {
                DOMElements.incomeCategoryList.innerHTML = ''; DOMElements.expenseCategoryList.innerHTML = '';
                const createListItem = (type, category) => { const li = document.createElement('li'); li.className = 'category-item'; li.innerHTML = `<span class="category-name">${category}</span><div class="category-actions"><button class="rename-cat-btn" data-type="${type}" data-name="${category}" title="Renomear">✏️</button><button class="delete-cat-btn" data-type="${type}" data-name="${category}" title="Excluir">🗑️</button></div>`; return li; };
                state.categories.income.forEach(cat => DOMElements.incomeCategoryList.appendChild(createListItem('income', cat)));
                state.categories.expense.forEach(cat => DOMElements.expenseCategoryList.appendChild(createListItem('expense', cat)));
            },
            maintenancePlan: () => {
                DOMElements.maintenancePlanList.innerHTML = '';
                if (state.settings.maintenancePlan.length === 0) { DOMElements.maintenancePlanList.innerHTML = '<p class="text-secondary-small">Nenhum lembrete cadastrado.</p>'; return; }
                state.settings.maintenancePlan.forEach(item => {
                    const li = document.createElement('div'); li.className = 'category-item';
                    li.innerHTML = `<span class="category-name">${item.name} (última em ${item.lastKm}km, a cada ${item.interval}km)</span><div class="category-actions"><button class="delete-maintenance-btn" data-id="${item.id}" title="Excluir">🗑️</button></div>`;
                    DOMElements.maintenancePlanList.appendChild(li);
                });
            },
            fixedExpenses: () => {
                DOMElements.fixedExpenseList.innerHTML = '';
                if (state.settings.fixedExpenses.length === 0) { DOMElements.fixedExpenseList.innerHTML = '<p class="text-secondary-small">Nenhuma despesa fixa cadastrada.</p>'; return; }
                state.settings.fixedExpenses.forEach(item => {
                    const li = document.createElement('div'); li.className = 'category-item';
                    li.innerHTML = `<span class="category-name">${item.name} - ${logic.formatCurrency(item.amount)}</span><div class="category-actions"><button class="delete-fixed-expense-btn" data-id="${item.id}" title="Excluir">🗑️</button></div>`;
                    DOMElements.fixedExpenseList.appendChild(li);
                });
            }
        };

        const modals = {
            open: (modalEl, context = null) => {
                if (modalEl === DOMElements.dayModal) {
                    DOMElements.dayForm.reset(); DOMElements.incomeEntries.innerHTML = ''; DOMElements.expenseEntries.innerHTML = '';
                    const record = context;
                    if (record) {
                        DOMElements.modalTitle.textContent = 'Editar Registro'; DOMElements.recordIdInput.value = record.id; DOMElements.date.value = record.date; DOMElements.kmInitial.value = record.kmInitial; DOMElements.kmFinal.value = record.kmFinal; DOMElements.timeStart.value = record.timeStart || ''; DOMElements.timeEnd.value = record.timeEnd || '';
                        record.incomes.forEach(inc => modals.addDynamicEntry('income', inc)); record.expenses.forEach(exp => modals.addDynamicEntry('expense', exp));
                    } else {
                        DOMElements.modalTitle.textContent = 'Registrar Novo Dia'; DOMElements.recordIdInput.value = ''; DOMElements.date.value = new Date().toISOString().split('T')[0];
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
            addDynamicEntry: (type, entry = {}) => {
                const container = DOMElements[`${type}Entries`]; const entryDiv = document.createElement('div'); entryDiv.className = 'dynamic-entry';
                const select = document.createElement('select'); select.className = `${type}-category form-group`;
                state.categories[type].forEach(cat => { const option = document.createElement('option'); option.value = cat; option.textContent = cat; if (cat === entry.category) option.selected = true; select.appendChild(option); });
                const newOption = document.createElement('option'); newOption.value = 'new'; newOption.textContent = 'Adicionar nova...'; select.appendChild(newOption);
                const inputsWrapper = document.createElement('div'); inputsWrapper.className = 'dynamic-inputs form-group-inline';
                const removeBtn = document.createElement('button'); removeBtn.type = 'button'; removeBtn.className = 'remove-btn'; removeBtn.innerHTML = '&times;'; removeBtn.setAttribute('aria-label', 'Remover item'); removeBtn.onclick = () => entryDiv.remove();
                entryDiv.append(select, inputsWrapper, removeBtn);
                const updateInputs = (selectedCategory) => {
                    inputsWrapper.innerHTML = '';
                    if (type === 'expense' && selectedCategory === 'Combustível') {
                        inputsWrapper.innerHTML = `<div class="form-group"><input type="number" step="0.01" min="0" placeholder="Litros" class="liters" value="${entry.liters || ''}"></div><div class="form-group"><input type="number" step="0.01" min="0" placeholder="Preço/L" class="pricePerLiter" value="${entry.pricePerLiter || ''}"></div><div class="form-group"><span class="fuel-total"></span></div>`;
                        const litersInput = inputsWrapper.querySelector('.liters'), priceInput = inputsWrapper.querySelector('.pricePerLiter'), totalSpan = inputsWrapper.querySelector('.fuel-total');
                        const updateTotal = () => { const liters = parseFloat(litersInput.value) || 0, price = parseFloat(priceInput.value) || 0; totalSpan.textContent = `= ${logic.formatCurrency(liters * price)}`; };
                        litersInput.oninput = updateTotal; priceInput.oninput = updateTotal; updateTotal();
                    } else {
                        inputsWrapper.innerHTML = `<div class="form-group"><input type="number" step="0.01" min="0" placeholder="Valor (R$)" class="amount" value="${entry.amount || ''}"></div>`;
                    }
                };
                select.addEventListener('change', () => {
                    if (select.value === 'new') {
                        const newCategory = prompt(`Nome da nova categoria de ${type === 'income' ? 'ganho' : 'despesa'}:`);
                        if (newCategory && newCategory.trim() && !state.categories[type].includes(newCategory.trim())) {
                            const trimmedCategory = newCategory.trim();
                            state.categories[type].push(trimmedCategory); storage.saveAll();
                            const newOpt = document.createElement('option'); newOpt.value = trimmedCategory; newOpt.textContent = trimmedCategory;
                            select.insertBefore(newOpt, select.querySelector('option[value="new"]')); select.value = trimmedCategory;
                        } else { select.value = entry.category || state.categories[type][0]; }
                    }
                    entry = {}; updateInputs(select.value);
                });
                container.appendChild(entryDiv); updateInputs(entry.category || state.categories[type][0] || '');
            }
        };

        const backup = {
            exportData: () => {
                if (state.records.length === 0) { alert("Não há dados para exportar."); return; }
                try {
                    const dataStr = JSON.stringify({ records: state.records, categories: state.categories, settings: state.settings }, null, 2);
                    const blob = new Blob([dataStr], { type: 'application/json' });
                    const url = URL.createObjectURL(blob);
                    const a = document.createElement('a'); const today = new Date().toISOString().slice(0, 10);
                    a.href = url; a.download = `backup-motocash-${today}.json`;
                    document.body.appendChild(a); a.click(); document.body.removeChild(a); URL.revokeObjectURL(url);
                } catch (error) { console.error("Erro ao exportar dados:", error); alert("Ocorreu um erro ao gerar o arquivo de backup."); }
            },
            importData: e => {
                const file = e.target.files[0]; if (!file) return;
                const reader = new FileReader();
                reader.onload = (ev) => {
                    try {
                        const data = JSON.parse(ev.target.result);
                        if (data.records && data.categories && data.settings) {
                            if (confirm('Atenção: Isso substituirá todos os dados atuais. Deseja continuar?')) {
                                state.records = data.records; state.categories = data.categories; state.settings = data.settings;
                                storage.saveAll(); view.applyTheme(); render.all();
                                alert('Dados importados com sucesso!');
                            }
                        } else { alert('Erro: Arquivo de backup inválido.'); }
                    } catch (error) { console.error("Erro ao importar dados:", error); alert('Erro ao ler o arquivo de backup.'); }
                };
                reader.readAsText(file); e.target.value = '';
            }
        };
        
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
            handleSettingsClick: e => {
                const button = e.target.closest('button'); if (!button) return;
                const { tab, type, name, id } = button.dataset;
                if (tab) { document.querySelectorAll('.settings-tab, .settings-tab-content').forEach(el => el.classList.remove('active')); button.classList.add('active'); document.getElementById(`tab-${tab}`).classList.add('active'); }
                if (type && name) {
                    if (button.classList.contains('rename-cat-btn')) { const newName = prompt(`Novo nome para "${name}":`, name); if (newName && newName.trim() !== '' && newName !== name) { const index = state.categories[type].indexOf(name); if (index > -1) state.categories[type][index] = newName; state.records.forEach(rec => rec[type === 'income' ? 'incomes' : 'expenses'].forEach(entry => { if (entry.category === name) entry.category = newName; })); storage.saveAll(); render.all(); render.categoryManager(); }
                    } else if (button.classList.contains('delete-cat-btn')) { if (confirm(`Excluir a categoria "${name}"?`)) { state.categories[type] = state.categories[type].filter(cat => cat !== name); storage.saveAll(); render.categoryManager(); } }
                }
                if (button.classList.contains('delete-maintenance-btn')) { if (confirm('Excluir este lembrete?')) { state.settings.maintenancePlan = state.settings.maintenancePlan.filter(item => item.id !== parseInt(id)); storage.saveAll(); render.all(); modals.open(DOMElements.settingsModal, 'maintenance'); } }
                if (button.classList.contains('delete-fixed-expense-btn')) { if (confirm('Excluir esta despesa fixa?')) { state.settings.fixedExpenses = state.settings.fixedExpenses.filter(item => item.id !== parseInt(id)); storage.saveAll(); render.all(); modals.open(DOMElements.settingsModal, 'fixed-expenses'); } }
            },
            handleSettingsSave: () => { state.settings.monthlyGoal = parseFloat(DOMElements.monthlyGoal.value) || 0; storage.saveAll(); render.all(); },
            handleMaintenanceFormSubmit: e => {
                e.preventDefault();
                const name = DOMElements.maintenanceForm.querySelector('#maintenance-name').value; const lastKm = parseFloat(DOMElements.maintenanceForm.querySelector('#maintenance-last-km').value); const interval = parseFloat(DOMElements.maintenanceForm.querySelector('#maintenance-interval').value);
                if (name.trim() && !isNaN(lastKm) && interval > 0) {
                    state.settings.maintenancePlan.push({ id: Date.now(), name: name.trim(), lastKm, interval });
                    storage.saveAll(); DOMElements.maintenanceForm.reset(); render.all(); modals.open(DOMElements.settingsModal, 'maintenance');
                } else { alert('Preencha todos os campos do lembrete corretamente.'); }
            },
            switchView: viewId => {
                DOMElements.historyView.style.display = viewId === 'history' ? 'block' : 'none';
                DOMElements.reportsView.style.display = viewId === 'reports' ? 'block' : 'none';
                DOMElements.showHistoryBtn.classList.toggle('active', viewId === 'history');
                DOMElements.showReportsBtn.classList.toggle('active', viewId === 'reports');
                if(viewId === 'reports') render.reports();
            },
            handleThemeToggle: () => { state.settings.theme = document.body.classList.contains('theme-dark') ? 'theme-light' : 'theme-dark'; storage.saveAll(); view.applyTheme(); },
            handleFixedExpenseSubmit: e => {
                e.preventDefault();
                const name = DOMElements.fixedExpenseForm.querySelector('#fixed-expense-name').value;
                const amount = parseFloat(DOMElements.fixedExpenseForm.querySelector('#fixed-expense-amount').value);
                if (name.trim() && amount > 0) {
                    state.settings.fixedExpenses.push({ id: Date.now(), name: name.trim(), amount });
                    storage.saveAll(); DOMElements.fixedExpenseForm.reset(); render.all(); modals.open(DOMElements.settingsModal, 'fixed-expenses');
                } else { alert('Preencha a descrição e o valor da despesa.'); }
            },
            handlePdfExport: () => {
                const { jsPDF } = window.jspdf; if(!jsPDF || !jsPDF.API.autoTable) { alert("Erro ao carregar a biblioteca de PDF. Verifique a conexão com a internet."); return; }
                const doc = new jsPDF();
                const period = DOMElements.reportPeriodSelect.value;
                const periodText = DOMElements.reportPeriodSelect.options[DOMElements.reportPeriodSelect.selectedIndex].text;
                const recordsToExport = state.records.filter(r => period === 'all' || r.date.startsWith(period));
                if (recordsToExport.length === 0) { alert("Não há dados no período selecionado para exportar."); return; }
                doc.setFontSize(18); doc.text("Relatório Financeiro - MotoCash", 14, 22);
                doc.setFontSize(11); doc.text(`Período: ${periodText}`, 14, 30);
                const totals = recordsToExport.reduce((acc, rec) => { acc.gains += rec.totalIncome; acc.expenses += rec.totalExpense; return acc; }, {gains: 0, expenses: 0});
                doc.setFontSize(12); doc.text(`Total de Ganhos: ${logic.formatCurrency(totals.gains)}`, 14, 45);
                doc.text(`Total de Despesas: ${logic.formatCurrency(totals.expenses)}`, 14, 52);
                doc.setFontSize(14); doc.setFont(undefined, 'bold'); doc.text(`Lucro do Período: ${logic.formatCurrency(totals.gains - totals.expenses)}`, 14, 62); doc.setFont(undefined, 'normal');
                const tableColumn = ["Data", "Ganhos", "Despesas", "Lucro", "KM"];
                const tableRows = recordsToExport.sort((a,b) => new Date(a.date) - new Date(b.date)).map(rec => [ new Date(rec.date).toLocaleDateString('pt-BR', {timeZone: 'UTC'}), logic.formatCurrency(rec.totalIncome), logic.formatCurrency(rec.totalExpense), logic.formatCurrency(rec.totalIncome - rec.totalExpense), rec.kmFinal - rec.kmInitial ]);
                doc.autoTable({ head: [tableColumn], body: tableRows, startY: 70 });
                doc.save(`relatorio-motocash-${period}.pdf`);
            }
        };

        // --- FUNÇÕES DE INICIALIZAÇÃO ---
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
            DOMElements.reportPeriodSelect.addEventListener('change', render.reports);
            DOMElements.themeToggleBtn.addEventListener('click', handlers.handleThemeToggle);
            DOMElements.fixedExpenseForm.addEventListener('submit', handlers.handleFixedExpenseSubmit);
            DOMElements.exportPdfBtn.addEventListener('click', handlers.handlePdfExport);
        }
        
        function init() {
            cacheDOMElements();
            storage.loadState();
            view.applyTheme();
            bindEvents();
            render.all();
        }

        init();
    })();
});
