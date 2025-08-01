import React from 'react';
import { useLanguage } from '../contexts/LanguageContext';

interface LandingScreenProps {
  onStartFlow: () => void;
}

const LandingScreen: React.FC<LandingScreenProps> = ({ onStartFlow }) => {
  const { t } = useLanguage();
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
      
      <div className="landing-content fade-up" style={{
        backgroundImage: 'url(/MB.jpg)',
        backgroundSize: 'cover',
        backgroundPosition: 'center',
        backgroundRepeat: 'no-repeat',
        position: 'relative'
      }}>

        <button 
          className="buy-tickets-button button-pulse"
          onClick={onStartFlow}
          style={{ zIndex: 2, position: 'relative' }}
        >
          {t('buyTickets')}
        </button>
      </div>
    </div>
  );
};

export default LandingScreen;