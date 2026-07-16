/**
 * typing.js
 * Handles Pinyin typing mode for HSK Flashcards.
 */

(function () {
    // State
    let isTypingActive = false;
    let isTransitioningWord = false;

    // Normalize Pinyin for comparison
    function normalizePinyin(str) {
        if (!str) return '';
        let s = str.toLowerCase();
        
        // Map tone marked vowels to normal vowel letters. 
        // Map ü and its tones to 'v' since in standard Chinese typing, 'v' is used for 'ü'.
        const toneMap = {
            'ā': 'a', 'á': 'a', 'ǎ': 'a', 'à': 'a',
            'ē': 'e', 'é': 'e', 'ě': 'e', 'è': 'e',
            'ī': 'i', 'í': 'i', 'ǐ': 'i', 'ì': 'i',
            'ō': 'o', 'ó': 'o', 'ǒ': 'o', 'ò': 'o',
            'ū': 'u', 'ú': 'u', 'ǔ': 'u', 'ù': 'u',
            'ü': 'v', 'ǖ': 'v', 'ǘ': 'v', 'ǚ': 'v', 'ǜ': 'v'
        };

        for (let char in toneMap) {
            s = s.replaceAll(char, toneMap[char]);
        }

        // Strip everything except lowercase a-z (this automatically handles spaces, tone numbers, punctuation)
        s = s.replace(/[^a-z]/g, '');
        return s;
    }

    // Initialize typing interface
    function initTyping() {
        // Create typing container if not exists
        let typingContainer = document.getElementById('typing-container');
        if (!typingContainer) {
            const container = document.querySelector('.container');
            const controls = document.querySelector('.controls');
            
            typingContainer = document.createElement('div');
            typingContainer.id = 'typing-container';
            typingContainer.style.display = 'none';
            typingContainer.style.width = '100%';
            typingContainer.style.maxWidth = '500px';
            typingContainer.style.marginTop = '10px';
            typingContainer.style.marginBottom = '5px';
            typingContainer.style.flexDirection = 'row';
            typingContainer.style.alignItems = 'center';
            typingContainer.style.justifyContent = 'center';
            typingContainer.style.gap = '8px';
            typingContainer.style.boxSizing = 'border-box';
            typingContainer.style.marginLeft = 'auto';
            typingContainer.style.marginRight = 'auto';

            const input = document.createElement('input');
            input.type = 'text';
            input.id = 'typing-input';
            input.placeholder = 'Nhập Pinyin...';
            input.autocomplete = 'off';
            input.autocapitalize = 'none';
            input.spellcheck = false;
            
            // Style input
            input.style.flex = '1';
            input.style.padding = '12px 16px';
            input.style.border = '2px solid #cbd5e1';
            input.style.borderRadius = '16px';
            input.style.fontSize = '1.1rem';
            input.style.fontWeight = '600';
            input.style.textAlign = 'center';
            input.style.outline = 'none';
            input.style.transition = 'all 0.2s ease-in-out';
            input.style.boxShadow = '0 2px 4px rgba(0,0,0,0.05)';
            input.style.boxSizing = 'border-box';

            const submitBtn = document.createElement('button');
            submitBtn.id = 'typing-submit';
            submitBtn.textContent = 'OK';
            submitBtn.style.padding = '12px 24px';
            submitBtn.style.border = '2px solid #cbd5e1';
            submitBtn.style.borderRadius = '16px';
            submitBtn.style.fontSize = '1.1rem';
            submitBtn.style.fontWeight = 'bold';
            submitBtn.style.backgroundColor = '#f8fafc';
            submitBtn.style.color = '#334155';
            submitBtn.style.cursor = 'pointer';
            submitBtn.style.transition = 'all 0.2s ease-in-out';
            submitBtn.style.boxShadow = '0 2px 4px rgba(0,0,0,0.05)';
            submitBtn.style.boxSizing = 'border-box';

            // Hover effects
            submitBtn.addEventListener('mouseenter', () => {
                if (!submitBtn.disabled) submitBtn.style.backgroundColor = '#e2e8f0';
            });
            submitBtn.addEventListener('mouseleave', () => {
                if (!submitBtn.disabled && !submitBtn.classList.contains('correct') && !submitBtn.classList.contains('incorrect')) {
                    submitBtn.style.backgroundColor = '#f8fafc';
                }
            });

            const exitBtn = document.createElement('button');
            exitBtn.id = 'typing-exit';
            exitBtn.textContent = '✕';
            exitBtn.style.padding = '12px 18px';
            exitBtn.style.border = '2px solid #cbd5e1';
            exitBtn.style.borderRadius = '16px';
            exitBtn.style.fontSize = '1.1rem';
            exitBtn.style.fontWeight = 'bold';
            exitBtn.style.backgroundColor = '#f8fafc';
            exitBtn.style.color = '#64748b';
            exitBtn.style.cursor = 'pointer';
            exitBtn.style.transition = 'all 0.2s ease-in-out';
            exitBtn.style.boxSizing = 'border-box';
            exitBtn.title = 'Thoát chế độ gõ';

            // Hover effects for exit button
            exitBtn.addEventListener('mouseenter', () => {
                exitBtn.style.backgroundColor = '#fee2e2';
                exitBtn.style.color = '#ef4444';
                exitBtn.style.borderColor = '#fca5a5';
            });
            exitBtn.addEventListener('mouseleave', () => {
                exitBtn.style.backgroundColor = '#f8fafc';
                exitBtn.style.color = '#64748b';
                exitBtn.style.borderColor = '#cbd5e1';
            });
            exitBtn.addEventListener('click', (e) => {
                e.stopPropagation();
                setTypingActive(false);
            });

            typingContainer.appendChild(input);
            typingContainer.appendChild(submitBtn);
            typingContainer.appendChild(exitBtn);
            
            // Insert after controls
            if (controls && controls.parentNode) {
                controls.parentNode.insertBefore(typingContainer, controls.nextSibling);
            } else if (container) {
                container.appendChild(typingContainer);
            }

            // Bind events
            input.addEventListener('input', handleTypingInput);
            input.addEventListener('keydown', handleKeyDown);
            submitBtn.addEventListener('click', checkAnswer);
        }

        // Add custom styles for correct/incorrect states
        if (!document.getElementById('typing-styles')) {
            const style = document.createElement('style');
            style.id = 'typing-styles';
            style.textContent = `
                #typing-input.correct {
                    border-color: #22c55e !important;
                    box-shadow: 0 0 0 4px rgba(34, 197, 94, 0.2) !important;
                    background-color: #f0fdf4 !important;
                    color: #166534 !important;
                }
                #typing-submit.correct {
                    border-color: #22c55e !important;
                    background-color: #22c55e !important;
                    color: #ffffff !important;
                }
                #typing-input.incorrect {
                    border-color: #ef4444 !important;
                    box-shadow: 0 0 0 4px rgba(239, 68, 68, 0.2) !important;
                    background-color: #fef2f2 !important;
                    color: #991b1b !important;
                    animation: typing-shake-anim 0.25s ease-in-out;
                }
                #typing-submit.incorrect {
                    border-color: #ef4444 !important;
                    background-color: #ef4444 !important;
                    color: #ffffff !important;
                    animation: typing-shake-anim 0.25s ease-in-out;
                }
                @keyframes typing-shake-anim {
                    0%, 100% { transform: translateX(0); }
                    20%, 60% { transform: translateX(-6px); }
                    40%, 80% { transform: translateX(6px); }
                }
            `;
            document.head.appendChild(style);
        }

        // Load active state from localStorage
        const savedState = localStorage.getItem('hsk_typing_mode_active');
        if (savedState === 'true') {
            setTypingActive(true);
        } else {
            setTypingActive(false);
        }
    }

    // Set active state
    function setTypingActive(active) {
        isTypingActive = active;
        localStorage.setItem('hsk_typing_mode_active', active);

        const container = document.getElementById('typing-container');
        const input = document.getElementById('typing-input');
        const submitBtn = document.getElementById('typing-submit');
        const toggleBtn = document.getElementById('typing-toggle');

        const frontPinyin = document.getElementById('front-pinyin');
        const backPinyin = document.getElementById('back-pinyin');

        const header = document.querySelector('.header');
        const controls = document.querySelector('.controls');
        const wrapper = document.querySelector('.flashcard-wrapper');
        const frontWord = document.getElementById('front-word');

        if (active) {
            if (header) header.style.display = 'none';
            if (controls) controls.style.display = 'none';

            if (wrapper) {
                wrapper.style.position = 'fixed';
                wrapper.style.top = '10px';
                wrapper.style.left = '50%';
                wrapper.style.transform = 'translateX(-50%)';
                wrapper.style.width = 'calc(100% - 20px)';
                wrapper.style.maxWidth = '500px';
                wrapper.style.height = '240px';
                wrapper.style.zIndex = '1000';
            }

            if (container) {
                container.style.display = 'flex';
                container.style.position = 'fixed';
                container.style.top = '260px';
                container.style.left = '50%';
                container.style.transform = 'translateX(-50%)';
                container.style.width = 'calc(100% - 20px)';
                container.style.maxWidth = '500px';
                container.style.zIndex = '1000';
                container.style.margin = '0';
            }

            if (frontWord) {
                frontWord.style.fontSize = '4.5rem';
            }

            if (input) {
                input.value = '';
                input.className = '';
                input.disabled = false;
                setTimeout(() => input.focus(), 100);
            }
            if (submitBtn) {
                submitBtn.className = '';
                submitBtn.disabled = false;
                submitBtn.style.backgroundColor = '#f8fafc';
            }
            if (toggleBtn) {
                toggleBtn.classList.add('active');
                toggleBtn.title = "Chế độ gõ chữ (Typing): BẬT";
                toggleBtn.innerHTML = "⌨️";
            }
            
            // Hide pinyin on card front only
            if (frontPinyin) frontPinyin.style.display = 'none';
            if (backPinyin) backPinyin.style.display = '';
        } else {
            if (header) header.style.display = '';
            if (controls) controls.style.display = '';

            if (wrapper) {
                wrapper.style.position = '';
                wrapper.style.top = '';
                wrapper.style.left = '';
                wrapper.style.transform = '';
                wrapper.style.width = '';
                wrapper.style.maxWidth = '';
                wrapper.style.height = '';
                wrapper.style.zIndex = '';
            }

            if (container) {
                container.style.display = 'none';
                container.style.position = '';
                container.style.top = '';
                container.style.left = '';
                container.style.transform = '';
                container.style.width = '';
                container.style.maxWidth = '';
                container.style.zIndex = '';
                container.style.margin = '';
            }

            if (frontWord) {
                frontWord.style.fontSize = '';
            }

            if (toggleBtn) {
                toggleBtn.classList.remove('active');
                toggleBtn.title = "Chế độ gõ chữ (Typing): TẮT";
                toggleBtn.innerHTML = "⌨️";
            }
            
            // Show pinyin on card
            if (frontPinyin) frontPinyin.style.display = '';
            if (backPinyin) backPinyin.style.display = '';
        }
    }

    // Handle typing input
    function handleTypingInput(e) {
        if (isTransitioningWord) return;

        const input = e.target;
        const submitBtn = document.getElementById('typing-submit');

        // Reset classes on input (make border neutral again while they modify input)
        input.classList.remove('correct', 'incorrect');
        if (submitBtn) {
            submitBtn.classList.remove('correct', 'incorrect');
            submitBtn.style.backgroundColor = '#f8fafc';
        }
    }

    // Check Answer
    function checkAnswer() {
        if (isTransitioningWord) return;

        const input = document.getElementById('typing-input');
        const submitBtn = document.getElementById('typing-submit');
        if (!input) return;

        const value = input.value;
        const normalizedValue = normalizePinyin(value);

        if (!normalizedValue) {
            input.className = '';
            if (submitBtn) {
                submitBtn.className = '';
                submitBtn.style.backgroundColor = '#f8fafc';
            }
            return;
        }

        // Get target pinyin of current flashcard
        const list = (typeof window.paginatedFlashcards !== 'undefined' && window.paginatedFlashcards) || 
                     (typeof paginatedFlashcards !== 'undefined' && paginatedFlashcards);
        const idx = (typeof window.currentIndex !== 'undefined' && window.currentIndex !== null) ? window.currentIndex :
                    ((typeof currentIndex !== 'undefined' && currentIndex !== null) ? currentIndex : 0);

        if (!list || list.length === 0) return;
        const currentCard = list[idx];
        if (!currentCard) return;

        const targetPinyin = currentCard.pinyin;
        const normalizedTarget = normalizePinyin(targetPinyin);

        if (normalizedValue === normalizedTarget) {
            isTransitioningWord = true;
            input.classList.remove('incorrect');
            input.classList.add('correct');
            input.disabled = true;

            if (submitBtn) {
                submitBtn.classList.remove('incorrect');
                submitBtn.classList.add('correct');
                submitBtn.disabled = true;
            }

            // Success feedback and transition
            setTimeout(() => {
                input.className = '';
                input.disabled = false;
                input.value = '';
                
                if (submitBtn) {
                    submitBtn.className = '';
                    submitBtn.disabled = false;
                    submitBtn.style.backgroundColor = '#f8fafc';
                }
                isTransitioningWord = false;
                
                // Call global nextCard
                if (typeof window.nextCard === 'function') {
                    window.nextCard();
                }
                
                // Re-focus
                setTimeout(() => input.focus(), 50);
            }, 600);
        } else {
            // Wrong answer! Turn red, shake, and let them edit
            input.classList.remove('correct');
            input.classList.add('incorrect');

            if (submitBtn) {
                submitBtn.classList.remove('correct');
                submitBtn.classList.add('incorrect');
            }

            input.select();
        }
    }

    // Prevent enter/space causing random flips when typing
    function handleKeyDown(e) {
        if (e.key === ' ' || e.key === 'Enter') {
            e.stopPropagation();
        }
        if (e.key === 'Enter') {
            checkAnswer();
        }
    }

    // Toggle typing mode
    window.toggleTypingMode = function (e) {
        if (e && typeof e.stopPropagation === 'function') {
            e.stopPropagation();
        }
        setTypingActive(!isTypingActive);
    };

    // Listen for card renders to hide/show pinyin and clear input
    window.onCardRendered = function () {
        const frontPinyin = document.getElementById('front-pinyin');
        const backPinyin = document.getElementById('back-pinyin');
        const input = document.getElementById('typing-input');

        if (isTypingActive) {
            if (frontPinyin) frontPinyin.style.display = 'none';
            if (backPinyin) backPinyin.style.display = '';
            if (input && !isTransitioningWord) {
                input.value = '';
                input.className = '';
                input.disabled = false;
                setTimeout(() => input.focus(), 50);
            }
        } else {
            if (frontPinyin) frontPinyin.style.display = '';
            if (backPinyin) backPinyin.style.display = '';
        }
    };

    // Auto init when script is loaded
    if (document.readyState === 'loading') {
        document.addEventListener('DOMContentLoaded', initTyping);
    } else {
        initTyping();
    }
})();
