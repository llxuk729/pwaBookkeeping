/**
 * AI + Rule-based Parser for Bookkeeping Input
 * Uses a Web Worker with Transformers.js for category extraction,
 * and regex for amount and date.
 */

// Initialize Web Worker
const aiWorker = new Worker(new URL('../workers/ai.worker.js', import.meta.url), { type: 'module' });
aiWorker.postMessage({ type: 'init' });

let resolveMap = {};
let messageIdCounter = 0;

aiWorker.addEventListener('message', (event) => {
  const { id, status, result, error, message } = event.data;
  
  if (status === 'init') {
    console.log('[AI Worker]', message);
  } else if (status === 'ready') {
    console.log('[AI Worker] Ready!');
  } else if (id && resolveMap[id]) {
    if (status === 'success') {
      resolveMap[id].resolve(result);
    } else {
      resolveMap[id].reject(new Error(error));
    }
    delete resolveMap[id];
  }
});

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
    date: extractDate(text)
  };

  // 1. Detect income/expense type
  const isIncome = incomeKeywords.some(kw => text.includes(kw));
  if (isIncome) {
    result.type = 'income';
  }

  // 2. Ask AI Worker for category match
  const id = ++messageIdCounter;
  const matchPromise = new Promise((resolve, reject) => {
    resolveMap[id] = { resolve, reject };
  });
  
  const categoryNames = categories.map(c => c.name);
  aiWorker.postMessage({ id, type: 'parse', text, categories: categoryNames });
  
  try {
    const aiResult = await matchPromise;
    const aiMatchedName = aiResult.matchedItem;
    
    if (aiResult.isNew) {
      result.categoryName = aiMatchedName;
      result.categoryId = null; // Mark as new
      result.isNewCategory = true;
      result.type = 'expense'; // Default new category to expense
    } else if (aiMatchedName) {
      result.categoryName = aiMatchedName;
      // Try to find exact match in DB
      const dbCategory = categories.find(c => c.name === aiMatchedName);
      if (dbCategory) {
        result.categoryId = dbCategory.id;
        result.type = dbCategory.type;
      }
    }
  } catch (error) {
    console.error('AI Parser Error:', error);
  }

  // 3. Clean up note - remove amount and date related text
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

  return result;
}
