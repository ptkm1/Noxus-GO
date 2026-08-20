import { AppLogo } from "@/components/layout/AppLogo";
import { Button } from "@/components/ui/button";
import { getLegalDocument } from "@pedidos/shared";
import { Link, Navigate, useParams } from "react-router-dom";

export function LegalDocumentPage() {
  const { slug } = useParams<{ slug: string }>();
  const document = getLegalDocument(slug ?? "");

  if (!document) return <Navigate to="/login" replace />;

  return (
    <div className="min-h-screen bg-background">
      <header className="sticky top-0 z-20 border-b border-border bg-card/95 backdrop-blur">
        <div className="mx-auto flex h-14 max-w-5xl items-center justify-between px-4">
          <AppLogo to="/login" />
          <Button asChild variant="outline" size="sm">
            <Link to="/login">Voltar</Link>
          </Button>
        </div>
      </header>

      <main className="mx-auto max-w-5xl px-4 py-8 md:py-12">
        <section className="mb-8 border-b border-border pb-8">
          <p className="mb-2 text-xs font-bold uppercase tracking-wide text-primary">
            Pedix Pro
          </p>
          <h1 className="text-3xl font-semibold tracking-tight md:text-4xl">
            {document.title}
          </h1>
          <p className="mt-3 max-w-3xl text-sm text-muted-foreground">
            {document.description}
          </p>
          <p className="mt-2 text-sm text-muted-foreground">
            Última atualização: {document.effectiveDate}
          </p>
        </section>

        <section className="space-y-10">
          {document.chapters.map((chapter) => (
            <section key={chapter.title} className="space-y-5">
              <h2 className="text-xl font-semibold text-foreground">
                {chapter.title}
              </h2>
              <div className="space-y-5">
                {chapter.articles.map((article) => (
                  <article key={article.id} className="space-y-2">
                    <h3 className="text-sm font-semibold text-foreground">
                      Art. {article.id}º
                      {article.title ? ` - ${article.title}` : ""}
                    </h3>
                    {article.paragraphs.map((paragraph, index) => (
                      <p
                        key={index}
                        className="text-sm leading-7 text-muted-foreground"
                      >
                        {paragraph}
                      </p>
                    ))}
                  </article>
                ))}
              </div>
            </section>
          ))}
        </section>
      </main>
    </div>
  );
}
