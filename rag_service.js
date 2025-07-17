const express = require('express');
const fs = require('fs');
const path = require('path');
const { OpenAI } = require('openai');
// Import document loaders
const { DirectoryLoader } = require('langchain/document_loaders/directory');
const { TextLoader } = require('langchain/document_loaders/text');
const { JSONLoader } = require('langchain/document_loaders/json');
const { RecursiveCharacterTextSplitter } = require('langchain/text_splitter');
const { OpenAIEmbeddings } = require('langchain/embeddings/openai');
const { MemoryVectorStore } = require('langchain/vectorstores/memory');

// Import pet API service
const petApiService = require('./pet_api_service');

// Initialize router
const router = express.Router();

// Initialize OpenAI client
const openai = new OpenAI({
  apiKey: process.env.OPENAI_API_KEY, // Use environment variable for API key
});

// Path to knowledge base directory
const KNOWLEDGE_BASE_DIR = path.join(__dirname, '..', 'pet-hotel', 'src', 'data', 'knowledge_base');

// In-memory vector store
let vectorStore = null;

// Function to load and process documents
async function loadDocuments() {
  try {
    console.log('Loading documents from:', KNOWLEDGE_BASE_DIR);
    
    // Create a directory loader with specific file types
    const loader = new DirectoryLoader(KNOWLEDGE_BASE_DIR, {
      '.json': (path) => new JSONLoader(path),
      '.txt': (path) => new TextLoader(path),
    });
    
    // Load documents
    const docs = await loader.load();
    console.log(`Loaded ${docs.length} documents`);
    
    // Split documents into chunks
    const textSplitter = new RecursiveCharacterTextSplitter({
      chunkSize: 1000,
      chunkOverlap: 200,
    });
    
    const splitDocs = await textSplitter.splitDocuments(docs);
    console.log(`Split into ${splitDocs.length} chunks`);
    
    // Create vector store from documents
    const embeddings = new OpenAIEmbeddings({
      openAIApiKey: process.env.OPENAI_API_KEY, // Use environment variable for API key
    });
    
    vectorStore = await MemoryVectorStore.fromDocuments(splitDocs, embeddings);
    console.log('Vector store created successfully');
    
    return true;
  } catch (error) {
    console.error('Error loading documents:', error);
    return false;
  }
}

// Initialize the vector store on startup
loadDocuments().then((success) => {
  if (success) {
    console.log('RAG system initialized successfully');
  } else {
    console.error('Failed to initialize RAG system');
  }
});

// Endpoint to query the RAG system
router.post('/query', async (req, res) => {
  try {
    const { query } = req.body;
    
    if (!query) {
      return res.status(400).json({ error: 'Query is required' });
    }
    
    // Analyze the query to determine if it's related to pet breeds, care tips, or general boarding/grooming info
    const isPetBreedQuery = /breed|dog breed|cat breed|type of (dog|cat)/i.test(query);
    const isPetCareQuery = /care|tip|advice|how to|maintain/i.test(query);
    const isBoardingQuery = /board|stay|overnight|accommodation|room|suite|deluxe/i.test(query);
    const isGroomingQuery = /groom|haircut|bath|nail|trim|brush/i.test(query);
    
    // Prepare API data based on query type
    let apiData = {};
    
    if (isPetBreedQuery) {
      // Determine if query is about dogs or cats
      const isDogQuery = /dog|puppy|canine/i.test(query);
      const isCatQuery = /cat|kitten|feline/i.test(query);
      
      if (isDogQuery) {
        apiData.dogBreeds = await petApiService.getDogBreeds();
      } else if (isCatQuery) {
        apiData.catBreeds = await petApiService.getCatBreeds();
      } else {
        // If not specified, get both
        apiData.dogBreeds = await petApiService.getDogBreeds();
        apiData.catBreeds = await petApiService.getCatBreeds();
      }
    }
    
    if (isPetCareQuery) {
      // Determine pet type for care tips
      const isDogQuery = /dog|puppy|canine/i.test(query);
      const isCatQuery = /cat|kitten|feline/i.test(query);
      
      if (isDogQuery) {
        apiData.careTips = await petApiService.getPetCareTips('dog');
      } else if (isCatQuery) {
        apiData.careTips = await petApiService.getPetCareTips('cat');
      } else {
        // If not specified, get dog tips by default
        apiData.careTips = await petApiService.getPetCareTips('dog');
      }
    }
    
    if (isBoardingQuery) {
      apiData.boardingInfo = petApiService.getBoardingInfo();
    }
    
    if (isGroomingQuery) {
      apiData.groomingInfo = petApiService.getGroomingInfo();
    }
    
    // Get information from knowledge base
    let context = '';
    let sources = [];
    
    if (vectorStore) {
      // Search for relevant documents
      const searchResults = await vectorStore.similaritySearch(query, 3);
      
      // Format context from search results
      context = searchResults.map(doc => doc.pageContent).join('\n\n');
      sources = searchResults.map(doc => doc.metadata.source);
    }
    
    // Format API data as additional context
    let apiContext = '';
    
    if (apiData.dogBreeds) {
      const breedSample = apiData.dogBreeds.slice(0, 5); // Limit to 5 breeds to avoid overwhelming
      apiContext += '\n\nDog Breeds Information:\n';
      breedSample.forEach(breed => {
        apiContext += `- ${breed.name}: ${breed.temperament || 'No temperament info'}\n`;
      });
    }
    
    if (apiData.catBreeds) {
      const breedSample = apiData.catBreeds.slice(0, 5); // Limit to 5 breeds
      apiContext += '\n\nCat Breeds Information:\n';
      breedSample.forEach(breed => {
        apiContext += `- ${breed.name}: ${breed.temperament || 'No temperament info'}\n`;
      });
    }
    
    if (apiData.careTips) {
      apiContext += `\n\nPet Care Tip - ${apiData.careTips.title}:\n${apiData.careTips.content}\n`;
    }
    
    if (apiData.boardingInfo) {
      apiContext += '\n\nBoarding Services Information:\n';
      apiData.boardingInfo.services.forEach(service => {
        apiContext += `- ${service.name}: ${service.description}. Price: ${service.priceRange}\n`;
      });
      
      apiContext += '\nBoarding Policies:\n';
      apiContext += `- Check-in: ${apiData.boardingInfo.policies.checkInTime}\n`;
      apiContext += `- Check-out: ${apiData.boardingInfo.policies.checkOutTime}\n`;
      apiContext += `- Vaccination: ${apiData.boardingInfo.policies.vaccinationRequirements.join(', ')}\n`;
    }
    
    if (apiData.groomingInfo) {
      apiContext += '\n\nGrooming Services Information:\n';
      apiData.groomingInfo.services.forEach(service => {
        apiContext += `- ${service.name}: ${service.description}. Price: ${service.priceRange}\n`;
      });
    }
    
    // Combine knowledge base context with API context
    const combinedContext = context + apiContext;
    
    // Generate response using OpenAI
    const completion = await openai.chat.completions.create({
      model: "gpt-3.5-turbo",
      messages: [
        { role: "system", content: `You are a helpful assistant for Baguio Pet Boarding. IMPORTANT: Keep all responses under 80 words maximum. Be concise and helpful. Answer questions based on the following information. If you don't know the answer, say you don't know and offer to connect the user with a staff member.

Context information:
${combinedContext}` },
        { role: "user", content: query }
      ],
      temperature: 0.7,
      max_tokens: 100,
    });
    
    const answer = completion.choices[0].message.content;
    
    res.json({
      answer,
      sources: sources,
    });
  } catch (error) {
    console.error('Error processing query:', error);
    res.status(500).json({ error: 'Failed to process query' });
  }
});

// Endpoint to reload the knowledge base
router.post('/reload', async (req, res) => {
  try {
    const success = await loadDocuments();
    if (success) {
      res.json({ message: 'Knowledge base reloaded successfully' });
    } else {
      res.status(500).json({ error: 'Failed to reload knowledge base' });
    }
  } catch (error) {
    console.error('Error reloading knowledge base:', error);
    res.status(500).json({ error: 'Failed to reload knowledge base' });
  }
});

module.exports = router;