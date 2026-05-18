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
          <span class="legend-dot" :style="{ background: item.color }"></span>
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

// Category breakdown
const categoryBreakdown = computed(() => {
  const expenses = periodRecords.value.filter(r => r.type === 'expense')
  const total = expenses.reduce((s, r) => s + r.amount, 0)
  const groups = {}
  for (const r of expenses) {
    const key = r.categoryName || '未分类'
    if (!groups[key]) groups[key] = { name: key, icon: r.categoryIcon || '📦', color: r.categoryColor || '#94a3b8', amount: 0 }
    groups[key].amount += r.amount
  }
  return Object.values(groups)
    .sort((a, b) => b.amount - a.amount)
    .map(g => ({ ...g, percent: total > 0 ? Math.round(g.amount / total * 100) : 0 }))
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
  nextTick(() => {
    // Trend chart
    if (trendChart) trendChart.destroy()
    if (trendChartRef.value) {
      const ctx = trendChartRef.value.getContext('2d')
      const gradient = ctx.createLinearGradient(0, 0, 0, 200)
      gradient.addColorStop(0, 'rgba(102, 126, 234, 0.3)')
      gradient.addColorStop(1, 'rgba(102, 126, 234, 0)')
      trendChart = new Chart(ctx, {
        type: 'line',
        data: {
          labels: trendData.value.labels,
          datasets: [{
            data: trendData.value.data,
            borderColor: '#667eea',
            backgroundColor: gradient,
            fill: true,
            tension: 0.4,
            borderWidth: 2,
            pointRadius: 0,
            pointHoverRadius: 5,
            pointHoverBackgroundColor: '#667eea'
          }]
        },
        options: {
          responsive: true,
          maintainAspectRatio: false,
          plugins: { legend: { display: false }, tooltip: {
            backgroundColor: 'rgba(30,30,55,0.9)', titleColor: '#fff', bodyColor: '#fff',
            borderColor: 'rgba(102,126,234,0.3)', borderWidth: 1, cornerRadius: 8,
            callbacks: { label: (ctx) => `¥${ctx.raw.toFixed(2)}` }
          }},
          scales: {
            x: { grid: { display: false }, ticks: { color: 'rgba(255,255,255,0.4)', font: { size: 10 }, maxTicksLimit: viewMode.value === 'month' ? 10 : 12 } },
            y: { grid: { color: 'rgba(255,255,255,0.05)' }, ticks: { color: 'rgba(255,255,255,0.4)', font: { size: 10 }, callback: v => `¥${v}` } }
          }
        }
      })
    }
    // Category doughnut
    if (categoryChart) categoryChart.destroy()
    if (categoryChartRef.value && categoryBreakdown.value.length > 0) {
      categoryChart = new Chart(categoryChartRef.value.getContext('2d'), {
        type: 'doughnut',
        data: {
          labels: categoryBreakdown.value.map(c => c.name),
          datasets: [{
            data: categoryBreakdown.value.map(c => c.amount),
            backgroundColor: categoryBreakdown.value.map(c => c.color),
            borderWidth: 0,
            hoverOffset: 8
          }]
        },
        options: {
          responsive: true,
          maintainAspectRatio: false,
          cutout: '65%',
          plugins: {
            legend: { display: false },
            tooltip: {
              backgroundColor: 'rgba(30,30,55,0.9)', titleColor: '#fff', bodyColor: '#fff',
              borderColor: 'rgba(102,126,234,0.3)', borderWidth: 1, cornerRadius: 8,
              callbacks: { label: (ctx) => `${ctx.label}: ¥${ctx.raw.toFixed(2)}` }
            }
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
onMounted(renderCharts)
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
.chart-section { margin-bottom: var(--space-lg); }
.chart-title { font-size: var(--font-size-base); font-weight: var(--font-weight-semibold); margin-bottom: var(--space-md); color: var(--color-text-secondary); }
.chart-container { height: 200px; position: relative; }
.chart-container-doughnut { height: 220px; margin-bottom: var(--space-base); }
.category-legend { display: flex; flex-direction: column; gap: var(--space-sm); }
.legend-item { display: flex; align-items: center; gap: var(--space-sm); font-size: var(--font-size-sm); }
.legend-dot { width: 10px; height: 10px; border-radius: 50%; flex-shrink: 0; }
.legend-name { flex: 1; }
.legend-amount { font-weight: var(--font-weight-medium); font-variant-numeric: tabular-nums; }
.legend-percent { color: var(--color-text-secondary); min-width: 2.5rem; text-align: right; }

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
