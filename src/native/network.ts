import { Network, ConnectionStatus } from '@capacitor/network';

export type NetworkListener = (status: ConnectionStatus) => void;

class NativeNetworkManager {
  private currentStatus: ConnectionStatus = { connected: true, connectionType: 'wifi' };
  private listeners: Set<NetworkListener> = new Set();
  private initialized = false;

  public async init() {
    if (this.initialized || typeof window === 'undefined') return;
    this.initialized = true;

    try {
      this.currentStatus = await Network.getStatus();
      Network.addListener('networkStatusChange', (status) => {
        this.currentStatus = status;
        this.listeners.forEach((l) => l(status));
      });
    } catch {
      // Browser fallback
      if (typeof navigator !== 'undefined') {
        this.currentStatus = { connected: navigator.onLine, connectionType: 'unknown' };
        window.addEventListener('online', () => {
          this.currentStatus = { connected: true, connectionType: 'unknown' };
          this.listeners.forEach((l) => l(this.currentStatus));
        });
        window.addEventListener('offline', () => {
          this.currentStatus = { connected: false, connectionType: 'none' };
          this.listeners.forEach((l) => l(this.currentStatus));
        });
      }
    }
  }

  public getStatus(): ConnectionStatus {
    return this.currentStatus;
  }

  public subscribe(listener: NetworkListener): () => void {
    this.listeners.add(listener);
    listener(this.currentStatus);
    return () => this.listeners.delete(listener);
  }
}

export const nativeNetwork = new NativeNetworkManager();
export const getNetworkStatus = async () => nativeNetwork.getStatus();

