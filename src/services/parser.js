import { reactive } from 'vue';

/**
 * AI + Rule-based Parser for Bookkeeping Input
 * Uses a Web Worker with Transformers.js for category extraction,
 * and regex for amount and date.
 */

// Export AI status state so Vue components can react to it
export const aiState = reactive({
  status: 'loading', // 'loading', 'ready', 'error'
  progress: 0,
  message: '正在初始化 AI 模块...',
  error: null
});

// Initialize Web Worker with error handling for devices like iPhone that may fail to initialize modules/WASM
let aiWorker = null;
let resolveMap = {};
let messageIdCounter = 0;

try {
  aiWorker = new Worker(new URL('../workers/ai.worker.js', import.meta.url), { type: 'module' });
  
  aiWorker.addEventListener('message', (event) => {
    const data = event.data;
    
    if (data.status === 'init') {
      aiState.status = 'loading';
      aiState.message = data.message;
    } else if (data.status === 'ready') {
      aiState.status = 'ready';
      aiState.progress = 100;
      aiState.message = 'AI 模型已就绪';
    } else if (data.status === 'progress') {
      aiState.status = 'loading';
      aiState.progress = Math.round(data.progress || 0);
      aiState.message = `正在加载 AI 模型: ${Math.round(data.progress || 0)}%`;
    } else if (data.status === 'error') {
      aiState.status = 'error';
      aiState.error = data.error;
      aiState.message = `AI 模型不可用: ${data.error}`;
    } else if (data.id && resolveMap[data.id]) {
      if (data.status === 'success') {
        resolveMap[data.id].resolve(data.result);
      } else {
        resolveMap[data.id].reject(new Error(data.error));
      }
      delete resolveMap[data.id];
    }
  });

  aiWorker.addEventListener('error', (err) => {
    console.error('[AI Worker] Runtime error:', err);
    aiState.status = 'error';
    aiState.error = err.message || 'Worker 运行时出错';
    aiState.message = 'AI 模块启动失败 (已启用本地解析)';
  });

  aiWorker.postMessage({ type: 'init' });
} catch (e) {
  console.error('[AI Worker] Creation failed:', e);
  aiState.status = 'error';
  aiState.error = e.message;
  aiState.message = 'AI 模块不可用 (已启用本地解析)';
}

// Income indicator keywords
const incomeKeywords = ['收入', '到账', '入账', '收到', '进账', '收款', '退款'];

// Amount extraction patterns (ordered by priority)
const amountPatterns = [
  /(\d+\.?\d*)\s*(块|元|¥|￥)/,        // "35块", "35元", "35¥"
  /[花费了用掉付支付消费]*\s*(\d+\.?\d*)/, // "花了35", "花费35"
  /(¥|￥)\s*(\d+\.?\d*)/,                // "¥35"
];

/**
 * Extract Date from string
 */
function extractDate(text) {
  // Match "5.14号", "5月14日", "5-14"
  const dateMatch = text.match(/(\d{1,2})[./月-](\d{1,2})[号日]?/);
  if (dateMatch) {
    const month = parseInt(dateMatch[1], 10);
    const day = parseInt(dateMatch[2], 10);
    const year = new Date().getFullYear();
    // Format to YYYY-MM-DD
    return `${year}-${String(month).padStart(2, '0')}-${String(day).padStart(2, '0')}`;
  }
  
  if (text.includes('昨天')) {
    const yesterday = new Date();
    yesterday.setDate(yesterday.getDate() - 1);
    return yesterday.toISOString().split('T')[0];
  } else if (text.includes('前天')) {
    const dayBefore = new Date();
    dayBefore.setDate(dayBefore.getDate() - 2);
    return dayBefore.toISOString().split('T')[0];
  }
  
  return new Date().toISOString().split('T')[0];
}

/**
 * Extract Amount from string
 */
function extractAmount(text) {
  for (const pattern of amountPatterns) {
    const match = text.match(pattern);
    if (match) {
      const numStr = match[2] && !isNaN(match[2]) ? match[2] : match[1];
      const num = parseFloat(numStr);
      if (num > 0 && num < 10000000) {
        return num;
      }
    }
  }
  // Try to find any standalone number if previous failed
  const standaloneMatch = text.match(/(\d+\.?\d*)/);
  if (standaloneMatch) {
    return parseFloat(standaloneMatch[1]);
  }
  return null;
}

/**
 * Rule-based category matching (Elegant degradation fallback)
 */
function ruleBasedCategoryMatch(text, categories) {
  if (!text || !categories || categories.length === 0) return null;
  
  const cleanText = text.toLowerCase().trim();
  let bestMatch = null;
  let maxLen = 0;

  for (const cat of categories) {
    const catName = cat.name.toLowerCase();
    // Substring match: if text contains category name, or category name contains text
    if (cleanText.includes(catName) || catName.includes(cleanText)) {
      // Prioritize the longest matching category name to be more precise
      // e.g. "粉丝煎饺" is a better match for "煎饺" than "粉丝"
      if (cat.name.length > maxLen) {
        bestMatch = cat;
        maxLen = cat.name.length;
      }
    }
  }
  return bestMatch;
}

/**
 * Parse natural language input to extract bookkeeping information
 * @param {string} input - Natural language input text
 * @param {Array} categories - Available categories from database
 * @returns {Promise<Object>} Parsed result
 */
export async function parseInput(input, categories = []) {
  if (!input || typeof input !== 'string') {
    return null;
  }

  const text = input.trim();
  if (!text) return null;

  const result = {
    amount: extractAmount(text),
    categoryId: null,
    categoryName: null,
    note: text,
    type: 'expense',
    date: extractDate(text),
    weather: '' // Initialize weather field
  };

  // 1. Detect income/expense type
  const isIncome = incomeKeywords.some(kw => text.includes(kw));
  if (isIncome) {
    result.type = 'income';
  }

  // 2. Clean up note - remove amount and date related text
  let note = text
    .replace(/[花费了用掉付支付消费]*\s*\d+\.?\d*\s*(块|元|¥|￥)?/g, '')
    .replace(/(¥|￥)\s*\d+\.?\d*/g, '')
    .replace(/\d+\.?\d*\s*(块|元)/g, '')
    .replace(/\d{1,2}[./月-]\d{1,2}[号日]?/g, '')
    .replace(/昨天|今天|前天/g, '')
    .trim();

  if (note) {
    result.note = note;
  }

  // 3. Category match (AI with 3s Timeout or Rule-based fallback)
  let matchedCategory = null;
  let isNewCategory = false;
  let categoryName = null;

  if (aiState.status === 'ready' && aiWorker) {
    const id = ++messageIdCounter;
    const matchPromise = new Promise((resolve, reject) => {
      // 3-second timeout for mobile/iPhone robustness
      const timeout = setTimeout(() => {
        reject(new Error('AI matching timeout'));
      }, 3000);

      resolveMap[id] = {
        resolve: (res) => {
          clearTimeout(timeout);
          resolve(res);
        },
        reject: (err) => {
          clearTimeout(timeout);
          reject(err);
        }
      };
    });

    const categoryNames = categories.map(c => c.name);
    aiWorker.postMessage({ id, type: 'parse', text, categories: categoryNames });

    try {
      const aiResult = await matchPromise;
      const aiMatchedName = aiResult.matchedItem;

      if (aiResult.isNew) {
        categoryName = aiMatchedName;
        isNewCategory = true;
      } else if (aiMatchedName) {
        categoryName = aiMatchedName;
        matchedCategory = categories.find(c => c.name === aiMatchedName);
      }
    } catch (error) {
      console.warn('AI Parser failed or timed out, falling back to rule-based matching:', error);
      matchedCategory = ruleBasedCategoryMatch(result.note, categories);
    }
  } else {
    // Elegant degradation: Rule-based parsing
    console.log('AI model not ready or error. Utilizing rule-based fallback.');
    matchedCategory = ruleBasedCategoryMatch(result.note, categories);
  }

  if (matchedCategory) {
    result.categoryId = matchedCategory.id;
    result.categoryName = matchedCategory.name;
    result.type = matchedCategory.type;
  } else if (isNewCategory && categoryName) {
    result.categoryName = categoryName;
    result.categoryId = null; // Mark as new
    result.isNewCategory = true;
    result.type = 'expense'; // Default new category to expense
  } else if (categoryName) {
    // Fallback if matched by AI but has some other name
    result.categoryName = categoryName;
  }

  return result;
}
