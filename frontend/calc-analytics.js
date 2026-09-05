/**
 * CalcAnalytics — Calculation Speed Analytics Dashboard
 * Tracks per-topic speed, accuracy, fast%, slow% for all calculation drills.
 */
const CalcAnalytics = (() => {

    /* ── Topic metadata ─────────────────────────────────────────────────────── */
    const TOPICS = [
        { key: 'addition',          label: 'Addition',         icon: 'ph-plus',           color: '#3b82f6', target: 12 },
        { key: 'subtraction',       label: 'Subtraction',      icon: 'ph-minus',          color: '#ef4444', target: 12 },
        { key: 'multiplication',    label: 'Multiplication',   icon: 'ph-x',              color: '#8b5cf6', target: 18 },
        { key: 'division',          label: 'Division',         icon: 'ph-divide',         color: '#f97316', target: 20 },
        { key: 'square',            label: 'Squares',          icon: 'ph-square',         color: '#10b981', target: 8  },
        { key: 'cube',              label: 'Cubes',            icon: 'ph-cube',           color: '#14b8a6', target: 10 },
        { key: 'squareRoot',        label: 'Square Roots',     icon: 'ph-radical',        color: '#06b6d4', target: 10 },
        { key: 'tables',            label: 'Tables',           icon: 'ph-grid-nine',      color: '#6366f1', target: 6  },
        { key: 'percentToFraction', label: '% → Fraction',    icon: 'ph-percent',        color: '#ec4899', target: 8  },
        { key: 'fractionToPercent', label: 'Fraction → %',    icon: 'ph-arrows-left-right', color: '#f59e0b', target: 8 },
        { key: 'random',            label: 'Mixed',            icon: 'ph-shuffle',        color: '#64748b', target: 15 },
    ];

    /* ── Keyword → topic key detector ─────────────────────────────────────── */
    function detectTopicFromQuestion(q = '') {
        const t = q.toLowerCase();
        if (t.includes('convert') && t.includes('%') && t.includes('fraction')) return 'percentToFraction';
        if (t.includes('convert') && t.includes('/') && t.includes('percentage')) return 'fractionToPercent';
        if (t.includes('²') || t.includes('^2') || (t.includes('square of') && !t.includes('root'))) return 'square';
        if (t.includes('³') || t.includes('^3') || t.includes('cube of')) return 'cube';
        if (t.includes('√') || t.includes('square root')) return 'squareRoot';
        if (t.includes('×') && !t.includes('+') && !t.includes('-')) return 'multiplication';
        if (t.includes('÷') || t.includes('/')) return 'division';
        if (t.includes('+') && !t.includes('-')) return 'addition';
        if (t.includes('-') && !t.includes('+')) return 'subtraction';
        if (t.includes('×')) return 'tables';
        return null;
    }

    /* ── Aggregate stats by topic ──────────────────────────────────────────── */
    function buildTopicStats(tests) {
        const stats = {};
        TOPICS.forEach(t => {
            stats[t.key] = { sessions: 0, totalQ: 0, correct: 0, totalTime: 0, fast: 0, slow: 0 };
        });

        tests.forEach(test => {
            // Determine topic from stored field or detect from first question
            let topicKey = test.topic ? test.topic.toLowerCase().replace(/\s/g,'') : null;
            // Try mapping stored topic name to our key
            if (topicKey) {
                const found = TOPICS.find(t =>
                    t.key.toLowerCase() === topicKey ||
                    t.label.toLowerCase().replace(/\s/g,'') === topicKey ||
                    t.label.toLowerCase() === test.topic?.toLowerCase()
                );
                topicKey = found ? found.key : null;
            }

            const questions = test.questions || [];
            if (!topicKey && questions.length) {
                topicKey = detectTopicFromQuestion(questions[0]?.question || '');
            }
            if (!topicKey) topicKey = 'random';

            const bucket = stats[topicKey] || stats['random'];
            bucket.sessions++;

            const topicMeta = TOPICS.find(t => t.key === topicKey) || TOPICS.find(t => t.key === 'random');
            const target = topicMeta.target;

            questions.forEach(q => {
                bucket.totalQ++;
                if (q.result === 'correct' || q.isCorrect) bucket.correct++;
                const spent = q.timeSpentSeconds || 0;
                bucket.totalTime += spent;
                if (spent > 0 && spent <= target) bucket.fast++;
                else if (spent > target * 1.5) bucket.slow++;
            });
        });

        return stats;
    }

    /* ── SVG speedometer (conic-gradient ring) ─────────────────────────────── */
    function buildSpeedometer(avgSpeed, targetSpeed, color) {
        // ratio: 0 = instant (100% fast), 1 = on target, >1 = slow
        const ratio = targetSpeed > 0 ? Math.min(avgSpeed / targetSpeed, 2) : 0;
        // Fill percent: 100% when ratio=0, 0% when ratio=2
        const fillPct = Math.max(0, Math.round((1 - ratio / 2) * 100));
        const ringColor = fillPct >= 70 ? '#10b981' : fillPct >= 40 ? '#f59e0b' : '#ef4444';
        const deg = Math.round(fillPct * 3.6); // 360 * pct/100

        return `
        <div class="speedometer-wrap" title="Avg: ${avgSpeed}s | Target: ≤${targetSpeed}s">
            <div class="speedometer-ring" style="background: conic-gradient(${ringColor} 0deg ${deg}deg, var(--bg-subtle) ${deg}deg 360deg);">
                <div class="speedometer-inner">
                    <span class="speedometer-val">${avgSpeed}s</span>
                    <span class="speedometer-label">avg</span>
                </div>
            </div>
            <div class="speedometer-target">Target ≤${targetSpeed}s</div>
        </div>`;
    }

    /* ── Render full dashboard ─────────────────────────────────────────────── */
    function render(tests, topicStats) {
        const el = id => document.getElementById(id);

        /* Overall KPIs */
        const totalSessions = tests.length;
        const totalQ = Object.values(topicStats).reduce((a, b) => a + b.totalQ, 0);
        const totalCorrect = Object.values(topicStats).reduce((a, b) => a + b.correct, 0);
        const totalTime = Object.values(topicStats).reduce((a, b) => a + b.totalTime, 0);
        const overallAcc = totalQ ? Math.round(totalCorrect / totalQ * 100) : 0;
        const overallAvgSpeed = totalQ ? Math.round(totalTime / totalQ) : 0;
        const totalFast = Object.values(topicStats).reduce((a, b) => a + b.fast, 0);
        const totalSlow = Object.values(topicStats).reduce((a, b) => a + b.slow, 0);

        el('ca-total-sessions').textContent = totalSessions;
        el('ca-total-questions').textContent = totalQ;
        el('ca-overall-acc').textContent = `${overallAcc}%`;
        el('ca-avg-speed').textContent = `${overallAvgSpeed}s`;
        el('ca-fast-count').textContent = totalFast;
        el('ca-slow-count').textContent = totalSlow;

        /* Topic grid */
        const grid = el('ca-topic-grid');
        grid.innerHTML = '';

        TOPICS.forEach(topic => {
            const s = topicStats[topic.key];
            if (!s || s.totalQ === 0) return; // skip topics with no data

            const acc = s.totalQ ? Math.round(s.correct / s.totalQ * 100) : 0;
            const avgSpeed = s.totalQ ? Math.round(s.totalTime / s.totalQ) : 0;
            const fastPct = s.totalQ ? Math.round(s.fast / s.totalQ * 100) : 0;
            const slowPct = s.totalQ ? Math.round(s.slow / s.totalQ * 100) : 0;
            const accClass = acc >= 80 ? 'status-good' : acc >= 50 ? 'status-mid' : 'status-bad';

            const card = document.createElement('div');
            card.className = 'ca-topic-card';
            card.innerHTML = `
                <div class="ca-topic-header">
                    <div class="ca-topic-icon" style="background: ${topic.color}22; color: ${topic.color}">
                        <i class="ph-bold ${topic.icon}"></i>
                    </div>
                    <div class="ca-topic-meta">
                        <div class="ca-topic-name">${topic.label}</div>
                        <div class="ca-topic-sub">${s.sessions} session${s.sessions !== 1 ? 's' : ''} · ${s.totalQ} questions</div>
                    </div>
                    <span class="topic-acc-badge ${accClass}">${acc}%</span>
                </div>
                <div class="ca-topic-speedo-row">
                    ${buildSpeedometer(avgSpeed, topic.target, topic.color)}
                    <div class="ca-topic-bars">
                        <div class="ca-bar-row">
                            <span class="ca-bar-label text-green">⚡ Fast</span>
                            <div class="ca-bar-track">
                                <div class="ca-bar-fill" style="width:${fastPct}%; background:#10b981;"></div>
                            </div>
                            <span class="ca-bar-pct">${fastPct}%</span>
                        </div>
                        <div class="ca-bar-row">
                            <span class="ca-bar-label text-orange">🐢 Slow</span>
                            <div class="ca-bar-track">
                                <div class="ca-bar-fill" style="width:${slowPct}%; background:#f97316;"></div>
                            </div>
                            <span class="ca-bar-pct">${slowPct}%</span>
                        </div>
                        <div class="ca-bar-row">
                            <span class="ca-bar-label text-blue">✅ Accuracy</span>
                            <div class="ca-bar-track">
                                <div class="ca-bar-fill" style="width:${acc}%; background:#3b82f6;"></div>
                            </div>
                            <span class="ca-bar-pct">${acc}%</span>
                        </div>
                    </div>
                </div>
                <button class="ca-practice-btn" onclick="selectOperation('${topic.key}')">
                    <i class="ph-bold ph-play"></i> Practice Now
                </button>
            `;
            grid.appendChild(card);
        });

        /* Empty state */
        const emptyEl = el('ca-empty');
        const contentEl = el('ca-content');
        if (totalQ === 0) {
            emptyEl.style.display = 'flex';
            contentEl.style.display = 'none';
        } else {
            emptyEl.style.display = 'none';
            contentEl.style.display = 'block';
        }

        /* Slowest topics leaderboard */
        const slowList = el('ca-slow-list');
        slowList.innerHTML = '';

        const ranked = TOPICS
            .filter(t => topicStats[t.key]?.totalQ > 0)
            .map(t => {
                const s = topicStats[t.key];
                const avg = s.totalQ ? Math.round(s.totalTime / s.totalQ) : 0;
                return { ...t, avg, target: t.target, totalQ: s.totalQ };
            })
            .filter(t => t.avg > 0)
            .sort((a, b) => (b.avg - b.target) - (a.avg - a.target));

        ranked.slice(0, 5).forEach((t, i) => {
            const overTarget = Math.max(0, t.avg - t.target);
            const badge = overTarget === 0
                ? `<span class="slow-badge good">On Target ✓</span>`
                : `<span class="slow-badge bad">+${overTarget}s over</span>`;
            const li = document.createElement('div');
            li.className = 'ca-slow-item';
            li.innerHTML = `
                <div class="ca-slow-rank">#${i + 1}</div>
                <div class="ca-slow-icon" style="background:${t.color}22; color:${t.color}">
                    <i class="ph-bold ${t.icon}"></i>
                </div>
                <div class="ca-slow-meta">
                    <div class="ca-slow-name">${t.label}</div>
                    <div class="ca-slow-sub">Avg: ${t.avg}s | Target: ≤${t.target}s</div>
                </div>
                ${badge}
                <button class="ca-drill-now-btn" onclick="selectOperation('${t.key}')">
                    Drill Now <i class="ph-bold ph-arrow-right"></i>
                </button>
            `;
            slowList.appendChild(li);
        });
    }

    /* ── Public API ───────────────────────────────────────────────────────── */
    async function open() {
        QuizEngine.showScreen(document.getElementById('calc-analytics-screen'));
        ProgressDashboard.updateNavActive('calc-analytics');

        const loadEl = document.getElementById('ca-loading');
        const contentEl = document.getElementById('ca-content');
        const emptyEl = document.getElementById('ca-empty');
        if (loadEl) loadEl.style.display = 'flex';
        if (contentEl) contentEl.style.display = 'none';
        if (emptyEl) emptyEl.style.display = 'none';

        let tests = [];
        try {
            tests = await ProgressStore.getTests();
        } catch (e) {
            console.warn('[CalcAnalytics] Could not fetch tests', e);
        }

        const topicStats = buildTopicStats(tests);
        render(tests, topicStats);
        if (loadEl) loadEl.style.display = 'none';
    }

    return { open };
})();
