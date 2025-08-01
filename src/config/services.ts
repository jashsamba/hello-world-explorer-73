/**
 * Centralized Configuration for External Services
 * 
 * This file contains all external service URLs and API configurations.
 * Update these values to change settings across the entire application.
 */

export const SERVICES_CONFIG = {
  // n8n Webhook Configuration
  N8N: {
    // Your n8n webhook URL for email receipts
    WEBHOOK_URL: 'https://jaswanthbunny007.app.n8n.cloud/webhook-test/dcb032ef-7d63-4ef5-8a8a-35ae03fb51ad',
    
    // Backup webhook URL (optional)
    BACKUP_WEBHOOK_URL: '',
    
    // Enable/disable n8n integration
    ENABLED: true,
    
    // Timeout for webhook requests (milliseconds)
    TIMEOUT: 10000
  },

  // Payment Configuration
  PAYMENTS: {
    // Stripe configuration
    STRIPE: {
      // Stripe publishable key (public - safe to store here)
      PUBLISHABLE_KEY: 'pk_test_...', // Replace with your Stripe publishable key
      
      // Currency for payments
      CURRENCY: 'usd',
      
      // Default payment amounts (in cents)
      DEFAULT_AMOUNTS: {
        ADULT_TICKET: 1999,      // $19.99
        CHILD_TICKET: 1499,      // $14.99
        SENIOR_TICKET: 1699,     // $16.99
        STUDENT_TICKET: 1699,    // $16.99
        FIELD_TRIP: 1700,        // $17.00
        BUS_SUBSIDY: 1500,       // $15.00
        DONATION_5: 500,         // $5.00
        DONATION_10: 1000,       // $10.00
        DONATION_25: 2500        // $25.00
      },
      
      // Tax rate (as decimal, e.g., 0.13 for 13%)
      TAX_RATE: 0.13,
      
      // Success and cancel URLs
      SUCCESS_URL: '/payment-success',
      CANCEL_URL: '/payment-cancelled'
    }
  },

  // Museum Information
  MUSEUM: {
    NAME: 'THEMUSEUM',
    CONTACT_EMAIL: 'info@themuseum.ca',
    SUPPORT_EMAIL: 'support@themuseum.ca'
  },

  // API Endpoints
  API: {
    // Supabase Edge Functions
    EDGE_FUNCTIONS: {
      CREATE_PAYMENT: 'create-payment',
      VERIFY_PAYMENT: 'verify-payment',
      SEND_RECEIPT: 'send-receipt'
    }
  },

  // Debug and Development
  DEBUG: {
    // Enable console logging
    ENABLE_LOGGING: true,
    
    // Enable debug panel in UI
    SHOW_DEBUG_PANEL: false,
    
    // Enable test mode indicators
    SHOW_TEST_MODE: true
  }
};

// Helper functions for easy access
export const getN8nWebhookUrl = () => SERVICES_CONFIG.N8N.WEBHOOK_URL;

export const getStripeConfig = () => SERVICES_CONFIG.PAYMENTS.STRIPE;

export const getTicketPrice = (ticketType: string) => {
  const prices = SERVICES_CONFIG.PAYMENTS.STRIPE.DEFAULT_AMOUNTS;
  return (prices as any)[ticketType.toUpperCase().replace('-', '_')] || 0;
};

export const calculateTax = (amount: number) => {
  return Math.round(amount * SERVICES_CONFIG.PAYMENTS.STRIPE.TAX_RATE);
};

export const calculateTotal = (subtotal: number) => {
  const tax = calculateTax(subtotal);
  return subtotal + tax;
};

// Environment detection
export const isProduction = () => window.location.hostname !== 'localhost';

export const getAppUrl = () => window.location.origin;

// Validation helpers
export const validateConfig = () => {
  const errors: string[] = [];
  
  if (!SERVICES_CONFIG.N8N.WEBHOOK_URL && SERVICES_CONFIG.N8N.ENABLED) {
    errors.push('n8n webhook URL is required when n8n is enabled');
  }
  
  if (!SERVICES_CONFIG.PAYMENTS.STRIPE.PUBLISHABLE_KEY) {
    errors.push('Stripe publishable key is required');
  }
  
  return {
    isValid: errors.length === 0,
    errors
  };
};