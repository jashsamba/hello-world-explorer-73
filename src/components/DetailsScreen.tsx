import React, { useState, useEffect } from 'react';
import { useLanguage } from '../contexts/LanguageContext';

interface DetailsScreenProps {
  onContinue: (details: { firstName: string; lastName: string; email: string; postalCode: string }) => void;
  onBack: () => void;
  totals?: { subtotal: string; tax: string; total: string };
  quantities: {[key: string]: number};
  addOns: {[key: string]: number};
}

const DetailsScreen: React.FC<DetailsScreenProps> = ({ onContinue, onBack, totals, quantities, addOns }) => {
  const { t, language } = useLanguage();
  const [details, setDetails] = useState({
    firstName: '',
    lastName: '',
    email: '',
    postalCode: ''
  });

  const [showKeyboard, setShowKeyboard] = useState(false);
  const [activeField, setActiveField] = useState<string | null>(null);
  const [formatError, setFormatError] = useState(false);
  const [currentTime, setCurrentTime] = useState(new Date());
  const [isProcessing, setIsProcessing] = useState(false);

  // Update time every second
  useEffect(() => {
    const timer = setInterval(() => {
      setCurrentTime(new Date());
    }, 1000);

    return () => clearInterval(timer);
  }, []);

  // Format time as "11:00AM | September 23, 2025"
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

  const nameKeyboardLayout = [
    ['1', '2', '3', '4', '5', '6', '7', '8', '9', '0'],
    ['q', 'w', 'e', 'r', 't', 'y', 'u', 'i', 'o', 'p'],
    ['a', 's', 'd', 'f', 'g', 'h', 'j', 'k', 'l'],
    ['⇧', 'z', 'x', 'c', 'v', 'b', 'n', 'm', '⇧'],
    ['space', '←']
  ];

  const emailKeyboardLayout = [
    ['1', '2', '3', '4', '5', '6', '7', '8', '9', '0'],
    ['q', 'w', 'e', 'r', 't', 'y', 'u', 'i', 'o', 'p'],
    ['a', 's', 'd', 'f', 'g', 'h', 'j', 'k', 'l'],
    ['⇧', 'z', 'x', 'c', 'v', 'b', 'n', 'm', '@', '.'],
    ['space', '←'],
    ['@gmail.com', '@outlook.com', '@yahoo.com', '@hotmail.com']
  ];

  const postalCodeKeyboardLayout = [
    ['1', '2', '3', '4', '5', '6', '7', '8', '9', '0'],
    ['a', 'b', 'c', 'd', 'e', 'f', 'g', 'h', 'i', 'j'],
    ['k', 'l', 'm', 'n', 'o', 'p', 'q', 'r', 's', 't'],
    ['u', 'v', 'w', 'x', 'y', 'z', '←']
  ];

  const getCurrentKeyboardLayout = () => {
    if (activeField === 'firstName' || activeField === 'lastName') {
      return nameKeyboardLayout;
    } else if (activeField === 'email') {
      return emailKeyboardLayout;
    } else {
      return postalCodeKeyboardLayout;
    }
  };

  const handleFieldFocus = (fieldName: string) => {
    setActiveField(fieldName);
    setShowKeyboard(true);
    setFormatError(false); // Reset any previous errors
  };

  // Auto-advance to next field when Enter is pressed
  const advanceToNextField = () => {
    const fieldSequence = ['firstName', 'lastName', 'email', 'postalCode'];
    const currentIndex = fieldSequence.indexOf(activeField!);
    
    if (currentIndex !== -1 && currentIndex < fieldSequence.length - 1) {
      // Move to next field
      const nextField = fieldSequence[currentIndex + 1];
      setActiveField(nextField);
      // Keep keyboard open for next field
    } else if (activeField === 'postalCode') {
      // Last field - close keyboard and focus continue button if form is valid
      setShowKeyboard(false);
      setActiveField(null);
      
      // If form is valid, focus the continue button
      if (isValidForm()) {
        // Optional: Auto-trigger continue action
        // handleContinue(); // Uncomment this line for automatic proceed
      }
    }
  };

  const handleKeyPress = (key: string) => {
    if (isProcessing) return; // Prevent rapid clicks
    
    setIsProcessing(true);
    setTimeout(() => setIsProcessing(false), 150); // 150ms debounce
    
    if (key === '←') {
      // Backspace
      if (activeField) {
        setDetails(prev => ({
          ...prev,
          [activeField as keyof typeof prev]: String(prev[activeField as keyof typeof prev]).slice(0, -1)
        }));
      }
    } else if (key === 'Enter') {
      // Auto-advance to next field
      advanceToNextField();
    } else if (key === 'space') {
      // Space handling (only for email field)
      if (activeField === 'email') {
        setDetails(prev => ({
          ...prev,
          [activeField]: String(prev[activeField as keyof typeof prev]) + ' '
        }));
      }
    } else if (key.startsWith('@')) {
      // Email domain shortcut (only for email field)
      if (activeField === 'email') {
        const currentValue = String(details.email);
        
        // Check if email already contains '@' symbol - prevent ANY key starting with @
        if (currentValue.includes('@')) {
          // Trigger error animation for any @ key when @ already exists
          setFormatError(true);
          setTimeout(() => setFormatError(false), 300);
          return;
        }
        
        setDetails(prev => ({
          ...prev,
          [activeField]: currentValue + key
        }));
      }
    } else if (key !== '⇧') {
      // Regular character
      if (activeField) {
        const currentValue = String(details[activeField as keyof typeof details]);
        
        if (activeField === 'postalCode') {
          // Enhanced postal code validation - Canadian format A1A
          const newValue = formatCanadianPostalCode(key, currentValue);
          setDetails(prev => ({
            ...prev,
            [activeField]: newValue
          }));
        } else {
          // For other fields, just add the character
          setDetails(prev => ({
            ...prev,
            [activeField]: currentValue + key
          }));
        }
      }
    }
  };

  // Validate if character is allowed at specific position for postal code
  const isValidCharacterAtPosition = (char: string, position: number) => {
    // Canadian postal code pattern: A1A1A1 (no spaces)
    // Position 0, 2, 4: Letters (A-Z)
    // Position 1, 3, 5: Numbers (0-9)
    
    if (position === 0 || position === 2 || position === 4) {
      return /[A-Za-z]/.test(char);
    } else if (position === 1 || position === 3 || position === 5) {
      return /\d/.test(char);
    }
    
    return false; // Invalid position
  };

  // Format Canadian postal code (A1A1A1) with real-time validation - no spaces
  const formatCanadianPostalCode = (newChar: string, currentValue: string) => {
    const position = currentValue.length;
    
    // Don't allow more than 6 characters
    if (position >= 6) {
      setFormatError(true);
      setTimeout(() => setFormatError(false), 300);
      return currentValue;
    }
    
    // Check if the new character is valid at this position
    if (!isValidCharacterAtPosition(newChar, position)) {
      // Trigger error animation
      setFormatError(true);
      setTimeout(() => setFormatError(false), 300);
      return currentValue; // Don't add the character
    }
    
    // Add the character - no space formatting needed
    return currentValue + newChar.toUpperCase();
  };

  const handleContinue = () => {
    onContinue(details);
  };

  const isValidForm = () => {
    // Name validation - must not be empty
    const firstNameValid = details.firstName.trim().length > 0;
    const lastNameValid = details.lastName.trim().length > 0;
    
    // Email validation
    const emailValid = details.email.includes('@') && details.email.includes('.');
    
    // Enhanced postal code validation - A1A format (3 digits)
    const postalCodeValid = details.postalCode.length === 3 && /^[A-Z]\d[A-Z]$/.test(details.postalCode);
    
    return firstNameValid && lastNameValid && emailValid && postalCodeValid;
  };

  // Define ticket and add-on items (same as TicketSelectionScreen)
  const tickets = [
    { id: 'adult-general', name: t('adultGeneral'), price: 19.99 },
    { id: 'child-general', name: t('childGeneral'), price: 14.99 },
    { id: 'senior-general', name: t('seniorGeneral'), price: 16.99 },
    { id: 'student-general', name: t('studentGeneral'), price: 16.99 }
  ];

  const addOnItems = [
    { id: 'donation-10', name: t('donation10'), price: 10.00 },
    { id: 'donation-15', name: t('donation15'), price: 15.00 },
    { id: 'donation-25', name: t('donation25'), price: 25.00 }
  ];

  // Generate cart items for display
  const generateCartItems = () => {
    const cartItems = [];

    // Add tickets to cart
    for (const ticket of tickets) {
      const quantity = quantities[ticket.id] || 0;
      if (quantity > 0) {
        cartItems.push({
          id: ticket.id,
          name: ticket.name,
          price: ticket.price,
          quantity,
          icon: '🎟️',
          description: `$${ticket.price.toFixed(2)} ${t('each')}`
        });
      }
    }

    // Add add-ons to cart
    for (const addOn of addOnItems) {
      const quantity = addOns[addOn.id] || 0;
      if (quantity > 0) {
        cartItems.push({
          id: addOn.id,
          name: addOn.name,
          price: addOn.price,
          quantity,
          icon: '🎁',
          description: `$${addOn.price.toFixed(2)} ${t('each')}`
        });
      }
    }

    return cartItems;
  };

  const cartItems = generateCartItems();
  const totalItemCount = cartItems.reduce((sum, item) => sum + item.quantity, 0);

  return (
    <div className="screen-container">
      <div className="museum-header">
        <button className="back-button" onClick={onBack}>{t('backToCheckout')}</button>
        <div className="date-time">{formatDateTime(currentTime)}</div>
      </div>

      <div className="details-content">
        <div className="main-content">
          <div className="details-header">
            <h2>{t('yourDetailsTitle')}</h2>
            <p>{t('yourDetailsSubtitle')}</p>
          </div>

          <div className="details-form">
            <div className="form-field">
              <label>{t('firstName')}</label>
              <input
                type="text"
                placeholder={t('firstNamePlaceholder')}
                value={details.firstName}
                onFocus={() => handleFieldFocus('firstName')}
                readOnly
              />
              {details.firstName.trim().length > 0 && (
                <span className="validation-check">✓</span>
              )}
            </div>

            <div className="form-field">
              <label>{t('lastName')}</label>
              <input
                type="text"
                placeholder={t('lastNamePlaceholder')}
                value={details.lastName}
                onFocus={() => handleFieldFocus('lastName')}
                readOnly
              />
              {details.lastName.trim().length > 0 && (
                <span className="validation-check">✓</span>
              )}
            </div>

            <div className="form-field">
              <label>{t('emailAddress')}</label>
              <input
                type="email"
                placeholder={t('emailPlaceholder')}
                value={details.email}
                onFocus={() => handleFieldFocus('email')}
                readOnly
              />
              {details.email && details.email.includes('@') && details.email.includes('.') && (
                <span className="validation-check">✓</span>
              )}
            </div>

            <div className="form-field">
              <label>{t('postalCodeLabel')}</label>
              <input
                type="text"
                placeholder={t('postalCodePlaceholder')}
                value={details.postalCode}
                onFocus={() => handleFieldFocus('postalCode')}
                className={`${formatError ? 'format-error flicker' : ''}`}
                readOnly
              />
              {details.postalCode && details.postalCode.length === 3 && /^[A-Z]\d[A-Z]$/.test(details.postalCode) && (
                <span className="validation-check">✓</span>
              )}
            </div>

            <button 
              className="continue-button"
              disabled={!isValidForm()}
              onClick={handleContinue}
            >
              {t('continueButton')}
            </button>
          </div>

          {showKeyboard &&
            <div className="keyboard-overlay">
              <div className="virtual-keyboard">
                <div className="keyboard-header">
                  <span>
                    {activeField === 'firstName' ? t('firstName') : 
                     activeField === 'lastName' ? t('lastName') :
                     activeField === 'email' ? t('enterEmailAddress') : t('enterPostalCode')}
                  </span>
                  <button
                    className="keyboard-close"
                    onClick={() => {
                      setShowKeyboard(false);
                      setActiveField(null);
                    }}
                  >
                    ✕
                  </button>
                </div>
                
                <div className={`typing-display ${formatError ? 'typing-error' : ''}`}>
                  <div className="typing-label">
                    {activeField === 'firstName' ? t('firstName') :
                     activeField === 'lastName' ? t('lastName') :
                     activeField === 'email' ? t('emailAddress') : t('postalCodeLabel')}
                  </div>
                  <div className="typing-input">
                    {activeField 
                      ? (details[activeField as keyof typeof details] || 
                         (activeField === 'firstName' ? t('firstNamePlaceholder') :
                          activeField === 'lastName' ? t('lastNamePlaceholder') :
                          activeField === 'email' ? t('startTyping') : t('postalCodePlaceholder')))
                      : t('startTyping')}
                    <span className="typing-cursor">|</span>
                  </div>
                </div>
                
                {getCurrentKeyboardLayout().map((row, rowIndex) => (
                  <div key={rowIndex} className="keyboard-row">
                    {row.map((key, keyIndex) => (
                      <button
                        key={`${rowIndex}-${keyIndex}`}
                        className={`keyboard-key ${
                          key === 'space' ? 'space-key' :
                          key === 'Enter' ? 'enter-key' :
                          key.startsWith('@') ? 'email-domain-key' : ''
                        }`}
                        onClick={() => handleKeyPress(key)}
                        data-key={key}
                      >
                        {key === 'space' ? 'Space' :
                         key === '←' ? '⌫' :
                         key}
                      </button>
                    ))}
                  </div>
                ))}

                <button
                  className="enter-key"
                  onClick={() => handleKeyPress('Enter')}
                >
                  Enter
                </button>
              </div>
            </div>
          }
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
                  <div className="item-price">${item.price}</div>
                </div>
              ))
            )}
          </div>

          <div className="cart-summary">
            <div className="summary-line">
              <span>{t('subtotal')}</span>
              <span>${totals?.subtotal}</span>
            </div>
            <div className="summary-line">
              <span>{t('selectedTax')}</span>
              <span>${totals?.tax}</span>
            </div>
            <div className="summary-line total">
              <span>{t('totalIncTax')}</span>
              <span>${totals?.total}</span>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};

export default React.memo(DetailsScreen);