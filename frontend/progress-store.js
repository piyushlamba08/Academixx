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

    function getLocalTests() {
        try {
            return JSON.parse(localStorage.getItem(LOCAL_KEY) || '[]');
        } catch {
            return [];
        }
    }

    function saveLocalTest(test) {
        try {
            const list = getLocalTests();
            // ensure unique id and completedAt timestamp
            const enriched = {
                id: test.id || `local_${Date.now()}_${Math.random().toString(36).substr(2, 5)}`,
                completedAt: test.completedAt || new Date().toISOString(),
                ...test
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
        const localSaved = saveLocalTest(testData);

        // 2. Sync to backend database
        try {
            const res = await fetch(`${API_BASE}/tests`, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify(testData)
            });
            if (!res.ok) throw new Error('Failed to save test to remote');
            const data = await res.json();
            return data;
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
        localTests.forEach(t => { if (t && t.id) mergedMap.set(t.id, t); });
        // Add remote (overwrites matching ids with canonical remote version)
        remoteTests.forEach(t => { if (t && t.id) mergedMap.set(t.id, t); });

        const merged = Array.from(mergedMap.values());
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
