const { contextBridge, ipcRenderer } = require('electron')

contextBridge.exposeInMainWorld('osSwitcher', {
  isDesktop: true,
  run: (osId) => ipcRenderer.invoke('os-switch:run', osId),
  openConfigFolder: () => ipcRenderer.invoke('os-switch:open-folder'),
  getConfigPath: () => ipcRenderer.invoke('os-switch:config-path'),
})

contextBridge.exposeInMainWorld('authDesktop', {
  getContext: () => ipcRenderer.invoke('auth:get-context'),
  verify: (username, password) =>
    ipcRenderer.invoke('auth:verify', { username, password }),
})
