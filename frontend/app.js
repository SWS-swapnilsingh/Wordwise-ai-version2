// ============================================================
// WordWise AI — Frontend JavaScript
// ============================================================

// --- YouGlish Global State & Widget API ---
var ygWidget = null;
var pendingWord = '';

/**
 * Called by https://youglish.com/public/emb/widget.js when the SDK finishes loading
 */
window.onYouglishAPIReady = function() {
    ygWidget = new YG.Widget("widget-1", {
        // 8 = Caption, 64 = Video control buttons
        components: 8 + 64,
        captionSize: 22,
        autoStart: 0   // don't autoplay when video loads
    });

    var wordInput = document.getElementById("word");
    var initial = pendingWord || (wordInput ? wordInput.value.trim() : "");
    if (initial) {
        searchWord(initial);
    }
};

/**
 * Searches YouGlish for the specified word and updates the pronunciation practice box
 * @param {string} [w] - The word to search. If omitted, reads from #word input.
 */
function searchWord(w) {
    if (!w) {
        var wordInput = document.getElementById("word");
        w = wordInput ? wordInput.value.trim() : "";
    }
    if (!w) return;

    var clean = w.trim();

    // Hide empty placeholder if present
    var ph = document.getElementById("youglishPlaceholder");
    if (ph) {
        ph.style.display = "none";
    }

    // 1. Update the search input in the right column
    var wordInput = document.getElementById("word");
    if (wordInput && wordInput.value !== clean) {
        wordInput.value = clean;
    }

    // 2. Update the subtitle indicator
    var curWordEl = document.getElementById("youglishCurrentWord");
    var subtitleEl = document.getElementById("youglishSubtitle");
    if (curWordEl) {
        curWordEl.textContent = clean;
    }
    if (subtitleEl) {
        subtitleEl.style.display = "block";
    }

    // 3. Fetch clips in YouGlish widget if ready, or queue it
    if (ygWidget && typeof ygWidget.fetch === 'function') {
        ygWidget.fetch(clean, "english");
    } else {
        pendingWord = clean;
    }

    // 4. Update the voice pronunciation check box
    var w1 = document.getElementById("check-word-1");
    var w2 = document.getElementById("check-word-2");
    var box = document.getElementById("check-box");

    if (w1) w1.textContent = clean;
    if (w2) w2.textContent = clean;
    if (box) box.style.display = "block";

    showResult("", "");
}

/**
 * Displays status/result feedback in the voice pronunciation box
 * @param {string} text - Message to display
 * @param {string} cls - CSS class ('good' or 'try')
 */
function showResult(text, cls) {
    var r = document.getElementById("result");
    if (r) {
        r.textContent = text;
        r.className = "result " + (cls || "");
    }
}

// ============================================================
// DOM Ready Handler
// ============================================================
document.addEventListener('DOMContentLoaded', () => {
    // --- Elements: Meaning Section (Middle) ---
    const meaningInput = document.getElementById('meaningWord');
    const meaningBtn = document.getElementById('meaningBtn');
    const meaningStatus = document.getElementById('meaningStatus');
    const meaningStatusText = document.getElementById('meaningStatusText');
    const meaningError = document.getElementById('meaningError');
    const meaningErrorText = document.getElementById('meaningErrorText');
    const meaningResult = document.getElementById('meaningResult');

    // --- Elements: Pronunciation Section (Left) ---
    const pronInput = document.getElementById('pronWord');
    const pronBtn = document.getElementById('pronBtn');
    const pronStatus = document.getElementById('pronStatus');
    const pronStatusText = document.getElementById('pronStatusText');
    const pronResult = document.getElementById('pronResult');
    const pronAudioContainer = document.getElementById('pronAudioContainer');
    const pronAudio = document.getElementById('pronAudio');

    // --- Elements: Right Column Pronunciation Checker ---
    const wordInput = document.getElementById('word');
    const goBtn = document.getElementById('go');
    const micBtn = document.getElementById('mic');

    // Audio URL tracking to avoid memory leaks
    let currentPronAudioUrl = null;
    let currentMeaningAudioUrl = null;

    // Helper: Fetch TTS audio as a blob object URL
    async function fetchTTSAudio(word) {
        const response = await fetch('/api/tts', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ word: word })
        });

        if (!response.ok) {
            const errData = await response.json().catch(() => ({}));
            throw new Error(errData.error || 'Failed to generate audio');
        }

        const blob = await response.blob();
        return URL.createObjectURL(blob);
    }

    // ============================================================
    // Meaning Lookup Workflow (Middle Section — Primary Search)
    // ============================================================
    async function handleMeaningLookup() {
        const word = meaningInput.value.trim();
        if (!word) return;

        // 1. Immediately update YouGlish and practice box on the right (3rd column)
        searchWord(word);

        // 2. Reset Meaning display
        meaningError.style.display = 'none';
        meaningResult.style.display = 'none';
        meaningResult.innerHTML = '';

        // Show loading status (st.info("Searching for: <word>..."))
        meaningStatusText.textContent = `Searching for: ${word}...`;
        meaningStatus.style.display = 'flex';

        try {
            const response = await fetch('/api/meaning', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ word: word })
            });

            const data = await response.json();

            if (!response.ok || data.error) {
                throw new Error(data.error || 'Error fetching information');
            }

            const markdownText = data.result;

            // Update status (st.info("Result for: <word>"))
            meaningStatusText.textContent = `Result for: ${word}`;
            meaningStatus.style.display = 'flex';

            // Check for pronunciation section split (matching simple_app.py logic)
            const splitPattern = "### 📢 Pronunciation (US English):";
            const parts = markdownText.split(splitPattern);

            if (parts.length === 2) {
                const part1Html = marked.parse(parts[0] + splitPattern);
                const part2Html = marked.parse(parts[1]);

                meaningResult.innerHTML = `
                    ${part1Html}
                    <div class="inline-audio-container" id="meaningInlineAudio">
                        <span style="font-size: 0.85rem; color: #666; display: block; margin-bottom: 4px;">Loading audio...</span>
                    </div>
                    ${part2Html}
                `;
                meaningResult.style.display = 'block';

                // Fetch and insert TTS audio for pronunciation
                fetchTTSAudio(word).then(audioUrl => {
                    const audioWrapper = document.getElementById('meaningInlineAudio');
                    if (audioWrapper) {
                        if (currentMeaningAudioUrl) {
                            URL.revokeObjectURL(currentMeaningAudioUrl);
                        }
                        currentMeaningAudioUrl = audioUrl;
                        audioWrapper.innerHTML = `
                            <audio controls preload="auto" style="width: 250px; height: 38px;">
                                <source src="${audioUrl}" type="audio/mpeg">
                                Your browser does not support audio.
                            </audio>
                        `;
                    }
                }).catch(err => {
                    const audioWrapper = document.getElementById('meaningInlineAudio');
                    if (audioWrapper) {
                        audioWrapper.innerHTML = `<span style="font-size: 0.82rem; color: #888;">(Audio unavailable)</span>`;
                    }
                });

            } else {
                meaningResult.innerHTML = marked.parse(markdownText);
                meaningResult.style.display = 'block';
            }

        } catch (err) {
            meaningStatus.style.display = 'none';
            meaningErrorText.textContent = err.message || 'An error occurred while fetching meaning.';
            meaningError.style.display = 'flex';
        }
    }

    // ============================================================
    // Pronunciation Lookup Workflow (Left Section)
    // ============================================================
    async function handlePronunciationLookup() {
        const word = pronInput.value.trim();
        if (!word) return;

        // Reset display
        pronResult.style.display = 'none';
        pronResult.innerHTML = '';
        pronAudioContainer.style.display = 'none';

        // Show loading status (st.info("Loading pronunciation..."))
        pronStatusText.textContent = 'Loading pronunciation...';
        pronStatus.style.display = 'flex';

        try {
            // Run text pronunciation query and TTS audio fetch in parallel
            const [pronRes, audioUrl] = await Promise.all([
                fetch('/api/pronunciation', {
                    method: 'POST',
                    headers: { 'Content-Type': 'application/json' },
                    body: JSON.stringify({ word: word })
                }),
                fetchTTSAudio(word).catch(e => {
                    console.warn('Pronunciation audio error:', e);
                    return null;
                })
            ]);

            const pronData = await pronRes.json();
            if (!pronRes.ok || pronData.error) {
                throw new Error(pronData.error || 'Error fetching pronunciation');
            }

            // Render pronunciation text markdown
            pronResult.innerHTML = marked.parse(pronData.result);
            pronResult.style.display = 'block';

            // Setup audio player
            if (audioUrl) {
                if (currentPronAudioUrl) {
                    URL.revokeObjectURL(currentPronAudioUrl);
                }
                currentPronAudioUrl = audioUrl;
                pronAudio.src = audioUrl;
                pronAudioContainer.style.display = 'block';
            }

            // Update status (st.info("Pronunciation for: <word>"))
            pronStatusText.textContent = `Pronunciation for: ${word}`;
            pronStatus.className = 'st-alert st-alert-info';
            pronStatus.style.display = 'flex';

        } catch (err) {
            pronStatusText.textContent = err.message || 'Error loading pronunciation';
            pronStatus.className = 'st-alert st-alert-error';
            pronStatus.style.display = 'flex';
        }
    }

    // ============================================================
    // Voice Recognition (SpeechRecognition) for Right Column
    // ============================================================
    var SR = window.SpeechRecognition || window.webkitSpeechRecognition;

    if (micBtn) {
        micBtn.addEventListener("click", function () {
            if (!SR) {
                showResult("Your browser does not support voice recognition. Please use Chrome or Edge.", "try");
                return;
            }
            var targetEl = document.getElementById("check-word-2");
            var target = targetEl ? targetEl.textContent.trim().toLowerCase() : "";
            if (!target) return;

            var rec = new SR();
            rec.lang = "en-US";
            rec.maxAlternatives = 3;

            rec.onstart = function () {
                micBtn.classList.add("listening");
                micBtn.innerHTML = '<i class="fas fa-spinner fa-spin"></i> Listening... say the word';
                showResult("", "");
            };

            rec.onend = function () {
                micBtn.classList.remove("listening");
                micBtn.innerHTML = '<i class="fas fa-microphone"></i> Tap and Read the Text';
            };

            rec.onerror = function (e) {
                if (e.error === "not-allowed") {
                    showResult("Please allow microphone access and try again.", "try");
                } else if (e.error === "no-speech") {
                    showResult("I did not hear anything. Try again.", "try");
                } else {
                    showResult("Something went wrong (" + e.error + "). Try again.", "try");
                }
            };

            rec.onresult = function (e) {
                var clean = function (t) { return t.trim().toLowerCase().replace(/[.,!?]/g, ""); };
                var heard = clean(e.results[0][0].transcript);
                var matched = false;
                for (var i = 0; i < e.results[0].length; i++) {
                    if (clean(e.results[0][i].transcript) === target) matched = true;
                }
                if (matched) {
                    showResult('Great! I heard "' + target + '". Your pronunciation is clear.', "good");
                } else {
                    showResult('I heard "' + heard + '". Listen to the video and try again.', "try");
                }
            };

            rec.start();
        });
    }

    // ============================================================
    // Explicit Search Events (Right Column)
    // ============================================================
    if (goBtn) {
        goBtn.addEventListener("click", function () {
            searchWord();
        });
    }

    if (wordInput) {
        wordInput.addEventListener("keydown", function (e) {
            if (e.key === "Enter") {
                e.preventDefault();
                searchWord();
            }
        });
    }

    // ============================================================
    // Event Listeners for Middle (Meaning) & Left (Pronunciation)
    // ============================================================
    if (meaningBtn) {
        meaningBtn.addEventListener('click', handleMeaningLookup);
    }
    if (meaningInput) {
        meaningInput.addEventListener('keydown', (e) => {
            if (e.key === 'Enter') {
                e.preventDefault();
                handleMeaningLookup();
            }
        });
    }

    if (pronBtn) {
        pronBtn.addEventListener('click', () => handlePronunciationLookup());
    }
    if (pronInput) {
        pronInput.addEventListener('keydown', (e) => {
            if (e.key === 'Enter') {
                e.preventDefault();
                handlePronunciationLookup();
            }
        });
    }

    // ============================================================
    // Draggable Column Resizers
    // ============================================================
    function initColumnResizers() {
        const mainContainer = document.getElementById('mainContainer');
        const colLeft = document.getElementById('colLeft');
        const resizerLeft = document.getElementById('resizerLeft');
        const colCenter = document.getElementById('colCenter');
        const resizerRight = document.getElementById('resizerRight');
        const colRight = document.getElementById('colRight');

        if (!mainContainer || !colLeft || !resizerLeft || !colCenter || !resizerRight || !colRight) {
            return;
        }

        const STORAGE_KEY_LEFT = 'wordwise_col_left_width';
        const STORAGE_KEY_RIGHT = 'wordwise_col_right_width';

        const DEFAULT_LEFT_WIDTH = 280;
        const DEFAULT_RIGHT_WIDTH = 450;
        const MIN_LEFT_WIDTH = 180;
        const MAX_LEFT_WIDTH = 520;
        const MIN_RIGHT_WIDTH = 300;
        const MAX_RIGHT_WIDTH = 750;
        const MIN_CENTER_WIDTH = 340;

        // Restore saved column sizes
        function restoreWidths() {
            if (window.innerWidth <= 1050) return;

            const savedLeft = localStorage.getItem(STORAGE_KEY_LEFT);
            if (savedLeft) {
                const w = parseFloat(savedLeft);
                if (!isNaN(w) && w >= MIN_LEFT_WIDTH && w <= MAX_LEFT_WIDTH) {
                    colLeft.style.flex = `0 0 ${w}px`;
                    colLeft.style.width = `${w}px`;
                }
            }

            const savedRight = localStorage.getItem(STORAGE_KEY_RIGHT);
            if (savedRight) {
                const w = parseFloat(savedRight);
                if (!isNaN(w) && w >= MIN_RIGHT_WIDTH && w <= MAX_RIGHT_WIDTH) {
                    colRight.style.flex = `0 0 ${w}px`;
                    colRight.style.width = `${w}px`;
                }
            }
        }

        restoreWidths();

        // Double-click resizer to reset to default sizes
        resizerLeft.addEventListener('dblclick', () => {
            colLeft.style.flex = `0 0 ${DEFAULT_LEFT_WIDTH}px`;
            colLeft.style.width = `${DEFAULT_LEFT_WIDTH}px`;
            localStorage.removeItem(STORAGE_KEY_LEFT);
        });

        resizerRight.addEventListener('dblclick', () => {
            colRight.style.flex = `0 0 ${DEFAULT_RIGHT_WIDTH}px`;
            colRight.style.width = `${DEFAULT_RIGHT_WIDTH}px`;
            localStorage.removeItem(STORAGE_KEY_RIGHT);
        });

        // Setup pointer drag handler
        function setupResizer(resizer, onDrag) {
            resizer.addEventListener('pointerdown', (e) => {
                if (window.innerWidth <= 1050) return;
                e.preventDefault();

                resizer.setPointerCapture(e.pointerId);
                resizer.classList.add('is-dragging');
                document.body.classList.add('is-resizing');

                const startX = e.clientX;
                const startLeftW = colLeft.getBoundingClientRect().width;
                const startRightW = colRight.getBoundingClientRect().width;
                const containerW = mainContainer.getBoundingClientRect().width;

                function onPointerMove(moveEvent) {
                    const deltaX = moveEvent.clientX - startX;
                    onDrag(deltaX, startLeftW, startRightW, containerW);
                }

                function onPointerUp(upEvent) {
                    resizer.removeEventListener('pointermove', onPointerMove);
                    resizer.removeEventListener('pointerup', onPointerUp);
                    resizer.removeEventListener('pointercancel', onPointerUp);
                    try {
                        resizer.releasePointerCapture(upEvent.pointerId);
                    } catch (err) {}

                    resizer.classList.remove('is-dragging');
                    document.body.classList.remove('is-resizing');

                    // Save to localStorage
                    localStorage.setItem(STORAGE_KEY_LEFT, colLeft.getBoundingClientRect().width);
                    localStorage.setItem(STORAGE_KEY_RIGHT, colRight.getBoundingClientRect().width);
                }

                resizer.addEventListener('pointermove', onPointerMove);
                resizer.addEventListener('pointerup', onPointerUp);
                resizer.addEventListener('pointercancel', onPointerUp);
            });
        }

        // Left Resizer: drags boundary between Left & Middle
        setupResizer(resizerLeft, (deltaX, startLeftW, startRightW, containerW) => {
            let newLeftW = startLeftW + deltaX;
            newLeftW = Math.max(MIN_LEFT_WIDTH, Math.min(MAX_LEFT_WIDTH, newLeftW));

            // Prevent center column from collapsing below MIN_CENTER_WIDTH
            const currentRightW = colRight.getBoundingClientRect().width;
            const availableForLeft = containerW - currentRightW - MIN_CENTER_WIDTH - 28;
            if (newLeftW > availableForLeft) {
                newLeftW = Math.max(MIN_LEFT_WIDTH, availableForLeft);
            }

            colLeft.style.flex = `0 0 ${newLeftW}px`;
            colLeft.style.width = `${newLeftW}px`;
        });

        // Right Resizer: drags boundary between Middle & Right
        setupResizer(resizerRight, (deltaX, startLeftW, startRightW, containerW) => {
            let newRightW = startRightW - deltaX;
            newRightW = Math.max(MIN_RIGHT_WIDTH, Math.min(MAX_RIGHT_WIDTH, newRightW));

            // Prevent center column from collapsing below MIN_CENTER_WIDTH
            const currentLeftW = colLeft.getBoundingClientRect().width;
            const availableForRight = containerW - currentLeftW - MIN_CENTER_WIDTH - 28;
            if (newRightW > availableForRight) {
                newRightW = Math.max(MIN_RIGHT_WIDTH, availableForRight);
            }

            colRight.style.flex = `0 0 ${newRightW}px`;
            colRight.style.width = `${newRightW}px`;
        });
    }

    initColumnResizers();

    // ============================================================
    // Dark / Light Theme Controller
    // ============================================================
    function initThemeToggle() {
        const toggleBtn = document.getElementById('themeToggleBtn');
        const themeIcon = document.getElementById('themeIcon');
        const themeText = document.getElementById('themeText');

        function updateThemeUI(theme) {
            if (theme === 'dark') {
                document.documentElement.setAttribute('data-theme', 'dark');
                if (themeIcon) {
                    themeIcon.className = 'fas fa-sun theme-toggle-icon';
                    themeIcon.style.color = '#f59e0b';
                }
                if (themeText) {
                    themeText.textContent = 'Light Mode';
                }
            } else {
                document.documentElement.setAttribute('data-theme', 'light');
                if (themeIcon) {
                    themeIcon.className = 'fas fa-moon theme-toggle-icon';
                    themeIcon.style.color = '#f59e0b';
                }
                if (themeText) {
                    themeText.textContent = 'Dark Mode';
                }
            }
        }

        // Set initial button text and icon matching current theme
        const currentTheme = document.documentElement.getAttribute('data-theme') || 'light';
        updateThemeUI(currentTheme);

        if (toggleBtn) {
            toggleBtn.addEventListener('click', () => {
                const active = document.documentElement.getAttribute('data-theme') === 'dark' ? 'dark' : 'light';
                const next = active === 'dark' ? 'light' : 'dark';
                updateThemeUI(next);
                try {
                    localStorage.setItem('wordwise_theme', next);
                } catch (e) {}
            });
        }
    }

    initThemeToggle();

    // Initial search for right column only if word is explicitly set in HTML
    var initialWord = wordInput ? wordInput.value.trim() : "";
    if (initialWord) {
        searchWord(initialWord);
    }

    // Load the YouGlish widget script dynamically
    var ygTag = document.createElement('script');
    ygTag.src = "https://youglish.com/public/emb/widget.js";
    document.body.appendChild(ygTag);
});
