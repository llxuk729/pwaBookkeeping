import { ref, onUnmounted, computed } from 'vue'
import { hasSpeechRecognition, requestMicrophonePermission, detectPlatform, isPWAMode } from '../speech-engine/platform-detect.js'

/**
 * Vue Composable for Speech Recognition
 * 使用 Web Speech API 的语音识别 Composable
 * 
 * 特点：
 * - 仅支持 Windows 和 Android 浏览器（非 PWA 模式）
 * - 支持按住说话模式
 * - 轻量级实现，无额外依赖
 */
export function useSpeech() {
  // State
  const isListening = ref(false)
  const transcript = ref('')
  const interimTranscript = ref('')
  const error = ref(null)
  const status = ref('idle') // idle, ready, listening, error
  const isInitialized = ref(false)

  // SpeechRecognition instance
  let recognition = null
  let finalTranscript = ''
  let interimTranscriptBuffer = ''

  // Sync check support status immediately (for button visibility)
  const isSupported = ref(hasSpeechRecognition())

  /**
   * Initialize the speech engine
   */
  async function initializeEngine() {
    if (recognition) return true

    try {
      // Check if supported
      if (!hasSpeechRecognition()) {
        isSupported.value = false
        error.value = '当前平台不支持语音识别功能'
        return false
      }

      // Check secure context
      if (!window.isSecureContext) {
        throw new Error('需要在 HTTPS 或 localhost 环境下才能使用麦克风')
      }

      // Request microphone permission
      const hasPermission = await requestMicrophonePermission()
      if (!hasPermission) {
        throw new Error('麦克风权限被拒绝。请在浏览器设置中允许访问麦克风。')
      }

      // Create SpeechRecognition instance
      const SpeechRecognition = window.SpeechRecognition || window.webkitSpeechRecognition
      recognition = new SpeechRecognition()
      recognition.lang = 'zh-CN'
      recognition.continuous = false
      recognition.interimResults = true
      recognition.maxAlternatives = 1

      // Set up event handlers
      setupEventHandlers()

      isInitialized.value = true
      status.value = 'ready'
      return true
    } catch (err) {
      error.value = err.message || '语音引擎初始化失败'
      status.value = 'error'
      recognition = null
      return false
    }
  }

  /**
   * Set up event handlers
   */
  function setupEventHandlers() {
    if (!recognition) return

    recognition.onresult = (event) => {
      let interim = ''
      let final = ''

      for (let i = event.resultIndex; i < event.results.length; i++) {
        const result = event.results[i]
        if (result.isFinal) {
          final += result[0].transcript
        } else {
          interim += result[0].transcript
        }
      }

      if (final) {
        finalTranscript = final
        interimTranscriptBuffer = ''
        transcript.value = final
        interimTranscript.value = ''
      } else {
        interimTranscriptBuffer = interim
        interimTranscript.value = interim
      }
    }

    recognition.onerror = (event) => {
      isListening.value = false
      status.value = 'error'

      let errorMessage = ''
      switch (event.error) {
        case 'not-allowed':
          errorMessage = '麦克风权限被拒绝'
          break
        case 'no-speech':
          errorMessage = '未检测到语音输入'
          break
        case 'network':
          errorMessage = '网络错误，语音识别需要网络支持'
          break
        case 'audio-capture':
          errorMessage = '无法访问麦克风'
          break
        case 'aborted':
          errorMessage = '语音识别已取消'
          break
        case 'service-not-allowed':
          errorMessage = '当前环境不支持语音识别服务'
          break
        default:
          errorMessage = `语音识别错误: ${event.error}`
      }

      error.value = errorMessage
    }

    recognition.onend = () => {
      isListening.value = false
      if (status.value === 'listening') {
        status.value = 'ready'
      }
    }

    recognition.onstart = () => {
      isListening.value = true
      status.value = 'listening'
    }
  }

  /**
   * Start listening (按住说话模式)
   */
  async function startListening() {
    error.value = null
    transcript.value = ''
    interimTranscript.value = ''
    finalTranscript = ''
    interimTranscriptBuffer = ''

    // Initialize engine if needed
    if (!recognition) {
      const success = await initializeEngine()
      if (!success) {
        return
      }
    }

    // Start listening
    try {
      recognition.start()
    } catch (e) {
      if (e.name !== 'InvalidStateError') {
        throw e
      }
      // Already started, ignore
    }
  }

  /**
   * Stop listening and get result
   * 松开按钮时调用
   */
  async function stopListening() {
    if (!recognition || !isListening.value) return

    try {
      recognition.stop()
      isListening.value = false
      status.value = 'ready'
      interimTranscript.value = ''
    } catch (err) {
      error.value = err.message
      isListening.value = false
      status.value = 'error'
    }
  }

  /**
   * Abort current session
   */
  function abortListening() {
    if (recognition) {
      recognition.abort()
    }
    isListening.value = false
    status.value = 'ready'
    transcript.value = ''
    interimTranscript.value = ''
    finalTranscript = ''
    interimTranscriptBuffer = ''
    error.value = null
  }

  /**
   * Toggle listening (click mode - optional)
   * 按钮点击模式（可选）
   */
  async function toggleListening() {
    if (isListening.value) {
      await stopListening()
    } else {
      await startListening()
    }
  }

  /**
   * Preload the engine (optional)
   * 预加载引擎（可选，减少首次使用等待时间）
   */
  async function preloadEngine() {
    if (!recognition) {
      return await initializeEngine()
    }
    return true
  }

  /**
   * Get platform info
   */
  function getPlatformInfo() {
    return {
      platform: detectPlatform(),
      isPWA: isPWAMode(),
      activeProvider: recognition ? 'speech-recognition' : null
    }
  }

  /**
   * Get user-friendly status message
   */
  const statusMessage = computed(() => {
    switch (status.value) {
      case 'idle':
        return '准备就绪'
      case 'ready':
        return '就绪'
      case 'listening':
        return '录音中...'
      case 'error':
        return '错误'
      default:
        return ''
    }
  })

  // Cleanup on unmount
  onUnmounted(() => {
    if (recognition) {
      recognition.abort()
      recognition = null
    }
  })

  return {
    // State
    isListening,
    transcript,
    interimTranscript,
    isSupported,
    error,
    status,
    isInitialized,
    
    // Computed
    statusMessage,
    
    // Methods
    startListening,
    stopListening,
    abortListening,
    toggleListening,
    preloadEngine,
    getPlatformInfo,
    initializeEngine
  }
}