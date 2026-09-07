const ProgressDashboard = (() => {
    const byId = (id) => document.getElementById(id);
    const escapeHtml = (text) => String(text ?? '').replace(/[&<>'"]/g, c => ({ '&':'&amp;','<':'&lt;','>':'&gt;',"'":'&#39;','"':'&quot;' }[c]));
    const formatDate = (date) => new Intl.DateTimeFormat('en-IN', { day:'numeric', month:'short', year:'numeric', hour:'2-digit', minute:'2-digit' }).format(new Date(date));
    const formatTime = (seconds) => `${Math.floor(seconds / 60)}m ${seconds % 60}s`;

    function updateNavActive(activeTab) {
        document.querySelectorAll('.app-nav-link, .mobile-nav-link').forEach(link => {
            if (link.dataset.tab === activeTab) {
                link.classList.add('active');
            } else {
                link.classList.remove('active');
            }
        });
    }

    async function open() {
        updateNavActive('analytics');
        QuizEngine.showScreen(byId('dashboard-screen'));
        await renderDashboard();
    }

    async function openNotebook() {
        updateNavActive('notebook');
        QuizEngine.showScreen(byId('notebook-screen'));
        const select = byId('notebook-topic');
        const current = select.value || 'all';
        renderNotebook();
        ProgressStore.getTopics().then(topics => {
            select.innerHTML = '<option value="all">All topics</option>' + topics.map(t => `<option value="${escapeHtml(t)}">${escapeHtml(t)}</option>`).join('');
            select.value = [...select.options].some(x => x.value === current) ? current : 'all';
        }).catch(() => {});
    }

    async function renderDashboard() {
        const tests = await ProgressStore.getTests();
        byId('dashboard-empty').style.display = tests.length ? 'none' : 'block';
        byId('dashboard-content').style.display = tests.length ? 'block' : 'none';
        if (!tests.length) return;

        const totals = tests.reduce((a, t) => ({ 
            tests: a.tests + 1, 
            correct: a.correct + t.correctCount, 
            wrong: a.wrong + t.wrongCount, 
            skipped: a.skipped + t.skippedCount, 
            total: a.total + t.total,
            duration: a.duration + (t.durationSeconds || 0)
        }), { tests:0, correct:0, wrong:0, skipped:0, total:0, duration:0 });

        const accuracyPct = totals.total ? Math.round((totals.correct / totals.total) * 100) : 0;

        byId('dash-tests').textContent = totals.tests;
        byId('dash-correct').textContent = totals.correct;
        byId('dash-wrong').textContent = totals.wrong;
        byId('dash-accuracy').textContent = `${accuracyPct}%`;
        
        const streak = await ProgressStore.getBestStreak();
        const dashStreakEl = byId('dash-streak');
        if (dashStreakEl) dashStreakEl.textContent = streak;

        const dashTimeEl = byId('dash-time-spent');
        if (dashTimeEl) dashTimeEl.textContent = `${Math.round(totals.duration / 60)} mins`;

        const topics = {};
        tests.forEach(t => { 
            const x = topics[t.topic || 'General'] || (topics[t.topic || 'General'] = { tests:0, correct:0, wrong:0, skipped:0, total:0 }); 
            x.tests++; 
            x.correct += t.correctCount; 
            x.wrong += t.wrongCount; 
            x.skipped += t.skippedCount; 
            x.total += t.total; 
        });

        byId('topic-summary').innerHTML = Object.entries(topics).map(([topic, x]) => {
            const acc = Math.round((x.correct / (x.total || 1)) * 100);
            let badgeClass = 'status-good';
            if (acc < 50) badgeClass = 'status-bad';
            else if (acc < 75) badgeClass = 'status-mid';

            return `
            <div class="modern-topic-card">
                <div class="topic-card-header">
                    <div class="topic-title-box">
                        <span class="topic-tag-pill">${escapeHtml(topic)}</span>
                        <h4>${escapeHtml(topic)} Drill</h4>
                    </div>
                    <span class="topic-acc-badge ${badgeClass}">${acc}% Acc</span>
                </div>
                <div class="topic-progress-track">
                    <div class="topic-progress-fill" style="width: ${acc}%"></div>
                </div>
                <div class="topic-stats-footer">
                    <span><b>${x.tests}</b> test${x.tests > 1 ? 's' : ''} (${x.total} Qs)</span>
                    <span><i class="ph-bold ph-check text-green"></i> ${x.correct} &nbsp; <i class="ph-bold ph-x text-red"></i> ${x.wrong}</span>
                </div>
            </div>`;
        }).join('');

        byId('test-history').innerHTML = tests.map(t => {
            const acc = t.total ? Math.round((t.correctCount / t.total) * 100) : 0;
            const topicName = escapeHtml(t.topic || 'Mock Drill');
            const dateStr = formatDate(t.completedAt);
            const timeStr = formatTime(t.durationSeconds);
            const isGoodAcc = acc >= 75;
            const isMidAcc = acc >= 40 && acc < 75;
            const accClass = isGoodAcc ? 'acc-pill-good' : (isMidAcc ? 'acc-pill-mid' : 'acc-pill-low');

            return `
            <div class="history-item-card" onclick="ProgressDashboard.openTest('${t.id}')">
                <div class="history-left">
                    <div class="history-icon-box">
                        <i class="ph-fill ph-chart-polar"></i>
                    </div>
                    <div class="history-meta">
                        <div class="history-topic-title">${topicName}</div>
                        <div class="history-meta-badges">
                            <span class="meta-chip"><i class="ph-bold ph-calendar-blank"></i> ${dateStr}</span>
                            <span class="meta-chip"><i class="ph-bold ph-timer"></i> ${timeStr}</span>
                            <span class="meta-chip"><i class="ph-bold ph-list-numbers"></i> ${t.total} Qs</span>
                        </div>
                    </div>
                </div>
                <div class="history-right">
                    <div class="history-score-col">
                        <div class="history-score-val"><b>${t.correctCount}</b><span class="history-score-total">/${t.total}</span></div>
                        <span class="history-acc-pill ${accClass}">${acc}%</span>
                    </div>
                    <i class="ph-bold ph-caret-right history-arrow"></i>
                </div>
            </div>`;
        }).join('');
    }

    async function openTest(id) {
        const tests = await ProgressStore.getTests();
        const test = tests.find(t => t.id === id); 
        if (!test) return;
        QuizEngine.showStoredResult(test);
    }

    async function renderNotebook() {
        const listEl = byId('notebook-list');
        const emptyEl = byId('notebook-empty');
        
        // Show shimmer skeleton while loading
        if (listEl && listEl.children.length === 0) {
            emptyEl.style.display = 'none';
            listEl.innerHTML = `
                <div class="skeleton-mistake-card"><div class="skeleton-shimmer"></div></div>
                <div class="skeleton-mistake-card"><div class="skeleton-shimmer"></div></div>
                <div class="skeleton-mistake-card"><div class="skeleton-shimmer"></div></div>
            `;
        }

        const mistakes = await ProgressStore.getMistakes({ topic: byId('notebook-topic').value });
        emptyEl.style.display = mistakes.length ? 'none' : 'block';
        listEl.innerHTML = mistakes.map((q, i) => {
            const isHighPriority = q.timesWrong >= 2;
            const priorityBadge = isHighPriority ? '<span class="mistake-badge priority-high">High Priority</span>' : '<span class="mistake-badge priority-mid">Review Needed</span>';
            const topicLabel = q.topic ? `#${q.topic}` : '#Practice';

            return `
            <div class="modern-mistake-card" id="mistake-card-${i}">
                <div class="mistake-card-top">
                    <div class="mistake-header-left">
                        <span class="mistake-q-badge"><i class="ph-fill ph-x-circle"></i> Q${i+1}</span>
                        <span class="mistake-topic-tag">${escapeHtml(topicLabel)}</span>
                        ${priorityBadge}
                    </div>
                    <div class="mistake-top-actions">
                        <button class="ai-trick-btn" onclick="ProgressDashboard.showAiTrick(this, '${encodeURIComponent(q.question)}', '${encodeURIComponent(q.correctAnswer)}', '${encodeURIComponent(q.topic || '')}')">
                            <i class="ph-fill ph-lightning"></i> Trick
                        </button>
                        <button class="practice-pill-btn" onclick="ProgressDashboard.practiceSingleMistake('${encodeURIComponent(q.key)}')">
                            <i class="ph-bold ph-arrows-clockwise"></i> Practice
                        </button>
                    </div>
                </div>
                <div class="mistake-question-content">
                    <div class="mistake-question-text">${escapeHtml(q.question)}</div>
                </div>
                <div class="ai-trick-container" style="display: none;"></div>
                <div class="mistake-footer">
                    <div class="mistake-stat-chips">
                        <span class="chip-wrong"><i class="ph-bold ph-x"></i> Failed: ${q.timesWrong}x</span>
                        <span class="chip-skipped"><i class="ph-bold ph-skip-forward"></i> Skipped: ${q.timesSkipped}x</span>
                        <span class="chip-seen"><i class="ph-bold ph-eye"></i> Seen: ${q.timesSeen}x</span>
                    </div>
                    <div class="mistake-correct-answer">
                        <span>Correct Answer:</span>
                        <strong>${escapeHtml(q.correctAnswer)}</strong>
                    </div>
                </div>
            </div>`;
        }).join('');
    }

    async function showAiTrick(btn, qTextEnc, ansEnc, topicEnc) {
        const card = btn.closest('.modern-mistake-card');
        const container = card?.querySelector('.ai-trick-container');
        if (!container) return;

        if (container.style.display === 'block') {
            container.style.display = 'none';
            btn.classList.remove('active');
            return;
        }

        btn.classList.add('active');
        container.style.display = 'block';
        container.innerHTML = `
            <div class="ai-trick-loading">
                <div class="spinner-small"></div>
                <span>Analyzing question with AI coach & generating 10-second shortcut...</span>
            </div>
        `;

        try {
            const res = await fetch('https://mock-test-backend-crqm.onrender.com/api/ai/shortcut-trick', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                    question: decodeURIComponent(qTextEnc),
                    correct_answer: decodeURIComponent(ansEnc),
                    topic: decodeURIComponent(topicEnc)
                })
            });

            if (!res.ok) throw new Error('API Error');
            const data = await res.json();

            container.innerHTML = `
                <div class="ai-trick-card">
                    <div class="ai-trick-head">
                        <div class="ai-trick-title"><i class="ph-fill ph-lightning text-orange"></i> ${escapeHtml(data.trick_title)}</div>
                        <span class="ai-target-time-badge"><i class="ph-bold ph-timer"></i> Target: &le; ${data.target_time_seconds}s</span>
                    </div>
                    <div class="ai-trick-body">
                        <div class="ai-step-box">
                            <strong>⚡ Topper's Step-by-Step Trick:</strong>
                            <p>${escapeHtml(data.topper_shortcut)}</p>
                        </div>
                        ${data.traditional_vs_shortcut ? `
                        <div class="ai-comparison-box">
                            <strong>🐢 Why Long Method Fails vs Shortcut:</strong>
                            <p>${escapeHtml(data.traditional_vs_shortcut)}</p>
                        </div>` : ''}
                        <div class="ai-takeaway-box">
                            <strong>💡 Golden Rule / AIR 1 Takeaway:</strong>
                            <p>${escapeHtml(data.key_takeaway)}</p>
                        </div>
                    </div>
                </div>
            `;
        } catch (e) {
            container.innerHTML = `
                <div class="ai-trick-card error">
                    <div class="ai-trick-title"><i class="ph-fill ph-warning-circle text-red"></i> Smart Mental Math Strategy</div>
                    <p style="font-size: 0.85rem; margin-top: 0.35rem;">Check the unit digits and use options elimination to reach the answer in under 15 seconds without manual calculation.</p>
                </div>
            `;
        }
    }

    async function practiceSingleMistake(encodedKey) {
        const key = decodeURIComponent(encodedKey);
        const mistakes = await ProgressStore.getMistakes({ topic: 'all', activeOnly: false });
        const mistake = mistakes.find(m => m.key === key);
        if (!mistake) return;

        QuizEngine.state.negativeMarking = false;
        QuizEngine.state.timerMode = 'stopwatch';
        QuizEngine.startQuiz([{
            question: mistake.question,
            options: mistake.options || [],
            correctAnswer: mistake.correctAnswer,
            userAnswer: null
        }], 0, {
            trackProgress: true,
            topic: mistake.topic || 'Targeted Practice',
            sourceName: 'Mistake Drill'
        });
    }

    async function startRetest() {
        let questions = await ProgressStore.getMistakes({ topic: byId('notebook-topic').value });
        if (!questions.length) return;
        questions = [...questions].sort(() => Math.random() - 0.5);
        const count = byId('retest-count').value;
        if (count !== 'all') questions = questions.slice(0, Number(count));
        QuizEngine.state.negativeMarking = false;
        QuizEngine.state.timerMode = 'stopwatch';
        QuizEngine.startQuiz(questions.map(q => ({ 
            question: q.question, 
            options: q.options || [], 
            correctAnswer: q.correctAnswer, 
            userAnswer: null 
        })), 0, { 
            trackProgress: true, 
            topic: byId('notebook-topic').value === 'all' ? 'Mistake Revision' : byId('notebook-topic').value, 
            sourceName: 'Mistake Notebook Retest' 
        });
    }

    document.addEventListener('DOMContentLoaded', () => {
        byId('notebook-topic')?.addEventListener('change', renderNotebook);
        byId('start-retest-btn')?.addEventListener('click', startRetest);
    });

    return { open, openTest, openNotebook, renderDashboard, renderNotebook, practiceSingleMistake, showAiTrick, updateNavActive };
})();
