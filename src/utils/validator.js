/**
 * Validator - 数据结构验证器
 * 使用 valibot 进行schema验证
 */

import * as v from 'valibot';

/**
 * 记账记录Schema
 */
export const RecordSchema = v.object({
  type: v.picklist(['expense', 'income'], '类型必须是expense或income'),
  categoryId: v.nullish(v.number()), // null or undefined is allowed
  categoryName: v.string('分类名称必填'),
  amount: v.pipe(
    v.number('金额必须是数字'),
    v.minValue(0.01, '金额必须大于0'),
    v.maxValue(9999999, '金额不能超过9999999')
  ),
  note: v.optional(v.string(), ''),
  date: v.pipe(
    v.string('日期必须是字符串'),
    v.regex(/^\d{4}-\d{2}-\d{2}$/, '日期格式必须是YYYY-MM-DD')
  ),
  weather: v.optional(v.string(), ''),
  isNewCategory: v.optional(v.boolean(), false)
});

/**
 * 验证记账记录
 * @param {Object} data - 待验证的数据
 * @returns {{ success: boolean, data?: Object, errors?: Array }}
 */
export function validateRecord(data) {
  try {
    const result = v.parse(RecordSchema, data);
    return {
      success: true,
      data: result
    };
  } catch (error) {
    return {
      success: false,
      errors: error.issues?.map(issue => ({
        field: issue.path?.[0]?.key || 'unknown',
        message: issue.message
      })) || []
    };
  }
}

/**
 * 批量验证多条记录
 */
export function validateRecords(records) {
  const results = [];
  const validRecords = [];
  
  for (const record of records) {
    const validation = validateRecord(record);
    results.push(validation);
    
    if (validation.success) {
      validRecords.push(validation.data);
    }
  }
  
  return {
    results,
    validRecords,
    totalCount: records.length,
    validCount: validRecords.length
  };
}
