import React, { useState, useEffect } from 'react';
import { useLanguage } from '../contexts/LanguageContext';
import { kioskPayment } from '../services/kioskPayment';
import type { PaymentRequest, PaymentResponse } from '../types/kiosk';

interface CheckoutScreenProps {
  onComplete: () => void;
  onBack: () => void;
  totals: {
    subtotal: number;
    tax: number;
    total: number;
  };
  quantities: {[key: string]: number};
  addOns: {[key: string]: number};
  userEmail?: string;
  userDetails?: {
    firstName: string;
    lastName: string;
    contactNumber?: string;
    postalCode?: string;
  };
}

const CheckoutScreen: React.FC<CheckoutScreenProps> = ({ 
  onComplete, 
  onBack, 
  totals, 
  quantities, 
  addOns, 
  userEmail, 
  userDetails 
}) => {
  const { t, language } = useLanguage();
  const [processing, setProcessing] = useState(false);
  const [paymentSuccessful, setPaymentSuccessful] = useState(false);
  const [emailSent, setEmailSent] = useState(false);
  const [emailSending, setEmailSending] = useState(false);
  const [currentTime, setCurrentTime] = useState(new Date());
  const [purchaseError, setPurchaseError] = useState<string | null>(null);
  const [currentTransactionId, setCurrentTransactionId] = useState<string | null>(null);

  // Update time every second
  useEffect(() => {
    const timer = setInterval(() => {
      setCurrentTime(new Date());
    }, 1000);

    return () => clearInterval(timer);
  }, []);

  // Cleanup on unmount
  useEffect(() => {
    return () => {
      if (currentTransactionId) {
        kioskPayment.cancelPayment(currentTransactionId, 'KIOSK1').catch(console.error);
      }
    };
  }, [currentTransactionId]);

  const formatDateTime = (date: Date) => {
    const locale = language === 'fr' ? 'fr-CA' : 'en-US';
    const timeString = date.toLocaleTimeString(locale, { 
      hour: 'numeric', 
      minute: '2-digit',
      hour12: true 
    });
    const dateString = date.toLocaleDateString(locale, {
      year: 'numeric',
      month: 'long',
      day: 'numeric'
    });
    return `${timeString} | ${dateString}`;
  };

  const tickets = [
    { id: 'adult-general', name: t('adultGeneral'), price: 19.99 },
    { id: 'child-general', name: t('childGeneral'), price: 14.99 },
    { id: 'senior-general', name: t('seniorGeneral'), price: 16.99 },
    { id: 'student-general', name: t('studentGeneral'), price: 16.99 }
  ];

  const addOnItems = [
    { id: 'donation-10', name: t('donation10'), price: 10.00 },
    { id: 'donation-15', name: t('donation15'), price: 15.00 },
    { id: 'donation-25', name: t('donation25'), price: 25.00 },
    { id: 'field-trip', name: t('fieldTripDonation'), price: 300.00 }
  ];

  const generateCartItems = () => {
    const cartItems = [];
    
    tickets.forEach(ticket => {
      const quantity = quantities[ticket.id] || 0;
      if (quantity > 0) {
        cartItems.push({
          id: ticket.id,
          icon: '🎫',
          name: ticket.name,
          description: `${ticket.name} (${quantity})`,
          price: (quantity * ticket.price).toFixed(2),
          quantity
        });
      }
    });
    
    addOnItems.forEach(addOn => {
      const quantity = addOns[addOn.id] || 0;
      if (quantity > 0) {
        cartItems.push({
          id: addOn.id,
          icon: '🎁',
          name: addOn.name,
          description: `${addOn.name} (${quantity})`,
          price: (quantity * addOn.price).toFixed(2),
          quantity
        });
      }
    });
    
    return cartItems;
  };

  const cartItems = generateCartItems();
  const totalItemCount = cartItems.reduce((sum, item) => sum + item.quantity, 0);

  const handleSecurePurchase = async () => {
    try {
      setPurchaseError(null);
      setProcessing(true);

      const paymentRequest: PaymentRequest = {
        amount: totals.total,
        currency: 'CAD',
        orderId: `order-${Date.now()}`,
        kioskId: 'KIOSK1' as const,
        items: cartItems.map(item => ({
          name: item.name,
          quantity: item.quantity,
          price: Number(item.price)
        }))
      };

      const result = await kioskPayment.initiatePayment(paymentRequest);
      setCurrentTransactionId(result.transactionId || null);

      if (result.success) {
        setPaymentSuccessful(true);
        console.log('Payment completed successfully:', result.transactionId);
        
        setTimeout(() => {
          onComplete();
        }, 2000);
      } else {
        setPurchaseError(result.error || 'Payment failed');
        console.error('Payment failed:', result.error, result.details);
      }
    } catch (error) {
      console.error('Payment processing error:', error);
      setPurchaseError('Network error. Please try again.');
    } finally {
      setProcessing(false);
    }
  };

  const handlePaymentResult = (result: PaymentResponse) => {
    setCurrentTransactionId(result.transactionId || null);
    
    if (result.success) {
      setPaymentSuccessful(true);
      console.log('Payment completed successfully:', result.transactionId);
      
      setTimeout(() => {
        onComplete();
      }, 2000);
    } else {
      setPurchaseError(result.error || 'Payment failed');
      console.error('Payment failed:', result.error, result.details);
    }
  };

  const handleSendReceipt = async () => {
    if (!userEmail || emailSent || emailSending) return;
    
    setEmailSending(true);
    
    try {
      // Simulate sending receipt
      console.log('Sending receipt to:', userEmail);
      console.log('Order details:', { tickets: quantities, addOns: addOns, totals: totals });
      
      await new Promise(resolve => setTimeout(resolve, 1500));
      
      setEmailSent(true);
      console.log('Receipt email sent successfully');
      
      setTimeout(() => {
        onComplete();
      }, 500);
      
    } catch (error) {
      console.error('Failed to send receipt email:', error);
      setEmailSent(true);
      setTimeout(() => {
        onComplete();
      }, 500);
    } finally {
      setEmailSending(false);
    }
  };

  // Test mode controls
  const handleTestModeNext = () => {
    if (processing) {
      setProcessing(false);
      handleSecurePurchase();
    } else if (!paymentSuccessful) {
      setProcessing(true);
      setTimeout(() => {
        setProcessing(false);
        handleSecurePurchase();
      }, 1000);
    }
  };

  return (
    <div className="screen-container">
      <div className="museum-header">
        <button 
          className="back-button" 
          onClick={onBack}
          disabled={processing || paymentSuccessful}
        >
          {t('backToDetails')}
        </button>
        <div className="date-time">{formatDateTime(currentTime)}</div>
      </div>

      <div className="checkout-content">
        <div className="main-content">
          <div className="payment-terminal">
            <div className="payment-amount">
              <span className="payment-label">{t('cardPayment')}</span>
              <span className="payment-total">${totals.total.toFixed(2)}</span>
            </div>
            
            <div className="terminal-icon">
              <div className="card-reader">
                <div className="card-slot"></div>
                <div className="screen"></div>
                <div className="keypad">
                  <div className="keypad-row">
                    <div className="key"></div>
                    <div className="key"></div>
                    <div className="key"></div>
                  </div>
                  <div className="keypad-row">
                    <div className="key"></div>
                    <div className="key"></div>
                    <div className="key"></div>
                  </div>
                  <div className="keypad-row">
                    <div className="key"></div>
                    <div className="key"></div>
                    <div className="key"></div>
                  </div>
                </div>
              </div>
            </div>

            <div className="payment-instructions">
              {purchaseError ? (
                <div className="payment-error-message">
                  <div className="error-icon">⚠️</div>
                  <p style={{ color: '#dc2626' }}>{purchaseError}</p>
                  <button 
                    className="retry-button"
                    onClick={() => {
                      setPurchaseError(null);
                      handleSecurePurchase();
                    }}
                  >
                    {processing ? t('processing') : t('retry')}
                  </button>
                </div>
              ) : paymentSuccessful ? (
                <div className="payment-success-message">
                  <div className="success-checkmark">✓</div>
                  <p>{t('paymentSuccessful')}</p>
                  {userEmail && (
                    <button 
                      className={`send-receipt-button ${emailSent ? 'sent' : ''} ${emailSending ? 'sending' : ''} enabled`}
                      onClick={handleSendReceipt}
                      disabled={emailSent || emailSending}
                    >
                      {emailSending ? (
                        <>
                          <div className="mini-spinner"></div>
                          {t('sending')}
                        </>
                      ) : emailSent ? (
                        <>{t('emailSent')}</>
                      ) : (
                        t('sendReceipt')
                      )}
                    </button>
                  )}
                </div>
              ) : processing ? (
                <div className="processing-message">
                  <div className="spinner"></div>
                  <p>{t('processingPayment')}</p>
                </div>
              ) : (
                <p>{t('pinPadInstructions')}</p>
              )}

              {/* Test Mode Controls */}
              {import.meta.env.VITE_KIOSK_TEST_MODE === 'true' && (
                <div className="test-controls">
                  <button
                    onClick={handleTestModeNext}
                    className="move-next-button"
                  >
                    <span>Move to Next Step</span>
                    <span className="arrow">→</span>
                  </button>
                  <div className="kiosk-status">
                    <div className={`kiosk-indicator active`}>
                      Kiosk 1 (Active)
                    </div>
                  </div>
                </div>
              )}
            </div>
          </div>
        </div>

        <div className="cart-sidebar">
          <div className="cart-header">
            <span className="cart-label">{t('yourCart')}</span>
            <span className="item-count">
              {totalItemCount === 0 ? t('noItems') : 
               totalItemCount === 1 ? `1 ${t('item')}` : 
               `${totalItemCount} ${t('items')}`}
            </span>
          </div>
          
          <div className="cart-items">
            {cartItems.length === 0 ? (
              <div className="empty-cart">
                <span className="empty-cart-icon">🛒</span>
                <div className="empty-cart-text">{t('cartEmpty')}</div>
                <div className="empty-cart-subtext">{t('selectTicketsToStart')}</div>
              </div>
            ) : (
              cartItems.map(item => (
                <div key={item.id} className="cart-item">
                  <span className="item-icon">{item.icon}</span>
                  <div className="item-details">
                    <div>{item.name}</div>
                    <div>{item.description}</div>
                  </div>
                  <div className="item-price">${Number(item.price).toFixed(2)}</div>
                </div>
              ))
            )}
          </div>

          <div className="cart-summary">
            <div className="summary-line">
              <span>{t('subtotal')}</span>
              <span>${(totals?.subtotal || 0).toFixed(2)}</span>
            </div>
            <div className="summary-line">
              <span>{t('selectedTax')}</span>
              <span>${(totals?.tax || 0).toFixed(2)}</span>
            </div>
            <div className="summary-line total">
              <span>{t('totalIncTax')}</span>
              <span>${(totals?.total || 0).toFixed(2)}</span>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};

export default CheckoutScreen;