/**
 * UFC Quant Strategy Tracker — Engine Principal
 * Integração via Google Visualization (GViz) API, sem CORS.
 */

// Estado global
let appState = {
    globals: { bancaInicial: 0, targetUnits: 0, unitSize: 0, dolarHoje: 0 },
    bets: [],
    chartInstance: null,
    currentTab: 'finished'
};

// ID do seu Google Sheet (nunca muda)
const SHEET_ID = '14OKOxc2bh9B-EL6gVZYTo82WGz5tdU-n-MetnKCedRI';

// ─── INICIALIZAÇÃO ────────────────────────────────────────────────────────────
document.addEventListener('DOMContentLoaded', () => {
    fetchSheetData();
    fetchDolar();
    document.getElementById('searchFight').addEventListener('input', e => renderTable(e.target.value));

    // Configura os botões de abas
    document.querySelectorAll('.tab-btn').forEach(btn => {
        btn.addEventListener('click', (e) => {
            document.querySelectorAll('.tab-btn').forEach(b => b.classList.remove('active'));
            e.target.classList.add('active');
            appState.currentTab = e.target.dataset.tab;
            renderTable(document.getElementById('searchFight').value);
        });
    });
});

// ─── COTAÇÃO DO DÓLAR ─────────────────────────────────────────────────────────
function fetchDolar() {
    fetch('https://economia.awesomeapi.com.br/json/last/USD-BRL')
        .then(r => r.json())
        .then(data => {
            const rate = parseFloat(data.USDBRL.bid);
            if (rate > 0) {
                appState.globals.dolarHoje = rate;
                document.getElementById('val-dolar-hoje').innerText = 'R$ ' + rate.toFixed(2);
            }
        })
        .catch(() => {
            document.getElementById('val-dolar-hoje').innerText = 'R$ --';
        });
}

// ─── BUSCA DE DADOS ───────────────────────────────────────────────────────────
/**
 * Injeta um <script> que chama a GViz API. O Google retorna:
 * google.visualization.Query.setResponse({...dados...})
 * Por isso registramos esse namespace antes de injetar o script.
 */
function fetchSheetData() {
    // Prepara o namespace que o Google vai chamar
    window.google = window.google || {};
    window.google.visualization = window.google.visualization || {};
    window.google.visualization.Query = window.google.visualization.Query || {};
    window.google.visualization.Query.setResponse = function (data) {
        if (!data || data.status !== 'ok' || !data.table) {
            showTableError('Erro ao ler a planilha. Verifique o compartilhamento.');
            return;
        }
        processData(data.table);
    };

    // Injeta o script JSONP com cache-busting para sempre buscar dados frescos
    const url = `https://docs.google.com/spreadsheets/d/${SHEET_ID}/gviz/tq?tqx=out:json&gid=0&t=${Date.now()}`;
    const s = document.createElement('script');
    s.src = url;
    s.onerror = () => showTableError('Erro de conexão com o Google Sheets.');
    document.head.appendChild(s);
}

// ─── PROCESSAMENTO ────────────────────────────────────────────────────────────
/**
 * Estrutura real da planilha (validada via API):
 * 
 * Linha 0: [null, "Banca Inicial", "500", null, "Dolar Hoje", 5.1311, ...]
 * Linha 1: [null, "Target Units", "1,5", ...]
 * Linha 2: [null, "Unit Size", "0,01", ...]
 * Linha 3: [null, "Event", "Fight", "Fighter", "Opponent", null(Odds header), ...]
 * Linha 4+: dados das apostas
 *
 * Colunas de dados (0-indexado):
 *   0=Date, 1=Event, 2=Fight, 3=Fighter, 4=Opponent
 *   5=Odds, 6=Unit_Size, 7=Target_Units_Per_Bet, 8=Calculated_Stake_Units
 *   9=Calculated_Stake_USD, 10=Stake_BRL, 11=Result (W/L/null)
 *   12=Profit_Loss_Units, 13=Profit_Loss_USD, 14=Bankroll_Before
 *   15=Bankroll_After, 16=Cumulative_ROI
 */
function processData(table) {
    const rows = table.rows;
    const val = (row, col) => {
        if (!row.c || !row.c[col]) return null;
        return row.c[col].v;
    };
    const formatted = (row, col) => {
        if (!row.c || !row.c[col]) return null;
        return row.c[col].f || row.c[col].v;
    };
    const asFloat = v => {
        if (typeof v === 'number') return v;
        if (!v) return 0;
        return parseFloat(String(v).replace(/\./g, '').replace(',', '.')) || 0;
    };

    // Valores fixos de configuração (hardcoded — não mudam com frequência)
    appState.globals.bancaInicial = 500;
    appState.globals.targetUnits = 1.5;
    appState.globals.unitSize = 0.01;


    // Apostas começam na linha 4 (índice 4), pois linha 3 é cabeçalho
    appState.bets = [];
    for (let i = 4; i < rows.length; i++) {
        const r = rows[i];

        // A data vem como string tipo "Date(2026,1,27)" — usamos o valor formatado
        const dateRaw = val(r, 0);        // ex: "Date(2026,1,27)"
        const eventVal = val(r, 1);
        const fight = val(r, 2);
        const oddsVal = val(r, 5);

        // Se a linha estiver totalmente vazia nos campos principais, ignora
        if (!dateRaw && !eventVal && !fight && !oddsVal) continue;

        const dateFormatted = formatted(r, 0) || '';  // ex: "27/02/2026"

        const result = String(val(r, 11) || '').trim().toUpperCase();

        appState.bets.push({
            date: dateFormatted,
            event: val(r, 1) || '',
            fight: fight,
            fighter: val(r, 3) || '',
            opponent: val(r, 4) || '',
            odds: asFloat(val(r, 5)),
            stakeUSD: asFloat(val(r, 9)),
            stakeBRL: asFloat(val(r, 10)),
            result: result,           // 'W', 'L' ou ''
            plUSD: asFloat(val(r, 13)),
            bankrollBefore: asFloat(val(r, 14)),
            bankrollAfter: asFloat(val(r, 15)),
            roi: asFloat(val(r, 16)) * 100
        });
    }

    // Mais recente primeiro na tabela
    appState.bets.reverse();

    updateUI();
}

// ─── ATUALIZAÇÃO DE UI ────────────────────────────────────────────────────────
function updateUI() {
    // Header controls
    document.getElementById('val-banca-inicial').innerText = '$' + appState.globals.bancaInicial.toFixed(2);
    document.getElementById('val-target-units').innerText = appState.globals.targetUnits.toFixed(2);
    document.getElementById('val-unit-size').innerText = (appState.globals.unitSize * 100).toFixed(1) + '%';
    // Dólar é atualizado por fetchDolar() — só mostra placeholder se ainda não chegou
    if (!appState.globals.dolarHoje) document.getElementById('val-dolar-hoje').innerText = 'R$ ...';

    // KPIs
    const settled = appState.bets.filter(b => b.result === 'W' || b.result === 'L');
    const wins = settled.filter(b => b.result === 'W').length;
    const losses = settled.filter(b => b.result === 'L').length;

    // Bankroll mais recente = primeiro item SETTLED que tem bankrollAfter definido
    const latestWithBankroll = settled.find(b => b.bankrollAfter > 0);
    const currentBankroll = latestWithBankroll ? latestWithBankroll.bankrollAfter : appState.globals.bancaInicial;
    const totalPL = currentBankroll - appState.globals.bancaInicial;
    const roi = appState.globals.bancaInicial > 0 ? (totalPL / appState.globals.bancaInicial) * 100 : 0;
    const winRate = settled.length > 0 ? (wins / settled.length) * 100 : 0;

    document.getElementById('kpi-bankroll-usd').innerText = fmt(currentBankroll);

    const roiEl = document.getElementById('kpi-roi');
    roiEl.innerText = roi.toFixed(2) + '%';
    roiEl.className = roi >= 0 ? 'kpi-value text-gold' : 'kpi-value text-red';

    const plEl = document.getElementById('kpi-profit-usd');
    plEl.innerText = (totalPL > 0 ? '+' : '') + fmt(totalPL);
    plEl.className = totalPL >= 0 ? 'kpi-value text-gold' : 'kpi-value text-red';

    document.getElementById('kpi-winrate').innerText = winRate.toFixed(1) + '%';

    // Atualiza subtítulo do Win Rate com contagem
    document.getElementById('kpi-roi-subtitle').innerText = `${wins}W — ${losses}L de ${settled.length} apostas`;

    renderTable();
    renderChart();
}

// ─── TABELA ───────────────────────────────────────────────────────────────────
function renderTable(filter = '') {
    const tbody = document.getElementById('betsTableBody');
    tbody.innerHTML = '';

    let tabFiltered = appState.bets.filter(b => {
        // Coluna L (result) define o estado da aposta:
        //   'W' ou 'L'  → finalizada (Últimas Apostas)
        //   '-'          → aposta feita, aguardando resultado (Apostas Futuras)
        //   ''           → ainda não apostada (Apostas a Fazer)
        const isFinished = b.result === 'W' || b.result === 'L';
        const isFuture   = b.result === '-';
        const isTodo     = b.result === '';

        if (appState.currentTab === 'finished') return isFinished;
        if (appState.currentTab === 'future')   return isFuture;
        if (appState.currentTab === 'todo')     return isTodo;
        return true;
    });

    const filtered = filter
        ? tabFiltered.filter(b =>
            b.fight.toLowerCase().includes(filter.toLowerCase()) ||
            b.event.toLowerCase().includes(filter.toLowerCase()))
        : tabFiltered;

    const theadRow = document.querySelector('#betsTable thead tr');
    if (theadRow) {
        if (appState.currentTab === 'finished') {
            theadRow.innerHTML = `
                <th>Data</th>
                <th>Evento</th>
                <th>Luta</th>
                <th>Odds</th>
                <th>Risk (USD)</th>
                <th>Risk (BRL)</th>
                <th>Resultado</th>
                <th>P/L (USD)</th>
                <th>Bankroll</th>
            `;
        } else {
            theadRow.innerHTML = `
                <th>Data</th>
                <th>Evento</th>
                <th>Luta</th>
                <th>Odds</th>
                <th>Risk (USD)</th>
                <th>Risk (BRL)</th>
                <th>Resultado</th>
            `;
        }
    }

    // Resumo de apostas futuras
    const summaryEl = document.getElementById('future-summary');
    if (appState.currentTab === 'future') {
        const totalStake = tabFiltered.reduce((s, b) => s + b.stakeUSD, 0);
        const totalProfit = tabFiltered.reduce((s, b) => s + b.stakeUSD * (b.odds - 1), 0);
        document.getElementById('fut-total-stake').innerText = fmt(totalStake);
        document.getElementById('fut-total-profit').innerText = '+' + fmt(totalProfit);
        document.getElementById('fut-count').innerText = tabFiltered.length;
        summaryEl.style.display = 'flex';
    } else {
        summaryEl.style.display = 'none';
    }

    if (filtered.length === 0) {
        tbody.innerHTML = `<tr><td colspan="9" style="text-align:center;color:var(--text-muted)">Nenhuma aposta encontrada para esta aba.</td></tr>`;
        return;
    }

    filtered.forEach(b => {
        let badge = `<span class="result-badge badge-pending">PENDENTE</span>`;
        if (appState.currentTab === 'todo') {
            badge = `<span class="result-badge badge-pending" style="opacity:0.6">A FAZER</span>`;
        }

        let plClass = '';
        let plText = b.plUSD ? fmt(b.plUSD) : '--';
        let oddsDisplay = b.odds > 0 ? b.odds.toFixed(3) : '--';

        if (b.result === 'W') {
            badge = `<span class="result-badge badge-win">WIN</span>`;
            plClass = 'text-gold';
            plText = '+' + fmt(b.plUSD);
        } else if (b.result === 'L') {
            badge = `<span class="result-badge badge-loss">LOSS</span>`;
            plClass = 'text-red';
            plText = fmt(b.plUSD);
        }

        let trHtml = `
            <td>${b.date || '--'}</td>
            <td style="color:var(--text-muted);max-width:180px;overflow:hidden;text-overflow:ellipsis;white-space:nowrap">${b.event || '--'}</td>
            <td class="fighter-name">${b.fight || '--'}</td>
            <td>${oddsDisplay}</td>
            <td>${fmt(b.stakeUSD)}</td>
            <td>R$ ${b.stakeBRL.toFixed(2)}</td>
            <td>${badge}</td>
        `;

        if (appState.currentTab === 'finished') {
            trHtml += `
                <td class="${plClass}">${plText}</td>
                <td>${b.bankrollAfter ? fmt(b.bankrollAfter) : '--'}</td>
            `;
        }

        const tr = document.createElement('tr');
        tr.innerHTML = trHtml;
        tbody.appendChild(tr);
    });
}

// ─── GRÁFICO ──────────────────────────────────────────────────────────────────
function renderChart() {
    const settled = [...appState.bets]
        .filter(b => b.result === 'W' || b.result === 'L')
        .reverse(); // volta à ordem cronológica

    if (settled.length === 0) return;

    const labels = settled.map(b => b.date);
    const data = settled.map(b => b.bankrollAfter);

    if (appState.chartInstance) appState.chartInstance.destroy();

    const ctx = document.getElementById('bankrollChart').getContext('2d');
    appState.chartInstance = new Chart(ctx, {
        type: 'line',
        data: {
            labels,
            datasets: [{
                label: 'Bankroll (USD)',
                data,
                borderColor: '#D4AF37',
                backgroundColor: 'rgba(212,175,55,0.08)',
                borderWidth: 2.5,
                pointBackgroundColor: data.map((_, i) =>
                    settled[i].result === 'W' ? '#D4AF37' : '#E63946'),
                pointBorderColor: 'transparent',
                pointRadius: 4,
                pointHoverRadius: 7,
                fill: true,
                tension: 0.35
            }]
        },
        options: {
            responsive: true,
            maintainAspectRatio: false,
            plugins: {
                legend: { display: false },
                tooltip: {
                    callbacks: {
                        label: ctx => ` Bankroll: ${fmt(ctx.parsed.y)}`,
                        afterLabel: ctx => {
                            const b = settled[ctx.dataIndex];
                            return ` ${b.fight} — ${b.result === 'W' ? '✅ WIN' : '❌ LOSS'}`;
                        }
                    },
                    backgroundColor: 'rgba(15,15,18,0.95)',
                    titleColor: '#aaa',
                    bodyColor: '#D4AF37',
                    borderColor: 'rgba(212,175,55,0.3)',
                    borderWidth: 1,
                    padding: 12
                }
            },
            scales: {
                y: {
                    grid: { color: 'rgba(255,255,255,0.04)' },
                    ticks: { color: '#888891', callback: v => '$' + v.toFixed(0) }
                },
                x: {
                    grid: { display: false },
                    ticks: { display: false }
                }
            }
        }
    });
}

// ─── HELPERS ──────────────────────────────────────────────────────────────────
const fmt = (v, cur = 'USD') => new Intl.NumberFormat('en-US', { style: 'currency', currency: cur }).format(v || 0);

function showTableError(msg) {
    document.getElementById('betsTableBody').innerHTML =
        `<tr><td colspan="9" class="loading-cell" style="color:var(--accent-red)">${msg}</td></tr>`;
}
