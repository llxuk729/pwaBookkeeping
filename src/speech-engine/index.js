/**
 * Speech Engine Module
 * 语音引擎模块入口
 * 
 * 导出:
 * - Platform Detection: 平台检测函数
 * - Types: 类型定义
 */

// Platform Detection
export {
  detectPlatform,
  isPWAMode,
  isIOSPWA,
  isAndroidPWA,
  getPlatformInfo,
  hasSpeechRecognition,
  checkMicrophonePermission,
  requestMicrophonePermission
} from './platform-detect.js'

// Types (保留供未来扩展使用)
export {
  ProviderType,
  PlatformType
} from './types.js'