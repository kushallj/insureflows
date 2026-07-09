import type { PipelineStage } from "@/lib/contact-fields";
import { STAGE_LABEL } from "@/lib/contact-fields";
import { cn } from "@/lib/utils";

const STAGE_CLASSES: Record<PipelineStage, string> = {
  new: "bg-stage-new text-stage-new-foreground",
  contacted: "bg-stage-contacted text-stage-contacted-foreground",
  qualified: "bg-stage-qualified text-stage-qualified-foreground",
  proposal: "bg-stage-proposal text-stage-proposal-foreground",
  won: "bg-stage-won text-stage-won-foreground",
  lost: "bg-stage-lost text-stage-lost-foreground",
};

export function StageBadge({
  stage,
  className,
}: {
  stage: PipelineStage;
  className?: string;
}) {
  return (
    <span
      className={cn(
        "inline-flex items-center rounded-full px-2 py-0.5 text-[11px] font-medium",
        STAGE_CLASSES[stage],
        className,
      )}
    >
      {STAGE_LABEL[stage]}
    </span>
  );
}
