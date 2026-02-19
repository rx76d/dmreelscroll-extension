(function() {
    'use strict';

    const CONFIG = {
        minWidth: 100,
        minHeight: 140,
        watchBuffer: 0.5,
        scrollDelay: 1000,
        photoDuration: 3,
        maxLoadWait:5000
    };

    let isRunning = false;
    let playDirection ='down';
    
    function createUI() {
        if (document.getElementById('ig-visual-ui')) return;

        const div = document.createElement('div');
        div.id = 'ig-visual-ui'
        Object.assign(div.style, {
            position: 'fixed', bottom: '20px', right: '20px', zIndex: '9999999',
            backgroundColor: '#lalala', padding: '12px', borderRadius: '12px',
            color: 'white', fontFamily: 'sans-serif',
            boxShadow: '0 4px 15px rgba(0,0,0,0.5)', border: '1px solid #333',
            display: 'flex', flexDirection: 'column', gap: '8px', width: '220px'
        });

        const status = document.createElement('div');
        status.id = 'ig-visual-status';
        status.innerText = 'Extension Ready';
        status.style.fontSize = '12px';
        status.style.textAlign = 'center';
        status.style.color = '#888';
        status.style.marginBottom = '5px';

        const btnRow = document.createElement('div');
        btnRow.style.display = 'flex';
        btnRow.style.gap = '5px';

        const dirBtn = document.createElement('button');
        dirBtn.id = 'ig-visual-dir-btn';
        dirBtn.innerText = '⬇ DOWN';
        Object.assign(dirBtn.style, {
            backgroundColor: '#333', border: '1px solid #555', borderRadius: '6px',
            color: 'white', padding: '8px', cursor: 'pointer', flex: '1', fontSize: '12px'
        });
        dirBtn.onclick = toggleDirection;

        const playBtn = document.createElement('button');
        playBtn.id = 'ig-visual-play-btn';
        playBtn.innerText = '▶ START';
        Object.assign(playBtn.style, {
            backgroundColor: '#0095f6', border: 'none', borderRadius: '6px',
            color: 'white', padding: '8px', cursor: 'pointer', fontWeight: 'bold', flex: '2', fontSize: '13px'
        });

        playBtn.onclick = toggleScript;

        btnRow.appendChild(dirBtn);
        btnRow.appendChild(playBtn);
        div.appendChild(status);
        div.appendChild(btnRow);
        document.body.appendChild(div);
    }

    function updateStatus(text, color = '#ccc') {
        const el = document.getElementById('ig-visual-status');
        if (el) {
            el.innerText = text;
            el.style.color = color;
        }
    }

    function toggleDirection() {
        const btn = document.getElementById('ig-visual-dir-btn');
        if (playDirection === 'down') {
            playDirection = 'up';
            btn.innerText = '⬆ UP';
            updateStatus("Direction: Bottom to Top");
        } else {
            playDirection = 'down';
            btn.innerText = '⬇ DOWN';
            updateStatus("Direction: Top to Bottom");
        }
    }

    function toggleScript() {
        const btn = document.getElementById('ig-visual-play-btn');
        if (isRunning) {
            isRunning = false;
            btn.innerText = '▶ START';
            btn.style.backgroundColor = '#0095f6';
            updateStatus("Stopped");
        } else {
            isRunning = true;
            btn.innerText = '⏹ STOP';
            btn.style.backgroundColor = '#ed4956';
            findAndPlayNext();
        }
    }

    function findAndPlayNext() {
        if (!isRunning) return;
        const allImages = Array.from(document.querySelectorAll('img'));
        const candidates = allImages.filter(img => {
            const rect = img.getBoundingClientRect();
            const isVisible = rect.width > 0 && rect.height > 0;
            const isBigEnough = rect.width > CONFIG.minWidth && rect.height > CONFIG.minHeight;
            const isNew = !img.dataset.igReelWatched;
            const isVertical = rect.height > rect.width;
            return isVisible && isBigEnough && isNew && isVertical;
        });

        if (candidates.length === 0) {
            updateStatus("No new reels found.\nScroll & check direction.", "#ffaa00");
            isRunning = false;
            document.getElementById('ig-visual-play-btn').innerText = '▶ START';
            document.getElementById('ig-visual-play-btn').style.backgroundColor = '#0095f6';
            return;
        }

        let targetImg;
        if (playDirection === 'down') {
            targetImg = candidates[0];
        } else {
            targetImg = candidates[candidates.length - 1];
        }

        updateStatus(`Queue: ${candidates.length} | Dir: ${playDirection.toUpperCase()}`, "#00ff00");
        targetImg.scrollIntoView({ behavior: 'smooth', block: 'center' });
        targetImg.style.outline = "4px solid #00ff00"; 
        targetImg.style.transition = "outline 0.3s";

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
                 if (attempts * 500 > CONFIG.maxLoadWait) {
                     clearInterval(check);
                     closeModal();
                 }
                 return;
            }
            const video = dialog.querySelector('video');
            const closeBtn = document.querySelector('svg[aria-label="Close"]');

            if (video) {
                clearInterval(check);
                monitorVideo(video);
            } else if (attempts > 6 && closeBtn) {
                clearInterval(check);
                updateStatus("Photo detected.");
                setTimeout(closeModal, CONFIG.photoDuration * 1000);
            }

            if (attempts * 500 > CONFIG.maxLoadWait) {
                clearInterval(check);
                closeModal();
            }
        }, 500);
    }

    function monitorVideo(video) {
        if (!isRunning) return;
        updateStatus("Watching...");

        if (video.paused) video.play().catch(e => console.log("Autoplay blocked"));

        let lastTime = -1;
        const checkInterval = setInterval(() => {
            if (!isRunning) { clearInterval(checkInterval); return; }

            const t = video.currentTime;
            const d = video.duration;

            if ((d > 0 && d - t < 0.4) || (lastTime > 1 && t < 0.5)) {
                clearInterval(checkInterval);
                updateStatus("Finished.");
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

        setTimeout(() => {
            if (isRunning) findAndPlayNext();
        }, 1200);
    }

    setTimeout(createUI, 2500);

})();