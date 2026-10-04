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

    /* ── Helper: Check if test / mistake is AI Mock or Document Shuffle ── */
    function isMockTestEligible(test = {}) {
        const topic = (test.topic || '').toLowerCase();
        const src = (test.sourceName || '').toLowerCase();

        // 1. Document Shuffle tests
        if (topic.includes('document shuffle') || src.includes('document shuffle') || topic.includes('doc shuffle')) {
            return true;
        }

        // 2. AI Mock Tests generated from files (.pdf, .docx, file uploads)
        if (src.endsWith('.pdf') || src.endsWith('.docx') || src.includes('.pdf') || src.includes('.docx')) {
            return true;
        }
        if (topic.includes('ai mock') || src.includes('ai mock') || topic.includes('pdf mock') || src.includes('pdf mock') || topic.includes('mock drill') || topic.includes('mistake')) {
            return true;
        }

        // 3. Subject-based tests (Maths, Reasoning, custom topic)
        if (topic.startsWith('maths') || topic.startsWith('reasoning') || topic.includes('—') || topic.includes(' - ')) {
            return true;
        }

        return false;
    }

    function isMistakeNotebookEligible(mistake = {}) {
        const topic = (mistake.topic || '').toLowerCase();
        // Disallow standard mental calculation topics
        const calcTopics = [
            'addition', 'subtraction', 'multiplication', 'division',
            'square', 'cube', 'squareroot', 'square root', 'tables',
            'percenttofraction', 'fractiontopercent', 'mental math',
            'percent → fraction', 'fraction → %', 'random calculation',
            'speed math', 'calculation'
        ];
        if (calcTopics.some(ct => topic === ct || topic.startsWith(ct))) {
            return false;
        }

        // Also check if question itself is a pure mental arithmetic question
        const q = (mistake.question || '').toLowerCase();
        if ((q.includes('²') || q.includes('³') || q.includes('√')) && q.length < 30) {
            return false;
        }
        if (/^\d+\s*[\+\-\×\÷\/\*]\s*\d+/.test(q.trim())) {
            return false;
        }

        return true;
    }

    async function openNotebook() {
        updateNavActive('notebook');
        QuizEngine.showScreen(byId('notebook-screen'));
        renderNotebook();
    }

    async function renderDashboard() {
        const allTests = await ProgressStore.getTests();
        // Only include AI Mock Tests and Document Shuffle tests on this page
        const tests = allTests.filter(isMockTestEligible);

        byId('dashboard-empty').style.display = tests.length ? 'none' : 'block';
        byId('dashboard-content').style.display = tests.length ? 'block' : 'none';
        if (!tests.length) return;

        const totals = tests.reduce((a, t) => {
            const totalQ = Number(t.total) || (Array.isArray(t.questions) ? t.questions.length : 0) || ((Number(t.correctCount) || 0) + (Number(t.wrongCount) || 0) + (Number(t.skippedCount) || 0)) || 0;
            return { 
                tests: a.tests + 1, 
                correct: a.correct + (Number(t.correctCount) || 0), 
                wrong: a.wrong + (Number(t.wrongCount) || 0), 
                skipped: a.skipped + (Number(t.skippedCount) || 0), 
                total: a.total + totalQ,
                duration: a.duration + (Number(t.durationSeconds) || 0)
            };
        }, { tests:0, correct:0, wrong:0, skipped:0, total:0, duration:0 });

        const accuracyPct = totals.total > 0 ? Math.min(100, Math.round((totals.correct / totals.total) * 100)) : 0;

        byId('dash-tests').textContent = totals.tests;
        byId('dash-correct').textContent = totals.correct;
        byId('dash-wrong').textContent = totals.wrong;
        byId('dash-accuracy').textContent = `${accuracyPct}%`;
        
        const streak = await ProgressStore.getBestStreak();
        const dashStreakEl = byId('dash-streak');
        if (dashStreakEl) dashStreakEl.textContent = streak;

        const dashTimeEl = byId('dash-time-spent');
        if (dashTimeEl) dashTimeEl.textContent = `${Math.round(totals.duration / 60)} mins`;

        // Compute Speed & Question metrics strictly for AI Mock & Document Shuffle tests
        let totalMockQ = 0;
        let totalMockTime = 0;
        let totalMockFast = 0;
        let totalMockSlow = 0;

        tests.forEach(test => {
            const questions = test.questions || [];
            questions.forEach(q => {
                totalMockQ++;
                const spent = q.timeSpentSeconds || 0;
                totalMockTime += spent;
                const target = 25; // standard target for exam/mock questions
                if (spent > 0 && spent <= target) totalMockFast++;
                else if (spent > target * 1.5) totalMockSlow++;
            });
        });

        const avgMockSpeed = totalMockQ ? Math.round(totalMockTime / totalMockQ) : 0;
        const qEl = byId('dash-calc-questions');
        if (qEl) qEl.textContent = totalMockQ;
        const speedEl = byId('dash-calc-speed');
        if (speedEl) speedEl.textContent = avgMockSpeed > 0 ? `${avgMockSpeed}s` : '—';
        const fastEl = byId('dash-calc-fast');
        if (fastEl) fastEl.textContent = totalMockFast;
        const slowEl = byId('dash-calc-slow');
        if (slowEl) slowEl.textContent = totalMockSlow;

        const topics = {};
        tests.forEach(t => { 
            const totalQ = Number(t.total) || (Array.isArray(t.questions) ? t.questions.length : 0) || ((Number(t.correctCount) || 0) + (Number(t.wrongCount) || 0) + (Number(t.skippedCount) || 0)) || 0;
            const x = topics[t.topic || 'General'] || (topics[t.topic || 'General'] = { tests:0, correct:0, wrong:0, skipped:0, total:0 }); 
            x.tests++; 
            x.correct += (Number(t.correctCount) || 0); 
            x.wrong += (Number(t.wrongCount) || 0); 
            x.skipped += (Number(t.skippedCount) || 0); 
            x.total += totalQ; 
        });

        byId('topic-summary').innerHTML = Object.entries(topics).map(([topic, x]) => {
            const effectiveTotal = x.total > 0 ? x.total : ((x.correct + x.wrong + x.skipped) || 0);
            const acc = effectiveTotal > 0 ? Math.min(100, Math.round((x.correct / effectiveTotal) * 100)) : 0;
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
                    <span><b>${x.tests}</b> test${x.tests > 1 ? 's' : ''} (${effectiveTotal} Qs)</span>
                    <span><i class="ph-bold ph-check text-green"></i> ${x.correct} &nbsp; <i class="ph-bold ph-x text-red"></i> ${x.wrong}</span>
                </div>
            </div>`;
        }).join('');

        byId('test-history').innerHTML = tests.map(t => {
            const totalQ = Number(t.total) || (Array.isArray(t.questions) ? t.questions.length : 0) || ((Number(t.correctCount) || 0) + (Number(t.wrongCount) || 0) + (Number(t.skippedCount) || 0)) || 0;
            const correct = Number(t.correctCount) || 0;
            const acc = totalQ > 0 ? Math.min(100, Math.round((correct / totalQ) * 100)) : 0;
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
                            <span class="meta-chip"><i class="ph-bold ph-list-numbers"></i> ${totalQ} Qs</span>
                        </div>
                    </div>
                </div>
                <div class="history-right">
                    <div class="history-score-col">
                        <div class="history-score-val"><b>${correct}</b><span class="history-score-total">/${totalQ}</span></div>
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

    let selectedMistakeKeys = new Set();
    let currentVisibleMistakes = [];

    function updateSelectionUI() {
        const count = selectedMistakeKeys.size;
        const btn = byId('practice-selected-btn');
        const btnCount = byId('selected-btn-count');
        const badge = byId('selection-count-badge');
        const selectAllCb = byId('select-all-mistakes-cb');

        if (btnCount) btnCount.textContent = count;
        if (btn) btn.disabled = count === 0;

        if (badge) {
            if (count > 0) {
                badge.textContent = `${count} selected`;
                badge.style.display = 'inline-block';
            } else {
                badge.style.display = 'none';
            }
        }

        if (selectAllCb) {
            const totalVisible = currentVisibleMistakes.length;
            if (totalVisible > 0 && count === totalVisible) {
                selectAllCb.checked = true;
                selectAllCb.indeterminate = false;
            } else if (count > 0 && count < totalVisible) {
                selectAllCb.checked = false;
                selectAllCb.indeterminate = true;
            } else {
                selectAllCb.checked = false;
                selectAllCb.indeterminate = false;
            }
        }
    }

    function toggleMistakeSelect(encodedKey, isChecked) {
        const key = decodeURIComponent(encodedKey);
        if (isChecked) {
            selectedMistakeKeys.add(key);
        } else {
            selectedMistakeKeys.delete(key);
        }

        document.querySelectorAll('.modern-mistake-card').forEach(card => {
            const cb = card.querySelector('.mistake-select-cb');
            if (cb && cb.dataset.key === encodedKey) {
                if (isChecked) card.classList.add('card-selected');
                else card.classList.remove('card-selected');
            }
        });

        updateSelectionUI();
    }

    function toggleSelectAll(isChecked) {
        currentVisibleMistakes.forEach(m => {
            if (isChecked) selectedMistakeKeys.add(m.key);
            else selectedMistakeKeys.delete(m.key);
        });

        document.querySelectorAll('.modern-mistake-card').forEach(card => {
            const cb = card.querySelector('.mistake-select-cb');
            if (cb) cb.checked = isChecked;
            if (isChecked) card.classList.add('card-selected');
            else card.classList.remove('card-selected');
        });

        updateSelectionUI();
    }

    async function practiceSelectedMistakes() {
        if (!selectedMistakeKeys.size) return;
        const selectedMistakes = currentVisibleMistakes.filter(m => selectedMistakeKeys.has(m.key));
        if (!selectedMistakes.length) return;

        QuizEngine.state.negativeMarking = false;
        QuizEngine.state.timerMode = 'stopwatch';
        QuizEngine.startQuiz(selectedMistakes.map(q => ({
            question: q.question,
            options: q.options || [],
            correctAnswer: q.correctAnswer,
            userAnswer: null
        })), 0, {
            trackProgress: true,
            topic: 'Selected Mistakes Revision',
            sourceName: `Mistake Practice (${selectedMistakes.length} Qs)`
        });
    }

    function detectSubject(topic = '') {
        const t = (topic || '').toLowerCase();
        if (t.startsWith('maths') || t.includes('maths')) return 'Maths';
        if (t.startsWith('reasoning') || t.includes('reasoning')) return 'Reasoning';
        if (t.startsWith('gk') || t.startsWith('gs') || t.includes('gk') || t.includes('general awareness') || t.includes('general studies')) return 'GK/GS';
        if (t.startsWith('english') || t.includes('english')) return 'English';

        const reasoningKeywords = ['calendar', 'clock', 'coding', 'decoding', 'syllogism', 'blood', 'relation', 'direction', 'analogy', 'series', 'dice', 'cube', 'mirror', 'paper', 'seating', 'venn', 'matrix', 'puzzle', 'classification', 'order and ranking', 'ranking'];
        if (reasoningKeywords.some(k => t.includes(k))) return 'Reasoning';

        const gkKeywords = ['history', 'polity', 'geography', 'biology', 'chemistry', 'physics', 'economics', 'static_gk', 'static gk', 'current affairs', 'monument', 'dance', 'festival', 'constitution', 'amendment', 'mughal', 'vedic', 'indus'];
        if (gkKeywords.some(k => t.includes(k))) return 'GK/GS';

        const englishKeywords = ['vocab', 'grammar', 'comprehension', 'synonym', 'antonym', 'idiom', 'phrase', 'cloze', 'error spotting', 'one word', 'spelling', 'active passive', 'narration'];
        if (englishKeywords.some(k => t.includes(k))) return 'English';

        const mathsKeywords = ['percentage', 'ratio', 'proportion', 'profit', 'loss', 'discount', 'simple interest', 'compound interest', 'time and work', 'pipe', 'cistern', 'speed', 'distance', 'train', 'boat', 'stream', 'average', 'mixture', 'alligation', 'algebra', 'trigonometry', 'height', 'geometry', 'mensuration', 'number system', 'hcf', 'lcm', 'simplification', 'coordinate', 'partnership', 'data interpretation', 'si & ci', 'si and ci'];
        if (mathsKeywords.some(k => t.includes(k))) return 'Maths';

        return 'Maths';
    }

    function extractCleanTopic(topic = '') {
        if (!topic) return 'General';
        return topic.replace(/^(Maths|Reasoning|GK\/GS|English|History|Polity|Geography|Biology|Chemistry|Physics|Economics|Static_GK)\s*[—-]\s*/i, '').trim() || topic;
    }

    function assignMistakeTag(encodedKey, tag) {
        const key = decodeURIComponent(encodedKey);
        const newTag = tag ? tag : null;
        ProgressStore.setMistakeTag(key, newTag);

        // Update tag in memory
        const m = currentVisibleMistakes.find(x => x.key === key);
        if (m) m.mistakeTag = newTag;

        // Re-render to update counts and filtered cards
        renderNotebook();
    }

    function renderMistakeTagPill(key, tag) {
        const encodedKey = encodeURIComponent(key);
        return `
            <select class="mistake-card-tag-select ${tag ? 'tagged-' + tag : 'untagged'}" 
                    title="Mistake Type - click to change"
                    onchange="ProgressDashboard.assignMistakeTag('${encodedKey}', this.value)">
                <option value="" ${!tag ? 'selected' : ''}>${tag ? '⚪ Untag' : '+ Tag'}</option>
                <option value="reading" ${tag === 'reading' ? 'selected' : ''}>📖 Reading</option>
                <option value="calc" ${tag === 'calc' ? 'selected' : ''}>✍️ Calc Slip</option>
                <option value="concept" ${tag === 'concept' ? 'selected' : ''}>🧠 Concept</option>
                <option value="trap" ${tag === 'trap' ? 'selected' : ''}>🪤 Trap</option>
                <option value="panic" ${tag === 'panic' ? 'selected' : ''}>⏱️ Panic</option>
            </select>
        `;
    }

    function filterByTagFromPanel(tag) {
        const tagSelect = byId('notebook-mistake-tag');
        if (!tagSelect) return;
        if (tagSelect.value === tag) {
            tagSelect.value = 'all';
        } else {
            tagSelect.value = tag;
        }
        renderNotebook();
    }

    function filterByTopicFromPanel(topicName) {
        const topicSelect = byId('notebook-topic');
        if (!topicSelect) return;
        if (topicSelect.value.toLowerCase() === topicName.toLowerCase()) {
            topicSelect.value = 'all';
        } else {
            const match = [...topicSelect.options].find(o => o.value.toLowerCase() === topicName.toLowerCase());
            if (match) topicSelect.value = match.value;
            else topicSelect.value = topicName;
        }
        renderNotebook();
    }

    function setSubjectFilter(subject) {
        const subSelect = byId('notebook-subject-select');
        if (subSelect) subSelect.value = subject;
        document.querySelectorAll('#notebook-subject-pills .sub-pill').forEach(btn => {
            if (btn.dataset.subject.toLowerCase() === subject.toLowerCase()) {
                btn.classList.add('active');
            } else {
                btn.classList.remove('active');
            }
        });
        const topicSelect = byId('notebook-topic');
        if (topicSelect) topicSelect.value = 'all';
        renderNotebook();
    }

    async function renderNotebook() {
        const listEl = byId('notebook-list');
        const emptyEl = byId('notebook-empty');
        const toolbarEl = byId('notebook-selection-toolbar');
        
        // Show shimmer skeleton while loading
        if (listEl && listEl.children.length === 0) {
            emptyEl.style.display = 'none';
            if (toolbarEl) toolbarEl.style.display = 'none';
            listEl.innerHTML = `
                <div class="skeleton-mistake-card"><div class="skeleton-shimmer"></div></div>
                <div class="skeleton-mistake-card"><div class="skeleton-shimmer"></div></div>
                <div class="skeleton-mistake-card"><div class="skeleton-shimmer"></div></div>
            `;
        }

        const rawMistakes = await ProgressStore.getMistakes({ topic: 'all' });
        const mistakes = rawMistakes.filter(isMistakeNotebookEligible);
        
        mistakes.forEach(m => {
            m.subject = detectSubject(m.topic);
            m.cleanTopic = extractCleanTopic(m.topic);
        });

        // Current filter values
        const currentSub = byId('notebook-subject-select')?.value || 'all';
        const currentTopic = byId('notebook-topic')?.value || 'all';
        const currentTagFilter = byId('notebook-mistake-tag')?.value || 'all';

        // Sync subject pills
        document.querySelectorAll('#notebook-subject-pills .sub-pill').forEach(btn => {
            if (btn.dataset.subject.toLowerCase() === currentSub.toLowerCase()) {
                btn.classList.add('active');
            } else {
                btn.classList.remove('active');
            }
        });

        // 1. Subject filtered subset (for topic dropdown & diagnostics panel)
        const subjectMistakes = currentSub === 'all' ? mistakes : mistakes.filter(m => m.subject === currentSub);

        // Update Diagnostics Total Badge
        const totalBadgeEl = byId('analytics-total-badge');
        if (totalBadgeEl) {
            totalBadgeEl.textContent = `${subjectMistakes.length} Mistake${subjectMistakes.length !== 1 ? 's' : ''}`;
        }

        // Count tags for diagnostics
        const tagCounts = { reading: 0, calc: 0, concept: 0, trap: 0, panic: 0 };
        subjectMistakes.forEach(m => {
            if (m.mistakeTag && tagCounts[m.mistakeTag] !== undefined) {
                tagCounts[m.mistakeTag]++;
            }
        });

        const elR = byId('diag-count-reading'); if (elR) elR.textContent = tagCounts.reading;
        const elC = byId('diag-count-calc'); if (elC) elC.textContent = tagCounts.calc;
        const elK = byId('diag-count-concept'); if (elK) elK.textContent = tagCounts.concept;
        const elT = byId('diag-count-trap'); if (elT) elT.textContent = tagCounts.trap;
        const elP = byId('diag-count-panic'); if (elP) elP.textContent = tagCounts.panic;

        // Highlight active tag chip in panel if filter active
        document.querySelectorAll('.diag-chip').forEach(chip => {
            const cTag = chip.dataset.tag;
            if (currentTagFilter === cTag) chip.classList.add('active');
            else chip.classList.remove('active');
        });

        // Topic breakdown counts for current subject
        const topicCounts = {};
        subjectMistakes.forEach(m => {
            const top = m.cleanTopic || 'General';
            topicCounts[top] = (topicCounts[top] || 0) + 1;
        });
        const sortedTopics = Object.entries(topicCounts).sort((a, b) => b[1] - a[1]);

        // Render topic breakdown pills in top panel
        const topicChipsEl = byId('analytics-topic-chips');
        if (topicChipsEl) {
            if (!sortedTopics.length) {
                topicChipsEl.innerHTML = '<span style="color:var(--text-secondary);font-size:0.82rem;">No mistakes in this subject! 🎉</span>';
            } else {
                topicChipsEl.innerHTML = sortedTopics.map(([topName, cnt]) => {
                    const isTopActive = (currentTopic !== 'all' && currentTopic.toLowerCase() === topName.toLowerCase());
                    return `
                    <button type="button" class="topic-diag-pill ${isTopActive ? 'active' : ''}" onclick="ProgressDashboard.filterByTopicFromPanel('${escapeHtml(topName)}')">
                        <span>${escapeHtml(topName)}</span>
                        <span class="pill-cnt">${cnt}</span>
                    </button>`;
                }).join('');
            }
        }

        // Populate #notebook-topic select with counts
        const topicSelect = byId('notebook-topic');
        if (topicSelect) {
            let optionsHtml = `<option value="all">All topics (${subjectMistakes.length})</option>`;
            sortedTopics.forEach(([topName, cnt]) => {
                optionsHtml += `<option value="${escapeHtml(topName)}">${escapeHtml(topName)} (${cnt})</option>`;
            });
            topicSelect.innerHTML = optionsHtml;
            if (currentTopic && [...topicSelect.options].some(o => o.value === currentTopic)) {
                topicSelect.value = currentTopic;
            } else {
                topicSelect.value = 'all';
            }
        }

        // 2. Filter visible mistakes
        let visibleMistakes = subjectMistakes;
        if (topicSelect && topicSelect.value !== 'all') {
            const selTop = topicSelect.value.toLowerCase();
            visibleMistakes = visibleMistakes.filter(m => (m.cleanTopic || '').toLowerCase() === selTop || (m.topic || '').toLowerCase().includes(selTop));
        }

        if (currentTagFilter !== 'all') {
            if (currentTagFilter === 'untagged') {
                visibleMistakes = visibleMistakes.filter(m => !m.mistakeTag);
            } else {
                visibleMistakes = visibleMistakes.filter(m => m.mistakeTag === currentTagFilter);
            }
        }

        currentVisibleMistakes = visibleMistakes;

        // Keep only selected keys that are in visible mistakes
        const visibleKeySet = new Set(visibleMistakes.map(m => m.key));
        for (const k of selectedMistakeKeys) {
            if (!visibleKeySet.has(k)) selectedMistakeKeys.delete(k);
        }

        emptyEl.style.display = visibleMistakes.length ? 'none' : 'block';
        if (toolbarEl) {
            toolbarEl.style.display = visibleMistakes.length ? 'flex' : 'none';
        }
        const visibleCountEl = byId('visible-mistakes-count');
        if (visibleCountEl) visibleCountEl.textContent = visibleMistakes.length;

        listEl.innerHTML = visibleMistakes.map((q, i) => {
            const isHighPriority = q.timesWrong >= 2;
            const priorityBadge = isHighPriority ? '<span class="mistake-badge priority-high">High Priority</span>' : '<span class="mistake-badge priority-mid">Review Needed</span>';
            const topicLabel = q.topic ? `#${q.topic}` : '#Practice';
            const isSelected = selectedMistakeKeys.has(q.key);
            const tag = q.mistakeTag;

            return `
            <div class="modern-mistake-card ${isSelected ? 'card-selected' : ''}" id="mistake-card-${i}">
                <div class="mistake-card-top">
                    <div class="mistake-header-left">
                        <label class="mistake-select-label" title="Select question for retest">
                            <input type="checkbox" class="mistake-select-cb" data-key="${encodeURIComponent(q.key)}" ${isSelected ? 'checked' : ''} onchange="ProgressDashboard.toggleMistakeSelect('${encodeURIComponent(q.key)}', this.checked)">
                            <span class="custom-cb-box"></span>
                        </label>
                        <span class="mistake-q-badge"><i class="ph-fill ph-x-circle"></i> Q${i+1}</span>
                        <span class="mistake-topic-tag">${escapeHtml(topicLabel)}</span>
                        ${priorityBadge}
                    </div>
                    <div class="mistake-top-actions">
                        ${renderMistakeTagPill(q.key, tag)}
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

        updateSelectionUI();
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
        const rawMistakes = await ProgressStore.getMistakes({ topic: 'all', activeOnly: false });
        const mistakes = rawMistakes.filter(isMistakeNotebookEligible);
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
        let questions = currentVisibleMistakes;
        if (!questions.length) return;
        questions = [...questions].sort(() => Math.random() - 0.5);
        const count = byId('retest-count')?.value || '10';
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
            topic: byId('notebook-topic')?.value === 'all' ? 'Mistake Revision' : byId('notebook-topic')?.value, 
            sourceName: 'Mistake Notebook Retest' 
        });
    }

    document.addEventListener('DOMContentLoaded', () => {
        byId('notebook-subject-select')?.addEventListener('change', (e) => setSubjectFilter(e.target.value));
        byId('notebook-topic')?.addEventListener('change', renderNotebook);
        byId('notebook-mistake-tag')?.addEventListener('change', renderNotebook);
        byId('start-retest-btn')?.addEventListener('click', startRetest);
        byId('select-all-mistakes-cb')?.addEventListener('change', (e) => toggleSelectAll(e.target.checked));
        byId('practice-selected-btn')?.addEventListener('click', practiceSelectedMistakes);

        document.querySelectorAll('#notebook-subject-pills .sub-pill').forEach(btn => {
            btn.addEventListener('click', () => {
                setSubjectFilter(btn.dataset.subject);
            });
        });
    });

    return { 
        open, 
        openTest, 
        openNotebook, 
        renderDashboard, 
        renderNotebook, 
        practiceSingleMistake, 
        showAiTrick, 
        updateNavActive,
        toggleMistakeSelect,
        toggleSelectAll,
        practiceSelectedMistakes,
        assignMistakeTag,
        filterByTagFromPanel,
        filterByTopicFromPanel,
        setSubjectFilter
    };
})();
