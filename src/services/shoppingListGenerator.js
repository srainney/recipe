export class ShoppingListGenerator {
  constructor() {
    this.categoryMappings = {
      // Proteins
      'chicken': 'Meat & Poultry',
      'beef': 'Meat & Poultry',
      'pork': 'Meat & Poultry',
      'turkey': 'Meat & Poultry',
      'fish': 'Seafood',
      'salmon': 'Seafood',
      'tuna': 'Seafood',
      'shrimp': 'Seafood',
      'eggs': 'Dairy & Eggs',
      
      // Dairy
      'milk': 'Dairy & Eggs',
      'cheese': 'Dairy & Eggs',
      'yogurt': 'Dairy & Eggs',
      'butter': 'Dairy & Eggs',
      'cream': 'Dairy & Eggs',
      
      // Vegetables
      'onion': 'Vegetables',
      'garlic': 'Vegetables',
      'tomato': 'Vegetables',
      'carrot': 'Vegetables',
      'celery': 'Vegetables',
      'pepper': 'Vegetables',
      'broccoli': 'Vegetables',
      'spinach': 'Vegetables',
      'lettuce': 'Vegetables',
      'cucumber': 'Vegetables',
      'mushroom': 'Vegetables',
      
      // Fruits
      'apple': 'Fruits',
      'banana': 'Fruits',
      'orange': 'Fruits',
      'lemon': 'Fruits',
      'lime': 'Fruits',
      'berry': 'Fruits',
      'strawberry': 'Fruits',
      'blueberry': 'Fruits',
      
      // Grains & Starches
      'rice': 'Grains & Starches',
      'pasta': 'Grains & Starches',
      'bread': 'Grains & Starches',
      'flour': 'Grains & Starches',
      'oats': 'Grains & Starches',
      'quinoa': 'Grains & Starches',
      'potato': 'Grains & Starches',
      
      // Pantry
      'oil': 'Pantry & Condiments',
      'vinegar': 'Pantry & Condiments',
      'salt': 'Pantry & Condiments',
      'pepper': 'Pantry & Condiments',
      'sugar': 'Pantry & Condiments',
      'honey': 'Pantry & Condiments',
      'sauce': 'Pantry & Condiments',
      'spice': 'Pantry & Condiments',
      'herb': 'Pantry & Condiments',
      
      // Canned/Packaged
      'beans': 'Canned & Packaged',
      'broth': 'Canned & Packaged',
      'stock': 'Canned & Packaged',
      'can': 'Canned & Packaged',
      'jar': 'Canned & Packaged'
    };
  }

  async generateList(recipes) {
    try {
      const consolidatedIngredients = this.consolidateIngredients(recipes);
      const categorizedList = this.categorizeIngredients(consolidatedIngredients);
      const shoppingList = this.formatShoppingList(categorizedList);
      
      return {
        summary: {
          totalRecipes: recipes.length,
          totalItems: Object.values(consolidatedIngredients).length,
          categories: Object.keys(categorizedList).length
        },
        recipes: recipes.map(r => ({ id: r.id, name: r.title })),
        categorizedList: categorizedList,
        flatList: Object.entries(consolidatedIngredients).map(([name, data]) => ({
          name: name,
          totalAmount: data.totalAmount,
          unit: data.unit,
          recipes: data.recipes,
          category: this.categorizeIngredient(name)
        })),
        htmlList: this.generateHTMLList(categorizedList, recipes)
      };
    } catch (error) {
      throw new Error(`Failed to generate shopping list: ${error.message}`);
    }
  }

  consolidateIngredients(recipes) {
    const ingredients = {};

    recipes.forEach(recipe => {
      recipe.ingredients.forEach(ingredientText => {
        const parsed = this.parseIngredient(ingredientText);
        const normalizedName = this.normalizeIngredientName(parsed.name);
        
        if (!ingredients[normalizedName]) {
          ingredients[normalizedName] = {
            name: normalizedName,
            displayName: parsed.name,
            totalAmount: 0,
            amounts: [],
            unit: parsed.unit,
            recipes: [],
            originalTexts: []
          };
        }
        
        // Add amount if it's numeric and units match or are compatible
        if (parsed.amount && !isNaN(parseFloat(parsed.amount))) {
          const convertedAmount = this.convertToStandardUnit(parsed.amount, parsed.unit);
          if (convertedAmount !== null) {
            ingredients[normalizedName].totalAmount += convertedAmount;
            ingredients[normalizedName].amounts.push({
              amount: parsed.amount,
              unit: parsed.unit,
              recipe: recipe.title
            });
          }
        }
        
        ingredients[normalizedName].recipes.push(recipe.title);
        ingredients[normalizedName].originalTexts.push(ingredientText);
      });
    });

    return ingredients;
  }

  parseIngredient(ingredientText) {
    // Extract amount
    const amountMatch = ingredientText.match(/^(\d+(?:\.\d+)?(?:\s*\/\s*\d+)?)/);
    const amount = amountMatch ? amountMatch[1] : '';

    // Extract unit
    const unitMatch = ingredientText.match(/\d+(?:\.\d+)?\s*(cups?|tbsp|tablespoons?|tsp|teaspoons?|oz|ounces?|lbs?|pounds?|g|grams?|kg|kilograms?|ml|milliliters?|l|liters?)\b/i);
    const unit = unitMatch ? unitMatch[1].toLowerCase() : '';

    // Extract ingredient name (everything after amount and unit)
    let name = ingredientText
      .replace(/^\d+(?:\.\d+)?(?:\s*\/\s*\d+)?\s*/, '') // Remove amount
      .replace(/^(?:cups?|tbsp|tablespoons?|tsp|teaspoons?|oz|ounces?|lbs?|pounds?|g|grams?|kg|kilograms?|ml|milliliters?|l|liters?)\s*/i, '') // Remove unit
      .replace(/^of\s+/i, '') // Remove "of"
      .replace(/,.*$/, '') // Remove everything after comma
      .trim();

    // If we couldn't extract a clean name, use the original text
    if (!name || name.length < 2) {
      name = ingredientText.replace(/^\d+(?:\.\d+)?\s*(?:cups?|tbsp|tsp|oz|lbs?|g|kg|ml|l)?\s*/i, '').trim();
    }

    return { amount, unit, name };
  }

  normalizeIngredientName(name) {
    return name
      .toLowerCase()
      .replace(/s$/, '') // Remove plural
      .replace(/ed$/, '') // Remove past tense
      .replace(/ing$/, '') // Remove present participle
      .replace(/\s+/g, ' ')
      .trim();
  }

  convertToStandardUnit(amount, unit) {
    const numAmount = parseFloat(amount);
    if (isNaN(numAmount)) return null;

    // Convert to standard units (grams for weight, ml for volume)
    const conversions = {
      // Weight conversions to grams
      'g': 1,
      'gram': 1,
      'grams': 1,
      'kg': 1000,
      'kilogram': 1000,
      'kilograms': 1000,
      'oz': 28.35,
      'ounce': 28.35,
      'ounces': 28.35,
      'lb': 453.59,
      'lbs': 453.59,
      'pound': 453.59,
      'pounds': 453.59,
      
      // Volume conversions to ml
      'ml': 1,
      'milliliter': 1,
      'milliliters': 1,
      'l': 1000,
      'liter': 1000,
      'liters': 1000,
      'cup': 240,
      'cups': 240,
      'tbsp': 15,
      'tablespoon': 15,
      'tablespoons': 15,
      'tsp': 5,
      'teaspoon': 5,
      'teaspoons': 5
    };

    return conversions[unit.toLowerCase()] ? numAmount * conversions[unit.toLowerCase()] : numAmount;
  }

  categorizeIngredients(ingredients) {
    const categorized = {};

    Object.values(ingredients).forEach(ingredient => {
      const category = this.categorizeIngredient(ingredient.name);
      
      if (!categorized[category]) {
        categorized[category] = [];
      }
      
      categorized[category].push(ingredient);
    });

    // Sort items within each category alphabetically
    Object.keys(categorized).forEach(category => {
      categorized[category].sort((a, b) => a.displayName.localeCompare(b.displayName));
    });

    return categorized;
  }

  categorizeIngredient(ingredientName) {
    const lowerName = ingredientName.toLowerCase();
    
    for (const [keyword, category] of Object.entries(this.categoryMappings)) {
      if (lowerName.includes(keyword)) {
        return category;
      }
    }
    
    return 'Other';
  }

  formatShoppingList(categorizedList) {
    const formatted = {};
    
    Object.entries(categorizedList).forEach(([category, items]) => {
      formatted[category] = items.map(item => {
        let displayText = item.displayName;
        
        if (item.totalAmount > 0 && item.unit) {
          displayText += ` (${this.formatAmount(item.totalAmount, item.unit)})`;
        }
        
        if (item.recipes.length > 1) {
          displayText += ` [${item.recipes.length} recipes]`;
        }
        
        return displayText;
      });
    });
    
    return formatted;
  }

  formatAmount(amount, unit) {
    // Convert back to readable format
    if (!unit) return Math.round(amount);
    
    const rounded = Math.round(amount * 100) / 100;
    return `${rounded} ${unit}`;
  }

  generateHTMLList(categorizedList, recipes) {
    return `<!DOCTYPE html>
<html lang="en">
<head>
    <meta charset="UTF-8">
    <meta name="viewport" content="width=device-width, initial-scale=1.0">
    <title>Shopping List</title>
    <style>
        body {
            font-family: Arial, sans-serif;
            max-width: 800px;
            margin: 0 auto;
            padding: 20px;
            background-color: #f5f5f5;
        }
        .header {
            background: linear-gradient(135deg, #28a745 0%, #20c997 100%);
            color: white;
            padding: 30px;
            border-radius: 10px;
            text-align: center;
            margin-bottom: 30px;
        }
        .recipe-summary {
            background: white;
            padding: 20px;
            border-radius: 10px;
            margin-bottom: 20px;
            box-shadow: 0 2px 10px rgba(0,0,0,0.1);
        }
        .recipe-list {
            display: flex;
            flex-wrap: wrap;
            gap: 10px;
        }
        .recipe-tag {
            background: #28a745;
            color: white;
            padding: 5px 12px;
            border-radius: 15px;
            font-size: 0.9em;
        }
        .category {
            background: white;
            margin-bottom: 20px;
            border-radius: 10px;
            overflow: hidden;
            box-shadow: 0 2px 10px rgba(0,0,0,0.1);
        }
        .category-header {
            background: #28a745;
            color: white;
            padding: 15px 20px;
            font-weight: bold;
            font-size: 1.1em;
        }
        .category-items {
            padding: 0;
        }
        .item {
            display: flex;
            align-items: center;
            padding: 12px 20px;
            border-bottom: 1px solid #eee;
            transition: background-color 0.2s;
        }
        .item:last-child {
            border-bottom: none;
        }
        .item:hover {
            background-color: #f8f9fa;
        }
        .item-checkbox {
            margin-right: 12px;
            transform: scale(1.2);
        }
        .item-text {
            flex-grow: 1;
        }
        .item-recipes {
            font-size: 0.8em;
            color: #666;
            margin-left: 10px;
        }
        .actions {
            text-align: center;
            margin: 30px 0;
            padding: 20px;
            background: white;
            border-radius: 10px;
            box-shadow: 0 2px 10px rgba(0,0,0,0.1);
        }
        .btn {
            background: #28a745;
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
            background: #218838;
        }
        @media print {
            .actions { display: none; }
            .item-checkbox { display: none; }
        }
    </style>
</head>
<body>
    <div class="header">
        <h1>🛒 Shopping List</h1>
        <p>Generated on ${new Date().toLocaleDateString()}</p>
    </div>

    <div class="recipe-summary">
        <h3>Recipes (${recipes.length}):</h3>
        <div class="recipe-list">
            ${recipes.map(recipe => `<span class="recipe-tag">${recipe.name}</span>`).join('')}
        </div>
    </div>

    <div class="actions">
        <button class="btn" onclick="toggleAll()">Toggle All</button>
        <button class="btn" onclick="window.print()">Print List</button>
        <button class="btn" onclick="exportText()">Export Text</button>
    </div>

    ${Object.entries(categorizedList).map(([category, items]) => `
        <div class="category">
            <div class="category-header">${category} (${items.length})</div>
            <div class="category-items">
                ${items.map((item, index) => `
                    <div class="item">
                        <input type="checkbox" class="item-checkbox" id="item-${category}-${index}">
                        <div class="item-text">
                            <label for="item-${category}-${index}">${item.displayName}</label>
                            ${item.totalAmount > 0 && item.unit ? 
                              `<span class="item-recipes">(${this.formatAmount(item.totalAmount, item.unit)})</span>` : ''}
                        </div>
                        ${item.recipes.length > 1 ? 
                          `<div class="item-recipes">${item.recipes.length} recipes</div>` : ''}
                    </div>
                `).join('')}
            </div>
        </div>
    `).join('')}

    <script>
        let allChecked = false;
        
        function toggleAll() {
            allChecked = !allChecked;
            const checkboxes = document.querySelectorAll('.item-checkbox');
            checkboxes.forEach(cb => cb.checked = allChecked);
        }
        
        function exportText() {
            const categories = ${JSON.stringify(categorizedList)};
            let text = 'Shopping List\\n' + '='.repeat(20) + '\\n\\n';
            
            Object.entries(categories).forEach(([category, items]) => {
                text += category + ':\\n';
                items.forEach(item => {
                    text += '  • ' + item.displayName;
                    if (item.totalAmount > 0 && item.unit) {
                        text += ' (' + item.totalAmount + ' ' + item.unit + ')';
                    }
                    text += '\\n';
                });
                text += '\\n';
            });
            
            const blob = new Blob([text], { type: 'text/plain' });
            const url = URL.createObjectURL(blob);
            const a = document.createElement('a');
            a.href = url;
            a.download = 'shopping-list.txt';
            document.body.appendChild(a);
            a.click();
            document.body.removeChild(a);
            URL.revokeObjectURL(url);
        }
    </script>
</body>
</html>`;
  }
}
