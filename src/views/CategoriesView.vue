<template>
  <div class="page categories-page">
    <h1 class="page-title">分类管理</h1>

    <div class="tab-bar" style="margin-bottom: var(--space-lg)">
      <button class="tab-item" :class="{ active: activeTab === 'expense' }" @click="activeTab = 'expense'">支出分类</button>
      <button class="tab-item" :class="{ active: activeTab === 'income' }" @click="activeTab = 'income'">收入分类</button>
    </div>

    <div class="categories-list">
      <div class="card" style="padding: 0; overflow: hidden;">
        <div v-for="cat in currentCategories" :key="cat.id" class="category-item list-item">
          <div class="list-item-icon" :style="{ background: cat.color + '20' }">{{ cat.icon }}</div>
          <div class="list-item-content">
            <div class="list-item-title">{{ cat.name }}</div>
          </div>
          <div class="category-actions">
            <button class="btn btn-ghost btn-sm" @click="openEdit(cat)">✏️</button>
            <button v-if="!cat.isDefault" class="btn btn-ghost btn-sm" @click="confirmDelete(cat)">🗑️</button>
          </div>
        </div>
      </div>
    </div>

    <button class="btn btn-primary btn-block add-category-btn" @click="openAdd" id="add-category-btn">
      <span>➕</span>
      <span>添加{{ activeTab === 'expense' ? '支出' : '收入' }}分类</span>
    </button>

    <!-- Add/Edit Modal -->
    <AppModal v-model="showModal" :title="isEditing ? '编辑分类' : '添加分类'">
      <div class="edit-form">
        <div class="input-group">
          <label class="input-label">图标</label>
          <div class="icon-grid">
            <button v-for="emoji in emojiOptions" :key="emoji" class="icon-option"
              :class="{ active: formData.icon === emoji }" @click="formData.icon = emoji">{{ emoji }}</button>
          </div>
        </div>
        <div class="input-group">
          <label class="input-label">名称</label>
          <input v-model="formData.name" class="input" placeholder="分类名称" maxlength="10" />
        </div>
        <div class="input-group">
          <label class="input-label">颜色</label>
          <div class="color-grid">
            <button v-for="color in colorOptions" :key="color" class="color-option"
              :class="{ active: formData.color === color }" :style="{ background: color }" @click="formData.color = color"></button>
          </div>
        </div>
      </div>
      <template #footer>
        <button class="btn btn-secondary" @click="showModal = false">取消</button>
        <button class="btn btn-primary" @click="handleSave" style="flex:1" :disabled="!formData.name.trim()">保存</button>
      </template>
    </AppModal>

    <!-- Delete Confirmation Modal -->
    <AppModal v-model="showDeleteModal" title="确认删除">
      <div class="delete-confirm-body" style="padding: var(--space-base) 0;">
        确定要删除分类 "<strong style="color: var(--color-danger)">{{ categoryToDelete?.name }}</strong>" 吗？<br>
        删除后无法恢复。
      </div>
      <template #footer>
        <button class="btn btn-secondary" @click="showDeleteModal = false">取消</button>
        <button class="btn btn-primary" @click="executeDelete" style="flex:1; background: var(--color-danger); border-color: var(--color-danger);">确认删除</button>
      </template>
    </AppModal>
  </div>
</template>

<script setup>
import { ref, computed } from 'vue'
import { useCategoriesStore } from '../stores/categories.js'
import AppModal from '../components/AppModal.vue'

const categoriesStore = useCategoriesStore()
const activeTab = ref('expense')
const showModal = ref(false)
const showDeleteModal = ref(false)
const isEditing = ref(false)
const editingId = ref(null)
const categoryToDelete = ref(null)
const formData = ref({ name: '', icon: '📦', color: '#94a3b8' })

const currentCategories = computed(() =>
  activeTab.value === 'expense' ? categoriesStore.expenseCategories : categoriesStore.incomeCategories
)

const emojiOptions = ['🍜','🚗','🛍️','🎮','🏠','💊','📚','📱','👔','🧴','📦','💰','🎁','📈','💼','🧧','💎','☕','🎬','🏋️','✈️','🎵','🐱','🌿']
const colorOptions = ['#ff6b6b','#4ecdc4','#a78bfa','#fbbf24','#60a5fa','#f472b6','#34d399','#fb923c','#c084fc','#22d3ee','#818cf8','#94a3b8']

function openAdd() {
  isEditing.value = false
  editingId.value = null
  formData.value = { name: '', icon: '📦', color: '#94a3b8' }
  showModal.value = true
}

function openEdit(cat) {
  isEditing.value = true
  editingId.value = cat.id
  formData.value = { name: cat.name, icon: cat.icon, color: cat.color }
  showModal.value = true
}

async function handleSave() {
  if (!formData.value.name.trim()) return
  if (isEditing.value) {
    await categoriesStore.updateCategory(editingId.value, formData.value)
  } else {
    await categoriesStore.addCategory({ ...formData.value, type: activeTab.value })
  }
  showModal.value = false
}

function confirmDelete(cat) {
  categoryToDelete.value = cat
  showDeleteModal.value = true
}

async function executeDelete() {
  if (categoryToDelete.value) {
    try { 
      await categoriesStore.deleteCategory(categoryToDelete.value.id) 
      showDeleteModal.value = false
      categoryToDelete.value = null
    } catch (e) { 
      alert(e.message) 
    }
  }
}
</script>

<style scoped>
.categories-list { margin-bottom: var(--space-lg); }
.category-item { padding: var(--space-md) var(--space-base); }
.category-item:not(:last-child) { border-bottom: 1px solid var(--color-border-light); }
.category-actions { display: flex; gap: var(--space-xs); }
.add-category-btn { margin-top: var(--space-sm); }
.edit-form { display: flex; flex-direction: column; gap: var(--space-lg); }
.icon-grid { display: flex; flex-wrap: wrap; gap: var(--space-sm); }
.icon-option { width: 2.5rem; height: 2.5rem; display: flex; align-items: center; justify-content: center; border-radius: var(--radius-sm); font-size: 1.2rem; background: var(--color-bg-input); border: 2px solid transparent; cursor: pointer; transition: all var(--transition-fast); }
.icon-option.active { border-color: var(--color-accent); background: rgba(102,126,234,0.15); }
.color-grid { display: flex; flex-wrap: wrap; gap: var(--space-sm); }
.color-option { width: 2rem; height: 2rem; border-radius: var(--radius-full); border: 2px solid transparent; cursor: pointer; transition: all var(--transition-fast); }
.color-option.active { border-color: #fff; transform: scale(1.2); box-shadow: var(--shadow-glow); }
</style>
