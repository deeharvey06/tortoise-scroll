/** Serial playback orchestration, independent of React and chart rendering. */
export class PlaybackController {
  activate() {
    this.disposed = false;
  }
  constructor({
    step,
    onPlaying = () => {},
    onError = () => {},
    schedule = (callback, delay) => globalThis.setTimeout(callback, delay),
    cancel = (timer) => globalThis.clearTimeout(timer),
  }) {
    this.step = step;
    this.onPlaying = onPlaying;
    this.onError = onError;
    this.schedule = schedule;
    this.cancel = cancel;
    this.delay = 1000;
    this.playing = false;
    this.busy = false;
    this.timer = null;
    this.disposed = false;
  }

  play() {
    if (this.disposed || this.playing) return;
    this.playing = true;
    this.onPlaying(true);
    this.queue();
  }

  pause() {
    this.playing = false;
    this.cancel(this.timer);
    this.timer = null;
    this.onPlaying(false);
  }

  setSpeed(delay) {
    if (![2000, 1000, 500, 250].includes(delay))
      throw new Error('Unsupported playback speed');
    this.delay = delay;
    if (this.playing) {
      this.cancel(this.timer);
      this.queue();
    }
  }

  queue() {
    if (this.playing && !this.busy)
      this.timer = this.schedule(() => this.tick(), this.delay);
  }

  async tick() {
    if (!this.playing || this.busy || this.disposed) return;
    this.busy = true;
    try {
      const result = await this.step();
      if (!result || result.complete) this.pause();
    } catch (error) {
      this.pause();
      this.onError(error);
    } finally {
      this.busy = false;
      this.queue();
    }
  }

  dispose() {
    this.pause();
    this.disposed = true;
  }
}
