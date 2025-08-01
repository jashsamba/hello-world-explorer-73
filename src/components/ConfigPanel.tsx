import React, { useState } from 'react';
import { SERVICES_CONFIG, validateConfig } from '../config/services';

interface ConfigPanelProps {
  isOpen: boolean;
  onClose: () => void;
}

const ConfigPanel: React.FC<ConfigPanelProps> = ({ isOpen, onClose }) => {
  const [config, setConfig] = useState(SERVICES_CONFIG);
  const [activeTab, setActiveTab] = useState<'n8n' | 'payments' | 'debug'>('n8n');

  if (!isOpen) return null;

  const validation = validateConfig();

  const copyToClipboard = (text: string) => {
    navigator.clipboard.writeText(text);
    alert('Copied to clipboard!');
  };

  return (
    <div className="config-overlay">
      <div className="config-panel">
        <div className="config-header">
          <h2>🔧 Services Configuration</h2>
          <button className="config-close" onClick={onClose}>✕</button>
        </div>

        <div className="config-tabs">
          <button 
            className={`config-tab ${activeTab === 'n8n' ? 'active' : ''}`}
            onClick={() => setActiveTab('n8n')}
          >
            🔗 n8n
          </button>
          <button 
            className={`config-tab ${activeTab === 'payments' ? 'active' : ''}`}
            onClick={() => setActiveTab('payments')}
          >
            💳 Payments
          </button>
          <button 
            className={`config-tab ${activeTab === 'debug' ? 'active' : ''}`}
            onClick={() => setActiveTab('debug')}
          >
            🐛 Debug
          </button>
        </div>

        <div className="config-content">
          {/* n8n Configuration */}
          {activeTab === 'n8n' && (
            <div className="config-section">
              <h3>n8n Webhook Configuration</h3>
              
              <div className="config-field">
                <label>Webhook URL:</label>
                <div className="config-url-display">
                  <code>{config.N8N.WEBHOOK_URL}</code>
                  <button 
                    className="copy-button"
                    onClick={() => copyToClipboard(config.N8N.WEBHOOK_URL)}
                  >
                    📋
                  </button>
                </div>
                <small>To change this URL, edit: <code>src/config/services.ts</code></small>
              </div>

              <div className="config-field">
                <label>Status:</label>
                <span className={`status ${config.N8N.ENABLED ? 'enabled' : 'disabled'}`}>
                  {config.N8N.ENABLED ? '✅ Enabled' : '❌ Disabled'}
                </span>
              </div>

              <div className="config-field">
                <label>Timeout:</label>
                <span>{config.N8N.TIMEOUT}ms</span>
              </div>
            </div>
          )}

          {/* Payments Configuration */}
          {activeTab === 'payments' && (
            <div className="config-section">
              <h3>Payment Configuration</h3>
              
              <div className="config-field">
                <label>Currency:</label>
                <span className="config-value">{config.PAYMENTS.STRIPE.CURRENCY.toUpperCase()}</span>
              </div>

              <div className="config-field">
                <label>Tax Rate:</label>
                <span className="config-value">{(config.PAYMENTS.STRIPE.TAX_RATE * 100).toFixed(1)}%</span>
              </div>

              <div className="config-field">
                <label>Stripe Publishable Key:</label>
                <div className="config-url-display">
                  <code>{config.PAYMENTS.STRIPE.PUBLISHABLE_KEY || 'Not configured'}</code>
                  {config.PAYMENTS.STRIPE.PUBLISHABLE_KEY && (
                    <button 
                      className="copy-button"
                      onClick={() => copyToClipboard(config.PAYMENTS.STRIPE.PUBLISHABLE_KEY)}
                    >
                      📋
                    </button>
                  )}
                </div>
                <small>⚠️ Add your Stripe publishable key in services.ts</small>
              </div>

              <div className="pricing-grid">
                <h4>Ticket Pricing (in cents):</h4>
                {Object.entries(config.PAYMENTS.STRIPE.DEFAULT_AMOUNTS).map(([key, value]) => (
                  <div key={key} className="price-item">
                    <span>{key.replace(/_/g, ' ').toLowerCase()}:</span>
                    <span>${(value / 100).toFixed(2)}</span>
                  </div>
                ))}
              </div>
            </div>
          )}

          {/* Debug Configuration */}
          {activeTab === 'debug' && (
            <div className="config-section">
              <h3>Debug Settings</h3>
              
              <div className="config-field">
                <label>Console Logging:</label>
                <span className={`status ${config.DEBUG.ENABLE_LOGGING ? 'enabled' : 'disabled'}`}>
                  {config.DEBUG.ENABLE_LOGGING ? '✅ Enabled' : '❌ Disabled'}
                </span>
              </div>

              <div className="config-field">
                <label>Test Mode Indicators:</label>
                <span className={`status ${config.DEBUG.SHOW_TEST_MODE ? 'enabled' : 'disabled'}`}>
                  {config.DEBUG.SHOW_TEST_MODE ? '✅ Enabled' : '❌ Disabled'}
                </span>
              </div>

              <div className="config-field">
                <label>Environment:</label>
                <span className="config-value">
                  {window.location.hostname === 'localhost' ? '🔧 Development' : '🚀 Production'}
                </span>
              </div>

              <div className="config-field">
                <label>App URL:</label>
                <div className="config-url-display">
                  <code>{window.location.origin}</code>
                  <button 
                    className="copy-button"
                    onClick={() => copyToClipboard(window.location.origin)}
                  >
                    📋
                  </button>
                </div>
              </div>
            </div>
          )}
        </div>

        {/* Validation Status */}
        {!validation.isValid && (
          <div className="config-validation">
            <h4>⚠️ Configuration Issues:</h4>
            {validation.errors.map((error, index) => (
              <div key={index} className="validation-error">• {error}</div>
            ))}
          </div>
        )}

        <div className="config-footer">
          <p>💡 <strong>To update these settings:</strong> Edit <code>src/config/services.ts</code></p>
          <p>📖 <strong>Documentation:</strong> All configuration options are documented in the services.ts file</p>
        </div>
      </div>
    </div>
  );
};

export default ConfigPanel;