// Car Mechanic JavaScript

// API Configuration - Environment aware
const API_URL = window.location.hostname === 'localhost' || window.location.hostname === '127.0.0.1'
    ? 'http://localhost:3000/api/chat'
    : `${window.location.origin}/api/chat`;
const API_TIMEOUT = 60000; // 60 second timeout

// State
let conversationHistory = [];
let chatStarted = false;

// Register Service Worker for PWA
if ('serviceWorker' in navigator) {
    window.addEventListener('load', () => {
        navigator.serviceWorker.register('/service-worker.js')
            .then((registration) => {
                console.log('[PWA] Service Worker registered successfully:', registration.scope);

                // Check for updates periodically
                setInterval(() => {
                    registration.update();
                }, 60000); // Check every minute

                // Handle service worker updates
                registration.addEventListener('updatefound', () => {
                    const newWorker = registration.installing;
                    newWorker.addEventListener('statechange', () => {
                        if (newWorker.state === 'installed' && navigator.serviceWorker.controller) {
                            // New service worker available, prompt user to refresh
                            if (confirm('A new version of Car Mechanic is available. Reload to update?')) {
                                newWorker.postMessage({ type: 'SKIP_WAITING' });
                                window.location.reload();
                            }
                        }
                    });
                });
            })
            .catch((error) => {
                console.error('[PWA] Service Worker registration failed:', error);
            });

        // Reload page when new service worker takes control
        navigator.serviceWorker.addEventListener('controllerchange', () => {
            window.location.reload();
        });
    });
}

// Check if running as PWA
function isPWA() {
    return window.matchMedia('(display-mode: standalone)').matches ||
           window.navigator.standalone === true;
}

// Show install prompt for PWA
let deferredPrompt;
window.addEventListener('beforeinstallprompt', (e) => {
    // Prevent the mini-infobar from appearing on mobile
    e.preventDefault();
    deferredPrompt = e;

    // Only show install button if not already installed
    if (!isPWA()) {
        showInstallButton();
    }
});

function showInstallButton() {
    // Detect platform
    const isAndroid = /android/i.test(navigator.userAgent);
    const isIOS = /iphone|ipad|ipod/i.test(navigator.userAgent);

    const androidBtn = document.getElementById('install-android');
    const appleBtn = document.getElementById('install-apple');

    if (isAndroid && androidBtn) {
        androidBtn.classList.remove('hidden');
        console.log('[PWA] Android install button shown');
    } else if (isIOS && appleBtn) {
        appleBtn.classList.remove('hidden');
        console.log('[PWA] iOS install button shown');
    } else if (androidBtn) {
        // For desktop/other platforms, show Android button (PWA install)
        androidBtn.classList.remove('hidden');
        console.log('[PWA] Install button shown for desktop/other platform');
    }
}

document.addEventListener('DOMContentLoaded', function() {
    console.log('Car Mechanic website loaded');
    console.log('API URL:', API_URL);
    console.log('Running as PWA:', isPWA());

    // Check authentication
    const authToken = localStorage.getItem('authToken');
    if (!authToken) {
        console.log('[Auth] No auth token found. Redirecting to login page...');
        // Show a brief message before redirecting
        const message = document.createElement('div');
        message.style.cssText = `
            position: fixed;
            top: 50%;
            left: 50%;
            transform: translate(-50%, -50%);
            background: #2b2b2b;
            color: #e0e0e0;
            padding: 30px;
            border-radius: 12px;
            border-top: 3px solid #d32f2f;
            z-index: 9999;
            text-align: center;
            font-family: Inter, sans-serif;
            box-shadow: 0 20px 60px rgba(0, 0, 0, 0.5);
        `;
        message.innerHTML = '<p style="margin: 0; font-size: 16px; font-weight: 600;">🔐 Please log in to access the chat...</p>';
        document.body.appendChild(message);

        // Redirect after 1.5 seconds
        setTimeout(() => {
            window.location.href = '/login.html';
        }, 1500);
        return;
    }

    // Elements
    const userInput = document.getElementById('user-input');
    const sendBtn = document.getElementById('send-btn');
    const clearBtn = document.getElementById('clear-chat');
    const exportBtn = document.getElementById('export-chat');
    const installAndroidBtn = document.getElementById('install-android');
    const installAppleBtn = document.getElementById('install-apple');
    const chatMessages = document.getElementById('chat-messages');
    const loadingIndicator = document.getElementById('loading');
    const suggestionCards = document.querySelectorAll('.suggestion-card');
    const carYear = document.getElementById('car-year');
    const carMake = document.getElementById('car-make');
    const carModel = document.getElementById('car-model');
    const engineType = document.getElementById('engine-type');
    const engineSize = document.getElementById('engine-size');

    // Car data - UK/European focused
    const carMakes = ['Alfa Romeo', 'Audi', 'BMW', 'Citroen', 'Dacia', 'Fiat', 'Ford', 'Honda', 'Hyundai', 'Jaguar', 'Jeep', 'Kia', 'Land Rover', 'Lexus', 'Mazda', 'Mercedes-Benz', 'MG', 'Mini', 'Mitsubishi', 'Nissan', 'Peugeot', 'Renault', 'SEAT', 'Skoda', 'Subaru', 'Suzuki', 'Tesla', 'Toyota', 'Vauxhall', 'Volkswagen', 'Volvo'];

    const carModels = {
        'Alfa Romeo': ['Giulia', 'Giulietta', 'Stelvio', 'Tonale', 'MiTo', '159', '147'],
        'Audi': ['A1', 'A3', 'A4', 'A5', 'A6', 'A7', 'A8', 'Q2', 'Q3', 'Q5', 'Q7', 'Q8', 'e-tron', 'TT', 'R8'],
        'BMW': ['1 Series', '2 Series', '3 Series', '4 Series', '5 Series', '7 Series', '8 Series', 'X1', 'X2', 'X3', 'X4', 'X5', 'X6', 'X7', 'i3', 'i4', 'iX', 'Z4'],
        'Citroen': ['C1', 'C3', 'C3 Aircross', 'C4', 'C4 Cactus', 'C5 Aircross', 'Berlingo', 'SpaceTourer', 'e-C4'],
        'Dacia': ['Sandero', 'Duster', 'Jogger', 'Spring', 'Logan'],
        'Fiat': ['500', '500X', '500L', 'Panda', 'Tipo', 'Ducato', '500e'],
        'Ford': ['Fiesta', 'Focus', 'Puma', 'Kuga', 'Mondeo', 'Mustang', 'Ranger', 'Transit', 'EcoSport', 'Galaxy', 'S-Max'],
        'Honda': ['Civic', 'Jazz', 'HR-V', 'CR-V', 'e:Ny1'],
        'Hyundai': ['i10', 'i20', 'i30', 'Bayon', 'Kona', 'Tucson', 'Santa Fe', 'Ioniq', 'Ioniq 5'],
        'Jaguar': ['XE', 'XF', 'XJ', 'F-Type', 'E-Pace', 'F-Pace', 'I-Pace'],
        'Jeep': ['Renegade', 'Compass', 'Cherokee', 'Wrangler', 'Grand Cherokee', 'Avenger'],
        'Kia': ['Picanto', 'Rio', 'Ceed', 'Xceed', 'Niro', 'Sportage', 'Sorento', 'EV6', 'Stonic'],
        'Land Rover': ['Defender', 'Discovery', 'Discovery Sport', 'Range Rover', 'Range Rover Sport', 'Range Rover Evoque', 'Range Rover Velar'],
        'Lexus': ['IS', 'ES', 'UX', 'NX', 'RX', 'LC', 'LS'],
        'Mazda': ['Mazda2', 'Mazda3', 'Mazda6', 'CX-3', 'CX-5', 'CX-30', 'CX-60', 'MX-5', 'MX-30'],
        'Mercedes-Benz': ['A-Class', 'B-Class', 'C-Class', 'E-Class', 'S-Class', 'CLA', 'GLA', 'GLB', 'GLC', 'GLE', 'GLS', 'EQA', 'EQB', 'EQC', 'EQE', 'EQS'],
        'MG': ['MG3', 'MG4', 'MG5', 'HS', 'ZS', 'Marvel R'],
        'Mini': ['Mini 3-Door', 'Mini 5-Door', 'Clubman', 'Countryman', 'Convertible', 'Electric'],
        'Mitsubishi': ['Mirage', 'ASX', 'Eclipse Cross', 'Outlander', 'L200'],
        'Nissan': ['Micra', 'Juke', 'Qashqai', 'X-Trail', 'Ariya', 'Leaf', 'GT-R'],
        'Peugeot': ['108', '208', '308', '2008', '3008', '5008', 'Rifter', 'Partner', 'e-208', 'e-2008'],
        'Renault': ['Clio', 'Captur', 'Megane', 'Kadjar', 'Arkana', 'Austral', 'Zoe', 'Megane E-Tech'],
        'SEAT': ['Ibiza', 'Leon', 'Arona', 'Ateca', 'Tarraco'],
        'Skoda': ['Fabia', 'Scala', 'Octavia', 'Karoq', 'Kodiaq', 'Kamiq', 'Enyaq'],
        'Subaru': ['Impreza', 'XV', 'Forester', 'Outback', 'WRX', 'BRZ', 'Solterra'],
        'Suzuki': ['Ignis', 'Swift', 'Vitara', 'S-Cross', 'Jimny', 'Across'],
        'Tesla': ['Model 3', 'Model S', 'Model X', 'Model Y'],
        'Toyota': ['Aygo', 'Yaris', 'Corolla', 'Camry', 'Prius', 'C-HR', 'RAV4', 'Highlander', 'Land Cruiser', 'Hilux', 'Proace', 'bZ4X'],
        'Vauxhall': ['Corsa', 'Astra', 'Insignia', 'Grandland', 'Crossland', 'Mokka', 'Combo', 'Vivaro', 'Corsa-e'],
        'Volkswagen': ['Up', 'Polo', 'Golf', 'Passat', 'Arteon', 'T-Cross', 'T-Roc', 'Tiguan', 'Touareg', 'Touran', 'ID.3', 'ID.4', 'ID.5'],
        'Volvo': ['V40', 'V60', 'V90', 'S60', 'S90', 'XC40', 'XC60', 'XC90', 'C40', 'EX30']
    };

    // Helper function to populate dropdowns
    function initializeVehicleSelectors() {
        const yearSelect = document.getElementById('car-year');
        const makeSelect = document.getElementById('car-make');
        const modelSelect = document.getElementById('car-model');

        if (!yearSelect || !makeSelect || !modelSelect) return;

        // Populate year dropdown
        const currentYear = new Date().getFullYear();
        for (let year = currentYear; year >= 2000; year--) {
            const option = document.createElement('option');
            option.value = year;
            option.textContent = year;
            yearSelect.appendChild(option);
        }

        // Populate make dropdown
        carMakes.forEach(make => {
            const option = document.createElement('option');
            option.value = make;
            option.textContent = make;
            makeSelect.appendChild(option);
        });

        // Update model dropdown when make changes
        makeSelect.addEventListener('change', function() {
            modelSelect.innerHTML = '<option value="">Model</option>';
            const selectedMake = this.value;
            if (selectedMake && carModels[selectedMake]) {
                carModels[selectedMake].forEach(model => {
                    const option = document.createElement('option');
                    option.value = model;
                    option.textContent = model;
                    modelSelect.appendChild(option);
                });
            }
        });
    }

    // Initialize vehicle selectors on page load
    initializeVehicleSelectors();

    // Load saved vehicle preset
    loadVehiclePreset();

    // Save vehicle preset when any selector changes
    [carYear, carMake, carModel, engineType, engineSize].forEach(selector => {
        if (selector) {
            selector.addEventListener('change', saveVehiclePreset);
        }
    });

    // Auto-resize textarea
    userInput.addEventListener('input', function() {
        this.style.height = 'auto';
        this.style.height = Math.min(this.scrollHeight, 150) + 'px';

        // Enable/disable send button
        sendBtn.disabled = !this.value.trim();
    });

    // Send message on button click
    sendBtn.addEventListener('click', sendMessage);

    // Send message on Enter (but Shift+Enter for new line)
    userInput.addEventListener('keydown', function(e) {
        if (e.key === 'Enter' && !e.shiftKey) {
            e.preventDefault();
            sendMessage();
        }
    });

    // Clear chat button
    clearBtn.addEventListener('click', function() {
        if (confirm('Are you sure you want to clear the chat history?')) {
            resetChat();
        }
    });

    // Export chat button
    exportBtn.addEventListener('click', function() {
        if (conversationHistory.length === 0) {
            alert('No conversation to export. Start chatting first!');
            return;
        }

        // Create export menu
        const exportOptions = confirm('Export as:\n\nOK = Text file (.txt)\nCancel = JSON file (.json)');

        if (exportOptions) {
            exportAsText();
        } else {
            exportAsJSON();
        }
    });

    // Android install button
    if (installAndroidBtn) {
        installAndroidBtn.addEventListener('click', async function() {
            if (!deferredPrompt) {
                alert('The app is already installed or install prompt is not available on this device.');
                return;
            }

            // Show the install prompt
            deferredPrompt.prompt();

            // Wait for the user's response
            const { outcome } = await deferredPrompt.userChoice;
            console.log('[PWA] User choice:', outcome);

            if (outcome === 'accepted') {
                console.log('[PWA] User accepted the install prompt');
            } else {
                console.log('[PWA] User dismissed the install prompt');
            }

            // Clear the deferred prompt
            deferredPrompt = null;

            // Hide the install button
            installAndroidBtn.classList.add('hidden');
        });
    }

    // Apple install button (iOS - show instructions)
    if (installAppleBtn) {
        installAppleBtn.addEventListener('click', function() {
            const isIOS = /iphone|ipad|ipod/i.test(navigator.userAgent);

            if (isIOS) {
                alert('To install Car Mechanic on your iPhone:\n\n1. Tap the Share button (square with arrow)\n2. Scroll down and tap "Add to Home Screen"\n3. Tap "Add" to install the app\n\nThe app will appear on your home screen!');
            } else {
                alert('iOS installation is only available on iPhone, iPad, or iPod devices.');
            }
        });
    }

    // Suggestion cards click handler
    suggestionCards.forEach(card => {
        card.addEventListener('click', function() {
            const prompt = this.getAttribute('data-prompt');
            userInput.value = prompt;
            userInput.style.height = 'auto';
            userInput.style.height = Math.min(userInput.scrollHeight, 80) + 'px';
            sendBtn.disabled = false;
            userInput.focus();
            // Optionally auto-send
            sendMessage();
        });
    });

    function resetChat() {
        conversationHistory = [];
        chatStarted = false;
        chatMessages.classList.remove('chat-started');
        chatMessages.innerHTML = `
            <div class="vehicle-selector-section">
                <h2 class="selector-title">Select Your Vehicle</h2>
                <p class="selector-subtitle">Select your details and ask me a question</p>
                <div class="car-selector">
                    <select id="car-year" class="car-select"><option value="">Year</option></select>
                    <select id="car-make" class="car-select"><option value="">Make</option></select>
                    <select id="car-model" class="car-select"><option value="">Model</option></select>
                    <select id="engine-type" class="car-select">
                        <option value="">Engine Type</option>
                        <option value="Petrol">Petrol</option>
                        <option value="Diesel">Diesel</option>
                        <option value="Hybrid">Hybrid</option>
                        <option value="Plug-in Hybrid">Plug-in Hybrid</option>
                        <option value="Electric">Electric</option>
                    </select>
                    <select id="engine-size" class="car-select">
                        <option value="">Engine Size</option>
                        <option value="1.0L">1.0L</option>
                        <option value="1.2L">1.2L</option>
                        <option value="1.4L">1.4L</option>
                        <option value="1.5L">1.5L</option>
                        <option value="1.6L">1.6L</option>
                        <option value="1.8L">1.8L</option>
                        <option value="2.0L">2.0L</option>
                        <option value="2.2L">2.2L</option>
                        <option value="2.4L">2.4L</option>
                        <option value="2.5L">2.5L</option>
                        <option value="2.7L">2.7L</option>
                        <option value="3.0L">3.0L</option>
                        <option value="3.5L">3.5L</option>
                        <option value="3.6L">3.6L</option>
                        <option value="4.0L">4.0L</option>
                        <option value="4.6L">4.6L</option>
                        <option value="5.0L">5.0L</option>
                        <option value="5.3L">5.3L</option>
                        <option value="5.7L">5.7L</option>
                        <option value="6.2L">6.2L</option>
                    </select>
                </div>
            </div>
            <div class="welcome-section">
                <div class="welcome-icon">
                    <svg width="44" height="44" viewBox="0 0 56 56" fill="none" xmlns="http://www.w3.org/2000/svg">
                        <circle cx="28" cy="28" r="26" fill="rgba(211, 47, 47, 0.2)" stroke="#d32f2f" stroke-width="2"/>
                        <path d="M22 18 L30 26 L22 34 L14 26 Z" fill="#ffb300" stroke="#d32f2f" stroke-width="1.5"/>
                        <circle cx="18" cy="26" r="4" fill="none" stroke="#d32f2f" stroke-width="1.5"/>
                        <rect x="6" y="23" width="14" height="6" rx="3" fill="#ffb300" stroke="#d32f2f" stroke-width="1.5"/>
                        <circle cx="38" cy="38" r="10" fill="#ffb300"/>
                        <circle cx="38" cy="38" r="5" fill="#d32f2f"/>
                    </svg>
                </div>
                <h1 class="welcome-title">Welcome to Car Mechanic</h1>
                <p class="welcome-subtitle">Your fast automotive Assistant</p>
                <div class="suggestions">
                    <button class="suggestion-card" data-prompt="My engine management light is on, what should I do?">
                        <span class="suggestion-icon">⚠️</span>
                        <div class="suggestion-text">Engine Management Light</div>
                    </button>
                    <button class="suggestion-card" data-prompt="How often should I service my car?">
                        <span class="suggestion-icon">🔧</span>
                        <div class="suggestion-text">Service Schedule</div>
                    </button>
                    <button class="suggestion-card" data-prompt="My car won't start, help me troubleshoot">
                        <span class="suggestion-icon">🔋</span>
                        <div class="suggestion-text">Car Won't Start</div>
                    </button>
                    <button class="suggestion-card" data-prompt="How do I service my car?">
                        <span class="suggestion-icon">🛠️</span>
                        <div class="suggestion-text">How to Service My Car</div>
                    </button>
                </div>
            </div>
        `;

        // Re-initialize vehicle selectors
        initializeVehicleSelectors();

        // Re-attach event listeners to new suggestion cards
        document.querySelectorAll('.suggestion-card').forEach(card => {
            card.addEventListener('click', function() {
                const prompt = this.getAttribute('data-prompt');
                userInput.value = prompt;
                userInput.style.height = 'auto';
                userInput.style.height = Math.min(userInput.scrollHeight, 80) + 'px';
                sendBtn.disabled = false;
                userInput.focus();
                sendMessage();
            });
        });
    }

    async function sendMessage() {
        const message = userInput.value.trim();

        if (!message) {
            return;
        }

        // Get car information
        const year = carYear.value;
        const make = carMake.value;
        const model = carModel.value;
        const engine = engineType.value;
        const size = engineSize.value;

        // Build full message with car context
        let fullMessage = message;
        if (year || make || model || engine || size) {
            const carInfo = [];
            if (year) carInfo.push(year);
            if (make) carInfo.push(make);
            if (model) carInfo.push(model);
            if (size) carInfo.push(size);
            if (engine) carInfo.push(engine);
            fullMessage = `[Vehicle: ${carInfo.join(' ')}] ${message}`;
        }

        // Hide welcome section on first message
        if (!chatStarted) {
            chatStarted = true;
            chatMessages.classList.add('chat-started');
        }

        // Disable input while processing
        userInput.disabled = true;
        sendBtn.disabled = true;

        // Add user message to chat (show original message without car prefix)
        addMessageToChat('user', message);

        // Clear input and reset height
        userInput.value = '';
        userInput.style.height = 'auto';

        // Show loading indicator with random car
        showLoadingWithRandomCar();
        loadingIndicator.classList.remove('hidden');

        // Show typing indicator in chat
        showTypingIndicator();

        try {
            // Create abort controller for timeout
            const controller = new AbortController();
            const timeoutId = setTimeout(() => controller.abort(), API_TIMEOUT);

            // Get auth token
            const token = localStorage.getItem('authToken');

            // Send to API (with car context and auth)
            const response = await fetch(API_URL, {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                    'Authorization': `Bearer ${token}`
                },
                body: JSON.stringify({
                    message: fullMessage,
                    conversationHistory: conversationHistory
                }),
                signal: controller.signal
            });

            clearTimeout(timeoutId);

            if (!response.ok) {
                let errorMessage = `Server error (${response.status})`;
                try {
                    const errorData = await response.json();
                    errorMessage = errorData.error || errorMessage;
                } catch (e) {
                    // Couldn't parse error JSON
                }
                throw new Error(errorMessage);
            }

            const data = await response.json();

            if (!data.response) {
                throw new Error('Invalid response from server');
            }

            // Update conversation history
            conversationHistory = data.conversationHistory;

            // Remove typing indicator
            hideTypingIndicator();

            // Add assistant message to chat
            addMessageToChat('assistant', data.response);

        } catch (error) {
            console.error('Error:', error);

            let errorMessage = 'Sorry, I encountered an error. ';
            let canRetry = false;

            if (error.name === 'AbortError') {
                errorMessage += 'The request took too long. This might be due to a slow connection or a complex question.';
                canRetry = true;
            } else if (error.message.includes('Failed to fetch')) {
                errorMessage += 'Cannot connect to the server. Please check:\n';
                errorMessage += '• The server is running (npm start)\n';
                errorMessage += '• Your internet connection\n';
                errorMessage += '• No firewall is blocking the connection';
                canRetry = true;
            } else if (error.message.includes('Too many requests') || error.message.includes('rate limit')) {
                errorMessage += 'Too many requests. Please wait a moment before trying again.';
                canRetry = true;
            } else if (error.message.includes('Access token required')) {
                errorMessage = '🔐 You need to log in to use the chat.\n\nPlease log in with your email and password to get started.';
                setTimeout(() => {
                    localStorage.removeItem('authToken');
                    const errorPageUrl = '/auth-error.html?type=invalid_token&code=NO_TOKEN&message=' + encodeURIComponent('No authentication token found');
                    window.location.href = errorPageUrl;
                }, 2000);
            } else if (error.message.includes('Invalid or expired token')) {
                errorMessage = '🔐 Your session has expired. Please log in again.';
                setTimeout(() => {
                    localStorage.removeItem('authToken');
                    const errorPageUrl = '/auth-error.html?type=expired_token&code=EXPIRED_TOKEN&message=' + encodeURIComponent('Your session token has expired. Please log in again.');
                    window.location.href = errorPageUrl;
                }, 2000);
            } else if (error.message.includes('Token has been revoked')) {
                errorMessage = '🔐 Your session has been revoked. Please log in again.';
                setTimeout(() => {
                    localStorage.removeItem('authToken');
                    const errorPageUrl = '/auth-error.html?type=invalid_token&code=TOKEN_REVOKED&message=' + encodeURIComponent('Your session token has been revoked. Please log in again.');
                    window.location.href = errorPageUrl;
                }, 2000);
            } else if (error.message.includes('quota exceeded')) {
                errorMessage = '📊 Monthly message quota exceeded! Please upgrade your plan or wait until next month.';
                errorMessage += '\n\nWould you like to upgrade your subscription?';
                setTimeout(() => {
                    if (confirm('Monthly message quota exceeded!\n\nWould you like to upgrade your plan?')) {
                        window.location.href = '/pricing.html';
                    }
                }, 1000);
            } else if (error.message.includes('401') || error.message.includes('403')) {
                errorMessage = '🔐 You need to be logged in to use this feature. Please log in and try again.';
                setTimeout(() => {
                    localStorage.removeItem('authToken');
                    const errorPageUrl = '/auth-error.html?type=invalid_token&code=UNAUTHORIZED&message=' + encodeURIComponent('Unauthorized access. Please log in again.');
                    window.location.href = errorPageUrl;
                }, 2000);
            } else if (error.message.includes('subscription required') || error.message.includes('Active subscription required')) {
                errorMessage = '💳 Active subscription required. Please subscribe to continue chatting and accessing vehicle-specific advice.';
                setTimeout(() => {
                    const errorPageUrl = '/auth-error.html?type=no_subscription&code=NO_SUBSCRIPTION&message=' + encodeURIComponent('You need an active subscription to use the chat feature.');
                    window.location.href = errorPageUrl;
                }, 2000);
            } else if (error.message.includes('503')) {
                errorMessage += 'The service is temporarily unavailable. Please try again in a moment.';
                canRetry = true;
            } else {
                errorMessage += error.message || 'An unexpected error occurred.';
                canRetry = true;
            }

            if (canRetry) {
                errorMessage += '\n\nYou can try asking your question again.';
            }

            // Remove typing indicator on error
            hideTypingIndicator();

            addMessageToChat('error', errorMessage);
        } finally {
            // Hide loading indicator
            loadingIndicator.classList.add('hidden');

            // Re-enable input
            userInput.disabled = false;
            // Only enable send button if there's text in input
            sendBtn.disabled = !userInput.value.trim();
            userInput.focus();
        }
    }

    function addMessageToChat(type, content) {
        const messageDiv = document.createElement('div');
        messageDiv.className = `message ${type}`;

        const contentDiv = document.createElement('div');
        contentDiv.className = 'message-content';

        // Convert markdown-style formatting to HTML
        const formattedContent = formatMessage(content);
        contentDiv.innerHTML = formattedContent;

        messageDiv.appendChild(contentDiv);
        chatMessages.appendChild(messageDiv);

        // Scroll to bottom smoothly
        setTimeout(() => {
            chatMessages.scrollTop = chatMessages.scrollHeight;
        }, 100);
    }

    // Add typing indicator
    function showTypingIndicator() {
        const typingDiv = document.createElement('div');
        typingDiv.className = 'message assistant typing-message';
        typingDiv.id = 'typing-indicator';

        const contentDiv = document.createElement('div');
        contentDiv.className = 'message-content typing-indicator-content';
        contentDiv.innerHTML = `
            <div class="typing-dots">
                <span class="dot"></span>
                <span class="dot"></span>
                <span class="dot"></span>
            </div>
        `;

        typingDiv.appendChild(contentDiv);
        chatMessages.appendChild(typingDiv);

        // Scroll to bottom
        setTimeout(() => {
            chatMessages.scrollTop = chatMessages.scrollHeight;
        }, 100);
    }

    // Remove typing indicator
    function hideTypingIndicator() {
        const indicator = document.getElementById('typing-indicator');
        if (indicator) {
            indicator.remove();
        }
    }

    function formatMessage(text) {
        // Escape HTML first
        let formatted = text
            .replace(/&/g, '&amp;')
            .replace(/</g, '&lt;')
            .replace(/>/g, '&gt;');

        // Code blocks (must be before inline code)
        formatted = formatted.replace(/```([^`]+)```/gs, function(match, code) {
            return '<pre><code>' + code.trim() + '</code></pre>';
        });

        // Inline code
        formatted = formatted.replace(/`([^`]+)`/g, '<code>$1</code>');

        // Headers
        formatted = formatted.replace(/^### (.+)$/gm, '<h3>$1</h3>');
        formatted = formatted.replace(/^## (.+)$/gm, '<h2>$1</h2>');
        formatted = formatted.replace(/^# (.+)$/gm, '<h1>$1</h1>');

        // Bold (must be before italic)
        formatted = formatted.replace(/\*\*(.+?)\*\*/g, '<strong>$1</strong>');

        // Italic
        formatted = formatted.replace(/\*(.+?)\*/g, '<em>$1</em>');

        // Links
        formatted = formatted.replace(/\[([^\]]+)\]\(([^)]+)\)/g, '<a href="$2" target="_blank" rel="noopener noreferrer">$1</a>');

        // Unordered lists
        formatted = formatted.replace(/^[•\-\*]\s(.+)$/gm, '<li>$1</li>');
        formatted = formatted.replace(/(<li>.*<\/li>\n?)+/gs, '<ul>$&</ul>');

        // Ordered lists
        formatted = formatted.replace(/^\d+\.\s(.+)$/gm, '<li>$1</li>');
        formatted = formatted.replace(/(<li>.*<\/li>(?:\n|<br>)?)+/gs, function(match) {
            // Only wrap if not already in UL tags
            if (!match.startsWith('<ul>')) {
                return '<ol>' + match + '</ol>';
            }
            return match;
        });

        // Line breaks
        formatted = formatted.replace(/\n/g, '<br>');

        // Clean up multiple br tags
        formatted = formatted.replace(/(<br>){3,}/g, '<br><br>');

        return formatted;
    }

    // Export conversation as text file
    function exportAsText() {
        const vehicleInfo = getVehicleInfo();
        let textContent = 'Car Mechanic - Conversation Export\n';
        textContent += '='.repeat(50) + '\n\n';

        if (vehicleInfo) {
            textContent += `Vehicle: ${vehicleInfo}\n\n`;
        }

        textContent += `Date: ${new Date().toLocaleString('en-GB', { dateStyle: 'full', timeStyle: 'short' })}\n`;
        textContent += '='.repeat(50) + '\n\n';

        conversationHistory.forEach((msg, index) => {
            const role = msg.role === 'user' ? 'YOU' : 'MY MECHANIC';
            textContent += `${role}:\n`;
            textContent += msg.content.replace(/<[^>]*>/g, '').replace(/&lt;/g, '<').replace(/&gt;/g, '>').replace(/&amp;/g, '&');
            textContent += '\n\n' + '-'.repeat(50) + '\n\n';
        });

        downloadFile(textContent, 'my-mechanic-conversation.txt', 'text/plain');
    }

    // Export conversation as JSON file
    function exportAsJSON() {
        const vehicleInfo = getVehicleInfo();
        const exportData = {
            exportDate: new Date().toISOString(),
            vehicle: vehicleInfo,
            conversationHistory: conversationHistory
        };

        const jsonContent = JSON.stringify(exportData, null, 2);
        downloadFile(jsonContent, 'my-mechanic-conversation.json', 'application/json');
    }

    // Helper function to download file
    function downloadFile(content, filename, mimeType) {
        const blob = new Blob([content], { type: mimeType });
        const url = URL.createObjectURL(blob);
        const link = document.createElement('a');
        link.href = url;
        link.download = filename;
        document.body.appendChild(link);
        link.click();
        document.body.removeChild(link);
        URL.revokeObjectURL(url);
    }

    // Helper function to get vehicle info
    function getVehicleInfo() {
        const year = carYear?.value;
        const make = carMake?.value;
        const model = carModel?.value;
        const engine = engineType?.value;
        const size = engineSize?.value;

        if (!year && !make && !model && !engine && !size) return null;

        const carInfo = [];
        if (year) carInfo.push(year);
        if (make) carInfo.push(make);
        if (model) carInfo.push(model);
        if (size) carInfo.push(size);
        if (engine) carInfo.push(engine);

        return carInfo.join(' ');
    }

    // Auto-save conversation to localStorage
    function saveConversation() {
        try {
            const vehicleInfo = getVehicleInfo();
            localStorage.setItem('myMechanic_conversation', JSON.stringify({
                timestamp: Date.now(),
                vehicle: vehicleInfo,
                history: conversationHistory
            }));
        } catch (error) {
            console.error('Failed to save conversation:', error);
        }
    }

    // Load saved conversation on page load
    function loadSavedConversation() {
        try {
            const saved = localStorage.getItem('myMechanic_conversation');
            if (saved) {
                const data = JSON.parse(saved);
                // Only load if less than 24 hours old
                if (Date.now() - data.timestamp < 24 * 60 * 60 * 1000) {
                    if (confirm('Found a saved conversation from earlier. Would you like to restore it?')) {
                        conversationHistory = data.history || [];

                        // Restore conversation to UI
                        if (conversationHistory.length > 0) {
                            chatStarted = true;
                            chatMessages.classList.add('chat-started');

                            conversationHistory.forEach(msg => {
                                addMessageToChat(msg.role, msg.content);
                            });
                        }
                    }
                } else {
                    // Clear old conversation
                    localStorage.removeItem('myMechanic_conversation');
                }
            }
        } catch (error) {
            console.error('Failed to load saved conversation:', error);
        }
    }

    // Loading car GIF animation
    function showLoadingWithRandomCar() {
        // Using animated GIF now, no need to change car icons
        // The GIF file (loading-car.gif) is already set in HTML
        const carIcon = document.querySelector('.car-icon.gif-loading');
        if (carIcon) {
            // Ensure GIF is loaded and playing
            carIcon.src = 'loading-car.gif?' + Date.now(); // Cache bust to restart animation
        }
    }

    // Load saved conversation on startup
    loadSavedConversation();

    // Save conversation after each message
    window.addEventListener('beforeunload', saveConversation);

    // Save vehicle preset
    function saveVehiclePreset() {
        try {
            const preset = {
                year: carYear?.value || '',
                make: carMake?.value || '',
                model: carModel?.value || '',
                engineType: engineType?.value || '',
                engineSize: engineSize?.value || ''
            };
            localStorage.setItem('myMechanic_vehiclePreset', JSON.stringify(preset));
            console.log('[Vehicle Preset] Saved:', preset);
        } catch (error) {
            console.error('[Vehicle Preset] Failed to save:', error);
        }
    }

    // Load vehicle preset
    function loadVehiclePreset() {
        try {
            const saved = localStorage.getItem('myMechanic_vehiclePreset');
            if (saved) {
                const preset = JSON.parse(saved);

                if (carYear && preset.year) carYear.value = preset.year;
                if (carMake && preset.make) {
                    carMake.value = preset.make;
                    // Trigger change event to populate models
                    carMake.dispatchEvent(new Event('change'));
                    // Wait for models to populate, then set model value
                    setTimeout(() => {
                        if (carModel && preset.model) carModel.value = preset.model;
                    }, 50);
                }
                if (engineType && preset.engineType) engineType.value = preset.engineType;
                if (engineSize && preset.engineSize) engineSize.value = preset.engineSize;

                console.log('[Vehicle Preset] Loaded:', preset);
            }
        } catch (error) {
            console.error('[Vehicle Preset] Failed to load:', error);
        }
    }
});
