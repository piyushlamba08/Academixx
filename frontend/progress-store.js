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

    async function saveTest(testData) {
        invalidateCache();
        try {
            const res = await fetch(`${API_BASE}/tests`, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify(testData)
            });
            if (!res.ok) throw new Error('Failed to save test');
            return await res.json();
        } catch (e) {
            console.error(e);
            return null;
        }
    }

    async function getTests(forceRefresh = false) {
        if (!forceRefresh && cache.tests) return cache.tests;
        try {
            const res = await fetch(`${API_BASE}/tests`);
            if (!res.ok) throw new Error('Failed to fetch tests');
            const data = await res.json();
            cache.tests = data;
            return data;
        } catch (e) {
            console.error(e);
            return cache.tests || [];
        }
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
