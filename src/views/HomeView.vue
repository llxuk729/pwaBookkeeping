<template>
  <div class="page home-page">
    <!-- Header Summary -->
    <div class="home-header">
      <h1 class="page-title">智能记账</h1>
      <div class="summary-cards">
        <div class="summary-card expense-card">
          <span class="summary-label">今日支出</span>
          <span class="summary-amount amount-expense">¥{{ todayExpense.toFixed(2) }}</span>
        </div>
        <div class="summary-card income-card">
          <span class="summary-label">本月支出</span>
          <span class="summary-amount">¥{{ monthExpense.toFixed(2) }}</span>
        </div>
      </div>
    </div>

    <!-- Backup Reminder Banner -->
    <transition name="modal">
      <div v-if="showBackupReminder" class="card backup-reminder-card">
        <div class="backup-reminder-content">
          <span class="backup-icon">💡</span>
          <div class="backup-text">
            <strong>数据安全提醒</strong>
            <p>您上个月的数据尚未备份，建议花 1 秒钟导出备份防止丢失哦！</p>
          </div>
        </div>
        <div class="backup-actions">
          <button class="btn btn-ghost btn-sm" @click="dismissBackupReminder">本月不再提醒</button>
          <button class="btn btn-primary btn-sm" @click="doBackup">立即备份</button>
        </div>
      </div>
    </transition>

    <!-- Quick Input -->
    <div class="input-section card" id="quick-input">
      <!-- AI Status Indicator -->
      <div class="ai-status-indicator">
        <span class="ai-status-dot" :class="aiState.status"></span>
        <span class="ai-status-text">{{ aiState.message }}</span>
        <div v-if="aiState.status === 'loading' && aiState.progress > 0" class="ai-progress-bar">
          <div class="ai-progress-fill" :style="{ width: aiState.progress + '%' }"></div>
        </div>
      </div>

      <div class="input-row">
        <input
          ref="inputRef"
          v-model="inputText"
          class="input input-lg quick-input"
          placeholder="输入记账内容，如：黄小米35"
          @keyup.enter="handleParse"
          @input="handleInputChange"
          id="input-text"
        />
        <button
          class="btn btn-icon voice-btn"
          :class="{ 'voice-active': isListening }"
          @click="toggleListening"
          v-if="isSupported"
          id="voice-btn"
          :title="isListening ? '停止录音' : '语音输入'"
        >
          <span class="voice-icon">🎤</span>
          <span v-if="isListening" class="voice-pulse"></span>
          <span v-if="isListening" class="voice-pulse voice-pulse-2"></span>
        </button>
      </div>

      <!-- Interim transcript -->
      <div v-if="interimTranscript" class="interim-text">
        <span class="interim-indicator">●</span>
        {{ interimTranscript }}
      </div>
    </div>

    <!-- Parse Result Preview -->
    <transition name="modal">
      <div v-if="parseResult" class="parse-preview card card-glow" id="parse-preview">
        <div class="parse-header">
          <span class="parse-badge">AI 识别结果</span>
          <button class="btn btn-ghost btn-sm" @click="clearParse">取消</button>
        </div>

        <div class="parse-fields">
          <!-- Type Toggle -->
          <div class="parse-field">
            <span class="parse-label">类型</span>
            <div class="tab-bar parse-type-toggle">
              <button
                class="tab-item"
                :class="{ active: parseResult.type === 'expense' }"
                @click="parseResult.type = 'expense'; updateCategoryOptions()"
              >支出</button>
              <button
                class="tab-item"
                :class="{ active: parseResult.type === 'income' }"
                @click="parseResult.type = 'income'; updateCategoryOptions()"
              >收入</button>
            </div>
          </div>

          <!-- Amount -->
          <div class="parse-field">
            <span class="parse-label">金额</span>
            <div class="amount-input-wrap">
              <span class="amount-prefix">¥</span>
              <input
                v-model.number="parseResult.amount"
                type="number"
                step="0.01"
                min="0"
                class="input amount-input"
                placeholder="0.00"
                id="amount-input"
              />
            </div>
          </div>

          <!-- Category -->
          <div class="parse-field">
            <span class="parse-label">分类</span>
            <div class="category-grid">
              <!-- Show dynamic new category if any -->
              <button
                v-if="parseResult.isNewCategory"
                class="chip category-chip active"
                style="background: rgba(148, 163, 184, 0.2); border-color: var(--color-accent);"
              >
                <span>✨</span>
                <span>{{ parseResult.categoryName }} (新)</span>
              </button>

              <button
                v-for="cat in currentCategories"
                :key="cat.id"
                class="chip category-chip"
                :class="{ active: parseResult.categoryId === cat.id && !parseResult.isNewCategory }"
                @click="parseResult.categoryId = cat.id; parseResult.categoryName = cat.name; parseResult.isNewCategory = false;"
              >
                <span>{{ cat.icon }}</span>
                <span>{{ cat.name }}</span>
              </button>
            </div>
          </div>

          <!-- Note -->
          <div class="parse-field">
            <span class="parse-label">备注</span>
            <input
              v-model="parseResult.note"
              class="input"
              placeholder="添加备注..."
              id="note-input"
            />
          </div>

          <!-- Date -->
          <div class="parse-field">
            <span class="parse-label">日期</span>
            <input
              v-model="parseResult.date"
              type="date"
              class="input date-input"
              id="date-input"
            />
          </div>

          <!-- Weather impact (Only for income) -->
          <div v-if="parseResult.type === 'income'" class="parse-field">
            <span class="parse-label">当日天气</span>
            <div class="weather-selector">
              <button
                v-for="w in weatherOptions"
                :key="w.value"
                type="button"
                class="chip weather-chip"
                :class="{ active: parseResult.weather === w.value }"
                @click="parseResult.weather = w.value"
              >
                <span>{{ w.icon }}</span>
                <span>{{ w.label }}</span>
              </button>
            </div>
          </div>
        </div>

        <button
          class="btn btn-primary btn-block btn-lg save-btn"
          @click="handleSave"
          :disabled="!canSave"
          id="save-btn"
        >
          <span>💾</span>
          <span>保存记录</span>
        </button>
      </div>
    </transition>

    <!-- Recent Records -->
    <div class="recent-section" v-if="recentRecords.length > 0">
      <div class="section-header">
        <span class="section-title">今日记录</span>
        <router-link to="/records" class="btn btn-ghost btn-sm">查看全部 →</router-link>
      </div>
      <div class="recent-list">
        <div
          v-for="record in recentRecords"
          :key="record.id"
          class="list-item"
        >
          <div class="list-item-icon" :style="{ background: record.categoryColor + '20' }">
            {{ record.categoryIcon }}
          </div>
          <div class="list-item-content">
            <div class="list-item-title">
              {{ record.note || record.categoryName }}
              <span v-if="record.weather" class="weather-tag" :title="getWeatherLabel(record.weather)">
                {{ getWeatherIcon(record.weather) }}
              </span>
            </div>
            <div class="list-item-subtitle">{{ record.categoryName }}</div>
          </div>
          <div class="list-item-trailing">
            <span class="amount" :class="record.type === 'income' ? 'amount-income' : 'amount-expense'">
              {{ record.type === 'income' ? '+' : '-' }}¥{{ record.amount.toFixed(2) }}
            </span>
          </div>
        </div>
      </div>
    </div>

    <!-- Empty state when no parse result and no records -->
    <div v-if="!parseResult && recentRecords.length === 0" class="empty-state">
      <div class="empty-state-icon">📝</div>
      <div class="empty-state-title">开始记账</div>
      <div class="empty-state-desc">输入文字或使用语音记录您的收支</div>
    </div>
  </div>
</template>

<script setup>
import { ref, computed, watch, nextTick, onMounted } from 'vue'
import { useRecordsStore } from '../stores/records.js'
import { useCategoriesStore } from '../stores/categories.js'
import { useSpeech } from '../composables/useSpeech.js'
import { parseInput, aiState } from '../services/parser.js'
import { exportBackup } from '../services/export.js'

const recordsStore = useRecordsStore()
const categoriesStore = useCategoriesStore()
const { isListening, transcript, interimTranscript, isSupported, toggleListening } = useSpeech()

const inputRef = ref(null)
const inputText = ref('')
const parseResult = ref(null)

const weatherOptions = [
  { value: 'sunny', label: '晴天', icon: '☀️' },
  { value: 'cloudy', label: '多云', icon: '⛅' },
  { value: 'rainy', label: '雨天', icon: '🌧️' },
  { value: 'snowy', label: '雪天', icon: '❄️' },
  { value: 'windy', label: '大风', icon: '🍃' }
]

function getWeatherIcon(weatherValue) {
  const option = weatherOptions.find(w => w.value === weatherValue)
  return option ? option.icon : ''
}

function getWeatherLabel(weatherValue) {
  const option = weatherOptions.find(w => w.value === weatherValue)
  return option ? option.label : ''
}

// Today's records
const recentRecords = computed(() => recordsStore.today)
const todayExpense = computed(() => recordsStore.todayExpense)
const monthExpense = computed(() => recordsStore.monthExpense)

// Backup Reminder Logic
const showBackupReminder = ref(false)

onMounted(() => {
  checkBackupReminder()
})

function checkBackupReminder() {
  const now = new Date()
  const currentMonthStr = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}`
  
  // Get previous month
  const prevMonthDate = new Date(now.getFullYear(), now.getMonth() - 1, 1)
  const prevMonthStr = `${prevMonthDate.getFullYear()}-${String(prevMonthDate.getMonth() + 1).padStart(2, '0')}`
  
  // Check if dismissed this month
  const dismissedMonth = localStorage.getItem('dismissedReminderMonth')
  if (dismissedMonth === currentMonthStr) return
  
  // Check if there are records in the previous month
  const hasPrevMonthRecords = recordsStore.records.some(r => r.date.startsWith(prevMonthStr))
  if (!hasPrevMonthRecords) return
  
  // Check if last backup was before the end of the previous month
  const lastBackupStr = localStorage.getItem('lastBackupDate')
  if (!lastBackupStr) {
    showBackupReminder.value = true
    return
  }
  
  const lastBackupTime = new Date(lastBackupStr).getTime()
  // End of previous month
  const endOfPrevMonth = new Date(now.getFullYear(), now.getMonth(), 0, 23, 59, 59).getTime()
  
  if (lastBackupTime < endOfPrevMonth) {
    showBackupReminder.value = true
  }
}

function dismissBackupReminder() {
  const now = new Date()
  const currentMonthStr = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}`
  localStorage.setItem('dismissedReminderMonth', currentMonthStr)
  showBackupReminder.value = false
}

async function doBackup() {
  try {
    await exportBackup()
    alert('备份成功！')
    showBackupReminder.value = false
  } catch (e) {
    alert('备份失败: ' + e.message)
  }
}

// Current category options based on type
const currentCategories = computed(() => {
  if (!parseResult.value) return []
  return parseResult.value.type === 'income'
    ? categoriesStore.incomeCategories
    : categoriesStore.expenseCategories
})

const canSave = computed(() => {
  if (!parseResult.value || parseResult.value.amount <= 0) return false;
  return parseResult.value.categoryId || parseResult.value.isNewCategory;
})

// Watch speech transcript
watch(transcript, (val) => {
  if (val) {
    inputText.value = val
    handleParse()
  }
})

function handleInputChange() {
  // Auto-parse on input (debounced effect)
}

async function handleParse() {
  if (!inputText.value.trim()) return

  const allCategories = categoriesStore.categories
  const result = await parseInput(inputText.value, allCategories)

  if (result) {
    // If no category matched and it's NOT marked as a new category, default to first expense category
    if (!result.categoryId && !result.isNewCategory) {
      const defaultCat = result.type === 'income'
        ? categoriesStore.incomeCategories[0]
        : categoriesStore.expenseCategories[0]
      if (defaultCat) {
        result.categoryId = defaultCat.id
        result.categoryName = defaultCat.name
      }
    }
    parseResult.value = result
  }
}

function updateCategoryOptions() {
  if (parseResult.value) {
    if (parseResult.value.isNewCategory) return; // Keep new category as is
    const cats = parseResult.value.type === 'income'
      ? categoriesStore.incomeCategories
      : categoriesStore.expenseCategories
    if (cats.length > 0 && !cats.find(c => c.id === parseResult.value.categoryId)) {
      parseResult.value.categoryId = cats[0].id
      parseResult.value.categoryName = cats[0].name
    }
  }
}

function clearParse() {
  parseResult.value = null
  inputText.value = ''
  nextTick(() => inputRef.value?.focus())
}

async function handleSave() {
  if (!canSave.value) return

  try {
    // If it's a new category, create it first
    let categoryIdToSave = parseResult.value.categoryId;
    if (parseResult.value.isNewCategory) {
      const newCategory = {
        name: parseResult.value.categoryName,
        type: parseResult.value.type,
        icon: '✨', 
        color: '#94a3b8', 
        order: 99,
        isDefault: 0
      };
      categoryIdToSave = await categoriesStore.addCategory(newCategory);
    }

    await recordsStore.addRecord({
      type: parseResult.value.type,
      categoryId: categoryIdToSave,
      amount: parseResult.value.amount,
      note: parseResult.value.note,
      date: parseResult.value.date,
      weather: parseResult.value.weather || ''
    })

    // Show success via toast (using provide/inject pattern later)
    clearParse()
  } catch (err) {
    console.error('Save failed:', err)
  }
}
</script>

<style scoped>
.home-page {
  padding-top: calc(var(--safe-area-top) + var(--space-xl));
}

.home-header {
  margin-bottom: var(--space-xl);
}

.summary-cards {
  display: grid;
  grid-template-columns: 1fr 1fr;
  gap: var(--space-md);
  margin-top: var(--space-base);
}

.summary-card {
  padding: var(--space-base);
  border-radius: var(--radius-lg);
  background: var(--gradient-surface);
  border: 1px solid var(--color-border);
}

.summary-label {
  display: block;
  font-size: var(--font-size-sm);
  color: var(--color-text-secondary);
  margin-bottom: var(--space-xs);
}

.summary-amount {
  font-size: var(--font-size-xl);
  font-weight: var(--font-weight-bold);
  font-variant-numeric: tabular-nums;
}

/* Backup Reminder */
.backup-reminder-card {
  padding: var(--space-md);
  margin-bottom: var(--space-xl);
  background: rgba(251, 191, 36, 0.1);
  border-color: rgba(251, 191, 36, 0.3);
}

.backup-reminder-content {
  display: flex;
  gap: var(--space-md);
  margin-bottom: var(--space-md);
}

.backup-icon {
  font-size: 1.5rem;
}

.backup-text strong {
  display: block;
  font-size: var(--font-size-sm);
  color: var(--color-text);
  margin-bottom: 2px;
}

.backup-text p {
  font-size: var(--font-size-xs);
  color: var(--color-text-secondary);
  margin: 0;
  line-height: 1.4;
}

.backup-actions {
  display: flex;
  justify-content: flex-end;
  gap: var(--space-sm);
}

/* Input Section */
.input-section {
  margin-bottom: var(--space-xl);
}

.input-row {
  display: flex;
  gap: var(--space-sm);
  align-items: center;
}

.quick-input {
  flex: 1;
}

.voice-btn {
  width: 3rem;
  height: 3rem;
  border-radius: var(--radius-full);
  background: var(--color-bg-input);
  border: 1px solid var(--color-border);
  position: relative;
  flex-shrink: 0;
  transition: all var(--transition-base);
}

.voice-btn.voice-active {
  background: rgba(245, 87, 108, 0.2);
  border-color: var(--color-danger);
}

.voice-icon {
  font-size: 1.2rem;
  position: relative;
  z-index: 2;
}

.voice-pulse {
  position: absolute;
  inset: -4px;
  border-radius: var(--radius-full);
  border: 2px solid var(--color-danger);
  animation: pulse-ring 1.5s ease-out infinite;
}

.voice-pulse-2 {
  animation-delay: 0.5s;
}

.interim-text {
  margin-top: var(--space-sm);
  padding: var(--space-sm) var(--space-md);
  background: rgba(102, 126, 234, 0.1);
  border-radius: var(--radius-sm);
  font-size: var(--font-size-sm);
  color: var(--color-accent-light);
}

.interim-indicator {
  color: var(--color-danger);
  animation: pulse-dot 1s infinite;
  margin-right: var(--space-xs);
}

/* Parse Preview */
.parse-preview {
  margin-bottom: var(--space-xl);
  border-color: var(--color-border-accent);
}

.parse-header {
  display: flex;
  align-items: center;
  justify-content: space-between;
  margin-bottom: var(--space-base);
}

.parse-badge {
  display: inline-flex;
  align-items: center;
  gap: var(--space-xs);
  padding: var(--space-xs) var(--space-md);
  background: var(--gradient-primary);
  border-radius: var(--radius-xl);
  font-size: var(--font-size-sm);
  font-weight: var(--font-weight-medium);
  color: #fff;
}

.parse-fields {
  display: flex;
  flex-direction: column;
  gap: var(--space-base);
  margin-bottom: var(--space-lg);
}

.parse-field {
  display: flex;
  flex-direction: column;
  gap: var(--space-sm);
}

.parse-label {
  font-size: var(--font-size-sm);
  color: var(--color-text-secondary);
  font-weight: var(--font-weight-medium);
}

.parse-type-toggle {
  max-width: 12rem;
}

.amount-input-wrap {
  display: flex;
  align-items: center;
  gap: var(--space-xs);
}

.amount-prefix {
  font-size: var(--font-size-xl);
  font-weight: var(--font-weight-bold);
  color: var(--color-text-secondary);
}

.amount-input {
  font-size: var(--font-size-xl);
  font-weight: var(--font-weight-bold);
  max-width: 10rem;
}

/* Remove number input spinners */
.amount-input::-webkit-inner-spin-button,
.amount-input::-webkit-outer-spin-button {
  -webkit-appearance: none;
  margin: 0;
}

.category-grid {
  display: flex;
  flex-wrap: wrap;
  gap: var(--space-sm);
}

.category-chip {
  font-size: var(--font-size-sm);
}

.date-input {
  max-width: 12rem;
  color-scheme: dark;
}

.save-btn {
  margin-top: var(--space-sm);
}

.save-btn:disabled {
  opacity: 0.5;
  cursor: not-allowed;
}

/* Recent Records */
.recent-section {
  margin-top: var(--space-base);
}

.recent-list {
  background: var(--color-bg-card);
  border-radius: var(--radius-lg);
  border: 1px solid var(--color-border);
  overflow: hidden;
}

.recent-list .list-item:not(:last-child) {
  border-bottom: 1px solid var(--color-border-light);
}

/* AI Status Indicator */
.ai-status-indicator {
  display: flex;
  align-items: center;
  gap: var(--space-xs);
  margin-bottom: var(--space-sm);
  font-size: var(--font-size-xs);
  color: var(--color-text-secondary);
}

.ai-status-dot {
  width: 8px;
  height: 8px;
  border-radius: var(--radius-full);
  background: var(--color-text-tertiary);
  flex-shrink: 0;
}

.ai-status-dot.loading {
  background: #fbbf24;
  animation: pulse-dot 1.5s infinite;
}

.ai-status-dot.ready {
  background: #10b981;
}

.ai-status-dot.error {
  background: #f43f5e;
}

.ai-progress-bar {
  flex: 1;
  height: 4px;
  background: var(--color-bg-input);
  border-radius: var(--radius-full);
  overflow: hidden;
  margin-left: var(--space-sm);
}

.ai-progress-fill {
  height: 100%;
  background: var(--color-accent);
  transition: width 0.3s ease;
}

/* Weather Selector */
.weather-selector {
  display: flex;
  flex-wrap: wrap;
  gap: var(--space-sm);
}

.weather-chip {
  padding: var(--space-xs) var(--space-md);
  font-size: var(--font-size-sm);
}

.weather-tag {
  display: inline-flex;
  align-items: center;
  justify-content: center;
  font-size: 0.85rem;
  margin-left: var(--space-xs);
  vertical-align: middle;
}

@keyframes pulse-dot {
  0% { transform: scale(0.9); opacity: 0.6; }
  50% { transform: scale(1.1); opacity: 1; }
  100% { transform: scale(0.9); opacity: 0.6; }
}
</style>
