import { TransactionState, KioskId, ErrorLog } from '../types/kiosk';
import { kioskPayment } from './kioskPayment';
import { errorLogger } from './errorLogger';
import { kioskMonitor } from './kioskMonitor';

class TransactionRecoveryService {
  private readonly MAX_RETRIES = 3;
  private readonly RETRY_DELAY = 5000; // 5 seconds
  private readonly LOCAL_STORAGE_KEY = 'pending_transactions';
  private recoveryInProgress: boolean = false;

  constructor() {
    // Attempt to recover any pending transactions on startup
    this.recoverPendingTransactions();
  }

  private async delay(ms: number): Promise<void> {
    return new Promise(resolve => setTimeout(resolve, ms));
  }

  private getPendingTransactions(): TransactionState[] {
    try {
      return JSON.parse(localStorage.getItem(this.LOCAL_STORAGE_KEY) || '[]');
    } catch (error) {
      errorLogger.logError(error as Error, {
        userAction: 'get_pending_transactions'
      });
      return [];
    }
  }

  private savePendingTransactions(transactions: TransactionState[]): void {
    try {
      localStorage.setItem(this.LOCAL_STORAGE_KEY, JSON.stringify(transactions));
    } catch (error) {
      errorLogger.logError(error as Error, {
        userAction: 'save_pending_transactions'
      });
    }
  }

  private async switchKiosk(currentKioskId: KioskId): Promise<KioskId | null> {
    const newKioskId = currentKioskId === 'KIOSK1' ? 'KIOSK2' : 'KIOSK1';
    const isAvailable = await kioskMonitor.checkKioskAvailability(newKioskId);
    return isAvailable ? newKioskId : null;
  }

  async trackTransaction(
    transactionId: string,
    kioskId: KioskId,
    amount: number
  ): Promise<void> {
    const transaction: TransactionState = {
      status: 'pending',
      transactionId,
      kioskId,
      amount,
      timestamp: new Date().toISOString(),
      retryCount: 0
    };

    const pendingTransactions = this.getPendingTransactions();
    pendingTransactions.push(transaction);
    this.savePendingTransactions(pendingTransactions);
  }

  private async attemptRecovery(
    transaction: TransactionState,
    alternateKioskId?: KioskId
  ): Promise<boolean> {
    try {
      const targetKioskId = alternateKioskId || transaction.kioskId;
      const result = await kioskPayment.recoverTransaction(
        transaction.transactionId,
        targetKioskId
      );

      if (result.success) {
        // Update transaction status
        const pendingTransactions = this.getPendingTransactions()
          .filter(t => t.transactionId !== transaction.transactionId);
        this.savePendingTransactions(pendingTransactions);
        return true;
      }

      // Log the failed attempt
      const errorLog: ErrorLog = {
        timestamp: new Date().toISOString(),
        kioskId: targetKioskId,
        errorType: 'RecoveryFailed',
        errorMessage: result.error || 'Unknown error',
        transactionId: transaction.transactionId
      };

      if (!transaction.recoveryAttempts) {
        transaction.recoveryAttempts = [];
      }
      transaction.recoveryAttempts.push(errorLog);
      
      return false;
    } catch (error) {
      await errorLogger.logError(error as Error, {
        kioskId: alternateKioskId || transaction.kioskId,
        transactionId: transaction.transactionId,
        userAction: 'recover_transaction'
      });
      return false;
    }
  }

  async recoverTransaction(transaction: TransactionState): Promise<boolean> {
    if (transaction.retryCount >= this.MAX_RETRIES) {
      await errorLogger.logError(
        new Error('Max retry attempts reached'),
        {
          kioskId: transaction.kioskId,
          transactionId: transaction.transactionId,
          userAction: 'max_retries_reached'
        }
      );
      return false;
    }

    // Try with the original kiosk first
    let success = await this.attemptRecovery(transaction);

    // If failed, try with the alternate kiosk
    if (!success) {
      const alternateKioskId = await this.switchKiosk(transaction.kioskId);
      if (alternateKioskId) {
        await this.delay(this.RETRY_DELAY);
        success = await this.attemptRecovery(transaction, alternateKioskId);
      }
    }

    // Update retry count
    if (!success) {
      transaction.retryCount++;
      transaction.lastRetryTimestamp = new Date().toISOString();
      
      const pendingTransactions = this.getPendingTransactions()
        .map(t => t.transactionId === transaction.transactionId ? transaction : t);
      this.savePendingTransactions(pendingTransactions);
    }

    return success;
  }

  async recoverPendingTransactions(): Promise<void> {
    if (this.recoveryInProgress) return;

    try {
      this.recoveryInProgress = true;
      const pendingTransactions = this.getPendingTransactions();

      for (const transaction of pendingTransactions) {
        if (transaction.status === 'pending') {
          await this.recoverTransaction(transaction);
          // Add delay between attempts
          await this.delay(this.RETRY_DELAY);
        }
      }
    } catch (error) {
      await errorLogger.logError(error as Error, {
        userAction: 'recover_pending_transactions'
      });
    } finally {
      this.recoveryInProgress = false;
    }
  }

  async cleanupOldTransactions(maxAge: number = 24 * 60 * 60 * 1000): Promise<void> {
    try {
      const now = Date.now();
      const pendingTransactions = this.getPendingTransactions()
        .filter(transaction => {
          const transactionTime = new Date(transaction.timestamp).getTime();
          return (now - transactionTime) < maxAge;
        });

      this.savePendingTransactions(pendingTransactions);
    } catch (error) {
      await errorLogger.logError(error as Error, {
        userAction: 'cleanup_old_transactions'
      });
    }
  }

  getPendingTransactionCount(): number {
    return this.getPendingTransactions().length;
  }

  getFailedTransactions(): TransactionState[] {
    return this.getPendingTransactions()
      .filter(t => t.retryCount >= this.MAX_RETRIES);
  }
}

// Export a singleton instance
export const transactionRecovery = new TransactionRecoveryService();