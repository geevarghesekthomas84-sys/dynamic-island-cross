import type { Transition } from "motion/react";

/** Spring used for island resizing; `speed` is a multiplier from settings (1 = default). */
export function islandSpring(reduced: boolean, speed = 1): Transition {
  if (reduced) return { duration: 0 };
  return { type: "spring", stiffness: 420 * speed, damping: 34, mass: 0.9 };
}

export function contentTransition(reduced: boolean): Transition {
  if (reduced) return { duration: 0 };
  return { type: "spring", stiffness: 500, damping: 36, mass: 0.7 };
}

export const contentVariants = {
  enter: { opacity: 0, scale: 0.94, filter: "blur(6px)" },
  center: { opacity: 1, scale: 1, filter: "blur(0px)" },
  exit: { opacity: 0, scale: 0.94, filter: "blur(6px)" },
};

/** A slightly bouncier spring so the island seems to be pulled open and settle. */
export function magneticSpring(reduced: boolean, speed = 1): Transition {
  if (reduced) return { duration: 0 };
  return { type: "spring", stiffness: 360 * speed, damping: 20, mass: 1 };
}
