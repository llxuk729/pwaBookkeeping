<template>
  <transition name="modal">
    <div v-if="needRefresh" class="update-prompt-overlay">
      <div class="card update-prompt-card card-glow">
        <h3 style="margin-top: 0">发现新版本 ✨</h3>
        <p style="font-size: var(--font-size-sm); color: var(--color-text-secondary); line-height: 1.5; margin-bottom: 0;">
          系统已发布新功能或优化。为了保护您的数据安全，点击更新时系统会先自动下载一份当前数据的完整备份。
        </p>
        <div class="update-actions" style="display: flex; gap: var(--space-sm); justify-content: flex-end; margin-top: var(--space-base);">
          <button class="btn btn-ghost btn-sm" @click="close">暂不更新</button>
          <button class="btn btn-primary btn-sm" :disabled="isUpdating" @click="update">
            {{ isUpdating ? '正在备份并更新...' : '备份并更新' }}
          </button>
        </div>
      </div>
    </div>
  </transition>
</template>

<script setup>
import { ref } from 'vue'
import { useRegisterSW } from 'virtual:pwa-register/vue'
import { exportBackup } from '../services/export.js'

const {
  offlineReady,
  needRefresh,
  updateServiceWorker,
} = useRegisterSW({
  onRegistered(r) {
    console.log('SW Registered')
  },
  onRegisterError(error) {
    console.error('SW registration error', error)
  }
})

const isUpdating = ref(false)

const close = async () => {
  needRefresh.value = false
}

const update = async () => {
  isUpdating.value = true
  try {
    // Force backup before update
    await exportBackup()
    // Wait a brief moment to ensure download starts before reloading
    setTimeout(() => {
      updateServiceWorker(true)
    }, 1500)
  } catch (error) {
    alert('自动备份失败，为了您的数据安全，已暂停更新。您可以前往“设置”手动备份后重试。')
    isUpdating.value = false
  }
}
</script>

<style scoped>
.update-prompt-overlay {
  position: fixed;
  bottom: calc(var(--safe-area-bottom) + 80px); /* Above nav bar */
  left: var(--space-base);
  right: var(--space-base);
  z-index: 1000;
}
.update-prompt-card {
  border: 1px solid var(--color-primary);
  background: var(--gradient-surface);
}
</style>
