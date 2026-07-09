import { createFileRoute, Link } from "@tanstack/react-router";
import { useQuery } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { getCampaign } from "@/lib/campaigns.functions";
import { CampaignWizard } from "@/components/campaign-wizard";

export const Route = createFileRoute("/_app/campaigns_/$id/edit")({
  ssr: false,
  head: () => ({ meta: [{ title: "Edit campaign — InsureFlow" }] }),
  component: EditCampaignPage,
});

function EditCampaignPage() {
  const { id } = Route.useParams();
  const getFn = useServerFn(getCampaign);
  const q = useQuery({
    queryKey: ["campaigns", id],
    queryFn: () => getFn({ data: { id } }),
  });

  if (q.isLoading) return <p className="text-sm text-muted-foreground p-6">Loading…</p>;
  if (!q.data)
    return (
      <div className="p-6">
        <p className="text-sm">Campaign not found.</p>
        <Link to="/campaigns" className="text-sm text-primary underline">Back to campaigns</Link>
      </div>
    );
  return <CampaignWizard initial={q.data} campaignId={id} />;
}
