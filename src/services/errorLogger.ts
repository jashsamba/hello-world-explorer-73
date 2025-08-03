import { ErrorLog, KioskId } from '../types/kiosk';

class ErrorLoggerService {
  private readonly LOCAL_STORAGE_KEY = 'kiosk_error_logs';
  private readonly MAX_LOCAL_LOGS = 100;
  private readonly API_ENDPOINT = '/api/logs/error';

  constructor() {
    // Initialize error handling
    window.onerror = (message, source, lineno, colno, error) => {
      this.logError(error || new Error(message as string), {
        source: source as string,
        line: lineno,
        column: colno
      });
    };

    // Handle unhandled promise rejections
    window.onunhandledrejection = (event) => {
      this.logError(event.reason, { type: 'unhandled_promise_rejection' });
    };
  }

  private async sendToServer(errorLog: ErrorLog): Promise<void> {
    try {
      const response = await fetch(this.API_ENDPOINT, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json'
        },
        body: JSON.stringify(errorLog)
      });

      if (!response.ok) {
        // If server logging fails, store in local storage as backup
        this.storeLocally(errorLog);
        console.warn('Error logging to server failed, stored locally');
      }
    } catch (error) {
      // If network error occurs, store in local storage as backup
      this.storeLocally(errorLog);
      console.warn('Network error while logging, stored locally:', error);
    }
  }

  private storeLocally(errorLog: ErrorLog): void {
    try {
      const logs = JSON.parse(localStorage.getItem(this.LOCAL_STORAGE_KEY) || '[]');
      logs.push(errorLog);
      
      // Keep only the latest logs
      const trimmedLogs = logs.slice(-this.MAX_LOCAL_LOGS);
      localStorage.setItem(this.LOCAL_STORAGE_KEY, JSON.stringify(trimmedLogs));
    } catch (error) {
      console.error('Failed to store error log locally:', error);
    }
  }

  private getLocalLogs(): ErrorLog[] {
    try {
      return JSON.parse(localStorage.getItem(this.LOCAL_STORAGE_KEY) || '[]');
    } catch {
      return [];
    }
  }

  async syncLocalLogs(): Promise<void> {
    const logs = this.getLocalLogs();
    if (logs.length === 0) return;

    const failedLogs: ErrorLog[] = [];

    for (const log of logs) {
      try {
        await this.sendToServer(log);
      } catch {
        failedLogs.push(log);
      }
    }

    // Update local storage with only the failed logs
    localStorage.setItem(this.LOCAL_STORAGE_KEY, JSON.stringify(failedLogs));
  }

  async logError(
    error: Error,
    context?: {
      kioskId?: KioskId;
      transactionId?: string;
      userAction?: string;
      [key: string]: unknown;
    }
  ): Promise<void> {
    const errorLog: ErrorLog = {
      timestamp: new Date().toISOString(),
      kioskId: context?.kioskId || 'KIOSK1', // Default to KIOSK1 if not specified
      errorType: error.name,
      errorMessage: error.message,
      stackTrace: error.stack,
      transactionId: context?.transactionId,
      userAction: context?.userAction,
      context: context
    };

    // Attempt to send to server first
    await this.sendToServer(errorLog);

    // Log to console in development
    if (import.meta.env.DEV) {
      console.error('Error logged:', errorLog);
    }
  }

  // Helper method to get error statistics
  getErrorStats(): {
    totalErrors: number;
    uniqueErrors: number;
    errorsByType: Record<string, number>;
  } {
    const logs = this.getLocalLogs();
    const errorsByType: Record<string, number> = {};

    logs.forEach(log => {
      errorsByType[log.errorType] = (errorsByType[log.errorType] || 0) + 1;
    });

    return {
      totalErrors: logs.length,
      uniqueErrors: Object.keys(errorsByType).length,
      errorsByType
    };
  }

  // Clear all local logs
  clearLocalLogs(): void {
    localStorage.removeItem(this.LOCAL_STORAGE_KEY);
  }
}

// Export a singleton instance
export const errorLogger = new ErrorLoggerService();