/**
 * New Parser Pipeline - 基于规则的结构化解析器
 * 
 * Pipeline流程:
 * Speech To Text → Pre Normalize → Tokenizer → Item Splitter → Money FSM → Structured Parser → Validator
 */

import { preNormalize, tokenize, getTokenType } from '../utils/tokenizer.js';
import { splitItems } from '../utils/itemSplitter.js';
import { parseMoney, extractMoneyCandidates } from '../utils/moneyParser.js';
import { validateRecord } from '../utils/validator.js';

// 收入关键词
const incomeKeywords = ['收入', '到账', '入账', '收到', '进账', '收款', '退款'];

// 支出动词
const expenseVerbs = ['花费', '花了', '用掉', '支付', '消费', '付了', '买了', '购买'];

/**
 * 提取日期
 */
function extractDate(text) {
  const datePatterns = [
    /(\d{1,2})[月](\d{1,2})[日]?/,
    /(\d{1,2})[./-](\d{1,2})[号日]/,
  ];
  
  for (const pattern of datePatterns) {
    const match = text.match(pattern);
    if (match) {
      const month = parseInt(match[1], 10);
      const day = parseInt(match[2], 10);
      
      if (month >= 1 && month <= 12 && day >= 1 && day <= 31) {
        const year = new Date().getFullYear();
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
 * 检测收支类型
 */
function detectType(text) {
  if (incomeKeywords.some(kw => text.includes(kw))) {
    return 'income';
  }
  return 'expense';
}

/**
 * 提取商品名称 (移除金额、日期、动词等)
 */
function extractItemName(text) {
  let cleaned = text
    // 移除金额相关
    .replace(/\d+\s*块\s*\d*\s*(?:毛|角)?\s*\d*\s*分?/g, '')
    .replace(/\d+\.?\d*\s*(?:块|元|块钱)/g, '')
    .replace(/(?:¥|￥)\s*\d+\.?\d*/g, '')
    .replace(/([\u4e00-\u9fa5])\s*(\d+\.?\d*)(?=\s*$|\s*[,，;；。.!！])/g, '$1')
    // 移除日期
    .replace(/\d{1,2}[./月-]\d{1,2}[号日]?/g, '')
    .replace(/昨天|今天|前天/g, '')
    // 移除动词
    .replace(new RegExp(expenseVerbs.join('|'), 'g'), '')
    .replace(/[花费了用掉付支付消费买购买]/g, '')
    .trim();
  
  // 清理多余标点和空格
  cleaned = cleaned.replace(/[，,;；。.!！]+/g, ' ').replace(/\s+/g, ' ').trim();
  
  return cleaned || null;
}

/**
 * 解析单个商品项
 * @param {string} itemText - 单个商品文本
 * @param {Array} categories - 可用分类列表
 * @returns {Object|null} 解析结果
 */
function parseSingleItem(itemText, categories = []) {
  // Step 1: 预处理
  const normalized = preNormalize(itemText);
  
  // Step 2: 提取金额 (使用FSM)
  const amount = parseMoney(normalized);
  if (amount === null) {
    return null; // 没有金额则无法记账
  }
  
  // Step 3: 提取商品名
  const itemName = extractItemName(normalized);
  
  // Step 4: 提取日期
  const date = extractDate(normalized);
  
  // Step 5: 检测类型
  const type = detectType(normalized);
  
  // Step 6: 分类匹配 (简化版: 基于关键词)
  const category = matchCategory(itemName || normalized, categories, type);
  
  // Step 7: 构建结果
  // Ensure categoryId is a valid number or null
  let categoryIdValue = null;
  if (category && category.id !== undefined && category.id !== null) {
    const numId = Number(category.id);
    categoryIdValue = isNaN(numId) ? null : numId;
  }
  
  const result = {
    amount,
    categoryId: categoryIdValue,
    categoryName: category?.name || itemName || '未分类',
    note: itemName || '',
    type,
    date,
    weather: '',
    isNewCategory: !category && !!itemName
  };
  
  // Step 8: 验证
  const validation = validateRecord(result);
  if (!validation.success) {
    return null;
  }
  
  return validation.data;
}

/**
 * 简单的分类匹配 (基于关键词)
 * TODO: 后续可接入轻量AI辅助
 */
function matchCategory(text, categories, type) {
  if (!categories || categories.length === 0) {
    return null;
  }
  
  const filteredCategories = categories.filter(c => c.type === type);
  if (filteredCategories.length === 0) {
    return null;
  }
  
  const cleanText = text.toLowerCase().trim();
  let bestMatch = null;
  let maxLen = 0;
  
  for (const cat of filteredCategories) {
    const catName = cat.name.toLowerCase();
    if (cleanText.includes(catName) || catName.includes(cleanText)) {
      if (cat.name.length > maxLen) {
        bestMatch = cat;
        maxLen = cat.name.length;
      }
    }
  }
  
  return bestMatch;
}

/**
 * 主解析函数: 支持单个或多个商品
 * @param {string} input - 用户输入
 * @param {Array} categories - 分类列表
 * @returns {Promise<Array>} 解析结果数组
 */
export async function parse(input, categories = []) {
  if (!input || typeof input !== 'string') {
    return [];
  }
  
  const text = input.trim();
  if (!text) {
    return [];
  }
  
  // Step 1: 分割多个商品项
  const items = splitItems(text);
  
  // Step 2: 解析每个商品项
  const results = [];
  for (const item of items) {
    try {
      const result = parseSingleItem(item, categories);
      if (result) {
        results.push(result);
      }
    } catch (error) {
      // Silently skip failed items
    }
  }
  
  return results;
}

/**
 * 向后兼容: 保留parseInput和parseMultipleItems接口
 */
export async function parseInput(input, categories = []) {
  const results = await parse(input, categories);
  return results.length > 0 ? results[0] : null;
}

export async function parseMultipleItems(input, categories = []) {
  return await parse(input, categories);
}
