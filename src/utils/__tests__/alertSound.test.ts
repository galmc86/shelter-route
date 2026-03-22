import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';

// Mock Web Audio API
const mockStop = vi.fn();
const mockStart = vi.fn();
const mockConnect = vi.fn();
const mockDisconnect = vi.fn();
const mockSetValueAtTime = vi.fn();
const mockClose = vi.fn().mockResolvedValue(undefined);

const mockOscillator = {
  type: 'sine',
  frequency: { setValueAtTime: mockSetValueAtTime },
  connect: mockConnect,
  disconnect: mockDisconnect,
  start: mockStart,
  stop: mockStop,
};

const mockGain = {
  gain: { setValueAtTime: mockSetValueAtTime },
  connect: mockConnect,
  disconnect: mockDisconnect,
};

class MockAudioContextClass {
  currentTime = 0;
  destination = {};
  createOscillator = vi.fn(() => mockOscillator);
  createGain = vi.fn(() => mockGain);
  close = mockClose;
}

vi.stubGlobal('AudioContext', MockAudioContextClass);

// Mock localStorage using the same pattern as other tests in this project
const localStorageMock = (() => {
  let store: Record<string, string> = {};
  return {
    getItem: vi.fn((key: string) => store[key] || null),
    setItem: vi.fn((key: string, value: string) => {
      store[key] = value;
    }),
    removeItem: vi.fn((key: string) => {
      delete store[key];
    }),
    clear: vi.fn(() => {
      store = {};
    }),
    get length() {
      return Object.keys(store).length;
    },
    key: vi.fn(() => null),
  };
})();

Object.defineProperty(globalThis, 'localStorage', {
  value: localStorageMock,
  writable: true,
});

describe('alertSound', () => {
  beforeEach(() => {
    vi.useFakeTimers();
    localStorageMock.clear();
    vi.resetModules();
    mockStop.mockClear();
    mockStart.mockClear();
    mockConnect.mockClear();
    mockDisconnect.mockClear();
    mockSetValueAtTime.mockClear();
    mockClose.mockClear();
  });

  afterEach(() => {
    vi.useRealTimers();
  });

  it('playAlertSound starts the oscillator and sets playing to true', async () => {
    const { playAlertSound, isAlertSoundPlaying } = await import('../../utils/alertSound');

    expect(isAlertSoundPlaying()).toBe(false);
    playAlertSound();
    expect(isAlertSoundPlaying()).toBe(true);
    expect(mockStart).toHaveBeenCalledTimes(1);
  });

  it('stopAlertSound stops the oscillator and sets playing to false', async () => {
    const { playAlertSound, stopAlertSound, isAlertSoundPlaying } = await import('../../utils/alertSound');

    playAlertSound();
    expect(isAlertSoundPlaying()).toBe(true);

    stopAlertSound();
    expect(isAlertSoundPlaying()).toBe(false);
    expect(mockStop).toHaveBeenCalled();
  });

  it('does not play if already playing', async () => {
    const { playAlertSound } = await import('../../utils/alertSound');

    playAlertSound();
    playAlertSound(); // Should not start again

    expect(mockStart).toHaveBeenCalledTimes(1);
  });

  it('does not play if sound is disabled in localStorage', async () => {
    localStorageMock.setItem('shelter-route:alert-sound-enabled', 'false');
    const { playAlertSound, isAlertSoundPlaying } = await import('../../utils/alertSound');

    playAlertSound();
    expect(isAlertSoundPlaying()).toBe(false);
    expect(mockStart).not.toHaveBeenCalled();
  });

  it('isAlertSoundPlaying returns correct state', async () => {
    const { playAlertSound, stopAlertSound, isAlertSoundPlaying } = await import('../../utils/alertSound');

    expect(isAlertSoundPlaying()).toBe(false);
    playAlertSound();
    expect(isAlertSoundPlaying()).toBe(true);
    stopAlertSound();
    expect(isAlertSoundPlaying()).toBe(false);
  });
});
