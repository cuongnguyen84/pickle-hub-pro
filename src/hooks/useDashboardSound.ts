import { useCallback, useRef, useState } from "react";

export const useDashboardSound = () => {
  const [soundEnabled, setSoundEnabled] = useState(false);
  const audioContextRef = useRef<AudioContext | null>(null);

  const getAudioContext = useCallback(() => {
    if (!audioContextRef.current) {
      audioContextRef.current = new AudioContext();
    }
    return audioContextRef.current;
  }, []);

  const playBeep = useCallback(
    (frequency: number = 800, duration: number = 200) => {
      if (!soundEnabled) return;
      try {
        const ctx = getAudioContext();
        const oscillator = ctx.createOscillator();
        const gainNode = ctx.createGain();
        oscillator.connect(gainNode);
        gainNode.connect(ctx.destination);
        oscillator.frequency.value = frequency;
        oscillator.type = "sine";
        gainNode.gain.setValueAtTime(0.3, ctx.currentTime);
        gainNode.gain.exponentialRampToValueAtTime(0.01, ctx.currentTime + duration / 1000);
        oscillator.start(ctx.currentTime);
        oscillator.stop(ctx.currentTime + duration / 1000);
      } catch {
        // Silently fail if audio context isn't available
      }
    },
    [soundEnabled, getAudioContext]
  );

  const playMatchStart = useCallback(() => {
    playBeep(880, 150);
    setTimeout(() => playBeep(1100, 200), 180);
  }, [playBeep]);

  const playMatchEnd = useCallback(() => {
    playBeep(600, 300);
  }, [playBeep]);

  const toggleSound = useCallback(() => {
    setSoundEnabled((prev) => {
      if (!prev) {
        // Initialize audio context on user interaction
        getAudioContext();
      }
      return !prev;
    });
  }, [getAudioContext]);

  return { soundEnabled, toggleSound, playMatchStart, playMatchEnd };
};
