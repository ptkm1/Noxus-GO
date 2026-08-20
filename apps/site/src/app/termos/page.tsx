import { APP_BRAND_NAME, TERMS_OF_USE_DOCUMENT } from "@pedidos/shared";
import { LegalDocumentView } from "../../components/LegalDocumentView";

export const metadata = {
  title: `Termos de Uso | ${APP_BRAND_NAME}`,
  description: TERMS_OF_USE_DOCUMENT.description,
};

export default function TermsPage() {
  return <LegalDocumentView document={TERMS_OF_USE_DOCUMENT} />;
}
