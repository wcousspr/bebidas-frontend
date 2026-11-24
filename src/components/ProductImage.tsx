import { useMemo, useState } from "react";
import { cloudinaryCandidates, type ImageWidth } from "../services/cloudinaryImage";

type RemoteImageProfile = "catalog" | "related" | "detail" | "cart" | "admin";

interface ImageProfile {
  widths: readonly ImageWidth[];
  sizes: string;
}

const mobileCardSizes = "(max-width: 360px) calc(100vw - 66px), (max-width: 600px) calc(50vw - 56px), (max-width: 768px) calc(50vw - 72px)";

const profiles: Record<RemoteImageProfile, ImageProfile> = {
  catalog: {
    widths: [160, 320, 480, 640],
    sizes: `${mobileCardSizes}, (max-width: 1100px) calc((100vw - 112px) / 3 - 50px), (max-width: 1320px) calc(25vw - 84px), 246px`,
  },
  related: {
    widths: [160, 320, 480, 640],
    sizes: `${mobileCardSizes}, (max-width: 1200px) calc(25vw - 77px), 223px`,
  },
  detail: {
    widths: [320, 480, 640, 960, 1280],
    sizes: "(max-width: 768px) calc(100vw - 66px), (max-width: 1200px) calc(50vw - 114px), 486px",
  },
  cart: { widths: [160, 320], sizes: "(max-width: 380px) 72px, 90px" },
  admin: { widths: [160, 320], sizes: "(max-width: 600px) 78px, 108px" },
};

interface ProductImageProps {
  src?: string | null;
  alt: string;
  profile: RemoteImageProfile | "preview";
  eager?: boolean;
  placeholder?: string;
  placeholderClassName?: string;
}

function validSource(src: string | null | undefined, preview: boolean) {
  if (!src) return undefined;
  try {
    const { protocol } = new URL(src);
    if (preview ? protocol === "blob:" : protocol === "https:" || protocol === "http:") return src;
  } catch {
    // An invalid URL can go directly to the placeholder.
  }
}

function ImageAttempt({
  src, alt, profile, eager, placeholder = "🥤", placeholderClassName,
}: ProductImageProps) {
  const [fallback, setFallback] = useState<"initial" | "original" | "placeholder">("initial");
  const settings = profile === "preview" ? undefined : profiles[profile];
  const { original, candidates } = useMemo(() => {
    const original = validSource(src, profile === "preview");
    return {
      original,
      candidates: original && settings ? cloudinaryCandidates(original, settings.widths) : [],
    };
  }, [src, profile, settings]);

  if (!original || fallback === "placeholder") {
    return <span className={placeholderClassName} role="img" aria-label={`Imagem indisponível: ${alt}`}>{placeholder}</span>;
  }

  const optimized = fallback === "initial" && candidates.length > 0;
  const srcSet = optimized ? candidates.map(({ url, width }) => `${url} ${width}w`).join(", ") : undefined;
  const primary = profile === "detail";

  return (
    <img
      key={fallback}
      src={optimized ? candidates[0].url : original}
      srcSet={srcSet}
      sizes={srcSet ? settings?.sizes : undefined}
      alt={alt}
      loading={eager || primary || profile === "preview" ? "eager" : "lazy"}
      decoding={primary || profile === "preview" ? undefined : "async"}
      fetchPriority={primary ? "high" : undefined}
      onError={() => setFallback((current) => current !== fallback ? current : srcSet ? "original" : "placeholder")}
    />
  );
}

export default function ProductImage(props: ProductImageProps) {
  return <ImageAttempt key={props.src} {...props} />;
}
