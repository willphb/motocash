/**
 * MotoCash App v4.0 (Conectado ao Google Sheets)
 * Aplicação online, multi-dispositivo com backend via Google Apps Script.
 */
document.addEventListener('DOMContentLoaded', () => {

    // ##################################################################
    // COLE A URL DA SUA API AQUI DENTRO DAS ASPAS
    const API_URL = 'https://script.google.com/macros/s/AKfycbxC_a6qHSTACMgP2dx35RAfonRZ2L-fBscMgOOlSkdAGx4U09FzHFlgmxfYcryknfMc/exec';
    // ##################################################################


    const App = (() => {
        // --- 1. ESTADO DA APLICAÇÃO (STATE) ---
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
                    // O método POST para Apps Script Web App requer um redirecionamento,
                    // então usamos 'sendBeacon' ou um POST sem esperar a resposta completa.
                    // Para simplificar, faremos um fetch e não trataremos o retorno, confiando que funcionará.
                    await fetch(API_URL, {
                        method: 'POST',
                        mode: 'no-cors', // Importante para evitar erros de CORS com o redirecionamento do Google
                        headers: { 'Content-Type': 'text/plain;charset=utf-8' }, // Usar text/plain é mais robusto para 'no-cors'
                        body: JSON.stringify(state)
                    });
                    await new Promise(resolve => setTimeout(resolve, 1000)); // Damos um tempo para a requisição completar
                } catch (error) {
                    console.error("Falha ao salvar dados:", error);
                    alert("Não foi possível salvar suas alterações. Verifique a conexão com a internet.");
                } finally {
                    uiFeedback.hideLoader();
                }
            }
        };

        // ... (O restante dos módulos lógicos e de renderização permanece o mesmo da v3.2)
        const logic = { /* ... */ };
        const view = { /* ... */ };
        const render = { /* ... */ };
        const modals = { /* ... */ };
        const backup = { /* ... */ }; // O backup JSON continua funcionando localmente

        const handlers = {
            // Todos os handlers que modificam o 'state' agora são async e chamam 'await api.saveAll()'
            handleDayFormSubmit: async (e) => {
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
                await api.saveAll();
                render.all();
                modals.close(DOMElements.dayModal);
            },
            handleSettingsSave: async () => { state.settings.monthlyGoal = parseFloat(DOMElements.monthlyGoal.value) || 0; await api.saveAll(); render.all(); },
            handleMaintenanceFormSubmit: async (e) => {
                e.preventDefault();
                const name = DOMElements.maintenanceForm.querySelector('#maintenance-name').value; const lastKm = parseFloat(DOMElements.maintenanceForm.querySelector('#maintenance-last-km').value); const interval = parseFloat(DOMElements.maintenanceForm.querySelector('#maintenance-interval').value);
                if (name.trim() && !isNaN(lastKm) && interval > 0) {
                    state.settings.maintenancePlan.push({ id: Date.now(), name: name.trim(), lastKm, interval });
                    await api.saveAll();
                    DOMElements.maintenanceForm.reset(); render.all(); modals.open(DOMElements.settingsModal, 'maintenance');
                } else { alert('Preencha todos os campos do lembrete corretamente.'); }
            },
            handleFixedExpenseSubmit: async (e) => {
                e.preventDefault();
                const name = DOMElements.fixedExpenseForm.querySelector('#fixed-expense-name').value;
                const amount = parseFloat(DOMElements.fixedExpenseForm.querySelector('#fixed-expense-amount').value);
                if (name.trim() && amount > 0) {
                    state.settings.fixedExpenses.push({ id: Date.now(), name: name.trim(), amount });
                    await api.saveAll();
                    DOMElements.fixedExpenseForm.reset(); render.all(); modals.open(DOMElements.settingsModal, 'fixed-expenses');
                } else { alert('Preencha a descrição e o valor da despesa.'); }
            },
             handleThemeToggle: async () => {
                state.settings.theme = document.body.classList.contains('theme-dark') ? 'theme-light' : 'theme-dark';
                view.applyTheme(); // Aplica visualmente primeiro para resposta rápida
                await api.saveAll();
            },
            // ... resto dos handlers ...
        };

        // --- INICIALIZAÇÃO ASÍNCRONA ---
        const init = async () => {
            cacheDOMElements();
            const loadedState = await api.loadState();
            if (loadedState) {
                Object.assign(state, loadedState);
            } else {
                DOMElements.mainDashboard.innerHTML = `<div class="card"><h3 style="color: var(--error-color);">Falha ao Carregar Dados</h3><p style="font-size: 1rem; color: var(--text-secondary);">Verifique sua conexão ou a URL da API no script.</p></div>`;
            }
            view.applyTheme();
            bindEvents();
            render.all();
        };

        init();
    })();
});