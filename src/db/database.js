import Dexie from 'dexie'

export const db = new Dexie('BookkeepingDB')

db.version(1).stores({
  // id: auto-increment primary key
  // type: 'expense' | 'income'
  // categoryId: references categories table
  // amount: number (always positive)
  // note: description text
  // date: ISO date string (YYYY-MM-DD)
  // createdAt: timestamp
  records: '++id, type, categoryId, date, createdAt',

  // id: auto-increment primary key
  // name: category display name
  // icon: emoji icon
  // type: 'expense' | 'income'
  // color: CSS color for charts
  // order: display order
  // isDefault: boolean, cannot be deleted
  categories: '++id, type, order, isDefault'
})

// Default expense categories (Breakfast Shop specific)
const defaultExpenseCategories = [
  { name: '黄小米', icon: '🌾', type: 'expense', color: '#fbbf24', order: 1, isDefault: 0 },
  { name: '黑米', icon: '🍚', type: 'expense', color: '#4b5563', order: 2, isDefault: 0 },
  { name: '白米', icon: '🍚', type: 'expense', color: '#f3f4f6', order: 3, isDefault: 0 },
  { name: '糯米', icon: '🍙', type: 'expense', color: '#e5e7eb', order: 4, isDefault: 0 },
  { name: '燕麦', icon: '🌾', type: 'expense', color: '#d97706', order: 5, isDefault: 0 },
  { name: '粉丝', icon: '🍜', type: 'expense', color: '#9ca3af', order: 6, isDefault: 0 },
  { name: '花生', icon: '🥜', type: 'expense', color: '#b45309', order: 7, isDefault: 0 },
  { name: '大豆', icon: '🫘', type: 'expense', color: '#f59e0b', order: 8, isDefault: 0 },
  { name: '白砂糖', icon: '🧊', type: 'expense', color: '#e2e8f0', order: 9, isDefault: 0 },
  
  // Previously income, now expense
  { name: '粉丝煎饺', icon: '🥟', type: 'expense', color: '#fb923c', order: 10, isDefault: 0 },
  { name: '小笼包', icon: '🥟', type: 'expense', color: '#facc15', order: 11, isDefault: 0 },
  { name: '油条', icon: '🥖', type: 'expense', color: '#eab308', order: 12, isDefault: 0 },
  { name: '白馒头', icon: '🍞', type: 'expense', color: '#f8fafc', order: 13, isDefault: 0 },
  { name: '红糖馒头', icon: '🥮', type: 'expense', color: '#9a3412', order: 14, isDefault: 0 },
  { name: '紫薯包', icon: '🍠', type: 'expense', color: '#a855f7', order: 15, isDefault: 0 },
  { name: '茶叶蛋', icon: '🥚', type: 'expense', color: '#78350f', order: 16, isDefault: 0 },
  { name: '豆浆', icon: '🥛', type: 'expense', color: '#fef08a', order: 17, isDefault: 0 },
  { name: '稀饭', icon: '🥣', type: 'expense', color: '#cbd5e1', order: 18, isDefault: 0 },
  
  // Generic fallback
  { name: '其他原料', icon: '📦', type: 'expense', color: '#94a3b8', order: 98, isDefault: 0 },
]

const defaultIncomeCategories = [
  { name: '营业收入', icon: '💰', type: 'income', color: '#43e97b', order: 1, isDefault: 0 },
  { name: '其他收入', icon: '💵', type: 'income', color: '#34d399', order: 99, isDefault: 0 },
]

/**
 * Initialize database with default categories if empty
 */
export async function initializeDB() {
  const count = await db.categories.count()
  if (count === 0) {
    await db.categories.bulkAdd([
      ...defaultExpenseCategories,
      ...defaultIncomeCategories
    ])
  } else {
    // Migration: fix existing categories
    await db.categories.toCollection().modify(cat => {
       cat.isDefault = 0; // Allow deletion
       // Move old income items to expense
       if (['粉丝煎饺', '小笼包', '油条', '白馒头', '红糖馒头', '紫薯包', '茶叶蛋', '豆浆', '稀饭'].includes(cat.name)) {
         cat.type = 'expense';
       }
    });
  }
}
