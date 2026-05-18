/**
 * Money FSM Engine - 中文金额解析状态机
 * 
 * 支持格式:
 * - 阿拉伯数字: 12块4毛6, 12.46元, ¥35
 * - 中文数字: 两块五, 三块二毛, 十二块四角六分
 * - 混合表达: 12块4, 4元5角
 */

// 中文数字映射表
const chineseDigits = {
  '零': 0, '一': 1, '两': 2, '二': 2, '三': 3, '四': 4,
  '五': 5, '六': 6, '七': 7, '八': 8, '九': 9, '十': 10
};

const chineseUnits = {
  '块': 1, '元': 1, '毛': 0.1, '角': 0.1, '分': 0.01
};

/**
 * 将中文数字字符串转换为阿拉伯数字
 * 例如: "二十五" -> 25, "十二" -> 12, "五" -> 5
 */
function chineseToNumber(chineseStr) {
  if (!chineseStr || typeof chineseStr !== 'string') {
    return 0;
  }
  
  chineseStr = chineseStr.trim();
  
  // 简单情况: 单个字符
  if (chineseDigits[chineseStr] !== undefined) {
    return chineseDigits[chineseStr];
  }
  
  // 处理"十X"或"X十"的情况
  let result = 0;
  let temp = 0;
  
  for (let i = 0; i < chineseStr.length; i++) {
    const char = chineseStr[i];
    const digit = chineseDigits[char];
    
    if (digit === 10) { // "十"
      if (temp === 0) {
        temp = 1; // "十五"中的"十"代表10
      }
      result += temp * 10;
      temp = 0;
    } else if (digit !== undefined) {
      temp = digit;
    }
  }
  
  result += temp;
  return result || 0;
}

/**
 * 金额状态机解析
 * 状态流转: 整数部分 → 元/块 → 角/毛 → 分
 */
export function parseMoney(text) {
  if (!text || typeof text !== 'string') {
    return null;
  }
  
  const trimmed = text.trim();
  
  // 策略1: 尝试阿拉伯数字格式 (优先级最高)
  const arabicResult = parseArabicMoney(trimmed);
  if (arabicResult !== null) {
    return arabicResult;
  }
  
  // 策略2: 尝试中文数字格式
  const chineseResult = parseChineseMoney(trimmed);
  if (chineseResult !== null) {
    return chineseResult;
  }
  
  return null;
}

/**
 * 解析阿拉伯数字金额
 * 支持: 12块4毛6, 12.46元, ¥35, 4块23(4.23), 12块4(12.4)
 */
function parseArabicMoney(text) {
  // Pattern 1: 完整格式 "X块Y毛Z分"
  const fullPattern = /(\d+)\s*块\s*(\d{1,2})\s*(?:毛|角)\s*(\d{1,2})\s*分?/;
  const fullMatch = text.match(fullPattern);
  if (fullMatch) {
    const yuan = parseInt(fullMatch[1], 10);
    const jiao = parseInt(fullMatch[2], 10);
    const fen = parseInt(fullMatch[3], 10);
    return parseFloat((yuan + jiao / 10 + fen / 100).toFixed(2));
  }
  
  // Pattern 2: "X块Y毛"
  const maoPattern = /(\d+)\s*块\s*(\d{1,2})\s*(?:毛|角)/;
  const maoMatch = text.match(maoPattern);
  if (maoMatch) {
    const yuan = parseInt(maoMatch[1], 10);
    const jiao = parseInt(maoMatch[2], 10);
    return parseFloat((yuan + jiao / 10).toFixed(2));
  }
  
  // Pattern 3: "X块Z分"
  const fenPattern = /(\d+)\s*块\s*(\d{1,2})\s*分/;
  const fenMatch = text.match(fenPattern);
  if (fenMatch) {
    const yuan = parseInt(fenMatch[1], 10);
    const fen = parseInt(fenMatch[2], 10);
    return parseFloat((yuan + fen / 100).toFixed(2));
  }
  
  // Pattern 4: "X块Y" (无单位后缀) - 必须在货币符号之前检查
  // 启发式: Y是1-9视为角, 10-99视为分
  const noUnitPattern = /(\d+)\s*块\s*(\d{1,2})(?!\s*(?:毛|角|分|块|元))/;
  const noUnitMatch = text.match(noUnitPattern);
  if (noUnitMatch) {
    const yuan = parseInt(noUnitMatch[1], 10);
    const suffix = parseInt(noUnitMatch[2], 10);
    
    if (suffix >= 10) {
      // 两位数: 视为分 "4块23" -> 4.23
      return parseFloat((yuan + suffix / 100).toFixed(2));
    } else {
      // 一位数: 视为角 "12块4" -> 12.4
      return parseFloat((yuan + suffix / 10).toFixed(2));
    }
  }
  
  // Pattern 5: 货币符号 "¥35", "35元"
  const currencyPatterns = [
    /(\d+\.?\d*)\s*(?:块|元|块钱)/,
    /(?:¥|￥)\s*(\d+\.?\d*)/
  ];
  
  for (const pattern of currencyPatterns) {
    const match = text.match(pattern);
    if (match) {
      const amount = parseFloat(match[1]);
      if (amount > 0 && amount < 10000000) {
        return parseFloat(amount.toFixed(2));
      }
    }
  }
  
  // Pattern 6: 商品名+独立数字 (如"小米4"中的4)
  // 匹配: 中文字符后紧跟数字,且没有其他货币单位
  const itemWithNumber = /[\u4e00-\u9fa5]+\s*(\d+\.?\d*)$/;
  const itemMatch = text.match(itemWithNumber);
  if (itemMatch) {
    const amount = parseFloat(itemMatch[1]);
    // 合理的金额范围: 0.01 - 99999
    if (amount > 0 && amount < 100000) {
      return parseFloat(amount.toFixed(2));
    }
  }
  
  // Pattern 7: 纯数字 (最低优先级)
  const standalonePattern = /^(\d+\.?\d*)$/;
  const standaloneMatch = text.match(standalonePattern);
  if (standaloneMatch) {
    const amount = parseFloat(standaloneMatch[1]);
    if (amount > 0 && amount < 10000000) {
      return parseFloat(amount.toFixed(2));
    }
  }
  
  return null;
}

/**
 * 解析中文数字金额
 * 支持: 两块五, 三块二毛, 十二块四角六分
 */
function parseChineseMoney(text) {
  // 匹配中文金额模式 - 支持"X块Y"(无单位,默认为角)格式
  const chinesePattern = /([零一二三四五六七八九十两]+)\s*(?:块|元)(?:\s*([零一二三四五六七八九十两]+))?(?:\s*(?:毛|角)\s*([零一二三四五六七八九十两]+))?(?:\s*分\s*([零一二三四五六七八九十两]+))?/;
  const match = text.match(chinesePattern);
  
  if (!match) {
    return null;
  }
  
  const yuan = chineseToNumber(match[1]);
  // 如果只有两个数字 "两块五", 第二个数字是角
  const jiao = match[2] ? chineseToNumber(match[2]) : 0;
  const fen = match[3] ? chineseToNumber(match[3]) : (match[4] ? chineseToNumber(match[4]) : 0);
  
  const amount = yuan + jiao * 0.1 + fen * 0.01;
  return parseFloat(amount.toFixed(2));
}

/**
 * 从文本中提取所有可能的金额候选
 * 返回: [{ amount, confidence, matchedText }]
 */
export function extractMoneyCandidates(text) {
  const candidates = [];
  
  // 使用正则找出所有可能的金额片段
  const patterns = [
    /\d+\s*块\s*\d{1,2}\s*(?:毛|角)\s*\d{1,2}\s*分?/,
    /\d+\s*块\s*\d{1,2}\s*(?:毛|角)/,
    /\d+\s*块\s*\d{1,2}\s*分/,
    /\d+\.?\d*\s*(?:块|元|块钱)/,
    /(?:¥|￥)\s*\d+\.?\d*/,
    /\d+\s*块\s*\d{1,2}(?!\s*(?:毛|角|分|块|元))/,
    /[零一二三四五六七八九十两]+\s*(?:块|元)(?:\s*[零一二三四五六七八九十两]+\s*(?:毛|角))?(?:\s*[零一二三四五六七八九十两]+\s*分)?/
  ];
  
  for (const pattern of patterns) {
    const matches = text.match(pattern);
    if (matches) {
      const amount = parseMoney(matches[0]);
      if (amount !== null) {
        candidates.push({
          amount,
          confidence: getConfidence(pattern, matches[0]),
          matchedText: matches[0]
        });
      }
    }
  }
  
  // 按置信度排序
  candidates.sort((a, b) => b.confidence - a.confidence);
  
  return candidates;
}

/**
 * 根据匹配模式给出置信度
 */
function getConfidence(pattern, matchedText) {
  // 完整格式置信度最高
  if (pattern.source.includes('分')) return 0.95;
  if (pattern.source.includes('毛') || pattern.source.includes('角')) return 0.9;
  if (pattern.source.includes('块') || pattern.source.includes('元')) return 0.88;
  if (pattern.source.includes('¥') || pattern.source.includes('￥')) return 0.88;
  if (pattern.source.includes('零一二三四')) return 0.85; // 中文数字
  return 0.7; // 纯数字
}
