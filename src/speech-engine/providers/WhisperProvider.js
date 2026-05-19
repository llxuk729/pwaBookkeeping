/**
 * Whisper Provider
 * transformers.js + whisper-tiny 本地语音识别
 * 
 * 特点：
 * - 完全离线（模型从本地加载）
 * - iOS PWA 兼容（使用 MediaRecorder）
 * - 按需加载模型
 * - 录音结束后一次识别
 * - 推理完成后释放资源
 * 
 * 模型部署方式：
 * - 模型下载到 public/models/Xenova/whisper-tiny/
 * - 通过 GitHub Pages 分发
 * - 无需访问 HuggingFace，解决网络墙问题
 */
import { SpeechProvider, EngineStatus, ProviderType } from '../types.js'
import { hasMediaRecorder, requestMicrophonePermission } from '../platform-detect.js'

// Local model path configuration
// 模型部署在 public/models/，构建后通过 base URL 访问
const LOCAL_MODEL_BASE = '/pwaBookkeeping/models/' // GitHub Pages base path
const MODEL_ID = 'Xenova/whisper-tiny'

export class WhisperProvider extends SpeechProvider {
  constructor(options = {}) {
    super()
    this._pipeline = null
    this._mediaRecorder = null
    this._audioChunks = []
    this._isListening = false
    this._status = EngineStatus.IDLE
    this._progress = 0
    this._callbacks = null
    this._audioContext = null
    this._mediaStream = null
    
    // Configuration
    this._useLocalModel = options.useLocalModel !== false // Default: use local model
    this._lang = options.lang || 'zh'
    this._maxRecordingTime = options.maxRecordingTime || 30000 // 30 seconds max
  }

  get name() {
    return ProviderType.WHISPER
  }

  isSupported() {
    // Whisper requires MediaRecorder and WebAudio
    return hasMediaRecorder()
  }

  async initialize(onProgress) {
    if (this._status === EngineStatus.READY) return
    if (this._status === EngineStatus.LOADING) return

    if (!this.isSupported()) {
      this._status = EngineStatus.ERROR
      throw new Error('MediaRecorder is not supported on this platform')
    }

    this._status = EngineStatus.LOADING
    this._progress = 0

    try {
      // Dynamically import transformers.js (lazy load)
      const { pipeline, env } = await import('@xenova/transformers')
      
      // Configure for local model loading
      if (this._useLocalModel) {
        // 允许从本地加载模型
        env.allowLocalModels = true
        // 设置本地模型路径（相对于 base URL）
        env.localModelPath = LOCAL_MODEL_BASE
        // 禁止远程下载（避免网络墙问题）
        // 注意：如果本地模型不存在，会报错而不是尝试下载
        // env.allowRemoteModels = false // 可选：完全禁止远程模型
      }
      
      // Load Whisper model with progress callback
      // 当 useLocalModel=true 且本地模型存在时，会直接从本地加载
      this._pipeline = await pipeline('automatic-speech-recognition', MODEL_ID, {
        progress_callback: (progress) => {
          if (progress.status === 'progress') {
            this._progress = Math.round(progress.progress * 100)
          }
          if (progress.status === 'done') {
            this._progress = 100
          }
          if (onProgress) {
            onProgress(this._progress)
          }
        },
        // 当本地模型存在时使用本地文件
        // local_files_only: this._useLocalModel // 可选：强制只使用本地文件
      })

      this._status = EngineStatus.READY
      this._progress = 100
    } catch (err) {
      this._status = EngineStatus.ERROR
      
      // 提供更详细的错误信息
      if (err.message.includes('not found') || err.message.includes('404')) {
        throw new Error('Whisper 模型未找到。请先运行 npm run download-whisper 下载模型到本地。')
      } else if (err.message.includes('network') || err.message.includes('fetch')) {
        throw new Error('网络错误，无法加载 Whisper 模型。请确保模型已下载到本地。')
      }
      
      throw new Error(`Whisper 模型加载失败: ${err.message}`)
    }
  }

  async start(options) {
    // Initialize if needed
    if (this._status !== EngineStatus.READY) {
      await this.initialize(options.onProgress)
    }

    if (this._isListening) {
      return // Already listening
    }

    this._callbacks = options
    this._audioChunks = []

    // Request microphone permission and start recording
    try {
      const hasPermission = await requestMicrophonePermission()
      if (!hasPermission) {
        // Check if we're in a secure context
        if (!window.isSecureContext) {
          throw new Error('需要在 HTTPS 或 localhost 环境下才能使用麦克风')
        }
        throw new Error('麦克风权限被拒绝。请在浏览器设置中允许访问麦克风，或在系统设置中检查应用权限。')
      }

      // Get audio stream
      this._mediaStream = await navigator.mediaDevices.getUserMedia({
        audio: {
          echoCancellation: true,
          noiseSuppression: true,
          sampleRate: 16000 // Whisper expects 16kHz
        }
      })

      // Create MediaRecorder
      // Use webm format (better compatibility) or wav
      const mimeType = MediaRecorder.isTypeSupported('audio/webm;codecs=opus') 
        ? 'audio/webm;codecs=opus' 
        : MediaRecorder.isTypeSupported('audio/webm') 
          ? 'audio/webm' 
          : 'audio/mp4'

      this._mediaRecorder = new MediaRecorder(this._mediaStream, { mimeType })
      
      this._mediaRecorder.ondataavailable = (event) => {
        if (event.data.size > 0) {
          this._audioChunks.push(event.data)
        }
      }

      this._mediaRecorder.onstop = () => {
        this._processRecording()
      }

      this._mediaRecorder.onerror = (event) => {
        if (this._callbacks?.onError) {
          this._callbacks.onError(new Error(`录音错误: ${event.error}`))
        }
        this._isListening = false
        this._status = EngineStatus.ERROR
      }

      // Start recording
      this._mediaRecorder.start(100) // Collect data every 100ms
      this._isListening = true
      this._status = EngineStatus.LISTENING

      // Notify interim state (recording in progress)
      if (this._callbacks?.onInterim) {
        this._callbacks.onInterim('录音中...', false)
      }

      // Set max recording time timeout
      this._recordingTimeout = setTimeout(() => {
        if (this._isListening) {
          this.stop()
        }
      }, this._maxRecordingTime)

    } catch (err) {
      this._status = EngineStatus.ERROR
      if (this._callbacks?.onError) {
        this._callbacks.onError(err)
      }
      throw err
    }
  }

  async _processRecording() {
    if (this._audioChunks.length === 0) {
      if (this._callbacks?.onError) {
        this._callbacks.onError(new Error('没有录音数据'))
      }
      this._status = EngineStatus.READY
      return
    }

    this._status = EngineStatus.PROCESSING
    
    // Notify processing state
    if (this._callbacks?.onInterim) {
      this._callbacks.onInterim('识别中...', false)
    }

    try {
      // Create audio blob
      const audioBlob = new Blob(this._audioChunks, { type: this._mediaRecorder?.mimeType || 'audio/webm' })
      
      // Convert blob to ArrayBuffer
      const audioBuffer = await audioBlob.arrayBuffer()
      
      // Process with Whisper
      const result = await this._pipeline(audioBuffer, {
        language: this._lang,
        task: 'transcribe',
        return_timestamps: false
      })

      const transcript = result.text || ''
      
      if (this._callbacks?.onFinal) {
        this._callbacks.onFinal(transcript)
      }

    } catch (err) {
      if (this._callbacks?.onError) {
        this._callbacks.onError(new Error(`识别失败: ${err.message}`))
      }
    }

    this._status = EngineStatus.READY
    this._isListening = false
    
    // Release audio resources
    this._releaseAudioResources()
  }

  async stop() {
    // Clear timeout
    if (this._recordingTimeout) {
      clearTimeout(this._recordingTimeout)
      this._recordingTimeout = null
    }

    if (!this._mediaRecorder || this._status !== EngineStatus.LISTENING) {
      return ''
    }

    // Stop recording and trigger processing
    this._mediaRecorder.stop()
    
    // Wait for processing to complete
    // Return a promise that resolves when processing is done
    return new Promise((resolve) => {
      const checkStatus = () => {
        if (this._status === EngineStatus.READY) {
          resolve('') // The result is sent via onFinal callback
        } else {
          setTimeout(checkStatus, 100)
        }
      }
      // Start checking after a short delay
      setTimeout(checkStatus, 200)
    })
  }

  abort() {
    // Clear timeout
    if (this._recordingTimeout) {
      clearTimeout(this._recordingTimeout)
      this._recordingTimeout = null
    }

    if (this._mediaRecorder && this._mediaRecorder.state !== 'inactive') {
      this._mediaRecorder.stop()
    }
    
    this._releaseAudioResources()
    
    this._isListening = false
    this._status = EngineStatus.READY
    this._audioChunks = []
    this._callbacks = null
  }

  _releaseAudioResources() {
    if (this._mediaStream) {
      this._mediaStream.getTracks().forEach(track => track.stop())
      this._mediaStream = null
    }
    if (this._audioContext) {
      this._audioContext.close()
      this._audioContext = null
    }
  }

  isListening() {
    return this._isListening
  }

  getStatus() {
    return this._status
  }

  getProgress() {
    return this._progress
  }

  async destroy() {
    this.abort()
    this._pipeline = null
    this._status = EngineStatus.IDLE
    this._progress = 0
  }
}