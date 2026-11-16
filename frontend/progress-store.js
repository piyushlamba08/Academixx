const ProgressStore = (() => {
    const isLocal = typeof window !== 'undefined' && (window.location.hostname === 'localhost' || window.location.hostname === '127.0.0.1');
    const API_BASE = isLocal ? 'http://localhost:8000/api/progress' : (window.BACKEND_URL ? `${window.BACKEND_URL}/api/progress` : 'https://mock-test-backend-crqm.onrender.com/api/progress');

    // In-memory cache for instant zero-lag page navigation
    const cache = {
        tests: null,
        mistakes: {},
        topics: null,
        bestStreak: null
    };

    function invalidateCache() {
        cache.tests = null;
        cache.mistakes = {};
        cache.topics = null;
        cache.bestStreak = null;
    }

    const LOCAL_KEY = 'academix_tests_backup';

    function computeTestTotal(t) {
        if (!t) return 0;
        const total = Number(t.total);
        if (Number.isFinite(total) && total > 0) return total;
        if (Array.isArray(t.questions) && t.questions.length > 0) return t.questions.length;
        const sum = (Number(t.correctCount) || 0) + (Number(t.wrongCount) || 0) + (Number(t.skippedCount) || 0);
        return sum > 0 ? sum : 0;
    }

    function getLocalTests() {
        try {
            const list = JSON.parse(localStorage.getItem(LOCAL_KEY) || '[]');
            let changed = false;
            const sanitized = list.map(t => {
                if (!t) return t;
                const total = computeTestTotal(t);
                if (t.total !== total) {
                    changed = true;
                    return { ...t, total };
                }
                return t;
            });
            if (changed) {
                try {
                    localStorage.setItem(LOCAL_KEY, JSON.stringify(sanitized));
                } catch {}
            }
            return sanitized;
        } catch {
            return [];
        }
    }

    function clearLocalTests() {
        try {
            localStorage.removeItem(LOCAL_KEY);
        } catch {}
    }

    function removeLocalTest(id) {
        try {
            const list = getLocalTests().filter(x => x && x.id !== id);
            if (list.length === 0) {
                clearLocalTests();
            } else {
                localStorage.setItem(LOCAL_KEY, JSON.stringify(list));
            }
        } catch {}
    }

    function saveLocalTest(test) {
        try {
            const list = getLocalTests();
            const total = computeTestTotal(test);
            const enriched = {
                id: test.id || `local_${Date.now()}_${Math.random().toString(36).substr(2, 5)}`,
                completedAt: test.completedAt || new Date().toISOString(),
                ...test,
                total
            };
            const existingIdx = list.findIndex(x => x.id === enriched.id);
            if (existingIdx >= 0) {
                list[existingIdx] = enriched;
            } else {
                list.unshift(enriched);
            }
            localStorage.setItem(LOCAL_KEY, JSON.stringify(list));
            return enriched;
        } catch (e) {
            console.warn('[ProgressStore] Could not save to localStorage', e);
            return test;
        }
    }

    async function syncOfflineTestsToRemote() {
        const localTests = getLocalTests();
        if (!localTests || localTests.length === 0) return;

        // Push any test marked as pending offline
        const pending = localTests.filter(t => t && t._isOfflinePending);
        for (const test of pending) {
            try {
                const cleanTest = { ...test };
                delete cleanTest._isOfflinePending;
                await fetch(`${API_BASE}/tests`, {
                    method: 'POST',
                    headers: { 'Content-Type': 'application/json' },
                    body: JSON.stringify(cleanTest)
                });
            } catch (e) {
                console.warn('[ProgressStore] Failed to sync pending offline test', e);
            }
        }
        // Once online and synced, purge local storage so DB remains single source of truth
        clearLocalTests();
    }

    async function saveTest(testData) {
        invalidateCache();
        const total = computeTestTotal(testData);
        const testId = testData.id || `test_${Date.now()}_${Math.random().toString(36).substr(2, 6)}`;
        const completedAt = testData.completedAt || new Date().toISOString();
        const enrichedData = { ...testData, id: testId, completedAt, total };

        // 1. Attempt direct save to backend database
        try {
            const res = await fetch(`${API_BASE}/tests`, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify(enrichedData)
            });
            if (!res.ok) throw new Error('Failed to save test to remote');
            const data = await res.json();
            const canonical = { ...data, total: computeTestTotal(data) || total };
            // Ensure no lingering copy in localStorage
            removeLocalTest(testId);
            return canonical;
        } catch (e) {
            console.warn('[ProgressStore] Remote save failed, queueing offline in localStorage', e);
            enrichedData._isOfflinePending = true;
            return saveLocalTest(enrichedData);
        }
    }

    async function getTests(forceRefresh = false) {
        if (!forceRefresh && cache.tests) return cache.tests;
        let remoteTests = null;
        let remoteSuccess = false;
        try {
            const res = await fetch(`${API_BASE}/tests`);
            if (res.ok) {
                remoteTests = await res.json();
                remoteSuccess = true;
            }
        } catch (e) {
            console.warn('[ProgressStore] Remote fetch failed, using offline fallback', e);
        }

        // DATABASE IS PRIMARY & SOLE SOURCE OF TRUTH WHEN ONLINE
        if (remoteSuccess && Array.isArray(remoteTests)) {
            // Push any pending offline tests and wipe localStorage clean
            await syncOfflineTestsToRemote();

            const canonical = remoteTests.map(t => ({
                ...t,
                correctCount: Number(t.correctCount) || 0,
                wrongCount: Number(t.wrongCount) || 0,
                skippedCount: Number(t.skippedCount) || 0,
                total: computeTestTotal(t)
            }));
            canonical.sort((a, b) => new Date(b.completedAt || 0) - new Date(a.completedAt || 0));
            cache.tests = canonical;
            return canonical;
        }

        // OFFLINE FALLBACK: Only used when server is completely unreachable
        const localTests = getLocalTests();
        const fallback = localTests.map(t => ({
            ...t,
            correctCount: Number(t.correctCount) || 0,
            wrongCount: Number(t.wrongCount) || 0,
            skippedCount: Number(t.skippedCount) || 0,
            total: computeTestTotal(t)
        }));
        fallback.sort((a, b) => new Date(b.completedAt || 0) - new Date(a.completedAt || 0));
        cache.tests = fallback;
        return fallback;
    }

    const MISTAKE_TAGS_KEY = 'academix_mistake_tags';

    function getMistakeTags() {
        try {
            return JSON.parse(localStorage.getItem(MISTAKE_TAGS_KEY) || '{}');
        } catch {
            return {};
        }
    }

    function setMistakeTag(key, tag) {
        try {
            const tags = getMistakeTags();
            if (tag) {
                tags[key] = tag;
            } else {
                delete tags[key];
            }
            localStorage.setItem(MISTAKE_TAGS_KEY, JSON.stringify(tags));
            cache.mistakes = {};
            return tags;
        } catch (e) {
            console.warn('[ProgressStore] Could not save mistake tag', e);
            return {};
        }
    }

    async function getMistakes({ topic = 'all', activeOnly = true } = {}, forceRefresh = false) {
        const cacheKey = `${topic}_${activeOnly}`;
        const tags = getMistakeTags();
        if (!forceRefresh && cache.mistakes[cacheKey]) {
            return cache.mistakes[cacheKey].map(m => ({ ...m, mistakeTag: tags[m.key] || null }));
        }
        try {
            const params = new URLSearchParams({ topic, activeOnly });
            const res = await fetch(`${API_BASE}/mistakes?${params.toString()}`);
            if (!res.ok) throw new Error('Failed to fetch mistakes');
            const data = await res.json();
            const enriched = data.map(m => ({ ...m, mistakeTag: tags[m.key] || null }));
            cache.mistakes[cacheKey] = enriched;
            return enriched;
        } catch (e) {
            console.error(e);
            const fallback = cache.mistakes[cacheKey] || [];
            return fallback.map(m => ({ ...m, mistakeTag: tags[m.key] || null }));
        }
    }

    async function getTopics(forceRefresh = false) {
        if (!forceRefresh && cache.topics) return cache.topics;
        try {
            const res = await fetch(`${API_BASE}/topics`);
            if (!res.ok) throw new Error('Failed to fetch topics');
            const data = await res.json();
            cache.topics = data;
            return data;
        } catch (e) {
            console.error(e);
            return cache.topics || [];
        }
    }

    async function getBestStreak(forceRefresh = false) {
        if (!forceRefresh && cache.bestStreak !== null) return cache.bestStreak;
        try {
            const res = await fetch(`${API_BASE}/streak`);
            if (!res.ok) throw new Error('Failed to fetch streak');
            const data = await res.json();
            cache.bestStreak = data.bestStreak;
            return data.bestStreak;
        } catch (e) {
            console.error(e);
            return cache.bestStreak !== null ? cache.bestStreak : 0;
        }
    }

    async function updateBestStreak(candidate) {
        invalidateCache();
        try {
            const res = await fetch(`${API_BASE}/streak`, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ candidate })
            });
            if (!res.ok) throw new Error('Failed to update streak');
            const data = await res.json();
            cache.bestStreak = data.bestStreak;
            return data.bestStreak;
        } catch (e) {
            console.error(e);
            return 0;
        }
    }

    async function getSyllabus() {
        try {
            const res = await fetch(`${API_BASE}/syllabus`);
            if (!res.ok) throw new Error('Failed to fetch remote syllabus');
            const json = await res.json();
            return json.data || {};
        } catch (e) {
            console.warn('[ProgressStore] Could not fetch remote syllabus', e);
            return null;
        }
    }

    async function saveSyllabus(syllabusData) {
        try {
            const res = await fetch(`${API_BASE}/syllabus`, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ data: syllabusData })
            });
            if (!res.ok) throw new Error('Failed to save remote syllabus');
            return await res.json();
        } catch (e) {
            console.warn('[ProgressStore] Could not save remote syllabus', e);
            return null;
        }
    }

    async function wipeAllData() {
        let remoteSuccess = false;
        try {
            const res = await fetch(`${API_BASE}/clean-data`, { method: 'DELETE' });
            if (res.ok) {
                remoteSuccess = true;
            }
        } catch (e) {
            console.warn('[ProgressStore] Remote wipe request failed', e);
        }

        // Wipe local caches & backup storage so no lingering zombie items remain
        clearLocalTests();
        try {
            localStorage.removeItem(LOCAL_KEY);
            localStorage.removeItem('academix_streak');
            localStorage.removeItem('academix_mistake_tags');
        } catch (e) {
            console.warn('[ProgressStore] Failed to clear local storage items', e);
        }
        invalidateCache();

        return remoteSuccess;
    }

    return { 
        saveTest, 
        getTests, 
        getMistakes, 
        getTopics, 
        getBestStreak, 
        updateBestStreak, 
        invalidateCache, 
        getMistakeTags, 
        setMistakeTag,
        getSyllabus,
        saveSyllabus,
        wipeAllData
    };
})();
