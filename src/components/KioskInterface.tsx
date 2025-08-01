
import React, { useState, useEffect } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { User } from '@supabase/supabase-js';
import LandingScreen from './LandingScreen';
import TicketSelectionScreen from './TicketSelectionScreen';
import DetailsScreen from './DetailsScreen';
import CheckoutScreen from './CheckoutScreen';
import CompletionScreen from './CompletionScreen';
import ProgressIndicator from './ProgressIndicator';
import LanguageSelector from './LanguageSelector';
import { useLanguage } from '../contexts/LanguageContext';

export interface FlowData {
  selections?: { tickets: {[key: string]: number}; addOns: {[key: string]: number}; totals: { subtotal: string; tax: string; total: string } };
  details?: { firstName: string; lastName: string; email: string; postalCode: string };
  tickets?: {[key: string]: number};
  addOns?: {[key: string]: number};
}

const KioskInterface = () => {
  const { t } = useLanguage();
  const [currentScreen, setCurrentScreen] = useState<'landing' | 'tickets' | 'details' | 'checkout' | 'completion'>('landing');
  const [flowData, setFlowData] = useState<FlowData>({});
  const [user, setUser] = useState<User | null>(null);
  const [loading, setLoading] = useState(true);
  const [isNavigatingBack, setIsNavigatingBack] = useState(false);
  const [cartQuantities, setCartQuantities] = useState<{[key: string]: number}>({});
  const [cartAddOns, setCartAddOns] = useState<{[key: string]: number}>({});

  const steps = [t('selectTickets'), t('yourDetails'), t('payment'), t('complete')];
  const getStepNumber = () => {
    switch (currentScreen) {
      case 'landing': return 0;
      case 'tickets': return 1;
      case 'details': return 2;
      case 'checkout': return 3;
      case 'completion': return 4;
      default: return 0;
    }
  };

  useEffect(() => {
    // Get initial session
    supabase.auth.getSession().then(({ data: { session } }) => {
      setUser(session?.user ?? null);
      setLoading(false);
    });

    // Listen for auth changes
    const { data: { subscription } } = supabase.auth.onAuthStateChange((_event, session) => {
      setUser(session?.user ?? null);
    });

    return () => subscription.unsubscribe();
  }, []);

  const handleStartFlow = () => {
    setCurrentScreen('tickets');
  };

  const handleBackToLanding = () => {
    setIsNavigatingBack(true);
    setTimeout(() => {
      setCurrentScreen('landing');
      setIsNavigatingBack(false);
    }, 50);
  };

  const handleBackToTickets = () => {
    setIsNavigatingBack(true);
    setTimeout(() => {
      setCurrentScreen('tickets');
      setIsNavigatingBack(false);
    }, 50);
  };

  const handleBackToDetails = () => {
    setIsNavigatingBack(true);
    setTimeout(() => {
      setCurrentScreen('details');
      setIsNavigatingBack(false);
    }, 50);
  };

  const handleTicketSelections = (selections: FlowData['selections']) => {
    setFlowData(prev => ({ ...prev, selections }));
    setCurrentScreen('details');
  };

  const handleDetailsSubmit = (details: FlowData['details']) => {
    setFlowData(prev => ({ ...prev, details }));
    setCurrentScreen('checkout');
  };

  const handlePaymentComplete = () => {
    setCurrentScreen('completion');
  };

  const handleStartOver = () => {
    setCurrentScreen('landing');
    setFlowData({});
    setCartQuantities({});
    setCartAddOns({});
  };

  const updateCartQuantity = (id: string, change: number, isAddOn: boolean = false) => {
    if (isAddOn) {
      setCartAddOns(prev => ({
        ...prev,
        [id]: Math.max(0, (prev[id] || 0) + change)
      }));
    } else {
      setCartQuantities(prev => ({
        ...prev,
        [id]: Math.max(0, (prev[id] || 0) + change)
      }));
    }
  };

  if (loading) {
    return (
      <div className="kiosk-container">
        <div className="screen-container">
          <div className="loading-screen">
            <div className="loading-spinner"></div>
            <p>Loading...</p>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="kiosk-container">
      {/* Language selector always visible at top right */}
      <div className="language-selector-wrapper">
        <LanguageSelector />
      </div>
      
      {currentScreen !== 'landing' && currentScreen !== 'completion' && (
        <ProgressIndicator 
          currentStep={getStepNumber()}
          totalSteps={4}
          steps={steps}
        />
      )}
      
      <div className={`screen-transition ${isNavigatingBack ? 'screen-enter-back' : 'screen-enter'}`}>
        {currentScreen === 'landing' && (
          <LandingScreen onStartFlow={handleStartFlow} />
        )}
        
        {currentScreen === 'tickets' && (
          <TicketSelectionScreen 
            onContinue={handleTicketSelections}
            onBack={handleBackToLanding}
            quantities={cartQuantities}
            addOns={cartAddOns}
            onUpdateQuantity={updateCartQuantity}
          />
        )}
        
        {currentScreen === 'details' && (
          <DetailsScreen 
            onContinue={handleDetailsSubmit}
            onBack={handleBackToTickets}
            totals={flowData.selections?.totals}
            quantities={cartQuantities}
            addOns={cartAddOns}
          />
        )}
        
        {currentScreen === 'checkout' && (
          <CheckoutScreen 
            onComplete={handlePaymentComplete}
            onBack={handleBackToDetails}
            totals={{
              subtotal: parseFloat(flowData.selections?.totals?.subtotal || '0'),
              tax: parseFloat(flowData.selections?.totals?.tax || '0'),
              total: parseFloat(flowData.selections?.totals?.total || '0')
            }}
            quantities={cartQuantities}
            addOns={cartAddOns}
            userEmail={flowData.details?.email}
          />
        )}
        
        {currentScreen === 'completion' && (
          <CompletionScreen 
            onStartOver={handleStartOver}
            orderDetails={{
              email: flowData.details?.email || '',
              tickets: cartQuantities,
              addOns: cartAddOns,
              totals: flowData.selections?.totals || { subtotal: '0.00', tax: '0.00', total: '0.00' }
            }}
          />
        )}
      </div>
    </div>
  );
};

export default KioskInterface;
