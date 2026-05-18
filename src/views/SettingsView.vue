<template>
  <div class="page settings-page">
    <h1 class="page-title">设置</h1>

    <!-- UI Settings -->
    <div class="settings-section">
      <div class="section-header"><span class="section-title">界面设置</span></div>
      <div class="card settings-card">
        <div class="setting-item">
          <span class="setting-icon">🎨</span>
          <div class="setting-content">
            <div class="setting-title">主题模式</div>
            <div class="setting-desc">当前: {{ isDarkTheme ? '深色' : '浅色' }}</div>
          </div>
          <div class="theme-toggle">
            <button class="btn btn-sm" :class="!isDarkTheme ? 'btn-primary' : 'btn-ghost'" @click="setTheme('light')">浅色</button>
            <button class="btn btn-sm" :class="isDarkTheme ? 'btn-primary' : 'btn-ghost'" @click="setTheme('dark')">深色</button>
          </div>
        </div>
      </div>
    </div>

    <!-- Data Management -->
    <div class="settings-section">
      <div class="section-header"><span class="section-title">数据管理</span></div>
      <div class="card settings-card">
        <div class="setting-item" @click="handleExportCSV">
          <span class="setting-icon">📄</span>
          <div class="setting-content">
            <div class="setting-title">导出CSV</div>
            <div class="setting-desc">导出所有记录为CSV表格文件</div>
          </div>
          <span class="setting-arrow">→</span>
        </div>
        <div class="divider"></div>
        <div class="setting-item" @click="handleExportBackup">
          <span class="setting-icon">💾</span>
          <div class="setting-content">
            <div class="setting-title">备份数据</div>
            <div class="setting-desc">导出完整数据备份(JSON)</div>
          </div>
          <span class="setting-arrow">→</span>
        </div>
        <div class="divider"></div>
        <div class="setting-item" @click="triggerImport">
          <span class="setting-icon">📥</span>
          <div class="setting-content">
            <div class="setting-title">恢复数据</div>
            <div class="setting-desc">从备份文件恢复数据</div>
          </div>
          <span class="setting-arrow">→</span>
        </div>
        <input ref="fileInputRef" type="file" accept=".json" style="display:none" @change="handleImportBackup" />
      </div>
    </div>

    <!-- Statistics -->
    <div class="settings-section">
      <div class="section-header"><span class="section-title">数据概览</span></div>
      <div class="card settings-card">
        <div class="stat-row">
          <span class="stat-label">总记录数</span>
          <span class="stat-value">{{ recordsStore.records.length }}</span>
        </div>
        <div class="divider"></div>
        <div class="stat-row">
          <span class="stat-label">分类数</span>
          <span class="stat-value">{{ categoriesStore.categories.length }}</span>
        </div>
        <div class="divider"></div>
        <div class="stat-row">
          <span class="stat-label">本月支出</span>
          <span class="stat-value amount-expense">¥{{ recordsStore.monthExpense.toFixed(2) }}</span>
        </div>
        <div class="divider"></div>
        <div class="stat-row">
          <span class="stat-label">本月收入</span>
          <span class="stat-value amount-income">¥{{ recordsStore.monthIncome.toFixed(2) }}</span>
        </div>
      </div>
    </div>

    <!-- Danger Zone -->
    <div class="settings-section">
      <div class="section-header"><span class="section-title">危险操作</span></div>
      <div class="card settings-card">
        <div class="setting-item danger-item" @click="handleClearData">
          <span class="setting-icon">⚠️</span>
          <div class="setting-content">
            <div class="setting-title" style="color: var(--color-danger)">清除所有数据</div>
            <div class="setting-desc">删除所有记录并恢复默认分类</div>
          </div>
        </div>
      </div>
    </div>

    <!-- About -->
    <div class="settings-section about-section">
      <div class="about-info">
        <div class="about-name">智能记账</div>
        <div class="about-version">v1.0.0</div>
        <div class="about-desc">语音输入 · AI辅助 · 离线可用</div>
      </div>
    </div>
  </div>
</template>

<script setup>
import { ref, onMounted } from 'vue'
import { useRecordsStore } from '../stores/records.js'
import { useCategoriesStore } from '../stores/categories.js'
import { exportToCSV, exportBackup, importBackup } from '../services/export.js'
import { db, initializeDB } from '../db/database.js'

const recordsStore = useRecordsStore()
const categoriesStore = useCategoriesStore()
const fileInputRef = ref(null)

const isDarkTheme = ref(false)

onMounted(() => {
  isDarkTheme.value = document.documentElement.classList.contains('dark')
})

function setTheme(theme) {
  if (theme === 'dark') {
    document.documentElement.classList.add('dark')
    localStorage.setItem('theme', 'dark')
    isDarkTheme.value = true
  } else {
    document.documentElement.classList.remove('dark')
    localStorage.setItem('theme', 'light')
    isDarkTheme.value = false
  }
}

async function handleExportCSV() {
  try {
    if (recordsStore.records.length === 0) { alert('没有可导出的数据'); return }
    exportToCSV(recordsStore.records)
  } catch (e) { alert(e.message) }
}

async function handleExportBackup() {
  try { await exportBackup(); alert('备份成功！') } catch (e) { alert('备份失败: ' + e.message) }
}

function triggerImport() { fileInputRef.value?.click() }

async function handleImportBackup(event) {
  const file = event.target.files?.[0]
  if (!file) return
  if (!confirm('恢复数据将覆盖当前所有数据，确定继续吗？')) { event.target.value = ''; return }
  try {
    const result = await importBackup(file)
    await categoriesStore.loadCategories()
    await recordsStore.loadRecords()
    alert(`恢复成功！已导入 ${result.recordCount} 条记录，${result.categoryCount} 个分类`)
  } catch (e) { alert('恢复失败: ' + e.message) }
  event.target.value = ''
}

async function handleClearData() {
  if (!confirm('确定要清除所有数据吗？此操作不可恢复！')) return
  if (!confirm('再次确认：所有记账数据将被永久删除！')) return
  await db.records.clear()
  await db.categories.clear()
  await initializeDB()
  await categoriesStore.loadCategories()
  await recordsStore.loadRecords()
  alert('数据已清除')
}
</script>

<style scoped>
.settings-section { margin-bottom: var(--space-xl); }
.settings-card { padding: 0; overflow: hidden; }
.settings-card .divider { margin: 0; }
.setting-item { display: flex; align-items: center; gap: var(--space-md); padding: var(--space-base); cursor: pointer; transition: background var(--transition-fast); }
.setting-item:active { background: var(--color-bg-hover); }
.setting-icon { font-size: 1.3rem; flex-shrink: 0; }
.setting-content { flex: 1; }
.setting-title { font-size: var(--font-size-base); font-weight: var(--font-weight-medium); }
.setting-desc { font-size: var(--font-size-sm); color: var(--color-text-secondary); margin-top: 2px; }
.setting-arrow { color: var(--color-text-tertiary); }
.theme-toggle { display: flex; gap: var(--space-xs); }
.stat-row { display: flex; align-items: center; justify-content: space-between; padding: var(--space-md) var(--space-base); }
.stat-label { font-size: var(--font-size-base); color: var(--color-text-secondary); }
.stat-value { font-size: var(--font-size-base); font-weight: var(--font-weight-semibold); font-variant-numeric: tabular-nums; }
.about-section { text-align: center; padding: var(--space-2xl) 0; }
.about-name { font-size: var(--font-size-lg); font-weight: var(--font-weight-bold); background: var(--gradient-primary); -webkit-background-clip: text; -webkit-text-fill-color: transparent; background-clip: text; }
.about-version { font-size: var(--font-size-sm); color: var(--color-text-tertiary); margin-top: var(--space-xs); }
.about-desc { font-size: var(--font-size-sm); color: var(--color-text-secondary); margin-top: var(--space-xs); }
</style>
