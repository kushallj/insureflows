import { createFileRoute } from "@tanstack/react-router";
import { CampaignWizard } from "@/components/campaign-wizard";

export const Route = createFileRoute("/_app/campaigns_/new")({
  ssr: false,
  head: () => ({ meta: [{ title: "New campaign — InsureFlow" }] }),
  component: NewCampaignPage,
});

function NewCampaignPage() {
  return <CampaignWizard />;
}
