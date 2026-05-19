import { ref, onUnmounted, computed } from 'vue'
import { createSpeechEngine, EngineStatus, ProviderType, isIOSPWA, hasSpeechRecognition, hasMediaRecorder } from '../speech-engine/index.js'
import { detectPlatform, isPWAMode } from '../speech-engine/platform-detect.js'

/**
 * Vue Composable for Speech Recognition
 * 使用双引擎架构的语音识别 Composable
 * 
 * 特点：
 * - Android: 优先 SpeechRecognition，失败 fallback 到 Whisper
 * - iOS PWA: 直接使用 Whisper
 * - 支持按住说话模式
 */
export function useSpeech() {
  // State
  const isListening = ref(false)
  const transcript = ref('')
  const interimTranscript = ref('')
  const error = ref(null)
  const status = ref(EngineStatus.IDLE)
  const progress = ref(0)
  const activeProvider = ref(null)
  const isInitialized = ref(false)

  // Engine instance
  let engine = null

  // Sync check support status immediately (for button visibility)
  // 同步检测支持状态（用于按钮显示）
  // SpeechRecognition 或 MediaRecorder 任一可用即支持
  const isSupported = ref(hasSpeechRecognition() || hasMediaRecorder())

  /**
   * Initialize the speech engine
   * Lazy initialization - only when needed
   */
  async function initializeEngine(onProgress = null) {
    if (engine) return engine

    try {
      engine = createSpeechEngine({
        autoSelect: true,
        lang: 'zh-CN'
      })

      // Double check support after engine creation
      if (!engine.isSupported()) {
        isSupported.value = false
        error.value = '当前平台不支持语音识别功能'
        return null
      }

      // Actually initialize the engine (this may download models for Whisper)
      await engine.initialize(null, onProgress)
      isInitialized.value = true
      activeProvider.value = engine.getActiveProviderName()
      status.value = EngineStatus.READY
    } catch (err) {
      error.value = err.message || '语音引擎初始化失败'
      status.value = EngineStatus.ERROR
      engine = null // Reset engine on failure
      return null
    }

    return engine
  }

  /**
   * Start listening (按住说话模式)
   * @param {Object} options
   * @param {function(number)} options.onProgress - Loading progress callback
   */
  async function startListening(options = {}) {
    error.value = null
    transcript.value = ''
    interimTranscript.value = ''

    // Initialize engine if needed
    if (!engine) {
      const initializedEngine = await initializeEngine(options.onProgress)
      if (!initializedEngine) {
        return
      }
    }

    // iOS PWA special handling
    if (isIOSPWA() && !isInitialized.value) {
      // First time on iOS PWA - warn about model download
      const proceed = confirm(
        'iOS PWA 将使用本地语音识别引擎（Whisper），首次使用需要下载模型约 40MB。\n\n' +
        '下载完成后可离线使用。\n\n' +
        '是否继续？'
      )
      if (!proceed) return
    }

    try {
      status.value = EngineStatus.LISTENING
      isListening.value = true

      await engine.start({
        onInterim: (text, isFinal) => {
          if (!isFinal) {
            interimTranscript.value = text
          }
        },
        onFinal: (text) => {
          transcript.value = text
          interimTranscript.value = ''
          isListening.value = false
          status.value = EngineStatus.READY
        },
        onError: (err) => {
          error.value = err.message
          isListening.value = false
          status.value = EngineStatus.ERROR
        },
        onProgress: (p) => {
          progress.value = p
          if (options.onProgress) {
            options.onProgress(p)
          }
        }
      })

      activeProvider.value = engine.getActiveProviderName()
      status.value = engine.getStatus()

    } catch (err) {
      error.value = err.message
      isListening.value = false
      status.value = EngineStatus.ERROR
    }
  }

  /**
   * Stop listening and get result
   * 松开按钮时调用
   */
  async function stopListening() {
    if (!engine || !isListening.value) return

    try {
      const result = await engine.stop()
      if (result) {
        transcript.value = result
      }
      isListening.value = false
      status.value = EngineStatus.READY
      interimTranscript.value = ''
    } catch (err) {
      error.value = err.message
      isListening.value = false
      status.value = EngineStatus.ERROR
    }
  }

  /**
   * Abort current session
   */
  function abortListening() {
    if (engine) {
      engine.abort()
    }
    isListening.value = false
    status.value = EngineStatus.READY
    transcript.value = ''
    interimTranscript.value = ''
    error.value = null
  }

  /**
   * Toggle listening (click mode - optional)
   * 按钮点击模式（可选）
   */
  async function toggleListening(options = {}) {
    if (isListening.value) {
      await stopListening()
    } else {
      await startListening(options)
    }
  }

  /**
   * Preload the engine (optional)
   * 预加载引擎（可选，减少首次使用等待时间）
   */
  async function preloadEngine(onProgress) {
    if (!engine) {
      const initializedEngine = await initializeEngine(onProgress)
      return !!initializedEngine
    }

    return true
  }

  /**
   * Get platform info
   */
  function getPlatformInfo() {
    if (engine) {
      return engine.getPlatformInfo()
    }
    
    // Return basic platform info even without engine
    return {
      platform: detectPlatform(),
      isPWA: isPWAMode(),
      isIOSPWA: isIOSPWA(),
      activeProvider: null,
      fallbackChain: []
    }
  }

  /**
   * Check if using Whisper engine
   */
  const isUsingWhisper = computed(() => {
    return activeProvider.value === ProviderType.WHISPER
  })

  /**
   * Get user-friendly status message
   */
  const statusMessage = computed(() => {
    switch (status.value) {
      case EngineStatus.IDLE:
        return '准备就绪'
      case EngineStatus.LOADING:
        return progress.value > 0 
          ? `加载模型 ${progress.value}%` 
          : '初始化中...'
      case EngineStatus.READY:
        return '就绪'
      case EngineStatus.LISTENING:
        return '录音中...'
      case EngineStatus.PROCESSING:
        return '识别中...'
      case EngineStatus.ERROR:
        return '错误'
      default:
        return ''
    }
  })

  // Cleanup on unmount
  onUnmounted(async () => {
    if (engine) {
      await engine.destroy()
      engine = null
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
    progress,
    activeProvider,
    isInitialized,
    
    // Computed
    isUsingWhisper,
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