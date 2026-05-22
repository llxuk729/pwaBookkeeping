/**
 * Item Splitter - 多商品分割器
 * 
 * 功能说明:
 * 将包含多个商品的输入文本分割为独立的商品项,便于逐一解析
 * 
 * 支持的格式:
 * - 逗号分隔: "小米5块,大米10块" -> ["小米5块", "大米10块"]
 * - 空格+中文: "小米5块 大米10块" -> ["小米5块", "大米10块"]
 * - 智能识别: "豆腐3块5可乐2块" -> ["豆腐3块5", "可乐2块"]
 * 
 * 设计原则:
 * - 优先使用明确的分隔符(逗号、分号)
 * - 其次利用"空格+中文字符"模式识别新商品开始
 * - 最后使用智能算法检测金额边界
 * - 避免错误分割如"玉米 46块8毛3"中的空格
 */

import { tokenizeText, preNormalize } from './tokenizer.js';
import { parseMoney } from './moneyParser.js';

/**
 * 主函数: 分割多个商品项
 * 
 * 算法流程(三级策略):
 * 
 * 策略1: 按明确的分隔符分割
 * - 检测逗号(,/，)和分号(;/；)
 * - 直接split分割,简单高效
 * - 示例: "小米5块,大米10块" -> ["小米5块", "大米10块"]
 * 
 * 策略2: 按"空格+中文字符"分割
 * - 使用正则 /\s+(?=[\u4e00-\u9fa5])/ 匹配空格后跟中文的位置
 * - 关键: 不分割"玉米 46块8毛3"这样的空格(后面是数字,不是新商品)
 * - 示例: "小米5块 大米10块" -> ["小米5块", "大米10块"]
 * 
 * 策略3: 智能分割(无明确分隔符时)
 * - 调用smartSplit函数进行边界检测
 * - 通过token分析和金额解析识别商品边界
 * - 示例: "豆腐3块5可乐2块" -> ["豆腐3块5", "可乐2块"]
 * 
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
 * 智能分割函数: 处理无明确分隔符的复杂情况
 * 
 * 核心算法:
 * 1. 对文本进行分词(tokenize)
 * 2. 逐个token累积,检测商品边界
 * 3. 边界判断条件: 当前累积文本包含有效金额 + 下一个token是中文字符
 * 
 * 边界检测逻辑:
 * - 遍历tokens,将每个token加入currentItem
 * - 检查nextToken是否为中文字符
 * - 如果是,检查currentItem是否能解析出金额
 * - 如果能解析出金额,说明当前商品结束,下一商品开始
 * 
 * 示例分析 "豆腐3块5可乐2块":
 * tokens: ["豆腐", "3", "块", "5", "可乐", "2", "块"]
 * 
 * 迭代过程:
 * 1. currentItem = ["豆腐"]
 * 2. currentItem = ["豆腐", "3"]
 * 3. currentItem = ["豆腐", "3", "块"]
 * 4. currentItem = ["豆腐", "3", "块", "5"]
 *    - nextToken = "可乐" (中文)
 *    - parseMoney("豆腐3块5") = 3.5 ✓ 有金额
 *    - 边界 detected! items.push("豆腐3块5"), currentItem = []
 * 5. currentItem = ["可乐"]
 * 6. currentItem = ["可乐", "2"]
 * 7. currentItem = ["可乐", "2", "块"]
 * 8. 循环结束,添加最后一项 "可乐2块"
 * 
 * 结果: ["豆腐3块5", "可乐2块"]
 * 
 * @param {string} text - 待分割的文本
 * @returns {string[]} 分割后的商品项数组
 */
function smartSplit(text) {
  const tokens = tokenizeText(text);  // 分词
  const items = [];                    // 存储分割结果
  let currentItem = [];                // 当前正在累积的商品项
  
  for (let i = 0; i < tokens.length; i++) {
    const token = tokens[i];
    const nextToken = tokens[i + 1];   // 下一个token(可能为undefined)
    
    currentItem.push(token);           // 将当前token加入累积
    
    // 检测商品边界: 金额结束后紧跟中文字符
    // 例如: "...3块5" + "可乐"
    if (nextToken && isChinese(nextToken)) {
      // 检查当前累积是否包含有效金额
      const currentText = currentItem.join('');
      if (parseMoney(currentText) !== null) {
        // 当前项有金额,下一项是新商品 -> 触发边界分割
        items.push(currentText);
        currentItem = [];  // 重置,开始累积新商品
      }
    }
  }
  
  // 添加最后一项(如果有)
  if (currentItem.length > 0) {
    items.push(currentItem.join(''));
  }
  
  // 如果未能分割,返回原文本作为单一项
  return items.length > 0 ? items : [text];
}

/**
 * 辅助函数: 判断字符串是否为纯中文字符
 * 
 * 使用Unicode范围 [\u4e00-\u9fa5] 匹配常用汉字
 * 用于智能分割时的边界检测
 * 
 * @param {string} str - 待判断的字符串
 * @returns {boolean} 是否为纯中文字符
 */
function isChinese(str) {
  return /^[\u4e00-\u9fa5]+$/.test(str);
}
