let isMuted = false;
let availableVoices = [];

let customVoiceURI = null;
let customPitch = 1.45;
let customRate = 0.75;

// Cache voices as soon as they are loaded
if ('speechSynthesis' in window) {
  availableVoices = window.speechSynthesis.getVoices();
  window.speechSynthesis.onvoiceschanged = () => {
    availableVoices = window.speechSynthesis.getVoices();
  };
}

export const getAvailableVoices = () => {
  if ('speechSynthesis' in window) {
    const voices = window.speechSynthesis.getVoices();
    return voices.filter(v => v.lang.startsWith('en'));
  }
  return [];
};

export const getVoiceSettings = () => ({
  voiceURI: customVoiceURI,
  pitch: customPitch,
  rate: customRate
});

export const updateVoiceSettings = (voiceURI, pitch, rate) => {
  customVoiceURI = voiceURI;
  customPitch = pitch;
  customRate = rate;
  if (voiceURI) {
    localStorage.setItem('lexi_voiceURI', voiceURI);
  } else {
    localStorage.removeItem('lexi_voiceURI');
  }
  localStorage.setItem('lexi_pitch', pitch.toString());
  localStorage.setItem('lexi_rate', rate.toString());
};

export const setMuted = (muted) => {
  isMuted = muted;
  if (muted && 'speechSynthesis' in window) {
    window.speechSynthesis.cancel();
  }
};

export const getMuted = () => isMuted;

export const speakText = (text) => {
  if (isMuted) return;
  if ('speechSynthesis' in window) {
    window.speechSynthesis.cancel(); // Stop any current speech
    const utterance = new SpeechSynthesisUtterance(text);
    
    // Refresh voices if empty
    if (availableVoices.length === 0) {
      availableVoices = window.speechSynthesis.getVoices();
    }
    
    let selectedVoice = null;

    if (customVoiceURI) {
      selectedVoice = availableVoices.find(v => v.voiceURI === customVoiceURI);
    }

    if (!selectedVoice) {
      // Find a premium/natural friendly female voice
      const preferredNames = [
        'Samantha', 
        'Google US English', 
        'Google UK English Female',
        'Victoria', 
        'Karen', 
        'Tessa', 
        'Moira',
        'Microsoft Zira',
        'Microsoft Hazel'
      ];
      
      for (const name of preferredNames) {
        const match = availableVoices.find(v => v.name.includes(name));
        if (match) {
          selectedVoice = match;
          break;
        }
      }
      
      // Fallback to any English female voice
      if (!selectedVoice) {
        selectedVoice = availableVoices.find(v => v.lang.startsWith('en') && (v.name.toLowerCase().includes('female')));
      }
    }
    
    if (selectedVoice) {
      utterance.voice = selectedVoice;
    }

    utterance.rate = customRate;
    utterance.pitch = customPitch;
    window.speechSynthesis.speak(utterance);
  }
};

export const playVictorySound = () => {
  if (isMuted) return;
  try {
    const audioCtx = new (window.AudioContext || window.webkitAudioContext)();
    const oscillator = audioCtx.createOscillator();
    const gainNode = audioCtx.createGain();

    // A happy major 3rd arpeggio (C5 -> E5 -> G5 -> C6)
    oscillator.type = 'sine';
    
    // Start at C5
    oscillator.frequency.setValueAtTime(523.25, audioCtx.currentTime);
    // Quickly jump to E5
    oscillator.frequency.setValueAtTime(659.25, audioCtx.currentTime + 0.1);
    // Quickly jump to G5
    oscillator.frequency.setValueAtTime(783.99, audioCtx.currentTime + 0.2);
    // Quickly jump to C6
    oscillator.frequency.setValueAtTime(1046.50, audioCtx.currentTime + 0.3);

    // Volume envelope
    gainNode.gain.setValueAtTime(0, audioCtx.currentTime);
    gainNode.gain.linearRampToValueAtTime(0.5, audioCtx.currentTime + 0.05); // Fade in
    gainNode.gain.setValueAtTime(0.5, audioCtx.currentTime + 0.3); // Hold
    gainNode.gain.exponentialRampToValueAtTime(0.001, audioCtx.currentTime + 0.6); // Fade out

    oscillator.connect(gainNode);
    gainNode.connect(audioCtx.destination);
    
    oscillator.start(audioCtx.currentTime);
    oscillator.stop(audioCtx.currentTime + 0.6);
  } catch (e) {
    console.error("Web Audio API not supported", e);
  }
};

export const playWhooshSound = () => {
  if (isMuted) return;
  try {
    const audioCtx = new (window.AudioContext || window.webkitAudioContext)();
    
    // Create white noise buffer
    const bufferSize = audioCtx.sampleRate * 1.5; // 1.5 seconds
    const buffer = audioCtx.createBuffer(1, bufferSize, audioCtx.sampleRate);
    const data = buffer.getChannelData(0);
    for (let i = 0; i < bufferSize; i++) {
      data[i] = Math.random() * 2 - 1;
    }
    
    const noiseSource = audioCtx.createBufferSource();
    noiseSource.buffer = buffer;
    
    // Create a bandpass filter to sweep frequency and create the "whoosh"
    const filter = audioCtx.createBiquadFilter();
    filter.type = 'bandpass';
    filter.Q.value = 1.5;
    
    // Sweep the frequency from high to low to high
    filter.frequency.setValueAtTime(400, audioCtx.currentTime);
    filter.frequency.exponentialRampToValueAtTime(1500, audioCtx.currentTime + 0.75);
    filter.frequency.exponentialRampToValueAtTime(400, audioCtx.currentTime + 1.5);
    
    // Volume envelope
    const gainNode = audioCtx.createGain();
    gainNode.gain.setValueAtTime(0, audioCtx.currentTime);
    gainNode.gain.linearRampToValueAtTime(0.3, audioCtx.currentTime + 0.75);
    gainNode.gain.linearRampToValueAtTime(0.001, audioCtx.currentTime + 1.5);
    
    noiseSource.connect(filter);
    filter.connect(gainNode);
    gainNode.connect(audioCtx.destination);
    
    noiseSource.start(audioCtx.currentTime);
    noiseSource.stop(audioCtx.currentTime + 1.5);
  } catch (e) {
    console.error("Web Audio API not supported", e);
  }
};
