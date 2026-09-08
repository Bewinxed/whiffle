export function springFromVisual(visualDuration: number, bounce: number) {
  const stiffness = ((2 * Math.PI) / visualDuration) ** 2;
  const damping = (4 * Math.PI * (1 - bounce)) / visualDuration;
  // Svelte integrates in 60 Hz frame units; Motion's coefficients use seconds.
  return { stiffness: stiffness / 60 ** 2, damping: damping / 60 };
}
