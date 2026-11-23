
import { useEffect, useLayoutEffect, useRef, useState } from "react";
import { siteConfig } from "../../config/site";
import type { CartItem } from "../../contexts/CartContextDefinition";
import { useCart } from "../../contexts/useCart";
import { ApiHttpError, ApiNetworkError } from "../../services/api";
import { getProducts } from "../../services/product";
import "./Cart.css";

interface CartProps {
  onClose: () => void;
}

interface CheckoutAttempt {
  controller: AbortController;
  popup: Window | null;
  timeout?: number;
}

type CheckoutStatus =
  | { kind: "validating"; items: CartItem[] }
  | { kind: "ready"; items: CartItem[]; url: string };

function cancelAttempt(attempt: CheckoutAttempt) {
  window.clearTimeout(attempt.timeout);
  attempt.controller.abort();
  attempt.popup?.close();
}

const formatCurrency = (value: number) =>
  value.toLocaleString("pt-BR", {
    style: "currency",
    currency: "BRL",
  });

export default function Cart({ onClose }: CartProps) {
  const {
    items,
    addToCart,
    decreaseQuantity,
    removeFromCart,
    clearCart,
    updateValidatedItems,
    totalItems,
    totalPrice,
  } = useCart();

  const [avisoPreco, setAvisoPreco] = useState("");
  const [checkout, setCheckout] = useState<CheckoutStatus | null>(null);
  const [avisoCancelamento, setAvisoCancelamento] = useState("");
  const [erroFinalizacao, setErroFinalizacao] = useState("");
  const [nomeCliente, setNomeCliente] = useState("");
  const [tipoEntrega, setTipoEntrega] = useState<
    "entrega" | "retirada"
  >("entrega");
  const [endereco, setEndereco] = useState("");
  const dialogRef = useRef<HTMLDialogElement>(null);
  const feedbackRef = useRef<HTMLDivElement>(null);
  const nameRef = useRef<HTMLInputElement>(null);
  const addressRef = useRef<HTMLTextAreaElement>(null);
  const activeAttempt = useRef<CheckoutAttempt | null>(null);
  const checkoutAtual = checkout?.items === items ? checkout : null;
  const finalizando = checkoutAtual?.kind === "validating";

  // A mudança de itens pelo contexto também invalida a tentativa, mesmo fora do diálogo.
  useLayoutEffect(() => {
    return () => {
      const attempt = activeAttempt.current;
      activeAttempt.current = null;
      if (attempt) cancelAttempt(attempt);
    };
  }, [items]);

  function invalidateCheckout(message = "") {
    const attempt = activeAttempt.current;
    activeAttempt.current = null;
    if (attempt) cancelAttempt(attempt);
    setCheckout(null);
    if (attempt) setAvisoCancelamento(message);
  }

  function changeOrder(change: () => void) {
    invalidateCheckout("O pedido mudou. Valide novamente para continuar.");
    change();
  }

  function closeCart() {
    invalidateCheckout();
    onClose();
  }

  useEffect(() => {
    const dialog = dialogRef.current;
    if (!dialog) return;
    const viewport = window.visualViewport;

    function positionInViewport() {
      if (!dialog || !viewport) return;

      dialog.style.setProperty("--cart-viewport-height", `${viewport.height}px`);
      dialog.style.setProperty("--cart-viewport-top", `${viewport.offsetTop}px`);
    }

    function resizeToViewport() {
      positionInViewport();
      const field = document.activeElement;
      if (field === nameRef.current || field === addressRef.current) {
        field?.scrollIntoView({ block: "nearest", behavior: "instant" });
      }
    }

    dialog.showModal();
    resizeToViewport();
    viewport?.addEventListener("resize", resizeToViewport);
    viewport?.addEventListener("scroll", positionInViewport);

    return () => {
      viewport?.removeEventListener("resize", resizeToViewport);
      viewport?.removeEventListener("scroll", positionInViewport);
      dialog.close();
    };
  }, []);

  useEffect(() => {
    if (!erroFinalizacao && !avisoPreco) return;
    if (document.activeElement !== nameRef.current && document.activeElement !== addressRef.current) {
      feedbackRef.current?.scrollIntoView({ block: "nearest", behavior: "instant" });
    }
  }, [erroFinalizacao, avisoPreco]);

  async function finalizarPedido() {
    if (activeAttempt.current || checkoutAtual?.kind === "ready" || items.length === 0) return;

    setAvisoPreco("");
    setAvisoCancelamento("");
    setErroFinalizacao("");

    if (!nomeCliente.trim()) {
      nameRef.current?.focus();
      setErroFinalizacao("Informe seu nome para continuar.");
      return;
    }

    if (tipoEntrega === "entrega" && !endereco.trim()) {
      addressRef.current?.focus();
      setErroFinalizacao("Informe o endereço de entrega.");
      return;
    }

    const whatsapp = siteConfig.whatsapp.replace(/\D/g, "");

    if (!/^\d{12,15}$/.test(whatsapp)) {
      setErroFinalizacao("Configure um número válido de WhatsApp.");
      return;
    }

    // A identidade do objeto é exclusiva de cada tentativa e trava novos cliques.
    const attempt: CheckoutAttempt = { controller: new AbortController(), popup: null };
    activeAttempt.current = attempt;
    setCheckout({ kind: "validating", items });

    try {
      // A abertura antecipada precisa ocorrer durante o clique.
      attempt.popup = window.open("", "_blank");
      if (attempt.popup) attempt.popup.opener = null;

      attempt.timeout = window.setTimeout(() => {
        if (activeAttempt.current !== attempt) return;
        invalidateCheckout();
        setErroFinalizacao("A consulta demorou mais que o esperado. Tente novamente.");
      }, siteConfig.checkoutTimeoutMs);

      const produtosAtuais = await getProducts({
        signal: attempt.controller.signal,
        cache: "no-store",
      });
      if (activeAttempt.current !== attempt) return;

      const itensAtualizados = items.map((item) => {
        const atual = produtosAtuais.find(
          (produto) => produto.id === item.product.id
        );

        if (!atual) {
          throw new Error(
            `O produto "${item.product.name}" não está mais disponível.`
          );
        }

        if (atual.quantity < item.quantity) {
          throw new Error(
            `Estoque insuficiente para "${atual.name}". Disponível: ${atual.quantity}.`
          );
        }

        return {
          product: atual,
          quantity: item.quantity,
        };
      });

      const precosAlterados = itensAtualizados.some(
        (item, index) => item.product.price !== items[index]?.product.price
      );

      if (precosAlterados) {
        updateValidatedItems(items, itensAtualizados);
        setAvisoPreco(
          "Alguns preços foram atualizados. Confira os novos valores antes de finalizar."
        );
        return;
      }

      const linhas = itensAtualizados.map(
        ({ product, quantity }) =>
          `• ${quantity}x ${product.name} — ${formatCurrency(product.price * quantity)}`
      );

      const total = itensAtualizados.reduce(
        (soma, item) => soma + item.product.price * item.quantity,
        0
      );
      const mensagem = [
        "Olá! Gostaria de fazer o seguinte pedido:",
        "",
        `Cliente: ${nomeCliente.trim()}`,
        `Modalidade: ${tipoEntrega === "entrega" ? "Entrega" : "Retirada"}`,
        ...(tipoEntrega === "entrega"
          ? [`Endereço: ${endereco.trim()}`]
          : []),
        "",
        "PRODUTOS:",
        ...linhas,
        "",
        `Total dos produtos: ${formatCurrency(total)}`,
        "",
        "Gostaria de confirmar a disponibilidade e o valor final do pedido.",
      ].join("\n");

      const url = `https://wa.me/${whatsapp}?text=${encodeURIComponent(mensagem)}`;
      if (activeAttempt.current !== attempt) return;

      if (attempt.popup && !attempt.popup.closed) {
        attempt.popup.location.href = url;
        attempt.popup = null;
      } else {
        setCheckout({ kind: "ready", items, url });
      }
    } catch (err) {
      if (activeAttempt.current !== attempt) return;

      setErroFinalizacao(
        err instanceof ApiHttpError
          ? `O serviço de validação retornou um erro (HTTP ${err.status}). Tente novamente.`
          : err instanceof ApiNetworkError
            ? "Não foi possível conectar ao serviço de validação. Confira sua conexão e tente novamente."
            : err instanceof Error
              ? err.message
              : "Não foi possível finalizar o pedido."
      );
    } finally {
      if (activeAttempt.current === attempt) {
        activeAttempt.current = null;
        window.clearTimeout(attempt.timeout);
        attempt.popup?.close();
        setCheckout((current) => current?.kind === "validating" ? null : current);
      }
    }
  }

  return (
    <dialog
      ref={dialogRef}
      className="cart-overlay"
      aria-labelledby="cart-title"
      onCancel={(event) => {
        event.preventDefault();
        closeCart();
      }}
      onClick={(event) => {
        if (event.target === event.currentTarget) closeCart();
      }}
    >
      <div className="cart-panel">
        <div className="cart-header">
          <div>
            <h2 id="cart-title">Meu carrinho</h2>
            <p>{totalItems} itens selecionados</p>
          </div>

          <button
            type="button"
            className="cart-close"
            onClick={closeCart}
            aria-label="Fechar carrinho"
          >
            ✕
          </button>
        </div>

        <div className="cart-content">
          {items.length === 0 ? (
            <div className="cart-empty">
              <span>🛒</span>
              <h3>Seu carrinho está vazio</h3>
              <p>Adicione algumas bebidas para começar.</p>

              <button type="button" onClick={closeCart}>
                Continuar comprando
              </button>
            </div>
          ) : (
            <div className="cart-items">
              {items.map(({ product, quantity }) => (
                <article className="cart-item" key={product.id}>
                  <div className="cart-item-image">
                    {product.imageUrl ? (
                      <img
                        src={product.imageUrl}
                        alt={product.name}
                        loading="lazy"
                        decoding="async"
                      />
                    ) : (
                      <span>🥤</span>
                    )}
                  </div>

                  <div className="cart-item-details">
                    <h3>{product.name}</h3>

                    <p>{formatCurrency(product.price)} / un.</p>

                    <strong>
                      {formatCurrency(product.price * quantity)}
                    </strong>

                    <div className="cart-item-bottom">
                      <div className="cart-quantity">
                        <button
                          type="button"
                          onClick={() => changeOrder(() => decreaseQuantity(product.id))}
                          aria-label={`Diminuir quantidade de ${product.name}`}
                        >
                          −
                        </button>

                        <span>{quantity}</span>

                        <button
                          type="button"
                          onClick={() => changeOrder(() => addToCart(product))}
                          disabled={quantity >= product.quantity}
                          aria-label={`Aumentar quantidade de ${product.name}`}
                        >
                          +
                        </button>
                      </div>

                      <button
                        type="button"
                        className="cart-remove"
                        onClick={() => changeOrder(() => removeFromCart(product.id))}
                      >
                        Remover
                      </button>
                    </div>
                  </div>
                </article>
              ))}
            </div>
          )}

          {items.length > 0 && (
            <>
              <button
                type="button"
                className="cart-clear"
                onClick={() => {
                  if (window.confirm("Deseja esvaziar o carrinho?")) {
                    changeOrder(clearCart);
                  }
                }}
              >
                Esvaziar carrinho
              </button>

              <div className="cart-customer">
                <h3>Dados do pedido</h3>

                <label htmlFor="nome-cliente">Seu nome</label>
                <input
                  ref={nameRef}
                  id="nome-cliente"
                  type="text"
                  autoComplete="name"
                  placeholder="Digite seu nome"
                  value={nomeCliente}
                  onChange={(e) => changeOrder(() => setNomeCliente(e.target.value))}
                  maxLength={100}
                  required
                />

                <span id="cart-delivery-label">Como deseja receber?</span>

                <div className="cart-delivery-options" role="group" aria-labelledby="cart-delivery-label">
                  <label>
                    <input
                      type="radio"
                      name="tipo-entrega"
                      value="entrega"
                      checked={tipoEntrega === "entrega"}
                      onChange={() => changeOrder(() => setTipoEntrega("entrega"))}
                    />
                    Entrega
                  </label>

                  <label>
                    <input
                      type="radio"
                      name="tipo-entrega"
                      value="retirada"
                      checked={tipoEntrega === "retirada"}
                      onChange={() => changeOrder(() => setTipoEntrega("retirada"))}
                    />
                    Retirada
                  </label>
                </div>

                {tipoEntrega === "entrega" && (
                  <>
                    <label htmlFor="endereco-cliente">
                      Endereço de entrega
                    </label>

                    <textarea
                      ref={addressRef}
                      id="endereco-cliente"
                      autoComplete="street-address"
                      placeholder="Rua, número, bairro, cidade e complemento"
                      value={endereco}
                      onChange={(e) => changeOrder(() => setEndereco(e.target.value))}
                      rows={3}
                      maxLength={300}
                      required
                    />
                  </>
                )}
              </div>

              {(erroFinalizacao || avisoPreco) && (
                <div ref={feedbackRef} className="cart-feedback">
                  {erroFinalizacao && <p role="alert">{erroFinalizacao}</p>}
                  {avisoPreco && <p className="cart-price-warning" role="status">{avisoPreco}</p>}
                </div>
              )}
            </>
          )}
        </div>

        {items.length > 0 && (
          <div className="cart-footer">
            <div className="cart-total">
              <span>Total estimado</span>
              <strong>{formatCurrency(totalPrice)}</strong>
            </div>

            <div className="cart-checkout-status" role="status">
              {finalizando && "Consultando preço e estoque..."}
              {checkoutAtual?.kind === "ready" && "Pedido validado. Use o link abaixo para continuar."}
              {!checkoutAtual && avisoCancelamento}
            </div>

            {checkoutAtual?.kind === "ready" ? (
              <a className="cart-checkout" href={checkoutAtual.url}>
                Continuar pelo WhatsApp
              </a>
            ) : (
              <button
                type="button"
                className="cart-checkout"
                onClick={finalizarPedido}
                disabled={finalizando}
              >
                {finalizando ? "Validando pedido..." : "Finalizar pelo WhatsApp"}
              </button>
            )}

            {finalizando && (
              <button
                type="button"
                className="cart-cancel-checkout"
                onClick={() => invalidateCheckout("Validação cancelada. Você pode tentar novamente.")}
              >
                Cancelar validação
              </button>
            )}
          </div>
        )}
      </div>
    </dialog>
  );
}
