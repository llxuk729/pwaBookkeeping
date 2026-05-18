import { defineStore } from 'pinia'
import { ref, computed } from 'vue'
import { db } from '../db/database.js'

export const useCategoriesStore = defineStore('categories', () => {
  const categories = ref([])
  const loading = ref(false)

  const expenseCategories = computed(() =>
    categories.value
      .filter(c => c.type === 'expense')
      .sort((a, b) => a.order - b.order)
  )

  const incomeCategories = computed(() =>
    categories.value
      .filter(c => c.type === 'income')
      .sort((a, b) => a.order - b.order)
  )

  /**
   * Load all categories from database
   */
  async function loadCategories() {
    loading.value = true
    try {
      categories.value = await db.categories.orderBy('order').toArray()
    } finally {
      loading.value = false
    }
  }

  /**
   * Add a new category
   */
  async function addCategory(category) {
    const maxOrder = categories.value
      .filter(c => c.type === category.type)
      .reduce((max, c) => Math.max(max, c.order), 0)

    const newCat = {
      name: category.name,
      icon: category.icon || '📦',
      type: category.type || 'expense',
      color: category.color || '#94a3b8',
      order: maxOrder + 1,
      isDefault: 0
    }

    const id = await db.categories.add(newCat)
    await loadCategories()
    return id
  }

  /**
   * Update a category
   */
  async function updateCategory(id, changes) {
    await db.categories.update(id, changes)
    await loadCategories()
  }

  /**
   * Delete a category (only non-default)
   */
  async function deleteCategory(id) {
    const cat = await db.categories.get(id)
    if (cat && cat.isDefault) {
      throw new Error('默认分类不可删除')
    }
    await db.categories.delete(id)
    await loadCategories()
  }

  /**
   * Get category by ID
   */
  function getCategoryById(id) {
    return categories.value.find(c => c.id === id)
  }

  return {
    categories,
    loading,
    expenseCategories,
    incomeCategories,
    loadCategories,
    addCategory,
    updateCategory,
    deleteCategory,
    getCategoryById
  }
})
