import { AddressFieldsGroup } from "@/components/AddressFieldsGroup";
import { CnpjLookupField } from "@/components/CnpjLookupField";
import { FormField, FormGrid } from "@/components/forms";
import { Button } from "@/components/ui/button";
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
  formatCnpjMask,
  formatCpfMask,
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
        <AddressFieldsGroup values={values} onChange={onChange} />
      </div>

      <FormGrid cols={2}>
        <FormField label="Telefone" htmlFor="cust-phone">
          <Input
            id="cust-phone"
            value={values.phone}
            onChange={(e) => onChange({ phone: e.target.value })}
          />
        </FormField>
        <FormField label="E-mail" htmlFor="cust-email" error={errors.email}>
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
          className="sm:col-span-2"
        >
          <Input
            id="cust-buyer"
            value={values.buyerName}
            onChange={(e) => onChange({ buyerName: e.target.value })}
          />
        </FormField>
        <FormField
          label="Observação"
          htmlFor="cust-notes"
          className="sm:col-span-2"
        >
          <Input
            id="cust-notes"
            value={values.notes}
            onChange={(e) => onChange({ notes: e.target.value })}
          />
        </FormField>
      </FormGrid>
    </div>
  );
}
