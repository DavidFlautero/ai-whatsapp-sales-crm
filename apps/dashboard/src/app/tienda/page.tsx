import "./store.css";

export default function StoreLandingPage() {
  return (
    <main className="store-entry">
      <div className="store-entry-inner">
        <header className="store-entry-brand">
          <span>F</span>
          <h1>FULANITAS FÁBRICA</h1>
          <p>
            Elegí cómo querés comprar
          </p>
        </header>

        <section className="store-entry-grid">
          <a
            href="/tienda/mayorista"
            className="store-entry-card wholesale"
          >
            <span>
              PARA REVENDEDORES
            </span>

            <h2>
              Compra
              <br />
              mayorista.
            </h2>

            <p>
              Comprá directo de fábrica,
              consultá stock, curvas, packs
              y precios para tu negocio.
            </p>

            <strong>
              Entrar al catálogo mayorista
            </strong>
          </a>

          <a
            href="/tienda/minorista"
            className="store-entry-card retail"
          >
            <span>
              PARA VOS
            </span>

            <h2>
              Compra
              <br />
              minorista.
            </h2>

            <p>
              Elegí tus prendas favoritas,
              comprá por unidad y armá tu
              pedido online.
            </p>

            <strong>
              Entrar a la tienda
            </strong>
          </a>
        </section>
      </div>
    </main>
  );
}
