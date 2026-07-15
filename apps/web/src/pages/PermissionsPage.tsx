import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { apiFetch } from "@/lib/api";
import { useQuery } from "@tanstack/react-query";

type PermissionsMatrix = {
  roles: Array<{
    role: string;
    label: string;
    hasSellerProfile: boolean;
  }>;
  resources: Array<{
    resource: string;
    label: string;
    levels: Record<string, "none" | "read" | "write">;
  }>;
  notes: string[];
};

const LEVEL_LABEL: Record<string, string> = {
  none: "—",
  read: "Leitura",
  write: "Escrita",
};

export function PermissionsPage() {
  const { data, isLoading, error } = useQuery({
    queryKey: ["admin", "permissions"],
    queryFn: () => apiFetch<PermissionsMatrix>("/admin/permissions"),
  });

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-semibold">Permissões</h1>
        <p className="mt-1 text-sm text-muted-foreground">
          Matriz de roles (somente leitura). Controle efetivo no servidor.
        </p>
      </div>

      {isLoading ? (
        <p className="text-muted-foreground">Carregando…</p>
      ) : error ? (
        <p className="text-destructive">{(error as Error).message}</p>
      ) : data ? (
        <>
          <div className="surface-card overflow-x-auto">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Recurso</TableHead>
                  {data.roles.map((r) => (
                    <TableHead key={r.role}>
                      <div>{r.label}</div>
                      <div className="text-xs font-normal text-muted-foreground">
                        {r.hasSellerProfile
                          ? "Com perfil vendedor"
                          : "Sem perfil vendedor"}
                      </div>
                    </TableHead>
                  ))}
                </TableRow>
              </TableHeader>
              <TableBody>
                {data.resources.map((row) => (
                  <TableRow key={row.resource}>
                    <TableCell className="font-medium">{row.label}</TableCell>
                    {data.roles.map((r) => (
                      <TableCell key={r.role}>
                        {LEVEL_LABEL[row.levels[r.role] ?? "none"]}
                      </TableCell>
                    ))}
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </div>
          <ul className="list-disc space-y-1 pl-5 text-sm text-muted-foreground">
            {data.notes.map((n) => (
              <li key={n}>{n}</li>
            ))}
          </ul>
        </>
      ) : null}
    </div>
  );
}
