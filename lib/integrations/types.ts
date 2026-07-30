export type IntegrationCredentialSource = "SITE" | "ENVIRONMENT" | "NONE";

export interface IntegrationCredentialStatus {
  id: string;
  label: string;
  description: string;
  configured: boolean;
  source: IntegrationCredentialSource;
  maskedKey: string | null;
  updatedAt: string | null;
  updatedBy: string | null;
}
