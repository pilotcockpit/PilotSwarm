/** A published canvas is a file named canvas.html (slot 1) or canvas2.html to canvas5.html. */
export function isCanvasFile(name: string) {
  return /^canvas([2-5])?\.html$/.test(name);
}

/** The slot a canvas file is in, 1 to 5; 0 for a file that is not a canvas. */
export function canvasSlot(name: string) {
  const m = name.match(/^canvas([2-5])?\.html$/);
  return m ? Number(m[1] || 1) : 0;
}
