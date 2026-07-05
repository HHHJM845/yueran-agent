export type Sop4FocusedTask =
  | "workload_estimate"
  | "quote_confirmation"
  | "contract_signing"
  | "delivery_checklist"
  | "locked";

export type Sop4FocusedFlowInput = {
  hasWorkloadEstimate: boolean;
  quoteStatus: string | null;
  contractStatus: string | null;
  hasDeliveryChecklist: boolean;
};

export type Sop4ProgressNodeView = {
  key: Sop4FocusedTask;
  label: string;
  status: "completed" | "current" | "upcoming";
};

export type Sop4FocusedFlowView = {
  currentTask: Sop4FocusedTask;
  title: string;
  summary: string;
  progressNodes: Sop4ProgressNodeView[];
};

const taskLabels: Record<Sop4FocusedTask, string> = {
  workload_estimate: "估算",
  quote_confirmation: "报价",
  contract_signing: "合同",
  delivery_checklist: "清单",
  locked: "锁定",
};

const taskTitles: Record<Sop4FocusedTask, string> = {
  workload_estimate: "工作量估算生成商务草稿",
  quote_confirmation: "报价编辑与甲方确认",
  contract_signing: "合同编辑和签署",
  delivery_checklist: "确认交付清单",
  locked: "SOP4 已锁定",
};

const taskSummaries: Record<Sop4FocusedTask, string> = {
  workload_estimate: "基于当前项目范围核对工作量和建议价格区间，保存后进入报价确认。",
  quote_confirmation: "编辑报价并完成甲方确认。报价未确认前，不进入合同编辑。",
  contract_signing: "引用已确认报价编辑合同，保存版本并推进签署确认。",
  delivery_checklist: "根据合同承诺核对交付物，保存后锁定 SOP4。",
  locked: "报价、合同和交付清单已具备进入脚本、人物/场景设定与文字分镜确认的条件。",
};

const progressOrder: Sop4FocusedTask[] = [
  "workload_estimate",
  "quote_confirmation",
  "contract_signing",
  "delivery_checklist",
];

export function createSop4FocusedFlowViewModel(input: Sop4FocusedFlowInput): Sop4FocusedFlowView {
  const currentTask = resolveCurrentTask(input);

  return {
    currentTask,
    title: taskTitles[currentTask],
    summary: taskSummaries[currentTask],
    progressNodes: buildProgressNodes(currentTask),
  };
}

function resolveCurrentTask(input: Sop4FocusedFlowInput): Sop4FocusedTask {
  if (!input.hasWorkloadEstimate) return "workload_estimate";
  if (!isQuoteConfirmed(input.quoteStatus)) return "quote_confirmation";
  if (!isContractConfirmed(input.contractStatus)) return "contract_signing";
  if (!input.hasDeliveryChecklist) return "delivery_checklist";
  return "locked";
}

function buildProgressNodes(currentTask: Sop4FocusedTask): Sop4ProgressNodeView[] {
  const currentIndex = currentTask === "locked" ? progressOrder.length - 1 : progressOrder.indexOf(currentTask);

  return progressOrder.map((key, index) => ({
    key,
    label: currentTask === "locked" && key === "delivery_checklist" ? "清单/锁定" : taskLabels[key],
    status: index < currentIndex ? "completed" : index === currentIndex ? "current" : "upcoming",
  }));
}

function isQuoteConfirmed(status: string | null) {
  return status === "confirmed" || status === "signed";
}

function isContractConfirmed(status: string | null) {
  return status === "signed";
}
