/**
 * Duration conversion utilities
 */

/**
 * Convert seconds to hours
 */
export function secondsToHours(seconds: number): number {
  return seconds / 3600;
}

/**
 * Convert hours to seconds
 */
export function hoursToSeconds(hours: number): number {
  return Math.round(hours * 3600);
}

/**
 * Format seconds as human-readable duration
 * @example formatDuration(5400) => "1h 30m"
 */
export function formatDuration(seconds: number): string {
  const totalMinutes = Math.round(seconds / 60);
  const hours = Math.floor(totalMinutes / 60);
  const minutes = totalMinutes % 60;

  if (hours === 0) {
    return `${minutes}m`;
  }

  if (minutes === 0) {
    return `${hours}h`;
  }

  return `${hours}h ${minutes}m`;
}

/**
 * Format seconds as decimal hours
 * @example formatDecimalHours(5400) => "1.5"
 */
export function formatDecimalHours(seconds: number): string {
  return secondsToHours(seconds).toFixed(1);
}

/**
 * Parse a duration string like "2h 30m" or "2.5h" to seconds
 */
export function parseDuration(duration: string): number | null {
  // Try decimal hours format (e.g., "2.5h" or "2.5")
  const decimalMatch = duration.match(/^(\d+(?:\.\d+)?)\s*h?$/i);
  if (decimalMatch) {
    return hoursToSeconds(parseFloat(decimalMatch[1]));
  }

  // Try hours and minutes format (e.g., "2h 30m" or "2h30m")
  const hhmm = duration.match(/^(\d+)\s*h\s*(?:(\d+)\s*m)?$/i);
  if (hhmm) {
    const hours = parseInt(hhmm[1], 10);
    const minutes = hhmm[2] ? parseInt(hhmm[2], 10) : 0;
    return hours * 3600 + minutes * 60;
  }

  // Try minutes only (e.g., "30m")
  const minutesMatch = duration.match(/^(\d+)\s*m$/i);
  if (minutesMatch) {
    return parseInt(minutesMatch[1], 10) * 60;
  }

  return null;
}
