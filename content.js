(function() {
    'use strict';

    const CONFIG = {
        minWidth: 100, minHeight: 140,
        watchBuffer: 0.5, scrollDelay: 1000,
        photoDuration: 3, maxLoadWait: 5000
    };

    let isRunning = false;
    let playDirection = 'down';

    chrome.storage.local.get(['igExtensionEnabled'], function(result) {
        if (result.igExtensionEnabled !== false) {
            setTimeout(createUI, 2500);
        }
    });

    chrome.runtime.onMessage.addListener(function(request, sender, sendResponse) {
        if (request.action === "toggleState") {
            if (request.enabled) {
                createUI();
            } else {
                removeUI();
            }
        }
    });

    function removeUI() {
        isRunning = false;
        const ui = document.getElementById('ig-visual-ui');
        if (ui) ui.remove();
    }

    function createUI() {
        if (document.getElementById('ig-visual-ui')) return;

        const div = document.createElement('div');
        div.id = 'ig-visual-ui';
        
        Object.assign(div.style, {
            position: 'fixed', bottom: '20px', right: '20px', zIndex: '9999999',
            backgroundColor: 'rgba(20, 20, 20, 0.65)',
            backdropFilter: 'blur(12px)',
            webkitBackdropFilter: 'blur(12px)',
            border: '1px solid rgba(255, 255, 255, 0.15)',
            boxShadow: '0 8px 32px 0 rgba(0, 0, 0, 0.37)',
            padding: '15px', borderRadius: '16px',
            color: 'white', fontFamily: 'sans-serif',
            display: 'flex', flexDirection: 'column', gap: '10px', width: '220px',
            transition: 'opacity 0.3s ease',
            cursor: 'move',
            userSelect: 'none' 
        });

        const status = document.createElement('div');
        status.id = 'ig-visual-status';
        status.innerText = 'Ready';
        status.style.fontSize = '12px';
        status.style.textAlign = 'center';
        status.style.color = 'rgba(255, 255, 255, 0.7)';
        status.style.pointerEvents = 'none';

        const btnRow = document.createElement('div');
        btnRow.style.display = 'flex';
        btnRow.style.gap = '8px';

        const btnStyle = {
            border: 'none', borderRadius: '8px', color: 'white',
            padding: '10px', cursor: 'pointer', fontSize: '12px', fontWeight: '600'
        };

        const dirBtn = document.createElement('button');
        dirBtn.id = 'ig-visual-dir-btn';
        dirBtn.innerText = '⬇ DOWN';
        Object.assign(dirBtn.style, btnStyle, {
            backgroundColor: 'rgba(255, 255, 255, 0.1)', flex: '1',
            border: '1px solid rgba(255, 255, 255, 0.1)'
        });
        dirBtn.onclick = toggleDirection;
        dirBtn.onmousedown = (e) => e.stopPropagation(); 
        const playBtn = document.createElement('button');
        playBtn.id = 'ig-visual-play-btn';
        playBtn.innerText = '▶ START';
        Object.assign(playBtn.style, btnStyle, {
            backgroundColor: '#0095f6', flex: '2',
            boxShadow: '0 2px 10px rgba(0, 149, 246, 0.3)'
        });
        playBtn.onclick = toggleScript;
        playBtn.onmousedown = (e) => e.stopPropagation();
        btnRow.appendChild(dirBtn);
        btnRow.appendChild(playBtn);
        div.appendChild(status);
        div.appendChild(btnRow);
        document.body.appendChild(div);

        makeDraggable(div);
    }
    function makeDraggable(element) {
        let isDragging = false;
        let startX, startY, initialLeft, initialTop;

        element.addEventListener('mousedown', function(e) {
            if (e.button !== 0) return;

            isDragging = true;
            startX = e.clientX;
            startY = e.clientY;

            const rect = element.getBoundingClientRect();
            initialLeft = rect.left;
            initialTop = rect.top;

            element.style.bottom = 'auto';
            element.style.right = 'auto';
            element.style.left = initialLeft + 'px';
            element.style.top = initialTop + 'px';
            element.style.cursor = 'grabbing';
        });

        document.addEventListener('mousemove', function(e) {
            if (!isDragging) return;
            const dx = e.clientX - startX;
            const dy = e.clientY - startY;
            element.style.left = (initialLeft + dx) + 'px';
            element.style.top = (initialTop + dy) + 'px';
        });

        document.addEventListener('mouseup', function() {
            if (isDragging) {
                isDragging = false;
                element.style.cursor = 'move';
            }
        });
    }

    function updateStatus(text, color = 'rgba(255, 255, 255, 0.8)') {
        const el = document.getElementById('ig-visual-status');
        if (el) { el.innerText = text; el.style.color = color; }
    }

    function toggleDirection() {
        const btn = document.getElementById('ig-visual-dir-btn');
        if (!btn) return;
        if (playDirection === 'down') {
            playDirection = 'up'; btn.innerText = '⬆ UP'; updateStatus("NOW: Top to Bottom");
        } else {
            playDirection = 'down'; btn.innerText = '⬇ DOWN'; updateStatus("NOW: Bottom to Top");
        }
    }

    function toggleScript() {
        const btn = document.getElementById('ig-visual-play-btn');
        if (!btn) return;
        if (isRunning) {
            isRunning = false;
            btn.innerText = '▶ START'; btn.style.backgroundColor = '#0095f6';
            updateStatus("Stopped");
        } else {
            isRunning = true;
            btn.innerText = '⏹ STOP'; btn.style.backgroundColor = '#ff3040';
            findAndPlayNext();
        }
    }

    function findAndPlayNext() {
        if (!isRunning) return;
        const allImages = Array.from(document.querySelectorAll('img'));
        const candidates = allImages.filter(img => {
            const rect = img.getBoundingClientRect();
            if (rect.width < CONFIG.minWidth || rect.height < CONFIG.minHeight) return false;
            if (img.dataset.igReelWatched) return false;
            return rect.height > rect.width;
        });

        if (candidates.length === 0) {
            updateStatus("No new reels found.", "#ffaa00");
            isRunning = false;
            const btn = document.getElementById('ig-visual-play-btn');
            if(btn) { btn.innerText = '▶ START'; btn.style.backgroundColor = '#0095f6'; }
            return;
        }

        let targetImg = (playDirection === 'down') ? candidates[0] : candidates[candidates.length - 1];

        updateStatus(`Queue: ${candidates.length}`, "#00ff00");
        targetImg.scrollIntoView({ behavior: 'smooth', block: 'center' });
        targetImg.style.outline = "4px solid #00ff00"; 
        
        setTimeout(() => {
            if (!isRunning) return;
            updateStatus("Opening...");
            targetImg.dataset.igReelWatched = "true";
            targetImg.style.outline = "4px solid #555"; 
            targetImg.click();
            setTimeout(waitForModal, 1500);
        }, CONFIG.scrollDelay);
    }

    function waitForModal() {
        if (!isRunning) return;
        let attempts = 0;
        const check = setInterval(() => {
            attempts++;
            const dialog = document.querySelector('div[role="dialog"]');
            if (!dialog) {
                 if (attempts * 500 > CONFIG.maxLoadWait) { clearInterval(check); closeModal(); }
                 return;
            }
            const video = dialog.querySelector('video');
            const closeBtn = document.querySelector('svg[aria-label="Close"]');

            if (video) {
                clearInterval(check); monitorVideo(video);
            } else if (attempts > 6 && closeBtn) {
                clearInterval(check); updateStatus("Photo detected.");
                setTimeout(closeModal, CONFIG.photoDuration * 1000);
            }
            if (attempts * 500 > CONFIG.maxLoadWait) { clearInterval(check); closeModal(); }
        }, 500);
    }

    function monitorVideo(video) {
        if (!isRunning) return;
        updateStatus("Watching...");
        if (video.paused) video.play().catch(() => {});
        let lastTime = -1;
        const checkInterval = setInterval(() => {
            if (!isRunning) { clearInterval(checkInterval); return; }
            const t = video.currentTime; const d = video.duration;
            if ((d > 0 && d - t < 0.4) || (lastTime > 1 && t < 0.5)) {
                clearInterval(checkInterval); updateStatus("Finished.");
                setTimeout(closeModal, CONFIG.watchBuffer * 1000);
            }
            lastTime = t;
        }, 200);
    }

    function closeModal() {
        updateStatus("Closing...");
        const closeSvg = document.querySelector('svg[aria-label="Close"]');
        if (closeSvg && closeSvg.closest('div[role="button"]')) {
            closeSvg.closest('div[role="button"]').click();
        } else {
            const escEvent = new KeyboardEvent('keydown', { key: 'Escape', code: 'Escape', keyCode: 27, bubbles: true });
            document.body.dispatchEvent(escEvent);
        }
        setTimeout(() => { if (isRunning) findAndPlayNext(); }, 1200);
    }
})();