/**
 * DailyPlanner — Daily Study Task List & Goal Achievement Tracker
 * Allows planning daily tasks, checking off completions, and reviewing
 * 90%+ target goal streaks, 7-day performance history, and past daily records.
 */
const DailyPlanner = (() => {
    const STORAGE_KEY = 'academix_daily_planner_v1';
    let selectedDateStr = getTodayStr();
    let currentFilter = 'all'; // 'all' | 'pending' | 'completed'

    /* ── Date Helpers ── */
    function getTodayStr() {
        const d = new Date();
        const year = d.getFullYear();
        const month = String(d.getMonth() + 1).padStart(2, '0');
        const day = String(d.getDate()).padStart(2, '0');
        return `${year}-${month}-${day}`;
    }

    function parseDate(dateStr) {
        const [y, m, d] = dateStr.split('-').map(Number);
        return new Date(y, m - 1, d);
    }

    function formatDateKey(d) {
        const year = d.getFullYear();
        const month = String(d.getMonth() + 1).padStart(2, '0');
        const day = String(d.getDate()).padStart(2, '0');
        return `${year}-${month}-${day}`;
    }

    function formatDateDisplay(dateStr) {
        const today = getTodayStr();
        const dateObj = parseDate(dateStr);
        const options = { weekday: 'short', month: 'short', day: 'numeric', year: 'numeric' };
        const formatted = dateObj.toLocaleDateString('en-US', options);
        if (dateStr === today) return `Today, ${formatted}`;
        
        // Yesterday check
        const yest = new Date();
        yest.setDate(yest.getDate() - 1);
        if (dateStr === formatDateKey(yest)) return `Yesterday, ${formatted}`;

        return formatted;
    }

    function formatDayShort(dateStr) {
        const d = parseDate(dateStr);
        return d.toLocaleDateString('en-US', { weekday: 'short' });
    }

    function formatDateNumber(dateStr) {
        const d = parseDate(dateStr);
        return d.getDate();
    }

    /* ── Data Persistence ── */
    function loadData() {
        try {
            const raw = localStorage.getItem(STORAGE_KEY);
            if (!raw) {
                return {
                    settings: { targetPct: 90 },
                    days: {}
                };
            }
            const data = JSON.parse(raw);
            if (!data.settings) data.settings = { targetPct: 90 };
            if (!data.days) data.days = {};
            return data;
        } catch (e) {
            console.error('[DailyPlanner] Error loading data:', e);
            return { settings: { targetPct: 90 }, days: {} };
        }
    }

    function saveData(data) {
        try {
            localStorage.setItem(STORAGE_KEY, JSON.stringify(data));
        } catch (e) {
            console.error('[DailyPlanner] Error saving data:', e);
        }
    }

    function getDayData(dateStr) {
        const data = loadData();
        return data.days[dateStr] || { date: dateStr, tasks: [], note: '' };
    }

    function calculateDayStats(day) {
        if (!day || !day.tasks || day.tasks.length === 0) {
            return { total: 0, done: 0, pending: 0, pct: 0, achieved: false };
        }
        const data = loadData();
        const targetPct = data.settings?.targetPct || 90;
        const total = day.tasks.length;
        const done = day.tasks.filter(t => t.done).length;
        const pending = total - done;
        const pct = Math.round((done / total) * 100);
        const achieved = pct >= targetPct;
        return { total, done, pending, pct, achieved, targetPct };
    }

    /* ── History & Metrics Calculation ── */
    function getHistoryMetrics() {
        const data = loadData();
        const targetPct = data.settings?.targetPct || 90;
        const todayStr = getTodayStr();

        let totalAchievedCount = 0;
        const dayKeys = Object.keys(data.days).sort();

        dayKeys.forEach(k => {
            const d = data.days[k];
            const stats = calculateDayStats(d);
            if (stats.achieved) {
                totalAchievedCount++;
            }
        });

        // Generate Last 7 Days sequence ending today (or selected date)
        const last7Days = [];
        const todayDate = parseDate(todayStr);

        for (let i = 6; i >= 0; i--) {
            const d = new Date(todayDate);
            d.setDate(d.getDate() - i);
            const k = formatDateKey(d);
            const dayObj = data.days[k] || { date: k, tasks: [] };
            const stats = calculateDayStats(dayObj);
            last7Days.push({
                dateStr: k,
                dayName: formatDayShort(k),
                dayNum: formatDateNumber(k),
                isToday: k === todayStr,
                isSelected: k === selectedDateStr,
                total: stats.total,
                done: stats.done,
                pct: stats.pct,
                achieved: stats.achieved
            });
        }

        // Calculate 7-Day Average
        const active7 = last7Days.filter(d => d.total > 0);
        const avg7 = active7.length > 0 
            ? Math.round(active7.reduce((acc, d) => acc + d.pct, 0) / active7.length)
            : 0;

        // Calculate Current Consecutive Streak up to today
        let currentStreak = 0;
        let checkDate = new Date(todayDate);
        
        // If today has tasks and not yet achieved, check if yesterday was achieved
        const todayStats = calculateDayStats(data.days[todayStr]);
        if (todayStats.achieved) {
            currentStreak++;
            checkDate.setDate(checkDate.getDate() - 1);
        } else if (todayStats.total === 0) {
            // Day hasn't started yet, check from yesterday
            checkDate.setDate(checkDate.getDate() - 1);
        } else {
            // Today has tasks but target not reached yet
            checkDate.setDate(checkDate.getDate() - 1);
        }

        while (true) {
            const k = formatDateKey(checkDate);
            const stats = calculateDayStats(data.days[k]);
            if (stats.achieved) {
                currentStreak++;
                checkDate.setDate(checkDate.getDate() - 1);
            } else {
                break;
            }
        }

        // Calculate 30-Day Average
        let sum30 = 0;
        let count30 = 0;
        for (let i = 0; i < 30; i++) {
            const d = new Date(todayDate);
            d.setDate(d.getDate() - i);
            const k = formatDateKey(d);
            const dayObj = data.days[k];
            if (dayObj && dayObj.tasks && dayObj.tasks.length > 0) {
                const stats = calculateDayStats(dayObj);
                sum30 += stats.pct;
                count30++;
            }
        }
        const avg30 = count30 > 0 ? Math.round(sum30 / count30) : 0;

        return {
            targetPct,
            totalAchievedCount,
            currentStreak,
            last7Days,
            avg7,
            avg30,
            activeDaysCount: count30
        };
    }

    /* ── Task Actions ── */
    function addTask(text, subject = 'Quant', priority = 'normal') {
        const cleanText = (text || '').trim();
        if (!cleanText) return;

        const data = loadData();
        if (!data.days[selectedDateStr]) {
            data.days[selectedDateStr] = { date: selectedDateStr, tasks: [], note: '' };
        }

        const newTask = {
            id: 'task_' + Date.now() + '_' + Math.random().toString(36).substr(2, 4),
            text: cleanText,
            subject: subject || 'Quant',
            priority: priority || 'normal',
            done: false,
            createdAt: Date.now(),
            completedAt: null
        };

        data.days[selectedDateStr].tasks.push(newTask);
        saveData(data);
        render();
        updateHomeWidget();
    }

    function toggleTask(taskId) {
        const data = loadData();
        const day = data.days[selectedDateStr];
        if (!day || !day.tasks) return;

        const task = day.tasks.find(t => t.id === taskId);
        if (task) {
            task.done = !task.done;
            task.completedAt = task.done ? Date.now() : null;
            saveData(data);
            render();
            updateHomeWidget();
        }
    }

    function deleteTask(taskId) {
        const data = loadData();
        const day = data.days[selectedDateStr];
        if (!day || !day.tasks) return;

        day.tasks = day.tasks.filter(t => t.id !== taskId);
        saveData(data);
        render();
        updateHomeWidget();
    }

    function markAllCompleted() {
        const data = loadData();
        const day = data.days[selectedDateStr];
        if (!day || !day.tasks || day.tasks.length === 0) return;

        day.tasks.forEach(t => {
            t.done = true;
            t.completedAt = Date.now();
        });
        saveData(data);
        render();
        updateHomeWidget();
    }

    function copyYesterdayPending() {
        const data = loadData();
        const curDate = parseDate(selectedDateStr);
        curDate.setDate(curDate.getDate() - 1);
        const yestKey = formatDateKey(curDate);
        const yestDay = data.days[yestKey];

        if (!yestDay || !yestDay.tasks) {
            alert('No tasks found in previous day to copy.');
            return;
        }

        const pendingTasks = yestDay.tasks.filter(t => !t.done);
        if (pendingTasks.length === 0) {
            alert('Previous day has no pending tasks! All were completed. 🎉');
            return;
        }

        if (!data.days[selectedDateStr]) {
            data.days[selectedDateStr] = { date: selectedDateStr, tasks: [], note: '' };
        }

        pendingTasks.forEach(pt => {
            data.days[selectedDateStr].tasks.push({
                id: 'task_' + Date.now() + '_' + Math.random().toString(36).substr(2, 4),
                text: pt.text,
                subject: pt.subject || 'Revision',
                priority: pt.priority || 'high',
                done: false,
                createdAt: Date.now(),
                completedAt: null
            });
        });

        saveData(data);
        render();
        updateHomeWidget();
    }

    function setTargetThreshold(val) {
        const pct = parseInt(val, 10);
        if (isNaN(pct) || pct < 50 || pct > 100) return;
        const data = loadData();
        data.settings.targetPct = pct;
        saveData(data);
        render();
        updateHomeWidget();
    }

    function changeDateOffset(offset) {
        const cur = parseDate(selectedDateStr);
        cur.setDate(cur.getDate() + offset);
        selectedDateStr = formatDateKey(cur);
        render();
    }

    function selectDate(dateKey) {
        selectedDateStr = dateKey;
        render();
    }

    function setFilter(filter) {
        currentFilter = filter;
        renderTaskList();
        // Update filter chips styling
        document.querySelectorAll('.planner-filter-chip').forEach(btn => {
            btn.classList.toggle('active', btn.dataset.filter === filter);
        });
    }

    /* ── UI Renderers ── */
    function render() {
        const day = getDayData(selectedDateStr);
        const stats = calculateDayStats(day);
        const metrics = getHistoryMetrics();
        const todayStr = getTodayStr();

        // 1. Date Header & Controls
        const dateDisplayEl = document.getElementById('planner-current-date-text');
        const todayBadgeEl = document.getElementById('planner-today-badge');
        if (dateDisplayEl) {
            dateDisplayEl.textContent = formatDateDisplay(selectedDateStr);
        }
        if (todayBadgeEl) {
            todayBadgeEl.style.display = selectedDateStr === todayStr ? 'inline-flex' : 'none';
        }

        // Target Threshold Dropdown sync
        const targetSelect = document.getElementById('planner-target-select');
        if (targetSelect) {
            targetSelect.value = metrics.targetPct.toString();
        }

        // 2. Metrics Cards
        const ringValEl = document.getElementById('planner-day-pct-val');
        const ringCircleEl = document.getElementById('planner-day-ring-fill');
        const tasksRatioEl = document.getElementById('planner-tasks-ratio-text');
        const goalStatusBadge = document.getElementById('planner-goal-status-badge');

        if (ringValEl) ringValEl.textContent = `${stats.pct}%`;
        if (tasksRatioEl) tasksRatioEl.textContent = `${stats.done} of ${stats.total} Tasks Done`;

        if (ringCircleEl) {
            // Circumference for r=38 is 2 * PI * 38 ≈ 238.76
            const c = 238.76;
            ringCircleEl.style.strokeDasharray = `${c}`;
            const offset = c - (stats.pct / 100) * c;
            ringCircleEl.style.strokeDashoffset = `${offset}`;
            ringCircleEl.style.stroke = stats.achieved ? '#10b981' : (stats.pct >= 50 ? '#f59e0b' : '#6366f1');
        }

        if (goalStatusBadge) {
            if (stats.total === 0) {
                goalStatusBadge.className = 'planner-status-pill empty';
                goalStatusBadge.innerHTML = '<i class="ph-bold ph-pencil-simple"></i> Plan Your Day';
            } else if (stats.achieved) {
                goalStatusBadge.className = 'planner-status-pill success';
                goalStatusBadge.innerHTML = `<i class="ph-bold ph-seal-check"></i> Goal Achieved (${stats.pct}% ≥ ${metrics.targetPct}%)`;
            } else {
                const needed = Math.ceil((metrics.targetPct / 100) * stats.total) - stats.done;
                goalStatusBadge.className = 'planner-status-pill pending';
                goalStatusBadge.innerHTML = `<i class="ph-bold ph-hourglass-high"></i> In Progress (${needed > 0 ? needed : 1} more for ${metrics.targetPct}%)`;
            }
        }

        // Lifetime Goals Achieved Count (User specific requirement)
        const lifetimeAchievedEl = document.getElementById('planner-metric-achieved-count');
        if (lifetimeAchievedEl) {
            lifetimeAchievedEl.textContent = metrics.totalAchievedCount;
        }

        // Current Streak
        const streakEl = document.getElementById('planner-metric-streak');
        if (streakEl) {
            streakEl.textContent = metrics.currentStreak;
        }

        // 7-Day & 30-Day Averages
        const avg7El = document.getElementById('planner-metric-avg7');
        const avg30El = document.getElementById('planner-metric-avg30');
        if (avg7El) avg7El.textContent = `${metrics.avg7}%`;
        if (avg30El) avg30El.textContent = `${metrics.avg30}%`;

        // 3. Render 7-Day Interactive Timeline / Bar Strip
        render7DayTimeline(metrics.last7Days, metrics.targetPct);

        // 4. Render Task List for Selected Day
        renderTaskList();

        // 5. Render Monthly History Log Table
        renderMonthlyLog();
    }

    function render7DayTimeline(days, targetPct) {
        const container = document.getElementById('planner-7day-bars');
        if (!container) return;
        container.innerHTML = '';

        days.forEach(d => {
            const barCard = document.createElement('div');
            barCard.className = `planner-timeline-col ${d.isSelected ? 'active-col' : ''}`;
            barCard.onclick = () => selectDate(d.dateStr);

            const isAchieved = d.pct >= targetPct;
            let barColor = 'var(--text-muted)';
            if (d.total > 0) {
                barColor = isAchieved ? '#10b981' : (d.pct >= 50 ? '#f59e0b' : '#818cf8');
            }

            barCard.innerHTML = `
                <div class="timeline-bar-wrap" title="${d.dayName} (${d.dateStr}): ${d.done}/${d.total} tasks (${d.pct}%)">
                    <span class="timeline-pct-badge ${isAchieved ? 'text-green font-bold' : ''}">${d.total > 0 ? d.pct + '%' : '—'}</span>
                    <div class="timeline-bar-track">
                        <div class="timeline-bar-fill" style="height: ${d.pct}%; background: ${barColor};"></div>
                    </div>
                </div>
                <div class="timeline-label-box">
                    <span class="timeline-day-name ${d.isToday ? 'is-today-text' : ''}">${d.isToday ? 'Today' : d.dayName}</span>
                    <span class="timeline-day-num">${d.dayNum}</span>
                    ${isAchieved ? '<i class="ph-fill ph-check-circle timeline-check-icon"></i>' : ''}
                </div>
            `;
            container.appendChild(barCard);
        });
    }

    function renderTaskList() {
        const listContainer = document.getElementById('planner-task-list');
        const emptyState = document.getElementById('planner-empty-tasks');
        if (!listContainer) return;

        const day = getDayData(selectedDateStr);
        let tasks = day.tasks || [];

        if (currentFilter === 'pending') {
            tasks = tasks.filter(t => !t.done);
        } else if (currentFilter === 'completed') {
            tasks = tasks.filter(t => t.done);
        }

        listContainer.innerHTML = '';

        if (tasks.length === 0) {
            if (emptyState) emptyState.style.display = 'flex';
            listContainer.style.display = 'none';
            return;
        }

        if (emptyState) emptyState.style.display = 'none';
        listContainer.style.display = 'flex';

        tasks.forEach(t => {
            const item = document.createElement('div');
            item.className = `planner-task-item ${t.done ? 'is-completed' : ''}`;

            const priorityBadge = t.priority === 'high' 
                ? '<span class="planner-tag-badge priority-high"><i class="ph-bold ph-fire"></i> High</span>'
                : (t.priority === 'medium' ? '<span class="planner-tag-badge priority-med"><i class="ph-bold ph-lightning"></i> Medium</span>' : '');

            const subjectBadge = `<span class="planner-tag-badge subject-tag">${escapeHtml(t.subject || 'Study')}</span>`;

            item.innerHTML = `
                <div class="task-checkbox-wrap" onclick="DailyPlanner.toggleTask('${t.id}')">
                    <input type="checkbox" class="task-checkbox" ${t.done ? 'checked' : ''} onclick="event.stopPropagation(); DailyPlanner.toggleTask('${t.id}')">
                    <div class="custom-checkmark"><i class="ph-bold ph-check"></i></div>
                </div>
                <div class="task-content-wrap" onclick="DailyPlanner.toggleTask('${t.id}')">
                    <span class="task-text">${escapeHtml(t.text)}</span>
                    <div class="task-meta-row">
                        ${subjectBadge}
                        ${priorityBadge}
                    </div>
                </div>
                <div class="task-actions-wrap">
                    <button class="task-del-btn" title="Delete Task" onclick="DailyPlanner.deleteTask('${t.id}')">
                        <i class="ph-bold ph-trash"></i>
                    </button>
                </div>
            `;
            listContainer.appendChild(item);
        });
    }

    function renderMonthlyLog() {
        const tableBody = document.getElementById('planner-history-table-body');
        if (!tableBody) return;

        const data = loadData();
        const targetPct = data.settings?.targetPct || 90;
        const keys = Object.keys(data.days).sort().reverse(); // Most recent first

        tableBody.innerHTML = '';

        const activeKeys = keys.filter(k => data.days[k].tasks && data.days[k].tasks.length > 0);

        if (activeKeys.length === 0) {
            tableBody.innerHTML = `
                <tr>
                    <td colspan="5" style="text-align:center; padding:2rem; color:var(--text-muted);">
                        No study history recorded yet. Add your daily tasks above!
                    </td>
                </tr>
            `;
            return;
        }

        activeKeys.slice(0, 30).forEach(k => {
            const d = data.days[k];
            const stats = calculateDayStats(d);
            const tr = document.createElement('tr');
            tr.className = 'planner-history-row';
            tr.onclick = () => selectDate(k);

            const isAchieved = stats.achieved;
            const statusBadge = isAchieved
                ? `<span class="planner-history-badge hit"><i class="ph-fill ph-check-circle"></i> Target Achieved</span>`
                : (stats.pct >= 50 
                    ? `<span class="planner-history-badge partial">Partial (${stats.pct}%)</span>`
                    : `<span class="planner-history-badge missed">Missed (${stats.pct}%)</span>`);

            tr.innerHTML = `
                <td>
                    <strong>${formatDateDisplay(k)}</strong>
                    ${k === getTodayStr() ? ' <span class="badge-tag">Today</span>' : ''}
                </td>
                <td>${stats.done} / ${stats.total}</td>
                <td>
                    <div class="history-pct-cell">
                        <div class="history-bar-track">
                            <div class="history-bar-fill" style="width:${stats.pct}%; background:${isAchieved ? '#10b981' : (stats.pct>=50 ? '#f59e0b' : '#818cf8')};"></div>
                        </div>
                        <span class="history-pct-num">${stats.pct}%</span>
                    </div>
                </td>
                <td>${statusBadge}</td>
                <td style="text-align:right;">
                    <button class="planner-history-view-btn" onclick="event.stopPropagation(); DailyPlanner.selectDate('${k}')">
                        Inspect Day <i class="ph-bold ph-arrow-right"></i>
                    </button>
                </td>
            `;
            tableBody.appendChild(tr);
        });
    }

    function escapeHtml(str) {
        if (!str) return '';
        return str.replace(/&/g, '&amp;')
                  .replace(/</g, '&lt;')
                  .replace(/>/g, '&gt;')
                  .replace(/"/g, '&quot;')
                  .replace(/'/g, '&#039;');
    }

    /* ── Home Screen Widget Live Updater ── */
    function updateHomeWidget() {
        const todayStr = getTodayStr();
        const day = getDayData(todayStr);
        const stats = calculateDayStats(day);
        const metrics = getHistoryMetrics();

        const widgetRatio = document.getElementById('home-planner-ratio');
        const widgetBar = document.getElementById('home-planner-bar-fill');
        const widgetPct = document.getElementById('home-planner-pct');
        const widgetStreak = document.getElementById('home-planner-streak-count');
        const widgetAchieved = document.getElementById('home-planner-achieved-count');
        const widgetStatus = document.getElementById('home-planner-status-text');

        if (widgetRatio) widgetRatio.textContent = `${stats.done}/${stats.total} Tasks`;
        if (widgetPct) widgetPct.textContent = `${stats.pct}%`;
        if (widgetBar) {
            widgetBar.style.width = `${stats.pct}%`;
            widgetBar.style.background = stats.achieved ? 'linear-gradient(90deg, #10b981, #059669)' : 'linear-gradient(90deg, #6366f1, #3b82f6)';
        }
        if (widgetStreak) widgetStreak.textContent = `${metrics.currentStreak} Days`;
        if (widgetAchieved) widgetAchieved.textContent = `${metrics.totalAchievedCount} Days`;

        if (widgetStatus) {
            if (stats.total === 0) {
                widgetStatus.textContent = 'Plan today\'s tasks now';
            } else if (stats.achieved) {
                widgetStatus.textContent = `🎯 Target Achieved (${stats.pct}% ≥ ${metrics.targetPct}%)!`;
            } else {
                widgetStatus.textContent = `${metrics.targetPct}% target in progress`;
            }
        }
    }

    /* ── Navigation & Initialization ── */
    function open() {
        QuizEngine.showScreen(document.getElementById('daily-planner-screen'));
        ProgressDashboard.updateNavActive('planner');
        selectedDateStr = getTodayStr();
        render();
    }

    function init() {
        // Form listener for adding task
        const form = document.getElementById('planner-add-task-form');
        const input = document.getElementById('planner-new-task-input');
        const subjectSelect = document.getElementById('planner-subject-select');
        const prioritySelect = document.getElementById('planner-priority-select');

        if (form && input) {
            form.addEventListener('submit', (e) => {
                e.preventDefault();
                const text = input.value.trim();
                if (!text) return;
                const subject = subjectSelect ? subjectSelect.value : 'Quant';
                const priority = prioritySelect ? prioritySelect.value : 'normal';
                addTask(text, subject, priority);
                input.value = '';
                input.focus();
            });
        }

        updateHomeWidget();
    }

    // Expose Public API
    return {
        open,
        init,
        render,
        addTask,
        toggleTask,
        deleteTask,
        markAllCompleted,
        copyYesterdayPending,
        setTargetThreshold,
        changeDateOffset,
        selectDate,
        setFilter,
        updateHomeWidget
    };
})();

if (typeof window !== 'undefined') {
    window.DailyPlanner = DailyPlanner;
    document.addEventListener('DOMContentLoaded', () => {
        DailyPlanner.init();
    });
}
if (typeof module !== 'undefined') {
    module.exports = DailyPlanner;
}
