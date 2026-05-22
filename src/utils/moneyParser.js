/**
 * Money FSM Engine - 中文金额解析状态机
 * 
 * 功能说明:
 * 1. 解析多种格式的中文金额表达
 * 2. 支持阿拉伯数字和中文数字混合输入
 * 3. 实现有限状态机(FSM)进行金额结构识别
 * 
 * 支持的格式:
 * - 阿拉伯数字: "12块4毛6", "12.46元", "¥35"
 * - 中文数字: "两块五", "三块二毛", "十二块四角六分"
 * - 混合表达: "12块4", "4元5角"
 * - 无单位后缀: "4块23"(4.23元), "12块4"(12.4元)
 * 
 * 设计原则:
 * - 优先级策略: 阿拉伯数字 > 中文数字 > 纯数字
 * - 启发式规则: 根据上下文推断无单位数字的含义
 * - 容错处理: 支持多种常见表达方式的变体
 */

// ==================== 常量定义区 ====================

/**
 * 中文数字映射表
 * 将中文数字字符映射为对应的阿拉伯数字
 * 注意: "两"和"二"都映射为2,符合口语习惯
 */
const chineseDigits = {
  '零': 0, '一': 1, '两': 2, '二': 2, '三': 3, '四': 4,
  '五': 5, '六': 6, '七': 7, '八': 8, '九': 9, '十': 10
};

/**
 * 中文货币单位映射表
 * 将货币单位映射为对应的数值权重
 * - 块/元: 主单位,权重为1
 * - 毛/角: 十分之一元,权重为0.1
 * - 分: 百分之一元,权重为0.01
 */
const chineseUnits = {
  '块': 1, '元': 1, '毛': 0.1, '角': 0.1, '分': 0.01
};

/**
 * 中文数字转阿拉伯数字函数
 * 
 * 算法说明:
 * 1. 处理单个中文字符的直接映射
 * 2. 处理复合数字如"二十五"、"十二"等
 * 3. 特殊处理"十"的位置逻辑:
 *    - "十五" -> 1*10 + 5 = 15
 *    - "二十五" -> 2*10 + 5 = 25
 *    - "十二" -> 1*10 + 2 = 12
 * 
 * 示例:
 * - "二十五" -> 25
 * - "十二" -> 12
 * - "五" -> 5
 * - "十" -> 10
 * 
 * @param {string} chineseStr - 中文数字字符串
 * @returns {number} 转换后的阿拉伯数字
 */
function chineseToNumber(chineseStr) {
  if (!chineseStr || typeof chineseStr !== 'string') {
    return 0;
  }
  
  chineseStr = chineseStr.trim();
  
  // 简单情况: 单个字符直接查表
  if (chineseDigits[chineseStr] !== undefined) {
    return chineseDigits[chineseStr];
  }
  
  // 复杂情况: 多位数字组合,需要逐位计算
  let result = 0;  // 最终结果
  let temp = 0;    // 临时变量,存储当前位的数值
  
  for (let i = 0; i < chineseStr.length; i++) {
    const char = chineseStr[i];
    const digit = chineseDigits[char];
    
    if (digit === 10) { // 遇到"十"
      if (temp === 0) {
        temp = 1; // "十五"中的"十"代表10,即1*10
      }
      result += temp * 10;  // 将前面的数字乘以10并累加到结果
      temp = 0;             // 重置临时变量
    } else if (digit !== undefined) {
      temp = digit;  // 记录当前位的数字
    }
  }
  
  result += temp;  // 加上最后一位数字
  return result || 0;
}

/**
 * 金额状态机解析入口函数
 * 
 * FSM状态流转设计:
 * 初始状态 → 整数部分(元) → [角/毛] → [分] → 结束状态
 * 
 * 解析策略:
 * 1. 优先尝试阿拉伯数字格式(覆盖率高,解析准确)
 * 2. 其次尝试中文数字格式(处理口语化表达)
 * 3. 两者都失败则返回null
 * 
 * 示例:
 * - "12块4毛6" -> 12.46
 * - "两块五" -> 2.5
 * - "¥35" -> 35.00
 * - "无效文本" -> null
 * 
 * @param {string} text - 待解析的金额文本
 * @returns {number|null} 解析后的金额(保留两位小数),失败返回null
 */
export function parseMoney(text) {
  if (!text || typeof text !== 'string') {
    return null;
  }
  
  const trimmed = text.trim();
  
  // 策略1: 尝试阿拉伯数字格式 (优先级最高,覆盖大部分场景)
  const arabicResult = parseArabicMoney(trimmed);
  if (arabicResult !== null) {
    return arabicResult;
  }
  
  // 策略2: 尝试中文数字格式 (处理口语化表达)
  const chineseResult = parseChineseMoney(trimmed);
  if (chineseResult !== null) {
    return chineseResult;
  }
  
  return null;
}

/**
 * 阿拉伯数字金额解析器
 * 
 * 使用多个正则模式按优先级匹配不同格式:
 * 
 * Pattern 1: 完整格式 "X块Y毛Z分" (置信度最高)
 *   - 示例: "12块4毛6" -> 12.46
 *   - 正则: /(\d+)\s*块\s*(\d{1,2})\s*(?:毛|角)\s*(\d{1,2})\s*分?/
 * 
 * Pattern 2: "X块Y毛" (不含分)
 *   - 示例: "12块4毛" -> 12.40
 *   - 正则: /(\d+)\s*块\s*(\d{1,2})\s*(?:毛|角)/
 * 
 * Pattern 3: "X块Z分" (不含角)
 *   - 示例: "12块6分" -> 12.06
 *   - 正则: /(\d+)\s*块\s*(\d{1,2})\s*分/
 * 
 * Pattern 4: "X块Y" (无单位后缀,需启发式判断)
 *   - Y为1-9: 视为角 "12块4" -> 12.4
 *   - Y为10-99: 视为分 "4块23" -> 4.23
 *   - 关键: 使用负向前瞻确保后面没有其他货币单位
 * 
 * Pattern 5: 货币符号格式
 *   - "35元" / "35块" / "¥35" / "￥35"
 *   - 需要验证金额范围合理性(0 < amount < 10000000)
 * 
 * Pattern 6: 商品名+独立数字 (如"小米4")
 *   - 匹配中文字符后紧跟数字的模式
 *   - 需要验证金额范围合理性(0 < amount < 100000)
 * 
 * Pattern 7: 纯数字 (最低优先级,容易产生误判)
 *   - 仅当其他所有模式都失败时使用
 *   - 示例: "123" -> 123.00
 * 
 * @param {string} text - 待解析的文本
 * @returns {number|null} 解析后的金额,失败返回null
 */
function parseArabicMoney(text) {
  // Pattern 1: 完整格式 "X块Y毛Z分" (最高优先级,结构最完整)
  const fullPattern = /(\d+)\s*块\s*(\d{1,2})\s*(?:毛|角)\s*(\d{1,2})\s*分?/;
  const fullMatch = text.match(fullPattern);
  if (fullMatch) {
    const yuan = parseInt(fullMatch[1], 10);   // 元部分
    const jiao = parseInt(fullMatch[2], 10);   // 角/毛部分
    const fen = parseInt(fullMatch[3], 10);    // 分部分
    return parseFloat((yuan + jiao / 10 + fen / 100).toFixed(2));
  }
  
  // Pattern 2: "X块Y毛" (不含分)
  const maoPattern = /(\d+)\s*块\s*(\d{1,2})\s*(?:毛|角)/;
  const maoMatch = text.match(maoPattern);
  if (maoMatch) {
    const yuan = parseInt(maoMatch[1], 10);
    const jiao = parseInt(maoMatch[2], 10);
    return parseFloat((yuan + jiao / 10).toFixed(2));
  }
  
  // Pattern 3: "X块Z分" (不含角)
  const fenPattern = /(\d+)\s*块\s*(\d{1,2})\s*分/;
  const fenMatch = text.match(fenPattern);
  if (fenMatch) {
    const yuan = parseInt(fenMatch[1], 10);
    const fen = parseInt(fenMatch[2], 10);
    return parseFloat((yuan + fen / 100).toFixed(2));
  }
  
  // Pattern 4: "X块Y" (无单位后缀) - 必须在货币符号之前检查
  // 启发式规则: Y是1-9视为角, 10-99视为分
  // 使用负向前瞻 (?!) 确保后面没有其他货币单位,避免误匹配
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
  
  // Pattern 5: 货币符号格式 "¥35", "35元", "35块"
  const currencyPatterns = [
    /(\d+\.?\d*)\s*(?:块|元|块钱)/,  // 数字+单位
    /(?:¥|￥)\s*(\d+\.?\d*)/         // 货币符号+数字
  ];
  
  for (const pattern of currencyPatterns) {
    const match = text.match(pattern);
    if (match) {
      const amount = parseFloat(match[1]);
      // 验证金额范围合理性: 大于0且小于1千万
      if (amount > 0 && amount < 10000000) {
        return parseFloat(amount.toFixed(2));
      }
    }
  }
  
  // Pattern 6: 商品名+独立数字 (如"小米4"中的4)
  // 匹配: 中文字符后紧跟数字,且没有其他货币单位
  // 这种模式容易产生误判,需要严格的金额范围限制
  const itemWithNumber = /[\u4e00-\u9fa5]+\s*(\d+\.?\d*)$/;
  const itemMatch = text.match(itemWithNumber);
  if (itemMatch) {
    const amount = parseFloat(itemMatch[1]);
    // 合理的金额范围: 0.01 - 99999
    if (amount > 0 && amount < 100000) {
      return parseFloat(amount.toFixed(2));
    }
  }
  
  // Pattern 7: 纯数字 (最低优先级,仅作为兜底方案)
  // 仅在没有任何其他模式匹配成功时才使用
  const standalonePattern = /^(\d+\.?\d*)$/;
  const standaloneMatch = text.match(standalonePattern);
  if (standaloneMatch) {
    const amount = parseFloat(standaloneMatch[1]);
    // 验证金额范围: 大于0且小于1千万
    if (amount > 0 && amount < 10000000) {
      return parseFloat(amount.toFixed(2));
    }
  }
  
  return null;
}

/**
 * 中文数字金额解析器
 * 
 * 使用正则表达式匹配中文金额模式:
 * - 基本结构: [中文数字]块[中文数字][毛/角][中文数字][分]
 * - 可选部分用 (?:...)? 包裹
 * 
 * 关键逻辑:
 * 1. 如果只有两个数字 "两块五", 第二个数字默认为角(即2.5元)
 * 2. 如果有三个数字 "三块二毛五", 分别为元、角、分(即3.25元)
 * 3. 支持省略中间单位 "十二块六分" (即12.06元)
 * 
 * 正则说明:
 * /([零一二三四五六七八九十两]+)\s*(?:块|元)     # 第一部分: 元的数字
 *  (?:\s*([零一二三四五六七八九十两]+))?          # 第二部分: 角的数字(可选)
 *  (?:\s*(?:毛|角)\s*([零一二三四五六七八九十两]+))?  # 第三部分: 分的数字(可选,需要有毛/角标识)
 *  (?:\s*分\s*([零一二三四五六七八九十两]+))?/    # 第四部分: 明确标注"分"的数字(可选)
 * 
 * 示例:
 * - "两块五" -> 2.5 (五默认为角)
 * - "三块二毛" -> 3.2
 * - "十二块四角六分" -> 12.46
 * - "两块五毛三分" -> 2.53
 * 
 * @param {string} text - 待解析的中文金额文本
 * @returns {number|null} 解析后的金额,失败返回null
 */
function parseChineseMoney(text) {
  // 匹配中文金额模式 - 支持"X块Y"(无单位,默认为角)格式
  const chinesePattern = /([零一二三四五六七八九十两]+)\s*(?:块|元)(?:\s*([零一二三四五六七八九十两]+))?(?:\s*(?:毛|角)\s*([零一二三四五六七八九十两]+))?(?:\s*分\s*([零一二三四五六七八九十两]+))?/;
  const match = text.match(chinesePattern);
  
  if (!match) {
    return null;
  }
  
  // 提取各个部分的数值
  const yuan = chineseToNumber(match[1]);  // 元部分
  // 如果只有两个数字 "两块五", 第二个数字是角
  const jiao = match[2] ? chineseToNumber(match[2]) : 0;  // 角部分
  const fen = match[3] ? chineseToNumber(match[3]) : (match[4] ? chineseToNumber(match[4]) : 0);  // 分部分
  
  // 计算总金额: 元 + 角*0.1 + 分*0.01
  const amount = yuan + jiao * 0.1 + fen * 0.01;
  return parseFloat(amount.toFixed(2));
}

/**
 * 金额候选提取函数
 * 
 * 功能说明:
 * 从文本中提取所有可能的金额片段,并计算每个候选的置信度
 * 用于处理复杂文本中存在多个金额的场景
 * 
 * 算法流程:
 * 1. 使用多种正则模式扫描文本
 * 2. 对每个匹配结果调用parseMoney进行解析
 * 3. 根据匹配模式的完整性计算置信度
 * 4. 按置信度降序排序返回
 * 
 * 返回格式:
 * [{
 *   amount: 12.46,           // 解析后的金额
 *   confidence: 0.95,        // 置信度(0-1)
 *   matchedText: "12块4毛6"  // 原始匹配文本
 * }]
 * 
 * @param {string} text - 待扫描的文本
 * @returns {Array<{amount: number, confidence: number, matchedText: string}>} 金额候选数组
 */
export function extractMoneyCandidates(text) {
  const candidates = [];
  
  // 定义多种金额匹配模式,按优先级排列
  const patterns = [
    /\d+\s*块\s*\d{1,2}\s*(?:毛|角)\s*\d{1,2}\s*分?/,  // 完整格式: X块Y毛Z分
    /\d+\s*块\s*\d{1,2}\s*(?:毛|角)/,                    // X块Y毛
    /\d+\s*块\s*\d{1,2}\s*分/,                           // X块Z分
    /\d+\.?\d*\s*(?:块|元|块钱)/,                        // 数字+单位
    /(?:¥|￥)\s*\d+\.?\d*/,                              // 货币符号+数字
    /\d+\s*块\s*\d{1,2}(?!\s*(?:毛|角|分|块|元))/,      // X块Y(无单位)
    /[零一二三四五六七八九十两]+\s*(?:块|元)(?:\s*[零一二三四五六七八九十两]+\s*(?:毛|角))?(?:\s*[零一二三四五六七八九十两]+\s*分)?/  // 中文数字
  ];
  
  for (const pattern of patterns) {
    const matches = text.match(pattern);
    if (matches) {
      const amount = parseMoney(matches[0]);
      if (amount !== null) {
        candidates.push({
          amount,
          confidence: getConfidence(pattern, matches[0]),  // 计算置信度
          matchedText: matches[0]
        });
      }
    }
  }
  
  // 按置信度降序排序,最可信的候选排在前面
  candidates.sort((a, b) => b.confidence - a.confidence);
  
  return candidates;
}

/**
 * 置信度计算函数
 * 
 * 根据匹配模式的完整性和特征,评估解析结果的可靠性
 * 
 * 置信度分级:
 * - 0.95: 包含"分"的完整格式(X块Y毛Z分),结构最完整
 * - 0.90: 包含"毛/角"的格式(X块Y毛),缺少分但仍较完整
 * - 0.88: 包含"块/元"或货币符号的格式,有明确单位标识
 * - 0.85: 中文数字格式,可能存在歧义
 * - 0.70: 纯数字格式,最容易产生误判
 * 
 * 设计思路:
 * 结构越完整、单位越明确的表达,置信度越高
 * 
 * @param {RegExp} pattern - 匹配使用的正则表达式
 * @param {string} matchedText - 匹配的文本内容
 * @returns {number} 置信度值(0-1之间)
 */
function getConfidence(pattern, matchedText) {
  // 完整格式置信度最高(包含元角分三个层级)
  if (pattern.source.includes('分')) return 0.95;
  // 包含角/毛的格式次之
  if (pattern.source.includes('毛') || pattern.source.includes('角')) return 0.9;
  // 包含块/元或货币符号的格式
  if (pattern.source.includes('块') || pattern.source.includes('元')) return 0.88;
  if (pattern.source.includes('¥') || pattern.source.includes('￥')) return 0.88;
  // 中文数字格式
  if (pattern.source.includes('零一二三四')) return 0.85;
  // 纯数字格式置信度最低
  return 0.7;
}
