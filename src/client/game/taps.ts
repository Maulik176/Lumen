/** A tap is a press and release in nearly the same place. Returns a function that stops listening. */
const TAP_SLOP = 12;

export function onTap(
  canvas: HTMLCanvasElement,
  handle: (clientX: number, clientY: number) => void
): () => void {
  let downX = 0;
  let downY = 0;
  let pressing = false;
  const down = (event: PointerEvent): void => {
    pressing = true;
    downX = event.clientX;
    downY = event.clientY;
  };
  const up = (event: PointerEvent): void => {
    if (!pressing) return;
    pressing = false;
    if (Math.hypot(event.clientX - downX, event.clientY - downY) > TAP_SLOP)
      return;
    handle(event.clientX, event.clientY);
  };
  const cancel = (): void => {
    pressing = false;
  };
  canvas.addEventListener('pointerdown', down);
  canvas.addEventListener('pointerup', up);
  canvas.addEventListener('pointercancel', cancel);
  return () => {
    canvas.removeEventListener('pointerdown', down);
    canvas.removeEventListener('pointerup', up);
    canvas.removeEventListener('pointercancel', cancel);
  };
}
