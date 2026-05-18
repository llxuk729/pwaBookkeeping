import { ref, onUnmounted } from 'vue'

/**
 * Vue Composable for Web Speech API
 * Provides reactive speech recognition state and controls
 */
export function useSpeech() {
  const isListening = ref(false)
  const transcript = ref('')
  const interimTranscript = ref('')
  const isSupported = ref(false)
  const error = ref(null)

  let recognition = null

  // Check for browser support
  const SpeechRecognition = window.SpeechRecognition || window.webkitSpeechRecognition
  isSupported.value = !!SpeechRecognition

  if (SpeechRecognition) {
    recognition = new SpeechRecognition()
    recognition.lang = 'zh-CN'
    recognition.continuous = false
    recognition.interimResults = true
    recognition.maxAlternatives = 1

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
        transcript.value = final
        interimTranscript.value = ''
      } else {
        interimTranscript.value = interim
      }
    }

    recognition.onerror = (event) => {
      error.value = event.error
      isListening.value = false
      
      // Handle specific errors
      if (event.error === 'not-allowed') {
        error.value = '麦克风访问被拒绝，请检查浏览器权限设置'
      } else if (event.error === 'no-speech') {
        error.value = '未检测到语音输入'
      } else if (event.error === 'network') {
        error.value = '网络连接错误，语音识别需要网络支持'
      }
    }

    recognition.onend = () => {
      isListening.value = false
    }
  }

  /**
   * Request microphone permission explicitly
   * This helps with PWA standalone mode where permissions might not be prompted automatically
   */
  async function requestMicrophonePermission() {
    try {
      // Try to get microphone access to trigger permission prompt
      if (navigator.mediaDevices && navigator.mediaDevices.getUserMedia) {
        const stream = await navigator.mediaDevices.getUserMedia({ audio: true })
        // Immediately stop the stream as we only need it for permission request
        stream.getTracks().forEach(track => track.stop())
        return true
      }
    } catch (err) {
      console.warn('Microphone permission request failed:', err)
      error.value = '无法获取麦克风权限: ' + err.message
      return false
    }
    return false
  }

  function startListening() {
    if (!recognition) return

    error.value = null
    transcript.value = ''
    interimTranscript.value = ''

    // For PWA standalone mode, ensure we have microphone permission first
    if (window.matchMedia('(display-mode: standalone)').matches || 
        window.navigator.standalone) {
      // In PWA standalone mode, request permission explicitly
      requestMicrophonePermission().then(hasPermission => {
        if (hasPermission) {
          startRecognition()
        } else {
          error.value = '需要麦克风权限才能使用语音输入功能'
        }
      }).catch(() => {
        // If permission request fails, still try to start recognition
        startRecognition()
      })
    } else {
      // In browser mode, just start recognition normally
      startRecognition()
    }
  }

  function startRecognition() {
    try {
      recognition.start()
      isListening.value = true
    } catch (e) {
      // Already started
      if (e.name !== 'InvalidStateError') {
        error.value = e.message
      }
    }
  }

  function stopListening() {
    if (!recognition) return
    recognition.stop()
    isListening.value = false
  }

  function toggleListening() {
    if (isListening.value) {
      stopListening()
    } else {
      startListening()
    }
  }

  onUnmounted(() => {
    if (recognition) {
      recognition.abort()
    }
  })

  return {
    isListening,
    transcript,
    interimTranscript,
    isSupported,
    error,
    startListening,
    stopListening,
    toggleListening
  }
}
