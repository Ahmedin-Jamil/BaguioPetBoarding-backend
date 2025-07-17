const fs = require('fs');
const path = require('path');

/**
 * Service to handle chatbot queries related to pet boarding and services
 * using only the knowledge base content with structured prompt engineering
 */
class ChatbotService {
  constructor() {
    this.knowledgeBasePath = path.join(__dirname, 'knowledge_base', 'pet_hotel.txt');
    this.knowledgeBase = this.loadKnowledgeBase();
    this.maxResponseLength = 280; // Approximate character limit (increased for 80 words)
    this.maxWords = 80; // Maximum number of words count for responses
    
    // Define the chatbot persona
    this.persona = {
      name: 'Pet Care Assistant',
      role: 'Pet boarding facility assistant',
      expertise: ['pet care', 'boarding services', 'grooming'],
      tone: 'brief, helpful, direct'
    };
    
    // Define response formats
    this.responseFormats = {
      services: 'Bullet list',
      pricing: 'Short price list',
      process: 'Brief steps',
      generalInfo: 'One sentence summary',
      greeting: 'Brief greeting'
    };
  }

  loadKnowledgeBase() {
    try {
      const content = fs.readFileSync(this.knowledgeBasePath, 'utf8');
      
      // Extract FAQ section
      const faqSection = content.split('### FAQ')[1] || '';
      const faqEntries = [];
      
      // Parse Q&A pairs
      const qaPattern = /\*\*Q: ([^*]+?)\*\*\s*\nA: ([^*]+?)(?=\n\n\*\*Q:|$)/gs;
      let match;
      while ((match = qaPattern.exec(faqSection)) !== null) {
        const question = match[1].trim();
        const answer = match[2].trim();
        faqEntries.push({
          intent: 'FAQ',
          questions: [question],
          answer: answer
        });
      }
      
      // Extract sections like Services, Boarding Options, etc.
      const sections = content.match(/### ([^\n]+)[\s\S]*?(?=### |$)/g) || [];
      
      // Parse each section
      const knowledgeEntries = sections.map(section => {
        const titleMatch = section.match(/### ([^\n]+)/);
        if (!titleMatch) return null;
        
        const title = titleMatch[1].trim();
        const content = section.replace(/### [^\n]+\n/, '').trim();
        
        return {
          intent: title,
          questions: [title, `What are your ${title.toLowerCase()}?`, `Tell me about ${title.toLowerCase()}`],
          answer: content
        };
      }).filter(Boolean);
      
      return [...knowledgeEntries, ...faqEntries];
    } catch (error) {
      console.error('Error loading knowledge base:', error);
      return [];
    }
  }

  findBestMatch(query) {
    const queryLower = query.toLowerCase();
    
    // Handle basic greetings directly with persona and tone
    if (['hello', 'hi', 'hey', 'greetings', 'good day'].some(g => queryLower.includes(g))) {
      return {
        intent: 'Greeting',
        answer: "Hi! I'm your Pet Care Assistant. How can I help with our boarding or grooming services today?",
        format: this.responseFormats.greeting
      };
    }
    
    // Determine query type for appropriate formatting
    let queryType = 'generalInfo';
    if (queryLower.includes('service') || queryLower.includes('offer')) {
      queryType = 'services';
    } else if (queryLower.includes('price') || queryLower.includes('cost') || queryLower.includes('rate')) {
      queryType = 'pricing';
    } else if (queryLower.includes('how to') || queryLower.includes('process') || queryLower.includes('booking')) {
      queryType = 'process';
    }
    
    // First try to find an exact match from FAQ questions
    const exactMatch = this.knowledgeBase.find(entry => 
      entry.questions.some(q => queryLower === q.toLowerCase() || 
        queryLower.includes(q.toLowerCase()))
    );
    
    if (exactMatch) {
      return {
        ...exactMatch,
        format: this.responseFormats[queryType]
      };
    }
    
    // Check for keyword matches
    const keywords = queryLower.split(' ')
      .filter(word => word.length > 3)  // Only use significant words
      .map(word => word.toLowerCase());
    
    // Score each entry based on keyword matches
    const scoredEntries = this.knowledgeBase.map(entry => {
      let score = 0;
      
      // Check intent keywords
      if (queryLower.includes(entry.intent.toLowerCase())) {
        score += 10;  // High priority for intent matches
      }
      
      // Check question keywords
      entry.questions.forEach(question => {
        const qLower = question.toLowerCase();
        keywords.forEach(keyword => {
          if (qLower.includes(keyword)) score += 3;
        });
      });
      
      // Check answer content for keywords
      const answerLower = entry.answer.toLowerCase();
      keywords.forEach(keyword => {
        if (answerLower.includes(keyword)) score += 1;
      });
      
      return { entry, score, format: this.responseFormats[queryType] };
    });
    
    // Sort by score and return the best match if score > 0
    scoredEntries.sort((a, b) => b.score - a.score);
    if (scoredEntries[0]?.score > 0) {
      return {
        ...scoredEntries[0].entry,
        format: this.responseFormats[queryType]
      };
    }
    
    // Return null if no match
    return null;
  }

  /**
   * Format a response according to the 6-component prompt engineering framework
   * @param {string} rawResponse - The original response text
   * @param {string} format - The desired format type
   * @param {string} queryContext - The context of the user's query
   * @returns {string} - The formatted response
   */
  formatResponse(rawResponse, format, queryContext) {
    if (!rawResponse) return "No information available.";
    
    // Ultra-concise: First extract just key facts
    let response = rawResponse;
    
    // Remove all markdown formatting
    response = response.replace(/\*\*|\*/g, '');
    
    // Format based on content type
    switch(format) {
      case this.responseFormats.services:
        // Extract just service names
        const serviceMatches = response.match(/([^.\n:]+):/g) || [];
        if (serviceMatches.length > 0) {
          // Take just first 2-3 services
          const services = serviceMatches.slice(0, 3).map(s => s.trim());
          response = services.join(', ');
        } else {
          // Take first sentence only
          response = response.split('.')[0] + '.';
        }
        break;
      
      case this.responseFormats.pricing:
        // Get only price points
        const priceItems = [];
        const priceMatches = response.match(/([^\n.]+)(\₱\d+)([^\n.]*)/g);
        if (priceMatches && priceMatches.length > 0) {
          // Take maximum 3 price points
          for (let i = 0; i < Math.min(priceMatches.length, 3); i++) {
            const item = priceMatches[i].replace(/\s+/g, ' ').trim();
            priceItems.push(item);
          }
          response = priceItems.join('. ');
        } else {
          // Extract any sentence with pricing
          const priceSentence = response.split('.').find(s => s.match(/\₱\d+|\d+\s+per/));
          response = priceSentence ? priceSentence.trim() + '.' : response.split('.')[0] + '.';
        }
        break;
      
      case this.responseFormats.process:
        // Get only first 2 steps
        const processSteps = response.split('\n')
          .filter(s => s.trim().length > 0)
          .slice(0, 2);
          
        if (processSteps.length > 1) {
          response = processSteps.map(s => s.trim()).join('. ');
        } else {
          // Take first sentence only
          response = response.split('.')[0] + '.';
        }
        break;
        
      case this.responseFormats.greeting:
        // Ultra brief greeting
        response = "Hi! How can I help with our pet services?";
        break;
        
      default: // generalInfo
        // Take only first sentence
        const firstSentence = response.split('.')[0].trim();
        response = firstSentence + '.';
    }
    
    // Remove unnecessary words to make it more direct
    response = response.replace(/please|kindly|feel free to|we recommend|we suggest|typically|generally|usually/gi, '');
    response = response.replace(/\s+/g, ' ').trim(); // Clean up extra spaces
    
    // Add minimal context prefix if needed
    const contextPrefix = queryContext ? `${queryContext}: ` : '';
    response = `${contextPrefix}${response}`;
    
    // Word count check - strictly enforce 80 word limit
    let words = response.split(/\s+/);
    if (words.length > this.maxWords) {
      words = words.slice(0, this.maxWords);
      response = words.join(' ');
      
      // Add ellipsis only if truncated
      if (response.charAt(response.length - 1) !== '.') {
        response += '...';
      }
    }
    
    // Final character length check as backup
    if (response.length > this.maxResponseLength) {
      response = response.substring(0, this.maxResponseLength).trim();
      if (response.lastIndexOf(' ') > 0) {
        response = response.substring(0, response.lastIndexOf(' '));
      }
      response += '...';
    }
    
    return response;
  }

  async processQuery(query) {
    try {
      console.log('Processing query using knowledge base with prompt engineering framework...');
      
      // Extract query intent and context for better prompt construction
      const queryWords = query.toLowerCase().split(' ');
      const serviceKeywords = ['boarding', 'grooming', 'daycare', 'services', 'rooms'];
      const pricingKeywords = ['price', 'cost', 'fee', 'rates', 'pricing'];
      const bookingKeywords = ['book', 'reserve', 'appointment', 'schedule'];
      
      // Identify query context based on keywords
      let queryContext = '';
      if (serviceKeywords.some(k => queryWords.includes(k))) {
        queryContext = 'services';
      } else if (pricingKeywords.some(k => queryWords.includes(k))) {
        queryContext = 'pricing';
      } else if (bookingKeywords.some(k => queryWords.includes(k))) {
        queryContext = 'booking process';
      }
      
      // Find the best match using our knowledge base
      const match = this.findBestMatch(query);
      
      if (match) {
        // Format the response using our 6-component framework
        const formattedAnswer = this.formatResponse(
          match.answer, 
          match.format || this.responseFormats.generalInfo,
          queryContext
        );
        
        return { 
          answer: formattedAnswer, 
          success: true,
          intent: match.intent
        };
      }
      
      // If no direct match found, return a concise fallback message
      return { 
        answer: "I can help with questions about our boarding, grooming, and daycare services. What would you like to know?",
        success: true 
      };
    } catch (error) {
      console.error('Error processing query:', error);
      return { 
        answer: "I'm having trouble processing your request. Please try asking about our services or prices.",
        success: false 
      };
    }
  }
  }


module.exports = new ChatbotService();