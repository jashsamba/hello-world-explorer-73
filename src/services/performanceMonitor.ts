import { PerformanceMetrics, KioskId } from '../types/kiosk';
import { errorLogger } from './errorLogger';
import { sessionManager } from './sessionManager';

class PerformanceMonitorService {
  private readonly METRICS_ENDPOINT = '/api/metrics';
  private readonly COLLECTION_INTERVAL = 60000; // 1 minute
  private readonly MAX_STORED_METRICS = 100;
  private readonly LOCAL_STORAGE_KEY = 'performance_metrics';
  
  private metricsCollector: NodeJS.Timeout | null = null;
  private marks: Map<string, number> = new Map();
  private measures: Map<string, number[]> = new Map();

  constructor() {
    // Initialize performance monitoring
    this.setupPerformanceObserver();
    
    // Start collecting metrics if in production
    if (!import.meta.env.DEV) {
      this.startCollecting();
    }
  }

  private setupPerformanceObserver(): void {
    try {
      const observer = new PerformanceObserver((list) => {
        list.getEntries().forEach((entry) => {
          this.measures.set(entry.name, [
            ...(this.measures.get(entry.name) || []),
            entry.duration
          ].slice(-10)); // Keep last 10 measurements
        });
      });

      observer.observe({ entryTypes: ['measure'] });
    } catch (error) {
      errorLogger.logError(error as Error, {
        userAction: 'setup_performance_observer'
      });
    }
  }

  startMeasurement(name: string): void {
    this.marks.set(name, performance.now());
  }

  endMeasurement(name: string): number {
    const startTime = this.marks.get(name);
    if (!startTime) return 0;

    const duration = performance.now() - startTime;
    this.marks.delete(name);

    try {
      performance.measure(name, undefined, undefined);
    } catch (error) {
      errorLogger.logError(error as Error, {
        userAction: 'performance_measure',
        context: { measurementName: name }
      });
    }

    return duration;
  }

  private async collectMetrics(kioskId: KioskId): Promise<PerformanceMetrics> {
    const session = sessionManager.getCurrentSession();
    const memory = (performance as any).memory || {};
    const navigation = performance.getEntriesByType('navigation')[0] as PerformanceNavigationTiming;

    // Calculate average render time from collected measures
    const renderTimes = this.measures.get('render') || [];
    const avgRenderTime = renderTimes.length > 0
      ? renderTimes.reduce((a, b) => a + b, 0) / renderTimes.length
      : 0;

    return {
      timestamp: new Date().toISOString(),
      kioskId,
      metrics: {
        loadTime: navigation ? navigation.loadEventEnd - navigation.navigationStart : 0,
        renderTime: avgRenderTime,
        interactionTime: session ? session.getLastActivityTime() : 0,
        memoryUsage: memory.usedJSHeapSize || 0,
        errorCount: (await errorLogger.getErrorStats()).totalErrors
      },
      sessionId: session?.id
    };
  }

  private storeMetrics(metrics: PerformanceMetrics): void {
    try {
      const stored = JSON.parse(localStorage.getItem(this.LOCAL_STORAGE_KEY) || '[]');
      stored.push(metrics);
      
      // Keep only the latest metrics
      const trimmed = stored.slice(-this.MAX_STORED_METRICS);
      localStorage.setItem(this.LOCAL_STORAGE_KEY, JSON.stringify(trimmed));
    } catch (error) {
      errorLogger.logError(error as Error, {
        userAction: 'store_metrics'
      });
    }
  }

  private async sendMetrics(metrics: PerformanceMetrics): Promise<void> {
    try {
      const response = await fetch(this.METRICS_ENDPOINT, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json'
        },
        body: JSON.stringify(metrics)
      });

      if (!response.ok) {
        throw new Error(`Failed to send metrics: ${response.statusText}`);
      }
    } catch (error) {
      // Store metrics locally if sending fails
      this.storeMetrics(metrics);
      await errorLogger.logError(error as Error, {
        userAction: 'send_metrics',
        kioskId: metrics.kioskId
      });
    }
  }

  startCollecting(): void {
    if (this.metricsCollector) return;

    this.metricsCollector = setInterval(async () => {
      const session = sessionManager.getCurrentSession();
      if (!session) return;

      try {
        const metrics = await this.collectMetrics(session.kioskId);
        await this.sendMetrics(metrics);
      } catch (error) {
        await errorLogger.logError(error as Error, {
          userAction: 'collect_metrics',
          kioskId: session.kioskId
        });
      }
    }, this.COLLECTION_INTERVAL);
  }

  stopCollecting(): void {
    if (this.metricsCollector) {
      clearInterval(this.metricsCollector);
      this.metricsCollector = null;
    }
  }

  getStoredMetrics(): PerformanceMetrics[] {
    try {
      return JSON.parse(localStorage.getItem(this.LOCAL_STORAGE_KEY) || '[]');
    } catch {
      return [];
    }
  }

  async syncStoredMetrics(): Promise<void> {
    const metrics = this.getStoredMetrics();
    if (metrics.length === 0) return;

    const failedMetrics: PerformanceMetrics[] = [];

    for (const metric of metrics) {
      try {
        await this.sendMetrics(metric);
      } catch {
        failedMetrics.push(metric);
      }
    }

    // Update storage with only failed metrics
    localStorage.setItem(this.LOCAL_STORAGE_KEY, JSON.stringify(failedMetrics));
  }

  getAverageMetrics(timeframe: number = 3600000): {
    avgLoadTime: number;
    avgRenderTime: number;
    avgMemoryUsage: number;
    totalErrors: number;
  } {
    const metrics = this.getStoredMetrics()
      .filter(m => Date.now() - new Date(m.timestamp).getTime() < timeframe);

    if (metrics.length === 0) {
      return {
        avgLoadTime: 0,
        avgRenderTime: 0,
        avgMemoryUsage: 0,
        totalErrors: 0
      };
    }

    return {
      avgLoadTime: metrics.reduce((sum, m) => sum + m.metrics.loadTime, 0) / metrics.length,
      avgRenderTime: metrics.reduce((sum, m) => sum + m.metrics.renderTime, 0) / metrics.length,
      avgMemoryUsage: metrics.reduce((sum, m) => sum + m.metrics.memoryUsage, 0) / metrics.length,
      totalErrors: metrics.reduce((sum, m) => sum + m.metrics.errorCount, 0)
    };
  }
}

// Export a singleton instance
export const performanceMonitor = new PerformanceMonitorService();