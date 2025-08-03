import { KioskHealth, KioskId, ErrorLog } from '../types/kiosk';
import { kioskPayment } from './kioskPayment';
import { errorLogger } from './errorLogger';

class KioskMonitorService {
  private readonly HEARTBEAT_INTERVAL = 30000; // 30 seconds
  private readonly API_ENDPOINT = '/api/monitor';
  private healthStatus: Map<KioskId, KioskHealth> = new Map();
  private intervalIds: Map<KioskId, NodeJS.Timeout> = new Map();

  constructor() {
    // Initialize monitoring on load if in production
    if (!import.meta.env.DEV) {
      this.startMonitoring('KIOSK1');
      this.startMonitoring('KIOSK2');
    }
  }

  private async collectMetrics(kioskId: KioskId): Promise<KioskHealth['systemMetrics']> {
    try {
      // Collect basic browser metrics
      const memory = (performance as any).memory || {};
      const navigation = performance.getEntriesByType('navigation')[0] as PerformanceNavigationTiming;
      const network = navigator.connection as any;

      return {
        cpuUsage: 0, // Not available in browser
        memoryUsage: memory.usedJSHeapSize / memory.jsHeapSizeLimit || 0,
        diskSpace: 1, // Not available in browser
        networkLatency: navigation.responseStart - navigation.requestStart
      };
    } catch (error) {
      await errorLogger.logError(error as Error, {
        kioskId,
        userAction: 'collect_metrics'
      });

      return {
        cpuUsage: 0,
        memoryUsage: 0,
        diskSpace: 0,
        networkLatency: 0
      };
    }
  }

  private async sendHeartbeat(kioskId: KioskId, metrics: KioskHealth['systemMetrics']): Promise<void> {
    try {
      const health: KioskHealth = {
        kioskId,
        status: 'online',
        lastHeartbeat: new Date().toISOString(),
        systemMetrics: metrics
      };

      const response = await fetch(this.API_ENDPOINT, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json'
        },
        body: JSON.stringify(health)
      });

      if (!response.ok) {
        throw new Error(`Heartbeat failed: ${response.statusText}`);
      }

      this.healthStatus.set(kioskId, health);
    } catch (error) {
      await errorLogger.logError(error as Error, {
        kioskId,
        userAction: 'send_heartbeat'
      });

      this.healthStatus.set(kioskId, {
        kioskId,
        status: 'offline',
        lastHeartbeat: new Date().toISOString(),
        systemMetrics: await this.collectMetrics(kioskId),
        errors: [{
          timestamp: new Date().toISOString(),
          kioskId,
          errorType: 'HeartbeatError',
          errorMessage: error instanceof Error ? error.message : 'Unknown error',
        }]
      });
    }
  }

  async startMonitoring(kioskId: KioskId): Promise<void> {
    // Stop existing monitoring if any
    this.stopMonitoring(kioskId);

    // Initial health check
    const isHealthy = await kioskPayment.checkKioskHealth(kioskId);
    if (!isHealthy) {
      await errorLogger.logError(new Error('Kiosk health check failed'), {
        kioskId,
        userAction: 'start_monitoring'
      });
    }

    // Start heartbeat interval
    const intervalId = setInterval(async () => {
      const metrics = await this.collectMetrics(kioskId);
      await this.sendHeartbeat(kioskId, metrics);
    }, this.HEARTBEAT_INTERVAL);

    this.intervalIds.set(kioskId, intervalId);
  }

  stopMonitoring(kioskId: KioskId): void {
    const intervalId = this.intervalIds.get(kioskId);
    if (intervalId) {
      clearInterval(intervalId);
      this.intervalIds.delete(kioskId);
    }
  }

  getKioskHealth(kioskId: KioskId): KioskHealth | undefined {
    return this.healthStatus.get(kioskId);
  }

  getAllKioskHealth(): Map<KioskId, KioskHealth> {
    return new Map(this.healthStatus);
  }

  async checkKioskAvailability(kioskId: KioskId): Promise<boolean> {
    const health = this.healthStatus.get(kioskId);
    if (!health) return false;

    // Consider a kiosk offline if last heartbeat is more than 2 intervals ago
    const lastHeartbeat = new Date(health.lastHeartbeat).getTime();
    const now = Date.now();
    const isRecentHeartbeat = (now - lastHeartbeat) < (this.HEARTBEAT_INTERVAL * 2);

    return health.status === 'online' && isRecentHeartbeat;
  }

  async forceHealthCheck(kioskId: KioskId): Promise<boolean> {
    try {
      const metrics = await this.collectMetrics(kioskId);
      await this.sendHeartbeat(kioskId, metrics);
      return true;
    } catch (error) {
      await errorLogger.logError(error as Error, {
        kioskId,
        userAction: 'force_health_check'
      });
      return false;
    }
  }
}

// Export a singleton instance
export const kioskMonitor = new KioskMonitorService();