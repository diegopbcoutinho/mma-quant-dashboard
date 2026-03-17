/**
 * MMA Quant — Performance Analytics Engine
 * Computes all statistical insights from settled bets.
 * Runs once after data load; results stored in appState.analytics.
 */

// ─── COMPUTATION ──────────────────────────────────────────────────────────────

function computeAnalytics(bets) {
    // Work in chronological order
    const settled = [...bets]
        .filter(b => b.result === 'W' || b.result === 'L')
        .reverse();

    if (settled.length === 0) return null;

    // 1. ROI by odds range
    const buckets = [
        { label: '1.00 – 1.40', min: 1.00, max: 1.40 },
        { label: '1.41 – 1.80', min: 1.41, max: 1.80 },
        { label: '1.81 – 2.50', min: 1.81, max: 2.50 },
        { label: '2.51+',       min: 2.51, max: Infinity }
    ];

    const roiByOdds = buckets.map(b => {
        const items  = settled.filter(s => s.odds >= b.min && s.odds <= b.max);
        const wins   = items.filter(s => s.result === 'W').length;
        const stake  = items.reduce((acc, x) => acc + x.stakeUSD, 0);
        const profit = items.reduce((acc, x) => acc + x.plUSD,    0);
        return {
            label:      b.label,
            count:      items.length,
            wins,
            losses:     items.length - wins,
            winRate:    items.length > 0 ? (wins / items.length) * 100 : 0,
            totalProfit: profit,
            roi:        stake > 0 ? (profit / stake) * 100 : 0
        };
    });

    // 2. Profit by event
    const eventMap = {};
    settled.forEach(b => {
        const key = b.event || 'Unknown';
        if (!eventMap[key]) eventMap[key] = { bets: 0, wins: 0, profit: 0 };
        eventMap[key].bets++;
        if (b.result === 'W') eventMap[key].wins++;
        eventMap[key].profit += b.plUSD;
    });

    const profitByEvent = Object.entries(eventMap)
        .map(([event, d]) => ({
            event,
            bets:    d.bets,
            wins:    d.wins,
            winRate: (d.wins / d.bets) * 100,
            profit:  d.profit
        }))
        .sort((a, b) => b.profit - a.profit);

    // 3. Streaks (chronological → current = most recent)
    let longestWin = 0, longestLoss = 0, tmpW = 0, tmpL = 0;
    settled.forEach(b => {
        if (b.result === 'W') { tmpW++; tmpL = 0; longestWin  = Math.max(longestWin,  tmpW); }
        else                  { tmpL++; tmpW = 0; longestLoss = Math.max(longestLoss, tmpL); }
    });

    let curStreak = 0, curType = null;
    for (const b of [...settled].reverse()) { // most-recent first
        if (!curType)              { curType = b.result; curStreak = 1; }
        else if (b.result === curType) curStreak++;
        else break;
    }

    // 4. Max drawdown
    let peak = 0, maxDD = 0, maxDDPct = 0;
    settled.filter(b => b.bankrollAfter > 0).forEach(b => {
        if (b.bankrollAfter > peak) peak = b.bankrollAfter;
        const dd = peak - b.bankrollAfter;
        if (dd > maxDD) { maxDD = dd; maxDDPct = (dd / peak) * 100; }
    });

    // 5. Avg odds W vs L
    const winBets  = settled.filter(b => b.result === 'W');
    const lossBets = settled.filter(b => b.result === 'L');
    const avgOddsWin  = winBets.length  ? winBets.reduce( (s, b) => s + b.odds, 0) / winBets.length  : 0;
    const avgOddsLoss = lossBets.length ? lossBets.reduce((s, b) => s + b.odds, 0) / lossBets.length : 0;

    const bestRange = [...roiByOdds]
        .filter(b => b.count > 0)
        .sort((a, b) => b.roi - a.roi)[0] || null;

    return { roiByOdds, profitByEvent, streaks: { current: curStreak, currentType: curType, longestWin, longestLoss }, drawdown: { peak, maxDD, maxDDPct }, avgOdds: { win: avgOddsWin, loss: avgOddsLoss }, bestRange };
}

// ─── RENDER ───────────────────────────────────────────────────────────────────

let _roiChart = null;

function renderAnalytics(analytics) {
    if (!analytics) return;
    const panel = document.getElementById('analyticsPanel');
    if (!panel) return;

    requestAnimationFrame(() => {
        panel.style.transition = 'opacity 0.7s ease';
        panel.style.opacity    = '1';
    });

    _renderInsightCards(analytics);
    _renderRoiChart(analytics.roiByOdds);
    renderProfitTable(analytics.profitByEvent, false);
}

function _renderInsightCards({ streaks, drawdown, bestRange, avgOdds }) {
    const el = document.getElementById('analyticsInsights');
    if (!el) return;

    const cards = [
        {
            icon:  'fa-solid fa-trophy',
            color: 'var(--accent-gold)',
            label: 'Maior Série Win',
            value: streaks.longestWin,
            unit:  'seguidas',
            gold:  true,
            countup: true
        },
        {
            icon:  'fa-solid fa-skull',
            color: 'var(--accent-red)',
            label: 'Maior Série Loss',
            value: streaks.longestLoss,
            unit:  'seguidas',
            gold:  false,
            countup: true
        },
        {
            icon:  'fa-solid fa-arrow-trend-down',
            color: 'var(--accent-red)',
            label: 'Drawdown Máximo',
            value: drawdown.maxDDPct.toFixed(1) + '%',
            unit:  `$${drawdown.maxDD.toFixed(2)} a partir de $${drawdown.peak.toFixed(2)}`,
            gold:  false
        },
        {
            icon:  'fa-solid fa-bullseye',
            color: 'var(--accent-gold)',
            label: 'Melhor Faixa de Odds',
            value: bestRange ? bestRange.label : '--',
            unit:  bestRange ? `ROI ${bestRange.roi.toFixed(1)}% · ${bestRange.count} apostas` : '',
            gold:  true
        }
    ];

    el.innerHTML = cards.map((c, i) => `
        <div class="analytics-insight-card">
            <div class="aic-icon"><i class="${c.icon}" style="color:${c.color}"></i></div>
            <div class="aic-body">
                <div class="aic-label">${c.label}</div>
                <div class="aic-value ${c.gold ? 'text-gold' : 'text-red-soft'}"
                     ${c.countup ? `data-target="${c.value}"` : ''}>
                    ${c.countup ? '0' : c.value}
                </div>
                <div class="aic-unit">${c.unit}</div>
            </div>
        </div>
    `).join('');

    // Count-up animation for integer values
    el.querySelectorAll('[data-target]').forEach(el => {
        const target = parseInt(el.dataset.target, 10);
        const duration = 600;
        const start = performance.now();
        const tick = now => {
            const p = Math.min((now - start) / duration, 1);
            el.textContent = Math.round(p * target);
            if (p < 1) requestAnimationFrame(tick);
        };
        requestAnimationFrame(tick);
    });
}

function _renderRoiChart(roiByOdds) {
    const ctx = document.getElementById('roiByOddsChart');
    if (!ctx) return;
    if (_roiChart) _roiChart.destroy();

    const values  = roiByOdds.map(b => parseFloat(b.roi.toFixed(1)));
    const bgColors = values.map(v => v >= 0 ? 'rgba(212,175,55,0.80)' : 'rgba(230,57,70,0.80)');
    const borders  = values.map(v => v >= 0 ? '#D4AF37' : '#E63946');

    _roiChart = new Chart(ctx, {
        type: 'bar',
        data: {
            labels: roiByOdds.map(b => b.label),
            datasets: [{
                data: values,
                backgroundColor: bgColors,
                borderColor: borders,
                borderWidth: 1.5,
                borderRadius: 6,
                borderSkipped: false
            }]
        },
        options: {
            indexAxis: 'y',
            responsive: true,
            maintainAspectRatio: false,
            animation: { duration: 900, easing: 'easeOutQuart' },
            plugins: {
                legend: { display: false },
                tooltip: {
                    callbacks: {
                        title: ctx => ctx[0].label,
                        label: ctx => {
                            const b = roiByOdds[ctx.dataIndex];
                            return [
                                ` ROI: ${b.roi.toFixed(1)}%`,
                                ` ${b.wins}W / ${b.losses}L de ${b.count} apostas`,
                                ` Win Rate: ${b.winRate.toFixed(1)}%`
                            ];
                        }
                    },
                    backgroundColor: 'rgba(15,15,18,0.96)',
                    titleColor: '#fff',
                    bodyColor: '#aaa',
                    borderColor: 'rgba(212,175,55,0.25)',
                    borderWidth: 1,
                    padding: 12
                }
            },
            scales: {
                x: {
                    grid: { color: 'rgba(255,255,255,0.04)' },
                    ticks: { color: '#888891', callback: v => v + '%' }
                },
                y: {
                    grid: { display: false },
                    ticks: { color: '#bbb', font: { size: 12, family: 'Inter' } }
                }
            }
        }
    });
}

// Public — called by toggle button
function renderProfitTable(profitByEvent, showAll) {
    const wrap = document.getElementById('profitByEventWrap');
    if (!wrap) return;

    const data    = showAll ? profitByEvent : profitByEvent.slice(0, 5);
    const hasMore = profitByEvent.length > 5;

    const rows = data.map(e => {
        const cls  = e.profit >= 0 ? 'text-gold' : 'text-red';
        const sign = e.profit >= 0 ? '+' : '';
        return `<tr>
            <td class="evt-name" title="${e.event}">${e.event}</td>
            <td>${e.bets}</td>
            <td>${e.winRate.toFixed(0)}%</td>
            <td class="${cls}">${sign}$${e.profit.toFixed(2)}</td>
        </tr>`;
    }).join('');

    const btn = hasMore ? `
        <button class="view-all-btn" onclick="renderProfitTable(appState.analytics.profitByEvent, ${!showAll})">
            ${showAll ? '↑ Ver menos' : `↓ Ver todos (${profitByEvent.length})`}
        </button>` : '';

    wrap.innerHTML = `
        <div class="analytics-table-scroll">
            <table class="analytics-inner-table">
                <thead><tr>
                    <th>Evento</th><th>Apostas</th><th>Win%</th><th>Profit</th>
                </tr></thead>
                <tbody>${rows}</tbody>
            </table>
        </div>
        ${btn}
    `;
}
