/**
 * Item Splitter - 多商品分割器
 * 将输入文本分割为多个独立的商品项
 * 
 * 支持格式:
 * - "小米5块,大米10块" (逗号分隔)
 * - "小米5块 大米10块" (空格+中文开头)
 * - "豆腐3块5可乐2块" (需要智能识别边界)
 */

import { tokenizeText, preNormalize } from './tokenizer.js';
import { parseMoney } from './moneyParser.js';

/**
 * 分割多个商品项
 * @param {string} text - 原始输入文本
 * @returns {string[]} 分割后的商品项数组
 */
export function splitItems(text) {
  if (!text || typeof text !== 'string') {
    return [];
  }
  
  const normalized = preNormalize(text);
  
  // 策略1: 按明确的分隔符分割 (逗号、分号)
  const separatorPattern = /[,，;；]/;
  if (separatorPattern.test(normalized)) {
    return normalized.split(separatorPattern)
      .map(item => item.trim())
      .filter(item => item.length > 0);
  }
  
  // 策略2: 按"空格+中文字符"分割 (新商品开始)
  // 关键: 不分割"玉米 46块8毛3"这样的空格(后面是数字)
  const spaceBeforeChinese = /\s+(?=[\u4e00-\u9fa5])/;
  const parts = normalized.split(spaceBeforeChinese)
    .map(item => item.trim())
    .filter(item => item.length > 0);
  
  // 如果分割后只有1项,尝试智能分割
  if (parts.length === 1) {
    return smartSplit(normalized);
  }
  
  return parts;
}

/**
 * 智能分割: 处理无明确分隔符的情况
 * 例如: "豆腐3块5可乐2块" -> ["豆腐3块5", "可乐2块"]
 */
function smartSplit(text) {
  const tokens = tokenizeText(text);
  const items = [];
  let currentItem = [];
  
  for (let i = 0; i < tokens.length; i++) {
    const token = tokens[i];
    const nextToken = tokens[i + 1];
    
    currentItem.push(token);
    
    // 检测商品边界: 金额结束后紧跟中文字符
    // 例如: "...3块5" + "可乐"
    if (nextToken && isChinese(nextToken)) {
      // 检查当前累积是否包含金额
      const currentText = currentItem.join('');
      if (parseMoney(currentText) !== null) {
        // 当前项有金额,下一项是新商品
        items.push(currentText);
        currentItem = [];
      }
    }
  }
  
  // 添加最后一项
  if (currentItem.length > 0) {
    items.push(currentItem.join(''));
  }
  
  return items.length > 0 ? items : [text];
}

/**
 * 判断是否为中文字符
 */
function isChinese(str) {
  return /^[\u4e00-\u9fa5]+$/.test(str);
}
