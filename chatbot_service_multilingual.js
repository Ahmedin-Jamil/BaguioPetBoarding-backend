/**
 * Multilingual Chatbot Service
 * Handles chatbot queries in multiple languages
 */

const chatbot = require('./chatbot');

// Simple translations for common responses
const translations = {
  // Filipino (Tagalog) translations
  tl: {
    greeting: 'Kumusta! Ako ang virtual assistant ng Baguio Pet Boarding. Paano kita matutulungan ngayon?',
    notUnderstood: 'Paumanhin, hindi ko naintindihan ang iyong tanong. Maaari mo bang ipaliwanag ulit?',
    fallback: 'Paumanhin, nagkakaproblema ako sa pagkonekta sa aking knowledge base ngayon. Pakisubukang muli mamaya o direktang makipag-ugnayan sa aming staff para sa tulong.',
    hours: 'Ang aming oras ng operasyon ay mula 8:00 AM hanggang 6:00 PM, Lunes hanggang Sabado, at 9:00 AM hanggang 5:00 PM tuwing Linggo.',
    location: 'Matatagpuan kami sa 123 Session Road, Baguio City. Malapit sa Burnham Park.',
    contactInfo: 'Maaari mo kaming tawagan sa 074-123-4567 o mag-email sa info@baguiopetboarding.com',
    bookingInfo: 'Para sa mga reservation, maaaring tumawag sa aming hotline, mag-email, o gumamit ng online booking form sa aming website.',
  },
  // English translations (defaults)
  en: {
    greeting: 'Hello! I\'m the virtual assistant for Baguio Pet Boarding. How can I help you today?',
    notUnderstood: 'I\'m sorry, I didn\'t understand your question. Could you please rephrase?',
    fallback: 'I\'m having trouble connecting to my knowledge base right now. Please try again later or contact our staff directly for assistance.',
    hours: 'Our operating hours are 8:00 AM to 6:00 PM, Monday to Saturday, and 9:00 AM to 5:00 PM on Sundays.',
    location: 'We are located at 123 Session Road, Baguio City. Near Burnham Park.',
    contactInfo: 'You can reach us at 074-123-4567 or email us at info@baguiopetboarding.com',
    bookingInfo: 'For reservations, you can call our hotline, send an email, or use the online booking form on our website.',
  }
};

// Process multilingual queries
async function processQuery(query, language = 'en') {
  try {
    // Default to English if language not supported
    if (!translations[language]) {
      language = 'en';
    }
    
    // Convert query to lowercase for easier matching
    const lowerQuery = query.toLowerCase();
    
    // Simple pattern matching based on the selected language
    // Greeting patterns
    if (lowerQuery.includes('hello') || lowerQuery.includes('hi') || 
        lowerQuery.includes('kumusta') || lowerQuery.includes('kamusta')) {
      return { answer: translations[language].greeting, sources: [] };
    }
    
    // Hours of operation
    if (lowerQuery.includes('hour') || lowerQuery.includes('oras') ||
        lowerQuery.includes('open') || lowerQuery.includes('bukas')) {
      return { answer: translations[language].hours, sources: [] };
    }
    
    // Location
    if (lowerQuery.includes('location') || lowerQuery.includes('address') ||
        lowerQuery.includes('lugar') || lowerQuery.includes('lokasyon') ||
        lowerQuery.includes('where') || lowerQuery.includes('saan')) {
      return { answer: translations[language].location, sources: [] };
    }
    
    // Contact information
    if (lowerQuery.includes('contact') || lowerQuery.includes('phone') ||
        lowerQuery.includes('email') || lowerQuery.includes('tawag') ||
        lowerQuery.includes('telepono') || lowerQuery.includes('tumawag')) {
      return { answer: translations[language].contactInfo, sources: [] };
    }
    
    // Booking information
    if (lowerQuery.includes('book') || lowerQuery.includes('reserv') ||
        lowerQuery.includes('appoint') || lowerQuery.includes('schedule') ||
        lowerQuery.includes('reserba') || lowerQuery.includes('magpareserba')) {
      return { answer: translations[language].bookingInfo, sources: [] };
    }
    
    // If no specific pattern matched, fall back to the regular chatbot
    // The regular chatbot only understands English, so for non-English queries
    // we should return a polite message about not understanding
    if (language !== 'en') {
      return { answer: translations[language].notUnderstood, sources: [] };
    }
    
    // For English queries, use the regular chatbot logic
    return chatbot.processQuery(query);
  } catch (error) {
    console.error('Error processing multilingual query:', error);
    return {
      answer: translations[language]?.fallback || translations.en.fallback,
      sources: []
    };
  }
}

module.exports = {
  processQuery
};
