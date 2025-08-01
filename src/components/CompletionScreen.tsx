import React, { useEffect, useState } from 'react';
import { useLanguage } from '../contexts/LanguageContext';
import { SERVICES_CONFIG, getN8nWebhookUrl } from '../lib/utils';

interface CompletionScreenProps {
  onStartOver: () => void;
  orderDetails?: {
    email: string;
    tickets: {[key: string]: number};
    addOns: {[key: string]: number};
    totals: {
      subtotal: string;
      tax: string;
      total: string;
    };
  };
}

const CompletionScreen: React.FC<CompletionScreenProps> = ({ onStartOver, orderDetails }) => {
  const { t } = useLanguage();
  const [webhookUrl, setWebhookUrl] = useState(getN8nWebhookUrl());
  const [showWebhookConfig, setShowWebhookConfig] = useState(false);
  const [countdown, setCountdown] = useState(10);
  const [isAutoReturning, setIsAutoReturning] = useState(true);

  // Send order data to n8n webhook
  const sendToN8n = async (webhookUrl: string) => {
    if (!orderDetails || !webhookUrl || !SERVICES_CONFIG.N8N.ENABLED) return;

    try {
      const response = await fetch(webhookUrl, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        mode: "no-cors",
        body: JSON.stringify({
          timestamp: new Date().toISOString(),
          order_id: `ORDER-${Date.now()}`,
          customer_email: orderDetails.email,
          tickets: orderDetails.tickets,
          addOns: orderDetails.addOns,
          totals: orderDetails.totals,
          museum: SERVICES_CONFIG.MUSEUM.NAME,
          triggered_from: window.location.origin,
        }),
      });
      
      console.log('Order data sent to n8n workflow');
    } catch (error) {
      console.error('Failed to send data to n8n:', error);
    }
  };

  // Auto-send to webhook if URL is configured
  useEffect(() => {
    const savedWebhookUrl = localStorage.getItem('n8n-webhook-url');
    const urlToUse = savedWebhookUrl || webhookUrl; // Use saved URL or default
    
    if (urlToUse && orderDetails) {
      setWebhookUrl(urlToUse);
      sendToN8n(urlToUse);
      console.log('Auto-sending order data to n8n:', orderDetails);
    }
  }, [orderDetails]);

  // Auto-return countdown effect
  useEffect(() => {
    if (!isAutoReturning) return;

    const timer = setInterval(() => {
      setCountdown((prev) => {
        if (prev <= 1) {
          onStartOver();
          return 0;
        }
        return prev - 1;
      });
    }, 1000);

    return () => clearInterval(timer);
  }, [isAutoReturning, onStartOver]);

  const handleWebhookSave = () => {
    localStorage.setItem('n8n-webhook-url', webhookUrl);
    setShowWebhookConfig(false);
    setIsAutoReturning(false); // Pause auto-return when configuring
    if (orderDetails) {
      sendToN8n(webhookUrl);
    }
  };

  const handleManualTrigger = () => {
    if (webhookUrl && orderDetails) {
      sendToN8n(webhookUrl);
    }
  };

  const handleReturnNow = () => {
    setIsAutoReturning(false);
    onStartOver();
  };

  return (
    <div className="screen-container">
      <div className="museum-header">
        <div className="museum-logo">
          <img 
            src="/logo.png" 
            alt="THEMUSEUM" 
            style={{
              height: '60px',
              width: 'auto'
            }}
          />
        </div>
      </div>
      
      <div className="completion-content">
        <div className="completion-center-container">
          <div className="completion-message">
            <p>{t('completionMessage')}</p>
            
            <p className="email-backup">{t('emailBackup')}</p>
          </div>
          
          {isAutoReturning && (
            <div className="auto-return-notice">
              <p className="countdown-text">
                {t('autoReturn').replace('{seconds}', countdown.toString())}
              </p>
            </div>
          )}
          
          <button 
            className="start-over-button"
            onClick={handleReturnNow}
          >
            {isAutoReturning ? t('returnNow') : t('startNewPurchase')}
          </button>
          
          <div className="webhook-controls">
            <button 
              className="webhook-config-button"
              onClick={() => {
                setShowWebhookConfig(!showWebhookConfig);
                if (!showWebhookConfig) setIsAutoReturning(false); // Pause auto-return when opening config
              }}
            >
              ⚙️ Configure n8n Webhook
            </button>
            
            <button 
              className="webhook-config-button"
              onClick={() => alert(`Current n8n URL: ${SERVICES_CONFIG.N8N.WEBHOOK_URL}\n\nMuseum: ${SERVICES_CONFIG.MUSEUM.NAME}\n\nConfig file: src/lib/utils.ts`)}
            >
              📋 View Current Settings
            </button>
            
            {webhookUrl && (
              <button 
                className="webhook-trigger-button"
                onClick={handleManualTrigger}
              >
                📧 Resend Email Receipt
              </button>
            )}
          </div>
          
          {showWebhookConfig && (
            <div className="webhook-config">
              <h3>n8n Webhook Configuration</h3>
              <p>Current webhook URL: <strong>{SERVICES_CONFIG.N8N.WEBHOOK_URL}</strong></p>
              <p>Status: <strong className={SERVICES_CONFIG.N8N.ENABLED ? "status enabled" : "status disabled"}>
                {SERVICES_CONFIG.N8N.ENABLED ? "✅ Enabled" : "❌ Disabled"}
              </strong></p>
              <p>To change these settings, edit <code>src/lib/utils.ts</code></p>
              
              <input
                type="url"
                placeholder={getN8nWebhookUrl()}
                value={webhookUrl}
                onChange={(e) => setWebhookUrl(e.target.value)}
                className="webhook-input"
              />
              
              <div className="webhook-example">
                <details>
                  <summary>📋 Sample JSON that will be sent to your n8n workflow:</summary>
                  <pre className="json-preview">
{JSON.stringify({
  timestamp: new Date().toISOString(),
  order_id: `ORDER-${Date.now()}`,
  customer_email: orderDetails?.email || "customer@example.com",
  tickets: orderDetails?.tickets || {"adult-general": 2},
  addOns: orderDetails?.addOns || {"donation-10": 1},
  totals: orderDetails?.totals || {subtotal: "49.97", tax: "6.50", total: "56.47"},
  museum: SERVICES_CONFIG.MUSEUM.NAME,
  triggered_from: window.location.origin,
}, null, 2)}
                  </pre>
                </details>
              </div>
              <div className="webhook-actions">
                <button onClick={handleWebhookSave} className="save-button">
                  Save & Test
                </button>
                <button onClick={() => setShowWebhookConfig(false)} className="cancel-button">
                  Cancel
                </button>
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  );
};

export default CompletionScreen;