const ProgressStore = (() => {
    const isLocal = typeof window !== 'undefined' && (
        window.location.hostname === 'localhost' || 
        window.location.hostname === '127.0.0.1' ||
        window.location.hostname.startsWith('192.168.') ||
        window.location.hostname.startsWith('10.') ||
        window.location.hostname.startsWith('172.') ||
        window.location.hostname.endsWith('.local')
    );
    const localHost = (typeof window !== 'undefined' && window.location.hostname) ? window.location.hostname : 'localhost';
    const API_BASE = isLocal ? `http://${localHost}:8000/api/progress` : (window.BACKEND_URL ? `${window.BACKEND_URL}/api/progress` : 'https://mock-test-backend-crqm.onrender.com/api/progress');

    // Purge legacy localStorage keys that previously caused cross-browser desync
    try {
        localStorage.removeItem('academix_wiped_timestamp');
        localStorage.removeItem('academix_tests_backup');
    } catch {}

    // In-memory cache for snappy navigation (invalidated automatically on saves and wipes)
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

    function computeTestTotal(t) {
        if (!t) return 0;
        const total = Number(t.total);
        if (Number.isFinite(total) && total > 0) return total;
        if (Array.isArray(t.questions) && t.questions.length > 0) return t.questions.length;
        const sum = (Number(t.correctCount) || 0) + (Number(t.wrongCount) || 0) + (Number(t.skippedCount) || 0);
        return sum > 0 ? sum : 0;
    }

    // Save test directly to Database — NO localStorage fallback / divergence
    async function saveTest(testData) {
        invalidateCache();
        const total = computeTestTotal(testData);
        const testId = testData.id || `test_${Date.now()}_${Math.random().toString(36).substr(2, 6)}`;
        const completedAt = testData.completedAt || new Date().toISOString();
        const enrichedData = { ...testData, id: testId, completedAt, total };

        try {
            const res = await fetch(`${API_BASE}/tests`, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify(enrichedData)
            });
            if (!res.ok) throw new Error(`HTTP ${res.status}: Failed to save test to remote DB`);
            const data = await res.json();
            return { ...data, total: computeTestTotal(data) || total };
        } catch (e) {
            console.error('[ProgressStore] Database save error', e);
            return enrichedData;
        }
    }

    // Get tests directly from Database — SOLE SOURCE OF TRUTH ACROSS ALL BROWSERS
    async function getTests(forceRefresh = false) {
        if (!forceRefresh && cache.tests) return cache.tests;
        try {
            const res = await fetch(`${API_BASE}/tests`);
            if (res.ok) {
                const remoteTests = await res.json();
                const canonical = (Array.isArray(remoteTests) ? remoteTests : []).map(t => ({
                    ...t,
                    correctCount: Number(t.correctCount) || 0,
                    wrongCount: Number(t.wrongCount) || 0,
                    skippedCount: Number(t.skippedCount) || 0,
                    total: computeTestTotal(t)
                }));
                canonical.sort((a, b) => new Date(b.completedAt || 0) - new Date(a.completedAt || 0));
                cache.tests = canonical;
                return canonical;
            } else {
                console.warn('[ProgressStore] Remote fetch returned status:', res.status);
            }
        } catch (e) {
            console.warn('[ProgressStore] Remote fetch failed:', e);
        }
        return cache.tests || [];
    }

    async function deleteTest(id) {
        if (!id) return false;
        invalidateCache();

        try {
            let res = await fetch(`${API_BASE}/tests/delete`, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ id })
            });
            if (!res.ok) {
                res = await fetch(`${API_BASE}/tests/${encodeURIComponent(id)}`, {
                    method: 'DELETE'
                });
            }
            invalidateCache();
            return res.ok;
        } catch (e) {
            console.warn('[ProgressStore] Failed to delete test from DB', e);
            invalidateCache();
            return false;
        }
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
            const enriched = (Array.isArray(data) ? data : []).map(m => ({ ...m, mistakeTag: tags[m.key] || null }));
            cache.mistakes[cacheKey] = enriched;
            return enriched;
        } catch (e) {
            console.error(e);
            const fallback = cache.mistakes[cacheKey] || [];
            return fallback.map(m => ({ ...m, mistakeTag: tags[m.key] || null }));
        }
    }

    async function deleteMistake(key) {
        if (!key) return false;
        invalidateCache();

        try {
            const tags = getMistakeTags();
            if (tags[key]) {
                delete tags[key];
                localStorage.setItem(MISTAKE_TAGS_KEY, JSON.stringify(tags));
            }
        } catch {}

        try {
            let res = await fetch(`${API_BASE}/mistakes/delete`, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ key })
            });
            if (!res.ok) {
                res = await fetch(`${API_BASE}/mistakes?key=${encodeURIComponent(key)}`, {
                    method: 'DELETE'
                });
            }
            invalidateCache();
            return res.ok;
        } catch (e) {
            console.warn('[ProgressStore] Failed to delete mistake from DB', e);
            invalidateCache();
            return false;
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
        // Clear any legacy keys from localStorage to prevent lingering stale data
        try {
            localStorage.removeItem('academix_wiped_timestamp');
            localStorage.removeItem('academix_tests_backup');
            localStorage.removeItem('academix_streak');
            localStorage.removeItem('academix_mistake_tags');
        } catch (e) {
            console.warn('[ProgressStore] Failed to clear legacy local items', e);
        }

        invalidateCache();

        let remoteSuccess = false;
        try {
            let res = await fetch(`${API_BASE}/clean-data`, { method: 'DELETE' });
            if (!res.ok) {
                res = await fetch(`${API_BASE}/clean-data`, { method: 'POST' });
            }
            if (res.ok) {
                remoteSuccess = true;
            }
        } catch (e) {
            console.warn('[ProgressStore] Remote wipe request failed', e);
        }

        invalidateCache();
        return remoteSuccess;
    }

    return { 
        saveTest, 
        getTests, 
        deleteTest,
        getMistakes, 
        deleteMistake,
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
