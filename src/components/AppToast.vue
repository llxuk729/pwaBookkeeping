<template>
  <Teleport to="body">
    <div class="toast-container" id="toast-container">
      <TransitionGroup name="toast-item">
        <div
          v-for="toast in toasts"
          :key="toast.id"
          class="toast-item"
          :class="`toast-${toast.type}`"
        >
          <span class="toast-icon">{{ iconMap[toast.type] }}</span>
          <span class="toast-message">{{ toast.message }}</span>
        </div>
      </TransitionGroup>
    </div>
  </Teleport>
</template>

<script setup>
import { ref } from 'vue'

const toasts = ref([])
let toastId = 0

const iconMap = {
  success: '✅',
  error: '❌',
  warning: '⚠️',
  info: 'ℹ️'
}

function showToast(message, type = 'success', duration = 2500) {
  const id = ++toastId
  toasts.value.push({ id, message, type })

  setTimeout(() => {
    toasts.value = toasts.value.filter(t => t.id !== id)
  }, duration)
}

// Expose to parent via provide/inject or direct use
defineExpose({ showToast })
</script>

<style scoped>
.toast-container {
  position: fixed;
  top: calc(var(--safe-area-top) + var(--space-base));
  left: 50%;
  transform: translateX(-50%);
  z-index: var(--z-toast);
  display: flex;
  flex-direction: column;
  align-items: center;
  gap: var(--space-sm);
  pointer-events: none;
  width: 90%;
  max-width: 24rem;
}

.toast-item {
  display: flex;
  align-items: center;
  gap: var(--space-sm);
  padding: var(--space-md) var(--space-lg);
  background: var(--color-bg-card-solid);
  backdrop-filter: blur(20px);
  -webkit-backdrop-filter: blur(20px);
  border: 1px solid var(--color-border);
  border-radius: var(--radius-md);
  box-shadow: var(--shadow-md);
  font-size: var(--font-size-base);
  pointer-events: auto;
  width: 100%;
}

.toast-success {
  border-color: rgba(67, 233, 123, 0.3);
}

.toast-error {
  border-color: rgba(245, 87, 108, 0.3);
}

.toast-warning {
  border-color: rgba(251, 191, 36, 0.3);
}

.toast-icon {
  font-size: 1rem;
  flex-shrink: 0;
}

.toast-message {
  flex: 1;
}

/* Transition animations */
.toast-item-enter-active {
  animation: toast-in 0.35s ease;
}

.toast-item-leave-active {
  animation: toast-out 0.3s ease forwards;
}

.toast-item-move {
  transition: transform 0.3s ease;
}
</style>
