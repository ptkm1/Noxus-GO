# @pedidos/design-tokens

Design system **VendaForce** partilhado entre web e mobile.

## Uso

### Web (Tailwind v4)

Tokens em CSS em `apps/web/src/index.css` (`:root`, `@theme inline`). Classes semânticas:

- `bg-background`, `bg-card`, `bg-primary`, `text-muted-foreground`
- `border-border`, `text-success`, `text-warning`, `text-destructive`
- Sidebar: `bg-sidebar`, `text-sidebar-foreground`, `bg-sidebar-primary`

### Mobile (React Native)

```ts
import { appColorsLight, appColorsDark } from "@pedidos/design-tokens";
```

`apps/mobile/lib/theme/tokens.ts` mapeia para `AppColors` via `ThemeProvider`.

## Ativar no ambiente

Web admin usa tema escuro fixo (`class="dark"` em `index.html`).

Mobile: preferência **claro / escuro / sistema** em Definições (`ThemePreferencePicker`).

## Cores principais

| Token | Dark (web) | Função |
|-------|------------|--------|
| `primary` | Verde esmeralda `oklch(0.72 0.19 160)` | Ações, links, destaque |
| `background` | `oklch(0.13 0.01 260)` | Fundo app |
| `card` | `oklch(0.17 0.01 260)` | Superfícies elevadas |

Light mobile usa fundos claros com o mesmo `primary` esmeralda.
