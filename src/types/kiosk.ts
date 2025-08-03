export type KioskId = 'KIOSK1' | 'KIOSK2';

export interface KioskConfig {
  clientName: string;
  venueName: string;
  clientId: string;
  secret: string;
}

export interface PaymentRequest {
  amount: number;
  currency: string;
  orderId: string;
  kioskId: KioskId;
  items: Array<{
    name: string;
    quantity: number;
    price: number;
  }>;
  sessionId?: string;
}

export interface PaymentResponse {
  success: boolean;
  transactionId?: string;
  error?: string;
  details?: any;
  kioskId: KioskId;
}

export interface PaymentStatus {
  status: 'pending' | 'processing' | 'completed' | 'failed';
  message?: string;
  error?: string;
  transactionId?: string;
  kioskId: KioskId;
}

export interface TransactionLog {
  timestamp: string;
  action: string;
  kioskId: KioskId;
  transactionId?: string;
  details: any;
}

export interface ErrorLog {
  timestamp: string;
  kioskId: KioskId;
  errorType: string;
  errorMessage: string;
  transactionId?: string;
  userAction?: string;
  stackTrace?: string;
  context?: Record<string, unknown>;
}

export interface KioskHealth {
  kioskId: KioskId;
  status: 'online' | 'offline' | 'maintenance';
  lastHeartbeat: string;
  systemMetrics: {
    cpuUsage: number;
    memoryUsage: number;
    diskSpace: number;
    networkLatency: number;
  };
  errors?: ErrorLog[];
}

export interface TransactionState extends PaymentStatus {
  amount: number;
  timestamp: string;
  retryCount: number;
  lastRetryTimestamp?: string;
  recoveryAttempts?: ErrorLog[];
}

export interface PerformanceMetrics {
  timestamp: string;
  kioskId: KioskId;
  metrics: {
    loadTime: number;
    renderTime: number;
    interactionTime: number;
    memoryUsage: number;
    errorCount: number;
  };
  sessionId?: string;
}

export interface SessionState {
  id: string;
  kioskId: KioskId;
  startTime: string;
  lastActivityTime: string;
  currentScreen: string;
  transactionId?: string;
  userInteractions: number;
  timeoutWarningShown: boolean;
}