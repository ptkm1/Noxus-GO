import { APP_BRAND_NAME, PRIVACY_POLICY_DOCUMENT } from "@pedidos/shared";
import { LegalDocumentView } from "../../components/LegalDocumentView";

export const metadata = {
  title: `Política de Privacidade | ${APP_BRAND_NAME}`,
  description: PRIVACY_POLICY_DOCUMENT.description,
};

export default function PrivacyPage() {
  return <LegalDocumentView document={PRIVACY_POLICY_DOCUMENT} />;
}
