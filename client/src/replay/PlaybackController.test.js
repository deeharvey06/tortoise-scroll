import { afterEach, beforeEach, expect, test, vi } from 'vitest';
import { PlaybackController } from '@/replay/PlaybackController';
beforeEach(() => vi.useFakeTimers());
afterEach(() => vi.useRealTimers());

test('play, pause, resume, speed, and end of data control serial steps', async () => {
  let count = 0;

  const step = vi.fn(async () => ({ complete: ++count === 4 }));
  const playing = vi.fn();
  const player = new PlaybackController({ step, onPlaying: playing });

  player.play();
  player.play();

  await vi.advanceTimersByTimeAsync(1000);
  expect(count).toBe(1);

  player.pause();
  await vi.advanceTimersByTimeAsync(4000);
  expect(count).toBe(1);

  player.setSpeed(250);
  player.play();

  await vi.advanceTimersByTimeAsync(750);
  expect(count).toBe(4);
  expect(player.playing).toBe(false);

  await vi.advanceTimersByTimeAsync(5000);
  expect(count).toBe(4);
  expect(playing).toHaveBeenLastCalledWith(false);
  expect(() => player.setSpeed(1)).toThrow();
});

test('slow network never overlaps commands; pause stops further scheduled bars', async () => {
  let finish;
  const step = vi.fn(
    () =>
      new Promise((resolve) => {
        finish = resolve;
      })
  );

  const player = new PlaybackController({ step });
  player.play();
  await vi.advanceTimersByTimeAsync(5000);
  expect(step).toHaveBeenCalledTimes(1);

  player.setSpeed(500);
  player.pause();

  finish({ complete: false });
  await vi.advanceTimersByTimeAsync(5000);
  expect(step).toHaveBeenCalledTimes(1);
});

test('errors stop playback and dispose cancels timers', async () => {
  const onError = vi.fn();
  const player = new PlaybackController({
    step: async () => {
      throw new Error('gap');
    },
    onError,
  });

  player.play();
  await vi.advanceTimersByTimeAsync(1000);

  expect(onError).toHaveBeenCalled();
  expect(player.playing).toBe(false);

  player.play();
  player.dispose();

  await vi.advanceTimersByTimeAsync(5000);
  expect(onError).toHaveBeenCalledTimes(1);

  player.play();
  expect(player.playing).toBe(false);
});

test('React StrictMode setup-cleanup-setup can reactivate the controller', async () => {
  const step = vi.fn(async () => ({ complete: true }));
  const player = new PlaybackController({ step });

  player.activate();
  player.dispose();
  player.activate();
  player.play();

  await vi.advanceTimersByTimeAsync(1000);
  expect(step).toHaveBeenCalledTimes(1);
});
