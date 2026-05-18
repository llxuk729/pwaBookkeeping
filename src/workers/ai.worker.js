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

async function init() {
  try {
    postMessage({ status: 'init', message: '正在加载 AI 模型...' });
    extractor = await PipelineSingleton.getInstance(x => {
      // We also hook into progress to report loading back to main thread
      postMessage(x);
    });
    
    postMessage({ status: 'init', message: 'AI 模型加载完成。' });
    postMessage({ status: 'ready' });
    
    postMessage({ status: 'ready' });
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
      let itemText = text
        .replace(/\d+\.?\d*/g, '') // remove numbers
        .replace(/号|元|块|钱|¥|￥/g, '') // remove units
        .replace(/昨天|今天|前天|买|了|花费|支付/g, '') // remove common verbs/dates
        .trim();
        
      if (!itemText) itemText = text; // Fallback if we stripped everything

      // Get embedding for the input text
      const output = await extractor(itemText, { pooling: 'mean', normalize: true });
      const inputEmbedding = output.tolist()[0];

      // Find the most similar known item
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
          isNew: isNew
        }
      });
    } catch (error) {
      postMessage({ id, status: 'error', error: error.message });
    }
  }
});
