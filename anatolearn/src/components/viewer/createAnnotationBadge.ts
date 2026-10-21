// Paints a UI badge only; Viewer owns the Three.js texture made from it.
export function createAnnotationBadge(number: number, color: string): HTMLCanvasElement | null {
  const canvas = document.createElement('canvas');
  canvas.width = 256;
  canvas.height = 256;
  const context = canvas.getContext('2d');
  if (!context) return null;

  context.clearRect(0, 0, canvas.width, canvas.height);
  context.beginPath();
  context.arc(128, 128, 100, 0, Math.PI * 2);
  context.fillStyle = color;
  context.fill();
  context.lineWidth = 12;
  context.strokeStyle = '#ffffff';
  context.stroke();
  context.fillStyle = '#ffffff';
  context.font = 'bold 110px Arial';
  context.textAlign = 'center';
  context.textBaseline = 'middle';
  context.fillText(String(number), 128, 136);
  return canvas;
}
