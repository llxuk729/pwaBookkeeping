/**
 * Platform Detection
 * 平台检测模块
 */
import { PlatformType } from './types.js'

/**
 * Detect current platform
 * @returns {PlatformType}
 */
export function detectPlatform() {
  const ua = navigator.userAgent
  
  // iOS detection (including iPad with iOS 13+)
  if (/iPhone|iPad|iPod/.test(ua) || 
      (navigator.platform === 'MacIntel' && navigator.maxTouchPoints > 1)) {
    return PlatformType.IOS
  }
  
  if (/Android/.test(ua)) {
    return PlatformType.ANDROID
  }
  
  if (/Win/.test(ua)) {
    return PlatformType.WINDOWS
  }
  
  if (/Mac/.test(ua) && navigator.maxTouchPoints <= 1) {
    return PlatformType.MAC
  }
  
  if (/Linux/.test(ua) && !/Android/.test(ua)) {
    return PlatformType.LINUX
  }
  
  return PlatformType.UNKNOWN
}

/**
 * Check if running in PWA standalone mode
 * @returns {boolean}
 */
export function isPWAMode() {
  return window.matchMedia('(display-mode: standalone)').matches ||
         window.navigator.standalone === true ||
         document.referrer.includes('android-app://')
}

/**
 * Check if running in iOS PWA mode
 * iOS PWA has limitations on Web Speech API
 * @returns {boolean}
 */
export function isIOSPWA() {
  return detectPlatform() === PlatformType.IOS && isPWAMode()
}

/**
 * Check if running in Android PWA mode
 * @returns {boolean}
 */
export function isAndroidPWA() {
  return detectPlatform() === PlatformType.ANDROID && isPWAMode()
}

/**
 * Get platform info for debugging
 * @returns {Object}
 */
export function getPlatformInfo() {
  return {
    platform: detectPlatform(),
    isPWA: isPWAMode(),
    isIOSPWA: isIOSPWA(),
    isAndroidPWA: isAndroidPWA(),
    userAgent: navigator.userAgent,
    maxTouchPoints: navigator.maxTouchPoints
  }
}

/**
 * Check if Web Speech API is available
 * @returns {boolean}
 */
export function hasSpeechRecognition() {
  return !!window.SpeechRecognition || !!window.webkitSpeechRecognition
}

/**
 * Check microphone permission status
 * @returns {Promise<'granted' | 'denied' | 'prompt' | 'unknown'>}
 */
export async function checkMicrophonePermission() {
  try {
    if (navigator.permissions && navigator.permissions.query) {
      const result = await navigator.permissions.query({ name: 'microphone' })
      return result.state
    }
  } catch (e) {
    // Permissions API not supported or 'microphone' permission name not supported
  }
  return 'unknown'
}

/**
 * Request microphone permission
 * @returns {Promise<boolean>}
 */
export async function requestMicrophonePermission() {
  try {
    if (navigator.mediaDevices && navigator.mediaDevices.getUserMedia) {
      // Check if we're in a secure context
      if (!window.isSecureContext) {
        return false
      }
      
      const stream = await navigator.mediaDevices.getUserMedia({ 
        audio: {
          echoCancellation: true,
          noiseSuppression: true,
          sampleRate: 16000
        }
      })
      stream.getTracks().forEach(track => track.stop())
      return true
    }
  } catch (err) {
    // Error handling is done by the caller
  }
  return false
}