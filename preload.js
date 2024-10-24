const { contextBridge, ipcRenderer } = require('electron');

contextBridge.exposeInMainWorld('api', {
    startAutomation: (targetUrls, comments, accountIndex, captchaEnabled, appVersion, proxies) => {
        ipcRenderer.send('start-automation', {
            targetLinks: targetUrls,
            comments: comments,
            accountIndex: parseInt(accountIndex),
            captchaEnabled: captchaEnabled,
            appVersion: appVersion,
            proxies: proxies
        });
    },
    stopAutomation: () => {
        ipcRenderer.send('stop-automation');  // Send stop signal to main process
    }
});
