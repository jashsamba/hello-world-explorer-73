import { KioskConfig, PaymentRequest, PaymentResponse, PaymentStatus, KioskId, TransactionLog } from '../types/kiosk';
import { errorLogger } from './errorLogger';
import { sessionManager } from './sessionManager';

class KioskPaymentService {
  private readonly MAX_PAYMENT_ATTEMPTS = 3;
  private readonly LOCKOUT_DURATION = 300000; // 5 minutes
  private readonly REQUEST_TIMEOUT = 30000; // 30 seconds
  private readonly API_RETRY_DELAY = 1000; // 1 second

  private kiosk1Config: KioskConfig;
  private baseUrl: string;
  private testMode: boolean;

  // Rate limiting and security
  private attemptCounts: Map<string, number> = new Map();
  private lockoutTimes: Map<string, number> = new Map();
  private activeTransactions: Set<string> = new Set();

  constructor() {
    this.kiosk1Config = {
      clientName: import.meta.env.VITE_KIOSK1_CLIENT_NAME,
      venueName: import.meta.env.VITE_KIOSK1_VENUE_NAME,
      clientId: import.meta.env.VITE_KIOSK1_CLIENT_ID,
      secret: import.meta.env.VITE_KIOSK1_SECRET
    };

    this.baseUrl = import.meta.env.VITE_KIOSK_API_URL || 'https://api.kioskpayment.com/v1';
    this.testMode = import.meta.env.VITE_KIOSK_TEST_MODE === 'true';

    // Clean up old rate limiting data periodically
    setInterval(() => this.cleanupRateLimitingData(), this.LOCKOUT_DURATION);
  }

  private getConfigForKiosk(kioskId: KioskId): KioskConfig {
    // Single-kiosk mode: always use Kiosk 1 configuration
    return this.kiosk1Config;
  }

  private async getAuthHeaders(kioskId: KioskId): Promise<Headers> {
    const config = this.getConfigForKiosk(kioskId);
    const headers = new Headers();
    headers.append('Content-Type', 'application/json');
    headers.append('X-Client-ID', config.clientId);
    headers.append('X-Client-Secret', config.secret);
    headers.append('X-Request-ID', crypto.randomUUID());
    return headers;
  }

  private checkRateLimit(kioskId: string): boolean {
    const now = Date.now();
    const lockoutTime = this.lockoutTimes.get(kioskId) || 0;
    
    if (now < lockoutTime) {
      throw new Error(`Kiosk temporarily locked for security (${Math.ceil((lockoutTime - now) / 1000)}s remaining)`);
    }

    const attempts = this.attemptCounts.get(kioskId) || 0;
    if (attempts >= this.MAX_PAYMENT_ATTEMPTS) {
      this.lockoutTimes.set(kioskId, now + this.LOCKOUT_DURATION);
      throw new Error('Too many payment attempts. Please wait before trying again.');
    }

    return true;
  }

  private incrementAttemptCount(kioskId: string): void {
    const attempts = this.attemptCounts.get(kioskId) || 0;
    this.attemptCounts.set(kioskId, attempts + 1);
  }

  private cleanupRateLimitingData(): void {
    const now = Date.now();
    
    // Clear expired lockouts
    for (const [kioskId, lockoutTime] of this.lockoutTimes.entries()) {
      if (now >= lockoutTime) {
        this.lockoutTimes.delete(kioskId);
        this.attemptCounts.delete(kioskId);
      }
    }

    // Clear old attempt counts
    for (const [kioskId, attempts] of this.attemptCounts.entries()) {
      if (!this.lockoutTimes.has(kioskId)) {
        this.attemptCounts.delete(kioskId);
      }
    }
  }

  private validatePaymentRequest(request: PaymentRequest): void {
    if (!request.amount || request.amount <= 0) {
      throw new Error('Invalid payment amount');
    }

    if (!request.items || request.items.length === 0) {
      throw new Error('No items in payment request');
    }

    if (!request.currency) {
      throw new Error('Currency not specified');
    }

    const totalAmount = request.items.reduce(
      (sum, item) => sum + (item.price * item.quantity),
      0
    );

    if (Math.abs(totalAmount - request.amount) > 0.01) {
      throw new Error('Item total does not match payment amount');
    }
  }

  private async withRetry<T>(
    operation: () => Promise<T>,
    retries = 3,
    delay = this.API_RETRY_DELAY
  ): Promise<T> {
    try {
      return await Promise.race([
        operation(),
        new Promise<never>((_, reject) => 
          setTimeout(() => reject(new Error('Request timeout')), this.REQUEST_TIMEOUT)
        )
      ]);
    } catch (error) {
      if (retries > 0) {
        await new Promise(resolve => setTimeout(resolve, delay));
        return this.withRetry(operation, retries - 1, delay * 2);
      }
      throw error;
    }
  }

  private async logTransaction(
    action: string,
    details: Omit<TransactionLog, 'timestamp' | 'action'>
  ): Promise<void> {
    try {
      await fetch('/api/logs', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          timestamp: new Date().toISOString(),
          action,
          ...details
        })
      });
    } catch (error) {
      await errorLogger.logError(error as Error, {
        userAction: 'log_transaction',
        ...details
      });
    }
  }

  async checkKioskHealth(kioskId: KioskId): Promise<boolean> {
    if (this.testMode) return true;

    try {
      const headers = await this.getAuthHeaders(kioskId);
      const response = await this.withRetry(async () => {
        const res = await fetch(`${this.baseUrl}/health`, { headers });
        if (!res.ok) throw new Error('Health check failed');
        return res;
      });
      return response.ok;
    } catch (error) {
      await errorLogger.logError(error as Error, {
        kioskId,
        userAction: 'health_check'
      });
      return false;
    }
  }

  private simulatePayment(request: PaymentRequest): Promise<PaymentResponse> {
    return new Promise((resolve) => {
      setTimeout(() => {
        resolve({
          success: true,
          transactionId: `test-${Date.now()}`,
          kioskId: request.kioskId,
          details: { simulated: true }
        });
      }, 3000);
    });
  }

  async initiatePayment(request: PaymentRequest): Promise<PaymentResponse> {
    const session = sessionManager.getCurrentSession();
    if (!session) {
      throw new Error('No active session');
    }

    if (this.testMode) {
      return this.simulatePayment(request);
    }

    try {
      // Force single-kiosk mode
      request.kioskId = 'KIOSK1';
      // Validate request
      this.validatePaymentRequest(request);

      // Check rate limiting
      this.checkRateLimit(request.kioskId);
      this.incrementAttemptCount(request.kioskId);

      // Prevent duplicate transactions
      const transactionKey = `${request.kioskId}-${request.amount}-${Date.now()}`;
      if (this.activeTransactions.has(transactionKey)) {
        throw new Error('Duplicate transaction detected');
      }
      this.activeTransactions.add(transactionKey);

      const headers = await this.getAuthHeaders(request.kioskId);
      const config = this.getConfigForKiosk(request.kioskId);
      
      await this.logTransaction('payment_initiated', {
        kioskId: request.kioskId,
        details: { 
          amount: request.amount,
          items: request.items,
          sessionId: session.id
        }
      });

      const response = await this.withRetry(async () => {
        const res = await fetch(`${this.baseUrl}/payments/initiate`, {
          method: 'POST',
          headers,
          body: JSON.stringify({
            ...request,
            clientName: config.clientName,
            venueName: config.venueName,
            sessionId: session.id
          })
        });

        if (!res.ok) throw new Error(`Payment initiation failed: ${res.statusText}`);
        return res;
      });

      const data = await response.json();
      return this.pollPaymentStatus(data.transactionId, request.kioskId);
    } catch (error) {
      await this.logTransaction('payment_failed', {
        kioskId: request.kioskId,
        details: { 
          error: error instanceof Error ? error.message : 'Unknown error',
          sessionId: session.id
        }
      });

      return {
        success: false,
        error: error instanceof Error ? error.message : 'Payment failed',
        details: error,
        kioskId: request.kioskId
      };
    } finally {
      // Clean up transaction tracking
      const transactionKey = `${request.kioskId}-${request.amount}-${Date.now()}`;
      this.activeTransactions.delete(transactionKey);
    }
  }

  async pollPaymentStatus(transactionId: string, kioskId: KioskId): Promise<PaymentResponse> {
    const maxAttempts = 60; // 30 seconds (500ms intervals)
    let attempts = 0;

    return new Promise((resolve, reject) => {
      const checkStatus = async () => {
        try {
          const headers = await this.getAuthHeaders(kioskId);
          const response = await fetch(`${this.baseUrl}/payments/${transactionId}/status`, {
            headers
          });

          if (!response.ok) {
            throw new Error(`Status check failed: ${response.statusText}`);
          }

          const status = await response.json();

          if (status.status === 'completed') {
            await this.logTransaction('payment_completed', {
              kioskId,
              transactionId,
              details: status
            });

            resolve({
              success: true,
              transactionId,
              details: status,
              kioskId
            });
            return;
          }

          if (status.status === 'failed') {
            await this.logTransaction('payment_failed', {
              kioskId,
              transactionId,
              details: status
            });

            resolve({
              success: false,
              transactionId,
              error: status.error,
              details: status,
              kioskId
            });
            return;
          }

          attempts++;
          if (attempts >= maxAttempts) {
            await this.logTransaction('payment_timeout', {
              kioskId,
              transactionId,
              details: { attempts }
            });

            resolve({
              success: false,
              transactionId,
              error: 'Payment timeout',
              details: { status: 'timeout' },
              kioskId
            });
            return;
          }

          setTimeout(checkStatus, 500);
        } catch (error) {
          reject(error);
        }
      };

      checkStatus();
    });
  }

  async cancelPayment(transactionId: string, kioskId: KioskId): Promise<boolean> {
    if (this.testMode) {
      return true;
    }

    try {
      const headers = await this.getAuthHeaders(kioskId);
      const response = await this.withRetry(async () => {
        const res = await fetch(`${this.baseUrl}/payments/${transactionId}/cancel`, {
          method: 'POST',
          headers
        });
        if (!res.ok) throw new Error('Cancel payment failed');
        return res;
      });

      await this.logTransaction('payment_cancelled', {
        kioskId,
        transactionId,
        details: { success: response.ok }
      });

      return response.ok;
    } catch (error) {
      await errorLogger.logError(error as Error, {
        kioskId,
        transactionId,
        userAction: 'cancel_payment'
      });
      return false;
    }
  }

  async recoverTransaction(transactionId: string, kioskId: KioskId): Promise<PaymentResponse> {
    if (this.testMode) {
      return {
        success: true,
        transactionId,
        kioskId,
        details: { recovered: true }
      };
    }

    try {
      const headers = await this.getAuthHeaders(kioskId);
      const response = await this.withRetry(async () => {
        const res = await fetch(`${this.baseUrl}/payments/${transactionId}/recover`, {
          method: 'POST',
          headers
        });
        if (!res.ok) throw new Error('Transaction recovery failed');
        return res;
      });

      const result = await response.json();

      await this.logTransaction('transaction_recovered', {
        kioskId,
        transactionId,
        details: result
      });

      return {
        success: true,
        transactionId,
        details: result,
        kioskId
      };
    } catch (error) {
      await this.logTransaction('recovery_failed', {
        kioskId,
        transactionId,
        details: { error: error instanceof Error ? error.message : 'Unknown error' }
      });

      return {
        success: false,
        error: 'Recovery failed',
        kioskId,
        transactionId
      };
    }
  }

  // Get current rate limiting status
  getRateLimitStatus(kioskId: KioskId): {
    attempts: number;
    locked: boolean;
    remainingLockTime: number;
  } {
    const now = Date.now();
    const lockoutTime = this.lockoutTimes.get(kioskId) || 0;
    const attempts = this.attemptCounts.get(kioskId) || 0;

    return {
      attempts,
      locked: now < lockoutTime,
      remainingLockTime: Math.max(0, lockoutTime - now)
    };
  }
}

// Export a singleton instance
export const kioskPayment = new KioskPaymentService();