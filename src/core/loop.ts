/**
 * Fixed-timestep game loop. Simulation runs at a constant rate; rendering
 * runs every animation frame with an interpolation factor between the last
 * two simulation states.
 */
export const SIM_HZ = 60;
export const SIM_DT = 1 / SIM_HZ;
const MAX_FRAME = 0.25; // clamp long frames (tab switch, breakpoints)

export interface LoopCallbacks {
  update(dt: number): void;
  render(alpha: number, frameDt: number): void;
}

export class GameLoop {
  private acc = 0;
  private last = 0;
  private rafId = 0;
  private running = false;
  paused = false;

  constructor(private cb: LoopCallbacks) {}

  start(): void {
    if (this.running) return;
    this.running = true;
    this.last = performance.now();
    this.rafId = requestAnimationFrame(this.frame);
  }

  stop(): void {
    this.running = false;
    cancelAnimationFrame(this.rafId);
  }

  private frame = (now: number): void => {
    if (!this.running) return;
    const frameDt = Math.min((now - this.last) / 1000, MAX_FRAME);
    this.last = now;

    if (!this.paused) {
      this.acc += frameDt;
      while (this.acc >= SIM_DT) {
        this.cb.update(SIM_DT);
        this.acc -= SIM_DT;
      }
    }

    this.cb.render(this.paused ? 1 : this.acc / SIM_DT, frameDt);
    this.rafId = requestAnimationFrame(this.frame);
  };
}
