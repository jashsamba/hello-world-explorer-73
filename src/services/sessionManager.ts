import { SessionState, KioskId } from '../types/kiosk';
import { errorLogger } from './errorLogger';

class SessionManagerService {
  private readonly TIMEOUT_DURATION = 180000; // 3 minutes
  private readonly WARNING_THRESHOLD = 30000; // 30 seconds before timeout
  private readonly LOCAL_STORAGE_KEY = 'kiosk_session';
  
  private timeoutId: NodeJS.Timeout | null = null;
  private warningTimeoutId: NodeJS.Timeout | null = null;
  private currentSession: SessionState | null = null;
  private onTimeout: (() => void) | null = null;
  private onWarning: (() => void) | null = null;

  constructor() {
    // Bind event listeners
    this.handleUserActivity = this.handleUserActivity.bind(this);
    this.resetTimeout = this.resetTimeout.bind(this);
  }

  private generateSessionId(): string {
    return `session-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`;
  }

  private saveSession(): void {
    if (this.currentSession) {
      try {
        localStorage.setItem(this.LOCAL_STORAGE_KEY, JSON.stringify(this.currentSession));
      } catch (error) {
        errorLogger.logError(error as Error, {
          kioskId: this.currentSession.kioskId,
          userAction: 'save_session'
        });
      }
    }
  }

  private loadSession(): SessionState | null {
    try {
      const saved = localStorage.getItem(this.LOCAL_STORAGE_KEY);
      return saved ? JSON.parse(saved) : null;
    } catch (error) {
      errorLogger.logError(error as Error, {
        userAction: 'load_session'
      });
      return null;
    }
  }

  startSession(kioskId: KioskId, initialScreen: string = 'landing'): SessionState {
    // Clear any existing session
    this.endSession();

    this.currentSession = {
      id: this.generateSessionId(),
      kioskId,
      startTime: new Date().toISOString(),
      lastActivityTime: new Date().toISOString(),
      currentScreen: initialScreen,
      userInteractions: 0,
      timeoutWarningShown: false
    };

    // Save the session
    this.saveSession();

    // Set up event listeners
    window.addEventListener('touchstart', this.handleUserActivity);
    window.addEventListener('mousemove', this.handleUserActivity);
    window.addEventListener('keydown', this.handleUserActivity);

    // Start the timeout
    this.resetTimeout();

    return this.currentSession;
  }

  private handleUserActivity(): void {
    if (!this.currentSession) return;

    this.currentSession.lastActivityTime = new Date().toISOString();
    this.currentSession.userInteractions++;
    this.currentSession.timeoutWarningShown = false;
    
    this.saveSession();
    this.resetTimeout();
  }

  private resetTimeout(): void {
    if (this.timeoutId) clearTimeout(this.timeoutId);
    if (this.warningTimeoutId) clearTimeout(this.warningTimeoutId);

    // Set warning timeout
    this.warningTimeoutId = setTimeout(() => {
      if (this.currentSession && !this.currentSession.timeoutWarningShown) {
        this.currentSession.timeoutWarningShown = true;
        this.saveSession();
        if (this.onWarning) this.onWarning();
      }
    }, this.TIMEOUT_DURATION - this.WARNING_THRESHOLD);

    // Set session timeout
    this.timeoutId = setTimeout(() => {
      if (this.onTimeout) this.onTimeout();
      this.endSession();
    }, this.TIMEOUT_DURATION);
  }

  endSession(): void {
    // Clear timeouts
    if (this.timeoutId) clearTimeout(this.timeoutId);
    if (this.warningTimeoutId) clearTimeout(this.warningTimeoutId);

    // Remove event listeners
    window.removeEventListener('touchstart', this.handleUserActivity);
    window.removeEventListener('mousemove', this.handleUserActivity);
    window.removeEventListener('keydown', this.handleUserActivity);

    // Clear session data
    localStorage.removeItem(this.LOCAL_STORAGE_KEY);
    this.currentSession = null;
  }

  getCurrentSession(): SessionState | null {
    return this.currentSession || this.loadSession();
  }

  updateCurrentScreen(screen: string): void {
    if (!this.currentSession) return;

    this.currentSession.currentScreen = screen;
    this.saveSession();
    this.handleUserActivity();
  }

  setTimeoutCallback(callback: () => void): void {
    this.onTimeout = callback;
  }

  setWarningCallback(callback: () => void): void {
    this.onWarning = callback;
  }

  getSessionDuration(): number {
    if (!this.currentSession) return 0;

    const start = new Date(this.currentSession.startTime).getTime();
    const now = Date.now();
    return now - start;
  }

  getLastActivityTime(): number {
    if (!this.currentSession) return 0;

    const lastActivity = new Date(this.currentSession.lastActivityTime).getTime();
    const now = Date.now();
    return now - lastActivity;
  }

  isSessionActive(): boolean {
    return this.currentSession !== null;
  }

  extendSession(duration: number = this.TIMEOUT_DURATION): void {
    if (!this.currentSession) return;

    this.handleUserActivity();
    if (this.timeoutId) clearTimeout(this.timeoutId);
    if (this.warningTimeoutId) clearTimeout(this.warningTimeoutId);

    this.timeoutId = setTimeout(() => {
      if (this.onTimeout) this.onTimeout();
      this.endSession();
    }, duration);
  }
}

// Export a singleton instance
export const sessionManager = new SessionManagerService();