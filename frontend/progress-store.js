const ProgressStore = (() => {
    const API_BASE = 'http://localhost:8000/api/progress';

    async function saveTest(testData) {
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

    async function getTests() {
        try {
            const res = await fetch(`${API_BASE}/tests`);
            if (!res.ok) throw new Error('Failed to fetch tests');
            return await res.json();
        } catch (e) {
            console.error(e);
            return [];
        }
    }

    async function getMistakes({ topic = 'all', activeOnly = true } = {}) {
        try {
            const params = new URLSearchParams({ topic, activeOnly });
            const res = await fetch(`${API_BASE}/mistakes?${params.toString()}`);
            if (!res.ok) throw new Error('Failed to fetch mistakes');
            return await res.json();
        } catch (e) {
            console.error(e);
            return [];
        }
    }

    async function getTopics() {
        try {
            const res = await fetch(`${API_BASE}/topics`);
            if (!res.ok) throw new Error('Failed to fetch topics');
            return await res.json();
        } catch (e) {
            console.error(e);
            return [];
        }
    }

    async function getBestStreak() {
        try {
            const res = await fetch(`${API_BASE}/streak`);
            if (!res.ok) throw new Error('Failed to fetch streak');
            const data = await res.json();
            return data.bestStreak;
        } catch (e) {
            console.error(e);
            return 0;
        }
    }

    async function updateBestStreak(candidate) {
        try {
            const res = await fetch(`${API_BASE}/streak`, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ candidate })
            });
            if (!res.ok) throw new Error('Failed to update streak');
            const data = await res.json();
            return data.bestStreak;
        } catch (e) {
            console.error(e);
            return 0;
        }
    }

    return { saveTest, getTests, getMistakes, getTopics, getBestStreak, updateBestStreak };
})();
