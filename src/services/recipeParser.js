import pdfjsLib from 'pdfjs-dist';
import { v4 as uuidv4 } from 'uuid';

export class RecipeParser {
  constructor() {
    // Patterns for parsing recipe components
    this.patterns = {
      title: /^(.+?)(?:\n|$)/m,
      macros: {
        calories: /(?:calories?|kcal)[:\s]*(\d+(?:\.\d+)?)/i,
        protein: /protein[:\s]*(\d+(?:\.\d+)?)\s*g?/i,
        carbs: /(?:carbs?|carbohydrates?|carb)[:\s]*(\d+(?:\.\d+)?)\s*g?/i,
        fat: /(?:fat|fats?)[:\s]*(\d+(?:\.\d+)?)\s*g?/i,
        fiber: /fiber[:\s]*(\d+(?:\.\d+)?)\s*g?/i
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
      
      // Extract text from each page (skip pages 1-22 which are intro/table of contents)
      const startPage = 23; // Start from page 23 where recipes likely begin
      console.log(`Skipping pages 1-${startPage - 1}, processing pages ${startPage}-${pdf.numPages}`);
      
      for (let pageNum = startPage; pageNum <= pdf.numPages; pageNum++) {
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

  async extractRawTextDebug(buffer) {
    try {
      console.log('Extracting raw text for debugging...');
      
      // Convert buffer to Uint8Array for pdfjs-dist
      const data = new Uint8Array(buffer);
      
      // Load PDF document
      const loadingTask = pdfjsLib.getDocument({ data: data });
      const pdf = await loadingTask.promise;
      
      console.log(`PDF loaded with ${pdf.numPages} pages for debug extraction`);
      
      const pages = [];
      
      // Extract text from each page (skip pages 1-22 which are intro/table of contents)
      const startPage = 23; // Start from page 23 where recipes likely begin
      console.log(`Debug extraction: Skipping pages 1-${startPage - 1}, processing pages ${startPage}-${pdf.numPages}`);
      
      for (let pageNum = startPage; pageNum <= pdf.numPages; pageNum++) {
        const page = await pdf.getPage(pageNum);
        const textContent = await page.getTextContent();
        
        // Get raw text items with positioning info
        const rawItems = textContent.items.map(item => ({
          text: item.str,
          x: item.transform[4],
          y: item.transform[5],
          width: item.width,
          height: item.height
        }));
        
        // Combine text items into different formats for analysis
        const simpleText = textContent.items.map(item => item.str).join(' ');
        const spacedText = textContent.items.map(item => item.str).join(' ').replace(/\s+/g, ' ').trim();
        const lineBasedText = this.organizeTextByLines(textContent.items);
        
        pages.push({
          pageNumber: pageNum,
          rawText: spacedText,
          simpleJoin: simpleText,
          lineOrganized: lineBasedText,
          rawItems: rawItems,
          itemCount: textContent.items.length,
          textLength: spacedText.length,
          // Add some analysis
          hasIngredients: /ingredients?/i.test(spacedText),
          hasDirections: /(?:directions?|instructions?|method)/i.test(spacedText),
          hasMacros: /(?:calories?|protein|carbs?|fat)/i.test(spacedText)
        });
      }
      
      return pages;
    } catch (error) {
      console.error('Error extracting raw text:', error);
      throw new Error(`Failed to extract raw text: ${error.message}`);
    }
  }

  organizeTextByLines(textItems) {
    // Group text items by approximate Y position (line)
    const lines = [];
    const tolerance = 5; // pixels
    
    textItems.forEach(item => {
      const y = item.transform[5];
      let lineFound = false;
      
      for (const line of lines) {
        if (Math.abs(line.y - y) <= tolerance) {
          line.items.push({
            text: item.str,
            x: item.transform[4]
          });
          lineFound = true;
          break;
        }
      }
      
      if (!lineFound) {
        lines.push({
          y: y,
          items: [{
            text: item.str,
            x: item.transform[4]
          }]
        });
      }
    });
    
    // Sort lines by Y position (top to bottom)
    lines.sort((a, b) => b.y - a.y);
    
    // Sort items within each line by X position (left to right)
    lines.forEach(line => {
      line.items.sort((a, b) => a.x - b.x);
    });
    
    // Convert to text lines
    return lines.map(line => 
      line.items.map(item => item.text).join(' ').trim()
    ).filter(line => line.length > 0);
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
    
    // For this cookbook format, the title is usually the first line or at the very beginning
    const lines = text.split(/[\n\r]|(?:\s{3,})/);
    
    // Strategy 1: Look for the first meaningful line that looks like a recipe title
    for (const line of lines) {
      const cleanLine = line.trim();
      if (cleanLine && 
          !cleanLine.toLowerCase().includes('calories') &&
          !cleanLine.toLowerCase().includes('protein') &&
          !cleanLine.toLowerCase().includes('ingredients') &&
          !cleanLine.toLowerCase().includes('instructions') &&
          !cleanLine.toLowerCase().includes('directions') &&
          !cleanLine.toLowerCase().includes('per serving') &&
          !cleanLine.toLowerCase().includes('makes') &&
          !cleanLine.toLowerCase().includes('back to table') &&
          cleanLine.length > 5 && 
          cleanLine.length < 100 &&
          !/^\d+/.test(cleanLine) && // Don't start with numbers
          !cleanLine.includes('g ') && // Avoid macro lines
          !/^\w+:/.test(cleanLine) && // Avoid ingredient section headers like "Chicken:"
          cleanLine.split(' ').length > 1) { // Must be multiple words
        console.log('Found title:', cleanLine);
        return cleanLine;
      }
    }
    
    // Strategy 2: Take the very first substantial text before any structural elements
    const words = text.split(/\s+/);
    const titleWords = [];
    
    for (const word of words) {
      // Stop when we hit structural elements or ingredients
      if (/^(chicken|sauce|rice|ingredients|instructions|per|serving|makes|calories|protein|carbs|fat|garnish|marinade):/i.test(word) ||
          /^(ingredients|instructions|directions)$/i.test(word)) {
        break;
      }
      titleWords.push(word);
      // Stop if we have enough words for a title
      if (titleWords.length >= 8) break;
    }
    
    if (titleWords.length >= 2) {
      const title = titleWords.join(' ').trim();
      console.log('Extracted title from beginning:', title);
      return title;
    }
    
    console.log('No title found');
    return null;
  }

  extractMacros(text) {
    const macros = {};
    console.log('Extracting macros from text...');
    
    // Try multiple strategies for each macro - updated for this cookbook's format
    const macroPatterns = {
      calories: [
        /(\d+(?:\.\d+)?)\s*calories?/i,
        /(?:calories?|kcal)[:\s]*(\d+(?:\.\d+)?)/i,
        /cal[:\s]*(\d+(?:\.\d+)?)/i
      ],
      protein: [
        /(\d+(?:\.\d+)?)\s*g?\s*protein/i,
        /protein[:\s]*(\d+(?:\.\d+)?)\s*g?/i,
        /prot[:\s]*(\d+(?:\.\d+)?)/i
      ],
      carbs: [
        /(\d+(?:\.\d+)?)\s*g?\s*carbs?/i,
        /(?:carbs?|carbohydrates?|carb)[:\s]*(\d+(?:\.\d+)?)\s*g?/i,
        /cho[:\s]*(\d+(?:\.\d+)?)/i
      ],
      fat: [
        /(\d+(?:\.\d+)?)\s*g?\s*fat/i,
        /(?:fat|fats?)[:\s]*(\d+(?:\.\d+)?)\s*g?/i,
        /lipid[:\s]*(\d+(?:\.\d+)?)/i
      ],
      fiber: [
        /(\d+(?:\.\d+)?)\s*g?\s*fiber/i,
        /fiber[:\s]*(\d+(?:\.\d+)?)\s*g?/i,
        /fibre[:\s]*(\d+(?:\.\d+)?)/i
      ]
    };
    
    for (const [macro, patterns] of Object.entries(macroPatterns)) {
      let found = false;
      for (const pattern of patterns) {
        const match = text.match(pattern);
        if (match) {
          macros[macro] = parseFloat(match[1]);
          console.log(`Found ${macro}: ${macros[macro]} using pattern: ${pattern}`);
          found = true;
          break;
        }
      }
      if (!found) {
        console.log(`No ${macro} found in text`);
      }
    }
    
    console.log('Final macros:', macros);
    return macros;
  }

  extractIngredients(text) {
    console.log('Extracting ingredients...');
    
    // Try multiple strategies to find ingredients section
    const strategies = [
      // Strategy 1: Look for text between "ingredients" and "instructions" 
      () => {
        const match = text.match(/(?:ingredients)[:\s]*([^]*?)(?=(?:instructions?|directions?)[:\s]*|$)/im);
        if (match) {
          console.log('Found ingredients using strategy 1 (section-based)');
          return this.parseIngredientText(match[1]);
        }
        return null;
      },
      
      // Strategy 2: Extract from the specific structure of this cookbook
      () => {
        console.log('Trying cookbook-specific ingredient extraction...');
        return this.extractIngredientsFromCookbookFormat(text);
      },
      
      // Strategy 3: Look for ingredients without explicit section headers
      () => {
        console.log('Trying fallback ingredient extraction...');
        return this.extractIngredientsFallback(text);
      }
    ];
    
    for (const strategy of strategies) {
      const result = strategy();
      if (result && result.length > 0) {
        console.log(`Found ${result.length} ingredients`);
        return result;
      }
    }
    
    console.log('No ingredients found');
    return [];
  }

  extractIngredientsFromCookbookFormat(text) {
    const ingredients = [];
    
    // In this cookbook, ingredients appear BEFORE the word "ingredients", structured as:
    // Title + Ingredient sections (Chicken: ..., Sauce: ..., etc.) + "ingredients instructions"
    
    const beforeIngredients = text.split(/\bingredients\b/i)[0];
    if (!beforeIngredients) return [];
    
    console.log('Analyzing text before "ingredients" keyword:', beforeIngredients.substring(0, 200));
    
    // Remove the title part and macros part
    let ingredientText = beforeIngredients;
    
    // Remove common title patterns and macro patterns
    ingredientText = ingredientText.replace(/^[^:]+(?:bowls?|recipe|dish)/i, '');
    ingredientText = ingredientText.replace(/\d+\s*calories|\d+g?\s*protein|\d+g?\s*carbs|\d+g?\s*fat|\d+g?\s*fiber/gi, '');
    ingredientText = ingredientText.replace(/per serving|makes \d+/gi, '');
    
    // Split by known section headers and extract ingredients
    const sections = ingredientText.split(/\b(chicken|sauce|marinade|garnish|rice|pork|beef|vegetables?|seasoning):/gi);
    
    for (let i = 1; i < sections.length; i += 2) {
      const sectionName = sections[i];
      const sectionContent = sections[i + 1] || '';
      
      console.log(`Processing section: ${sectionName}`);
      console.log(`Section content: ${sectionContent.substring(0, 100)}`);
      
      // Extract ingredients from this section
      const sectionIngredients = this.parseIngredientSection(sectionContent, sectionName);
      ingredients.push(...sectionIngredients);
    }
    
    // Also try to extract any ingredients that might not be in sections
    if (ingredients.length === 0) {
      console.log('No sectioned ingredients found, trying pattern matching...');
      const patternIngredients = this.extractIngredientsByPattern(beforeIngredients);
      ingredients.push(...patternIngredients);
    }
    
    return ingredients.filter(ing => ing.length > 3);
  }

  parseIngredientSection(content, sectionName) {
    const ingredients = [];
    
    // Clean up the content
    let cleanContent = content.trim();
    
    // Split by measurement patterns to find individual ingredients
    const measurementPattern = /(\d+g?\s*\([^)]+\)|^\d+g?\s|\d+\s*(?:cup|tbsp|tsp|oz|lb|lbs|packets?)\s)/gi;
    
    let parts = cleanContent.split(measurementPattern).filter(p => p && p.trim());
    
    console.log(`Section ${sectionName} parts:`, parts.slice(0, 5));
    
    for (let i = 0; i < parts.length; i++) {
      const part = parts[i].trim();
      
      // If this looks like a measurement, combine with next part
      if (measurementPattern.test(part) && i + 1 < parts.length) {
        const nextPart = parts[i + 1].trim();
        let ingredient = `${part} ${nextPart}`.trim();
        
        // Clean up the ingredient - stop at common break points
        ingredient = ingredient.split(/\s+(?:per|makes|calories|protein|carbs|fat|garnish|rice|sauce|chicken|marinade)[:]/i)[0];
        ingredient = ingredient.split(/\s+(?:green|red|white|black)\s+(?=\w+:)/i)[0]; // Stop at "Green Chile:" etc
        ingredient = ingredient.split(/\s+(?:pico|mix|cheesy)[:]/i)[0]; // Stop at section breaks
        
        // Clean up the ingredient
        const cleanIngredient = ingredient
          .replace(/\s+/g, ' ')
          .replace(/,$/, '')
          .trim();
          
        if (cleanIngredient.length > 3 && this.looksLikeIngredient(cleanIngredient)) {
          // Further clean up to remove trailing section names
          const finalIngredient = cleanIngredient.replace(/\s+(chicken|sauce|garnish|rice|marinade|mix)\s*$/i, '').trim();
          if (finalIngredient.length > 3) {
            ingredients.push(finalIngredient);
            console.log(`Found ingredient: ${finalIngredient}`);
          }
        }
        i++; // Skip the next part since we used it
      }
    }
    
    return ingredients;
  }

  extractIngredientsByPattern(text) {
    const ingredients = [];
    
    // Look for measurement + ingredient patterns
    const patterns = [
      /(\d+g?\s*\([^)]+\)\s+[^.]+?)(?=\s+\d+g?\s*\(|\s+[A-Z][^:]+:|\s+ingredients|\s+instructions|$)/g,
      /(\d+g?\s+[^.]+?)(?=\s+\d+g?|\s+[A-Z][^:]+:|\s+ingredients|\s+instructions|$)/g,
      /(\d+\s*(?:cup|tbsp|tsp|oz|lb|lbs|packets?)\s+[^.]+?)(?=\s+\d+|\s+[A-Z][^:]+:|\s+ingredients|\s+instructions|$)/g
    ];
    
    for (const pattern of patterns) {
      const matches = [...text.matchAll(pattern)];
      for (const match of matches) {
        const ingredient = match[1].trim().replace(/,$/, '');
        if (ingredient.length > 3 && this.looksLikeIngredient(ingredient)) {
          ingredients.push(ingredient);
          console.log(`Pattern found ingredient: ${ingredient}`);
        }
      }
    }
    
    return ingredients;
  }

  isIngredientWord(word) {
    const ingredientWords = /^(chicken|pork|beef|fish|rice|pasta|onion|garlic|oil|butter|salt|pepper|sugar|flour|egg|milk|cheese|tomato|potato|carrot|broccoli|spinach|lettuce|bread|water|juice|wine|stock|broth|sauce|miso|peanut|soy|maple|syrup|vinegar|ginger|sesame|seeds|thighs|boneless|skinless|white|green|bone|chili|flakes|black|paste|cup|tbsp|tsp|oz|lb|lbs|grams?|cups?|tablespoons?|teaspoons?|ounces?|pounds?)$/i;
    return ingredientWords.test(word.replace(/[^\w]/g, ''));
  }

  parseIngredientText(ingredientText) {
    console.log('Parsing ingredient text:', ingredientText.substring(0, 200));
    
    // Split by various delimiters that might separate ingredients in PDFs
    const lines = ingredientText.split(/[\n\r]|(?:\s{3,})/);
    
    const ingredients = [];
    for (const line of lines) {
      const cleanLine = line.trim();
      if (cleanLine.length > 2 && this.looksLikeIngredient(cleanLine)) {
        ingredients.push(this.cleanIngredient(cleanLine));
      }
    }
    
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
    console.log('Extracting directions...');
    
    // Try multiple strategies to find directions
    const strategies = [
      // Strategy 1: Look for explicit directions section
      () => {
        const match = text.match(/(?:directions?|instructions?|method|preparation)[:\s]*([^]*?)$/im);
        if (match) {
          console.log('Found directions using strategy 1 (section-based)');
          return this.parseDirectionText(match[1]);
        }
        return null;
      },
      
      // Strategy 2: Look for directions after ingredients
      () => {
        const match = text.match(/(?:ingredients?[^]*?)(?:directions?|instructions?|method|preparation)[:\s]*([^]*?)$/im);
        if (match) {
          console.log('Found directions using strategy 2 (after ingredients)');
          return this.parseDirectionText(match[1]);
        }
        return null;
      },
      
      // Strategy 3: Fallback method
      () => {
        console.log('Trying fallback direction extraction...');
        return this.extractDirectionsFallback(text);
      }
    ];
    
    for (const strategy of strategies) {
      const result = strategy();
      if (result && result.length > 0) {
        console.log(`Found ${result.length} direction steps`);
        return result;
      }
    }
    
    console.log('No directions found');
    return [];
  }

  parseDirectionText(directionText) {
    console.log('Parsing direction text:', directionText.substring(0, 200));
    
    // Split by numbered steps or paragraph breaks
    let steps = directionText.split(/(?:\d+\.\s*|\n\s*\n)/);
    
    // Clean and filter steps
    steps = steps
      .map(step => step.trim())
      .filter(step => step.length > 10 && !this.looksLikeMacro(step))
      .map((step, index) => {
        // Add step numbers if not present
        if (!/^\d+\./.test(step)) {
          return `${index + 1}. ${step}`;
        }
        return step;
      });
    
    return steps;
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
