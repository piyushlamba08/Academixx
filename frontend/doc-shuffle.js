/**
 * doc-shuffle.js
 * Handles the "Document Shuffle Drill" upload screen.
 * Sends the file to /api/extract-shuffle-doc (no AI),
 * then loads the parsed & shuffled questions into QuizEngine.
 */

document.addEventListener('DOMContentLoaded', () => {
    const BACKEND_URL = 'https://mock-test-backend-crqm.onrender.com';

    const els = {
        uploadContainer:  document.getElementById('doc-shuffle-upload-container'),
        fileInput:         document.getElementById('doc-shuffle-file'),
        fileNameDisplay:   document.getElementById('doc-shuffle-file-name'),
        fileNameContainer: document.getElementById('doc-shuffle-file-name-container'),
        removeFileBtn:     document.getElementById('doc-shuffle-remove-file-btn'),
        startBtn:          document.getElementById('doc-shuffle-start-btn'),
        errorMsg:          document.getElementById('doc-shuffle-error-msg'),
        loadingState:      document.getElementById('doc-shuffle-loading-state'),
        negativeCheck:     document.getElementById('doc-shuffle-negative'),
    };

    let selectedFile = null;

    const ALLOWED_TYPES = [
        'application/pdf',
        'application/vnd.openxmlformats-officedocument.wordprocessingml.document'
    ];

    /* ── File pick / drag-drop ── */
    els.uploadContainer.addEventListener('click', () => els.fileInput.click());

    els.uploadContainer.addEventListener('dragover', (e) => {
        e.preventDefault();
        els.uploadContainer.classList.add('drag-over');
    });

    els.uploadContainer.addEventListener('dragleave', () => {
        els.uploadContainer.classList.remove('drag-over');
    });

    els.uploadContainer.addEventListener('drop', (e) => {
        e.preventDefault();
        els.uploadContainer.classList.remove('drag-over');
        if (e.dataTransfer.files?.length) handleFile(e.dataTransfer.files[0]);
    });

    els.fileInput.addEventListener('change', (e) => {
        if (e.target.files?.length) handleFile(e.target.files[0]);
    });

    els.removeFileBtn.addEventListener('click', (e) => {
        e.stopPropagation();
        clearFile();
    });

    function handleFile(file) {
        const allowed = ALLOWED_TYPES.includes(file.type)
            || file.name.endsWith('.pdf')
            || file.name.endsWith('.docx');

        if (!allowed) {
            showError('Please upload a PDF or DOCX file.');
            return;
        }

        selectedFile = file;
        els.fileNameDisplay.textContent     = file.name;
        els.fileNameContainer.style.display = 'flex';
        els.uploadContainer.classList.add('has-file');
        clearError();
        els.startBtn.disabled = false;
    }

    function clearFile() {
        selectedFile = null;
        els.fileInput.value = '';
        els.uploadContainer.classList.remove('has-file');
        els.fileNameContainer.style.display = 'none';
        els.startBtn.disabled = true;
    }

    function showError(msg) {
        els.errorMsg.textContent = msg;
        els.errorMsg.classList.add('active');
    }

    function clearError() {
        els.errorMsg.classList.remove('active');
    }

    /* ── Mode-btn toggle for duration ── */
    document.querySelectorAll('#doc-shuffle-duration-group .mode-btn').forEach(btn => {
        btn.addEventListener('click', () => {
            document.querySelectorAll('#doc-shuffle-duration-group .mode-btn')
                .forEach(b => b.classList.remove('active'));
            btn.classList.add('active');
        });
    });

    /* ── Start Button ── */
    els.startBtn.addEventListener('click', async () => {
        if (!selectedFile) {
            showError('Please select a PDF or DOCX file first.');
            return;
        }

        const activeBtn = document.querySelector('#doc-shuffle-duration-group .mode-btn.active');
        const durationMinutes = activeBtn ? parseInt(activeBtn.dataset.val) : 20;

        els.startBtn.disabled = true;
        els.loadingState.classList.add('active');
        clearError();

        const formData = new FormData();
        formData.append('file', selectedFile);

        try {
            const response = await fetch(`${BACKEND_URL}/api/extract-shuffle-doc`, {
                method: 'POST',
                body: formData,
            });

            const data = await response.json();

            if (!response.ok) {
                throw new Error(data.detail || 'Failed to process file.');
            }

            if (!data.questions || data.questions.length === 0) {
                throw new Error(
                    'No questions found. Make sure your document has questions Q1. Question text here?(a) Option one(b) Option two(c) Option three(d) Option four Answer: (b) format.'
                );
            }

            /* Map backend response → QuizEngine format */
            const formattedQuestions = data.questions.map(q => ({
                question:      q.question    || '',
                options:       Array.isArray(q.options) ? q.options.map(o => String(o).trim()) : [],
                correctAnswer: q.correctAnswer ? String(q.correctAnswer).trim() : '',
                userAnswer:    null,
                inputMode:     'mcq',
            }));

            els.loadingState.classList.remove('active');
            els.startBtn.disabled = false;

            /* Configure QuizEngine */
            QuizEngine.state.negativeMarking = els.negativeCheck?.checked ?? false;
            QuizEngine.state.timerMode = 'countdown';

            const sourceName = selectedFile.name;
            clearFile();

            QuizEngine.startQuiz(formattedQuestions, durationMinutes, {
                trackProgress: true,
                topic:         'Document Shuffle',
                sourceName,
            });

        } catch (err) {
            console.error('[DocShuffle] Error:', err);
            showError(err.message || 'An unexpected error occurred.');
            els.loadingState.classList.remove('active');
            els.startBtn.disabled = false;
        }
    });
});
