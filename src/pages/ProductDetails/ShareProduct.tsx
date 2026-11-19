import { useState } from "react";

interface ShareProductProps {
  name: string;
  price: string;
  url: string;
}

export default function ShareProduct({ name, price, url }: ShareProductProps) {
  const [status, setStatus] = useState<"idle" | "copied" | "manual">("idle");

  async function shareProduct() {
    setStatus("idle");

    if (typeof navigator.share === "function") {
      try {
        await navigator.share({ title: name, text: `${name} — ${price}`, url });
        return;
      } catch (error) {
        if (error instanceof DOMException && error.name === "AbortError") return;
      }
    }

    try {
      await navigator.clipboard.writeText(url);
      setStatus("copied");
    } catch {
      setStatus("manual");
    }
  }

  return (
    <div className="product-share">
      <button type="button" className="product-share-button" onClick={shareProduct}>
        Compartilhar produto
      </button>
      <p className="product-share-status" role="status">
        {status === "copied" && "Link copiado."}
        {status === "manual" && "Selecione e copie o link do produto."}
      </p>
      {status === "manual" && (
        <input
          type="url"
          aria-label="Link do produto"
          value={url}
          readOnly
          onFocus={(event) => event.currentTarget.select()}
        />
      )}
    </div>
  );
}
