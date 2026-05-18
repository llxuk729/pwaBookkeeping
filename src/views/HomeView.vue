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
      <!-- Parser Status Indicator -->
      <div class="ai-status-indicator">
        <span class="ai-status-dot" :class="parserStatus.status"></span>
        <span class="ai-status-text">{{ parserStatus.message }}</span>
        <div v-if="parserStatus.status === 'loading' && parserStatus.progress > 0" class="ai-progress-bar">
          <div class="ai-progress-fill" :style="{ width: parserStatus.progress + '%' }"></div>
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
          @click="handleVoiceButtonClick"
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

    <!-- Multiple Items Preview -->
    <transition name="modal">
      <div v-if="parseResults.length > 0" class="multi-items-preview card card-glow" id="multi-items-preview">
        <div class="parse-header">
          <span class="parse-badge">AI 识别结果 ({{ parseResults.length }} 项)</span>
          <button class="btn btn-ghost btn-sm" @click="clearParse">取消</button>
        </div>

        <div class="multi-items-list">
          <div v-for="(item, index) in parseResults" :key="index" class="multi-item-card">
            <div class="multi-item-header">
              <span class="multi-item-index">#{{ index + 1 }}</span>
              <span class="multi-item-name">{{ item.note || item.categoryName || '未命名' }}</span>
            </div>
            
            <div class="multi-item-fields">
              <div class="multi-field">
                <label>金额</label>
                <input v-model.number="item.amount" type="number" step="0.01" class="input input-sm" />
              </div>
              
              <div class="multi-field">
                <label>分类</label>
                <select v-model="item.categoryId" class="input input-sm" @change="updateItemCategory(item)">
                  <!-- Show new category option if applicable -->
                  <option v-if="item.isNewCategory" :value="null" style="background: rgba(148, 163, 184, 0.2);">
                    ✨ {{ item.categoryName }} (新)
                  </option>
                  <option value="">选择分类</option>
                  <option v-for="cat in currentCategoriesForItem(item)" :key="cat.id" :value="cat.id">
                    {{ cat.icon }} {{ cat.name }}
                  </option>
                </select>
              </div>
              
              <div class="multi-field">
                <label>备注</label>
                <input v-model="item.note" class="input input-sm" placeholder="备注..." />
              </div>
            </div>
          </div>
        </div>

        <button
          class="btn btn-primary btn-block btn-lg save-btn"
          @click="handleSaveMultiple"
          :disabled="!canSaveMultiple"
          id="save-multiple-btn"
        >
          <span>💾</span>
          <span>保存全部 ({{ parseResults.length }})</span>
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
import { parseInput, parseMultipleItems } from '../services/newParser.js'
import { exportBackup } from '../services/export.js'

const recordsStore = useRecordsStore()
const categoriesStore = useCategoriesStore()
const { isListening, transcript, interimTranscript, isSupported, toggleListening } = useSpeech()

// Parser status (simplified - no AI model loading needed)
const parserStatus = {
  status: 'ready',
  message: '解析引擎就绪',
  progress: 100
}

const inputRef = ref(null)
const inputText = ref('')
const parseResult = ref(null)
const parseResults = ref([]) // For multiple items

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

const canSaveMultiple = computed(() => {
  if (parseResults.value.length === 0) return false;
  return parseResults.value.every(item => 
    item.amount > 0 && (item.categoryId || item.isNewCategory)
  );
})

// Watch speech transcript
watch(transcript, (val) => {
  if (val) {
    inputText.value = val
    handleParse()
  }
})

// Handle voice button click with better UX for PWA
async function handleVoiceButtonClick() {
  // Check if we're in PWA standalone mode
  const isStandalone = window.matchMedia('(display-mode: standalone)').matches || 
                      window.navigator.standalone
  
  if (isStandalone && !isListening.value) {
    // In PWA mode, show a brief message about permission if needed
    try {
      await toggleListening()
    } catch (err) {
      console.warn('Voice recognition error:', err)
    }
  } else {
    // Normal browser mode
    toggleListening()
  }
}

function handleInputChange() {
  // Auto-parse on input (debounced effect)
}

async function handleParse() {
  if (!inputText.value.trim()) return

  const allCategories = categoriesStore.categories
  
  // Try to parse multiple items first
  const results = await parseMultipleItems(inputText.value, allCategories)
  
  if (results.length === 0) {
    parseResult.value = null
    parseResults.value = []
    return
  }
  
  if (results.length === 1) {
    // Single item - use the original display logic
    const result = results[0]
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
    parseResults.value = []
  } else {
    // Multiple items - show all for batch saving
    
    // Apply default category logic to each item (same as single item)
    // Only set default if: no categoryId AND not a new category
    results.forEach((item) => {
      if (!item.categoryId && !item.isNewCategory) {
        const defaultCat = item.type === 'income'
          ? categoriesStore.incomeCategories[0]
          : categoriesStore.expenseCategories[0]
        if (defaultCat) {
          item.categoryId = defaultCat.id
          item.categoryName = defaultCat.name
        }
      }
    })
    
    parseResult.value = null
    parseResults.value = results
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

function currentCategoriesForItem(item) {
  if (!item) return [];
  return item.type === 'income'
    ? categoriesStore.incomeCategories
    : categoriesStore.expenseCategories;
}

function updateItemCategory(item) {
  const cats = item.type === 'income'
    ? categoriesStore.incomeCategories
    : categoriesStore.expenseCategories;
  const selectedCat = cats.find(c => c.id === item.categoryId);
  
  if (selectedCat) {
    // User selected an existing category
    item.categoryName = selectedCat.name;
    item.type = selectedCat.type;
    item.isNewCategory = false;
  } else if (item.categoryId === null && item.isNewCategory) {
    // Keep the new category as is (when user selects the "新" option)
    // Do nothing, preserve isNewCategory and categoryName
  } else {
    // User selected empty option, reset to default
    item.isNewCategory = false;
    item.categoryName = '';
    const defaultCat = item.type === 'income'
      ? categoriesStore.incomeCategories[0]
      : categoriesStore.expenseCategories[0];
    if (defaultCat) {
      item.categoryId = defaultCat.id;
      item.categoryName = defaultCat.name;
    }
  }
}

function clearParse() {
  parseResult.value = null
  parseResults.value = []  // Clear multiple items array
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
    // Silently handle save errors
  }
}

async function handleSaveMultiple() {
  if (!canSaveMultiple.value) return

  try {
    for (const item of parseResults.value) {
      let categoryIdToSave = item.categoryId;
      
      // If it's a new category, create it first
      if (item.isNewCategory) {
        const newCategory = {
          name: item.categoryName,
          type: item.type,
          icon: '✨',
          color: '#94a3b8',
          order: 99,
          isDefault: 0
        };
        categoryIdToSave = await categoriesStore.addCategory(newCategory);
      }

      await recordsStore.addRecord({
        type: item.type,
        categoryId: categoryIdToSave,
        amount: item.amount,
        note: item.note,
        date: item.date,
        weather: item.weather || ''
      });
    }

    clearParse();
  } catch (err) {
    // Silently handle batch save errors
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

/* Add a subtle glow effect for PWA mode */
@media (display-mode: standalone) {
  .voice-btn:not(.voice-active):hover {
    box-shadow: 0 0 15px rgba(102, 126, 234, 0.3);
  }
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

/* Multi Items Preview */
.multi-items-preview {
  margin-bottom: var(--space-xl);
  border-color: var(--color-border-accent);
}

.multi-items-list {
  display: flex;
  flex-direction: column;
  gap: var(--space-md);
  margin-bottom: var(--space-lg);
  max-height: 60vh;
  overflow-y: auto;
}

.multi-item-card {
  padding: var(--space-md);
  background: var(--color-bg-input);
  border-radius: var(--radius-md);
  border: 1px solid var(--color-border);
}

.multi-item-header {
  display: flex;
  align-items: center;
  gap: var(--space-sm);
  margin-bottom: var(--space-md);
  padding-bottom: var(--space-sm);
  border-bottom: 1px solid var(--color-border-light);
}

.multi-item-index {
  display: inline-flex;
  align-items: center;
  justify-content: center;
  width: 1.5rem;
  height: 1.5rem;
  background: var(--gradient-primary);
  color: #fff;
  border-radius: var(--radius-full);
  font-size: var(--font-size-xs);
  font-weight: var(--font-weight-bold);
}

.multi-item-name {
  font-size: var(--font-size-md);
  font-weight: var(--font-weight-semibold);
  color: var(--color-text);
}

.multi-item-fields {
  display: grid;
  grid-template-columns: repeat(auto-fit, minmax(120px, 1fr));
  gap: var(--space-sm);
}

.multi-field {
  display: flex;
  flex-direction: column;
  gap: var(--space-xs);
}

.multi-field label {
  font-size: var(--font-size-xs);
  color: var(--color-text-secondary);
  font-weight: var(--font-weight-medium);
}

.input-sm {
  padding: var(--space-xs) var(--space-sm);
  font-size: var(--font-size-sm);
}

@keyframes pulse-dot {
  0% { transform: scale(0.9); opacity: 0.6; }
  50% { transform: scale(1.1); opacity: 1; }
  100% { transform: scale(0.9); opacity: 0.6; }
}
</style>
