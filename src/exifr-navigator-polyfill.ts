// exifr reads `navigator.userAgent` unconditionally at module load time to
// pick orientation heuristics. React Native's global `navigator` object
// exists (`typeof navigator === "object"`) but has no `userAgent` property,
// so exifr's `.includes(...)` call throws before memora can finish loading.
const globalNavigator = (globalThis as { navigator?: { userAgent?: string } }).navigator;
if (globalNavigator && typeof globalNavigator.userAgent !== "string") {
  try {
    globalNavigator.userAgent = "";
  } catch {
    // navigator is frozen/read-only in this environment; exifr simply skips
    // its browser-specific orientation adjustments, which memora ignores.
  }
}
