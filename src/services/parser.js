import { reactive } from 'vue';

/**
 * @deprecated - This parser is deprecated and will be removed in v2.0
 * Please use newParser.js instead which uses: 
 * - Money FSM for robust amount parsing
 * - Rule-based structured parsing
 * - Valibot for schema validation
 * 
 * This file is kept as emergency fallback only.
 */

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
    aiState.status = 'error';
    aiState.error = err.message || 'Worker 运行时出错';
    aiState.message = 'AI 模块启动失败 (已启用本地解析)';
  });

  aiWorker.postMessage({ type: 'init' });
} catch (e) {
  aiState.status = 'error';
  aiState.error = e.message;
  aiState.message = 'AI 模块不可用 (已启用本地解析)';
}

// Income indicator keywords
const incomeKeywords = ['收入', '到账', '入账', '收到', '进账', '收款', '退款'];

// Common expense verbs (to help identify amount context)
const expenseVerbs = ['花费', '花了', '用掉', '支付', '消费', '付了', '买了', '购买'];

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
  // IMPORTANT: Must exclude patterns that look like amounts (e.g., "25.7")
  // Strategy: Only match if followed by date indicators (号/日) or has specific separators
  const datePatterns = [
    /(\d{1,2})[月](\d{1,2})[日]?/,           // "5月14" or "5月14日"
    /(\d{1,2})[./-](\d{1,2})[号日]/,         // "5.14号", "5-14日" (must have 号/日)
  ];
  
  for (const pattern of datePatterns) {
    const dateMatch = text.match(pattern);
    if (dateMatch) {
      const month = parseInt(dateMatch[1], 10);
      const day = parseInt(dateMatch[2], 10);
      
      // Validate month and day ranges
      if (month >= 1 && month <= 12 && day >= 1 && day <= 31) {
        const year = new Date().getFullYear();
        // Format to YYYY-MM-DD
        return `${year}-${String(month).padStart(2, '0')}-${String(day).padStart(2, '0')}`;
      }
    }
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
 * Extract Amount from string using hybrid approach
 * Combines rule-based patterns with AI semantic understanding
 */
function extractAmount(text) {
  // Strategy: Try multiple patterns in order of specificity
  // Each pattern returns { amount, confidence, pattern }
  
  const candidates = [];
  
  // Pattern 1: Full format with units - "X块Y毛Z分"
  const fullPattern = /(\d+)\s*块\s*(\d{1,2})\s*(?:毛|角)\s*(\d{1,2})\s*分?/;
  const fullMatch = text.match(fullPattern);
  if (fullMatch) {
    const yuan = parseInt(fullMatch[1], 10);
    const jiao = parseInt(fullMatch[2], 10);
    const fen = parseInt(fullMatch[3], 10);
    const amount = yuan + (jiao / 10) + (fen / 100);
    candidates.push({
      amount: parseFloat(amount.toFixed(2)),
      confidence: 0.95,
      pattern: 'full',
      match: fullMatch[0]
    });
  }
  
  // Pattern 2: With mao/jiao only - "X块Y毛"
  const maoPattern = /(\d+)\s*块\s*(\d{1,2})\s*(?:毛|角)/;
  const maoMatch = text.match(maoPattern);
  if (maoMatch) {
    const yuan = parseInt(maoMatch[1], 10);
    const jiao = parseInt(maoMatch[2], 10);
    const amount = yuan + (jiao / 10);
    candidates.push({
      amount: parseFloat(amount.toFixed(2)),
      confidence: 0.9,
      pattern: 'mao',
      match: maoMatch[0]
    });
  }
  
  // Pattern 3: With fen only - "X块Z分"
  const fenPattern = /(\d+)\s*块\s*(\d{1,2})\s*分/;
  const fenMatch = text.match(fenPattern);
  if (fenMatch) {
    const yuan = parseInt(fenMatch[1], 10);
    const fen = parseInt(fenMatch[2], 10);
    const amount = yuan + (fen / 100);
    candidates.push({
      amount: parseFloat(amount.toFixed(2)),
      confidence: 0.85,
      pattern: 'fen',
      match: fenMatch[0]
    });
  }
  
  // Pattern 4: Currency symbols - "¥35", "35元"
  const currencyPatterns = [
    { regex: /(\d+\.?\d*)\s*(块|元|块钱)/, name: 'yuan_unit' },
    { regex: /(¥|￥)\s*(\d+\.?\d*)/, name: 'currency_symbol' }
  ];
  
  for (const cp of currencyPatterns) {
    const match = text.match(cp.regex);
    if (match) {
      const numStr = cp.name === 'currency_symbol' ? match[2] : match[1];
      const amount = parseFloat(numStr);
      if (amount > 0 && amount < 10000000) {
        candidates.push({
          amount: parseFloat(amount.toFixed(2)),
          confidence: 0.88,
          pattern: cp.name,
          match: match[0]
        });
        break; // Only take the first currency pattern match
      }
    }
  }
  
  // Pattern 5: No units after "块" - "X块Y" 
  // Ambiguous case: could be "X.Y yuan" or "X yuan Y fen"
  // Heuristic: If Y is 1-9, treat as jiao (0.Y); if Y is 10-99, treat as fen (0.0Y)
  // Examples:
  // - "12块4" -> 12.4 (4 is single digit, likely jiao)
  // - "4块23" -> 4.23 (23 is two digits, likely fen)
  const noUnitPattern = /(\d+)\s*块\s*(\d{1,2})(?!\s*(?:毛|角|分|块|元))/;
  const noUnitMatch = text.match(noUnitPattern);
  if (noUnitMatch) {
    const yuan = parseInt(noUnitMatch[1], 10);
    const suffix = parseInt(noUnitMatch[2], 10);
    
    let amount;
    let explanation;
    
    if (suffix >= 10) {
      // Two-digit number: treat as fen (cents)
      // "4块23" -> 4.23
      amount = yuan + (suffix / 100);
      explanation = `${suffix} as fen (0.${suffix})`;
    } else {
      // Single digit: treat as jiao (dimes)
      // "12块4" -> 12.4
      amount = yuan + (suffix / 10);
      explanation = `${suffix} as jiao (0.${suffix})`;
    }
    
    candidates.push({
      amount: parseFloat(amount.toFixed(2)),
      confidence: 0.75, // Lower confidence because it's ambiguous
      pattern: 'no_unit',
      match: noUnitMatch[0],
      explanation: explanation
    });
  }
  
  // Pattern 6: Standalone number at end - "大豆 123"
  const standalonePattern = /[\u4e00-\u9fa5\s]+(\d+\.?\d*)\s*$/;
  const standaloneMatch = text.match(standalonePattern);
  if (standaloneMatch) {
    const amount = parseFloat(standaloneMatch[1]);
    if (amount > 0 && amount < 10000000) {
      candidates.push({
        amount: parseFloat(amount.toFixed(2)),
        confidence: 0.7,
        pattern: 'standalone',
        match: standaloneMatch[1]
      });
    }
  }
  
  // Select the best candidate based on confidence and position
  if (candidates.length > 0) {
    // Sort by confidence (descending), then by position in text (ascending)
    candidates.sort((a, b) => {
      if (b.confidence !== a.confidence) {
        return b.confidence - a.confidence;
      }
      return text.indexOf(a.match) - text.indexOf(b.match);
    });
    
    const best = candidates[0];
    return best.amount;
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
 * Lightweight semantic analysis for bookkeeping text
 * Identifies: item name, amount, date, type without heavy AI models
 */
function analyzeBookkeepingText(text) {
  const result = {
    itemName: '',
    amount: null,
    hasAmount: false,
    hasDate: false,
    type: 'expense'
  };

  // 1. Detect income/expense type
  if (incomeKeywords.some(kw => text.includes(kw))) {
    result.type = 'income';
  }

  // 2. Check if text has expense verbs
  const hasExpenseVerb = expenseVerbs.some(verb => text.includes(verb));

  // 3. Extract amount
  const amount = extractAmount(text);
  if (amount !== null) {
    result.amount = amount;
    result.hasAmount = true;
  }

  // 4. Extract date
  const date = extractDate(text);
  if (date !== new Date().toISOString().split('T')[0]) {
    result.hasDate = true;
  }

  // 5. Extract item name (Chinese characters before the amount)
  // Pattern: "大豆 123" -> "大豆"
  // Pattern: "买大米花了50" -> "大米"
  // Pattern: "小米5" -> "小米"
  let cleanText = text
    // Remove complex currency patterns first (highest priority)
    .replace(/\d+\s*块\s*\d*\s*(?:毛|角)?\s*\d*\s*分?/g, '')  // "40块2毛8分"
    // Remove amounts with currency units
    .replace(/\d+\.?\d*\s*(?:块|元|块钱)/g, '')  // "35块", "35元"
    .replace(/(?:¥|￥)\s*\d+\.?\d*/g, '')  // "¥35"
    // Remove standalone numbers that are likely amounts
    // Match: Chinese + optional space + number (at end or followed by space/punctuation)
    .replace(/([\u4e00-\u9fa5])\s*(\d+\.?\d*)(?=\s*$|\s*[,，;；。.!！])/g, '$1')  // "小米5" -> "小米", "大米 4," -> "大米"
    .replace(/([\u4e00-\u9fa5])\s+(\d+\.?\d*)(?=\s*$|\s*[,，;；。.!！])/g, '$1')  // "大豆 123" -> "大豆"
    // Also handle numbers at the very end of text
    .replace(/([\u4e00-\u9fa5])\s*(\d+\.?\d*)\s*$/g, '$1')  // Fallback for end of string
    // Remove date patterns
    .replace(/\d{1,2}[./月-]\d{1,2}[号日]?/g, '')
    .replace(/昨天|今天|前天/g, '')
    // Remove verbs
    .replace(new RegExp(expenseVerbs.join('|'), 'g'), '')
    .replace(/[花费了用掉付支付消费买购买]/g, '')
    .trim();

  // Clean up extra spaces and punctuation
  cleanText = cleanText.replace(/[，,;；。.!！]+/g, ' ').replace(/\s+/g, ' ').trim();

  if (cleanText) {
    result.itemName = cleanText;
  }

  return result;
}

/**
 * Split input text into multiple items
 * Supports patterns like: "小米5块，大米10块" or "小米5块 大米10块"
 */
function splitMultipleItems(text) {
  // Split by common separators: comma, semicolon
  // For space separator: only split if followed by Chinese characters (new item name)
  // NOT if followed by a number (which is likely an amount for the current item)
  // 
  // Examples:
  // - "大米 4，小米50" → ["大米 4", "小米50"] ✅ (comma separator)
  // - "玉米 46块8毛3" → ["玉米 46块8毛3"] ✅ (space before number, not split)
  // - "小米5块 大米10块" → ["小米5块", "大米10块"] ✅ (space before Chinese char)
  const separators = /[,，;；]|\s+(?=[\u4e00-\u9fa5])/;
  const parts = text.split(separators).filter(part => part.trim());
  
  return parts;
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

  // 2. Use lightweight semantic analysis to extract item name
  const semanticAnalysis = analyzeBookkeepingText(text);
  
  // 3. Clean up note - use semantic analysis result if available, otherwise fallback to regex
  let note = semanticAnalysis.itemName || text
    .replace(/[花费了用掉付支付消费]*\s*\d+\.?\d*\s*(块|元|¥|￥)?/g, '')
    .replace(/(¥|￥)\s*\d+\.?\d*/g, '')
    .replace(/\d+\.?\d*\s*(块|元)/g, '')
    // 新增：清理复杂货币格式，如 "40块2" 或 "40块2毛8分"
    .replace(/\d+\s*块\s*\d*\s*(?:毛|角)?\s*\d*\s*分?/g, '')
    .replace(/\d{1,2}[./月-]\d{1,2}[号日]?/g, '')
    .replace(/昨天|今天|前天/g, '')
    .trim();

  if (note) {
    result.note = note;
  }

  // 4. Category match (AI with 3s Timeout or Rule-based fallback)
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
      
      // Use AI's cleaned text for better note extraction (fallback to semantic analysis)
      if (aiResult.cleanedText && aiResult.cleanedText !== text) {
        result.note = aiResult.cleanedText;
      } else if (semanticAnalysis.itemName) {
        // If AI didn't provide cleaned text, use our lightweight semantic analysis
        result.note = semanticAnalysis.itemName;
      }
    } catch (error) {
      matchedCategory = ruleBasedCategoryMatch(result.note, categories);
    }
  } else {
    // Elegant degradation: Rule-based parsing
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

/**
 * Parse multiple items from a single input
 * @param {string} input - Natural language input text with multiple items
 * @param {Array} categories - Available categories from database
 * @returns {Promise<Array>} Array of parsed results
 */
export async function parseMultipleItems(input, categories = []) {
  if (!input || typeof input !== 'string') {
    return [];
  }

  const text = input.trim();
  if (!text) return [];

  // Split into multiple items
  const items = splitMultipleItems(text);
  
  // If only one item, use the original parseInput
  if (items.length <= 1) {
    const result = await parseInput(text, categories);
    return result ? [result] : [];
  }

  // Parse each item separately
  const results = [];
  for (const item of items) {
    try {
      const result = await parseInput(item, categories);
      if (result) {
        results.push(result);
      }
    } catch (error) {
      // Silently skip failed items
    }
  }

  return results;
}
