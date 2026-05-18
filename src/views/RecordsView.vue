<template>
  <div class="page records-page">
    <h1 class="page-title">账单明细</h1>
    <div class="filter-bar">
      <div class="search-wrap">
        <span class="search-icon">🔍</span>
        <input v-model="searchQuery" class="input search-input" placeholder="搜索记录..." id="search-input" />
      </div>
      <div class="filter-chips">
        <button class="chip" :class="{ active: filterType === 'all' }" @click="filterType = 'all'">全部</button>
        <button class="chip" :class="{ active: filterType === 'expense' }" @click="filterType = 'expense'">支出</button>
        <button class="chip" :class="{ active: filterType === 'income' }" @click="filterType = 'income'">收入</button>
      </div>
    </div>
    <div class="records-list" v-if="filteredGroups.length > 0">
      <div v-for="group in filteredGroups" :key="group.date" class="date-group">
        <div class="date-header">
          <span class="date-label">{{ formatDateLabel(group.date) }}</span>
          <div class="date-totals">
            <span v-if="group.totalExpense > 0" class="amount-expense">-¥{{ group.totalExpense.toFixed(2) }}</span>
            <span v-if="group.totalIncome > 0" class="amount-income" style="margin-left:8px">+¥{{ group.totalIncome.toFixed(2) }}</span>
          </div>
        </div>
        <div class="date-records card">
          <div v-for="record in group.records" :key="record.id" class="record-item">
            <div class="record-main" @click="editRecord(record)">
              <div class="list-item-icon" :style="{ background: record.categoryColor + '20' }">{{ record.categoryIcon }}</div>
              <div class="list-item-content">
                <div class="list-item-title">{{ record.note || record.categoryName }}</div>
                <div class="list-item-subtitle">{{ record.categoryName }}</div>
              </div>
              <div class="list-item-trailing">
                <span class="amount" :class="record.type === 'income' ? 'amount-income' : 'amount-expense'">
                  {{ record.type === 'income' ? '+' : '-' }}¥{{ record.amount.toFixed(2) }}
                </span>
              </div>
            </div>
            <button class="delete-btn" @click="confirmDelete(record)">🗑️</button>
          </div>
        </div>
      </div>
    </div>
    <div v-else class="empty-state">
      <div class="empty-state-icon">📭</div>
      <div class="empty-state-title">{{ searchQuery ? '没有找到匹配的记录' : '还没有记账记录' }}</div>
      <div class="empty-state-desc">{{ searchQuery ? '试试其他关键词' : '快去记一笔吧！' }}</div>
    </div>
    <AppModal v-model="showEditModal" title="编辑记录">
      <div v-if="editingRecord" class="edit-form">
        <div class="input-group">
          <label class="input-label">金额</label>
          <input v-model.number="editingRecord.amount" type="number" step="0.01" class="input" />
        </div>
        <div class="input-group">
          <label class="input-label">备注</label>
          <input v-model="editingRecord.note" class="input" />
        </div>
        <div class="input-group">
          <label class="input-label">日期</label>
          <input v-model="editingRecord.date" type="date" class="input date-input" />
        </div>
      </div>
      <template #footer>
        <button class="btn btn-secondary" @click="showEditModal = false">取消</button>
        <button class="btn btn-primary" @click="saveEdit" style="flex:1">保存</button>
      </template>
    </AppModal>

    <!-- Delete Confirmation Modal -->
    <AppModal v-model="showDeleteModal" title="确认删除">
      <div class="delete-confirm-body" style="padding: var(--space-base) 0;">
        确定要删除这条账单记录吗？<br>
        <strong>{{ recordToDelete?.categoryName }}</strong> ({{ recordToDelete?.type === 'income' ? '+' : '-' }}¥{{ recordToDelete?.amount.toFixed(2) }})<br>
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
import { useRecordsStore } from '../stores/records.js'
import AppModal from '../components/AppModal.vue'

const recordsStore = useRecordsStore()
const searchQuery = ref('')
const filterType = ref('all')
const showEditModal = ref(false)
const showDeleteModal = ref(false)
const editingRecord = ref(null)
const recordToDelete = ref(null)

const filteredGroups = computed(() => {
  let groups = recordsStore.groupedByDate
  if (filterType.value !== 'all') {
    groups = groups.map(g => ({
      ...g,
      records: g.records.filter(r => r.type === filterType.value),
      totalExpense: filterType.value === 'expense' ? g.totalExpense : 0,
      totalIncome: filterType.value === 'income' ? g.totalIncome : 0
    })).filter(g => g.records.length > 0)
  }
  if (searchQuery.value.trim()) {
    const q = searchQuery.value.trim().toLowerCase()
    groups = groups.map(g => ({
      ...g,
      records: g.records.filter(r =>
        (r.note && r.note.toLowerCase().includes(q)) ||
        (r.categoryName && r.categoryName.toLowerCase().includes(q))
      )
    })).filter(g => g.records.length > 0)
  }
  return groups
})

function formatDateLabel(dateStr) {
  const today = new Date().toISOString().split('T')[0]
  const yesterday = new Date(Date.now() - 86400000).toISOString().split('T')[0]
  if (dateStr === today) return '今天'
  if (dateStr === yesterday) return '昨天'
  const d = new Date(dateStr + 'T00:00:00')
  const weekdays = ['日','一','二','三','四','五','六']
  return `${d.getMonth()+1}月${d.getDate()}日 周${weekdays[d.getDay()]}`
}

function editRecord(record) {
  editingRecord.value = { ...record }
  showEditModal.value = true
}

async function saveEdit() {
  if (!editingRecord.value) return
  await recordsStore.updateRecord(editingRecord.value.id, {
    amount: editingRecord.value.amount,
    note: editingRecord.value.note,
    date: editingRecord.value.date
  })
  showEditModal.value = false
}

function confirmDelete(record) {
  recordToDelete.value = record
  showDeleteModal.value = true
}

async function executeDelete() {
  if (recordToDelete.value) {
    await recordsStore.deleteRecord(recordToDelete.value.id)
    showDeleteModal.value = false
    recordToDelete.value = null
  }
}
</script>

<style scoped>
.filter-bar { margin-bottom: var(--space-lg); display: flex; flex-direction: column; gap: var(--space-md); }
.search-wrap { display: flex; align-items: center; gap: var(--space-sm); background: var(--color-bg-input); border: 1px solid var(--color-border); border-radius: var(--radius-md); padding: 0 var(--space-md); }
.search-icon { font-size: 1rem; opacity: 0.5; }
.search-input { background: none; border: none; padding: var(--space-md) 0; }
.search-input:focus { box-shadow: none; }
.filter-chips { display: flex; gap: var(--space-sm); }
.date-group { margin-bottom: var(--space-lg); }
.date-header { display: flex; align-items: center; justify-content: space-between; margin-bottom: var(--space-sm); padding: 0 var(--space-xs); }
.date-label { font-size: var(--font-size-sm); font-weight: var(--font-weight-semibold); color: var(--color-text-secondary); }
.date-totals { font-size: var(--font-size-sm); font-weight: var(--font-weight-medium); }
.date-records { overflow: hidden; padding: 0; }
.record-item { display: flex; align-items: center; }
.record-main { display: flex; align-items: center; gap: var(--space-md); padding: var(--space-md) var(--space-base); flex: 1; min-width: 0; cursor: pointer; transition: background var(--transition-fast); }
.record-main:active { background: var(--color-bg-hover); }
.record-item:not(:last-child) { border-bottom: 1px solid var(--color-border-light); }
.delete-btn { padding: var(--space-md); font-size: 1rem; opacity: 0.4; transition: opacity var(--transition-fast); flex-shrink: 0; background: none; border: none; cursor: pointer; }
.delete-btn:hover { opacity: 1; }
.edit-form { display: flex; flex-direction: column; gap: var(--space-base); }
.date-input { color-scheme: dark; }
</style>
