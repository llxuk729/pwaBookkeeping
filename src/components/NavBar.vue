<template>
  <nav class="navbar" id="main-navbar">
    <router-link
      v-for="item in navItems"
      :key="item.path"
      :to="item.path"
      class="nav-item"
      :class="{ active: isActive(item.path) }"
    >
      <span class="nav-icon">{{ item.icon }}</span>
      <span class="nav-label">{{ item.label }}</span>
      <span v-if="isActive(item.path)" class="nav-indicator"></span>
    </router-link>
  </nav>
</template>

<script setup>
import { useRoute } from 'vue-router'

const route = useRoute()

const navItems = [
  { path: '/', icon: '✏️', label: '记账' },
  { path: '/records', icon: '📋', label: '账单' },
  { path: '/stats', icon: '📊', label: '统计' },
  { path: '/categories', icon: '🏷️', label: '分类' },
  { path: '/settings', icon: '⚙️', label: '设置' },
]

function isActive(path) {
  if (path === '/') return route.path === '/'
  return route.path.startsWith(path)
}
</script>

<style scoped>
.navbar {
  position: fixed;
  bottom: 0;
  left: 0;
  right: 0;
  display: flex;
  align-items: center;
  justify-content: space-around;
  height: var(--nav-height);
  padding-bottom: var(--safe-area-bottom);
  background: var(--color-bg-nav);
  backdrop-filter: blur(24px);
  -webkit-backdrop-filter: blur(24px);
  border-top: 1px solid var(--color-border);
  z-index: var(--z-nav);
}

.nav-item {
  display: flex;
  flex-direction: column;
  align-items: center;
  gap: 2px;
  padding: var(--space-xs) var(--space-sm);
  min-width: 3.5rem;
  color: var(--color-text-tertiary);
  text-decoration: none;
  position: relative;
  transition: all var(--transition-base);
  -webkit-tap-highlight-color: transparent;
}

.nav-item.active {
  color: var(--color-accent-light);
}

.nav-icon {
  font-size: 1.35rem;
  line-height: 1;
  transition: transform var(--transition-spring);
}

.nav-item.active .nav-icon {
  transform: scale(1.15);
}

.nav-label {
  font-size: var(--font-size-xs);
  font-weight: var(--font-weight-medium);
}

.nav-indicator {
  position: absolute;
  top: -1px;
  left: 50%;
  transform: translateX(-50%);
  width: 1.5rem;
  height: 2px;
  background: var(--gradient-primary);
  border-radius: 1px;
}
</style>
