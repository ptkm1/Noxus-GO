import { APP_BRAND_NAME, type LegalDocument } from "@pedidos/shared";
import Link from "next/link";

type Props = {
  document: LegalDocument;
};

export function LegalDocumentView({ document }: Props) {
  return (
    <main className="legal-page">
      <section className="legal-hero">
        <Link href="/" className="legal-back">
          Voltar
        </Link>
        <p>{APP_BRAND_NAME}</p>
        <h1>{document.title}</h1>
        <span>Última atualização: {document.effectiveDate}</span>
      </section>

      <section className="legal-content">
        <p className="legal-intro">{document.description}</p>
        {document.chapters.map((chapter) => (
          <section key={chapter.title} className="legal-chapter">
            <h2>{chapter.title}</h2>
            {chapter.articles.map((article) => (
              <article key={article.id} className="legal-article">
                <h3>
                  Art. {article.id}º{article.title ? ` - ${article.title}` : ""}
                </h3>
                {article.paragraphs.map((paragraph, index) => (
                  <p key={index}>{paragraph}</p>
                ))}
              </article>
            ))}
          </section>
        ))}
      </section>
    </main>
  );
}
