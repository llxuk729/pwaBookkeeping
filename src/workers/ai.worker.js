import { pipeline, env } from '@xenova/transformers';

// Configure transformers.js to use the local models
env.allowRemoteModels = false;
env.localModelPath = import.meta.env.BASE_URL + 'models/';

// Use a singleton pattern to keep the pipeline in memory
class PipelineSingleton {
  static task = 'feature-extraction';
  static model = 'Xenova/bge-small-zh-v1.5';
  static instance = null;

  static async getInstance(progress_callback = null) {
    if (this.instance === null) {
      // Use the quantized version for faster loading and less memory
      this.instance = pipeline(this.task, this.model, { 
        quantized: true,
        progress_callback 
      });
    }
    return this.instance;
  }
}

// Dynamic item embeddings cache
let currentCategories = [];
let itemEmbeddings = [];
let extractor = null;

// Lazy loading flag
let modelLoaded = false;

/**
 * Ensure model is loaded (lazy loading)
 */
async function ensureModelLoaded() {
  if (modelLoaded) return;
  
  postMessage({ status: 'init', message: '正在加载AI模型...' });
  extractor = await PipelineSingleton.getInstance(x => {
    postMessage(x);
  });
  modelLoaded = true;
  
  postMessage({ status: 'ready' });
}

async function init() {
  try {
    // Don't auto-load model, just mark as ready for lazy loading
    postMessage({ status: 'ready', message: 'AI模块就绪(按需加载)' });
  } catch (error) {
    postMessage({ status: 'error', error: error.message });
  }
}

// Cosine similarity function
function cosineSimilarity(vecA, vecB) {
  let dotProduct = 0;
  let normA = 0;
  let normB = 0;
  for (let i = 0; i < vecA.length; i++) {
    dotProduct += vecA[i] * vecB[i];
    normA += vecA[i] * vecA[i];
    normB += vecB[i] * vecB[i];
  }
  if (normA === 0 || normB === 0) return 0;
  return dotProduct / (Math.sqrt(normA) * Math.sqrt(normB));
}

self.addEventListener('message', async (event) => {
  const { id, text, type, categories } = event.data;

  if (type === 'init') {
    await init();
    return;
  }

  if (type === 'parse') {
    // Lazy load model when parse is requested
    await ensureModelLoaded();
    
    if (!extractor) {
      postMessage({ id, status: 'error', error: 'AI模型尚未就绪' });
      return;
    }
    try {
      // Update embeddings if categories changed
      if (categories && categories.length > 0) {
        // Simple check if categories changed (checking length and first/last items is usually enough for this small app, 
        // but we can just check a serialized version or recompute if it's fast. Let's do a strict join check)
        const catsKey = categories.join('|');
        const currentKey = currentCategories.join('|');
        if (catsKey !== currentKey) {
          const output = await extractor(categories, { pooling: 'mean', normalize: true });
          itemEmbeddings = output.tolist();
          currentCategories = [...categories];
        }
      }

      // First, use regex to strip out numbers, dates and units to isolate the "item" part
      // Improved cleaning logic to better extract item names
      let itemText = text
        // Remove complex currency patterns: "40块2毛8分", "40块2", etc.
        .replace(/\d+\s*块\s*\d*\s*(?:毛|角)?\s*\d*\s*分?/g, '')
        // Remove simple currency patterns: "40元", "¥40", "40块钱"
        .replace(/(?:¥|￥)\s*\d+\.?\d*/g, '')
        .replace(/\d+\.?\d*\s*(?:块|元|块钱)/g, '')
        // Remove standalone numbers (amounts without currency units): "大米 4" -> "大米", "小米50" -> "小米"
        .replace(/([\u4e00-\u9fa5])\s*(\d+\.?\d*)(?=\s*$|\s*[,，;；。.!！])/g, '$1')
        .replace(/([\u4e00-\u9fa5])\s+(\d+\.?\d*)(?=\s*$|\s*[,，;；。.!！])/g, '$1')
        .replace(/(\d+\.?\d*)\s*$/g, '')  // Fallback: remove trailing numbers
        // Remove date patterns: "5.14号", "5月14日", "昨天", etc.
        .replace(/\d{1,2}[./月-]\d{1,2}[号日]?/g, '')
        .replace(/昨天|今天|前天/g, '')
        // Remove common verbs and filler words
        .replace(/买|了|花费|支付|消费|用掉|付/g, '')
        // Clean up extra spaces
        .trim();
        
      if (!itemText) itemText = text; // Fallback if we stripped everything

      // Get embedding for the input text
      const output = await extractor(itemText, { pooling: 'mean', normalize: true });
      const inputEmbedding = output.tolist()[0];

      // Calculate embedding similarities using cosine similarity
      let bestMatch = null;
      let highestSimilarity = -1;
      
      if (currentCategories.length > 0) {
        for (let i = 0; i < currentCategories.length; i++) {
          const sim = cosineSimilarity(inputEmbedding, itemEmbeddings[i]);
          if (sim > highestSimilarity) {
            highestSimilarity = sim;
            bestMatch = currentCategories[i];
          }
        }
      }

      // If similarity is below threshold, consider it a new category
      let isNew = false;
      const SIMILARITY_THRESHOLD = 0.75; 
      
      if (highestSimilarity < SIMILARITY_THRESHOLD) {
        bestMatch = itemText; 
        isNew = true;
      }

      postMessage({
        id,
        status: 'success',
        result: {
          matchedItem: bestMatch,
          similarity: highestSimilarity,
          isNew: isNew,
          cleanedText: itemText // Return the cleaned item text for better note extraction
        }
      });
    } catch (error) {
      postMessage({ id, status: 'error', error: error.message });
    }
  }
});
