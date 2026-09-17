import { contextBridge, ipcRenderer } from 'electron';

contextBridge.exposeInMainWorld('electronAPI', {
  steamRequest: (url: string) => ipcRenderer.invoke('steam:request', url),
  openExternal: (url: string) => ipcRenderer.invoke('shell:openExternal', url),
  minimizeWindow: () => ipcRenderer.invoke('window:minimize'),
  maximizeWindow: () => ipcRenderer.invoke('window:maximize'),
  closeWindow: () => ipcRenderer.invoke('window:close'),
});
