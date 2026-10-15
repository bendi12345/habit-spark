export type FieldStatus = "current" | "completed" | "failed" | "locked";

export function getFieldNodeState(
  position: number,
  currentPosition: number,
  status: string | undefined,
): FieldStatus {
  if (position < currentPosition && status === "completed") return "completed";
  if (position === currentPosition && status === "current") return "current";
  if (position === currentPosition && status === "failed") return "failed";
  return "locked";
}

export function getWindingOffset(position: number, amplitude = 74): number {
  return Math.round(Math.sin(position * 0.8) * amplitude);
}

export function buildWindingPath(points: Array<{ x: number; y: number }>): string {
  if (points.length === 0) return "";
  return points.reduce((path, point, index) => {
    if (index === 0) return `M ${point.x} ${point.y}`;
    const previous = points[index - 1];
    if (!previous) return path;
    const middleY = (previous.y + point.y) / 2;
    return `${path} C ${previous.x} ${middleY}, ${point.x} ${middleY}, ${point.x} ${point.y}`;
  }, "");
}
