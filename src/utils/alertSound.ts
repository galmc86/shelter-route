let audioContext: AudioContext | null = null;
let oscillator: OscillatorNode | null = null;
let gainNode: GainNode | null = null;
let frequencyInterval: ReturnType<typeof setInterval> | null = null;
let playing = false;

const STORAGE_KEY = 'shelter-route:alert-sound-enabled';

export function isAlertSoundEnabled(): boolean {
  return localStorage.getItem(STORAGE_KEY) !== 'false';
}

export function setAlertSoundEnabled(enabled: boolean): void {
  localStorage.setItem(STORAGE_KEY, enabled ? 'true' : 'false');
  if (!enabled) {
    stopAlertSound();
  }
}

export function playAlertSound(): void {
  if (playing || !isAlertSoundEnabled()) return;

  try {
    audioContext = new (window.AudioContext || (window as unknown as { webkitAudioContext: typeof AudioContext }).webkitAudioContext)();
    oscillator = audioContext.createOscillator();
    gainNode = audioContext.createGain();

    oscillator.type = 'sine';
    oscillator.frequency.setValueAtTime(800, audioContext.currentTime);
    gainNode.gain.setValueAtTime(0.7, audioContext.currentTime);

    oscillator.connect(gainNode);
    gainNode.connect(audioContext.destination);
    oscillator.start();

    // Alternate between 800Hz and 600Hz every 200ms
    let isHigh = true;
    frequencyInterval = setInterval(() => {
      if (oscillator && audioContext) {
        isHigh = !isHigh;
        oscillator.frequency.setValueAtTime(
          isHigh ? 800 : 600,
          audioContext.currentTime
        );
      }
    }, 200);

    playing = true;
  } catch {
    // Web Audio API not supported or blocked
    playing = false;
  }
}

export function stopAlertSound(): void {
  if (frequencyInterval) {
    clearInterval(frequencyInterval);
    frequencyInterval = null;
  }

  if (oscillator) {
    try {
      oscillator.stop();
    } catch {
      // Already stopped
    }
    oscillator.disconnect();
    oscillator = null;
  }

  if (gainNode) {
    gainNode.disconnect();
    gainNode = null;
  }

  if (audioContext) {
    audioContext.close().catch(() => {});
    audioContext = null;
  }

  playing = false;
}

export function isAlertSoundPlaying(): boolean {
  return playing;
}
