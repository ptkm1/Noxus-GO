import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { GUIDE_LESSONS } from "@/lib/guide-lessons";
import { BookOpen, ExternalLink, Play } from "lucide-react";
import { Link } from "react-router-dom";

export function GuidePage() {
  return (
    <div className="mx-auto max-w-4xl space-y-8">
      <div className="space-y-2">
        <nav className="text-sm text-muted-foreground">
          <Link to="/" className="hover:text-foreground">
            Início
          </Link>
          <span className="mx-1.5">›</span>
          <span className="text-foreground">Guia inicial</span>
        </nav>
        <div className="flex flex-wrap items-start gap-3">
          <div className="flex size-11 shrink-0 items-center justify-center rounded-lg bg-primary/10 text-primary">
            <BookOpen className="size-5" aria-hidden />
          </div>
          <div className="min-w-0 space-y-1">
            <h1 className="text-2xl font-semibold tracking-tight text-foreground">
              Guia inicial
            </h1>
            <p className="max-w-2xl text-sm text-muted-foreground">
              Videoaulas passo a passo para usar o Pedix Pro. Os vídeos abaixo
              estão preparados para receber as URLs oficiais — até lá, use a
              estrutura como referência do conteúdo.
            </p>
          </div>
        </div>
      </div>

      <ul className="space-y-4">
        {GUIDE_LESSONS.map((lesson, index) => {
          const hasVideo = Boolean(lesson.videoUrl);
          const hasLink = Boolean(lesson.externalUrl);
          return (
            <li key={lesson.id}>
              <Card>
                <CardHeader className="flex flex-row items-start gap-4 space-y-0 pb-3">
                  <span className="flex size-8 shrink-0 items-center justify-center rounded-md bg-muted text-sm font-semibold text-muted-foreground">
                    {index + 1}
                  </span>
                  <div className="min-w-0 flex-1 space-y-1">
                    <div className="flex flex-wrap items-center gap-2">
                      <CardTitle className="text-base">{lesson.title}</CardTitle>
                      <Badge variant="secondary">{lesson.durationLabel}</Badge>
                      {!hasVideo && !hasLink ? (
                        <Badge variant="outline">Em breve</Badge>
                      ) : null}
                    </div>
                    <CardDescription>{lesson.description}</CardDescription>
                  </div>
                </CardHeader>
                <CardContent className="space-y-3 pl-13">
                  {hasVideo ? (
                    <div className="aspect-video overflow-hidden rounded-md border border-border bg-muted">
                      <iframe
                        title={lesson.title}
                        src={lesson.videoUrl!}
                        className="size-full"
                        allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture"
                        allowFullScreen
                      />
                    </div>
                  ) : (
                    <div className="flex aspect-video flex-col items-center justify-center gap-2 rounded-md border border-dashed border-border bg-muted/40 text-muted-foreground">
                      <Play className="size-8 opacity-50" aria-hidden />
                      <p className="text-sm">Vídeo em preparação</p>
                      <p className="max-w-xs text-center text-xs">
                        Quando a aula estiver pronta, preencha{" "}
                        <code className="rounded bg-muted px-1 py-0.5 text-[11px]">
                          videoUrl
                        </code>{" "}
                        em{" "}
                        <code className="rounded bg-muted px-1 py-0.5 text-[11px]">
                          guide-lessons.ts
                        </code>
                        .
                      </p>
                    </div>
                  )}
                  {hasLink ? (
                    <Button variant="outline" size="sm" asChild>
                      <a
                        href={lesson.externalUrl!}
                        target="_blank"
                        rel="noopener noreferrer"
                      >
                        <ExternalLink className="size-4" />
                        Abrir aula
                      </a>
                    </Button>
                  ) : null}
                </CardContent>
              </Card>
            </li>
          );
        })}
      </ul>

      <p className="text-sm text-muted-foreground">
        Precisa de ajuda agora?{" "}
        <Link to="/ajuda" className="font-medium text-primary hover:underline">
          Fale com o suporte
        </Link>
        .
      </p>
    </div>
  );
}
