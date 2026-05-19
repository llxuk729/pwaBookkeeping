/**
 * Speech Recognition Provider
 * Web Speech API 实现
 * 
 * 特点：
 * - 速度快，几乎零功耗
 * - 不需要下载模型
 * - Android Chrome 兼容很好
 * - iOS PWA 支持不稳定
 */
import { SpeechProvider, EngineStatus, ProviderType } from '../types.js'
import { hasSpeechRecognition, requestMicrophonePermission, isIOSPWA } from '../platform-detect.js'

export class SpeechRecognitionProvider extends SpeechProvider {
  constructor(options = {}) {
    super()
    this._recognition = null
    this._isListening = false
    this._status = EngineStatus.IDLE
    this._callbacks = null
    this._finalTranscript = ''
    this._interimTranscript = ''
    this._initPromise = null // Track initialization promise
    
    // Configuration
    this._lang = options.lang || 'zh-CN'
    this._continuous = options.continuous || false
    this._interimResults = options.interimResults || true
    this._maxAlternatives = options.maxAlternatives || 1
  }

  get name() {
    return ProviderType.SPEECH_RECOGNITION
  }

  isSupported() {
    return hasSpeechRecognition()
  }

  async initialize() {
    // If already ready, return immediately
    if (this._status === EngineStatus.READY) return
    
    // If currently loading, wait for the existing initialization to complete
    if (this._status === EngineStatus.LOADING && this._initPromise) {
      await this._initPromise
      return
    }

    if (!this.isSupported()) {
      this._status = EngineStatus.ERROR
      throw new Error('Web Speech API is not supported on this platform')
    }

    this._status = EngineStatus.LOADING
    
    // Store the initialization promise so other calls can wait for it
    this._initPromise = this._doInitialize()
    
    try {
      await this._initPromise
    } finally {
      this._initPromise = null
    }
  }

  async _doInitialize() {
    // Request microphone permission first
    const hasPermission = await requestMicrophonePermission()
    if (!hasPermission) {
      // iOS PWA specific check
      if (isIOSPWA()) {
        throw new Error('iOS PWA 不支持 Web Speech API，请使用 Whisper 引擎或在 Safari 中打开')
      }
      throw new Error('麦克风权限被拒绝')
    }

    // Create SpeechRecognition instance
    const SpeechRecognition = window.SpeechRecognition || window.webkitSpeechRecognition
    this._recognition = new SpeechRecognition()
    this._recognition.lang = this._lang
    this._recognition.continuous = this._continuous
    this._recognition.interimResults = this._interimResults
    this._recognition.maxAlternatives = this._maxAlternatives

    // Set up event handlers
    this._setupEventHandlers()

    this._status = EngineStatus.READY
  }

  _setupEventHandlers() {
    if (!this._recognition) return

    this._recognition.onresult = (event) => {
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
        this._finalTranscript = final
        this._interimTranscript = ''
        if (this._callbacks?.onFinal) {
          this._callbacks.onFinal(final)
        }
      } else {
        this._interimTranscript = interim
        if (this._callbacks?.onInterim) {
          this._callbacks.onInterim(interim, false)
        }
      }
    }

    this._recognition.onerror = (event) => {
      this._isListening = false
      this._status = EngineStatus.ERROR

      let errorMessage = ''
      switch (event.error) {
        case 'not-allowed':
          if (isIOSPWA()) {
            errorMessage = 'iOS PWA 不支持语音识别，请使用 Whisper 引擎或在 Safari 中打开'
          } else {
            errorMessage = '麦克风权限被拒绝'
          }
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

      if (this._callbacks?.onError) {
        this._callbacks.onError(new Error(errorMessage))
      }
    }

    this._recognition.onend = () => {
      this._isListening = false
      if (this._status === EngineStatus.LISTENING) {
        this._status = EngineStatus.READY
      }
    }

    this._recognition.onstart = () => {
      this._isListening = true
      this._status = EngineStatus.LISTENING
    }
  }

  async start(options) {
    if (!this._recognition) {
      await this.initialize()
    }

    if (this._isListening) {
      return // Already listening
    }

    this._callbacks = options
    this._finalTranscript = ''
    this._interimTranscript = ''

    try {
      this._recognition.start()
      this._status = EngineStatus.LISTENING
    } catch (e) {
      if (e.name !== 'InvalidStateError') {
        throw e
      }
      // Already started, ignore
    }
  }

  async stop() {
    if (!this._recognition || !this._isListening) {
      return this._finalTranscript
    }

    this._recognition.stop()
    this._isListening = false
    this._status = EngineStatus.READY

    return this._finalTranscript || this._interimTranscript
  }

  abort() {
    if (this._recognition) {
      this._recognition.abort()
    }
    this._isListening = false
    this._status = EngineStatus.READY
    this._finalTranscript = ''
    this._interimTranscript = ''
    this._callbacks = null
  }

  isListening() {
    return this._isListening
  }

  getStatus() {
    return this._status
  }

  getProgress() {
    return this._status === EngineStatus.READY ? 100 : 0
  }

  async destroy() {
    this.abort()
    this._recognition = null
    this._status = EngineStatus.IDLE
  }
}