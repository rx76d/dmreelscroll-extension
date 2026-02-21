document.addEventListener('DOMContentLoaded', function() {
    const toggle = document.getElementById('masterToggle');
    chrome.storage.local.get(['igExtensionEnabled'], function(result) {
        
        if (result.igExtensionEnabled === undefined) {
            toggle.checked = true;
        } else {
            toggle.checked = result.igExtensionEnabled;
        }
    });

    toggle.addEventListener('change', function() {
        const isEnabled = toggle.checked;
        chrome.storage.local.set({ igExtensionEnabled: isEnabled });
        chrome.tabs.query({active: true, currentWindow: true}, function(tabs) {
            if (tabs[0]) {
                chrome.tabs.sendMessage(tabs[0].id, {
                    action: "toggleState",
                    enabled: isEnabled
                });
            }
        });
    });
});