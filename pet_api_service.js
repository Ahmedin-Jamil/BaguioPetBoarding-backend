const axios = require('axios');
require('dotenv').config();

/**
 * Service to interact with external pet APIs for dog and cat breed information
 * This service provides methods to fetch pet-related data from external APIs
 */
class PetApiService {
  constructor() {
    // Initialize API keys with validation
    this.dogApiKey = process.env.DOG_API_KEY;
    this.catApiKey = process.env.CAT_API_KEY;
    
    // Log warning if API keys are missing
    if (!this.dogApiKey) {
      console.warn('Warning: DOG_API_KEY is not set in environment variables. Using fallback data.');
    }
    if (!this.catApiKey) {
      console.warn('Warning: CAT_API_KEY is not set in environment variables. Using fallback data.');
    }
    
    // Cache for API responses to reduce external API calls
    this.cache = {
      dogBreeds: null,
      catBreeds: null,
      lastFetched: {
        dogBreeds: null,
        catBreeds: null
      }
    };
    
    // Cache expiration time (24 hours)
    this.cacheExpirationMs = 24 * 60 * 60 * 1000;
  }

  /**
   * Check if cache is valid for a specific data type
   * @param {string} dataType - Type of data to check cache for
   * @returns {boolean} - Whether cache is valid
   */
  isCacheValid(dataType) {
    const lastFetched = this.cache.lastFetched[dataType];
    if (!lastFetched) return false;
    
    const now = new Date().getTime();
    return (now - lastFetched) < this.cacheExpirationMs;
  }

  /**
   * Get dog breeds from The Dog API
   * @returns {Promise<Array>} - List of dog breeds
   */
  async getDogBreeds() {
    // Return from cache if valid
    if (this.isCacheValid('dogBreeds') && this.cache.dogBreeds) {
      console.log('Returning dog breeds from cache');
      return this.cache.dogBreeds;
    }
    
    try {
      // Fallback to hardcoded data if API key is not available
      if (!this.dogApiKey) {
        console.log('Using fallback dog breed data (API key not available)');
        return this.getFallbackDogBreeds();
      }
      
      const response = await axios.get('https://api.thedogapi.com/v1/breeds', {
        headers: { 'x-api-key': this.dogApiKey }
      });
      
      // Process and cache the response
      const breeds = response.data.map(breed => ({
        id: breed.id,
        name: breed.name,
        temperament: breed.temperament,
        lifeSpan: breed.life_span,
        breedGroup: breed.breed_group,
        origin: breed.origin,
        image: breed.image?.url
      }));
      
      // Update cache
      this.cache.dogBreeds = breeds;
      this.cache.lastFetched.dogBreeds = new Date().getTime();
      
      return breeds;
    } catch (error) {
      console.error('Error fetching dog breeds from API:', error.message);
      // Fallback to hardcoded data on error
      return this.getFallbackDogBreeds();
    }
  }

  /**
   * Get cat breeds from The Cat API
   * @param {string} query - Optional search query
   * @returns {Promise<Array>} - List of cat breeds
   */
  async getCatBreeds(query = '') {
    // Return from cache if valid and no query is provided
    if (!query && this.isCacheValid('catBreeds') && this.cache.catBreeds) {
      console.log('Returning cat breeds from cache');
      return this.cache.catBreeds;
    }
    
    try {
      // Fallback to hardcoded data if API key is not available
      if (!this.catApiKey) {
        console.log('Using fallback cat breed data (API key not available)');
        return this.getFallbackCatBreeds();
      }
      
      const response = await axios.get('https://api.thecatapi.com/v1/breeds', {
        headers: { 'x-api-key': this.catApiKey }
      });
      
      // Process the response
      let breeds = response.data.map(breed => ({
        id: breed.id,
        name: breed.name,
        temperament: breed.temperament,
        lifeSpan: breed.life_span,
        origin: breed.origin,
        description: breed.description,
        image: breed.image?.url
      }));
      
      // Filter by query if provided
      if (query) {
        const lowerQuery = query.toLowerCase();
        breeds = breeds.filter(breed => 
          breed.name.toLowerCase().includes(lowerQuery) ||
          (breed.temperament && breed.temperament.toLowerCase().includes(lowerQuery))
        );
      }
      
      // Only cache if no query was provided
      if (!query) {
        this.cache.catBreeds = breeds;
        this.cache.lastFetched.catBreeds = new Date().getTime();
      }
      
      return breeds;
    } catch (error) {
      console.error('Error fetching cat breeds from API:', error.message);
      // Fallback to hardcoded data on error
      return this.getFallbackCatBreeds();
    }
  }

  /**
   * Get pet care tips based on pet type
   * @param {string} petType - Type of pet (dog, cat, etc.)
   * @returns {Promise<Object>} - Pet care tips
   */
  async getPetCareTips(petType) {
    // Normalize pet type
    const type = petType.toLowerCase();
    
    // Return appropriate care tips based on pet type
    if (type === 'dog' || type.includes('dog')) {
      return this.getDogCareTips();
    } else if (type === 'cat' || type.includes('cat')) {
      return this.getCatCareTips();
    } else {
      return {
        title: 'General Pet Care Tips',
        tips: [
          'Provide fresh water daily',
          'Feed a balanced diet appropriate for your pet',
          'Schedule regular veterinary check-ups',
          'Ensure your pet gets appropriate exercise',
          'Create a safe, comfortable living environment'
        ]
      };
    }
  }

  /**
   * Get boarding information
   * @returns {Object} - Boarding information
   */
  getBoardingInfo() {
    return {
      title: 'Boarding Information',
      description: 'We provide comfortable accommodations for your pets while you\'re away.',
      options: [
        {
          name: 'Standard Suite',
          description: 'Comfortable space with bedding, food/water bowls, and daily walks.',
          priceRange: '$35-45 per night depending on pet size'
        },
        {
          name: 'Deluxe Suite',
          description: 'Larger space with premium bedding, toys, more frequent walks, and playtime.',
          priceRange: '$50-65 per night depending on pet size'
        },
        {
          name: 'Premium Suite',
          description: 'Luxury accommodation with private space, premium bedding, toys, frequent walks, playtime, and extra attention.',
          priceRange: '$75-90 per night depending on pet size'
        }
      ],
      requirements: [
        'Up-to-date vaccinations (rabies, DHPP for dogs; FVRCP for cats)',
        'Flea and tick prevention',
        'Pets must be in good health',
        'Behavioral assessment for first-time boarders'
      ]
    };
  }

  /**
   * Get grooming information
   * @returns {Object} - Grooming information
   */
  getGroomingInfo() {
    return {
      title: 'Grooming Services',
      description: 'Professional grooming services to keep your pet clean and healthy.',
      services: [
        {
          name: 'Basic Bath',
          description: 'Shampoo, conditioner, blow dry, ear cleaning, nail trim',
          priceRange: '$30-50 depending on pet size and coat type'
        },
        {
          name: 'Full Grooming',
          description: 'Bath, haircut, style, ear cleaning, nail trim, anal gland expression',
          priceRange: '$50-80 depending on pet size and coat type'
        },
        {
          name: 'Specialty Grooming',
          description: 'Specialized services for breeds with specific grooming needs',
          priceRange: '$70-100 depending on breed and requirements'
        },
        {
          name: 'À La Carte Services',
          description: 'Individual services like nail trimming, ear cleaning, teeth brushing',
          priceRange: '$10-25 per service'
        }
      ]
    };
  }

  /**
   * Fallback method for dog breeds when API is unavailable
   * @returns {Array} - List of common dog breeds
   */
  getFallbackDogBreeds() {
    return [
      {
        id: 1,
        name: 'Labrador Retriever',
        temperament: 'Friendly, Active, Outgoing, Even Tempered, Intelligent',
        lifeSpan: '10 - 13 years',
        breedGroup: 'Sporting',
        origin: 'Canada, USA'
      },
      {
        id: 2,
        name: 'German Shepherd',
        temperament: 'Alert, Loyal, Obedient, Intelligent, Confident, Courageous',
        lifeSpan: '10 - 13 years',
        breedGroup: 'Herding',
        origin: 'Germany'
      },
      {
        id: 3,
        name: 'Golden Retriever',
        temperament: 'Intelligent, Friendly, Reliable, Kind, Trustworthy, Confident',
        lifeSpan: '10 - 12 years',
        breedGroup: 'Sporting',
        origin: 'United Kingdom, Scotland'
      },
      {
        id: 4,
        name: 'Beagle',
        temperament: 'Amiable, Even Tempered, Excitable, Determined, Gentle, Intelligent',
        lifeSpan: '13 - 16 years',
        breedGroup: 'Hound',
        origin: 'United Kingdom, England'
      },
      {
        id: 5,
        name: 'Poodle',
        temperament: 'Alert, Intelligent, Faithful, Trainable, Instinctual',
        lifeSpan: '12 - 15 years',
        breedGroup: 'Non-Sporting',
        origin: 'Germany, France'
      }
    ];
  }

  /**
   * Fallback method for cat breeds when API is unavailable
   * @returns {Array} - List of common cat breeds
   */
  getFallbackCatBreeds() {
    return [
      {
        id: 1,
        name: 'Siamese',
        temperament: 'Active, Agile, Clever, Sociable, Loving, Energetic',
        lifeSpan: '12 - 15 years',
        origin: 'Thailand',
        description: 'The Siamese is one of the oldest breeds of domestic cat.'
      },
      {
        id: 2,
        name: 'Persian',
        temperament: 'Affectionate, Quiet, Sweet, Gentle',
        lifeSpan: '14 - 15 years',
        origin: 'Iran (Persia)',
        description: 'Persians are known for their long, luxurious coats and sweet personalities.'
      },
      {
        id: 3,
        name: 'Maine Coon',
        temperament: 'Adaptable, Intelligent, Loving, Gentle, Independent',
        lifeSpan: '12 - 15 years',
        origin: 'United States',
        description: 'The Maine Coon is one of the largest domesticated breeds of cat.'
      },
      {
        id: 4,
        name: 'Ragdoll',
        temperament: 'Gentle, Quiet, Docile, Relaxed, Patient, Easygoing',
        lifeSpan: '12 - 17 years',
        origin: 'United States',
        description: 'Ragdolls are known for their docile and placid temperament and affectionate nature.'
      },
      {
        id: 5,
        name: 'Bengal',
        temperament: 'Alert, Agile, Energetic, Demanding, Intelligent',
        lifeSpan: '12 - 16 years',
        origin: 'United States',
        description: 'Bengals are a hybrid breed of domestic cat and Asian leopard cat.'
      }
    ];
  }

  /**
   * Get dog care tips
   * @returns {Object} - Dog care tips
   */
  getDogCareTips() {
    return {
      title: 'Dog Care Tips',
      tips: [
        'Feed a high-quality dog food appropriate for your dog\'s age, size, and activity level',
        'Provide fresh water at all times',
        'Ensure regular exercise with daily walks and playtime',
        'Schedule regular veterinary check-ups and keep vaccinations current',
        'Maintain dental hygiene with regular teeth brushing or dental chews',
        'Groom regularly, including brushing, bathing, nail trimming, and ear cleaning',
        'Provide mental stimulation with toys and training',
        'Socialize your dog with other dogs and people',
        'Use preventative treatments for fleas, ticks, and heartworm',
        'Create a safe, comfortable living environment with appropriate bedding'
      ]
    };
  }

  /**
   * Get cat care tips
   * @returns {Object} - Cat care tips
   */
  getCatCareTips() {
    return {
      title: 'Cat Care Tips',
      tips: [
        'Feed a balanced, high-quality cat food appropriate for your cat\'s age and health needs',
        'Provide fresh water daily in a clean bowl',
        'Keep the litter box clean and in a quiet, accessible location',
        'Schedule regular veterinary check-ups and keep vaccinations current',
        'Provide scratching posts to maintain claw health and protect furniture',
        'Brush your cat regularly to reduce hairballs and maintain coat health',
        'Provide mental stimulation with toys and play sessions',
        'Create vertical spaces for climbing and perching',
        'Use preventative treatments for fleas and other parasites',
        'Keep indoor cats entertained with window views and interactive toys'
      ]
    };
  }
}

module.exports = new PetApiService();