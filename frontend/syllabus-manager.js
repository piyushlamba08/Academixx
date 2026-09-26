/**
 * SyllabusManager — Complete Subject Syllabus & Selection Table Revision Tracker
 * Supports checklist marking, round tracking (R1-R8), progress percentage, and persistent saving in localStorage.
 */
const SyllabusManager = (() => {
    const STORAGE_KEY = 'academix_syllabus_progress_v1';
    let currentSubjectId = 'MATHS';
    let currentFilter = 'all'; // 'all', 'pending', 'completed'
    let searchQuery = '';

    // Load progress object from localStorage: { [subjectId]: { [topicKey]: { done: boolean, r1: boolean, r2: boolean, ... } } }
    function loadProgress() {
        try {
            const data = localStorage.getItem(STORAGE_KEY);
            return data ? JSON.parse(data) : {};
        } catch (e) {
            console.error('Failed to load syllabus progress', e);
            return {};
        }
    }

    function saveProgress(progress) {
        try {
            localStorage.setItem(STORAGE_KEY, JSON.stringify(progress));
        } catch (e) {
            console.error('Failed to save syllabus progress', e);
        }
    }

    function getTopicKey(subjectId, topicName) {
        return `${subjectId}_${topicName.replace(/\s+/g, '_')}`;
    }

    function toggleTopicDone(subjectId, topicName, isChecked) {
        const progress = loadProgress();
        if (!progress[subjectId]) progress[subjectId] = {};
        const key = getTopicKey(subjectId, topicName);
        if (!progress[subjectId][key]) progress[subjectId][key] = {};
        
        progress[subjectId][key].done = isChecked;
        saveProgress(progress);
        
        // Re-render UI stats and current view
        render();
    }

    function toggleRound(subjectId, topicName, roundKey, isChecked) {
        const progress = loadProgress();
        if (!progress[subjectId]) progress[subjectId] = {};
        const key = getTopicKey(subjectId, topicName);
        if (!progress[subjectId][key]) progress[subjectId][key] = {};
        
        progress[subjectId][key][roundKey] = isChecked;
        
        saveProgress(progress);
        renderStats();
    }

    function calculateSubjectStats(subjectId) {
        const subject = typeof SYLLABUS_DATA !== 'undefined' ? SYLLABUS_DATA[subjectId] : null;
        if (!subject) return { total: 0, completed: 0, percent: 0 };
        
        const progress = loadProgress()[subjectId] || {};
        let total = 0;
        let completed = 0;

        subject.parts.forEach(part => {
            part.topics.forEach(t => {
                total++;
                const key = getTopicKey(subjectId, t);
                if (progress[key]?.done) {
                    completed++;
                }
            });
        });

        const percent = total > 0 ? Math.round((completed / total) * 100) : 0;
        return { total, completed, percent };
    }

    function calculateOverallStats() {
        if (typeof SYLLABUS_DATA === 'undefined') return { total: 0, completed: 0, percent: 0 };
        let total = 0;
        let completed = 0;
        const progress = loadProgress();

        Object.keys(SYLLABUS_DATA).forEach(subjId => {
            const subject = SYLLABUS_DATA[subjId];
            const subjProgress = progress[subjId] || {};
            subject.parts.forEach(part => {
                part.topics.forEach(t => {
                    total++;
                    const key = getTopicKey(subjId, t);
                    if (subjProgress[key]?.done) {
                        completed++;
                    }
                });
            });
        });

        const percent = total > 0 ? Math.round((completed / total) * 100) : 0;
        return { total, completed, percent };
    }

    function selectSubject(subjectId) {
        currentSubjectId = subjectId;
        render();
    }

    function setFilter(filter, btn) {
        currentFilter = filter;
        document.querySelectorAll('.syllabus-filter-chip').forEach(b => b.classList.remove('active'));
        if (btn) btn.classList.add('active');
        renderTopicsList();
    }

    function setSearch(query) {
        searchQuery = query.toLowerCase().trim();
        renderTopicsList();
    }

    function resetSubjectProgress(subjectId) {
        if (!confirm(`Are you sure you want to reset all checklist progress for ${SYLLABUS_DATA[subjectId]?.title || 'this subject'}?`)) {
            return;
        }
        const progress = loadProgress();
        delete progress[subjectId];
        saveProgress(progress);
        render();
    }

    function renderSubjectSelect() {
        const selectEl = document.getElementById('syllabus-subject-select');
        if (!selectEl || typeof SYLLABUS_DATA === 'undefined') return;

        const subjectKeys = Object.keys(SYLLABUS_DATA);
        selectEl.innerHTML = subjectKeys.map(key => {
            const subj = SYLLABUS_DATA[key];
            const stats = calculateSubjectStats(key);
            const isSelected = key === currentSubjectId ? 'selected' : '';
            return `<option value="${key}" ${isSelected}>${subj.title} (${stats.completed}/${stats.total} • ${stats.percent}%)</option>`;
        }).join('');
    }

    function renderStats() {
        if (typeof SYLLABUS_DATA === 'undefined') return;
        const overall = calculateOverallStats();
        const current = calculateSubjectStats(currentSubjectId);
        const subj = SYLLABUS_DATA[currentSubjectId];

        // Overall text
        const overallText = document.getElementById('syllabus-overall-text');
        if (overallText) overallText.textContent = `${overall.percent}% (${overall.completed}/${overall.total})`;

        // Sync select value
        const selectEl = document.getElementById('syllabus-subject-select');
        if (selectEl && selectEl.value !== currentSubjectId) {
            selectEl.value = currentSubjectId;
        }

        // Active Subject Header
        const headerTitle = document.getElementById('syllabus-active-title');
        const headerMeta = document.getElementById('syllabus-active-meta');
        const headerBar = document.getElementById('syllabus-active-bar');

        if (headerTitle) {
            headerTitle.innerHTML = `<i class="ph-bold ${subj?.icon || 'ph-book'}" style="color:${subj?.color}"></i> ${subj?.title || 'Subject'}`;
        }
        if (headerMeta) {
            headerMeta.textContent = `${current.completed} of ${current.total} Chapters Completed (${current.percent}%)`;
        }
        if (headerBar) {
            headerBar.style.width = `${current.percent}%`;
            headerBar.style.backgroundColor = subj?.color || 'var(--primary)';
        }
    }

    function renderTopicsList() {
        const listContainer = document.getElementById('syllabus-table-body');
        if (!listContainer || typeof SYLLABUS_DATA === 'undefined') return;

        const subj = SYLLABUS_DATA[currentSubjectId];
        if (!subj) {
            listContainer.innerHTML = '<div class="syllabus-empty-state">Select a subject to view syllabus table.</div>';
            return;
        }

        const progress = loadProgress()[currentSubjectId] || {};
        const rounds = ['R1', 'R2', 'R3', 'R4', 'R5', 'R6', 'R7', 'R8'];

        let html = '';
        let totalRendered = 0;

        subj.parts.forEach((part) => {
            const filteredTopics = part.topics.filter(t => {
                const key = getTopicKey(currentSubjectId, t);
                const isDone = !!progress[key]?.done;

                if (currentFilter === 'pending' && isDone) return false;
                if (currentFilter === 'completed' && !isDone) return false;
                if (searchQuery && !t.toLowerCase().includes(searchQuery)) return false;
                return true;
            });

            if (filteredTopics.length === 0) return;

            totalRendered += filteredTopics.length;

            html += `
                <div class="syllabus-part-group">
                    <div class="syllabus-part-header">
                        <h4><i class="ph-bold ph-folder-notch"></i> ${part.title}</h4>
                        <span class="part-topic-count">${filteredTopics.length} topics</span>
                    </div>
                    <!-- Desktop View Table -->
                    <div class="syllabus-table-wrapper desktop-only-table">
                        <table class="syllabus-selection-table">
                            <thead>
                                <tr>
                                    <th class="col-status">Done</th>
                                    <th class="col-topic">Subject / Topic Name</th>
                                    <th class="col-round">R1 <small>Theory</small></th>
                                    <th class="col-round">R2 <small>Sheet</small></th>
                                    <th class="col-round">R3 <small>Rev</small></th>
                                    <th class="col-round">R4 <small>Test 1</small></th>
                                    <th class="col-round">R5 <small>Theory</small></th>
                                    <th class="col-round">R6 <small>Sheet</small></th>
                                    <th class="col-round">R7 <small>Rev</small></th>
                                    <th class="col-round">R8 <small>Test 2</small></th>
                                </tr>
                            </thead>
                            <tbody>
                                ${filteredTopics.map((topic) => {
                                    const key = getTopicKey(currentSubjectId, topic);
                                    const itemData = progress[key] || {};
                                    const isDone = !!itemData.done;
                                    const escapedTopic = topic.replace(/'/g, "\\'");
                                    
                                    const roundCells = rounds.map(r => {
                                        const rKey = r.toLowerCase();
                                        const isRoundChecked = !!itemData[rKey];
                                        return `
                                            <td class="col-round">
                                                <label class="round-checkbox-wrap" title="${r} Revision">
                                                    <input type="checkbox" ${isRoundChecked ? 'checked' : ''} onchange="SyllabusManager.toggleRound('${currentSubjectId}', '${escapedTopic}', '${rKey}', this.checked)">
                                                    <span class="round-checkmark">${r}</span>
                                                </label>
                                            </td>
                                        `;
                                    }).join('');

                                    return `
                                        <tr class="syllabus-topic-row ${isDone ? 'is-completed' : ''}">
                                            <td class="col-status">
                                                <label class="custom-checkbox-wrap" title="Mark topic as done">
                                                    <input type="checkbox" ${isDone ? 'checked' : ''} onchange="SyllabusManager.toggleTopicDone('${currentSubjectId}', '${escapedTopic}', this.checked)">
                                                    <span class="checkmark"></span>
                                                </label>
                                            </td>
                                            <td class="col-topic">
                                                <span class="topic-name-text ${isDone ? 'strike' : ''}">${topic}</span>
                                            </td>
                                            ${roundCells}
                                        </tr>
                                    `;
                                }).join('')}
                            </tbody>
                        </table>
                    </div>

                    <!-- Mobile View Topic Cards -->
                    <div class="syllabus-mobile-cards-list mobile-only-cards">
                        ${filteredTopics.map((topic) => {
                            const key = getTopicKey(currentSubjectId, topic);
                            const itemData = progress[key] || {};
                            const isDone = !!itemData.done;
                            const escapedTopic = topic.replace(/'/g, "\\'");

                            const roundPills = rounds.map(r => {
                                const rKey = r.toLowerCase();
                                const isRoundChecked = !!itemData[rKey];
                                return `
                                    <label class="mob-round-pill ${isRoundChecked ? 'checked' : ''}">
                                        <input type="checkbox" ${isRoundChecked ? 'checked' : ''} onchange="SyllabusManager.toggleRound('${currentSubjectId}', '${escapedTopic}', '${rKey}', this.checked)">
                                        <span>${r}</span>
                                    </label>
                                `;
                            }).join('');

                            return `
                                <div class="mob-topic-card ${isDone ? 'is-completed' : ''}">
                                    <div class="mob-topic-header">
                                        <label class="custom-checkbox-wrap" title="Mark topic as done">
                                            <input type="checkbox" ${isDone ? 'checked' : ''} onchange="SyllabusManager.toggleTopicDone('${currentSubjectId}', '${escapedTopic}', this.checked)">
                                            <span class="checkmark"></span>
                                        </label>
                                        <span class="mob-topic-title ${isDone ? 'strike' : ''}">${topic}</span>
                                    </div>
                                    <div class="mob-rounds-row">
                                        <span class="mob-rounds-label">Rounds:</span>
                                        <div class="mob-rounds-pills-wrap">
                                            ${roundPills}
                                        </div>
                                    </div>
                                </div>
                            `;
                        }).join('')}
                    </div>
                </div>
            `;
        });

        if (totalRendered === 0) {
            html = `
                <div class="syllabus-empty-state">
                    <i class="ph-bold ph-magnifying-glass"></i>
                    <h3>No topics found</h3>
                    <p>Try changing search query or filter tab.</p>
                </div>
            `;
        }

        listContainer.innerHTML = html;
    }

    function render() {
        renderSubjectSelect();
        renderStats();
        renderTopicsList();
    }

    function open() {
        QuizEngine.showScreen(document.getElementById('syllabus-screen'));
        ProgressDashboard.updateNavActive('syllabus');
        render();
    }

    return {
        open,
        render,
        selectSubject,
        toggleTopicDone,
        toggleRound,
        setFilter,
        setSearch,
        resetSubjectProgress
    };
})();
