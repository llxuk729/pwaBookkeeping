<template>
  <div class="page stats-page">
    <h1 class="page-title">统计报表</h1>

    <!-- Period Selector -->
    <div class="period-selector">
      <div class="tab-bar">
        <button class="tab-item" :class="{ active: viewMode === 'month' }" @click="viewMode = 'month'">月度</button>
        <button class="tab-item" :class="{ active: viewMode === 'year' }" @click="viewMode = 'year'">年度</button>
      </div>
      <div class="period-nav">
        <button class="btn btn-ghost btn-sm" @click="prevPeriod">◀</button>
        <span class="period-label">{{ periodLabel }}</span>
        <button class="btn btn-ghost btn-sm" @click="nextPeriod" :disabled="isCurrentPeriod">▶</button>
      </div>
    </div>

    <!-- Overview Cards -->
    <div class="overview-cards">
      <div class="overview-card">
        <span class="overview-label">总支出</span>
        <span class="overview-amount amount-expense">¥{{ totalExpense.toFixed(2) }}</span>
      </div>
      <div class="overview-card">
        <span class="overview-label">总收入</span>
        <span class="overview-amount amount-income">¥{{ totalIncome.toFixed(2) }}</span>
      </div>
      <div class="overview-card overview-card-balance">
        <span class="overview-label">结余</span>
        <span class="overview-amount" :class="balance >= 0 ? 'amount-income' : 'amount-expense'">
          ¥{{ balance.toFixed(2) }}
        </span>
      </div>
    </div>

    <!-- Trend Chart -->
    <div class="chart-section card">
      <h3 class="chart-title">{{ viewMode === 'month' ? '日支出趋势' : '月支出趋势' }}</h3>
      <div class="chart-container">
        <canvas ref="trendChartRef" id="trend-chart"></canvas>
      </div>
    </div>

    <!-- Category Breakdown -->
    <div class="chart-section card">
      <h3 class="chart-title">分类占比</h3>
      <div class="chart-container chart-container-doughnut">
        <canvas ref="categoryChartRef" id="category-chart"></canvas>
      </div>
      <div class="category-legend">
        <div v-for="item in categoryBreakdown" :key="item.name" class="legend-item">
          <div class="legend-dot-wrapper">
            <span class="legend-dot" :style="{ background: item.color ? `linear-gradient(135deg, ${item.color.from}, ${item.color.to})` : '#94a3b8' }"></span>
          </div>
          <span class="legend-name">{{ item.icon }} {{ item.name }}</span>
          <span class="legend-amount">¥{{ item.amount.toFixed(2) }}</span>
          <span class="legend-percent">{{ item.percent }}%</span>
        </div>
      </div>
    </div>

    <!-- Weather & Income Correlation -->
    <div v-if="weatherIncomeStats.length > 0" class="chart-section card">
      <h3 class="chart-title">☀️ 天气对收入的影响 (日均营业收入)</h3>
      <div class="weather-stats-list">
        <div v-for="item in weatherIncomeStats" :key="item.value" class="weather-stat-item">
          <span class="weather-stat-icon">{{ item.icon }}</span>
          <div class="weather-stat-info">
            <div class="weather-stat-header">
              <span class="weather-stat-name">{{ item.label }}</span>
              <span class="weather-stat-value">日均 ¥{{ item.avg.toFixed(2) }}</span>
            </div>
            <div class="weather-stat-bar-track">
              <div class="weather-stat-bar-fill" :style="{ width: getBarWidth(item.avg) + '%', background: `linear-gradient(90deg, ${item.color}30, ${item.color})` }"></div>
            </div>
            <span class="weather-stat-details">累计营业额 ¥{{ item.total.toFixed(2) }} / 共记录 {{ item.count }} 天</span>
          </div>
        </div>
      </div>
    </div>
  </div>
</template>

<script setup>
import { ref, computed, watch, onMounted, nextTick } from 'vue'
import { useRecordsStore } from '../stores/records.js'
import { Chart, registerables } from 'chart.js'

Chart.register(...registerables)

const recordsStore = useRecordsStore()

// Get CSS variable value
function getCSSVar(varName) {
  return getComputedStyle(document.documentElement).getPropertyValue(varName).trim()
}

// Check if dark mode
function isDarkMode() {
  return document.documentElement.classList.contains('dark')
}

// Get theme-aware colors
function getThemeColors() {
  const isDark = isDarkMode()
  return {
    textPrimary: isDark ? 'rgba(255,255,255,0.92)' : 'rgba(0,0,0,0.88)',
    textSecondary: isDark ? 'rgba(255,255,255,0.56)' : 'rgba(0,0,0,0.56)',
    gridColor: isDark ? 'rgba(255,255,255,0.08)' : 'rgba(0,0,0,0.08)',
    tooltipBg: isDark ? 'rgba(30,30,55,0.95)' : 'rgba(255,255,255,0.95)',
    tooltipText: isDark ? '#fff' : 'rgba(0,0,0,0.88)',
    accent: getCSSVar('--color-accent') || '#667eea'
  }
}
const viewMode = ref('month')
const currentYear = ref(new Date().getFullYear())
const currentMonth = ref(new Date().getMonth() + 1)
const trendChartRef = ref(null)
const categoryChartRef = ref(null)
let trendChart = null
let categoryChart = null

const periodLabel = computed(() => {
  if (viewMode.value === 'month') return `${currentYear.value}年${currentMonth.value}月`
  return `${currentYear.value}年`
})

const isCurrentPeriod = computed(() => {
  const now = new Date()
  if (viewMode.value === 'month') return currentYear.value === now.getFullYear() && currentMonth.value === now.getMonth() + 1
  return currentYear.value === now.getFullYear()
})

function prevPeriod() {
  if (viewMode.value === 'month') {
    currentMonth.value--
    if (currentMonth.value < 1) { currentMonth.value = 12; currentYear.value-- }
  } else { currentYear.value-- }
}

function nextPeriod() {
  if (isCurrentPeriod.value) return
  if (viewMode.value === 'month') {
    currentMonth.value++
    if (currentMonth.value > 12) { currentMonth.value = 1; currentYear.value++ }
  } else { currentYear.value++ }
}

// Filtered records for current period
const periodRecords = computed(() => {
  if (viewMode.value === 'month') {
    const prefix = `${currentYear.value}-${String(currentMonth.value).padStart(2,'0')}`
    return recordsStore.records.filter(r => r.date.startsWith(prefix))
  }
  return recordsStore.records.filter(r => r.date.startsWith(String(currentYear.value)))
})

const totalExpense = computed(() => periodRecords.value.filter(r => r.type === 'expense').reduce((s, r) => s + r.amount, 0))
const totalIncome = computed(() => periodRecords.value.filter(r => r.type === 'income').reduce((s, r) => s + r.amount, 0))
const balance = computed(() => totalIncome.value - totalExpense.value)

// Light premium color palette - cycling through
// 浅色高级感配色 - 明亮清新，循环使用
const categoryColorPalette = [
  { from: '#fef08a', to: '#fde047' },  // 明黄
  { from: '#c4b5fd', to: '#a78bfa' },  // 浅紫
  { from: '#e5e7eb', to: '#d1d5db' },  // 浅灰
  { from: '#fef3c7', to: '#fde68a' },  // 奶黄
  { from: '#fed7aa', to: '#fdba74' },  // 桃橙
  { from: '#e0e7ff', to: '#c7d2fe' },  // 浅蓝
  { from: '#fecaca', to: '#fca5a5' },  // 浅粉
  { from: '#fef9c3', to: '#fef08a' },  // 浅黄
  { from: '#f1f5f9', to: '#e2e8f0' },  // 霜白
  { from: '#fdba74', to: '#fb923c' },  // 亮橙
  { from: '#fde047', to: '#facc15' },  // 金黄
  { from: '#fcd34d', to: '#fbbf24' },  // 琥珀
  { from: '#f8fafc', to: '#f1f5f9' },  // 雪白
  { from: '#fca5a5', to: '#f87171' },  // 玫红
  { from: '#d8b4fe', to: '#c084fc' },  // 淡紫
  { from: '#d6d3d1', to: '#a8a29e' },  // 浅褐
  { from: '#86efac', to: '#4ade80' },  // 鲜绿
  { from: '#6ee7b7', to: '#34d399' },  // 薄荷
]

// Create gradient for chart
function createGradient(ctx, fromColor, toColor) {
  const gradient = ctx.createLinearGradient(0, 0, 0, 100)
  gradient.addColorStop(0, fromColor)
  gradient.addColorStop(1, toColor)
  return gradient
}

// Get color from palette by index (cycling through)
function getCategoryColor(index) {
  return categoryColorPalette[index % categoryColorPalette.length]
}

// Category breakdown
const categoryBreakdown = computed(() => {
  const expenses = periodRecords.value.filter(r => r.type === 'expense')
  const total = expenses.reduce((s, r) => s + r.amount, 0)
  const groups = {}
  for (const r of expenses) {
    const key = r.categoryName || '未分类'
    if (!groups[key]) groups[key] = { name: key, icon: r.categoryIcon || '📦', amount: 0 }
    groups[key].amount += r.amount
  }
  return Object.values(groups)
    .sort((a, b) => b.amount - a.amount)
    .map((g, i) => ({ 
      ...g, 
      color: getCategoryColor(i),
      percent: total > 0 ? Math.round(g.amount / total * 100) : 0 
    }))
})

// Trend data
const trendData = computed(() => {
  const expenses = periodRecords.value.filter(r => r.type === 'expense')
  if (viewMode.value === 'month') {
    const daysInMonth = new Date(currentYear.value, currentMonth.value, 0).getDate()
    const labels = Array.from({ length: daysInMonth }, (_, i) => `${i + 1}日`)
    const data = new Array(daysInMonth).fill(0)
    for (const r of expenses) {
      const day = parseInt(r.date.split('-')[2]) - 1
      data[day] += r.amount
    }
    return { labels, data }
  } else {
    const labels = ['1月','2月','3月','4月','5月','6月','7月','8月','9月','10月','11月','12月']
    const data = new Array(12).fill(0)
    for (const r of expenses) {
      const month = parseInt(r.date.split('-')[1]) - 1
      data[month] += r.amount
    }
    return { labels, data }
  }
})

function renderCharts() {
  const themeColors = getThemeColors()
  
  nextTick(() => {
    // Trend chart
    if (trendChart) trendChart.destroy()
    if (trendChartRef.value) {
      const ctx = trendChartRef.value.getContext('2d')
      const gradient = ctx.createLinearGradient(0, 0, 0, 200)
      gradient.addColorStop(0, `${themeColors.accent}66`) // 40% opacity
      gradient.addColorStop(1, `${themeColors.accent}00`) // 0% opacity
      trendChart = new Chart(ctx, {
        type: 'line',
        data: {
          labels: trendData.value.labels,
          datasets: [{
            data: trendData.value.data,
            borderColor: themeColors.accent,
            backgroundColor: gradient,
            fill: true,
            tension: 0.4,
            borderWidth: 3,
            pointRadius: 2,
            pointBackgroundColor: themeColors.accent,
            pointBorderColor: isDarkMode() ? 'rgba(255,255,255,0.8)' : 'rgba(0,0,0,0.2)',
            pointBorderWidth: 2,
            pointHoverRadius: 8,
            pointHoverBackgroundColor: themeColors.accent,
            pointHoverBorderColor: isDarkMode() ? '#fff' : '#000',
            pointHoverBorderWidth: 3
          }]
        },
        options: {
          responsive: true,
          maintainAspectRatio: false,
          plugins: { 
            legend: { display: false }, 
            tooltip: {
              backgroundColor: themeColors.tooltipBg,
              titleColor: themeColors.tooltipText,
              bodyColor: themeColors.tooltipText,
              borderColor: `${themeColors.accent}80`,
              borderWidth: 1,
              cornerRadius: 12,
              padding: 12,
              displayColors: false,
              callbacks: { label: (ctx) => `¥${ctx.raw.toFixed(2)}` }
            }
          },
          scales: {
            x: { 
              grid: { display: false },
              ticks: { 
                color: themeColors.textSecondary,
                font: { size: 10 },
                maxTicksLimit: viewMode.value === 'month' ? 10 : 12
              }
            },
            y: { 
              grid: { color: themeColors.gridColor },
              ticks: { 
                color: themeColors.textSecondary,
                font: { size: 10 },
                callback: v => `¥${v}`
              }
            }
          },
          animation: {
            duration: 800,
            easing: 'easeOutQuart'
          }
        }
      })
    }
    // Category doughnut
    if (categoryChart) categoryChart.destroy()
    if (categoryChartRef.value && categoryBreakdown.value.length > 0) {
      const ctx = categoryChartRef.value.getContext('2d')
      
      // Create gradients for each category
      const gradientColors = categoryBreakdown.value.map((c) => {
        const gradient = ctx.createRadialGradient(100, 100, 0, 100, 100, 150)
        gradient.addColorStop(0, c.color.from)
        gradient.addColorStop(1, c.color.to)
        return gradient
      })
      
      categoryChart = new Chart(ctx, {
        type: 'doughnut',
        data: {
          labels: categoryBreakdown.value.map(c => c.name),
          datasets: [{
            data: categoryBreakdown.value.map(c => c.amount),
            backgroundColor: gradientColors,
            borderWidth: 0,
            hoverOffset: 8,
            hoverBorderWidth: 0
          }]
        },
        options: {
          responsive: true,
          maintainAspectRatio: false,
          cutout: '65%',
          plugins: {
            legend: { display: false },
            tooltip: {
              backgroundColor: themeColors.tooltipBg,
              titleColor: themeColors.tooltipText,
              bodyColor: themeColors.tooltipText,
              borderColor: 'transparent',
              borderWidth: 0,
              cornerRadius: 16,
              padding: 16,
              displayColors: true,
              boxPadding: 6,
              callbacks: { 
                label: (ctx) => `${ctx.label}: ¥${ctx.raw.toFixed(2)}`,
                afterLabel: (ctx) => {
                  const percent = categoryBreakdown.value[ctx.dataIndex].percent
                  return `占比: ${percent}%`
                }
              }
            }
          },
          animation: {
            animateRotate: true,
            animateScale: true,
            duration: 1000,
            easing: 'easeOutQuart'
          }
        }
      })
    }
  })
}

// Weather income stats calculation
const weatherIncomeStats = computed(() => {
  const incomes = periodRecords.value.filter(r => r.type === 'income')
  if (incomes.length === 0) return []

  const weatherTotals = { sunny: 0, rainy: 0, cloudy: 0, snowy: 0, windy: 0 }
  const weatherDates = { sunny: new Set(), rainy: new Set(), cloudy: new Set(), snowy: new Set(), windy: new Set() }

  for (const r of incomes) {
    const w = r.weather
    if (w && weatherTotals[w] !== undefined) {
      weatherTotals[w] += r.amount
      weatherDates[w].add(r.date)
    }
  }

  const result = []
  const weatherMap = {
    sunny: { label: '晴天', icon: '☀️', color: '#fbbf24' },
    cloudy: { label: '多云', icon: '⛅', color: '#60a5fa' },
    rainy: { label: '雨天', icon: '🌧️', color: '#a78bfa' },
    snowy: { label: '雪天', icon: '❄️', color: '#38bdf8' },
    windy: { label: '大风', icon: '🍃', color: '#34d399' }
  }

  for (const w of ['sunny', 'cloudy', 'rainy', 'snowy', 'windy']) {
    const count = weatherDates[w].size
    if (count > 0) {
      const total = weatherTotals[w]
      result.push({
        value: w,
        label: weatherMap[w].label,
        icon: weatherMap[w].icon,
        color: weatherMap[w].color,
        total: total,
        count: count,
        avg: total / count
      })
    }
  }

  return result.sort((a, b) => b.avg - a.avg)
})

function getBarWidth(avg) {
  if (weatherIncomeStats.value.length === 0) return 0
  const max = Math.max(...weatherIncomeStats.value.map(item => item.avg), 1)
  return (avg / max) * 100
}

watch([viewMode, currentYear, currentMonth, () => recordsStore.records.length], renderCharts)

// Watch for theme changes
onMounted(() => {
  renderCharts()
  
  // Create a MutationObserver to watch for theme class changes
  const observer = new MutationObserver((mutations) => {
    mutations.forEach((mutation) => {
      if (mutation.attributeName === 'class') {
        renderCharts()
      }
    })
  })
  
  observer.observe(document.documentElement, {
    attributes: true,
    attributeFilter: ['class']
  })
})
</script>

<style scoped>
.period-selector { display: flex; flex-direction: column; gap: var(--space-md); margin-bottom: var(--space-lg); }
.period-nav { display: flex; align-items: center; justify-content: center; gap: var(--space-base); }
.period-label { font-size: var(--font-size-md); font-weight: var(--font-weight-semibold); min-width: 8rem; text-align: center; }
.overview-cards { display: grid; grid-template-columns: 1fr 1fr; gap: var(--space-md); margin-bottom: var(--space-lg); }
.overview-card { padding: var(--space-base); border-radius: var(--radius-lg); background: var(--gradient-surface); border: 1px solid var(--color-border); }
.overview-card-balance { grid-column: 1 / -1; }
.overview-label { display: block; font-size: var(--font-size-sm); color: var(--color-text-secondary); margin-bottom: var(--space-xs); }
.overview-amount { font-size: var(--font-size-xl); font-weight: var(--font-weight-bold); font-variant-numeric: tabular-nums; }
.chart-section { margin-bottom: var(--space-lg); position: relative; }
.chart-title { font-size: var(--font-size-base); font-weight: var(--font-weight-semibold); margin-bottom: var(--space-md); color: var(--color-text-secondary); }
.chart-container { height: 200px; position: relative; }
.chart-container-doughnut { 
  height: 200px; 
  margin-bottom: var(--space-md);
  position: relative;
  overflow: visible;
}

/* Modern glass effect for doughnut chart */
.chart-container-doughnut::before {
  content: ''; position: absolute; inset: 0;
  background: var(--gradient-surface);
  border-radius: var(--radius-lg);
  opacity: 0.3; z-index: -1;
}
.category-legend { display: flex; flex-direction: column; gap: var(--space-sm); }
.legend-item { display: flex; align-items: center; gap: var(--space-md); font-size: var(--font-size-sm); padding: var(--space-xs) 0; }
.legend-dot-wrapper { flex-shrink: 0; position: relative; }
.legend-dot { 
  width: 12px; 
  height: 12px; 
  border-radius: 50%; 
  flex-shrink: 0;
  position: relative;
  box-shadow: 0 2px 8px rgba(0, 0, 0, 0.15);
  transition: transform 0.2s ease, box-shadow 0.2s ease;
}
.legend-item:hover .legend-dot {
  transform: scale(1.2);
  box-shadow: 0 4px 12px rgba(0, 0, 0, 0.25);
}
.legend-name { flex: 1; font-weight: var(--font-weight-medium); }
.legend-amount { font-weight: var(--font-weight-bold); font-variant-numeric: tabular-nums; }
.legend-percent { color: var(--color-text-secondary); min-width: 3rem; text-align: right; font-weight: var(--font-weight-medium); }

/* Weather Stats */
.weather-stats-list {
  display: flex;
  flex-direction: column;
  gap: var(--space-md);
  margin-top: var(--space-sm);
}

.weather-stat-item {
  display: flex;
  align-items: flex-start;
  gap: var(--space-md);
  padding: var(--space-sm) 0;
}

.weather-stat-icon {
  font-size: 1.5rem;
  background: var(--color-bg-input);
  width: 2.75rem;
  height: 2.75rem;
  display: flex;
  align-items: center;
  justify-content: center;
  border-radius: var(--radius-md);
  border: 1px solid var(--color-border);
  flex-shrink: 0;
}

.weather-stat-info {
  flex: 1;
  min-width: 0;
  display: flex;
  flex-direction: column;
  gap: var(--space-xs);
}

.weather-stat-header {
  display: flex;
  justify-content: space-between;
  align-items: center;
  font-size: var(--font-size-base);
}

.weather-stat-name {
  font-weight: var(--font-weight-semibold);
  color: var(--color-text-primary);
}

.weather-stat-value {
  font-weight: var(--font-weight-bold);
  color: var(--color-income);
}

.weather-stat-bar-track {
  height: 8px;
  background: var(--color-bg-input);
  border-radius: var(--radius-full);
  overflow: hidden;
}

.weather-stat-bar-fill {
  height: 100%;
  border-radius: var(--radius-full);
  transition: width 0.6s cubic-bezier(0.16, 1, 0.3, 1);
}

.weather-stat-details {
  font-size: var(--font-size-xs);
  color: var(--color-text-secondary);
}
</style>
