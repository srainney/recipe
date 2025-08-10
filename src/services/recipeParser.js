import pdfjsLib from 'pdfjs-dist';
import { v4 as uuidv4 } from 'uuid';

export class RecipeParser {
  constructor() {
    // Patterns for parsing recipe components
    this.patterns = {
      title: /^(.+?)(?:\n|$)/m,
      macros: {
        calories: /(?:calories?|kcal)[:\s]*(\d+(?:\.\d+)?)/i,
        protein: /protein[:\s]*(\d+(?:\.\d+)?)\s*g/i,
        carbs: /(?:carbs?|carbohydrates?)[:\s]*(\d+(?:\.\d+)?)\s*g/i,
        fat: /fat[:\s]*(\d+(?:\.\d+)?)\s*g/i,
        fiber: /fiber[:\s]*(\d+(?:\.\d+)?)\s*g/i
      },
      ingredients: /(?:ingredients?|ingredient list)[:\s]*\n((?:.*\n?)*?)(?=(?:directions?|instructions?|method)[:\s]*|$)/im,
      directions: /(?:directions?|instructions?|method)[:\s]*\n((?:.*\n?)*?)$/im
    };
  }

  async parsePDF(buffer) {
    try {
      console.log('Parsing PDF buffer...');
      
      // Convert buffer to Uint8Array for pdfjs-dist
      const data = new Uint8Array(buffer);
      
      // Load PDF document
      const loadingTask = pdfjsLib.getDocument({ data: data });
      const pdf = await loadingTask.promise;
      
      console.log(`PDF loaded with ${pdf.numPages} pages`);
      
      const recipes = [];
      
      // Extract text from each page
      for (let pageNum = 1; pageNum <= pdf.numPages; pageNum++) {
        const page = await pdf.getPage(pageNum);
        const textContent = await page.getTextContent();
        
        // Combine text items into a single string with proper spacing
        const pageText = textContent.items
          .map(item => item.str)
          .join(' ')
          .replace(/\s+/g, ' ') // Normalize whitespace
          .trim();
        
        if (pageText.length > 50) {
          const recipe = this.parseRecipe(pageText, pageNum);
          if (recipe && recipe.title) {
            recipes.push(recipe);
          }
        }
      }
      
      console.log(`Parsed ${recipes.length} valid recipes`);
      return recipes;
    } catch (error) {
      console.error('Error parsing PDF:', error);
      throw new Error(`Failed to parse PDF: ${error.message}`);
    }
  }

  parseRecipe(pageText, pageNumber) {
    try {
      console.log(`Processing page ${pageNumber}, text length: ${pageText.length}`);
      console.log(`Page ${pageNumber} text preview:`, pageText.substring(0, 200) + '...');
      
      const recipe = {
        id: uuidv4(),
        pageNumber: pageNumber,
        title: this.extractTitle(pageText),
        macros: this.extractMacros(pageText),
        ingredients: this.extractIngredients(pageText),
        directions: this.extractDirections(pageText),
        originalText: pageText.trim()
      };

      console.log(`Page ${pageNumber} extracted:`, {
        title: recipe.title,
        macrosCount: Object.keys(recipe.macros).length,
        ingredientsCount: recipe.ingredients.length,
        directionsCount: recipe.directions.length
      });

      // More flexible validation - require either title OR ingredients
      if (!recipe.title && recipe.ingredients.length === 0) {
        console.warn(`Page ${pageNumber}: No title or ingredients found`);
        return null;
      }

      // If no title, create one from page number
      if (!recipe.title) {
        recipe.title = `Recipe from Page ${pageNumber}`;
      }

      // If no ingredients but has other content, try alternative extraction
      if (recipe.ingredients.length === 0 && pageText.length > 100) {
        recipe.ingredients = this.extractIngredientsAlternative(pageText);
        console.log(`Page ${pageNumber} alternative ingredients:`, recipe.ingredients.length);
      }

      return recipe;
    } catch (error) {
      console.error(`Error parsing recipe on page ${pageNumber}:`, error);
      return null;
    }
  }

  extractTitle(text) {
    console.log('Extracting title from text...');
    
    // Split by common delimiters that might separate text in PDFs
    const lines = text.split(/[\n\r]|(?:\s{3,})/);
    
    // Try the first non-empty line as title
    for (const line of lines) {
      const cleanLine = line.trim();
      if (cleanLine && 
          !cleanLine.toLowerCase().includes('calories') &&
          !cleanLine.toLowerCase().includes('protein') &&
          !cleanLine.toLowerCase().includes('ingredients') &&
          !cleanLine.toLowerCase().includes('directions') &&
          !cleanLine.toLowerCase().includes('instructions') &&
          cleanLine.length > 2 && 
          cleanLine.length < 100 &&
          !/^\d+/.test(cleanLine)) { // Don't start with numbers
        console.log('Found title:', cleanLine);
        return cleanLine;
      }
    }
    
    // Fallback: look for text before common recipe keywords
    const beforeIngredients = text.split(/ingredients?|ingredient list/i)[0];
    if (beforeIngredients && beforeIngredients.length < 200) {
      const words = beforeIngredients.trim().split(/\s+/);
      if (words.length > 1 && words.length < 20) {
        const title = words.join(' ').trim();
        console.log('Fallback title:', title);
        return title;
      }
    }
    
    console.log('No title found');
    return null;
  }

  extractMacros(text) {
    const macros = {};
    
    for (const [macro, pattern] of Object.entries(this.patterns.macros)) {
      const match = text.match(pattern);
      if (match) {
        macros[macro] = parseFloat(match[1]);
      }
    }
    
    return macros;
  }

  extractIngredients(text) {
    const ingredientMatch = text.match(this.patterns.ingredients);
    
    if (!ingredientMatch) {
      // Fallback: look for lines that look like ingredients
      return this.extractIngredientsFallback(text);
    }
    
    const ingredientText = ingredientMatch[1];
    const ingredients = ingredientText
      .split('\n')
      .map(line => line.trim())
      .filter(line => line.length > 0 && this.looksLikeIngredient(line))
      .map(line => this.cleanIngredient(line));
    
    return ingredients;
  }

  extractIngredientsFallback(text) {
    const lines = text.split('\n');
    const ingredients = [];
    let inIngredientsSection = false;
    
    for (const line of lines) {
      const cleanLine = line.trim();
      
      if (/^ingredients?/i.test(cleanLine)) {
        inIngredientsSection = true;
        continue;
      }
      
      if (/^(?:directions?|instructions?|method)/i.test(cleanLine)) {
        inIngredientsSection = false;
        continue;
      }
      
      if (inIngredientsSection && this.looksLikeIngredient(cleanLine)) {
        ingredients.push(this.cleanIngredient(cleanLine));
      }
    }
    
    return ingredients;
  }

  looksLikeIngredient(line) {
    if (!line || line.length < 3) return false;
    
    console.log('Checking if ingredient:', line.substring(0, 50));
    
    // Common ingredient patterns
    const ingredientPatterns = [
      /^\d+/, // Starts with number
      /\d+\s*(?:cup|cups|tbsp|tablespoons?|tsp|teaspoons?|oz|ounces?|lb|lbs|pounds?|g|grams?|kg|ml|liters?|l)\b/i, // Contains measurements
      /^\*/, // Bulleted
      /^-/, // Dashed
      /^•/, // Bullet point
      /^\d+\./, // Numbered list
      /^\w+:/, // Word followed by colon (like "Chicken:")
    ];
    
    // Check explicit patterns first
    const hasPattern = ingredientPatterns.some(pattern => pattern.test(line));
    if (hasPattern) {
      console.log('Ingredient pattern match:', line.substring(0, 30));
      return true;
    }
    
    // More flexible check for ingredient-like content
    const words = line.split(/\s+/);
    const hasCommonIngredients = /\b(?:chicken|beef|pork|fish|rice|pasta|onion|garlic|oil|butter|salt|pepper|sugar|flour|egg|milk|cheese|tomato|potato|carrot|broccoli|spinach|lettuce|bread|water|juice|wine|stock|broth)\b/i.test(line);
    
    if (hasCommonIngredients && words.length < 15) {
      console.log('Common ingredient found:', line.substring(0, 30));
      return true;
    }
    
    // Check if it's a reasonable length and has spaces (multi-word ingredient)
    const isReasonableLength = line.length >= 5 && line.length < 150;
    const hasSpaces = line.includes(' ');
    const notTooManyWords = words.length < 20;
    const noColons = !line.includes(':') || line.split(':').length === 2;
    
    const result = isReasonableLength && hasSpaces && notTooManyWords && noColons;
    if (result) {
      console.log('General ingredient match:', line.substring(0, 30));
    }
    
    return result;
  }

  cleanIngredient(ingredient) {
    return ingredient
      .replace(/^[-*•]\s*/, '') // Remove bullet points
      .replace(/^\d+\.\s*/, '') // Remove numbers
      .trim();
  }

  extractDirections(text) {
    const directionMatch = text.match(this.patterns.directions);
    
    if (!directionMatch) {
      // Fallback: look for content after ingredients
      return this.extractDirectionsFallback(text);
    }
    
    const directionText = directionMatch[1];
    const directions = directionText
      .split(/\n\s*\n|\d+\./)
      .map(step => step.trim())
      .filter(step => step.length > 10)
      .map((step, index) => `${index + 1}. ${step}`);
    
    return directions;
  }

  extractDirectionsFallback(text) {
    const lines = text.split('\n');
    const directions = [];
    let inDirectionsSection = false;
    let currentStep = '';
    
    for (const line of lines) {
      const cleanLine = line.trim();
      
      if (/^(?:directions?|instructions?|method)/i.test(cleanLine)) {
        inDirectionsSection = true;
        continue;
      }
      
      if (inDirectionsSection && cleanLine.length > 0) {
        if (cleanLine.length > 20) {
          if (currentStep) {
            directions.push(currentStep);
          }
          currentStep = cleanLine;
        } else {
          currentStep += ' ' + cleanLine;
        }
      }
    }
    
    if (currentStep) {
      directions.push(currentStep);
    }
    
    return directions.map((step, index) => `${index + 1}. ${step}`);
  }

  extractIngredientsAlternative(text) {
    console.log('Using alternative ingredient extraction...');
    
    // Split text into potential ingredient lines
    const lines = text.split(/[\n\r]|(?:\s{3,})/);
    const ingredients = [];
    
    for (const line of lines) {
      const cleanLine = line.trim();
      
      // Skip empty lines and very short lines
      if (!cleanLine || cleanLine.length < 3) continue;
      
      // Skip lines that look like titles, macros, or directions
      if (this.looksLikeTitle(cleanLine) || 
          this.looksLikeMacro(cleanLine) || 
          this.looksLikeDirection(cleanLine)) {
        continue;
      }
      
      // Check if line looks like an ingredient
      if (this.looksLikeIngredient(cleanLine)) {
        ingredients.push(this.cleanIngredient(cleanLine));
      }
    }
    
    console.log('Alternative extraction found:', ingredients.length, 'ingredients');
    return ingredients;
  }

  looksLikeTitle(line) {
    return line.length < 100 && 
           !line.includes(' ') === false && 
           !/\d/.test(line) && 
           line.split(' ').length < 10;
  }

  looksLikeMacro(line) {
    return /(?:calories?|protein|carbs?|fat|fiber)[:\s]*\d+/i.test(line);
  }

  looksLikeDirection(line) {
    return /^(?:\d+\.|\d+\))\s/.test(line) || 
           /\b(?:heat|cook|bake|mix|stir|add|place|remove)\b/i.test(line);
  }
}
