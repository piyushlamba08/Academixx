document.addEventListener('DOMContentLoaded', () => {
    const els = {
        uploadContainer: document.getElementById('upload-container'),
        fileInput: document.getElementById('pdf-file'),
        fileNameDisplay: document.getElementById('file-name'),
        fileNameContainer: document.getElementById('file-name-container'),
        removeFileBtn: document.getElementById('remove-file-btn'),
        durationGroup: document.getElementById('pdf-duration-group'),
        generateBtn: document.getElementById('generate-pdf-btn'),
        errorMsg: document.getElementById('pdf-error-msg'),
        loadingState: document.getElementById('loading-state')
    };

    let selectedFile = null;

    const ALLOWED_TYPES = [
        'application/pdf',
        'application/vnd.openxmlformats-officedocument.wordprocessingml.document'
    ];

    els.uploadContainer.addEventListener('click', () => els.fileInput.click());

    els.uploadContainer.addEventListener('dragover', (e) => {
        e.preventDefault();
        els.uploadContainer.style.borderColor = 'var(--accent)';
    });

    els.uploadContainer.addEventListener('dragleave', () => {
        els.uploadContainer.style.borderColor = 'var(--input-border)';
    });

    els.uploadContainer.addEventListener('drop', (e) => {
        e.preventDefault();
        els.uploadContainer.style.borderColor = 'var(--input-border)';
        if (e.dataTransfer.files && e.dataTransfer.files.length > 0) {
            handleFile(e.dataTransfer.files[0]);
        }
    });

    els.fileInput.addEventListener('change', (e) => {
        if (e.target.files && e.target.files.length > 0) {
            handleFile(e.target.files[0]);
        }
    });

    els.removeFileBtn.addEventListener('click', (e) => {
        e.stopPropagation();
        selectedFile = null;
        els.fileInput.value = '';
        els.uploadContainer.classList.remove('has-file');
        els.fileNameContainer.style.display = 'none';
        els.generateBtn.disabled = true;
    });

    function handleFile(file) {
        const isAllowed = ALLOWED_TYPES.includes(file.type) ||
            file.name.endsWith('.pdf') ||
            file.name.endsWith('.docx');

        if (!isAllowed) {
            showError("Please upload a PDF or DOCX file.");
            return;
        }

        selectedFile = file;
        els.fileNameDisplay.textContent = file.name;
        els.fileNameContainer.style.display = 'flex';
        els.uploadContainer.classList.add('has-file');
        els.errorMsg.classList.remove('active');
        els.generateBtn.disabled = false;
    }

    function showError(msg) {
        els.errorMsg.textContent = msg;
        els.errorMsg.classList.add('active');
    }

    els.generateBtn.addEventListener('click', async () => {
        if (!selectedFile) {
            showError("Please select a PDF or DOCX file first.");
            return;
        }

        const activeBtn = document.querySelector('#pdf-duration-group .mode-btn.active');
        const durationMinutes = activeBtn ? parseInt(activeBtn.dataset.val) : 15;

        els.generateBtn.disabled = true;
        els.loadingState.classList.add('active');
        els.errorMsg.classList.remove('active');

        const formData = new FormData();
        formData.append('file', selectedFile);

        try {
            const response = await fetch('http://localhost:8000/api/process-pdf', {
                method: 'POST',
                body: formData
            });

            const data = await response.json();

            if (!response.ok) {
                throw new Error(data.detail || "Failed to process file.");
            }

            if (!data.questions || data.questions.length === 0) {
                throw new Error("No questions could be generated. Please check the document.");
            }

            // Different backend versions may return answer as answer, correctAnswer, or correct_answer.
            // Never start a test if the answer key is missing: otherwise valid answers become "wrong".
            const formattedQuestions = data.questions.map((q, index) => {
                const answerKey = q.answer ?? q.correctAnswer ?? q.correct_answer;
                const options = Array.isArray(q.options) ? q.options.map(option => String(option).trim()) : [];
                const correctAnswer = options.find(option => QuizEngine.answersMatch(option, answerKey)) || answerKey;
                const invalidAnswerKeys = ['', 'undefined', 'null', 'none', 'n/a', 'na'];
                if (correctAnswer === undefined || correctAnswer === null || invalidAnswerKeys.includes(String(correctAnswer).trim().toLowerCase()) || !options.some(option => QuizEngine.answersMatch(option, correctAnswer))) {
                    throw new Error(`Question ${index + 1} has an invalid correct answer key. Please regenerate the mock test.`);
                }
                return {
                    question: q.question,
                    correctAnswer: String(correctAnswer).trim(),
                    options,
                    userAnswer: null
                };
            });

            els.loadingState.classList.remove('active');
            els.generateBtn.disabled = false;

            QuizEngine.state.negativeMarking = document.getElementById('pdf-negative').checked;
            QuizEngine.state.timerMode = 'countdown';

            QuizEngine.startQuiz(formattedQuestions, durationMinutes, {
                trackProgress: true,
                topic: document.getElementById('pdf-topic').value,
                sourceName: selectedFile.name
            });

        } catch (error) {
            console.error("Processing Error:", error);
            showError(error.message || "An unexpected error occurred.");
            els.loadingState.classList.remove('active');
            els.generateBtn.disabled = false;
        }
    });
});
