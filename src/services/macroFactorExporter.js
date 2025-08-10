export class MacroFactorExporter {
  constructor() {
    this.macroFactorTemplate = {
      version: "1.0",
      recipes: []
    };
  }

  async exportRecipes(recipes) {
    try {
      const exportData = {
        ...this.macroFactorTemplate,
        exportDate: new Date().toISOString(),
        totalRecipes: recipes.length,
        recipes: recipes.map(recipe => this.formatForMacroFactor(recipe))
      };

      // Generate HTML page for import
      const htmlContent = this.generateImportPage(exportData);
      
      return {
        json: exportData,
        html: htmlContent,
        downloadUrl: this.generateDownloadData(exportData)
      };
    } catch (error) {
      throw new Error(`Failed to export recipes: ${error.message}`);
    }
  }

  formatForMacroFactor(recipe) {
    return {
      id: recipe.id,
      name: recipe.title,
      nutrition: {
        calories: recipe.macros.calories || 0,
        protein: recipe.macros.protein || 0,
        carbohydrates: recipe.macros.carbs || 0,
        fat: recipe.macros.fat || 0,
        fiber: recipe.macros.fiber || 0
      },
      ingredients: recipe.ingredients.map(ingredient => ({
        name: this.extractIngredientName(ingredient),
        amount: this.extractAmount(ingredient),
        unit: this.extractUnit(ingredient),
        originalText: ingredient
      })),
      instructions: recipe.directions,
      servings: this.estimateServings(recipe),
      prepTime: null,
      cookTime: null,
      tags: this.generateTags(recipe),
      source: "PDF Import",
      notes: `Imported from page ${recipe.pageNumber}`
    };
  }

  extractIngredientName(ingredientText) {
    // Remove measurements and common prefixes to get the ingredient name
    let name = ingredientText
      .replace(/^\d+\s*/, '') // Remove leading numbers
      .replace(/\d+(?:\.\d+)?\s*(?:cups?|tbsp|tsp|oz|lbs?|g|kg|ml|l)\s*/gi, '') // Remove measurements
      .replace(/^(?:of\s+)?/, '') // Remove "of"
      .trim();
    
    // Take the main ingredient (usually the first significant word or phrase)
    const words = name.split(/,|\s+/);
    return words.slice(0, 3).join(' ').trim() || ingredientText;
  }

  extractAmount(ingredientText) {
    const amountMatch = ingredientText.match(/(\d+(?:\.\d+)?(?:\s*\/\s*\d+)?)/);
    return amountMatch ? amountMatch[1] : '';
  }

  extractUnit(ingredientText) {
    const unitMatch = ingredientText.match(/\d+(?:\.\d+)?\s*(cups?|tbsp|tsp|oz|lbs?|pounds?|g|grams?|kg|ml|liters?|l)\b/i);
    return unitMatch ? unitMatch[1].toLowerCase() : '';
  }

  estimateServings(recipe) {
    // Simple heuristic based on ingredient quantities
    const ingredients = recipe.ingredients;
    
    if (ingredients.length === 0) return 1;
    
    // Look for serving indicators in ingredients or title
    const servingIndicators = recipe.title.match(/serves?\s*(\d+)|(\d+)\s*servings?/i);
    if (servingIndicators) {
      return parseInt(servingIndicators[1] || servingIndicators[2]);
    }
    
    // Estimate based on typical ingredient amounts
    const largeBatchIngredients = ingredients.filter(ing => 
      /\b(?:[2-9]|[1-9]\d+)\s*(?:cups?|lbs?|pounds?)\b/i.test(ing)
    );
    
    if (largeBatchIngredients.length > 2) return 6;
    if (largeBatchIngredients.length > 0) return 4;
    
    return 2; // Default serving size
  }

  generateTags(recipe) {
    const tags = [];
    
    // Analyze ingredients for common tags
    const ingredientText = recipe.ingredients.join(' ').toLowerCase();
    
    if (/chicken|beef|pork|fish|salmon|tuna/.test(ingredientText)) {
      tags.push('protein');
    }
    
    if (/vegetable|broccoli|spinach|carrot|onion/.test(ingredientText)) {
      tags.push('vegetables');
    }
    
    if (/rice|pasta|bread|quinoa|oats/.test(ingredientText)) {
      tags.push('carbs');
    }
    
    // Analyze cooking methods from directions
    const directionsText = recipe.directions.join(' ').toLowerCase();
    
    if (/bake|baking|oven/.test(directionsText)) {
      tags.push('baked');
    }
    
    if (/grill|grilling/.test(directionsText)) {
      tags.push('grilled');
    }
    
    if (/slow cooker|crockpot/.test(directionsText)) {
      tags.push('slow-cooker');
    }
    
    return tags;
  }

  generateImportPage(exportData) {
    return `<!DOCTYPE html>
<html lang="en">
<head>
    <meta charset="UTF-8">
    <meta name="viewport" content="width=device-width, initial-scale=1.0">
    <title>MacroFactor Recipe Import</title>
    <style>
        body {
            font-family: Arial, sans-serif;
            max-width: 1200px;
            margin: 0 auto;
            padding: 20px;
            background-color: #f5f5f5;
        }
        .header {
            background: linear-gradient(135deg, #667eea 0%, #764ba2 100%);
            color: white;
            padding: 30px;
            border-radius: 10px;
            text-align: center;
            margin-bottom: 30px;
        }
        .recipe-grid {
            display: grid;
            grid-template-columns: repeat(auto-fit, minmax(350px, 1fr));
            gap: 20px;
        }
        .recipe-card {
            background: white;
            border-radius: 10px;
            padding: 20px;
            box-shadow: 0 2px 10px rgba(0,0,0,0.1);
            transition: transform 0.2s;
        }
        .recipe-card:hover {
            transform: translateY(-2px);
        }
        .recipe-title {
            color: #333;
            font-size: 1.4em;
            margin-bottom: 15px;
            border-bottom: 2px solid #667eea;
            padding-bottom: 10px;
        }
        .nutrition-info {
            display: grid;
            grid-template-columns: repeat(2, 1fr);
            gap: 10px;
            margin-bottom: 20px;
            background: #f8f9fa;
            padding: 15px;
            border-radius: 8px;
        }
        .nutrition-item {
            display: flex;
            justify-content: space-between;
        }
        .nutrition-label {
            font-weight: bold;
            color: #666;
        }
        .nutrition-value {
            color: #333;
        }
        .ingredients-section, .directions-section {
            margin-bottom: 20px;
        }
        .section-title {
            font-weight: bold;
            color: #667eea;
            margin-bottom: 10px;
            font-size: 1.1em;
        }
        .ingredients-list {
            list-style-type: none;
            padding: 0;
        }
        .ingredients-list li {
            padding: 5px 0;
            border-bottom: 1px solid #eee;
        }
        .directions-list {
            list-style-type: decimal;
            padding-left: 20px;
        }
        .directions-list li {
            margin-bottom: 10px;
            line-height: 1.5;
        }
        .recipe-meta {
            display: flex;
            justify-content: space-between;
            align-items: center;
            margin-top: 15px;
            padding-top: 15px;
            border-top: 1px solid #eee;
            font-size: 0.9em;
            color: #666;
        }
        .tags {
            display: flex;
            gap: 5px;
        }
        .tag {
            background: #667eea;
            color: white;
            padding: 3px 8px;
            border-radius: 12px;
            font-size: 0.8em;
        }
        .export-actions {
            text-align: center;
            margin: 30px 0;
            padding: 20px;
            background: white;
            border-radius: 10px;
            box-shadow: 0 2px 10px rgba(0,0,0,0.1);
        }
        .btn {
            background: #667eea;
            color: white;
            padding: 12px 24px;
            border: none;
            border-radius: 6px;
            cursor: pointer;
            font-size: 1em;
            margin: 0 10px;
            transition: background 0.2s;
        }
        .btn:hover {
            background: #5a67d8;
        }
        .stats {
            display: grid;
            grid-template-columns: repeat(auto-fit, minmax(200px, 1fr));
            gap: 20px;
            margin-bottom: 30px;
        }
        .stat-card {
            background: white;
            padding: 20px;
            border-radius: 10px;
            text-align: center;
            box-shadow: 0 2px 10px rgba(0,0,0,0.1);
        }
        .stat-number {
            font-size: 2em;
            font-weight: bold;
            color: #667eea;
        }
        .stat-label {
            color: #666;
            margin-top: 5px;
        }
    </style>
</head>
<body>
    <div class="header">
        <h1>MacroFactor Recipe Import</h1>
        <p>Generated on ${new Date(exportData.exportDate).toLocaleDateString()}</p>
    </div>

    <div class="stats">
        <div class="stat-card">
            <div class="stat-number">${exportData.totalRecipes}</div>
            <div class="stat-label">Total Recipes</div>
        </div>
        <div class="stat-card">
            <div class="stat-number">${exportData.recipes.reduce((sum, r) => sum + (r.nutrition.calories || 0), 0)}</div>
            <div class="stat-label">Total Calories</div>
        </div>
        <div class="stat-card">
            <div class="stat-number">${Math.round(exportData.recipes.reduce((sum, r) => sum + (r.nutrition.protein || 0), 0))}g</div>
            <div class="stat-label">Total Protein</div>
        </div>
    </div>

    <div class="export-actions">
        <button class="btn" onclick="downloadJSON()">Download JSON</button>
        <button class="btn" onclick="copyToClipboard()">Copy Data</button>
        <button class="btn" onclick="window.print()">Print Recipes</button>
    </div>

    <div class="recipe-grid">
        ${exportData.recipes.map(recipe => `
            <div class="recipe-card">
                <h2 class="recipe-title">${recipe.name}</h2>
                
                <div class="nutrition-info">
                    <div class="nutrition-item">
                        <span class="nutrition-label">Calories:</span>
                        <span class="nutrition-value">${recipe.nutrition.calories || 'N/A'}</span>
                    </div>
                    <div class="nutrition-item">
                        <span class="nutrition-label">Protein:</span>
                        <span class="nutrition-value">${recipe.nutrition.protein || 'N/A'}g</span>
                    </div>
                    <div class="nutrition-item">
                        <span class="nutrition-label">Carbs:</span>
                        <span class="nutrition-value">${recipe.nutrition.carbohydrates || 'N/A'}g</span>
                    </div>
                    <div class="nutrition-item">
                        <span class="nutrition-label">Fat:</span>
                        <span class="nutrition-value">${recipe.nutrition.fat || 'N/A'}g</span>
                    </div>
                </div>

                <div class="ingredients-section">
                    <div class="section-title">Ingredients (${recipe.ingredients.length})</div>
                    <ul class="ingredients-list">
                        ${recipe.ingredients.map(ing => `<li>${ing.originalText}</li>`).join('')}
                    </ul>
                </div>

                <div class="directions-section">
                    <div class="section-title">Directions</div>
                    <ol class="directions-list">
                        ${recipe.instructions.map(step => `<li>${step}</li>`).join('')}
                    </ol>
                </div>

                <div class="recipe-meta">
                    <div>Servings: ${recipe.servings}</div>
                    <div class="tags">
                        ${recipe.tags.map(tag => `<span class="tag">${tag}</span>`).join('')}
                    </div>
                </div>
            </div>
        `).join('')}
    </div>

    <script>
        const recipeData = ${JSON.stringify(exportData, null, 2)};
        
        function downloadJSON() {
            const blob = new Blob([JSON.stringify(recipeData, null, 2)], { type: 'application/json' });
            const url = URL.createObjectURL(blob);
            const a = document.createElement('a');
            a.href = url;
            a.download = 'macrofactor-recipes.json';
            document.body.appendChild(a);
            a.click();
            document.body.removeChild(a);
            URL.revokeObjectURL(url);
        }
        
        function copyToClipboard() {
            navigator.clipboard.writeText(JSON.stringify(recipeData, null, 2))
                .then(() => alert('Recipe data copied to clipboard!'))
                .catch(err => console.error('Failed to copy: ', err));
        }
    </script>
</body>
</html>`;
  }

  generateDownloadData(exportData) {
    const blob = new Blob([JSON.stringify(exportData, null, 2)], { type: 'application/json' });
    return URL.createObjectURL(blob);
  }
}
