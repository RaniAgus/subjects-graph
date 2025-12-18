/**
 * Handles screenshot capture and export with gauge/watermark overlay.
 */
export class ScreenshotExporter {
  #button;
  #getCanvasImage;
  #getProgress;
  #getColors;
  #getVariant;

  /**
   * @param {object} options
   * @param {HTMLButtonElement} options.button
   * @param {() => Blob} options.getCanvasImage - Function to get graph as image blob
   * @param {() => {approved: number, pending: number}} options.getProgress
   * @param {() => Record<string, string>} options.getColors
   * @param {() => string} options.getVariant
   */
  constructor({ button, getCanvasImage, getProgress, getColors, getVariant }) {
    this.#button = button;
    this.#getCanvasImage = getCanvasImage;
    this.#getProgress = getProgress;
    this.#getColors = getColors;
    this.#getVariant = getVariant;

    this.#button?.addEventListener('click', () => this.export());
  }

  async export() {
    try {
      const png = this.#getCanvasImage();
      const img = new Image();
      
      img.onload = () => {
        const paddingX = img.width * 0.1;
        const paddingY = img.height * 0.05;
        const canvas = document.createElement('canvas');
        canvas.width = img.width + paddingX * 2;
        canvas.height = img.height + paddingY * 2;

        const ctx = canvas.getContext('2d');
        if (!ctx) return;

        ctx.drawImage(img, paddingX, paddingY);
        this.#drawProgressGauge(ctx);
        this.#drawWatermark(ctx);

        canvas.toBlob(blob => {
          if (!blob) return;
          const url = URL.createObjectURL(blob);
          const link = document.createElement('a');
          link.download = `subjects-graph-${this.#getVariant()}.png`;
          link.href = url;
          link.click();
          URL.revokeObjectURL(url);
        }, 'image/png');
      };

      img.src = URL.createObjectURL(png);
    } catch (err) {
      console.error('Screenshot error:', err);
      if (err instanceof Error) {
        alert('Error al capturar pantalla: ' + err.message);
      }
    }
  }

  /**
   * @param {CanvasRenderingContext2D} ctx
   */
  #drawProgressGauge(ctx) {
    const minDimension = Math.min(ctx.canvas.width, ctx.canvas.height);
    const gaugeScale = minDimension / 600;
    const size = 120 * gaugeScale;
    const offset = 30 * gaugeScale;
    const x = ctx.canvas.width - size - offset;
    const y = ctx.canvas.height - size - offset;
    const centerX = x + size / 2;
    const centerY = y + size / 2;
    const radius = 45 * gaugeScale;
    const strokeWidth = 8 * gaugeScale;

    const { approved: approvedPercent, pending: pendingPercent } = this.#getProgress();
    const colors = this.#getColors();
    const bgColor = colors['--bg-secondary'] || '#161b22';
    const trackColor = colors['--bg-tertiary'] || '#21262d';
    const pendingColor = colors['--fill-color-3'] || '#2255d4';
    const approvedColor = colors['--fill-color-4'] || '#3b82f6';

    // Background
    ctx.beginPath();
    ctx.arc(centerX, centerY, size / 2, 0, Math.PI * 2);
    ctx.fillStyle = bgColor;
    ctx.fill();

    // Track
    ctx.beginPath();
    ctx.arc(centerX, centerY, radius, 0, Math.PI * 2);
    ctx.strokeStyle = trackColor;
    ctx.lineWidth = strokeWidth;
    ctx.stroke();

    // Pending arc
    if (pendingPercent > 0) {
      ctx.beginPath();
      ctx.arc(centerX, centerY, radius, -Math.PI / 2, -Math.PI / 2 + (Math.PI * 2 * pendingPercent / 100));
      ctx.strokeStyle = pendingColor;
      ctx.lineWidth = strokeWidth;
      ctx.lineCap = 'round';
      ctx.stroke();
    }

    // Approved arc
    if (approvedPercent > 0) {
      ctx.beginPath();
      ctx.arc(centerX, centerY, radius, -Math.PI / 2, -Math.PI / 2 + (Math.PI * 2 * approvedPercent / 100));
      ctx.strokeStyle = approvedColor;
      ctx.lineWidth = strokeWidth;
      ctx.lineCap = 'round';
      ctx.stroke();
    }

    // Approved text
    ctx.fillStyle = approvedColor;
    ctx.font = `700 ${1.5 * 16 * gaugeScale}px 'Open Sans', -apple-system, BlinkMacSystemFont, sans-serif`;
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';
    ctx.fillText(`${approvedPercent}%`, centerX, centerY - 6 * gaugeScale);

    // Pending text
    ctx.fillStyle = pendingColor;
    ctx.font = `600 ${0.75 * 16 * gaugeScale}px 'Open Sans', -apple-system, BlinkMacSystemFont, sans-serif`;
    ctx.fillText(`${pendingPercent}%`, centerX, centerY + 12 * gaugeScale);
  }

  /**
   * @param {CanvasRenderingContext2D} ctx
   */
  #drawWatermark(ctx) {
    const minDimension = Math.min(ctx.canvas.width, ctx.canvas.height);
    const wmScale = minDimension / 800;
    const text = 'raniagus.github.io/subjects-graph';
    const fontSize = 12 * wmScale;
    const x = ctx.canvas.width / 2;
    const y = 20 * wmScale;

    ctx.font = `600 ${fontSize}px "Open Sans", -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, Oxygen, Ubuntu, Cantarell, sans-serif`;
    ctx.textAlign = 'center';
    ctx.textBaseline = 'top';
    ctx.strokeStyle = 'black';
    ctx.lineWidth = 3 * wmScale;
    ctx.lineJoin = 'round';
    ctx.strokeText(text, x, y);
    ctx.fillStyle = 'white';
    ctx.fillText(text, x, y);
  }
}
