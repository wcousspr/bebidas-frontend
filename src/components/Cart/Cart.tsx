
import { useState } from "react";
import { siteConfig } from "../../config/site";
import { useCart } from "../../contexts/useCart";
import { getProducts } from "../../services/product";
import "./Cart.css";

interface CartProps {
  onClose: () => void;
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
    syncCart,
    totalItems,
    totalPrice,
  } = useCart();

  const [avisoPreco, setAvisoPreco] = useState("");
  const [finalizando, setFinalizando] = useState(false);
  const [erroFinalizacao, setErroFinalizacao] = useState("");
  const [nomeCliente, setNomeCliente] = useState("");
  const [tipoEntrega, setTipoEntrega] = useState<
    "entrega" | "retirada"
  >("entrega");
  const [endereco, setEndereco] = useState("");

  async function finalizarPedido() {
    if (finalizando || items.length === 0) return;

    setAvisoPreco("");
    setErroFinalizacao("");

    if (!nomeCliente.trim()) {
      setErroFinalizacao("Informe seu nome para continuar.");
      return;
    }

    if (tipoEntrega === "entrega" && !endereco.trim()) {
      setErroFinalizacao("Informe o endereço de entrega.");
      return;
    }

    const whatsapp = siteConfig.whatsapp.replace(/\D/g, "");

    if (!/^\d{12,15}$/.test(whatsapp)) {
      setErroFinalizacao("Configure um número válido de WhatsApp.");
      return;
    }

    // Abrimos a janela durante o clique para evitar
    // bloqueios de pop-up após a consulta à API.
    const janela = window.open("", "_blank");

    if (!janela) {
      setErroFinalizacao(
        "O navegador bloqueou a abertura do WhatsApp. Permita pop-ups e tente novamente."
      );
      return;
    }

    janela.opener = null;
    setFinalizando(true);

    try {
      const produtosAtuais = await getProducts();

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
        janela.close();
        setAvisoPreco(
          "Alguns preços foram atualizados. Confira os novos valores antes de finalizar."
        );
        await syncCart();
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

      janela.location.href =
        `https://wa.me/${whatsapp}?text=${encodeURIComponent(mensagem)}`;
    } catch (err) {
      janela.close();

      setErroFinalizacao(
        err instanceof Error
          ? err.message
          : "Não foi possível finalizar o pedido."
      );
    } finally {
      setFinalizando(false);
    }
  }

  return (
    <div className="cart-overlay" onClick={onClose}>
      <aside
        className="cart-panel"
        role="dialog"
        aria-modal="true"
        aria-label="Carrinho de compras"
        onClick={(event) => event.stopPropagation()}
      >
        <div className="cart-header">
          <div>
            <h2>Meu carrinho</h2>
            <p>{totalItems} itens selecionados</p>
          </div>

          <button
            type="button"
            className="cart-close"
            onClick={onClose}
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

              <button type="button" onClick={onClose}>
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
                          onClick={() => decreaseQuantity(product.id)}
                          aria-label={`Diminuir quantidade de ${product.name}`}
                        >
                          −
                        </button>

                        <span>{quantity}</span>

                        <button
                          type="button"
                          onClick={() => addToCart(product)}
                          disabled={quantity >= product.quantity}
                          aria-label={`Aumentar quantidade de ${product.name}`}
                        >
                          +
                        </button>
                      </div>

                      <button
                        type="button"
                        className="cart-remove"
                        onClick={() => removeFromCart(product.id)}
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
                    clearCart();
                  }
                }}
              >
                Esvaziar carrinho
              </button>

              <div className="cart-customer">
                <h3>Dados do pedido</h3>

                <label htmlFor="nome-cliente">Seu nome</label>
                <input
                  id="nome-cliente"
                  type="text"
                  placeholder="Digite seu nome"
                  value={nomeCliente}
                  onChange={(e) => setNomeCliente(e.target.value)}
                  maxLength={100}
                  required
                />

                <label>Como deseja receber?</label>

                <div className="cart-delivery-options">
                  <label>
                    <input
                      type="radio"
                      name="tipo-entrega"
                      value="entrega"
                      checked={tipoEntrega === "entrega"}
                      onChange={() => setTipoEntrega("entrega")}
                    />
                    Entrega
                  </label>

                  <label>
                    <input
                      type="radio"
                      name="tipo-entrega"
                      value="retirada"
                      checked={tipoEntrega === "retirada"}
                      onChange={() => setTipoEntrega("retirada")}
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
                      id="endereco-cliente"
                      placeholder="Rua, número, bairro, cidade e complemento"
                      value={endereco}
                      onChange={(e) => setEndereco(e.target.value)}
                      rows={3}
                      maxLength={300}
                      required
                    />
                  </>
                )}
              </div>
            </>
          )}
        </div>

        {items.length > 0 && (
          <div className="cart-footer">
            <div className="cart-total">
              <span>Total estimado</span>
              <strong>{formatCurrency(totalPrice)}</strong>
            </div>

            {erroFinalizacao && <p role="alert">{erroFinalizacao}</p>}

            {avisoPreco && (
              <p className="cart-price-warning" role="status">
                {avisoPreco}
              </p>
            )}

            <button
              type="button"
              className="cart-checkout"
              onClick={finalizarPedido}
              disabled={finalizando}
            >
              {finalizando ? "Consultando estoque..." : "Finalizar pelo WhatsApp"}
            </button>
          </div>
        )}
      </aside>
    </div>
  );
}
