const EXERCISE_GIF_MAP: Record<string, string> = {
  "ankle pumps": "ankle-pumps.gif",
  bridges: "bridges.gif",
  "heel raises": "heel_raises.gif",
  "heel slides": "heel_slides.gif",
  lunges: "lunges.gif",
  "quad sets": "quad_sets.gif",
  "running simulation": "running_simulation.gif",
  "seated knee extension": "seated_knee_extension.gif",
  "side leg balance": "side_leg_balance.gif",
  "side leg raises": "side_leg_raises.gif",
  "single-leg squats": "single_leg_squats.gif",
  squats: "squats.gif",
  "step hops": "step_hops.gif",
  "step-ups": "step_ups.gif",
  "straight leg raises": "straight_leg_raises.gif",
  "wall slides": "wall_slides.gif",
};

const slugifyExerciseName = (exerciseName: string): string =>
  exerciseName
    .toLowerCase()
    .trim()
    .replace(/[^a-z0-9]+/g, "_")
    .replace(/^_+|_+$/g, "");

export const getExerciseGifPath = (exerciseName: string): string => {
  const mappedFile = EXERCISE_GIF_MAP[exerciseName.toLowerCase().trim()];
  if (mappedFile) return `/gifs/${mappedFile}`;
  return `/gifs/${slugifyExerciseName(exerciseName)}.gif`;
};
