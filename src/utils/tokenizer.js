/**
 * Tokenizer - 中文分词与文本切分模块
 * 
 * 功能说明:
 * 1. 将原始输入文本切分为有意义的token单元
 * 2. 识别每个token的类型(数字、货币、日期、动词等)
 * 3. 为后续的金额解析和商品分割提供基础数据
 * 
 * 设计原则:
 * - 保持简单高效,使用正则表达式实现
 * - 保留小数点以支持金额格式(如223.5)
 * - 中文词汇尽量保持完整,避免过度切分
 */

/**
 * 核心分词函数 - 基于规则的中文分词器
 * 
 * 算法流程:
 * 1. 逐字符扫描输入文本
 * 2. 遇到空格或标点符号时,将当前累积的token推入结果数组
 * 3. 跳过纯空白字符,保留标点作为独立token
 * 4. 中文字符和数字字符连续累积为一个token
 * 
 * 示例:
 * - "小米5块" -> ["小米", "5", "块"]
 * - "豆腐3块5可乐2块" -> ["豆腐", "3", "块", "5", "可乐", "2", "块"]
 * - "今天买苹果223.5元" -> ["今天", "买", "苹果", "223.5", "元"]
 * 
 * @param {string} text - 待分词的原始文本
 * @returns {string[]} 分词后的token数组
 */
export function tokenize(text) {
  if (!text || typeof text !== 'string') {
    return [];
  }
  
  // 策略: 按空格和标点符号切分,保持中文字符组和数字的完整性
  // 注意: 不将 '.' 作为分隔符,因为它是小数的一部分(如 223.5)
  const tokens = [];
  let current = '';
  
  for (let i = 0; i < text.length; i++) {
    const char = text[i];
    
    // 如果当前字符是空格或标点(但不包括小数点),则将累积的token推入结果
    if (/\s|[，,;；。!！]/.test(char)) {
      if (current) {
        tokens.push(current);
        current = '';
      }
      // 跳过纯空白字符,非空白的标点符号作为独立token保留
      if (/[^\s]/.test(char)) {
        tokens.push(char);
      }
    } else {
      current += char;
    }
  }
  
  // 不要忘记最后一个token
  if (current) {
    tokens.push(current);
  }
  
  return tokens.filter(t => t.trim().length > 0);
}

/**
 * 文本分词别名函数
 * 
 * 提供语义化的API名称,便于理解调用意图
 * 实际调用核心的tokenize函数
 * 
 * @param {string} text - 输入文本
 * @returns {string[]} 分词结果数组
 */
export function tokenizeText(text) {
  return tokenize(text);
}

/**
 * 预处理: 文本标准化函数
 * 
 * 功能说明:
 * 1. 合并多个连续空格为单个空格
 * 2. 统一标点符号(逗号、分号、感叹号等)
 * 3. 将全角数字转换为半角数字(如０->0)
 * 
 * 重要: 不处理 '.' 和 '。',避免破坏小数格式
 * 
 * 示例:
 * - "今天  买  苹果" -> "今天 买 苹果"
 * - "花费１２３元" -> "花费123元"
 * - "小米,大米;豆腐" -> "小米,大米,豆腐"
 * 
 * @param {string} text - 原始输入文本
 * @returns {string} 标准化后的文本
 */
export function preNormalize(text) {
  if (!text || typeof text !== 'string') {
    return '';
  }
  
  return text
    .replace(/\s+/g, ' ')           // 合并多个空格为单个空格
    .replace(/[，,;；!！]/g, ',')    // 统一标点符号为逗号(注意:不包含.和。,避免破坏小数)
    .replace(/[\uff10-\uff19]/g, (c) => String.fromCharCode(c.charCodeAt(0) - 0xfee0)) // 全角数字转半角(Unicode码位转换)
    .trim();
}

/**
 * Token类型识别函数
 * 
 * 根据token的内容特征,判断其语义类型
 * 用于后续的状态机解析和语义理解
 * 
 * 类型定义:
 * - NUMBER: 阿拉伯数字(如 "123", "45.6")
 * - CURRENCY: 货币单位符号(如 "块", "元", "毛", "角", "分", "¥", "￥")
 * - DATE: 日期相关词汇(如 "今天", "昨天", "3月", "15号")
 * - VERB: 消费行为动词(如 "买", "花费", "支付", "消费")
 * - CHINESE: 纯中文字符(如 "小米", "豆腐", "可乐")
 * - OTHER: 其他类型(无法归类的token)
 * 
 * @param {string} token - 待识别的token
 * @returns {'NUMBER' | 'CHINESE' | 'CURRENCY' | 'DATE' | 'VERB' | 'OTHER'} token类型
 */
export function getTokenType(token) {
  // 数字类型: 匹配整数或小数格式
  if (/^\d+\.?\d*$/.test(token)) {
    return 'NUMBER';
  }
  
  // 货币符号: 匹配常见的人民币单位
  if (/^[¥￥块元毛角分钱]$/.test(token)) {
    return 'CURRENCY';
  }
  
  // 日期关键词: 匹配相对日期和具体日期表达
  if (/^(今天|昨天|前天|\d+[月日号])$/.test(token)) {
    return 'DATE';
  }
  
  // 动词: 匹配常见的消费行为动词
  const verbs = ['买', '花费', '支付', '消费', '用掉', '付'];
  if (verbs.includes(token)) {
    return 'VERB';
  }
  
  // 中文字符: 纯汉字组成的token
  if (/^[\u4e00-\u9fa5]+$/.test(token)) {
    return 'CHINESE';
  }
  
  // 其他类型: 无法归类的token
  return 'OTHER';
}
