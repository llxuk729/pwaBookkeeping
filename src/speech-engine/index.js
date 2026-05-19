/**
 * Speech Engine Module
 * 语音引擎模块入口
 * 
 * 导出:
 * - SpeechEngineManager: 统一管理器，自动选择引擎
 * - SpeechProvider: 抽象基类
 * - SpeechRecognitionProvider: Web Speech API 实现
 * - WhisperProvider: Whisper 本地实现
 * - Platform Detection: 平台检测函数
 * - Types: 类型定义
 */

// Core - 需要先导入才能在本模块中使用
import { SpeechEngineManager } from './SpeechEngineManager.js'
export { SpeechEngineManager }

// Types
export {
  SpeechProvider,
  SpeechEngineConfig,
  ProviderType,
  EngineStatus,
  PlatformType,
  SpeechSession
} from './types.js'

// Providers
export { SpeechRecognitionProvider } from './providers/SpeechRecognitionProvider.js'
export { WhisperProvider } from './providers/WhisperProvider.js'

// Platform Detection
export {
  detectPlatform,
  isPWAMode,
  isIOSPWA,
  isAndroidPWA,
  getPlatformInfo,
  hasSpeechRecognition,
  hasMediaRecorder,
  hasWebAudio,
  checkMicrophonePermission,
  requestMicrophonePermission
} from './platform-detect.js'

/**
 * Create a speech engine manager with default config
 * @param {Object} options
 * @returns {SpeechEngineManager}
 */
export function createSpeechEngine(options = {}) {
  return new SpeechEngineManager(options)
}