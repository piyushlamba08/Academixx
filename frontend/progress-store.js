const ProgressStore = (() => {
    const API_BASE = 'https://mock-test-backend-crqm.onrender.com/api/progress';

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
            list.unshift(enriched);
            localStorage.setItem(LOCAL_KEY, JSON.stringify(list));
            return enriched;
        } catch (e) {
            console.warn('[ProgressStore] Could not save to localStorage', e);
            return test;
        }
    }

    async function saveTest(testData) {
        invalidateCache();
        // 1. Immediately store in localStorage so data is 100% safe locally
        const total = computeTestTotal(testData);
        const enrichedData = { ...testData, total };
        const localSaved = saveLocalTest(enrichedData);

        // 2. Sync to backend database
        try {
            const res = await fetch(`${API_BASE}/tests`, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify(enrichedData)
            });
            if (!res.ok) throw new Error('Failed to save test to remote');
            const data = await res.json();
            return { ...data, total: computeTestTotal(data) || total };
        } catch (e) {
            console.warn('[ProgressStore] Remote save failed, using local backup', e);
            return localSaved;
        }
    }

    async function getTests(forceRefresh = false) {
        if (!forceRefresh && cache.tests) return cache.tests;
        let remoteTests = [];
        try {
            const res = await fetch(`${API_BASE}/tests`);
            if (res.ok) {
                remoteTests = await res.json();
            }
        } catch (e) {
            console.warn('[ProgressStore] Remote fetch failed, falling back to local storage', e);
        }

        // Merge remote tests + any local backup tests not present remotely
        const localTests = getLocalTests();
        const mergedMap = new Map();

        // Add local first
        localTests.forEach(t => { 
            if (t && t.id) {
                mergedMap.set(t.id, { ...t, total: computeTestTotal(t) }); 
            }
        });
        // Add remote (overwrites matching ids with canonical remote version)
        remoteTests.forEach(t => { 
            if (t && t.id) {
                mergedMap.set(t.id, { ...t, total: computeTestTotal(t) }); 
            }
        });

        const merged = Array.from(mergedMap.values()).map(t => ({
            ...t,
            correctCount: Number(t.correctCount) || 0,
            wrongCount: Number(t.wrongCount) || 0,
            skippedCount: Number(t.skippedCount) || 0,
            total: computeTestTotal(t)
        }));
        // Sort descending by completedAt
        merged.sort((a, b) => new Date(b.completedAt || 0) - new Date(a.completedAt || 0));

        cache.tests = merged;
        return merged;
    }

    async function getMistakes({ topic = 'all', activeOnly = true } = {}, forceRefresh = false) {
        const cacheKey = `${topic}_${activeOnly}`;
        if (!forceRefresh && cache.mistakes[cacheKey]) return cache.mistakes[cacheKey];
        try {
            const params = new URLSearchParams({ topic, activeOnly });
            const res = await fetch(`${API_BASE}/mistakes?${params.toString()}`);
            if (!res.ok) throw new Error('Failed to fetch mistakes');
            const data = await res.json();
            cache.mistakes[cacheKey] = data;
            return data;
        } catch (e) {
            console.error(e);
            return cache.mistakes[cacheKey] || [];
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

    return { saveTest, getTests, getMistakes, getTopics, getBestStreak, updateBestStreak, invalidateCache };
})();
