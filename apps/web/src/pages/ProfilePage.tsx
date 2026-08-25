import { useAuth } from "@/auth/AuthContext";
import { FormField, FormGrid } from "@/components/forms/FormLayout";
import { Avatar, AvatarFallback } from "@/components/ui/avatar";
import { Button } from "@/components/ui/button";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { apiFetch } from "@/lib/api";
import { getErrorMessage } from "@/lib/api-error";
import { notifyError, notifySuccess } from "@/lib/app-notifications";
import { staffRoleLabel, userInitials } from "@/lib/staff";
import { useEffect, useState } from "react";
import { Link } from "react-router-dom";

function ReadOnlyField({
  label,
  value,
}: {
  readonly label: string;
  readonly value: string;
}) {
  return (
    <div className="space-y-1">
      <dt className="text-xs font-medium uppercase tracking-wide text-muted-foreground">
        {label}
      </dt>
      <dd className="text-sm text-foreground">{value}</dd>
    </div>
  );
}

type ProfileForm = {
  name: string;
  email: string;
  matricula: string;
};

export function ProfilePage() {
  const { user, refreshUser } = useAuth();
  const [form, setForm] = useState<ProfileForm>({
    name: "",
    email: "",
    matricula: "",
  });
  const [pending, setPending] = useState(false);

  useEffect(() => {
    if (!user) return;
    setForm({
      name: user.name ?? "",
      email: user.email ?? "",
      matricula: user.matricula ?? "",
    });
  }, [user]);

  if (!user) {
    return (
      <p className="text-sm text-muted-foreground">Carregando perfil…</p>
    );
  }

  const role = staffRoleLabel(user);
  const initials = userInitials(form.name || user.name);

  async function onSubmit(e: { preventDefault: () => void }) {
    e.preventDefault();
    const name = form.name.trim();
    const email = form.email.trim().toLowerCase();
    if (!name) {
      notifyError("Informe o nome.", "Dados incompletos");
      return;
    }
    if (!email) {
      notifyError("Informe o e-mail.", "Dados incompletos");
      return;
    }

    setPending(true);
    try {
      await apiFetch("/auth/me", {
        method: "PATCH",
        body: JSON.stringify({
          name,
          email,
          matricula: form.matricula.trim() || null,
        }),
      });
      await refreshUser();
      notifySuccess("Perfil atualizado.");
    } catch (err) {
      notifyError(getErrorMessage(err), "Não foi possível salvar");
    } finally {
      setPending(false);
    }
  }

  return (
    <div className="mx-auto max-w-2xl space-y-6">
      <div>
        <h1 className="text-2xl font-semibold">Perfil</h1>
        <p className="mt-1 text-sm text-muted-foreground">
          Dados da sua conta nesta organização.
        </p>
      </div>

      <Card>
        <CardHeader className="flex flex-row items-center gap-4 space-y-0">
          <Avatar className="size-14">
            <AvatarFallback className="bg-primary/10 text-base font-semibold text-primary">
              {initials}
            </AvatarFallback>
          </Avatar>
          <div className="min-w-0">
            <CardTitle className="truncate text-lg">
              {form.name || user.name}
            </CardTitle>
            <CardDescription className="truncate">
              {form.email || user.email}
            </CardDescription>
          </div>
        </CardHeader>
        <CardContent className="space-y-8">
          <form className="space-y-4" onSubmit={onSubmit}>
            <FormGrid cols={2}>
              <FormField label="Nome" htmlFor="profile-name" required>
                <Input
                  id="profile-name"
                  value={form.name}
                  onChange={(e) =>
                    setForm((f) => ({ ...f, name: e.target.value }))
                  }
                  autoComplete="name"
                  disabled={pending}
                />
              </FormField>
              <FormField label="E-mail" htmlFor="profile-email" required>
                <Input
                  id="profile-email"
                  type="email"
                  value={form.email}
                  onChange={(e) =>
                    setForm((f) => ({ ...f, email: e.target.value }))
                  }
                  autoComplete="email"
                  disabled={pending}
                />
              </FormField>
              <FormField
                label="Matrícula"
                htmlFor="profile-matricula"
                hint="Opcional. Deve ser única na empresa."
              >
                <Input
                  id="profile-matricula"
                  value={form.matricula}
                  onChange={(e) =>
                    setForm((f) => ({ ...f, matricula: e.target.value }))
                  }
                  maxLength={40}
                  disabled={pending}
                />
              </FormField>
            </FormGrid>

            <div className="flex flex-wrap items-center gap-3 pt-1">
              <Button type="submit" disabled={pending}>
                {pending ? "Salvando…" : "Salvar alterações"}
              </Button>
            </div>
          </form>

          <dl className="grid gap-5 border-t border-border/60 pt-6 sm:grid-cols-2">
            <ReadOnlyField label="Papel" value={role || "—"} />
            <ReadOnlyField
              label="Empresa"
              value={user.organizationName?.trim() || "—"}
            />
            {user.teamName ? (
              <ReadOnlyField label="Equipe" value={user.teamName} />
            ) : null}
            {user.subscription?.planId ? (
              <ReadOnlyField label="Plano" value={user.subscription.planId} />
            ) : null}
          </dl>

          <p className="text-sm text-muted-foreground">
            Para alterar a senha, use{" "}
            <Link
              to="/esqueci-senha"
              className="font-medium text-primary underline-offset-4 hover:underline"
            >
              Esqueci minha senha
            </Link>
            .
          </p>
        </CardContent>
      </Card>
    </div>
  );
}
