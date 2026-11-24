export type ImageWidth = 160 | 320 | 480 | 640 | 960 | 1280;

interface ImageCandidate {
  width: ImageWidth;
  url: string;
}

const SAFE_EFFECT = /^(?:e_(?:sharpen|improve|auto_color|vibrance)(?::\d+)?|a_exif)$/;
const QUALITY = /^q_(?:auto(?::(?:best|good|eco|low))?|[1-9]\d?|100)$/;

export function cloudinaryCandidates(source: string, widths: readonly ImageWidth[]): ImageCandidate[] {
  let url: URL;
  try {
    url = new URL(source);
  } catch {
    return [];
  }

  if (url.origin !== "https://res.cloudinary.com" || url.username || url.password ||
      [...url.searchParams.keys()].some((name) => name !== "_a")) {
    return [];
  }

  const [, cloud, asset, delivery, ...path] = url.pathname.split("/");
  if (!/^[\w-]+$/.test(cloud ?? "") || asset !== "image" || delivery !== "upload") return [];

  // Upload responses are versioned. Without a version, folders can be
  // indistinguishable from transformations, so keep the original URL.
  const version = path.findIndex((part) => /^v\d+$/.test(part));
  if (version < 0 || version === path.length - 1 || path.some((part) => !part)) return [];

  const effects: string[] = [];
  const deliveryOptions: string[] = [];
  let hasFormat = false;
  let hasQuality = false;
  for (const transformation of path.slice(0, version)) {
    if (transformation === "f_auto" && !hasFormat) {
      hasFormat = true;
      deliveryOptions.push(transformation);
    } else if (QUALITY.test(transformation) && !hasQuality) {
      hasQuality = true;
      deliveryOptions.push(transformation);
    } else if (deliveryOptions.length === 0 && SAFE_EFFECT.test(transformation)) {
      effects.push(transformation);
    } else {
      // Signed paths, named or complex transformations and existing sizing stay untouched.
      return [];
    }
  }

  if (!hasQuality) deliveryOptions.push("q_auto");
  if (!hasFormat) deliveryOptions.push("f_auto");

  return [...new Set(widths)].map((width) => {
    url.pathname = [
      "", cloud, asset, delivery, ...effects, `c_limit,w_${width}`,
      ...deliveryOptions, ...path.slice(version),
    ].join("/");
    return { width, url: url.href };
  });
}
