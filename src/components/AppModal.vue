<template>
  <Teleport to="body">
    <transition name="backdrop">
      <div v-if="modelValue" class="modal-backdrop" @click="handleBackdropClick"></div>
    </transition>
    <transition name="modal">
      <div v-if="modelValue" class="modal-container">
        <div class="modal-content card" :class="{ 'modal-fullscreen': fullscreen }">
          <div class="modal-header" v-if="title || $slots.header">
            <slot name="header">
              <h3 class="modal-title">{{ title }}</h3>
            </slot>
            <button class="modal-close btn-icon btn-ghost" @click="close" id="modal-close-btn">
              ✕
            </button>
          </div>
          <div class="modal-body">
            <slot></slot>
          </div>
          <div class="modal-footer" v-if="$slots.footer">
            <slot name="footer"></slot>
          </div>
        </div>
      </div>
    </transition>
  </Teleport>
</template>

<script setup>
const props = defineProps({
  modelValue: Boolean,
  title: String,
  fullscreen: Boolean,
  closeOnBackdrop: {
    type: Boolean,
    default: true
  }
})

const emit = defineEmits(['update:modelValue'])

function close() {
  emit('update:modelValue', false)
}

function handleBackdropClick() {
  if (props.closeOnBackdrop) {
    close()
  }
}
</script>

<style scoped>
.modal-backdrop {
  position: fixed;
  inset: 0;
  background: rgba(0, 0, 0, 0.6);
  z-index: var(--z-modal-backdrop);
}

.modal-container {
  position: fixed;
  inset: 0;
  display: flex;
  align-items: flex-end;
  justify-content: center;
  z-index: var(--z-modal);
  padding: var(--space-base);
  pointer-events: none;
}

.modal-content {
  width: 100%;
  max-width: 28rem;
  max-height: 85vh;
  overflow-y: auto;
  pointer-events: auto;
  border: 1px solid var(--color-border-accent);
  box-shadow: var(--shadow-lg);
}

.modal-content.modal-fullscreen {
  max-height: 95vh;
  border-radius: var(--radius-xl) var(--radius-xl) 0 0;
}

.modal-header {
  display: flex;
  align-items: center;
  justify-content: space-between;
  margin-bottom: var(--space-base);
}

.modal-title {
  font-size: var(--font-size-lg);
  font-weight: var(--font-weight-semibold);
}

.modal-close {
  font-size: var(--font-size-md);
  color: var(--color-text-secondary);
}

.modal-body {
  flex: 1;
}

.modal-footer {
  display: flex;
  gap: var(--space-sm);
  margin-top: var(--space-base);
  padding-top: var(--space-base);
  border-top: 1px solid var(--color-border);
}
</style>
