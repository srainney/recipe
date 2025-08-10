import express from 'express';
import multer from 'multer';
import cors from 'cors';
import path from 'path';
import { fileURLToPath } from 'url';
import { RecipeParser } from './services/recipeParser.js';
import { MacroFactorExporter } from './services/macroFactorExporter.js';
import { ShoppingListGenerator } from './services/shoppingListGenerator.js';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const app = express();
const port = process.env.PORT || 3000;

// Middleware
app.use(cors());
app.use(express.json());
app.use(express.static(path.join(__dirname, '../public')));

// Configure multer for file uploads
const storage = multer.memoryStorage();
const upload = multer({ 
  storage: storage,
  fileFilter: (req, file, cb) => {
    if (file.mimetype === 'application/pdf') {
      cb(null, true);
    } else {
      cb(new Error('Only PDF files are allowed'), false);
    }
  }
});

// Initialize services
const recipeParser = new RecipeParser();
const macroFactorExporter = new MacroFactorExporter();
const shoppingListGenerator = new ShoppingListGenerator();

// Routes
app.get('/', (req, res) => {
  res.sendFile(path.join(__dirname, '../public/index.html'));
});

// Upload and parse PDF
app.post('/api/upload', upload.single('pdf'), async (req, res) => {
  try {
    if (!req.file) {
      return res.status(400).json({ error: 'No PDF file uploaded' });
    }

    console.log('Processing PDF...');
    const recipes = await recipeParser.parsePDF(req.file.buffer);
    
    res.json({
      success: true,
      message: `Found ${recipes.length} recipes`,
      recipes: recipes
    });
  } catch (error) {
    console.error('Error processing PDF:', error);
    res.status(500).json({ 
      error: 'Failed to process PDF', 
      details: error.message 
    });
  }
});

// Debug endpoint to extract raw text from PDF pages
app.post('/api/debug/extract-text', upload.single('pdf'), async (req, res) => {
  try {
    if (!req.file) {
      return res.status(400).json({ error: 'No PDF file uploaded' });
    }

    console.log('Extracting raw text for debugging...');
    const textData = await recipeParser.extractRawTextDebug(req.file.buffer);
    
    res.json({
      success: true,
      message: `Extracted text from ${textData.length} pages`,
      pages: textData
    });
  } catch (error) {
    console.error('Error extracting text:', error);
    res.status(500).json({ 
      error: 'Failed to extract text', 
      details: error.message 
    });
  }
});

// Export selected recipes to MacroFactor format
app.post('/api/export/macrofactor', async (req, res) => {
  try {
    const { recipes } = req.body;
    
    if (!recipes || !Array.isArray(recipes)) {
      return res.status(400).json({ error: 'Invalid recipes data' });
    }

    const exportData = await macroFactorExporter.exportRecipes(recipes);
    
    res.json({
      success: true,
      exportData: exportData
    });
  } catch (error) {
    console.error('Error exporting recipes:', error);
    res.status(500).json({ 
      error: 'Failed to export recipes', 
      details: error.message 
    });
  }
});

// Generate shopping list
app.post('/api/generate-shopping-list', async (req, res) => {
  try {
    const { recipes } = req.body;
    
    if (!recipes || !Array.isArray(recipes)) {
      return res.status(400).json({ error: 'Invalid recipes data' });
    }

    const shoppingList = await shoppingListGenerator.generateList(recipes);
    
    res.json({
      success: true,
      shoppingList: shoppingList
    });
  } catch (error) {
    console.error('Error generating shopping list:', error);
    res.status(500).json({ 
      error: 'Failed to generate shopping list', 
      details: error.message 
    });
  }
});

// Error handling middleware
app.use((error, req, res, next) => {
  if (error instanceof multer.MulterError) {
    if (error.code === 'LIMIT_FILE_SIZE') {
      return res.status(400).json({ error: 'File too large' });
    }
  }
  
  console.error('Unhandled error:', error);
  res.status(500).json({ error: 'Internal server error' });
});

app.listen(port, () => {
  console.log(`Recipe PDF Parser server running on http://localhost:${port}`);
});
