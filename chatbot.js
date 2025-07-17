const express = require('express');
const { GoogleGenerativeAI } = require('@google/generative-ai');
const router = express.Router();

// Initialize Gemini AI
const genAI = new GoogleGenerativeAI(process.env.GEMINI_API_KEY);

const fs = require('fs');
const path = require('path');

// Load ONLY pet_hotel.txt as the knowledge base file
const petHotelKnowledgePath = path.join(__dirname, 'knowledge_base', 'pet_hotel.txt');

function safeReadFile(filePath) {
  try {
    return fs.readFileSync(filePath, 'utf8');
  } catch (error) {
    console.warn(`Warning: Could not read knowledge base file ${filePath}:`, error.message);
    return '';
  }
}

const petHotelKnowledgeBase = safeReadFile(petHotelKnowledgePath);

// Parse Q&A pairs from pet_hotel.txt in simple format: question line, answer line(s), blank line between pairs
function parsePetHotelKnowledge(content) {
  const lines = content.split(/\r?\n/);
  const entries = [];
  let question = null;
  let answerLines = [];
  const sectionHeaderPattern = /^(About|Booking|Services|Pricing|Other|Out-of-Scope|\s).*$/i;

  console.log('Parsing pet_hotel.txt knowledge base...');
  
  for (let i = 0; i < lines.length; i++) {
    const line = lines[i].trim();
    
    // Skip empty lines
    if (!line) {
      if (question && answerLines.length) {
        const answer = answerLines.join(' ');
        console.log(`Adding Q&A pair: Q: "${question}" A: "${answer.substring(0, 50)}..."`);
        entries.push({ question, answer });
        question = null;
        answerLines = [];
      }
      continue;
    }
    
    // Skip section headers unless they're questions
    if (sectionHeaderPattern.test(line) && !line.endsWith('?')) {
      console.log(`Skipping section header: ${line}`);
      continue;
    }
    
    // If line ends with question mark, it's a question
    if (!question && line.endsWith('?')) {
      question = line;
      console.log(`Found question: ${question}`);
    } else if (question) {
      // If we have a question, this line is part of the answer
      answerLines.push(line);
    }
  }
  
  // Don't forget the last Q&A pair if there is one
  if (question && answerLines.length) {
    const answer = answerLines.join(' ');
    console.log(`Adding final Q&A pair: Q: "${question}" A: "${answer.substring(0, 50)}..."`);
    entries.push({ question, answer: answer });
  }
  
  console.log(`Successfully parsed ${entries.length} Q&A pairs from knowledge base`);
  return entries;
}

const parsedKnowledge = parsePetHotelKnowledge(petHotelKnowledgeBase);

if (!parsedKnowledge.length) {
  console.warn('Warning: No valid knowledge base content loaded from pet_hotel.txt. RAG system may not function properly.');
}

// RAG System - Enhanced retrieval with keyword matching
function retrieveRelevantInfo(query) {
  const queryLower = query.toLowerCase().trim();
  const relevantInfo = [];
  console.log(`Searching for relevant info for query: "${query}"`);

  // 1. Try exact match first (highest priority)
  const exactMatch = parsedKnowledge.find(qa =>
    qa.question.trim().toLowerCase() === queryLower
  );
  
  if (exactMatch) {
    console.log(`Found exact match for query: "${query}"`);
    console.log(`Matched question: "${exactMatch.question}"`);
    relevantInfo.push({ type: 'exact_match', data: exactMatch, relevance: 1.0 });
    return relevantInfo;
  }

  // 2. Try partial match (contains the entire query string)
  const partialMatches = parsedKnowledge.filter(qa => 
    qa.question.toLowerCase().includes(queryLower) || 
    queryLower.includes(qa.question.toLowerCase())
  );
  
  if (partialMatches.length > 0) {
    console.log(`Found ${partialMatches.length} partial matches for query: "${query}"`);
    partialMatches.forEach(match => {
      console.log(`Partial match: "${match.question}"`);
      relevantInfo.push({ 
        type: 'partial_match', 
        data: match, 
        relevance: 0.9 
      });
    });
    // If we have partial matches, return them without going to keyword matching
    if (relevantInfo.length > 0) {
      return relevantInfo.slice(0, 2);
    }
  }

  // 3. Keyword matching (lowest priority)
  // Filter out common words and require words to be at least 3 chars
  const stopWords = ['the', 'and', 'for', 'with', 'what', 'how', 'can', 'you', 'your', 'are', 'is', 'do'];
  const queryWords = queryLower
    .split(/\W+/)
    .filter(word => word.length > 2 && !stopWords.includes(word));
  
  console.log(`Using keyword matching with words: ${queryWords.join(', ')}`);
  
  parsedKnowledge.forEach(qa => {
    const questionLower = qa.question.toLowerCase();
    const answerLower = qa.answer.toLowerCase();
    
    // Count matching words and their positions
    const matchingWords = queryWords.filter(word =>
      questionLower.includes(word) || answerLower.includes(word)
    );
    
    // Calculate relevance score based on number of matching words and their importance
    if (matchingWords.length > 0) {
      // Higher weight for question matches vs answer matches
      const questionMatches = matchingWords.filter(word => questionLower.includes(word)).length;
      const answerMatches = matchingWords.filter(word => answerLower.includes(word)).length;
      
      // Calculate relevance: question matches are worth more than answer matches
      const relevance = (questionMatches * 0.7 + answerMatches * 0.3) / queryWords.length;
      
      if (relevance > 0.2) { // Only include if relevance is above threshold
        console.log(`Keyword match: "${qa.question}" with relevance ${relevance.toFixed(2)}`);
        relevantInfo.push({
          type: 'keyword_match',
          data: qa,
          relevance: relevance
        });
      }
    }
  });
  
  // Sort by relevance and return top matches
  const sortedResults = relevantInfo.sort((a, b) => b.relevance - a.relevance).slice(0, 2);
  console.log(`Found ${sortedResults.length} relevant matches after all matching methods`);
  return sortedResults;
}

// Generate context from retrieved information with creative prompting
function generateContext(relevantInfo) {
  if (relevantInfo.length === 0) {
    return `You are a friendly pet care assistant for Baguio Pet Boarding. While you don't have specific information about this query, you can politely guide the conversation back to our services. Feel free to be creative but ensure any specific details about our services come from the knowledge base.`;
  }

  let context = 'You are a friendly and enthusiastic pet care assistant for Baguio Pet Boarding. Use this information to provide a warm, detailed response. Feel free to elaborate and add friendly touches, but ensure all specific details about our services are accurate:\n\n';

  relevantInfo.forEach(info => {
    context += `${info.data.question}\n${info.data.answer}\n\n`;
  });

  context += '\nRemember to:\n';
  context += '1. Be warm and friendly in your response\n';
  context += '2. You can elaborate and add context, but keep service details accurate\n';
  context += '3. If unsure about specific details, stick to the provided information\n';
  context += '4. Encourage follow-up questions about our services';

  return context;
}

// Conversation memory (in production, use a database)
const conversationMemory = new Map();

// Chat endpoint
router.post('/chat', async (req, res) => {
  try {
    const { message, sessionId = 'default' } = req.body;

    if (!message) {
      return res.status(400).json({ error: 'Message is required' });
    }

    // Initialize or get conversation history
    if (!conversationMemory.has(sessionId)) {
      conversationMemory.set(sessionId, []);
    }
    const history = conversationMemory.get(sessionId);

    // Retrieve relevant information using RAG
    const relevantInfo = retrieveRelevantInfo(message);
    const context = generateContext(relevantInfo);

    // Prepare the model with error handling
    let model;
    try {
      model = genAI.getGenerativeModel({
        model: 'gemini-2.5-flash',
        generationConfig: {
          temperature: 0.7,
          topK: 40,
          topP: 0.95,
          maxOutputTokens: 400,
          stopSequences: ["Human:", "Assistant:"]
        },
        safetySettings: [
          {
            category: 'HARM_CATEGORY_HARASSMENT',
            threshold: 'BLOCK_MEDIUM_AND_ABOVE'
          },
          {
            category: 'HARM_CATEGORY_HATE_SPEECH',
            threshold: 'BLOCK_MEDIUM_AND_ABOVE'
          },
          {
            category: 'HARM_CATEGORY_SEXUALLY_EXPLICIT',
            threshold: 'BLOCK_MEDIUM_AND_ABOVE'
          },
          {
            category: 'HARM_CATEGORY_DANGEROUS_CONTENT',
            threshold: 'BLOCK_MEDIUM_AND_ABOVE'
          }
        ]
      });
      console.log('Chatbot initialized with gemini-2.5-flash model');
    } catch (modelError) {
      console.error('Error initializing Gemini model:', modelError);
      throw new Error('Failed to initialize AI model');
    }

    // Build conversation context
    let conversationContext = context + "\n\nConversation history:\n";
    
    // Add recent conversation history (last 5 messages for better context)
    const recentHistory = history.slice(-5);
    recentHistory.forEach(msg => {
      conversationContext += `${msg.role}: ${msg.content}\n`;
    });

    conversationContext += `\nUser: ${message}\nAssistant:`;

    // Generate response with better error handling
    let result;
    try {
      result = await model.generateContent(conversationContext);
    } catch (generationError) {
      console.error('Error generating content:', generationError);
      throw new Error('Failed to generate response');
    }

    if (!result || !result.response) {
      throw new Error('Invalid response from AI model');
    }
    
    const response = result.response;
    let botMessage = response.text();
    
    if (!botMessage || typeof botMessage !== 'string') {
      throw new Error('Invalid message format from AI model');
    }

    // Ensure the message is not empty or too short
    if (botMessage.trim().length < 5) {
      botMessage = "I apologize, but I'm having trouble understanding. Could you please rephrase your question?";
    }
    
    // Enforce 80-word limit
    const words = botMessage.split(/\s+/);
    if (words.length > 80) {
      botMessage = words.slice(0, 80).join(' ');
      // Add ellipsis if truncated and not ending with punctuation
      if (!botMessage.match(/[.!?]$/)) {
        botMessage += '...';
      }
    }

    // Store conversation in memory
    history.push({ role: 'user', content: message, timestamp: new Date() });
    history.push({ role: 'assistant', content: botMessage, timestamp: new Date() });

    // Keep only last 10 messages to prevent memory issues
    if (history.length > 10) {
      history.splice(0, history.length - 10);
    }

    // Update conversation memory
    conversationMemory.set(sessionId, history);

    return res.json({
      message: botMessage,
      sessionId: sessionId,
      relevantInfo: relevantInfo.length > 0 ? relevantInfo.map(info => info.type) : null
    });

  } catch (error) {
    console.error('Chatbot error:', error);
    return res.status(500).json({
      error: 'An error occurred while processing your message',
      message: "I'm sorry, I'm having trouble responding right now. Please try again in a moment."
    });
  }
});

// Get conversation history
router.get('/history/:sessionId', (req, res) => {
  const { sessionId } = req.params;
  const history = conversationMemory.get(sessionId) || [];
  res.json({ history });
});

// Clear conversation history
router.delete('/history/:sessionId', (req, res) => {
  const { sessionId } = req.params;
  conversationMemory.delete(sessionId);
});

// Health check
router.get('/health', (req, res) => {
res.json({ status: 'OK', service: 'Pet Booking Chatbot' });
});

// Process a query and return a response from the knowledge base
async function processQuery(query, sessionId = null) {
  console.log(`Processing query: "${query}" with session ID: ${sessionId || 'none'}`);
  
  try {
    // Ensure knowledge base is loaded
    if (!parsedKnowledge || parsedKnowledge.length === 0) {
      await loadKnowledgeBase();
    }
    
    // Find relevant information from the knowledge base
    const relevantInfo = retrieveRelevantInfo(query);
    console.log(`Found ${relevantInfo.length} relevant information items`);
    
    // If we have a direct match, return it immediately
    const exactMatch = relevantInfo.find(info => info.type === 'exact_match');
    if (exactMatch) {
      console.log('Returning exact match from knowledge base');
      return {
        answer: exactMatch.data.answer,
        success: true,
        matchType: 'exact',
        relevantInfo: [{ question: exactMatch.data.question }]
      };
    }
    
    // If we have partial matches, use the best one
    const partialMatch = relevantInfo.find(info => info.type === 'partial_match');
    if (partialMatch) {
      console.log('Returning partial match from knowledge base');
      return {
        answer: partialMatch.data.answer,
        success: true,
        matchType: 'partial',
        relevantInfo: [{ question: partialMatch.data.question }]
      };
    }
    
    // If we have keyword matches, use the best one
    if (relevantInfo.length > 0) {
      const bestMatch = relevantInfo[0];
      console.log(`Returning best keyword match with relevance ${bestMatch.relevance}`);
      return {
        answer: bestMatch.data.answer,
        success: true,
        matchType: 'keyword',
        relevance: bestMatch.relevance,
        relevantInfo: [{ question: bestMatch.data.question }]
      };
    }
    
    // If no matches found, return a polite fallback message
    console.log('No matches found in knowledge base');
    return {
      answer: "I don't have specific information about that in my knowledge base. Please ask about our pet boarding, grooming, or daycare services, or contact our staff directly for more assistance.",
      success: false,
      matchType: 'none'
    };
  } catch (error) {
    console.error('Error processing query:', error);
    return {
      answer: "I'm having trouble accessing my knowledge base right now. Please try again later or contact our staff directly.",
      success: false,
      error: error.message
    };
  }
}

// Export the router and processQuery function
module.exports = {
  router,
  processQuery
};