import { AddressFieldsGroup } from "@/components/AddressFieldsGroup";
import { CnpjLookupField } from "@/components/CnpjLookupField";
import { FormField, FormGrid } from "@/components/forms";
import { Button } from "@/components/ui/button";
import { Checkbox } from "@/components/ui/checkbox";
import { Input } from "@/components/ui/input";
import { cn } from "@/lib/utils";
import type {
  CnpjCompanyData,
  CustomerDocumentType,
  CustomerFormErrors,
  CustomerFormValues,
} from "@pedidos/shared";
import {
  cepDigitsOnly,
  cnpjDigitsOnly,
  cpfDigitsOnly,
  FIELD_NOT_APPLICABLE,
  formatCnpjMask,
  formatCpfMask,
  isFieldNotApplicable,
  suggestedTradeName,
} from "@pedidos/shared";

type Props = {
  values: CustomerFormValues;
  onChange: (patch: Partial<CustomerFormValues>) => void;
  showCnpjLookup?: boolean;
  errors?: CustomerFormErrors;
};

export function CustomerFormFields({
  values,
  onChange,
  showCnpjLookup = true,
  errors = {},
}: Props) {
  function setDocumentType(type: CustomerDocumentType) {
    onChange({
      documentType: type,
      cnpj: type === "CNPJ" ? values.cnpj : "",
      cpf: type === "CPF" ? values.cpf : "",
      legalName: type === "CNPJ" ? values.legalName : "",
      tradeName: type === "CNPJ" ? values.tradeName : "",
    });
  }

  function applyCnpj(data: CnpjCompanyData) {
    onChange({
      documentType: "CNPJ",
      cnpj: cnpjDigitsOnly(data.cnpj),
      legalName: data.razaoSocial ?? "",
      tradeName: data.nomeFantasia ?? "",
      name: suggestedTradeName(data),
      email: data.email ?? values.email,
      phone: data.telefone ?? values.phone,
      cep: data.cep ? cepDigitsOnly(data.cep) : values.cep,
      street: data.logradouro ?? values.street,
      number: data.numero ?? values.number,
      neighborhood: data.bairro ?? values.neighborhood,
      state: data.uf?.toUpperCase() ?? values.state,
      city: data.municipio ?? values.city,
      cityIbgeCode: data.cityIbgeCode ?? values.cityIbgeCode,
    });
  }

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap gap-2">
        {(["CNPJ", "CPF"] as const).map((type) => (
          <Button
            key={type}
            type="button"
            size="sm"
            variant={values.documentType === type ? "default" : "outline"}
            className={cn(
              values.documentType === type &&
                "bg-sidebar-primary text-sidebar-primary-foreground",
            )}
            onClick={() => setDocumentType(type)}
          >
            {type}
          </Button>
        ))}
      </div>

      {values.documentType === "CNPJ" ? (
        <>
          {showCnpjLookup ? (
            <CnpjLookupField
              buttonLabel="Buscar CNPJ"
              required
              digits={values.cnpj}
              onDigitsChange={(d) => onChange({ cnpj: d })}
              error={errors.cnpj}
              onApply={applyCnpj}
            />
          ) : (
            <FormField
              label="CNPJ"
              htmlFor="cust-cnpj"
              required
              error={errors.cnpj}
            >
              <Input
                id="cust-cnpj"
                className="font-mono"
                inputMode="numeric"
                aria-invalid={errors.cnpj ? true : undefined}
                value={formatCnpjMask(values.cnpj)}
                onChange={(e) =>
                  onChange({ cnpj: cnpjDigitsOnly(e.target.value) })
                }
              />
            </FormField>
          )}
          <FormGrid cols={2}>
            <FormField
              label="Razão social"
              htmlFor="cust-legal"
              required
              error={errors.legalName}
              className="sm:col-span-2"
            >
              <Input
                id="cust-legal"
                aria-invalid={errors.legalName ? true : undefined}
                value={values.legalName}
                onChange={(e) => onChange({ legalName: e.target.value })}
              />
            </FormField>
            <FormField
              label="Nome fantasia"
              htmlFor="cust-trade"
              required
              error={errors.tradeName}
              className="sm:col-span-2"
            >
              <Input
                id="cust-trade"
                aria-invalid={errors.tradeName ? true : undefined}
                value={values.tradeName}
                onChange={(e) => onChange({ tradeName: e.target.value })}
              />
            </FormField>
          </FormGrid>
        </>
      ) : (
        <>
          <FormField label="CPF" htmlFor="cust-cpf" required error={errors.cpf}>
            <Input
              id="cust-cpf"
              className="font-mono"
              inputMode="numeric"
              aria-invalid={errors.cpf ? true : undefined}
              placeholder="000.000.000-00"
              value={formatCpfMask(values.cpf)}
              onChange={(e) => onChange({ cpf: cpfDigitsOnly(e.target.value) })}
            />
          </FormField>
          <FormField
            label="Nome completo"
            htmlFor="cust-name"
            required
            error={errors.name}
            className="sm:col-span-2"
          >
            <Input
              id="cust-name"
              aria-invalid={errors.name ? true : undefined}
              value={values.name}
              onChange={(e) => onChange({ name: e.target.value })}
            />
          </FormField>
        </>
      )}

      <div>
        <p className="mb-3 text-sm font-semibold text-foreground">Endereço</p>
        <AddressFieldsGroup
          values={values}
          onChange={onChange}
          errors={errors}
        />
      </div>

      <FormGrid cols={2}>
        <FormField
          label="Telefone"
          htmlFor="cust-phone"
          required
          error={errors.phone}
        >
          <Input
            id="cust-phone"
            aria-invalid={errors.phone ? true : undefined}
            value={values.phone}
            onChange={(e) => onChange({ phone: e.target.value })}
          />
        </FormField>
        <FormField
          label="E-mail"
          htmlFor="cust-email"
          required
          error={errors.email}
        >
          <Input
            id="cust-email"
            type="email"
            aria-invalid={errors.email ? true : undefined}
            value={values.email}
            onChange={(e) => onChange({ email: e.target.value })}
          />
        </FormField>
        <FormField
          label="Comprador"
          htmlFor="cust-buyer"
          required
          error={errors.buyerName}
          className="sm:col-span-2"
        >
          <Input
            id="cust-buyer"
            aria-invalid={errors.buyerName ? true : undefined}
            value={values.buyerName}
            onChange={(e) => onChange({ buyerName: e.target.value })}
          />
        </FormField>
        <FormField
          label="Observação"
          htmlFor="cust-notes"
          required
          error={errors.notes}
          className="sm:col-span-2"
        >
          <div className="rounded-md border border-input bg-background overflow-hidden">
            <Input
              id="cust-notes"
              className="border-0 rounded-none shadow-none focus-visible:ring-0"
              aria-invalid={errors.notes ? true : undefined}
              disabled={isFieldNotApplicable(values.notes)}
              placeholder={
                isFieldNotApplicable(values.notes)
                  ? FIELD_NOT_APPLICABLE
                  : "Observações do cliente"
              }
              value={isFieldNotApplicable(values.notes) ? "" : values.notes}
              onChange={(e) => onChange({ notes: e.target.value })}
            />
            <label
              htmlFor="cust-notes-none"
              className="flex items-center gap-2 px-3 pb-2.5 pt-0.5 text-sm text-muted-foreground cursor-pointer"
            >
              <Checkbox
                id="cust-notes-none"
                checked={isFieldNotApplicable(values.notes)}
                onCheckedChange={(checked) => {
                  onChange({
                    notes: checked ? FIELD_NOT_APPLICABLE : "",
                  });
                }}
              />
              Não possui observação
            </label>
          </div>
        </FormField>
      </FormGrid>
    </div>
  );
}
