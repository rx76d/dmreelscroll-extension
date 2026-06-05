(function() {
    'use strict';

    const CONFIG = {
        minWidth: 100, minHeight: 140,
        watchBuffer: 0.5, scrollDelay: 1000,
        photoDuration: 3, maxLoadWait: 5000,
        closeAnimationWait: 2000
    };

    let isRunning = false;
    let playDirection = 'down';
    let autoReactEnabled = false;
    let targetEmoji = '❤️'; 
    let currentTargetImg = null;

    try {
        chrome.storage.local.get(['igExtensionEnabled', 'igAutoReact', 'igTargetEmoji'], function(result) {
            if (result.igExtensionEnabled !== false) setTimeout(createUI, 2500);
            if (result.igAutoReact === true) autoReactEnabled = true;
            if (result.igTargetEmoji) targetEmoji = result.igTargetEmoji;
        });
    } catch(e) {}

    chrome.runtime.onMessage.addListener(function(request, sender, sendResponse) {
        if (request.action === "toggleState") request.enabled ? createUI() : removeUI();
        if (request.action === "updateCommand") {
            if (request.cmd === "start") startScript();
            if (request.cmd === "stop") stopScript();
            if (request.cmd === "setDirection") { playDirection = request.value; updateUIState(); }
            if (request.cmd === "setAutoReact") { autoReactEnabled = request.value; updateStatus(autoReactEnabled ? `Auto React: ON` : "Auto React: OFF"); }
            if (request.cmd === "setEmoji") { targetEmoji = request.value; updateStatus(`Next React: ${targetEmoji}`); }
        }
        return true;
    });

    function removeUI() { isRunning = false; document.getElementById('ig-visual-ui')?.remove(); }
    function createUI() {
        if (document.getElementById('ig-visual-ui')) return;
        const div = document.createElement('div');
        div.id = 'ig-visual-ui';
        Object.assign(div.style, {
            position: 'fixed', bottom: '20px', right: '20px', zIndex: '9999999',
            backgroundColor: 'rgba(20, 20, 20, 0.65)', backdropFilter: 'blur(12px)', webkitBackdropFilter: 'blur(12px)',
            border: '1px solid rgba(255, 255, 255, 0.15)', boxShadow: '0 8px 32px 0 rgba(0, 0, 0, 0.37)',
            padding: '15px', borderRadius: '16px', color: 'white', fontFamily: 'sans-serif',
            display: 'flex', flexDirection: 'column', gap: '10px', width: '220px', cursor: 'move', userSelect: 'none'
        });

        const status = document.createElement('div');
        status.id = 'ig-visual-status';
        status.innerText = 'Ready';
        Object.assign(status.style, { fontSize: '12px', textAlign: 'center', color: '#ccc' });

        const btnRow = document.createElement('div');
        btnRow.style.display = 'flex'; btnRow.style.gap = '8px';
        const btnStyle = { border: 'none', borderRadius: '8px', color: 'white', padding: '10px', cursor: 'pointer', fontSize: '12px', fontWeight: '600' };

        const dirBtn = document.createElement('button');
        dirBtn.id = 'ig-visual-dir-btn'; dirBtn.innerText = '⬇ DOWN';
        Object.assign(dirBtn.style, btnStyle, { backgroundColor: 'rgba(255,255,255,0.1)', flex: '1', border: '1px solid #444' });
        dirBtn.onclick = toggleDirection; dirBtn.onmousedown = (e) => e.stopPropagation();

        const playBtn = document.createElement('button');
        playBtn.id = 'ig-visual-play-btn'; playBtn.innerText = '▶ START';
        Object.assign(playBtn.style, btnStyle, { backgroundColor: '#0095f6', flex: '2' });
        playBtn.onclick = toggleScript; playBtn.onmousedown = (e) => e.stopPropagation();

        btnRow.appendChild(dirBtn); btnRow.appendChild(playBtn);
        div.appendChild(status); div.appendChild(btnRow);
        document.body.appendChild(div);
        makeDraggable(div); updateUIState();
    }

    function makeDraggable(el) {
        let isDrag=false, startX, startY, initL, initT;
        el.addEventListener('mousedown', e => { if(e.button!==0)return; isDrag=true; startX=e.clientX; startY=e.clientY; const r=el.getBoundingClientRect(); initL=r.left; initT=r.top; el.style.bottom='auto'; el.style.right='auto'; el.style.left=initL+'px'; el.style.top=initT+'px'; el.style.cursor='grabbing'; });
        document.addEventListener('mousemove', e => { if(!isDrag)return; el.style.left=(initL+(e.clientX-startX))+'px'; el.style.top=(initT+(e.clientY-startY))+'px'; });
        document.addEventListener('mouseup', () => { isDrag=false; el.style.cursor='move'; });
    }
    function updateStatus(t, c='#ccc') { const el=document.getElementById('ig-visual-status'); if(el) { el.innerText=t; el.style.color=c; } }
    function updateUIState() {
        const dBtn=document.getElementById('ig-visual-dir-btn'), pBtn=document.getElementById('ig-visual-play-btn');
        if(dBtn) dBtn.innerText = playDirection==='down'?'⬇ DOWN':'⬆ UP';
        if(pBtn) { pBtn.innerText=isRunning?'⏹ STOP':'▶ START'; pBtn.style.backgroundColor=isRunning?'#ff3040':'#0095f6'; }
    }

    function toggleDirection() { playDirection = playDirection==='down'?'up':'down'; updateStatus(playDirection==='down'?"Top to Bottom":"Bottom to Top"); updateUIState(); }
    function toggleScript() { isRunning ? stopScript() : startScript(); }
    function startScript() { isRunning=true; updateStatus("Starting..."); updateUIState(); findAndPlayNext(); }
    function stopScript() { isRunning=false; updateStatus("Stopped"); updateUIState(); }

    async function findAndPlayNext() {
        if (!isRunning) return;
        const allImages = Array.from(document.querySelectorAll('img'));
        const candidates = allImages.filter(img => {
            const rect = img.getBoundingClientRect();
            if (rect.width < CONFIG.minWidth || rect.height < CONFIG.minHeight) return false;
            if (img.dataset.igReelWatched) return false;
            return rect.height > rect.width;
        });

        if (candidates.length === 0) { updateStatus("No new reels found.", "#ffaa00"); stopScript(); return; }

        currentTargetImg = (playDirection === 'down') ? candidates[0] : candidates[candidates.length - 1];

        updateStatus(`Queue: ${candidates.length}`, "#00ff00");
        currentTargetImg.scrollIntoView({ behavior: 'smooth', block: 'center' });
        currentTargetImg.style.outline = "4px solid #00ff00"; 
        
        setTimeout(() => {
            if (!isRunning) return;
            currentTargetImg.dataset.igReelWatched = "true";
            currentTargetImg.style.outline = "4px solid #555"; 
            updateStatus("Opening...");
            currentTargetImg.click();
            setTimeout(waitForModal, 1500);
        }, CONFIG.scrollDelay);
    }

    function waitForModal() {
        if (!isRunning) return;
        let attempts = 0;
        const check = setInterval(() => {
            attempts++;
            const dialog = document.querySelector('div[role="dialog"]');
            if (!dialog) { if (attempts * 500 > CONFIG.maxLoadWait) { clearInterval(check); closeModal(); } return; }

            const video = dialog.querySelector('video');
            const closeBtn = document.querySelector('svg[aria-label="Close"]');

            if (video) { clearInterval(check); monitorVideo(video); }
            else if (attempts > 6 && closeBtn) { clearInterval(check); updateStatus("Photo detected."); setTimeout(closeModal, CONFIG.photoDuration * 1000); }
            if (attempts * 500 > CONFIG.maxLoadWait) { clearInterval(check); closeModal(); }
        }, 500);
    }

    function monitorVideo(video) {
        if (!isRunning) return;
        updateStatus("Watching...");
        if (video.paused) video.play().catch(() => {});
        let lastTime = -1;
        const checkInterval = setInterval(() => {
            if (!isRunning || !document.querySelector('div[role="dialog"]')) { clearInterval(checkInterval); if(isRunning) closeModal(); return; }
            const t = video.currentTime, d = video.duration;
            if ((d > 0 && d - t < 0.4) || (lastTime > 1 && t < 0.5)) {
                clearInterval(checkInterval); updateStatus("Finished."); setTimeout(closeModal, CONFIG.watchBuffer * 1000);
            }
            lastTime = t;
        }, 200);
    }

    function closeModal() {
        if(!isRunning) return;
        updateStatus("Closing...");
        
        const closeSvg = document.querySelector('svg[aria-label="Close"]');
        if (closeSvg && closeSvg.closest('div[role="button"]')) closeSvg.closest('div[role="button"]').click();
        else { const esc = new KeyboardEvent('keydown', { key: 'Escape', code: 'Escape', keyCode: 27, bubbles: true }); document.body.dispatchEvent(esc); }

        setTimeout(async () => {
            if (!isRunning) return;
            if (document.querySelector('div[role="dialog"]')) document.body.click(); 

            if (autoReactEnabled && currentTargetImg) {
                updateStatus("Reacting...");
                await performReaction(currentTargetImg);
            }
            if (isRunning) findAndPlayNext();
        }, CONFIG.closeAnimationWait); 
    }

    function performReaction(imgElement) {
        return new Promise((resolve) => {
            
            imgElement.dispatchEvent(new MouseEvent('mouseover', { bubbles: true, view: window }));
            let row = imgElement.closest('div[role="row"]');
            if(row) {
                row.dispatchEvent(new MouseEvent('mouseover', { bubbles: true, view: window }));
                row.dispatchEvent(new MouseEvent('mouseenter', { bubbles: true, view: window }));
            }

            setTimeout(() => {
                const allSvgs = Array.from(document.querySelectorAll('svg'));
                
                const imgRect = imgElement.getBoundingClientRect();
                const nearbySvgs = allSvgs.filter(svg => {
                    const r = svg.getBoundingClientRect();
                    return (Math.abs(r.top - imgRect.top) < 300) && r.width > 0;
                });

                let reactBtn = nearbySvgs.find(svg => {
                    const label = (svg.getAttribute('aria-label') || "").toLowerCase();
                    return label.includes('react') && !label.includes('emoji'); 
                });

                if (!reactBtn) {
                    if(row) {
                        const rowButtons = Array.from(row.querySelectorAll('div[role="button"]'));
                        reactBtn = rowButtons.find(btn => {
                            const svg = btn.querySelector('svg');
                            if(!svg) return false;
                            const label = (svg.getAttribute('aria-label') || "").toLowerCase();
                            if(label.includes('reply') || label.includes('forward') || label.includes('more')) return false;
                            return true; 
                        });
                    }
                }

                if (!reactBtn) {
                     const x = imgRect.right + 25; 
                     const y = imgRect.top + (imgRect.height / 2);
                     const el = document.elementFromPoint(x, y);
                     if(el) {
                         if(el.tagName === 'svg' || el.getAttribute('role') === 'button') reactBtn = el;
                         else reactBtn = el.closest('div[role="button"]');
                     }
                }

                if (reactBtn) {
                    if(reactBtn.tagName === 'svg' && reactBtn.parentElement) reactBtn.parentElement.click();
                    else reactBtn.click();

                    const tryClickLike = () => {
                        const likeSelectors = [
                            'div[role="menuitem"][aria-label*="Like" i]',
                            'div[role="button"][aria-label*="Like" i]',
                            'button[aria-label*="Like" i]',
                            'span[aria-label*="Like" i]',
                            'svg[aria-label*="Like" i]'
                        ];
                        for (const sel of likeSelectors) {
                            const el = document.querySelector(sel);
                            if (!el) continue;
                            const btn = el.closest('div[role="button"],button') || el;
                            btn.click();
                            updateStatus('Reacted: Like');
                            return true;
                        }
                        return false;
                    };

                    const tryClickEmoji = () => {
                        const targetIsHeart = targetEmoji === '❤️';
                        const dialog =
                            document.querySelector('div[role="dialog"]') ||
                            document.querySelector('div[role="menu"]') ||
                            document.querySelector('div[role="listbox"]') ||
                            document.querySelector('div[role="tooltip"]');

                        if (dialog) {
                            const emojiImg =
                                dialog.querySelector(`img[alt="${targetEmoji}"]`) ||
                                dialog.querySelector(`img[aria-label="${targetEmoji}"]`);
                            if (emojiImg) {
                                const btn = emojiImg.closest('div[role="button"],button') || emojiImg;
                                btn.click();
                                updateStatus(`Reacted: ${targetEmoji}`);
                                return true;
                            }

                            const btns = dialog.querySelectorAll('div[role="button"],button');
                            for (const b of btns) {
                                const aria = (b.getAttribute('aria-label') || '').toLowerCase();
                                const txt = (b.textContent || '');
                                const ariaHasHeartAlias = targetIsHeart && aria.includes('heart');
                                if (aria.includes(targetEmoji) || txt.includes(targetEmoji) || ariaHasHeartAlias) {
                                    b.click();
                                    updateStatus(`Reacted: ${targetEmoji}`);
                                    return true;
                                }
                            }
                        }

                        const globalEmojiImg = document.querySelector(`img[alt="${targetEmoji}"]`);
                        if (globalEmojiImg) {
                            const btn = globalEmojiImg.closest('div[role="button"],button') || globalEmojiImg;
                            btn.click();
                            updateStatus(`Reacted: ${targetEmoji}`);
                            return true;
                        }

                        if (targetIsHeart) {
                            const heartAliasEl = dialog
                                ? dialog.querySelector('[aria-label*="Heart" i], [aria-label*="Like" i], [aria-label*="LIKE" i]')
                                : document.querySelector('[aria-label*="Heart" i], [aria-label*="Like" i], [aria-label*="LIKE" i]');
                            if (heartAliasEl) {
                                const btn = heartAliasEl.closest('div[role="button"],button') || heartAliasEl;
                                btn.click();
                                updateStatus('Reacted: ❤️');
                                return true;
                            }
                        }

                        return false;
                    };

                    const start = Date.now();
                    const maxWaitMs = 3500;
                    const pollIntervalMs = 150;

                    const tick = setInterval(() => {
                        if (!isRunning) {
                            clearInterval(tick);
                            resolve();
                            return;
                        }

                        if (targetEmoji === '❤️' && tryClickLike()) {
                            clearInterval(tick);
                            resolve();
                            return;
                        }

                        if (tryClickEmoji()) {
                            clearInterval(tick);
                            resolve();
                            return;
                        }

                        if (Date.now() - start > maxWaitMs) {
                            clearInterval(tick);

                            const tooltips = document.querySelectorAll('div[role="tooltip"] img');
                            if (tooltips.length > 0) {
                                tooltips[0].click();
                                updateStatus('Reacted (Fallback)');
                            } else {
                                updateStatus('Like/emoji not found');
                            }

                            resolve();
                        }
                    }, pollIntervalMs);
                } else {
                    updateStatus("React menu not found");
                    resolve();
                }
            }, 800);
        });
    }
})();
