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
    }

    recognition.onend = () => {
      isListening.value = false
    }
  }

  function startListening() {
    if (!recognition) return

    error.value = null
    transcript.value = ''
    interimTranscript.value = ''

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
