import { Button } from "@/components/ui/button";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import {
  SUPPORT_EMAIL,
  SUPPORT_MAILTO,
  supportWhatsAppUrl,
} from "@/lib/support";
import { BookOpen, CircleHelp, Mail, MessageCircle } from "lucide-react";
import { Link } from "react-router-dom";

export function HelpPage() {
  const whatsappUrl = supportWhatsAppUrl();

  return (
    <div className="mx-auto max-w-2xl space-y-8">
      <div className="space-y-2">
        <nav className="text-sm text-muted-foreground">
          <Link to="/" className="hover:text-foreground">
            Início
          </Link>
          <span className="mx-1.5">›</span>
          <span className="text-foreground">Ajuda</span>
        </nav>
        <div className="flex flex-wrap items-start gap-3">
          <div className="flex size-11 shrink-0 items-center justify-center rounded-lg bg-primary/10 text-primary">
            <CircleHelp className="size-5" aria-hidden />
          </div>
          <div className="min-w-0 space-y-1">
            <h1 className="text-2xl font-semibold tracking-tight text-foreground">
              Ajuda e suporte
            </h1>
            <p className="max-w-xl text-sm text-muted-foreground">
              Escolha um canal para falar com a equipe Pedix Pro. Dúvidas de
              uso também podem ser resolvidas pelo guia com videoaulas.
            </p>
          </div>
        </div>
      </div>

      <div className="grid gap-4">
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2 text-base">
              <Mail className="size-4 text-primary" aria-hidden />
              E-mail
            </CardTitle>
            <CardDescription>
              Envie dúvidas, incidentes ou solicitações para o suporte oficial.
            </CardDescription>
          </CardHeader>
          <CardContent className="flex flex-wrap items-center gap-3">
            <a
              href={SUPPORT_MAILTO}
              className="text-sm font-medium text-primary hover:underline"
            >
              {SUPPORT_EMAIL}
            </a>
            <Button variant="outline" size="sm" asChild>
              <a href={SUPPORT_MAILTO}>Abrir e-mail</a>
            </Button>
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2 text-base">
              <MessageCircle className="size-4 text-primary" aria-hidden />
              WhatsApp
            </CardTitle>
            <CardDescription>
              {whatsappUrl
                ? "Converse com o suporte pelo WhatsApp."
                : "Canal em configuração. Defina SUPPORT_WHATSAPP_E164 em lib/support.ts quando houver número oficial."}
            </CardDescription>
          </CardHeader>
          <CardContent>
            {whatsappUrl ? (
              <Button variant="outline" size="sm" asChild>
                <a href={whatsappUrl} target="_blank" rel="noopener noreferrer">
                  Abrir WhatsApp
                </a>
              </Button>
            ) : (
              <p className="text-sm text-muted-foreground">
                Enquanto isso, use o e-mail{" "}
                <span className="font-medium text-foreground">
                  {SUPPORT_EMAIL}
                </span>
                .
              </p>
            )}
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2 text-base">
              <BookOpen className="size-4 text-primary" aria-hidden />
              Guia inicial
            </CardTitle>
            <CardDescription>
              Videoaulas passo a passo para aprender o sistema no seu ritmo.
            </CardDescription>
          </CardHeader>
          <CardContent>
            <Button variant="outline" size="sm" asChild>
              <Link to="/guia">Ver videoaulas</Link>
            </Button>
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
