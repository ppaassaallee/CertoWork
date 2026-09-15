import type { FlowModel, FlowNodeType } from "./flowModel";
import "./flow.css";

const TYPE_CLASS: Partial<Record<FlowNodeType, string>> = {
  prepare: "is-prepare",
  step: "is-step",
  decision: "is-decision",
  deliver: "is-deliver",
  trigger: "is-step",
  action: "is-step",
  chain: "is-decision",
};

export function FlowMini({
  model,
  max = 8,
}: {
  model: FlowModel;
  max?: number;
}) {
  const nodes = model.nodes.slice(0, max);
  return (
    <span className="cw-flow-mini" aria-hidden="true" data-testid="flow-mini">
      {nodes.map((node) => (
        <span className={TYPE_CLASS[node.type] || ""} key={node.id} title={node.title} />
      ))}
    </span>
  );
}
