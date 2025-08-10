# Recipe PDF Parser

A JavaScript/Node.js application that extracts recipes from PDF files and generates MacroFactor-compatible imports plus shopping lists.

## Features

- **PDF Recipe Extraction**: Parse text-based PDFs with one recipe per page
- **Smart Recipe Parsing**: Automatically extract:
  - Recipe titles
  - Nutritional macros (calories, protein, carbs, fat, fiber)
  - Ingredient lists with amounts and units
  - Cooking directions/instructions
- **MacroFactor Export**: Generate beautifully formatted HTML pages for easy import
- **Shopping List Generation**: Consolidate ingredients from multiple recipes into organized shopping lists
- **Web Interface**: User-friendly drag-and-drop interface
- **Recipe Selection**: Choose which recipes to export or include in shopping lists

## Installation

1. Clone or download this repository
2. Install dependencies:
   ```bash
   npm install
   ```

## Usage

1. Start the application:
   ```bash
   npm start
   ```
   Or for development with auto-reload:
   ```bash
   npm run dev
   ```

2. Open your browser and navigate to `http://localhost:3000`

3. Upload a PDF file containing recipes (one recipe per page)

4. Review the parsed recipes and select which ones you want to work with

5. Choose your action:
   - **Export to MacroFactor**: Generate a formatted HTML page with recipe data
   - **Generate Shopping List**: Create a consolidated shopping list from selected recipes

## PDF Format Requirements

The application works best with PDFs formatted as follows:

- **One recipe per page**
- **Clear structure** with title at the top
- **Nutritional information** with keywords like "calories", "protein", "carbs", "fat"
- **Ingredients section** with measurements and ingredient names
- **Directions/Instructions** section with cooking steps

Example format:
```
Grilled Chicken Breast

Calories: 165
Protein: 31g
Carbs: 0g
Fat: 3.6g

Ingredients:
- 4 oz chicken breast
- 1 tbsp olive oil
- 1 tsp garlic powder
- Salt and pepper to taste

Directions:
1. Preheat grill to medium-high heat
2. Season chicken with garlic powder, salt, and pepper
3. Brush with olive oil
4. Grill for 6-7 minutes per side
```

## API Endpoints

- `POST /api/upload` - Upload and parse PDF file
- `POST /api/export/macrofactor` - Export selected recipes to MacroFactor format
- `POST /api/generate-shopping-list` - Generate shopping list from selected recipes

## Technologies Used

- **Backend**: Node.js, Express.js
- **PDF Processing**: pdf-parse
- **Frontend**: Vanilla HTML/CSS/JavaScript
- **File Upload**: Multer

## File Structure

```
recipe/
├── src/
│   ├── app.js                     # Main server application
│   └── services/
│       ├── recipeParser.js        # PDF parsing and recipe extraction
│       ├── macroFactorExporter.js # MacroFactor format export
│       └── shoppingListGenerator.js # Shopping list generation
├── public/
│   └── index.html                 # Web interface
├── package.json
└── README.md
```

## Development

The application includes several parsing strategies to handle various PDF formats:

- **Pattern-based extraction** using regular expressions
- **Fallback parsing** for non-standard formats
- **Ingredient consolidation** for shopping lists
- **Unit conversion** for combining similar ingredients

## Troubleshooting

- **Empty results**: Ensure your PDF contains text (not just images)
- **Missing ingredients**: Check that ingredients are listed with clear formatting
- **Incorrect macros**: Verify macro information uses standard keywords and units
- **Parse errors**: Try PDFs with simpler, more structured formatting

## License

MIT License
