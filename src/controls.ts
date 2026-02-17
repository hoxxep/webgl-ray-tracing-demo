import { RayTracer } from './raytracer';
import { createIcons, Play, Pause } from 'lucide';

export class Controls {
  private screen: HTMLElement;
  private canvas: HTMLCanvasElement;
  private controlsEl: HTMLElement;
  private rayTracer: RayTracer;
  private simulationTime: number;
  private animating: boolean;
  private animationFrameId: number;

  constructor(screen: HTMLElement, controls: HTMLElement) {
    this.screen = screen;
    this.canvas = screen.querySelector<HTMLCanvasElement>('canvas.render')!;
    this.controlsEl = controls;
    this.simulationTime = 0.0;
    this.animating = false;
    this.animationFrameId = 0;

    try {
      this.rayTracer = new RayTracer(this.canvas);
    } catch (e) {
      this.screen.querySelector('.error.overlay')!.classList.add('active');
      throw e;
    } finally {
      this.screen.querySelector('.loading.overlay')!.classList.remove('active');
    }

    this.controlsEl.querySelector('button.render')!.addEventListener('click', () => this.toggleAnimation());

    // Re-render on setting changes when paused
    for (const input of this.controlsEl.querySelectorAll<HTMLInputElement>('input.setting')) {
      input.addEventListener('input', () => this.renderIfPaused());
    }
    this.controlsEl.querySelector('.shadows input[type="checkbox"]')!
      .addEventListener('change', () => this.renderIfPaused());

    // Auto-start
    this.renderSingleFrame();
  }

  private renderSingleFrame(): void {
    try {
      this.rayTracer.render(
        this.setting('spheres'),
        this.setting('reflections'),
        this.setting('zoom'),
        this.checkbox('shadows'),
        this.simulationTime,
      );
    } catch (error) {
      console.error(error);
      const errorOverlay = this.screen.querySelector('.error.overlay')!;
      errorOverlay.classList.add('active');
      errorOverlay.querySelector('p')!.textContent = (error as Error).message;
    }
  }

  private renderIfPaused(): void {
    if (!this.animating) {
      this.renderSingleFrame();
    }
  }

  private toggleAnimation(): void {
    if (!this.animating) {
      const renderBtn = this.controlsEl.querySelector('button.render')!;
      renderBtn.innerHTML = '<i data-lucide="pause"></i> Pause';
      createIcons({ icons: { Pause }, nameAttr: 'data-lucide' });

      const timeDisplay = this.controlsEl.querySelector('span.render-time')!;

      this.animating = true;
      let startTime: number, endTime: number;
      startTime = endTime = performance.now();
      let frameCount = 0;
      let accumTime = 0;
      let lastDisplayUpdate = performance.now();
      const step = () => {
        if (this.animating) {
          startTime = performance.now();
          this.simulationTime += (startTime - endTime) / 100;
          this.rayTracer.render(
            this.setting('spheres'),
            this.setting('reflections'),
            this.setting('zoom'),
            this.checkbox('shadows'),
            this.simulationTime,
          );
          endTime = performance.now();
          accumTime += endTime - startTime;
          frameCount++;
          if (endTime - lastDisplayUpdate >= 250) {
            const avg = accumTime / frameCount;
            const fps = Math.round(frameCount * 1000 / (endTime - lastDisplayUpdate));
            timeDisplay.textContent = avg.toFixed(1) + 'ms (' + fps + ' fps)';
            accumTime = 0;
            frameCount = 0;
            lastDisplayUpdate = endTime;
          }
          this.animationFrameId = requestAnimationFrame(step);
        }
      };
      this.animationFrameId = requestAnimationFrame(step);
    } else {
      cancelAnimationFrame(this.animationFrameId);
      this.animating = false;
      const renderBtn = this.controlsEl.querySelector('button.render')!;
      renderBtn.innerHTML = '<i data-lucide="play"></i> Render';
      createIcons({ icons: { Play }, nameAttr: 'data-lucide' });
    }
  }

  private setting(name: string): number {
    return Number(this.controlsEl.querySelector<HTMLInputElement>('input.' + name)!.value);
  }

  private checkbox(name: string): boolean {
    return this.controlsEl.querySelector<HTMLInputElement>('.' + name + ' input[type="checkbox"]')!.checked;
  }
}
