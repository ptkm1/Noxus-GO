# @pedidos/design-tokens

Design system **PedixPro** partilhado entre web e mobile.

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

Web admin: preferência claro / escuro / sistema (`ThemeToggle`), padrão **claro**.

Mobile: preferência **claro / escuro / sistema** em Definições (`ThemePreferencePicker`).

## Cores principais

| Token | Light | Função |
|-------|-------|--------|
| `primary` | `#0F4C5C` (teal) | Ações, links, destaque |
| `foreground` | `#111827` (navy) | Texto |
| `border` / `accent` | `#E2E8F0` | Bordas e superfícies secundárias |
| `background` | `#F8FAFC` | Fundo app |

Tipografia: **Sora** (web).
