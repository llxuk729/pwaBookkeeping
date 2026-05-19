/**
 * Tokenizer - 中文分词与文本切分
 * 
 * Using simple regex-based tokenization as primary method for now.
 * Can be enhanced with server-side preprocessing or alternative libraries later.
 */

/**
 * Simple but effective Chinese tokenizer using regex
 * Splits by common patterns while preserving meaningful chunks
 */
export function tokenize(text) {
  if (!text || typeof text !== 'string') {
    return [];
  }
  
  // Strategy: Split by spaces and punctuation, keep Chinese character groups together
  // Note: Don't split on '.' as it's part of decimal numbers (e.g., 223.5)
  const tokens = [];
  let current = '';
  
  for (let i = 0; i < text.length; i++) {
    const char = text[i];
    
    // If it's a space or punctuation (but NOT dot for decimals), push current token
    if (/\s|[，,;；。!！]/.test(char)) {
      if (current) {
        tokens.push(current);
        current = '';
      }
      // Skip pure whitespace, keep punctuation as separate tokens if needed
      if (/[^\s]/.test(char)) {
        tokens.push(char);
      }
    } else {
      current += char;
    }
  }
  
  // Don't forget the last token
  if (current) {
    tokens.push(current);
  }
  
  return tokens.filter(t => t.trim().length > 0);
}

/**
 * 对文本进行分词
 * @param {string} text - 输入文本
 * @returns {string[]} 分词结果数组
 */
export function tokenizeText(text) {
  return tokenize(text);
}

/**
 * 预处理: 标准化文本
 * - 去除多余空格
 * - 统一标点符号
 * - 全角转半角数字
 */
export function preNormalize(text) {
  if (!text || typeof text !== 'string') {
    return '';
  }
  
  return text
    .replace(/\s+/g, ' ')           // 合并多个空格
    .replace(/[，,;；!！]/g, ',')    // 统一标点 (注意: 不包含.和。,避免破坏小数)
    .replace(/[\uff10-\uff19]/g, (c) => String.fromCharCode(c.charCodeAt(0) - 0xfee0)) // 全角数字转半角
    .trim();
}

/**
 * 识别token类型
 * @returns {'NUMBER' | 'CHINESE' | 'CURRENCY' | 'DATE' | 'VERB' | 'OTHER'}
 */
export function getTokenType(token) {
  // 数字
  if (/^\d+\.?\d*$/.test(token)) {
    return 'NUMBER';
  }
  
  // 货币符号
  if (/^[¥￥块元毛角分钱]$/.test(token)) {
    return 'CURRENCY';
  }
  
  // 日期关键词
  if (/^(今天|昨天|前天|\d+[月日号])$/.test(token)) {
    return 'DATE';
  }
  
  // 动词
  const verbs = ['买', '花费', '支付', '消费', '用掉', '付'];
  if (verbs.includes(token)) {
    return 'VERB';
  }
  
  // 中文字符
  if (/^[\u4e00-\u9fa5]+$/.test(token)) {
    return 'CHINESE';
  }
  
  return 'OTHER';
}
