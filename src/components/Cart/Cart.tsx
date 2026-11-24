
import { useEffect, useLayoutEffect, useRef, useState } from "react";
import { siteConfig } from "../../config/site";
import { indexProducts, needsStockReview, reconcileCart, type CartItem } from "../../contexts/cartState";
import { useCart } from "../../contexts/useCart";
import { ApiHttpError, ApiNetworkError } from "../../services/api";
import { getProducts, invalidateCatalog } from "../../services/product";
import ProductImage from "../ProductImage";
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
    adjustToStock,
    removeFromCart,
    clearCart,
    beginCheckoutValidation,
    acceptPriceChanges,
    syncCart,
    syncStatus,
    storageError,
    totalItems,
    totalPrice,
  } = useCart();

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
  const hasPriceChanges = items.some((item) => item.previousPrice !== undefined);
  const syncPending = syncStatus === "syncing";
  const syncFailed = syncStatus === "error";
  const pricesStale = syncStatus === "stale";
  const pricesVisible = !syncPending && !syncFailed && !pricesStale;
  const checkoutBlocked = syncPending || syncFailed || hasPriceChanges ||
    items.some((item) => !item.product || item.availability === "unavailable" || needsStockReview(item));

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
    setErroFinalizacao("");
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
    if (!erroFinalizacao) return;
    if (document.activeElement !== nameRef.current && document.activeElement !== addressRef.current) {
      feedbackRef.current?.scrollIntoView({ block: "nearest", behavior: "instant" });
    }
  }, [erroFinalizacao]);

  async function finalizarPedido() {
    if (activeAttempt.current || checkoutAtual?.kind === "ready" || checkoutBlocked || items.length === 0) return;

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

    const validation = beginCheckoutValidation(items);
    if (!validation) return;

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
        validation.fail();
        setErroFinalizacao("A consulta demorou mais que o esperado. Tente novamente.");
      }, siteConfig.checkoutTimeoutMs);

      const produtosAtuais = await getProducts({
        signal: attempt.controller.signal,
        cache: "no-store",
      });
      if (activeAttempt.current !== attempt) return;

      const catalog = indexProducts(produtosAtuais);
      const itensAtualizados = reconcileCart(items, catalog);
      if (!validation.apply(itensAtualizados, catalog)) {
        setErroFinalizacao("O carrinho foi atualizado durante a consulta. Tente novamente.");
        return;
      }
      invalidateCatalog();

      const linhas: string[] = [];
      let total = 0;
      for (const item of itensAtualizados) {
        const { product, quantity } = item;
        if (!product || item.availability !== "available" ||
            needsStockReview(item) || item.previousPrice !== undefined) {
          setErroFinalizacao("O carrinho mudou. Revise os itens antes de finalizar.");
          return;
        }
        const subtotal = product.price * quantity;
        linhas.push(`• ${quantity}x ${product.name} — ${formatCurrency(subtotal)}`);
        total += subtotal;
      }

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
        setCheckout({ kind: "ready", items: itensAtualizados, url });
      }
    } catch (err) {
      if (activeAttempt.current !== attempt) return;
      validation.fail();

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
          {storageError && (
            <p className="cart-price-warning" role="status">
              O armazenamento está indisponível. O carrinho pode não ser mantido ao recarregar.
            </p>
          )}
          {items.length > 0 && (
            <div className="cart-sync">
              <p role="status">
                {syncPending && "Atualizando preços e disponibilidade…"}
                {syncFailed && "Não foi possível atualizar o carrinho. Seus itens foram mantidos."}
                {pricesStale && !erroFinalizacao && "Os preços e o estoque precisam ser confirmados."}
              </p>
              <button
                type="button"
                className="cart-secondary-action"
                disabled={syncPending || finalizando}
                onClick={() => changeOrder(() => { void syncCart(); })}
              >
                {syncFailed || pricesStale ? "Tentar novamente" : "Atualizar carrinho"}
              </button>
            </div>
          )}
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
              {items.map((item) => {
                const { productId, product, quantity, availability, previousPrice, previousStock } = item;
                const name = product?.name ?? `Produto #${productId}`;
                const reducedStock = needsStockReview(item);
                return (
                  <article className="cart-item" key={productId}>
                    <div className="cart-item-image">
                      <ProductImage src={product?.imageUrl} alt={name} profile="cart" />
                    </div>

                    <div className="cart-item-details">
                      <h3>{name}</h3>

                      {availability === "unavailable" && (
                        <p className="cart-price-warning">Produto indisponível. Remova-o para continuar com o pedido.</p>
                      )}
                      {product && availability !== "unavailable" && pricesVisible && (
                        availability === "unconfirmed" ? (
                          <p>Preço provisório: {formatCurrency(product.price)} / un.</p>
                        ) : (
                          <>
                            <p>{formatCurrency(product.price)} / un.</p>
                            {previousPrice !== undefined && (
                              <p className="cart-price-warning">
                                Preço atualizado de {formatCurrency(previousPrice)} para {formatCurrency(product.price)} por unidade.
                              </p>
                            )}
                            <strong>{formatCurrency(product.price * quantity)}</strong>
                          </>
                        )
                      )}
                      {reducedStock && product && pricesVisible && (
                        <p className="cart-price-warning">
                          Você selecionou {quantity}. O estoque agora é de {product.quantity}.
                        </p>
                      )}
                      {!reducedStock && previousStock !== undefined && product && availability === "available" && pricesVisible && (
                        <p className="cart-price-warning">
                          Estoque reduzido de {previousStock} para {product.quantity} unidades.
                        </p>
                      )}

                      <div className="cart-item-bottom">
                        <div className="cart-quantity">
                          <button
                            type="button"
                            onClick={() => changeOrder(() => decreaseQuantity(productId))}
                            aria-label={`Diminuir quantidade de ${name}`}
                          >
                            −
                          </button>

                          <span>{quantity}</span>

                          <button
                            type="button"
                            onClick={() => { if (product) changeOrder(() => addToCart(product)); }}
                            disabled={!product || syncFailed || availability === "unavailable" || quantity >= product.quantity}
                            aria-label={`Aumentar quantidade de ${name}`}
                          >
                            +
                          </button>
                        </div>

                        <button
                          type="button"
                          className="cart-remove"
                          onClick={() => changeOrder(() => removeFromCart(productId))}
                        >
                          Remover
                        </button>
                        {reducedStock && pricesVisible && (
                          <button
                            type="button"
                            className="cart-secondary-action"
                            onClick={() => changeOrder(() => adjustToStock(productId))}
                          >
                            Ajustar ao estoque
                          </button>
                        )}
                      </div>
                    </div>
                  </article>
                );
              })}
            </div>
          )}

          {items.length > 0 && (
            <>
              {hasPriceChanges && !syncFailed && (
                <div className="cart-review">
                  <p className="cart-price-warning" role="status">
                    Confira os preços atualizados antes de finalizar.
                  </p>
                  <button
                    type="button"
                    className="cart-secondary-action"
                    disabled={syncPending || finalizando}
                    onClick={() => changeOrder(acceptPriceChanges)}
                  >
                    Confirmar preços atualizados
                  </button>
                </div>
              )}
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

              {erroFinalizacao && (
                <div ref={feedbackRef} className="cart-feedback">
                  <p role="alert">{erroFinalizacao}</p>
                </div>
              )}
            </>
          )}
        </div>

        {items.length > 0 && (
          <div className="cart-footer">
            <div className="cart-total">
              <span>Total estimado</span>
              <strong>{totalPrice === null || !pricesVisible ? "A confirmar" : formatCurrency(totalPrice)}</strong>
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
                disabled={finalizando || checkoutBlocked}
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
