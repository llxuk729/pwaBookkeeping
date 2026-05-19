<template>
  <div class="app-container">
    <router-view v-slot="{ Component }">
      <transition name="page-slide" mode="out-in">
        <component :is="Component" />
      </transition>
    </router-view>
    <NavBar />
    <AppToast ref="toastRef" />
    <UpdatePrompt />
  </div>
</template>

<script setup>
import { onMounted, ref, provide } from 'vue'
import NavBar from './components/NavBar.vue'
import AppToast from './components/AppToast.vue'
import UpdatePrompt from './components/UpdatePrompt.vue'
import { useRecordsStore } from './stores/records.js'
import { useCategoriesStore } from './stores/categories.js'

const recordsStore = useRecordsStore()
const categoriesStore = useCategoriesStore()

// Toast reference for global access
const toastRef = ref(null)

// Provide toast function to all child components
provide('showToast', (message, type = 'error', duration = 3000) => {
  if (toastRef.value) {
    toastRef.value.showToast(message, type, duration)
  }
})

onMounted(async () => {
  await categoriesStore.loadCategories()
  await recordsStore.loadRecords()
})
</script>

<style>
.app-container {
  min-height: 100vh;
  min-height: 100dvh;
  display: flex;
  flex-direction: column;
  position: relative;
}
</style>
