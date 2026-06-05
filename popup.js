document.addEventListener('DOMContentLoaded', function() {
    const masterToggle = document.getElementById('masterToggle');
    const autoReactToggle = document.getElementById('autoReactToggle');
    const emojiDisplay = document.getElementById('emojiDisplay');
    const prevEmoji = document.getElementById('prevEmoji');
    const nextEmoji = document.getElementById('nextEmoji');
    
    const btnDir = document.getElementById('popDirBtn');
    const btnStart = document.getElementById('popStartBtn');
    const btnStop = document.getElementById('popStopBtn');

    const emojis = ['❤️', '😂', '😮', '😢', '🔥', '👍'];
    let emojiIndex = 0;
    let currentDir = 'down';

    chrome.storage.local.get(['igExtensionEnabled', 'igAutoReact', 'igTargetEmoji'], function(result) {
        masterToggle.checked = (result.igExtensionEnabled !== false);
        autoReactToggle.checked = (result.igAutoReact === true);
        
        const savedEmoji = result.igTargetEmoji || '❤️';
        const foundIndex = emojis.indexOf(savedEmoji);
        emojiIndex = (foundIndex > -1) ? foundIndex : 0;
        updateEmojiUI(false); 
    });

    masterToggle.addEventListener('change', function() {
        chrome.storage.local.set({ igExtensionEnabled: masterToggle.checked });
        sendCommand('toggleState', { enabled: masterToggle.checked });
    });

    autoReactToggle.addEventListener('change', function() {
        chrome.storage.local.set({ igAutoReact: autoReactToggle.checked });
        sendCommand('updateCommand', { cmd: 'setAutoReact', value: autoReactToggle.checked });
    });

    function updateEmojiUI(shouldSend = true) {
        const current = emojis[emojiIndex];
        emojiDisplay.innerText = current;
        chrome.storage.local.set({ igTargetEmoji: current });
        if(shouldSend) sendCommand('updateCommand', { cmd: 'setEmoji', value: current });
    }

    prevEmoji.addEventListener('click', () => {
        emojiIndex--;
        if (emojiIndex < 0) emojiIndex = emojis.length - 1;
        updateEmojiUI();
    });

    nextEmoji.addEventListener('click', () => {
        emojiIndex++;
        if (emojiIndex >= emojis.length) emojiIndex = 0;
        updateEmojiUI();
    });

    btnDir.addEventListener('click', () => {
        currentDir = (currentDir === 'down') ? 'up' : 'down';
        btnDir.innerText = (currentDir === 'down') ? '⬇ DOWN' : '⬆ UP';
        sendCommand('updateCommand', { cmd: 'setDirection', value: currentDir });
    });

    btnStart.addEventListener('click', () => {
        togglePlayState(true);
        sendCommand('updateCommand', { cmd: 'start' });
    });

    btnStop.addEventListener('click', () => {
        togglePlayState(false);
        sendCommand('updateCommand', { cmd: 'stop' });
    });

    function togglePlayState(isPlaying) {
        if (isPlaying) {
            btnStart.style.display = 'none';
            btnStop.style.display = 'block';
        } else {
            btnStart.style.display = 'block';
            btnStop.style.display = 'none';
        }
    }

    function sendCommand(action, data = {}) {
        chrome.tabs.query({active: true, currentWindow: true}, function(tabs) {
            if (tabs[0]) {
                if (!tabs[0].url.includes("instagram.com")) {
                    console.log("Not on Instagram");
                    return; 
                }

                chrome.tabs.sendMessage(tabs[0].id, { action: action, ...data }, (response) => {
                    if (chrome.runtime.lastError) {
                        console.log("Content script not ready. Refresh the page.");
                    }
                });
            }
        });
    }
});