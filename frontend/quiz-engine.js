const QuizEngine = {
    state: {
        questions: [],
        currentIndex: 0,
        timerInterval: null,
        durationSeconds: 0,
        timeRemaining: 0,
        timerMode: 'countdown',
        negativeMarking: false,
        testMeta: null,
        savedTest: null
    },

    els: {
        quizScreen: document.getElementById('quiz-screen'),
        resultScreen: document.getElementById('result-screen'),
        setupScreens: [document.getElementById('setup-screen'), document.getElementById('pdf-screen'), document.getElementById('home-screen')],
        
        timerText: document.getElementById('timer-text'),
        questionNumberBadge: document.getElementById('question-number-badge'),
        questionText: document.getElementById('question-text'),
        optionsContainer: document.getElementById('options-container'),
        manualInputContainer: document.getElementById('manual-input-container'),
        manualAnswerInput: document.getElementById('manual-answer-input'),
        
        backBtn: document.getElementById('back-btn'),
        nextBtn: document.getElementById('next-btn'),
        markReviewBtn: document.getElementById('mark-review-btn'),
        submitTestBtn: document.getElementById('submit-test-btn'),
        
        exitQuizBtn: document.getElementById('exit-quiz-btn'),
        exitModal: document.getElementById('exit-modal'),
        confirmNoBtn: document.getElementById('confirm-no-btn'),
        confirmYesBtn: document.getElementById('confirm-yes-btn'),

        questionPaletteGrid: document.getElementById('question-palette-grid'),
        questionRibbon: document.getElementById('exam-question-ribbon'),
        questionCountBadge: document.getElementById('question-count-badge'),

        scoreText: document.getElementById('score-text'),
        reviewTableBody: document.getElementById('review-table-body'),
        restartBtn: document.getElementById('restart-btn'),
        reviewAnswersBtn: document.getElementById('review-answers-btn'),
        reviewSection: document.getElementById('review-section')
    },

    init() {
        this.els.nextBtn.addEventListener('click', () => this.handleNext());
        this.els.backBtn.addEventListener('click', () => this.handleBack());
        if (this.els.markReviewBtn) {
            this.els.markReviewBtn.addEventListener('click', () => this.handleMarkReview());
        }
        if (this.els.submitTestBtn) {
            this.els.submitTestBtn.addEventListener('click', () => this.submitQuiz());
        }
        
        if (this.els.manualAnswerInput) {
            this.els.manualAnswerInput.addEventListener('input', (e) => {
                const q = this.state.questions[this.state.currentIndex];
                q.userAnswer = e.target.value.trim();
                this.renderPalette();
                this.renderQuestionRibbon();
            });
        }

        // ── Enter Key: auto-advance to next question (or submit on last) ──
        document.addEventListener('keydown', (e) => {
            if (e.key !== 'Enter') return;
            // Only fire when quiz screen is active
            if (!this.els.quizScreen.classList.contains('active')) return;
            // Don't intercept Enter inside the exit-confirmation modal
            if (this.els.exitModal.classList.contains('active')) return;
            // Prevent double-fire if focus is on a button
            if (e.target.tagName === 'BUTTON') return;

            e.preventDefault();
            const isLast = this.state.currentIndex === this.state.questions.length - 1;
            if (isLast) {
                this.submitQuiz();
            } else {
                this.handleNext();
            }
        });
        
        if (this.els.restartBtn) {
            this.els.restartBtn.addEventListener('click', () => this.handleRestart());
        }

        // ── Palette Grid Modal / Sheet Handlers ──
        const openPaletteBtn = document.getElementById('open-palette-btn');
        const ribbonPaletteBtn = document.getElementById('ribbon-palette-btn');
        const closePaletteBtn = document.getElementById('close-palette-btn');
        const paletteModalOverlay = document.getElementById('palette-modal-overlay');

        const openPalette = () => {
            if (paletteModalOverlay) {
                this.renderPalette();
                paletteModalOverlay.classList.add('active');
            }
        };

        const closePalette = () => {
            if (paletteModalOverlay) {
                paletteModalOverlay.classList.remove('active');
            }
        };

        if (openPaletteBtn) openPaletteBtn.addEventListener('click', openPalette);
        if (ribbonPaletteBtn) ribbonPaletteBtn.addEventListener('click', openPalette);
        if (closePaletteBtn) closePaletteBtn.addEventListener('click', closePalette);
        if (paletteModalOverlay) {
            paletteModalOverlay.addEventListener('click', (e) => {
                if (e.target === paletteModalOverlay) closePalette();
            });
        }

        document.addEventListener('keydown', (e) => {
            if (e.key === 'Escape' && paletteModalOverlay && paletteModalOverlay.classList.contains('active')) {
                closePalette();
            }
        });
        
        if (this.els.exitQuizBtn) {
            this.els.exitQuizBtn.addEventListener('click', () => {
                this.els.exitModal.classList.add('active');
                if (this.state.timerInterval) clearInterval(this.state.timerInterval);
            });
        }
        if (this.els.confirmNoBtn) {
            this.els.confirmNoBtn.addEventListener('click', () => {
                this.els.exitModal.classList.remove('active');
                this.startTimer();
            });
        }
        if (this.els.confirmYesBtn) {
            this.els.confirmYesBtn.addEventListener('click', () => {
                this.els.exitModal.classList.remove('active');
                if (this.state.timerInterval) clearInterval(this.state.timerInterval);
                this.showScreen(document.getElementById('home-screen'));
            });
        }
        
        if (this.els.reviewAnswersBtn) {
            this.els.reviewAnswersBtn.addEventListener('click', () => {
                if (this.els.reviewSection) {
                    if (this.els.reviewSection.style.display === 'none') {
                        this.els.reviewSection.style.display = 'block';
                    } else {
                        this.els.reviewSection.style.display = 'none';
                    }
                }
            });
        }
    },

    startQuiz(questions, durationMinutes, testMeta = null) {
        this.state.questions = questions.map(q => ({
            ...q,
            status: 'not_visited',
            timeSpentSeconds: 0,
            shownAt: null
        }));
        
        this.state.currentIndex = 0;
        this.state.questions[0].status = 'not_answered';

        this.state.durationSeconds = durationMinutes * 60;
        this.state.testMeta = testMeta;
        this.state.savedTest = null;
        
        if (this.state.timerMode === 'stopwatch') {
            this.state.timeRemaining = 0;
        } else {
            this.state.timeRemaining = this.state.durationSeconds;
        }
        
        this.showScreen(this.els.quizScreen);
        this.startTimer();
        this.renderQuestion();
    },

    showScreen(screenElement) {
        const allScreens = document.querySelectorAll('.screen');
        allScreens.forEach(s => s.classList.remove('active'));
        screenElement.classList.add('active');
        if (screenElement.id === 'home-screen' && typeof refreshHomeStats === 'function') {
            refreshHomeStats();
        }
    },

    startTimer() {
        this.updateTimerDisplay();
        if (this.state.timerInterval) clearInterval(this.state.timerInterval);
        
        this.state.timerInterval = setInterval(() => {
            if (this.state.timerMode === 'stopwatch') {
                this.state.timeRemaining++;
                this.updateTimerDisplay();
            } else {
                this.state.timeRemaining--;
                this.updateTimerDisplay();
                
                if (this.state.timeRemaining <= 0) {
                    clearInterval(this.state.timerInterval);
                    this.submitQuiz();
                }
            }
        }, 1000);
    },

    updateTimerDisplay() {
        const m = Math.floor(this.state.timeRemaining / 60);
        const s = this.state.timeRemaining % 60;
        const formatted = `${m.toString().padStart(2, '0')}:${s.toString().padStart(2, '0')}`;
        
        this.els.timerText.textContent = formatted;
        
        this.els.timerText.classList.remove('warning', 'danger');
        if (this.state.timerMode === 'countdown') {
            if (this.state.timeRemaining <= 60 && this.state.timeRemaining > 10) {
                this.els.timerText.classList.add('warning');
            } else if (this.state.timeRemaining <= 10) {
                this.els.timerText.classList.add('danger');
            }
        }
    },

    leaveCurrentQuestion(newStatus = null) {
        const q = this.state.questions[this.state.currentIndex];
        this.captureQuestionTime(q);
        if (newStatus) {
            q.status = newStatus;
        } else {
            if (q.userAnswer) {
                if (q.status !== 'marked' && q.status !== 'answered_marked') {
                    q.status = 'answered';
                } else if (q.status === 'marked') {
                    q.status = 'answered_marked';
                }
            } else {
                if (q.status !== 'marked' && q.status !== 'answered_marked') {
                    q.status = 'not_answered';
                }
            }
        }
    },

    visitQuestion(index) {
        this.leaveCurrentQuestion();
        this.state.currentIndex = index;
        const newQ = this.state.questions[this.state.currentIndex];
        if (newQ.status === 'not_visited') {
            newQ.status = 'not_answered';
        }
        this.renderQuestion();
    },

    handleNext() {
        if (this.state.currentIndex < this.state.questions.length - 1) {
            this.visitQuestion(this.state.currentIndex + 1);
        }
    },

    handleBack() {
        if (this.state.currentIndex > 0) {
            this.visitQuestion(this.state.currentIndex - 1);
        }
    },

    handleMarkReview() {
        const q = this.state.questions[this.state.currentIndex];
        const newStatus = q.userAnswer ? 'answered_marked' : 'marked';
        this.leaveCurrentQuestion(newStatus);
        
        if (this.state.currentIndex < this.state.questions.length - 1) {
            this.state.currentIndex++;
            const newQ = this.state.questions[this.state.currentIndex];
            if (newQ.status === 'not_visited') {
                newQ.status = 'not_answered';
            }
            this.renderQuestion();
        } else {
            this.renderPalette();
        }
    },

    renderQuestion() {
        const total = this.state.questions.length;
        const current = this.state.currentIndex + 1;
        const q = this.state.questions[this.state.currentIndex];
        q.shownAt = Date.now();

        if (this.els.questionNumberBadge) {
            this.els.questionNumberBadge.textContent = `Question No. ${current}`;
        }
        
        this.els.questionText.innerHTML = this.formatMathText(q.question);
        
        if (q.inputMode === 'manual') {
            this.els.optionsContainer.style.display = 'none';
            this.els.manualInputContainer.style.display = 'block';
            this.els.manualAnswerInput.value = q.userAnswer || '';
            setTimeout(() => this.els.manualAnswerInput.focus(), 50);
        } else {
            this.els.manualInputContainer.style.display = 'none';
            this.els.optionsContainer.style.display = 'flex';
            this.els.optionsContainer.innerHTML = '';
            
            q.options = q.options || [];
            q.options.forEach((opt, idx) => {
                const btn = document.createElement('button');
                btn.className = 'option-btn';
                if (q.userAnswer === opt) {
                    btn.classList.add('selected');
                }
                btn.innerHTML = this.formatMathText(opt);
                btn.onclick = (e) => this.selectOption(opt, e);
                this.els.optionsContainer.appendChild(btn);
            });
        }

        this.els.backBtn.disabled = this.state.currentIndex === 0;
        
        if (this.state.currentIndex === total - 1) {
            this.els.nextBtn.style.display = 'none';
            if (this.els.submitTestBtn) this.els.submitTestBtn.style.display = 'block';
        } else {
            this.els.nextBtn.style.display = 'block';
            if (this.els.submitTestBtn) this.els.submitTestBtn.style.display = 'none';
        }
        
        this.renderPalette();
        this.renderQuestionRibbon();
    },

    renderQuestionRibbon() {
        if (!this.els.questionRibbon) return;
        const total = this.state.questions.length;
        const currentIdx = this.state.currentIndex;
        
        if (this.els.questionCountBadge) {
            this.els.questionCountBadge.textContent = `${currentIdx + 1} of ${total}`;
        }

        this.els.questionRibbon.innerHTML = '';

        // Calculate window: previous 2, current, next 2
        const start = Math.max(0, currentIdx - 2);
        const end = Math.min(total - 1, currentIdx + 2);

        // Previous jump indicator if not at start
        if (start > 0) {
            const firstPill = document.createElement('button');
            firstPill.type = 'button';
            firstPill.className = 'ribbon-pill ribbon-jump';
            firstPill.title = 'Go to Question 1';
            firstPill.innerHTML = '<i class="ph-bold ph-caret-double-left"></i> 1';
            firstPill.onclick = () => this.visitQuestion(0);
            this.els.questionRibbon.appendChild(firstPill);

            if (start > 1) {
                const ellipsis = document.createElement('span');
                ellipsis.className = 'ribbon-ellipsis';
                ellipsis.textContent = '···';
                this.els.questionRibbon.appendChild(ellipsis);
            }
        }

        for (let i = start; i <= end; i++) {
            const q = this.state.questions[i];
            let status = q.status;
            if (i === currentIdx) {
                if (q.userAnswer) {
                    if (q.status !== 'marked' && q.status !== 'answered_marked') status = 'answered';
                    else if (q.status === 'marked') status = 'answered_marked';
                } else {
                    if (q.status !== 'marked' && q.status !== 'answered_marked') status = 'not_answered';
                }
            }

            const pill = document.createElement('button');
            pill.type = 'button';
            pill.className = `ribbon-pill ${status.replace('_', '-')}`;
            if (i === currentIdx) {
                pill.classList.add('current');
            }

            pill.innerHTML = `<span class="pill-q-num">Q${i + 1}</span>`;
            pill.onclick = () => {
                if (i !== currentIdx) {
                    this.visitQuestion(i);
                }
            };

            this.els.questionRibbon.appendChild(pill);
        }

        // Next jump indicator if not at end
        if (end < total - 1) {
            if (end < total - 2) {
                const ellipsis = document.createElement('span');
                ellipsis.className = 'ribbon-ellipsis';
                ellipsis.textContent = '···';
                this.els.questionRibbon.appendChild(ellipsis);
            }

            const lastPill = document.createElement('button');
            lastPill.type = 'button';
            lastPill.className = 'ribbon-pill ribbon-jump';
            lastPill.title = `Go to Question ${total}`;
            lastPill.innerHTML = `${total} <i class="ph-bold ph-caret-double-right"></i>`;
            lastPill.onclick = () => this.visitQuestion(total - 1);
            this.els.questionRibbon.appendChild(lastPill);
        }
    },

    selectOption(selectedOpt, event) {
        const q = this.state.questions[this.state.currentIndex];
        q.userAnswer = selectedOpt;
        
        const btns = this.els.optionsContainer.querySelectorAll('.option-btn');
        btns.forEach(btn => {
            btn.classList.remove('selected');
        });
        
        event.currentTarget.classList.add('selected');
        
        this.renderPalette();
        this.renderQuestionRibbon();
    },

    renderPalette() {
        if (!this.els.questionPaletteGrid) return;
        
        this.els.questionPaletteGrid.innerHTML = '';
        
        let counts = {
            answered: 0,
            not_answered: 0,
            not_visited: 0,
            marked: 0,
            answered_marked: 0
        };

        this.state.questions.forEach((q, idx) => {
            let displayStatus = q.status;
            if (idx === this.state.currentIndex) {
                if (q.userAnswer) {
                    if (q.status !== 'marked' && q.status !== 'answered_marked') displayStatus = 'answered';
                    else if (q.status === 'marked') displayStatus = 'answered_marked';
                } else {
                    if (q.status !== 'marked' && q.status !== 'answered_marked') displayStatus = 'not_answered';
                }
            }
            
            counts[displayStatus] = (counts[displayStatus] || 0) + 1;

            const btn = document.createElement('div');
            btn.className = `palette-btn ${displayStatus.replace('_', '-')}`;
            if (idx === this.state.currentIndex) {
                btn.classList.add('current');
            }
            btn.textContent = idx + 1;
            btn.onclick = () => {
                if (idx !== this.state.currentIndex) {
                    this.visitQuestion(idx);
                }
                const overlay = document.getElementById('palette-modal-overlay');
                if (overlay) overlay.classList.remove('active');
            };
            this.els.questionPaletteGrid.appendChild(btn);
        });
        
        const legAns = document.getElementById('leg-ans');
        if (legAns) legAns.textContent = `Answered (${counts.answered})`;
        const legNotAns = document.getElementById('leg-not-ans');
        if (legNotAns) legNotAns.textContent = `Not Answered (${counts.not_answered})`;
        const legNotVis = document.getElementById('leg-not-vis');
        if (legNotVis) legNotVis.textContent = `Not Visited (${counts.not_visited})`;
        const legMarked = document.getElementById('leg-marked');
        if (legMarked) legMarked.textContent = `Marked (${counts.marked})`;
        const legAnsMark = document.getElementById('leg-ans-mark');
        if (legAnsMark) legAnsMark.textContent = `Answered & Marked (${counts.answered_marked})`;
    },

    async submitQuiz() {
        // Turant disable karo — double click prevent
        if (this.els.submitTestBtn) this.els.submitTestBtn.disabled = true;
        if (this.els.nextBtn) this.els.nextBtn.disabled = true;
        if (this.els.backBtn) this.els.backBtn.disabled = true;

        if (this.state.timerInterval) clearInterval(this.state.timerInterval);
        this.captureQuestionTime(this.state.questions[this.state.currentIndex]);
        
        let score = 0;
        let correctCount = 0;
        let wrongCount = 0;
        let skippedCount = 0;
        let scoredTotal = 0;
        const total = this.state.questions.length;
        
        if (this.els.reviewTableBody) this.els.reviewTableBody.innerHTML = '';
        if (this.els.reviewSection) this.els.reviewSection.style.display = 'none';

        let currentStreak = 0;
        let bestStreakThisTest = 0;

        this.state.questions.forEach((q, idx) => {
            // Doc Shuffle Drill can produce questions with no detected answer key.
            // Per spec, such questions are shown but never scored — no correct/wrong/streak impact.
            const hasAnswerKey = q.correctAnswer !== undefined && q.correctAnswer !== null && String(q.correctAnswer).trim() !== '';
            q.isScored = hasAnswerKey;

            let isCorrect = false;

            if (hasAnswerKey) {
                scoredTotal++;
                isCorrect = this.answersMatch(q.userAnswer, q.correctAnswer);
                q.isCorrect = isCorrect;

                if (isCorrect) {
                    score += 1;
                    correctCount++;
                    currentStreak += 1;
                    bestStreakThisTest = Math.max(bestStreakThisTest, currentStreak);
                } else {
                    currentStreak = 0;
                    if (q.userAnswer) {
                        wrongCount++;
                        if (this.state.negativeMarking) score -= 0.25;
                    } else {
                        skippedCount++;
                    }
                }
            } else {
                q.isCorrect = false;
            }

            if (this.els.reviewTableBody) this.appendReviewRow(q, idx + 1);
        });

        const allTimeBestStreak = await ProgressStore.updateBestStreak(bestStreakThisTest);

        let timeUsed;
        if (this.state.timerMode === 'stopwatch') {
            timeUsed = this.state.timeRemaining;
        } else {
            timeUsed = this.state.durationSeconds - this.state.timeRemaining;
        }
        
        const m = Math.floor(timeUsed / 60);
        const s = timeUsed % 60;
        let timeString = `${m < 10 ? '0'+m : m}:${s < 10 ? '0'+s : s}`;

        // Populate new result UI
        if (this.els.scoreText) {
            this.els.scoreText.textContent = `${Math.max(0, score)} / ${total}`;
        }
        
        const statCorrect = document.getElementById('stat-correct');
        const statWrong = document.getElementById('stat-wrong');
        const statAccuracy = document.getElementById('stat-accuracy');
        const statTime = document.getElementById('stat-time');
        const statSkipped = document.getElementById('stat-skipped');
        
        if (statCorrect) statCorrect.textContent = correctCount;
        if (statWrong) statWrong.textContent = (wrongCount < 10 ? '0' : '') + wrongCount;
        if (statSkipped) statSkipped.textContent = skippedCount;
        if (statTime) statTime.textContent = timeString;
        
        const accuracy = scoredTotal > 0 ? Math.round((correctCount / scoredTotal) * 100) : 0;
        if (statAccuracy) statAccuracy.textContent = `${accuracy}%`;

        const statStreak = document.getElementById('stat-streak');
        const statBestStreak = document.getElementById('stat-best-streak');
        if (statStreak) statStreak.textContent = bestStreakThisTest;
        if (statBestStreak) statBestStreak.textContent = allTimeBestStreak;
        
        // Update progress bar
        const barCorrect = document.getElementById('bar-correct');
        const barWrong = document.getElementById('bar-wrong');
        const barSkipped = document.getElementById('bar-skipped');
        
        if (barCorrect && barWrong && barSkipped) {
            // small delay to allow transition to run
            setTimeout(() => {
                barCorrect.style.width = `${(correctCount / total) * 100}%`;
                barWrong.style.width = `${(wrongCount / total) * 100}%`;
                barSkipped.style.width = `${(skippedCount / total) * 100}%`;
            }, 100);
        }

        if (this.state.testMeta?.trackProgress) {
            const scoredQuestions = this.state.questions.filter(q => q.isScored !== false);
            // await nahi — background mein save hoga, UI block nahi hogi
            ProgressStore.saveTest({
                topic: this.state.testMeta.topic,
                sourceName: this.state.testMeta.sourceName,
                durationSeconds: Math.max(0, timeUsed),
                score, correctCount, wrongCount, skippedCount,
                questions: scoredQuestions
            }).then(saved => { this.state.savedTest = saved; }).catch(() => {});
        }

        this.showScreen(this.els.resultScreen);
    },

    captureQuestionTime(q) {
        if (!q?.shownAt) return;
        q.timeSpentSeconds += Math.max(0, Math.round((Date.now() - q.shownAt) / 1000));
        q.shownAt = null;
    },

    answersMatch(userAnswer, correctAnswer) {
        const normalise = (value) => String(value ?? '')
            .replace(/^\s*(?:option\s*)?[\(\[]?[a-d][\)\].:-]\s*/i, '')
            .replace(/\s+/g, ' ')
            .trim()
            .toLowerCase();
        const user = normalise(userAnswer);
        const correct = normalise(correctAnswer);
        if (!user || !correct) return false;
        if (user === correct) return true;

        // Handles answer formats such as "A) ₹700", "700", "700.00", and "700%" safely.
        const numericValue = (value) => {
            if (!/^[₹$€]?\s*-?[\d,]+(?:\.\d+)?\s*%?$/.test(value)) return null;
            const number = Number(value.replace(/[^0-9.-]/g, ''));
            return Number.isFinite(number) ? number : null;
        };
        const userNumber = numericValue(user);
        const correctNumber = numericValue(correct);
        return userNumber !== null && correctNumber !== null && Math.abs(userNumber - correctNumber) < 0.000001;
    },

    getEstimatedTargetTime(questionStr) {
        if (!questionStr) return 15;
        const q = questionStr.toLowerCase();
        if (q.includes('^2') || q.includes('square') || q.includes('cube') || q.includes('root') || q.includes('table')) {
            return 8;
        }
        if (q.includes('+') || q.includes('-')) {
            return 12;
        }
        if (q.includes('*') || q.includes('×') || q.includes('/') || q.includes('÷')) {
            return 18;
        }
        const words = questionStr.split(/\s+/).length;
        return Math.max(15, Math.min(60, Math.round(words / 2.5) + 15));
    },

    appendReviewRow(q, number) {
        const tr = document.createElement('tr');
        const isScored = q.isScored !== false;
        const result = !isScored ? 'Not Scored' : (q.isCorrect ? 'Correct' : (q.userAnswer ? 'Wrong' : 'Skipped'));
        const resultClass = !isScored ? 'skipped-answer' : (q.isCorrect ? 'correct-answer' : (q.userAnswer ? 'wrong-answer' : 'skipped-answer'));
        const spent = q.timeSpentSeconds || 0;
        const time = `${Math.floor(spent / 60)}m ${spent % 60}s`;
        
        const target = this.getEstimatedTargetTime(q.question);
        let speedBadge = '';
        if (spent <= target) {
            speedBadge = `<span class="speed-pill fast"><i class="ph-fill ph-lightning"></i> Fast (${spent}s / &le;${target}s)</span>`;
        } else if (spent <= target * 1.5) {
            speedBadge = `<span class="speed-pill normal"><i class="ph-bold ph-check"></i> Optimal (${spent}s / &le;${target}s)</span>`;
        } else {
            speedBadge = `<span class="speed-pill slow"><i class="ph-bold ph-warning"></i> Slow (${spent}s / &le;${target}s)</span>`;
        }

        const correctAnswerDisplay = isScored ? this.formatMathText(q.correctAnswer) : '—';
        const trickBtn = isScored
            ? `<button class="review-ai-trick-btn" onclick="QuizEngine.showReviewTrick(this, '${encodeURIComponent(q.question)}', '${encodeURIComponent(q.correctAnswer)}')"><i class="ph-fill ph-lightning"></i> Trick</button>`
            : '<span class="skipped-answer">—</span>';

        const cells = [
            `Q${number}: ${this.formatMathText(q.question)}`,
            `<span class="${resultClass}">${result}</span>`,
            time,
            speedBadge,
            correctAnswerDisplay,
            trickBtn
        ];

        cells.forEach((value, index) => {
            const td = document.createElement('td');
            td.innerHTML = value;
            if (index === 1) td.className = resultClass;
            if (index === 4) td.className = 'correct-answer';
            tr.appendChild(td);
        });

        this.els.reviewTableBody.appendChild(tr);

        // Expandable Row for AI Shortcut
        const trickTr = document.createElement('tr');
        trickTr.className = 'review-trick-row';
        trickTr.style.display = 'none';
        trickTr.innerHTML = `<td colspan="6" class="review-trick-cell"></td>`;
        this.els.reviewTableBody.appendChild(trickTr);
    },

    async showReviewTrick(btn, qTextEnc, ansEnc) {
        const row = btn.closest('tr');
        const nextRow = row?.nextElementSibling;
        const cell = nextRow?.querySelector('.review-trick-cell');
        if (!nextRow || !cell) return;

        if (nextRow.style.display === 'table-row') {
            nextRow.style.display = 'none';
            btn.classList.remove('active');
            return;
        }

        btn.classList.add('active');
        nextRow.style.display = 'table-row';
        cell.innerHTML = `
            <div class="ai-trick-loading">
                <div class="spinner-small"></div>
                <span>Consulting AI Coach for 10-second shortcut trick...</span>
            </div>
        `;

        try {
            const res = await fetch('https://mock-test-backend-crqm.onrender.com/api/ai/shortcut-trick', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                    question: decodeURIComponent(qTextEnc),
                    correct_answer: decodeURIComponent(ansEnc)
                })
            });
            const data = await res.json();
            cell.innerHTML = `
                <div class="ai-trick-card">
                    <div class="ai-trick-head">
                        <div class="ai-trick-title"><i class="ph-fill ph-lightning text-orange"></i> ${data.trick_title}</div>
                        <span class="ai-target-time-badge"><i class="ph-bold ph-timer"></i> Target: &le; ${data.target_time_seconds}s</span>
                    </div>
                    <div class="ai-trick-body">
                        <div class="ai-step-box">
                            <strong>⚡ Topper's Shortcut Trick:</strong>
                            <p>${data.topper_shortcut}</p>
                        </div>
                        ${data.traditional_vs_shortcut ? `
                        <div class="ai-comparison-box">
                            <strong>🐢 Why Long Method Fails vs Shortcut:</strong>
                            <p>${data.traditional_vs_shortcut}</p>
                        </div>` : ''}
                        <div class="ai-takeaway-box">
                            <strong>💡 Golden Rule / AIR 1 Takeaway:</strong>
                            <p>${data.key_takeaway}</p>
                        </div>
                    </div>
                </div>
            `;
        } catch (e) {
            cell.innerHTML = `
                <div class="ai-trick-card error">
                    <div class="ai-trick-title">⚡ Smart Mental Math Strategy</div>
                    <p>Check the unit digits and use options elimination to reach the answer in under 15 seconds without manual calculation.</p>
                </div>
            `;
        }
    },

    showStoredResult(test) {
        if (this.els.reviewTableBody) this.els.reviewTableBody.innerHTML = '';
        if (this.els.reviewSection) this.els.reviewSection.style.display = 'block';
        this.els.scoreText.textContent = `${Math.max(0, test.score)} / ${test.total}`;
        document.getElementById('stat-correct').textContent = test.correctCount;
        document.getElementById('stat-wrong').textContent = test.wrongCount;
        document.getElementById('stat-skipped').textContent = test.skippedCount;
        document.getElementById('stat-accuracy').textContent = `${Math.round(test.correctCount / test.total * 100)}%`;
        document.getElementById('stat-time').textContent = `${Math.floor(test.durationSeconds / 60)}:${String(test.durationSeconds % 60).padStart(2, '0')}`;
        test.questions.forEach(q => this.appendReviewRow({ ...q, isCorrect: q.result === 'correct' }, q.number));
        this.showScreen(this.els.resultScreen);
    },

    handleRestart() {
        this.showScreen(document.getElementById('home-screen'));
    },

    formatMathText(text) {
        if (typeof text !== 'string') return text;
        return text.replace(/(\d+)\/(\d+)/g, '<span class="fraction"><span class="num">$1</span><span class="den">$2</span></span>');
    }
};


document.addEventListener('DOMContentLoaded', () => {
    QuizEngine.init();
});
