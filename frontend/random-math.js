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
        'fractionToPercent': 'Fraction → % Drill'
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

        if (currentOperation !== 'random') {
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
                }

                // For % drills the generator already returns MCQ options
                let finalInputMode = (op === 'squareRoot' || forceMCQ || ['percentToFraction','fractionToPercent'].includes(op)) ? 'mcq' : defaultInputMode;

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

        // Configure Quiz Engine
        QuizEngine.state.negativeMarking = negativeMarking;
        QuizEngine.state.timerMode = timerSetting.startsWith('countdown') ? 'countdown' : 'stopwatch';
        let durationMins = 0;
        if (timerSetting === 'countdown_15') durationMins = 15;
        if (timerSetting === 'countdown_20') durationMins = 20;

        QuizEngine.startQuiz(questions, durationMins);
    });
});
