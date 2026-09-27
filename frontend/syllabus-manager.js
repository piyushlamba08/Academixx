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

    function getTopicRoundCount(itemData) {
        const count = itemData?.roundCount || 3;
        return Math.min(Math.max(count, 3), 5);
    }

    function addNextRound(subjectId, topicName) {
        const progress = loadProgress();
        if (!progress[subjectId]) progress[subjectId] = {};
        const key = getTopicKey(subjectId, topicName);
        if (!progress[subjectId][key]) progress[subjectId][key] = {};

        const currentCount = getTopicRoundCount(progress[subjectId][key]);
        if (currentCount < 5) {
            progress[subjectId][key].roundCount = currentCount + 1;
            saveProgress(progress);
            renderTopicsList();
        }
    }

    function removeLastRound(subjectId, topicName) {
        const progress = loadProgress();
        if (!progress[subjectId]) return;
        const key = getTopicKey(subjectId, topicName);
        if (!progress[subjectId][key]) return;

        const currentCount = getTopicRoundCount(progress[subjectId][key]);
        if (currentCount > 3) {
            const nextCount = currentCount - 1;
            // Clean up checked states for the removed round
            delete progress[subjectId][key][`r${currentCount}`];
            delete progress[subjectId][key][`t${currentCount}`];
            if (nextCount === 3) {
                delete progress[subjectId][key].roundCount;
            } else {
                progress[subjectId][key].roundCount = nextCount;
            }
            saveProgress(progress);
            renderTopicsList();
        }
    }

    function resetAllExtraRounds(subjectId) {
        const progress = loadProgress();
        if (!progress[subjectId]) return;
        Object.keys(progress[subjectId]).forEach(k => {
            if (progress[subjectId][k]?.roundCount) {
                delete progress[subjectId][k].roundCount;
                delete progress[subjectId][k].r4;
                delete progress[subjectId][k].t4;
                delete progress[subjectId][k].r5;
                delete progress[subjectId][k].t5;
            }
        });
        saveProgress(progress);
        renderTopicsList();
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

            // Determine max round count across topics in this section (minimum 3, max 5)
            let maxRoundForPart = 3;
            filteredTopics.forEach(topic => {
                const key = getTopicKey(currentSubjectId, topic);
                const count = getTopicRoundCount(progress[key]);
                if (count > maxRoundForPart) {
                    maxRoundForPart = count;
                }
            });

            // Build rounds columns based on maxRoundForPart
            const columnsList = [{ key: 'concept', label: 'Concept / Video' }];
            for (let i = 1; i <= maxRoundForPart; i++) {
                columnsList.push({ key: `r${i}`, label: `R${i}` });
                columnsList.push({ key: `t${i}`, label: `T${i}` });
            }

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
                                    <th class="col-status">Status</th>
                                    <th class="col-topic">Subject / Topic Name</th>
                                    ${columnsList.map(r => `<th class="col-round ${r.key === 'concept' ? 'col-concept' : ''}">${r.label}</th>`).join('')}
                                    <th class="col-add-round">Add</th>
                                </tr>
                            </thead>
                            <tbody>
                                ${filteredTopics.map((topic) => {
                                    const key = getTopicKey(currentSubjectId, topic);
                                    const itemData = progress[key] || {};
                                    const isDone = !!itemData.done;
                                    const topicRounds = getTopicRoundCount(itemData);
                                    const escapedTopic = topic.replace(/'/g, "\\'");

                                    const roundCells = columnsList.map(col => {
                                        if (col.key === 'concept') {
                                            const isConceptChecked = !!itemData.concept;
                                            return `
                                                <td class="col-round col-concept">
                                                    <label class="custom-checkbox-wrap round-check-wrap" title="Concept / Video">
                                                        <input type="checkbox" ${isConceptChecked ? 'checked' : ''} onchange="SyllabusManager.toggleRound('${currentSubjectId}', '${escapedTopic}', 'concept', this.checked)">
                                                        <span class="checkmark"></span>
                                                    </label>
                                                </td>
                                            `;
                                        }

                                        // Extract round number from col.key (e.g. r4 -> 4)
                                        const roundNum = parseInt(col.key.substring(1), 10);
                                        if (roundNum <= topicRounds) {
                                            const isChecked = !!itemData[col.key];
                                            return `
                                                <td class="col-round">
                                                    <label class="custom-checkbox-wrap round-check-wrap" title="${col.label}">
                                                        <input type="checkbox" ${isChecked ? 'checked' : ''} onchange="SyllabusManager.toggleRound('${currentSubjectId}', '${escapedTopic}', '${col.key}', this.checked)">
                                                        <span class="checkmark"></span>
                                                    </label>
                                                </td>
                                            `;
                                        } else {
                                            return `<td class="col-round text-center"><span class="disabled-dash">—</span></td>`;
                                        }
                                    }).join('');

                                    const canAddMore = topicRounds < 5;
                                    const hasExtraRounds = topicRounds > 3;

                                    let actionContent = '';
                                    if (canAddMore) {
                                        actionContent += `
                                            <button type="button" class="syllabus-add-round-btn" title="Add R${topicRounds + 1} & T${topicRounds + 1}" onclick="SyllabusManager.addNextRound('${currentSubjectId}', '${escapedTopic}')">
                                                <i class="ph-bold ph-plus"></i>
                                            </button>
                                        `;
                                    } else {
                                        actionContent += `<span class="max-rounds-badge" title="Max 5 Revisions Reached">Max</span>`;
                                    }

                                    if (hasExtraRounds) {
                                        actionContent += `
                                            <button type="button" class="syllabus-undo-round-btn" title="Undo R${topicRounds} & T${topicRounds}" onclick="SyllabusManager.removeLastRound('${currentSubjectId}', '${escapedTopic}')">
                                                <i class="ph-bold ph-arrow-u-up-left"></i>
                                            </button>
                                        `;
                                    }

                                    const addActionCell = `
                                        <td class="col-add-round">
                                            <div class="table-actions-cell">
                                                ${actionContent}
                                            </div>
                                        </td>
                                    `;

                                    return `
                                        <tr class="syllabus-topic-row ${isDone ? 'is-completed' : ''}">
                                            <td class="col-status">
                                                <label class="custom-checkbox-wrap" title="Status Done">
                                                    <input type="checkbox" ${isDone ? 'checked' : ''} onchange="SyllabusManager.toggleTopicDone('${currentSubjectId}', '${escapedTopic}', this.checked)">
                                                    <span class="checkmark"></span>
                                                </label>
                                            </td>
                                            <td class="col-topic">
                                                <span class="topic-name-text ${isDone ? 'strike' : ''}">${topic}</span>
                                            </td>
                                            ${roundCells}
                                            ${addActionCell}
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
                            const topicRounds = getTopicRoundCount(itemData);
                            const escapedTopic = topic.replace(/'/g, "\\'");

                            // Build rounds list for this specific topic
                            const topicCols = [{ key: 'concept', label: 'Concept / Video' }];
                            for (let i = 1; i <= topicRounds; i++) {
                                topicCols.push({ key: `r${i}`, label: `R${i}` });
                                topicCols.push({ key: `t${i}`, label: `T${i}` });
                            }

                            const roundCheckboxes = topicCols.map(r => {
                                const isRoundChecked = !!itemData[r.key];
                                const shortLabel = r.key === 'concept' ? 'Concept' : r.label;
                                return `
                                    <label class="apple-round-pill ${isRoundChecked ? 'is-checked' : ''} ${r.key === 'concept' ? 'is-concept' : ''}" title="${r.label}">
                                        <input type="checkbox" ${isRoundChecked ? 'checked' : ''} onchange="SyllabusManager.toggleRound('${currentSubjectId}', '${escapedTopic}', '${r.key}', this.checked)">
                                        <span class="apple-pill-tag">${shortLabel}</span>
                                        <span class="apple-pill-indicator">
                                            <i class="ph-bold ph-check"></i>
                                        </span>
                                    </label>
                                `;
                            }).join('');

                            const canAddMoreMob = topicRounds < 5;
                            const hasExtraRoundsMob = topicRounds > 3;

                            const addBtnMob = canAddMoreMob ? `
                                <button type="button" class="apple-round-add-btn" title="Add R${topicRounds + 1} & T${topicRounds + 1}" onclick="SyllabusManager.addNextRound('${currentSubjectId}', '${escapedTopic}')">
                                    <i class="ph-bold ph-plus"></i>
                                </button>
                            ` : '';

                            const undoBtnMob = hasExtraRoundsMob ? `
                                <button type="button" class="apple-round-undo-btn" title="Undo R${topicRounds} & T${topicRounds}" onclick="SyllabusManager.removeLastRound('${currentSubjectId}', '${escapedTopic}')">
                                    <i class="ph-bold ph-arrow-u-up-left"></i>
                                </button>
                            ` : '';

                            return `
                                <div class="mob-topic-card ${isDone ? 'is-completed' : ''}">
                                    <div class="mob-topic-header">
                                        <label class="custom-checkbox-wrap apple-status-cb" title="Status Done">
                                            <input type="checkbox" ${isDone ? 'checked' : ''} onchange="SyllabusManager.toggleTopicDone('${currentSubjectId}', '${escapedTopic}', this.checked)">
                                            <span class="checkmark"></span>
                                        </label>
                                        <span class="mob-topic-title ${isDone ? 'strike' : ''}">${topic}</span>
                                    </div>
                                    <div class="mob-rounds-row">
                                        <div class="mob-rounds-grid">
                                            ${roundCheckboxes}
                                            ${addBtnMob}
                                            ${undoBtnMob}
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
        addNextRound,
        removeLastRound,
        resetAllExtraRounds,
        setFilter,
        setSearch,
        resetSubjectProgress
    };
})();
