// 360° spin videos for wig products, keyed by product handle.
//
// Each spin is a 15-second seamless turntable rendered from that product's
// own store photo and approved by the founder on 2026-11-18. The product
// photo remains the primary media everywhere; a spin is an additional view
// on the product page only, so the product grid keeps one uniform image set.
export const JBH_SPIN_VIDEO_BY_HANDLE: Readonly<Record<string, string>> =
  Object.freeze({
    "flawless-glueless-4-4-closure-wig-body-wave": "/spins/spin15-bodywave.mp4",
    "flawless-13-6-body-wave-bob-wig": "/spins/spin15-bob.mp4",
    "flawless-deep-wave-u-part-wig": "/spins/spin15-deepwave.mp4",
  });

export function spinVideoForHandle(handle: string): string | undefined {
  return JBH_SPIN_VIDEO_BY_HANDLE[handle];
}
