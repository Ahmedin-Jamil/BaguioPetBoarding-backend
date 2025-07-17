const { GoogleGenerativeAI } = require('@google/generative-ai');
require('dotenv').config();

/**
 * Service to interact with Google's Gemini API for AI-powered features
 * This service provides methods to generate content using the Gemini model
 * Optimized for pet hotel context with rate limiting and error handling
 */
class GeminiService {
  constructor() {
    // Initialize the Google Generative AI with the API key from environment variables
    this.apiKey = process.env.GEMINI_API_KEY || process.env.API_KEY;
    
    if (!this.apiKey) {
      console.error('WARNING: API_KEY for Gemini is not set in environment variables');
      this.model = null;
      return; // Exit constructor early if API key is missing
    }
    
    // Validate API key format (basic check)
    if (!this.apiKey.startsWith('AIza')) {
      console.error('WARNING: API_KEY for Gemini appears to be invalid (does not start with AIza)');
      this.model = null;
      return; // Exit constructor if API key format is invalid
    }
    
    try {
      this.genAI = new GoogleGenerativeAI(this.apiKey);
      
      // Configure for free version with safety limits
      const safetySettings = [
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
      ];
      
      // Initialize with optimized settings for pet-related content
      this.model = this.genAI.getGenerativeModel({
        model: "gemini-2.5-flash",
        generationConfig: {
          temperature: 0.7, // Balanced between creativity and consistency
          topK: 40,
          topP: 0.95,
          maxOutputTokens: 400, // Adjusted to accommodate 80-word limit
          stopSequences: ["Human:", "Assistant:"] // Prevent model from continuing conversation
        },
        safetySettings: safetySettings
      });
      
      // Add rate limiting for free tier
      this.requestCount = 0;
      this.requestLimit = 60; // Example: 60 requests per minute for free tier
      this.requestResetTime = Date.now() + 60000; // Reset after 1 minute
      
      console.log('Gemini AI service initialized successfully (Free Version)');
    } catch (error) {
      console.error('Failed to initialize Gemini AI service:', error);
      // Don't set this.model if initialization fails
      this.model = null;
    }
  }

  /**
   * Generate content using the Gemini model
   * @param {string} prompt - The prompt to send to the model
   * @returns {Promise<Object>} - The generated content
   */
  async generateContent(prompt) {
    try {
      // Check if the model was initialized properly
      if (!this.model) {
        throw new Error('Gemini model not initialized. Please check API key configuration.');
      }
      
      // Check rate limits for free tier
      if (this.requestCount >= this.requestLimit) {
        // If we've reached the current time window's limit, check if we can reset
        if (Date.now() > this.requestResetTime) {
          this.requestCount = 0;
          this.requestResetTime = Date.now() + 60000; // Reset after 1 minute
        } else {
          // Otherwise, we've hit the rate limit
          throw new Error('Rate limit exceeded for free tier. Please try again later.');
        }
      }
      
      // Increment request counter
      this.requestCount++;
      
      // Limit prompt length to avoid characters limit for free tier
      const maxPromptLength = 4000;
      const truncatedPrompt = prompt.length > maxPromptLength ? 
        prompt.substring(0, maxPromptLength) + '...' : prompt;
      
      // Generate content based on the prompt
      const result = await this.model.generateContent(truncatedPrompt);
      const response = await result.response;
      const text = response.text();
      
      // Log success for debugging
      console.log('Successfully generated content with Gemini');
      
      return {
        text: text,
        status: 'success'
      };
    } catch (error) {
      console.error('Error generating content with Gemini:', error);
      
      // Provide more specific error messages based on error type
      let errorMessage = 'I\'m having trouble connecting to my knowledge base right now. Please try again later or contact our staff directly for assistance.';
      
      if (error.message.includes('API key')) {
        errorMessage = 'There was an issue with the AI service authentication. Please try again later or contact our staff directly for assistance.';
        console.error('API key validation error:', error.message);
      } else if (error.message.includes('network')) {
        errorMessage = 'There was a network issue connecting to the AI service. Please check your internet connection or contact our staff directly for assistance.';
        console.error('Network error connecting to Gemini API:', error.message);
      } else if (error.message.includes('timeout')) {
        errorMessage = 'The AI service took too long to respond. Please try again later or contact our staff directly for assistance.';
        console.error('Timeout error with Gemini API:', error.message);
      } else if (error.message.includes('not initialized') || error.message.includes('model not initialized')) {
        errorMessage = 'I\'m having trouble connecting to my knowledge base right now. Please try again later or contact our staff directly for assistance.';
        console.error('Gemini model initialization error:', error.message);
      } else if (error.message.includes('quota') || error.message.includes('rate limit') || error.message.includes('exceeded')) {
        errorMessage = 'You have reached the free tier usage limit for the AI service. Please try again later or consider upgrading to the paid version for higher limits.';
        console.error('Gemini API rate limit or quota exceeded:', error.message);
      }
      
      return {
        text: errorMessage,
        status: 'error',
        error: error.message
      };
    }
  }

  /**
   * Generate pet care advice using the Gemini model
   * @param {string} petType - The type of pet (dog, cat, etc.)
   * @param {string} topic - The topic to generate advice about
   * @returns {Promise<Object>} - The generated pet care advice
   */
  async generatePetCareAdvice(petType, topic) {
    const prompt = `As a pet care expert, provide detailed and practical advice for ${petType}s regarding ${topic}. 
    Focus on essential care tips, common concerns, and best practices that pet hotel staff and owners should know. 
    Include specific recommendations for daily care, health monitoring, and safety precautions.`;
    return this.generateContent(prompt);
  }

  /**
   * Generate personalized boarding recommendations
   * @param {Object} petInfo - Information about the pet
   * @returns {Promise<Object>} - Personalized boarding recommendations
   */
  async generateBoardingRecommendations(petInfo) {
    const { type, breed, age, specialNeeds, temperament = 'Not specified', dietaryRestrictions = 'None' } = petInfo;
    const prompt = `As a pet boarding specialist, provide detailed recommendations for the following pet:
      - Pet Type: ${type}
      - Breed: ${breed}
      - Age: ${age}
      - Temperament: ${temperament}
      - Special Needs: ${specialNeeds || 'None'}
      - Dietary Restrictions: ${dietaryRestrictions}
      
      Please provide comprehensive recommendations including:
      1. Ideal room type and environment setup
      2. Daily care schedule and exercise needs
      3. Specific accommodations for their breed and age
      4. Special considerations based on temperament
      5. Dietary and medication schedule if applicable
      6. Monitoring requirements and health checks
      
      Format the response in a clear, structured manner for our pet hotel staff.`;
    return this.generateContent(prompt);
  }

  /**
   * Generate a personalized daily report for a boarded pet
   * @param {Object} petInfo - Basic pet information
   * @param {Object} dailyActivities - Activities and observations from the day
   * @returns {Promise<Object>} - Generated daily report
   */
  async generateDailyReport(petInfo, dailyActivities) {
    const { type, name, breed } = petInfo;
    const { mood, appetite, activities, notes } = dailyActivities;
    
    const prompt = `Create a warm and detailed daily report for ${name}, a ${breed} ${type}:
      
      Today's Observations:
      - Mood: ${mood}
      - Appetite: ${appetite}
      - Activities: ${activities.join(', ')}
      - Special Notes: ${notes || 'None'}
      
      Please write a personalized report that includes:
      1. Overview of ${name}'s day
      2. Eating and drinking habits
      3. Activity level and exercise details
      4. Social interactions and behavior
      5. Rest periods and comfort level
      6. Any special care provided
      7. Recommendations for the owner
      
      Make the report engaging and reassuring for the pet owner while maintaining professionalism.`;
    
    return this.generateContent(prompt);
  }
}

module.exports = new GeminiService();