import {
  APP_BRAND_NAME,
  APP_BRAND_TAGLINE,
  listPlans,
  PLAN_FEATURE_LABELS,
  type PlanFeature,
} from "@pedidos/shared";
import { Suspense } from "react";
import { BrandMark } from "../components/BrandMark";
import { CheckoutForm } from "../components/CheckoutForm";

const BENEFITS: { title: string; body: string }[] = [
  {
    title: "Pedidos sob controle",
    body: "Catálogo, estoque, clientes e pedidos num fluxo único para o time de campo e o escritório.",
  },
  {
    title: "Equipe em movimento",
    body: "Rastreio, visitas e comissões quando o plano libera — sem trocar de ferramenta.",
  },
  {
    title: "Cresce com você",
    body: "Comece no essencial e evolua para fiscal NF-e, auditoria e whitelabel no Pro.",
  },
];

const FAQ: { q: string; a: string }[] = [
  {
    q: "Posso mudar de plano depois?",
    a: "Sim. O upgrade libera features na hora em que a assinatura for atualizada; o catálogo vive em um único lugar.",
  },
  {
    q: "Há período de teste?",
    a: "Novas organizações entram em trial no plano inicial. Depois você escolhe Comum, Intermediário ou Pro nesta página.",
  },
  {
    q: "O pagamento já está ativo?",
    a: "Sim. O checkout seguro é processado pelo Asaas; após a confirmação, enviamos o e-mail de ativação da conta.",
  },
];

function formatPrice(value: number): string {
  return value.toLocaleString("pt-BR", {
    style: "currency",
    currency: "BRL",
    maximumFractionDigits: 0,
  });
}

function formatLimit(n: number | null): string {
  return n == null ? "Ilimitados" : String(n);
}

function featurePreview(features: PlanFeature[]): string[] {
  return features.slice(0, 6).map((f) => PLAN_FEATURE_LABELS[f]);
}

export default function HomePage() {
  const plans = listPlans();
  const appUrl =
    process.env.NEXT_PUBLIC_APP_URL?.replace(/\/$/, "") ||
    "http://localhost:5173";

  return (
    <main>
      <header
        style={{
          position: "absolute",
          insetInline: 0,
          top: 0,
          zIndex: 10,
          padding: "1.25rem 0",
        }}
      >
        <div
          className="container"
          style={{
            display: "flex",
            alignItems: "center",
            justifyContent: "space-between",
            gap: "1rem",
          }}
        >
          <a
            href="#topo"
            style={{
              display: "inline-flex",
              alignItems: "center",
              gap: "0.65rem",
              color: "#fff",
              fontWeight: 700,
              letterSpacing: "-0.02em",
            }}
          >
            <BrandMark size={28} color="#ffffff" />
            {APP_BRAND_NAME}
          </a>
          <nav
            style={{ display: "flex", gap: "0.75rem", alignItems: "center" }}
          >
            <a
              href="#planos"
              className="btn btn-ghost"
              style={{ padding: "0.55rem 1rem", fontSize: "0.875rem" }}
            >
              Planos
            </a>
            <a
              href={`${appUrl}/login`}
              className="btn btn-outline"
              style={{
                padding: "0.55rem 1rem",
                fontSize: "0.875rem",
                background: "rgb(255 255 255 / 92%)",
              }}
            >
              Entrar
            </a>
          </nav>
        </div>
      </header>

      <section
        id="topo"
        style={{
          position: "relative",
          minHeight: "100vh",
          display: "grid",
          alignItems: "end",
          color: "#fff",
          overflow: "hidden",
          background: `
            linear-gradient(160deg, rgb(1 40 55 / 88%) 0%, rgb(2 68 92 / 72%) 45%, rgb(13 148 136 / 55%) 100%),
            radial-gradient(ellipse at 70% 20%, rgb(45 212 191 / 35%), transparent 50%),
            linear-gradient(180deg, #013447, #02445c)
          `,
        }}
      >
        <div
          aria-hidden
          style={{
            position: "absolute",
            inset: 0,
            backgroundImage:
              "radial-gradient(circle at 20% 80%, rgb(255 255 255 / 8%) 0, transparent 35%), radial-gradient(circle at 85% 60%, rgb(255 255 255 / 6%) 0, transparent 40%)",
            pointerEvents: "none",
          }}
        />
        <div
          className="container fade-up"
          style={{
            position: "relative",
            paddingBlock: "7rem 4.5rem",
            maxWidth: 720,
          }}
        >
          <p
            style={{
              margin: "0 0 1rem",
              fontSize: "clamp(2rem, 5vw, 3.25rem)",
              fontWeight: 700,
              letterSpacing: "-0.03em",
              lineHeight: 1.1,
            }}
          >
            {APP_BRAND_NAME}
          </p>
          <h1
            style={{
              margin: "0 0 1rem",
              fontSize: "clamp(1.35rem, 3vw, 1.85rem)",
              fontWeight: 600,
              lineHeight: 1.25,
              maxWidth: "18ch",
            }}
          >
            {APP_BRAND_TAGLINE}
          </h1>
          <p
            className="fade-up fade-up-delay"
            style={{
              margin: "0 0 1.75rem",
              fontSize: "1.05rem",
              opacity: 0.9,
              maxWidth: "36ch",
            }}
          >
            Pedidos, estoque e equipe de vendas em um só lugar — escolha o plano
            certo e comece hoje.
          </p>
          <div
            className="fade-up fade-up-delay-2"
            style={{ display: "flex", flexWrap: "wrap", gap: "0.75rem" }}
          >
            <a href="#planos" className="btn btn-primary">
              Ver planos
            </a>
            <a href="#checkout" className="btn btn-ghost">
              Solicitar assinatura
            </a>
          </div>
        </div>
      </section>

      <section style={{ padding: "4.5rem 0" }}>
        <div className="container">
          <h2
            style={{
              margin: "0 0 0.5rem",
              fontSize: "1.75rem",
              letterSpacing: "-0.02em",
            }}
          >
            Por que equipes escolhem o {APP_BRAND_NAME}
          </h2>
          <p
            style={{ margin: "0 0 2rem", color: "var(--muted)", maxWidth: 520 }}
          >
            Do primeiro pedido ao fechamento do mês, com o que cada plano
            libera.
          </p>
          <div
            style={{
              display: "grid",
              gap: "1.5rem",
              gridTemplateColumns: "repeat(auto-fit, minmax(240px, 1fr))",
            }}
          >
            {BENEFITS.map((b) => (
              <div key={b.title}>
                <h3 style={{ margin: "0 0 0.4rem", fontSize: "1.1rem" }}>
                  {b.title}
                </h3>
                <p
                  style={{
                    margin: 0,
                    color: "var(--muted)",
                    fontSize: "0.95rem",
                  }}
                >
                  {b.body}
                </p>
              </div>
            ))}
          </div>
        </div>
      </section>

      <section
        id="planos"
        style={{
          padding: "4.5rem 0",
          background: "var(--white)",
          borderBlock: "1px solid var(--border)",
        }}
      >
        <div className="container">
          <h2
            style={{
              margin: "0 0 0.5rem",
              fontSize: "1.75rem",
              letterSpacing: "-0.02em",
            }}
          >
            Planos
          </h2>
          <p
            style={{ margin: "0 0 2rem", color: "var(--muted)", maxWidth: 480 }}
          >
            Preços mensais em BRL. Limites de vendedores e usuários conforme o
            plano.
          </p>
          <div
            style={{
              display: "grid",
              gap: "1.25rem",
              gridTemplateColumns: "repeat(auto-fit, minmax(260px, 1fr))",
              alignItems: "stretch",
            }}
          >
            {plans.map((plan) => (
              <article
                key={plan.id}
                style={{
                  border: plan.highlighted
                    ? "2px solid var(--brand)"
                    : "1px solid var(--border)",
                  borderRadius: "var(--radius)",
                  padding: "1.5rem",
                  background: plan.highlighted
                    ? "var(--brand-soft)"
                    : "var(--surface)",
                  display: "flex",
                  flexDirection: "column",
                  gap: "1rem",
                }}
              >
                <div>
                  {plan.highlighted ? (
                    <span
                      style={{
                        display: "inline-block",
                        marginBottom: "0.5rem",
                        fontSize: "0.75rem",
                        fontWeight: 600,
                        color: "var(--brand)",
                        textTransform: "uppercase",
                        letterSpacing: "0.04em",
                      }}
                    >
                      Mais popular
                    </span>
                  ) : null}
                  <h3 style={{ margin: 0, fontSize: "1.25rem" }}>
                    {plan.name}
                  </h3>
                  <p
                    style={{
                      margin: "0.35rem 0 0",
                      color: "var(--muted)",
                      fontSize: "0.9rem",
                    }}
                  >
                    {plan.description}
                  </p>
                </div>
                <p style={{ margin: 0 }}>
                  <span
                    style={{
                      fontSize: "2rem",
                      fontWeight: 700,
                      letterSpacing: "-0.03em",
                    }}
                  >
                    {formatPrice(plan.monthlyPriceBrl)}
                  </span>
                  <span style={{ color: "var(--muted)", fontSize: "0.9rem" }}>
                    /mês
                  </span>
                </p>
                <p
                  style={{
                    margin: 0,
                    fontSize: "0.85rem",
                    color: "var(--muted)",
                  }}
                >
                  Até {formatLimit(plan.limits.maxSellers)} vendedores ·{" "}
                  {formatLimit(plan.limits.maxUsers)} usuários
                </p>
                <ul
                  style={{
                    margin: 0,
                    paddingLeft: "1.1rem",
                    fontSize: "0.9rem",
                    color: "var(--ink)",
                    flex: 1,
                  }}
                >
                  {featurePreview(plan.features).map((label) => (
                    <li key={label} style={{ marginBottom: "0.35rem" }}>
                      {label}
                    </li>
                  ))}
                </ul>
                <a
                  href={`?plan=${plan.id}#checkout`}
                  className={
                    plan.highlighted ? "btn btn-primary" : "btn btn-outline"
                  }
                  style={{ width: "100%" }}
                >
                  Escolher {plan.shortName}
                </a>
              </article>
            ))}
          </div>
        </div>
      </section>

      <section id="checkout" style={{ padding: "4.5rem 0" }}>
        <div
          className="container"
          style={{
            display: "grid",
            gap: "2rem",
            gridTemplateColumns: "repeat(auto-fit, minmax(280px, 1fr))",
            alignItems: "start",
          }}
        >
          <div>
            <h2
              style={{
                margin: "0 0 0.5rem",
                fontSize: "1.75rem",
                letterSpacing: "-0.02em",
              }}
            >
              Contratar PedixPro
            </h2>
            <p style={{ margin: 0, color: "var(--muted)", maxWidth: 420 }}>
              Escolha o plano, preencha os dados da empresa e do administrador.
              Em seguida você será redirecionado ao pagamento seguro. A senha de
              acesso é definida depois da confirmação, por e-mail.
            </p>
          </div>
          <Suspense
            fallback={
              <p style={{ color: "var(--muted)" }}>Carregando formulário…</p>
            }
          >
            <CheckoutForm />
          </Suspense>
        </div>
      </section>

      <section
        style={{
          padding: "4rem 0",
          background: "var(--white)",
          borderTop: "1px solid var(--border)",
        }}
      >
        <div className="container">
          <h2
            style={{
              margin: "0 0 1.5rem",
              fontSize: "1.5rem",
              letterSpacing: "-0.02em",
            }}
          >
            Perguntas frequentes
          </h2>
          <div style={{ display: "grid", gap: "1.25rem", maxWidth: 720 }}>
            {FAQ.map((item) => (
              <div key={item.q}>
                <h3 style={{ margin: "0 0 0.35rem", fontSize: "1rem" }}>
                  {item.q}
                </h3>
                <p
                  style={{
                    margin: 0,
                    color: "var(--muted)",
                    fontSize: "0.95rem",
                  }}
                >
                  {item.a}
                </p>
              </div>
            ))}
          </div>
        </div>
      </section>

      <section
        style={{
          padding: "3.5rem 0",
          background: "linear-gradient(135deg, #013447, #02445c 55%, #0d9488)",
          color: "#fff",
        }}
      >
        <div
          className="container"
          style={{
            display: "flex",
            flexWrap: "wrap",
            alignItems: "center",
            justifyContent: "space-between",
            gap: "1.25rem",
          }}
        >
          <div>
            <h2
              style={{
                margin: "0 0 0.4rem",
                fontSize: "1.5rem",
                letterSpacing: "-0.02em",
              }}
            >
              Pronto para organizar as vendas?
            </h2>
            <p style={{ margin: 0, opacity: 0.9, maxWidth: 420 }}>
              Escolha um plano e deixe o time focar em vender.
            </p>
          </div>
          <a href="#checkout" className="btn btn-primary">
            Começar agora
          </a>
        </div>
      </section>

      <footer
        style={{
          padding: "1.5rem 0",
          borderTop: "1px solid var(--border)",
          fontSize: "0.85rem",
          color: "var(--muted)",
        }}
      >
        <div
          className="container"
          style={{
            display: "flex",
            flexWrap: "wrap",
            justifyContent: "space-between",
            gap: "0.75rem",
          }}
        >
          <span>
            © {new Date().getFullYear()} {APP_BRAND_NAME}
          </span>
          <a href={`${appUrl}/login`}>Acessar o painel</a>
        </div>
      </footer>
    </main>
  );
}
