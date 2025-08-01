import React, { createContext, useContext, useState, ReactNode } from 'react';

export type Language = 'en' | 'fr';

interface LanguageContextType {
  language: Language;
  setLanguage: (lang: Language) => void;
  t: (key: string) => string;
}

const LanguageContext = createContext<LanguageContextType | undefined>(undefined);

export const useLanguage = () => {
  const context = useContext(LanguageContext);
  if (!context) {
    throw new Error('useLanguage must be used within a LanguageProvider');
  }
  return context;
};

const translations = {
  en: {
    // Landing Screen
    buyTickets: 'BUY TICKETS',
    singleCardPayment: 'Single card payment only',
    
    // Progress Steps
    selectTickets: 'Select Tickets',
    yourDetails: 'Your Details',
    payment: 'Payment',
    complete: 'Complete',
    
    // Museum Header
    checkout: 'Checkout',
    
    // Ticket Selection
    museumGeneralAdmission: 'THEMUSEUM General Admission',
    selectTicketsTitle: 'Select Tickets',
    adultGeneral: 'Adult General Admission (13+)',
    childGeneral: 'Child General Admission (4-12)',
    seniorGeneral: 'Senior General Admission (65+)',
    studentGeneral: 'Student General Admission',
    details: 'Details >',
    selectAddons: 'Select Add-ons',
    donateToMuseumToday: 'Donate to THEMUSEUM today',
    donate: 'DONATE',
    donationText1: 'Thanks for your generous support of THEMUSEUM! It\'s thanks to you that THEMUSEUM continues to, grow, inspire and enlighten.',
    donationText2: 'Donations of $10 or greater are eligible for a tax receipt.',
    donationText3: 'Registered Name: THEMUSEUM of Hoax Transcending Objects Charitable Registration Number: 80709586001',
    donation10: '$10.00 Donation',
    donation15: '$15.00 Donation',
    donation25: '$25.00 Donation',
    fieldTripDonation: 'Donate to support a field trip for an entire class!',
    donationAddOn: 'DONATION ADD-ON',
    donationDescription: 'Thank you for your generous support of THEMUSEUM! It\'s thanks to you that THEMUSEUM continues to awe, inspire, and enlighten.',
    donationTaxInfo: 'Donations of $20 or greater are eligible for tax receipt !!!',
    cartTotal: 'Cart total',
    continueShopping: 'Continue Shopping',
    checkoutButton: 'Checkout',
    yourCart: 'Your Cart',
    item: 'ITEM',
    items: 'ITEMS',
    noItems: 'NO ITEMS',
    cartEmpty: 'Your cart is empty',
    selectTicketsToStart: 'Select tickets to get started',
    edit: 'Edit',
    subtotal: 'Subtotal',
    selectedTax: 'Selected tax',
    serviceFee: 'Service fee',
    totalIncTax: 'Total (inc. tax)',
    
    // Navigation
    backToMain: '← Main Screen',
    backToCheckout: '← Checkout',
    backToDetails: '← Details',
    
    // Details Screen
    yourDetailsTitle: 'Your Details',
    yourDetailsSubtitle: 'Please enter your details before checking out.',
    firstName: 'First Name*',
    firstNamePlaceholder: 'Enter your first name',
    lastName: 'Last Name*',
    lastNamePlaceholder: 'Enter your last name',
    emailAddress: 'Email address*',
    emailPlaceholder: 'Enter your email address',
    postalCodeLabel: 'Postal code* (First 3 digits - A1A format)',
    postalCodePlaceholder: 'A1A',
    email: 'Email Address',
    phoneNumber: 'Phone Number',
    postalCode: 'Postal Code',
    newsletter: 'Send me newsletters and updates',
    continueButton: 'Continue',
    
    // Missing translations
    ticketDescription: 'Purchase tickets for general admission to THEMUSEUM. Select your tickets and add-ons below.',
    processing: 'Processing...',
    retry: 'Retry',
    securingPurchase: 'Securing purchase...',
    
    // Checkout Screen
    cardPayment: 'Card Payment:',
    pinPadInstructions: 'Please follow the instructions\non the PIN pad',
    processingPayment: 'Processing payment...',
    sendReceipt: 'Send Receipt',
    sending: 'Sending...',
    emailSent: '✓ Email Sent',
    cardReader: 'Card Reader',
    startOver: 'START OVER',
    
    // Keyboard
    enterEmailAddress: 'Enter your email address',
    enterPostalCode: 'Enter your postal code (A1A format)',
    startTyping: 'Start typing...',
    
    // Payment Success
    paymentSuccessful: 'Payment Successful',
    paymentComplete: 'Payment Complete',
    
    // Completion Screen
    completionMessage: 'Please take the receipt to\nGuest Services and enjoy\nyour visit to THEMUSEUM.',
    emailBackup: 'A backup receipt has been\nsent to your email.',
    startNewPurchase: 'Start New Purchase',
    autoReturn: 'Returning to main page in {seconds}...',
    returnNow: 'Return Now',
    
    // Language
    language: 'Language',
    english: 'English',
    french: 'Français',
    
    // Auto-advance form
    nextField: 'Next →',
    continueForm: 'Continue'
  },
  fr: {
    // Landing Screen
    buyTickets: 'ACHETER BILLETS',
    singleCardPayment: 'Paiement par carte unique seulement',
    
    // Progress Steps
    selectTickets: 'Sélectionner Billets',
    yourDetails: 'Vos Détails',
    payment: 'Paiement',
    complete: 'Terminé',
    
    // Museum Header
    checkout: 'Commande',
    
    // Ticket Selection
    museumGeneralAdmission: 'THEMUSEUM Admission Générale',
    selectTicketsTitle: 'Sélectionner les Billets',
    adultGeneral: 'Admission Générale Adulte (13+)',
    childGeneral: 'Admission Générale Enfant (4-12)',
    seniorGeneral: 'Admission Générale Senior (65+)',
    studentGeneral: 'Admission Générale Étudiant',
    details: 'Détails >',
    selectAddons: 'Sélectionner Suppléments',
    donateToMuseumToday: 'Faites un don au THEMUSEUM aujourd\'hui',
    donate: 'DONNER',
    donationText1: 'Merci pour votre généreux soutien au THEMUSEUM! C\'est grâce à vous que THEMUSEUM continue de grandir, d\'inspirer et d\'éclairer.',
    donationText2: 'Les dons de 10$ ou plus sont admissibles à un reçu fiscal.',
    donationText3: 'Nom enregistré: THEMUSEUM of Hoax Transcending Objects Numéro d\'enregistrement caritatif: 80709586001',
    donation10: 'Don de 10,00$',
    donation15: 'Don de 15,00$',
    donation25: 'Don de 25,00$',
    fieldTripDonation: 'Faites un don pour soutenir une sortie éducative pour toute une classe!',
    donationAddOn: 'SUPPLÉMENT DE DON',
    donationDescription: 'Merci pour votre généreux soutien au THEMUSEUM! C\'est grâce à vous que THEMUSEUM continue d\'émerveiller, d\'inspirer et d\'éclairer.',
    donationTaxInfo: 'Les dons de 20$ ou plus sont admissibles à un reçu fiscal !!!',
    cartTotal: 'Total du panier',
    continueShopping: 'Continuer les Achats',
    checkoutButton: 'Commander',
    yourCart: 'Votre Panier',
    item: 'ARTICLE',
    items: 'ARTICLES',
    noItems: 'AUCUN ARTICLE',
    cartEmpty: 'Votre panier est vide',
    selectTicketsToStart: 'Sélectionnez des billets pour commencer',
    edit: 'Modifier',
    subtotal: 'Sous-total',
    selectedTax: 'Taxe sélectionnée',
    serviceFee: 'Frais de service',
    totalIncTax: 'Total (taxes incl.)',
    
    // Navigation
    backToMain: '← Écran Principal',
    backToCheckout: '← Commande',
    backToDetails: '← Détails',
    
    // Details Screen
    yourDetailsTitle: 'Vos Détails',
    yourDetailsSubtitle: 'Veuillez entrer vos détails avant de commander.',
    firstName: 'Prénom*',
    firstNamePlaceholder: 'Entrez votre prénom',
    lastName: 'Nom de famille*',
    lastNamePlaceholder: 'Entrez votre nom de famille',
    emailAddress: 'Adresse courriel*',
    emailPlaceholder: 'Entrez votre adresse courriel',
    postalCodeLabel: 'Code postal* (3 premiers chiffres - format A1A)',
    postalCodePlaceholder: 'A1A',
    email: 'Adresse courriel',
    phoneNumber: 'Numéro de téléphone',
    postalCode: 'Code postal',
    newsletter: 'M\'envoyer des bulletins et mises à jour',
    continueButton: 'Continuer',
    
    // Missing translations
    ticketDescription: 'Achetez des billets pour l\'admission générale au THEMUSEUM. Sélectionnez vos billets et options ci-dessous.',
    processing: 'En cours de traitement...',
    retry: 'Réessayer',
    securingPurchase: 'Sécurisation de l\'achat...',
    
    // Checkout Screen
    cardPayment: 'Paiement par carte:',
    pinPadInstructions: 'Veuillez suivre les instructions\nsur le terminal de NIP',
    processingPayment: 'Traitement du paiement...',
    sendReceipt: 'Envoyer Reçu',
    sending: 'Envoi...',
    emailSent: '✓ Courriel Envoyé',
    cardReader: 'Lecteur de Carte',
    startOver: 'RECOMMENCER',
    
    // Keyboard
    enterEmailAddress: 'Entrez votre adresse courriel',
    enterPostalCode: 'Entrez votre code postal (format A1A)',
    startTyping: 'Commencez à taper...',
    
    // Payment Success
    paymentSuccessful: 'Paiement Réussi',
    paymentComplete: 'Paiement Terminé',
    
    // Completion Screen
    completionMessage: 'Veuillez apporter le reçu au\nService à la clientèle et profitez\nde votre visite au THEMUSEUM.',
    emailBackup: 'Un reçu de sauvegarde a été\nenvoyé à votre courriel.',
    startNewPurchase: 'Nouvel Achat',
    autoReturn: 'Retour à la page principale dans {seconds}...',
    returnNow: 'Retourner Maintenant',
    
    // Language
    language: 'Langue',
    english: 'English',
    french: 'Français',
    
    // Auto-advance form
    nextField: 'Suivant →',
    continueForm: 'Continuer'
  }
};

interface LanguageProviderProps {
  children: ReactNode;
}

export const LanguageProvider: React.FC<LanguageProviderProps> = ({ children }) => {
  const [language, setLanguage] = useState<Language>('en');

  const t = (key: string): string => {
    return translations[language][key as keyof typeof translations['en']] || key;
  };

  return (
    <LanguageContext.Provider value={{ language, setLanguage, t }}>
      {children}
    </LanguageContext.Provider>
  );
};