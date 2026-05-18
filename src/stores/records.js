import { defineStore } from 'pinia'
import { ref, computed } from 'vue'
import { db } from '../db/database.js'

export const useRecordsStore = defineStore('records', () => {
  const records = ref([])
  const loading = ref(false)

  // Computed: today's records
  const today = computed(() => {
    const todayStr = new Date().toISOString().split('T')[0]
    return records.value.filter(r => r.date === todayStr)
  })

  // Computed: today's expense total
  const todayExpense = computed(() => {
    return today.value
      .filter(r => r.type === 'expense')
      .reduce((sum, r) => sum + r.amount, 0)
  })

  // Computed: today's income total
  const todayIncome = computed(() => {
    return today.value
      .filter(r => r.type === 'income')
      .reduce((sum, r) => sum + r.amount, 0)
  })

  // Computed: this month's expense
  const monthExpense = computed(() => {
    const now = new Date()
    const monthStr = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}`
    return records.value
      .filter(r => r.type === 'expense' && r.date.startsWith(monthStr))
      .reduce((sum, r) => sum + r.amount, 0)
  })

  // Computed: this month's income
  const monthIncome = computed(() => {
    const now = new Date()
    const monthStr = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}`
    return records.value
      .filter(r => r.type === 'income' && r.date.startsWith(monthStr))
      .reduce((sum, r) => sum + r.amount, 0)
  })

  /**
   * Load all records from database
   */
  async function loadRecords() {
    loading.value = true
    try {
      const allRecords = await db.records.orderBy('date').reverse().toArray()
      // Attach category info
      const categories = await db.categories.toArray()
      const catMap = Object.fromEntries(categories.map(c => [c.id, c]))

      records.value = allRecords.map(r => ({
        ...r,
        category: catMap[r.categoryId] || null,
        categoryName: catMap[r.categoryId]?.name || '未分类',
        categoryIcon: catMap[r.categoryId]?.icon || '📦',
        categoryColor: catMap[r.categoryId]?.color || '#94a3b8'
      }))
    } finally {
      loading.value = false
    }
  }

  /**
   * Add a new record
   */
  async function addRecord(record) {
    const newRecord = {
      type: record.type || 'expense',
      categoryId: record.categoryId,
      amount: parseFloat(record.amount),
      note: record.note || '',
      date: record.date || new Date().toISOString().split('T')[0],
      createdAt: Date.now()
    }

    await db.records.add(newRecord)
    await loadRecords()
  }

  /**
   * Update an existing record
   */
  async function updateRecord(id, changes) {
    await db.records.update(id, changes)
    await loadRecords()
  }

  /**
   * Delete a record
   */
  async function deleteRecord(id) {
    await db.records.delete(id)
    await loadRecords()
  }

  /**
   * Get records filtered by date range
   */
  function getRecordsByDateRange(startDate, endDate) {
    return records.value.filter(r => r.date >= startDate && r.date <= endDate)
  }

  /**
   * Get records grouped by date
   */
  const groupedByDate = computed(() => {
    const groups = {}
    for (const record of records.value) {
      if (!groups[record.date]) {
        groups[record.date] = {
          date: record.date,
          records: [],
          totalExpense: 0,
          totalIncome: 0
        }
      }
      groups[record.date].records.push(record)
      if (record.type === 'expense') {
        groups[record.date].totalExpense += record.amount
      } else {
        groups[record.date].totalIncome += record.amount
      }
    }
    return Object.values(groups).sort((a, b) => b.date.localeCompare(a.date))
  })

  return {
    records,
    loading,
    today,
    todayExpense,
    todayIncome,
    monthExpense,
    monthIncome,
    groupedByDate,
    loadRecords,
    addRecord,
    updateRecord,
    deleteRecord,
    getRecordsByDateRange
  }
})
