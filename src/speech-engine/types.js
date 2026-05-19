/**
 * Speech Engine Types and Interfaces
 * 语音引擎类型定义
 */

/**
 * Speech Provider Interface
 * 语音识别提供者抽象接口
 */
export class SpeechProvider {
  /**
   * @returns {string} Provider name
   */
  get name() {
    throw new Error('Must implement name getter')
  }

  /**
   * Check if this provider is supported on current platform
   * @returns {boolean}
   */
  isSupported() {
    throw new Error('Must implement isSupported()')
  }

  /**
   * Initialize the provider (lazy load models if needed)
   * @returns {Promise<void>}
   */
  async initialize() {
    throw new Error('Must implement initialize()')
  }

  /**
   * Start recording/listening
   * @param {Object} options
   * @param {function(string, boolean)} options.onInterim - Interim result callback (text, isFinal)
   * @param {function(string)} options.onFinal - Final result callback (text)
   * @param {function(Error)} options.onError - Error callback
   * @returns {Promise<void>}
   */
  async start(options) {
    throw new Error('Must implement start()')
  }

  /**
   * Stop recording/listening and get final result
   * @returns {Promise<string>} Final transcript
   */
  async stop() {
    throw new Error('Must implement stop()')
  }

  /**
   * Abort current session without waiting for result
   * @returns {void}
   */
  abort() {
    throw new Error('Must implement abort()')
  }

  /**
   * Check if currently recording/listening
   * @returns {boolean}
   */
  isListening() {
    throw new Error('Must implement isListening()')
  }

  /**
   * Get initialization status
   * @returns {'idle' | 'loading' | 'ready' | 'error'}
   */
  getStatus() {
    throw new Error('Must implement getStatus()')
  }

  /**
   * Get loading progress (for model download)
   * @returns {number} 0-100 percentage
   */
  getProgress() {
    return 0
  }

  /**
   * Release resources (cleanup)
   * @returns {Promise<void>}
   */
  async destroy() {
    throw new Error('Must implement destroy()')
  }
}

/**
 * Speech Engine Config
 * 语音引擎配置
 */
export const SpeechEngineConfig = {
  // Provider priorities by platform
  android: ['speech-recognition'],
  ios: [], // iOS PWA doesn't support SpeechRecognition
  desktop: ['speech-recognition'],
  fallback: []
}

/**
 * Provider Types
 */
export const ProviderType = {
  SPEECH_RECOGNITION: 'speech-recognition'
}

/**
 * Engine Status
 * 简化的引擎状态（仅Web Speech API）
 */
export const EngineStatus = {
  IDLE: 'idle',           // 空闲
  READY: 'ready',         // 就绪
  LISTENING: 'listening', // 监听中
  ERROR: 'error'          // 错误
}

/**
 * Platform Types
 */
export const PlatformType = {
  IOS: 'ios',
  ANDROID: 'android',
  WINDOWS: 'windows',
  MAC: 'mac',
  LINUX: 'linux',
  UNKNOWN: 'unknown'
}

/**
 * Speech Session State
 */
export class SpeechSession {
  constructor() {
    this.startTime = 0
    this.interimTranscript = ''
    this.finalTranscript = ''
    this.isRecording = false
    this.provider = null
  }
}