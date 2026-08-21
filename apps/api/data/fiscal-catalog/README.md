# Catálogo fiscal oficial (Pedix Pro)

Arquivos JSON importados para a tabela `FiscalCatalogCode`.

## Formato interno

```json
{
  "type": "NCM",
  "sourceVersion": "TIPI-YYYY-MM",
  "entries": [
    { "code": "22060090", "description": "...", "validFrom": null, "validTo": null }
  ]
}
```

## Tabela NCM oficial (Receita / TIPI)

Também é aceito o JSON da tabela vigente, no formato:

```json
{
  "Data_Ultima_Atualizacao_NCM": "Vigente em 20/08/2026",
  "Ato": "Resolução Gecex nº 926/2026",
  "Nomenclaturas": [{ "Codigo": "2206.00.90", "Descricao": "...", "Data_Inicio": "01/04/2022", "Data_Fim": "31/12/9999" }]
}
```

Só códigos com **8 dígitos** entram como NCM selecionável na NF-e (capítulos/posições de 2–6 dígitos são ignorados).

Arquivo atual: `ncm.json` (tabela vigente 20/08/2026).

## CFOP

Fonte: CONFAZ, Ajuste SINIEF 03/24 (efeitos a partir de 01.06.2024), Anexo II do Convênio s/nº de 1970. Arquivo: `cfop.json`.

## CEST

Fonte: CONFAZ, Convênio ICMS 142/2018 (anexos). Arquivo: `cest.json`. Relaciona NCM quando o anexo informa.

## CST / CSOSN / Origem / CST PIS

Tabelas fechadas do Manual de Integração da NF-e / EFD (não são listas abertas).

## CBS / IBS / Classificação tributária (Reforma)

Não há arquivos `cbs.json` / `ibs.json` / `class_trib.json` neste repositório até existir publicação oficial estável para importação. A estrutura do banco e da API já aceita esses tipos.

Não invente códigos. Só importe dados de fontes oficiais versionadas.