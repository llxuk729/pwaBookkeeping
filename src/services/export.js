import { db } from '../db/database.js'

/**
 * Export records to CSV format
 * @param {Array} records - Record objects with category info
 * @param {string} filename - Output filename
 */
export function exportToCSV(records, filename = '记账数据') {
  if (!records || records.length === 0) {
    throw new Error('没有可导出的数据')
  }

  const headers = ['日期', '类型', '分类', '金额', '备注']
  const rows = records.map(record => [
    record.date,
    record.type === 'income' ? '收入' : '支出',
    record.categoryName || '未分类',
    record.amount.toFixed(2),
    `"${(record.note || '').replace(/"/g, '""')}"`
  ])

  // Add BOM for Excel Chinese support
  const BOM = '\uFEFF'
  const csvContent = BOM + [
    headers.join(','),
    ...rows.map(row => row.join(','))
  ].join('\n')

  const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' })
  downloadBlob(blob, `${filename}.csv`)
  
  // Record backup time
  localStorage.setItem('lastBackupDate', new Date().toISOString())
}

/**
 * Export all data as JSON for backup
 */
export async function exportBackup() {
  const records = await db.records.toArray()
  const categories = await db.categories.toArray()

  const data = {
    version: 1,
    exportDate: new Date().toISOString(),
    records,
    categories
  }

  const blob = new Blob([JSON.stringify(data, null, 2)], { type: 'application/json' })
  const dateStr = new Date().toISOString().split('T')[0]
  downloadBlob(blob, `记账备份_${dateStr}.json`)
  
  // Record backup time
  localStorage.setItem('lastBackupDate', new Date().toISOString())
}

/**
 * Import data from JSON backup
 * @param {File} file - JSON backup file
 * @returns {Object} Import result { recordCount, categoryCount }
 */
export async function importBackup(file) {
  const text = await file.text()
  let data

  try {
    data = JSON.parse(text)
  } catch {
    throw new Error('备份文件格式错误')
  }

  if (!data.version || !data.records || !data.categories) {
    throw new Error('备份文件内容不完整')
  }

  // Clear existing data and import
  await db.transaction('rw', db.records, db.categories, async () => {
    await db.records.clear()
    await db.categories.clear()

    // Re-add with new IDs
    const categoryIdMap = {}
    for (const cat of data.categories) {
      const oldId = cat.id
      delete cat.id
      const newId = await db.categories.add(cat)
      categoryIdMap[oldId] = newId
    }

    for (const record of data.records) {
      delete record.id
      // Map old category IDs to new ones
      if (record.categoryId && categoryIdMap[record.categoryId]) {
        record.categoryId = categoryIdMap[record.categoryId]
      }
      await db.records.add(record)
    }
  })

  return {
    recordCount: data.records.length,
    categoryCount: data.categories.length
  }
}

/**
 * Helper: trigger file download
 */
function downloadBlob(blob, filename) {
  const url = URL.createObjectURL(blob)
  const link = document.createElement('a')
  link.href = url
  link.download = filename
  document.body.appendChild(link)
  link.click()
  document.body.removeChild(link)
  URL.revokeObjectURL(url)
}
