/**
 * Speech Engine Manager
 * 语音引擎管理器 - 根据平台自动选择合适的引擎
 * 
 * 策略：
 * - Android: 优先 SpeechRecognition，失败 fallback 到 Whisper
 * - iOS PWA: 直接使用 Whisper（不依赖 SpeechRecognition）
 * - Desktop: 优先 SpeechRecognition
 */
import { SpeechEngineConfig, EngineStatus, ProviderType, PlatformType } from './types.js'
import { detectPlatform, isIOSPWA, isPWAMode } from './platform-detect.js'
import { SpeechRecognitionProvider } from './providers/SpeechRecognitionProvider.js'
import { WhisperProvider } from './providers/WhisperProvider.js'

export class SpeechEngineManager {
  constructor(options = {}) {
    this._providers = new Map()
    this._activeProvider = null
    this._fallbackChain = []
    this._status = EngineStatus.IDLE
    this._callbacks = null
    
    // Options
    this._autoSelect = options.autoSelect !== false // Default true
    this._preferWhisper = options.preferWhisper || false
    this._lang = options.lang || 'zh-CN'
    
    // Initialize providers
    this._initProviders()
  }

  _initProviders() {
    // Create SpeechRecognition provider
    const speechRecProvider = new SpeechRecognitionProvider({
      lang: this._lang,
      continuous: false,
      interimResults: true
    })
    this._providers.set(ProviderType.SPEECH_RECOGNITION, speechRecProvider)
    
    // Create Whisper provider
    const whisperProvider = new WhisperProvider({
      lang: this._lang.replace('-CN', ''), // Whisper uses 'zh' not 'zh-CN'
      modelId: 'Xenova/whisper-tiny'
    })
    this._providers.set(ProviderType.WHISPER, whisperProvider)
  }

  /**
   * Get provider by type
   * @param {string} type ProviderType
   * @returns {SpeechProvider}
   */
  getProvider(type) {
    return this._providers.get(type)
  }

  /**
   * Auto select best provider for current platform
   * @returns {SpeechProvider}
   */
  autoSelectProvider() {
    const platform = detectPlatform()
    const isPWA = isPWAMode()
    
    // Determine fallback chain based on platform
    let chain = []
    
    // iOS PWA: Use Whisper directly (SpeechRecognition not reliable)
    if (isIOSPWA()) {
      chain = [ProviderType.WHISPER]
    }
    // Android: Prefer SpeechRecognition, fallback to Whisper
    else if (platform === PlatformType.ANDROID) {
      chain = [ProviderType.SPEECH_RECOGNITION, ProviderType.WHISPER]
    }
    // Desktop browsers: Prefer SpeechRecognition
    else if (platform === PlatformType.WINDOWS || 
             platform === PlatformType.MAC || 
             platform === PlatformType.LINUX) {
      if (isPWA && this._preferWhisper) {
        chain = [ProviderType.WHISPER, ProviderType.SPEECH_RECOGNITION]
      } else {
        chain = [ProviderType.SPEECH_RECOGNITION, ProviderType.WHISPER]
      }
    }
    // Unknown platform: Use fallback config
    else {
      chain = SpeechEngineConfig.fallback
    }
    
    // Override with preferWhisper if set
    if (this._preferWhisper && !isIOSPWA()) {
      chain = [ProviderType.WHISPER, ProviderType.SPEECH_RECOGNITION]
    }
    
    this._fallbackChain = chain
    
    // Find first supported provider
    for (const type of chain) {
      const provider = this._providers.get(type)
      if (provider && provider.isSupported()) {
        return provider
      }
    }
    
    return null
  }

  /**
   * Initialize a specific provider or auto-select
   * @param {string|null} providerType Specific provider type or null for auto
   * @param {function(number)} onProgress Progress callback
   * @returns {Promise<SpeechProvider>}
   */
  async initialize(providerType = null, onProgress = null) {
    let provider
    
    if (providerType) {
      provider = this._providers.get(providerType)
    } else if (this._autoSelect) {
      provider = this.autoSelectProvider()
    } else {
      // Default to SpeechRecognition
      provider = this._providers.get(ProviderType.SPEECH_RECOGNITION)
    }
    
    if (!provider) {
      throw new Error('No supported speech provider found for this platform')
    }
    
    this._activeProvider = provider
    this._status = EngineStatus.LOADING
    
    try {
      await provider.initialize(onProgress)
      this._status = EngineStatus.READY
      return provider
    } catch (err) {
      // Try fallback provider
      const fallbackType = this._getFallbackProviderType(provider.name)
      if (fallbackType) {
        console.warn(`Provider ${provider.name} failed, trying fallback: ${fallbackType}`)
        provider = this._providers.get(fallbackType)
        if (provider && provider.isSupported()) {
          try {
            await provider.initialize(onProgress)
            this._activeProvider = provider
            this._status = EngineStatus.READY
            return provider
          } catch (fallbackErr) {
            this._status = EngineStatus.ERROR
            throw new Error(`All providers failed: ${err.message}, ${fallbackErr.message}`)
          }
        }
      }
      
      this._status = EngineStatus.ERROR
      throw err
    }
  }

  _getFallbackProviderType(currentType) {
    const index = this._fallbackChain.indexOf(currentType)
    if (index >= 0 && index < this._fallbackChain.length - 1) {
      return this._fallbackChain[index + 1]
    }
    return null
  }

  /**
   * Start listening/recording
   * @param {Object} options
   * @param {function(string, boolean)} options.onInterim
   * @param {function(string)} options.onFinal
   * @param {function(Error)} options.onError
   * @param {function(number)} options.onProgress - Loading progress (for Whisper)
   * @returns {Promise<void>}
   */
  async start(options) {
    if (!this._activeProvider) {
      await this.initialize(null, options.onProgress)
    }
    
    // 检查初始化是否成功
    if (!this._activeProvider) {
      const err = new Error('No speech provider could be initialized')
      if (options.onError) {
        options.onError(err)
      }
      throw err
    }
    
    this._callbacks = options
    this._status = EngineStatus.LISTENING
    
    try {
      await this._activeProvider.start({
        onInterim: options.onInterim,
        onFinal: (text) => {
          this._status = EngineStatus.READY
          if (options.onFinal) {
            options.onFinal(text)
          }
        },
        onError: (err) => {
          this._status = EngineStatus.ERROR
          if (options.onError) {
            options.onError(err)
          }
        },
        onProgress: options.onProgress
      })
    } catch (err) {
      this._status = EngineStatus.ERROR
      if (options.onError) {
        options.onError(err)
      }
      throw err
    }
  }

  /**
   * Stop listening and get final result
   * @returns {Promise<string>}
   */
  async stop() {
    if (!this._activeProvider) return ''
    
    const result = await this._activeProvider.stop()
    this._status = EngineStatus.READY
    return result
  }

  /**
   * Abort current session
   */
  abort() {
    if (this._activeProvider) {
      this._activeProvider.abort()
    }
    this._status = EngineStatus.READY
    this._callbacks = null
  }

  /**
   * Check if currently listening
   * @returns {boolean}
   */
  isListening() {
    return this._activeProvider?.isListening() || false
  }

  /**
   * Get current status
   * @returns {EngineStatus}
   */
  getStatus() {
    return this._status
  }

  /**
   * Get active provider name
   * @returns {string|null}
   */
  getActiveProviderName() {
    return this._activeProvider?.name || null
  }

  /**
   * Get loading progress
   * @returns {number}
   */
  getProgress() {
    return this._activeProvider?.getProgress() || 0
  }

  /**
   * Get platform info
   * @returns {Object}
   */
  getPlatformInfo() {
    return {
      platform: detectPlatform(),
      isPWA: isPWAMode(),
      isIOSPWA: isIOSPWA(),
      activeProvider: this._activeProvider?.name,
      fallbackChain: this._fallbackChain
    }
  }

  /**
   * Check if any provider is supported
   * @returns {boolean}
   */
  isSupported() {
    for (const provider of this._providers.values()) {
      if (provider.isSupported()) {
        return true
      }
    }
    return false
  }

  /**
   * Cleanup resources
   */
  async destroy() {
    for (const provider of this._providers.values()) {
      await provider.destroy()
    }
    this._providers.clear()
    this._activeProvider = null
    this._status = EngineStatus.IDLE
  }
}