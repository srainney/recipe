import * as pdfjsLib from 'pdfjs-dist/legacy/build/pdf.js';
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
      
      // Load PDF document
      const loadingTask = pdfjsLib.getDocument({ data: buffer });
      const pdf = await loadingTask.promise;
      
      console.log(`PDF loaded with ${pdf.numPages} pages`);
      
      const recipes = [];
      
      // Extract text from each page
      for (let pageNum = 1; pageNum <= pdf.numPages; pageNum++) {
        const page = await pdf.getPage(pageNum);
        const textContent = await page.getTextContent();
        
        // Combine text items into a single string
        const pageText = textContent.items.map(item => item.str).join(' ');
        
        if (pageText.trim().length > 50) {
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
      const recipe = {
        id: uuidv4(),
        pageNumber: pageNumber,
        title: this.extractTitle(pageText),
        macros: this.extractMacros(pageText),
        ingredients: this.extractIngredients(pageText),
        directions: this.extractDirections(pageText),
        originalText: pageText.trim()
      };

      // Validate that we have essential components
      if (!recipe.title || recipe.ingredients.length === 0) {
        console.warn(`Page ${pageNumber}: Missing essential recipe components`);
        return null;
      }

      return recipe;
    } catch (error) {
      console.error(`Error parsing recipe on page ${pageNumber}:`, error);
      return null;
    }
  }

  extractTitle(text) {
    const lines = text.trim().split('\n');
    
    // Try the first non-empty line as title
    for (const line of lines) {
      const cleanLine = line.trim();
      if (cleanLine && 
          !cleanLine.toLowerCase().includes('calories') &&
          !cleanLine.toLowerCase().includes('protein') &&
          !cleanLine.toLowerCase().includes('ingredients') &&
          cleanLine.length > 2 && 
          cleanLine.length < 100) {
        return cleanLine;
      }
    }
    
    return `Recipe from Page ${this.pageNumber || 'Unknown'}`;
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
    
    // Common ingredient patterns
    const ingredientPatterns = [
      /^\d+/, // Starts with number
      /\d+\s*(?:cup|cups|tbsp|tsp|oz|lb|g|kg|ml|l)/i, // Contains measurements
      /^\*/, // Bulleted
      /^-/, // Dashed
      /^\d+\./, // Numbered list
    ];
    
    return ingredientPatterns.some(pattern => pattern.test(line)) ||
           (line.includes(' ') && !line.includes(':') && line.length < 150);
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
}
