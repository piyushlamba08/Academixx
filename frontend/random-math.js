let currentOperation = null;

window.selectOperation = function(op) {
    currentOperation = op;
    
    const titles = {
        'addition': 'Addition Quiz',
        'subtraction': 'Subtraction Quiz',
        'multiplication': 'Multiplication Quiz',
        'division': 'Division Quiz',
        'square': 'Squares (1-50)',
        'cube': 'Cubes (1-20)',
        'squareRoot': 'Square Roots',
        'tables': 'Multiplication Tables',
        'random': 'Mixed Questions',
        'percentToFraction': '% → Fraction Drill',
        'fractionToPercent': 'Fraction → % Drill',
        'bigCalculation': 'Big Calculations Drill'
    };
    document.getElementById('setup-title').textContent = titles[op];

    document.getElementById('setting-complexity').style.display = 'block';
    document.getElementById('setting-terms').style.display = 'block';
    document.getElementById('setting-decimals').style.display = 'flex';
    document.getElementById('setting-tables').style.display = 'none';
    document.getElementById('setting-input-mode').style.display = 'block';

    const mcqBtn = document.querySelector('.input-mode-btn[data-imode="mcq"]');
    const manualBtn = document.querySelector('.input-mode-btn[data-imode="manual"]');
    mcqBtn.disabled = false;
    manualBtn.disabled = false;

    if (['square', 'cube', 'squareRoot', 'tables'].includes(op)) {
        document.getElementById('setting-complexity').style.display = 'none';
        document.getElementById('setting-decimals').style.display = 'none';
    }

    if (['division', 'square', 'cube', 'squareRoot', 'tables', 'random'].includes(op)) {
        document.getElementById('setting-terms').style.display = 'none';
    }

    if (op === 'tables') {
        document.getElementById('setting-tables').style.display = 'block';
    }

    if (['squareRoot', 'random'].includes(op)) {
        mcqBtn.click();
        manualBtn.disabled = true;
    }

    if (['percentToFraction', 'fractionToPercent'].includes(op)) {
        document.getElementById('setting-complexity').style.display = 'none';
        document.getElementById('setting-terms').style.display = 'none';
        document.getElementById('setting-decimals').style.display = 'none';
        document.getElementById('setting-tables').style.display = 'none';
        mcqBtn.click();
        manualBtn.disabled = true;
    }

    if (op === 'bigCalculation') {
        document.getElementById('setting-complexity').style.display = 'none';
        document.getElementById('setting-terms').style.display = 'block';
        document.getElementById('setting-decimals').style.display = 'none';
        document.getElementById('setting-tables').style.display = 'none';
        mcqBtn.click();
        manualBtn.disabled = true;
    }

    QuizEngine.showScreen(document.getElementById('setup-screen'));
};

document.addEventListener('DOMContentLoaded', () => {
    // Mode buttons logic
    document.querySelectorAll('.difficulty-modes').forEach(group => {
        const btns = group.querySelectorAll('button');
        btns.forEach(btn => {
            btn.addEventListener('click', () => {
                if (btn.disabled) return;
                btns.forEach(b => b.classList.remove('active'));
                btn.classList.add('active');
            });
        });
    });

    // Helper to generate a random number within digits range
    function getRandomNumber(digits, allowDecimals) {
        const min = Math.pow(10, digits - 1);
        const max = Math.pow(10, digits) - 1;
        let num = Math.floor(Math.random() * (max - min + 1)) + min;
        
        if (allowDecimals && Math.random() > 0.5) {
            num = +(num + Math.random()).toFixed(2);
        }
        return num;
    }

    function generateOptions(correctAnswer) {
        if (isNaN(correctAnswer)) return ["0", "1", "2", "3"];

        const options = new Set([correctAnswer.toString()]);
        let attempts = 0;
        
        while(options.size < 4 && attempts < 100) {
            attempts++;
            const offset = (Math.random() * 20 - 10);
            let wrong = correctAnswer + offset;
            
            if (Number.isInteger(correctAnswer)) {
                wrong = Math.floor(wrong);
            } else {
                wrong = +(wrong.toFixed(2));
            }
            
            if (wrong !== correctAnswer && wrong > 0) {
                options.add(wrong.toString());
            }
        }
        
        // Fallback to guarantee we always get 4 options
        let fallback = 1;
        while (options.size < 4) {
            let alt = correctAnswer + fallback;
            if (alt > 0) options.add(alt.toString());
            fallback++;
        }
        
        const optionsArr = Array.from(options);
        for (let i = optionsArr.length - 1; i > 0; i--) {
            const j = Math.floor(Math.random() * (i + 1));
            [optionsArr[i], optionsArr[j]] = [optionsArr[j], optionsArr[i]];
        }
        return optionsArr;
    }

    function generateAddition(digits, terms, allowDecimal) {
        let nums = [];
        for(let i=0; i<terms; i++) nums.push(getRandomNumber(digits, allowDecimal));
        let sum = nums.reduce((a, b) => a + b, 0);
        if(allowDecimal) sum = +(sum.toFixed(2));
        
        return {
            question: nums.join(' + ') + ' = ?',
            correctAnswer: sum.toString()
        };
    }

    function generateSubtraction(digits, terms, allowDecimal) {
        let nums = [];
        for(let i=0; i<terms-1; i++) nums.push(getRandomNumber(digits, allowDecimal));
        let finalAns = getRandomNumber(digits, allowDecimal);
        
        let startNum = finalAns + nums.reduce((a, b) => a + b, 0);
        if(allowDecimal) startNum = +(startNum.toFixed(2));
        
        let questionParts = [startNum, ...nums];
        return {
            question: questionParts.join(' - ') + ' = ?',
            correctAnswer: finalAns.toString()
        };
    }

    function generateMultiplication(digits, terms, allowDecimal) {
        let nums = [];
        for(let i=0; i<terms; i++) nums.push(getRandomNumber(digits, allowDecimal));
        let prod = nums.reduce((a, b) => a * b, 1);
        if(allowDecimal) prod = +(prod.toFixed(2));
        
        return {
            question: nums.join(' × ') + ' = ?',
            correctAnswer: prod.toString()
        };
    }

    function generateDivision(digits, allowDecimal) {
        if (!allowDecimal) {
            let ans = getRandomNumber(digits, false);
            let denom = getRandomNumber(digits, false);
            let num = ans * denom;
            return {
                question: `${num} ÷ ${denom} = ?`,
                correctAnswer: ans.toString()
            };
        } else {
            let num = getRandomNumber(digits, true);
            let denom = getRandomNumber(digits, false);
            let ans = +( (num / denom).toFixed(2) );
            return {
                question: `${num} ÷ ${denom} = ?`,
                correctAnswer: ans.toString()
            };
        }
    }

    function generateSquare() {
        let num = Math.floor(Math.random() * 50) + 1; // 1 to 50
        return {
            question: `${num}² = ?`,
            correctAnswer: (num * num).toString()
        };
    }

    function generateCube() {
        let num = Math.floor(Math.random() * 20) + 1; // 1 to 20
        return {
            question: `${num}³ = ?`,
            correctAnswer: (num * num * num).toString()
        };
    }

    function generateSquareRoot() {
        let root = Math.floor(Math.random() * 100) + 1; // 1 to 100
        let num = root * root;
        return {
            question: `√${num} = ?`,
            correctAnswer: root.toString()
        };
    }

    function generateTable() {
        const tableFrom = parseInt(document.getElementById('table-from').value) || 2;
        const tableTo = parseInt(document.getElementById('table-to').value) || 12;
        const multFrom = parseInt(document.getElementById('multiplier-from').value) || 1;
        const multTo = parseInt(document.getElementById('multiplier-to').value) || 12;
        
        const t = Math.floor(Math.random() * (tableTo - tableFrom + 1)) + tableFrom;
        const m = Math.floor(Math.random() * (multTo - multFrom + 1)) + multFrom;
        
        return {
            question: `${t} × ${m} = ?`,
            correctAnswer: (t * m).toString()
        };
    }

    // ── Percentage ↔ Fraction drills ──────────────────────────────────────
    // Common exam-level percent↔fraction pairs used in bank/SSC/CAT exams
    const PCT_FRAC_PAIRS = [
        { pct: '10%',       frac: '1/10',  decPct: 10 },
        { pct: '12.5%',     frac: '1/8',   decPct: 12.5 },
        { pct: '16.67%',    frac: '1/6',   decPct: 100/6 },
        { pct: '20%',       frac: '1/5',   decPct: 20 },
        { pct: '25%',       frac: '1/4',   decPct: 25 },
        { pct: '33.33%',    frac: '1/3',   decPct: 100/3 },
        { pct: '37.5%',     frac: '3/8',   decPct: 37.5 },
        { pct: '40%',       frac: '2/5',   decPct: 40 },
        { pct: '50%',       frac: '1/2',   decPct: 50 },
        { pct: '60%',       frac: '3/5',   decPct: 60 },
        { pct: '62.5%',     frac: '5/8',   decPct: 62.5 },
        { pct: '66.67%',    frac: '2/3',   decPct: 200/3 },
        { pct: '75%',       frac: '3/4',   decPct: 75 },
        { pct: '80%',       frac: '4/5',   decPct: 80 },
        { pct: '83.33%',    frac: '5/6',   decPct: 500/6 },
        { pct: '87.5%',     frac: '7/8',   decPct: 87.5 },
        { pct: '90%',       frac: '9/10',  decPct: 90 },
        { pct: '125%',      frac: '5/4',   decPct: 125 },
        { pct: '150%',      frac: '3/2',   decPct: 150 },
        { pct: '175%',      frac: '7/4',   decPct: 175 },
        { pct: '200%',      frac: '2/1',   decPct: 200 },
        { pct: '8.33%',     frac: '1/12',  decPct: 100/12 },
        { pct: '14.28%',    frac: '1/7',   decPct: 100/7 },
        { pct: '11.11%',    frac: '1/9',   decPct: 100/9 },
        { pct: '44.44%',    frac: '4/9',   decPct: 400/9 },
        { pct: '55.55%',    frac: '5/9',   decPct: 500/9 },
        { pct: '22.22%',    frac: '2/9',   decPct: 200/9 },
        { pct: '6.25%',     frac: '1/16',  decPct: 6.25 },
        { pct: '18.75%',    frac: '3/16',  decPct: 18.75 },
        { pct: '43.75%',    frac: '7/16',  decPct: 43.75 },
        { pct: '56.25%',    frac: '9/16',  decPct: 56.25 }
    ];

    function generatePercentToFraction() {
        const pair = PCT_FRAC_PAIRS[Math.floor(Math.random() * PCT_FRAC_PAIRS.length)];
        // Build 4 MCQ options: correct + 3 wrong fractions from other pairs
        const wrongs = PCT_FRAC_PAIRS
            .filter(p => p.frac !== pair.frac)
            .sort(() => Math.random() - 0.5)
            .slice(0, 3)
            .map(p => p.frac);
        const opts = [pair.frac, ...wrongs].sort(() => Math.random() - 0.5);
        return {
            question: `Convert ${pair.pct} to a fraction`,
            correctAnswer: pair.frac,
            options: opts
        };
    }

    function generateFractionToPercent() {
        const pair = PCT_FRAC_PAIRS[Math.floor(Math.random() * PCT_FRAC_PAIRS.length)];
        const wrongs = PCT_FRAC_PAIRS
            .filter(p => p.pct !== pair.pct)
            .sort(() => Math.random() - 0.5)
            .slice(0, 3)
            .map(p => p.pct);
        const opts = [pair.pct, ...wrongs].sort(() => Math.random() - 0.5);
        return {
            question: `Convert ${pair.frac} to percentage`,
            correctAnswer: pair.pct,
            options: opts
        };
    }
    // ────────────────────────────────────────────────────────────────────────

    // Server-side practice endpoints (one per topic, mirrors /api/process-pdf's pattern).
    // If the backend isn't running, we silently fall back to the original
    // client-side generators below — so this still works fully offline.
    const PRACTICE_ENDPOINTS = {
        addition: 'addition',
        subtraction: 'subtraction',
        multiplication: 'multiplication',
        division: 'division',
        square: 'square',
        cube: 'cube',
        squareRoot: 'square-root',
        tables: 'tables'
        // percentToFraction and fractionToPercent are client-side only (no backend needed)
    };

    async function fetchServerQuestions(op, { digits, terms, count, allowDecimals, tableFrom, tableTo, multFrom, multTo }) {
        const endpoint = PRACTICE_ENDPOINTS[op];
        if (!endpoint) return null;
        try {
            const res = await fetch(`http://localhost:8000/api/practice/${endpoint}`, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                    digits, terms, count,
                    allow_decimals: allowDecimals,
                    table_from: tableFrom, table_to: tableTo,
                    multiplier_from: multFrom, multiplier_to: multTo
                })
            });
            if (!res.ok) throw new Error(`Server responded ${res.status}`);
            const data = await res.json();
            if (!data.questions || !data.questions.length) throw new Error('Empty response');
            return data.questions.map(q => ({ question: q.question, correctAnswer: q.correctAnswer, options: q.options || [] }));
        } catch (err) {
            console.warn(`[Practice] Backend endpoint for "${op}" unreachable — using local generator instead.`, err);
            return null;
        }
    }

    // ── Big Calculations Generator (Notebook Copy Style) ─────────────────
    function renderCopyFraction(num, den) {
        return `<span class="copy-fraction"><span class="copy-num">${num}</span><span class="copy-den">${den}</span></span>`;
    }

    function generateBigCalculation(terms = 3) {
        const type = Math.floor(Math.random() * 5);
        let questionHtml = '';
        let ansVal = 0;

        if (type === 0) {
            // Pattern 0: Fraction product chain
            const numPool = [9, 18, 27, 36, 45, 54, 72, 81, 14, 21, 28, 35, 42, 22, 33, 44, 15, 25, 48, 64, 16, 24];
            const denPool = [2, 4, 5, 8, 10, 16, 20, 25, 40, 50];
            const count = Math.min(4, Math.max(2, parseInt(terms) || 3));

            const fractions = [];
            let nProd = 1;
            let dProd = 1;
            for (let i = 0; i < count; i++) {
                const n = numPool[Math.floor(Math.random() * numPool.length)];
                const d = denPool[Math.floor(Math.random() * denPool.length)];
                fractions.push({ n, d });
                nProd *= n;
                dProd *= d;
            }
            ansVal = parseFloat((nProd / dProd).toFixed(4));

            const parts = fractions.map(f => renderCopyFraction(f.n, f.d)).join(' <span class="copy-op">×</span> ');
            questionHtml = `<div class="copy-math-container">${parts} <span class="copy-op">=</span> <span class="copy-qmark">?</span></div>`;

        } else if (type === 1) {
            // Pattern 1: Whole number × Fraction Chain (e.g. 2500 × 18/25 × 14/15)
            const wholePool = [1200, 1400, 1500, 1600, 1800, 2400, 2500, 3200, 3600, 4500, 4800, 5400, 6400, 7200, 9600, 12500, 15625];
            const W = wholePool[Math.floor(Math.random() * wholePool.length)];
            const pairs = [
                [{ n: 18, d: 25 }, { n: 14, d: 15 }],
                [{ n: 27, d: 20 }, { n: 15, d: 18 }],
                [{ n: 28, d: 25 }, { n: 28, d: 25 }],
                [{ n: 22, d: 7 }, { n: 14, d: 25 }],
                [{ n: 35, d: 16 }, { n: 9, d: 14 }],
                [{ n: 45, d: 32 }, { n: 16, d: 15 }],
                [{ n: 24, d: 25 }, { n: 35, d: 18 }],
                [{ n: 21, d: 16 }, { n: 32, d: 27 }]
            ];
            const p = pairs[Math.floor(Math.random() * pairs.length)];
            const raw = (W * p[0].n * p[1].n) / (p[0].d * p[1].d);
            ansVal = parseFloat(raw.toFixed(3));

            questionHtml = `<div class="copy-math-container"><span class="copy-whole-num">${W}</span> <span class="copy-op">×</span> ${renderCopyFraction(p[0].n, p[0].d)} <span class="copy-op">×</span> ${renderCopyFraction(p[1].n, p[1].d)} <span class="copy-op">=</span> <span class="copy-qmark">?</span></div>`;

        } else if (type === 2) {
            // Pattern 2: Two Fraction Products with + or -
            const isAdd = Math.random() > 0.35;
            const opSym = isAdd ? '+' : '−';
            const sets = [
                { f1: { n: 36, d: 5 }, f2: { n: 15, d: 4 }, f3: { n: 28, d: 9 }, f4: { n: 27, d: 14 } },
                { f1: { n: 45, d: 8 }, f2: { n: 16, d: 15 }, f3: { n: 21, d: 10 }, f4: { n: 25, d: 14 } },
                { f1: { n: 72, d: 25 }, f2: { n: 50, d: 9 }, f3: { n: 54, d: 7 }, f4: { n: 28, d: 27 } },
                { f1: { n: 64, d: 15 }, f2: { n: 45, d: 16 }, f3: { n: 35, d: 12 }, f4: { n: 36, d: 25 } },
                { f1: { n: 81, d: 20 }, f2: { n: 25, d: 18 }, f3: { n: 42, d: 11 }, f4: { n: 33, d: 14 } }
            ];
            const s = sets[Math.floor(Math.random() * sets.length)];
            const p1 = (s.f1.n * s.f2.n) / (s.f1.d * s.f2.d);
            const p2 = (s.f3.n * s.f4.n) / (s.f3.d * s.f4.d);
            const raw = isAdd ? (p1 + p2) : (p1 - p2);
            ansVal = parseFloat(raw.toFixed(3));

            questionHtml = `<div class="copy-math-container">(${renderCopyFraction(s.f1.n, s.f1.d)} <span class="copy-op">×</span> ${renderCopyFraction(s.f2.n, s.f2.d)}) <span class="copy-op">${opSym}</span> (${renderCopyFraction(s.f3.n, s.f3.d)} <span class="copy-op">×</span> ${renderCopyFraction(s.f4.n, s.f4.d)}) <span class="copy-op">=</span> <span class="copy-qmark">?</span></div>`;

        } else if (type === 3) {
            // Pattern 3: Big Fraction (Numerator Block / Denominator Block)
            const sets = [
                { top: [72, 36, 19], bot: [25, 16] },
                { top: [54, 75, 28], bot: [45, 14] },
                { top: [144, 45, 17], bot: [36, 25] },
                { top: [84, 63, 26], bot: [42, 18] },
                { top: [96, 55, 39], bot: [48, 22] },
                { top: [108, 49, 15], bot: [42, 27] },
                { top: [81, 64, 25], bot: [36, 40] }
            ];
            const s = sets[Math.floor(Math.random() * sets.length)];
            const topVal = s.top.reduce((a, b) => a * b, 1);
            const botVal = s.bot.reduce((a, b) => a * b, 1);
            ansVal = parseFloat((topVal / botVal).toFixed(3));

            questionHtml = `<div class="copy-math-container"><span class="copy-big-fraction"><span class="copy-big-num">${s.top.join(' × ')}</span><span class="copy-big-den">${s.bot.join(' × ')}</span></span> <span class="copy-op">=</span> <span class="copy-qmark">?</span></div>`;

        } else {
            // Pattern 4: Percentage + Fraction mix
            const sets = [
                { pct: 36, base: 450, f: { n: 15, d: 8 } },
                { pct: 45, base: 640, f: { n: 27, d: 32 } },
                { pct: 28, base: 750, f: { n: 18, d: 25 } },
                { pct: 64, base: 375, f: { n: 21, d: 16 } },
                { pct: 48, base: 625, f: { n: 14, d: 15 } },
                { pct: 72, base: 250, f: { n: 35, d: 18 } }
            ];
            const s = sets[Math.floor(Math.random() * sets.length)];
            const part = (s.pct / 100) * s.base;
            const raw = part * (s.f.n / s.f.d);
            ansVal = parseFloat(raw.toFixed(3));

            questionHtml = `<div class="copy-math-container"><span class="copy-whole-num">${s.pct}% of ${s.base}</span> <span class="copy-op">×</span> ${renderCopyFraction(s.f.n, s.f.d)} <span class="copy-op">=</span> <span class="copy-qmark">?</span></div>`;
        }

        // Smart Options Generation (Realistic spread for speed tricks & elimination)
        const isInt = Number.isInteger(ansVal);
        const precision = isInt ? 0 : Math.min(3, (ansVal.toString().split('.')[1] || '').length);
        const correctStr = isInt ? ansVal.toString() : ansVal.toFixed(precision);

        const optionsSet = new Set([correctStr]);
        let baseDelta;
        if (isInt) {
            baseDelta = ansVal > 1000 ? (Math.random() < 0.5 ? 40 : 60) : 
                       (ansVal > 200 ? (Math.random() < 0.5 ? 16 : 24) : 
                       (ansVal > 50 ? (Math.random() < 0.5 ? 8 : 12) : 4));
        } else {
            baseDelta = ansVal > 500 ? 12.5 : 
                       (ansVal > 50 ? 3.6 : 
                       (ansVal > 10 ? 1.8 : 0.36));
        }

        const multipliers = [1, -1, 2, -2, 3, -3, 1.5, -1.5, 4, -4];
        for (const m of multipliers) {
            if (optionsSet.size >= 4) break;
            const cand = isInt ? Math.round(ansVal + m * baseDelta) : +(ansVal + m * baseDelta).toFixed(precision);
            if (cand > 0 && cand !== ansVal) {
                optionsSet.add(isInt ? cand.toString() : cand.toFixed(precision));
            }
        }

        let f = 1;
        while (optionsSet.size < 4) {
            const fallbackStep = isInt ? 5 : 0.25;
            const alt = isInt ? (ansVal + f * fallbackStep) : +(ansVal + f * fallbackStep).toFixed(precision);
            if (alt > 0 && alt !== ansVal) optionsSet.add(isInt ? alt.toString() : alt.toFixed(precision));
            f++;
        }

        const optionsArr = Array.from(optionsSet);
        for (let i = optionsArr.length - 1; i > 0; i--) {
            const j = Math.floor(Math.random() * (i + 1));
            [optionsArr[i], optionsArr[j]] = [optionsArr[j], optionsArr[i]];
        }

        return {
            question: questionHtml,
            correctAnswer: correctStr,
            options: optionsArr
        };
    }

    document.getElementById('start-math-btn').addEventListener('click', async () => {
        const digitsBtn = document.querySelector('#setting-complexity .mode-btn.active');
        const digits = digitsBtn ? parseInt(digitsBtn.dataset.mode || digitsBtn.dataset.digits) : 2;
        const termsBtn = document.querySelector('#math-terms-group .mode-btn.active');
        const terms = termsBtn ? parseInt(termsBtn.dataset.val) : 2;
        const count = parseInt(document.getElementById('math-questions').value) || 20;
        const allowDecimals = document.getElementById('math-decimals').checked;
        const timerBtn = document.querySelector('#math-timer-group .mode-btn.active');
        const timerSetting = timerBtn ? timerBtn.dataset.val : 'stopwatch';
        const negativeMarking = document.getElementById('math-negative').checked;
        
        const inputModeBtn = document.querySelector('.input-mode-btn.active');
        const defaultInputMode = inputModeBtn ? inputModeBtn.dataset.imode : 'mcq';

        const tableFrom = parseInt(document.getElementById('table-from').value) || 2;
        const tableTo = parseInt(document.getElementById('table-to').value) || 12;
        const multFrom = parseInt(document.getElementById('multiplier-from').value) || 1;
        const multTo = parseInt(document.getElementById('multiplier-to').value) || 12;

        const startBtn = document.getElementById('start-math-btn');
        const originalBtnText = startBtn.textContent;
        startBtn.disabled = true;
        startBtn.textContent = 'Generating...';

        let questions = [];
        const ops = ['addition', 'subtraction', 'multiplication', 'division', 'square', 'cube', 'squareRoot'];

        if (!['random', 'percentToFraction', 'fractionToPercent', 'bigCalculation'].includes(currentOperation)) {
            // Single topic selected — try the dedicated backend endpoint first.
            const serverQuestions = await fetchServerQuestions(currentOperation, { digits, terms, count, allowDecimals, tableFrom, tableTo, multFrom, multTo });
            const finalInputMode = (currentOperation === 'squareRoot') ? 'mcq' : defaultInputMode;

            if (serverQuestions) {
                questions = serverQuestions.map(q => ({
                    question: q.question,
                    correctAnswer: q.correctAnswer,
                    options: finalInputMode === 'mcq' ? q.options : [],
                    inputMode: finalInputMode,
                    userAnswer: null
                }));
            }
        }

        if (questions.length === 0) {
            // Fallback: backend unreachable, or "Mixed Questions" mode (which stays
            // client-side since each question can be a different topic).
            for (let i = 0; i < count; i++) {
                let op = currentOperation;
                let forceMCQ = false;
                let currentTerms = terms;

                if (op === 'random') {
                    op = ops[Math.floor(Math.random() * ops.length)];
                    forceMCQ = true;
                    if (['addition', 'subtraction', 'multiplication'].includes(op)) {
                        currentTerms = Math.floor(Math.random() * 2) + 2; // 2 or 3 terms
                    }
                }

                let qObj = null;
                switch(op) {
                    case 'addition': qObj = generateAddition(digits, currentTerms, allowDecimals); break;
                    case 'subtraction': qObj = generateSubtraction(digits, currentTerms, allowDecimals); break;
                    case 'multiplication': qObj = generateMultiplication(digits, currentTerms, allowDecimals); break;
                    case 'division': qObj = generateDivision(digits, allowDecimals); break;
                    case 'square': qObj = generateSquare(); break;
                    case 'cube': qObj = generateCube(); break;
                    case 'squareRoot': qObj = generateSquareRoot(); break;
                    case 'tables': qObj = generateTable(); break;
                    case 'percentToFraction': qObj = generatePercentToFraction(); break;
                    case 'fractionToPercent': qObj = generateFractionToPercent(); break;
                    case 'bigCalculation': qObj = generateBigCalculation(currentTerms); break;
                }

                // For % and bigCalculation drills the generator already returns MCQ options
                let finalInputMode = (op === 'squareRoot' || op === 'bigCalculation' || forceMCQ || ['percentToFraction','fractionToPercent'].includes(op)) ? 'mcq' : defaultInputMode;

                // Use generator-provided options for % drills; generate for others
                const opts = qObj.options
                    ? qObj.options
                    : (finalInputMode === 'mcq' ? generateOptions(parseFloat(qObj.correctAnswer)) : []);

                questions.push({
                    question: qObj.question,
                    correctAnswer: qObj.correctAnswer,
                    options: opts,
                    inputMode: finalInputMode,
                    userAnswer: null
                });
            }
        }

        startBtn.disabled = false;
        startBtn.textContent = originalBtnText;

        const topicLabel = (currentOperation === 'random') ? 'Mixed Calculation' : (currentOperation === 'bigCalculation' ? 'Big Calculations' : (currentOperation.charAt(0).toUpperCase() + currentOperation.slice(1)));

        // Configure Quiz Engine
        QuizEngine.state.negativeMarking = negativeMarking;
        QuizEngine.state.timerMode = timerSetting.startsWith('countdown') ? 'countdown' : 'stopwatch';
        let durationMins = 0;
        if (timerSetting === 'countdown_15') durationMins = 15;
        if (timerSetting === 'countdown_20') durationMins = 20;

        QuizEngine.startQuiz(questions, durationMins, {
            topic: topicLabel,
            sourceName: `${topicLabel} Speed Drill`,
            trackProgress: true
        });
    });
});
