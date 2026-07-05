import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import test from "node:test";

const source = readFileSync(new URL("./workspace-shell.tsx", import.meta.url), "utf8");
const sop4FlowSource = readFileSync(new URL("./sop4-focused-flow-view-model.ts", import.meta.url), "utf8");
const contractTemplateSource = readFileSync(new URL("../../domain/contract-template.ts", import.meta.url), "utf8");

function componentSource(name) {
  const start = source.indexOf(`function ${name}`);
  assert.notEqual(start, -1, `${name} should exist`);
  const next = source.indexOf("\nfunction ", start + 1);
  return source.slice(start, next === -1 ? source.length : next);
}

function stageSource(stage) {
  const start = source.indexOf(`<StagePanel stage="${stage}"`);
  assert.notEqual(start, -1, `${stage} stage should exist`);
  const end = source.indexOf("</StagePanel>", start);
  assert.notEqual(end, -1, `${stage} stage should close`);
  return source.slice(start, end);
}

test("SOP4 removes the quote-contract flow card and numbered step wrappers", () => {
  const stage = stageSource("selection_quote_contract");

  assert.doesNotMatch(source, /报价合同流转/);
  assert.doesNotMatch(source, /5 个主步骤/);
  assert.doesNotMatch(stage, /<Sop4CommercialFlowOverview/);
  assert.doesNotMatch(stage, /title="1\. 工作量估算"/);
  assert.doesNotMatch(stage, /title="2\. 生成商务草稿"/);
  assert.doesNotMatch(stage, /title="3\. 报价编辑与甲方确认"/);
  assert.doesNotMatch(stage, /title="4\. 合同编辑与签署确认"/);
  assert.doesNotMatch(stage, /title="5\. 交付清单锁定"/);
});

test("SOP4 starts from workload estimate and no longer gates on template upload", () => {
  const stage = stageSource("selection_quote_contract");
  const focusedWorkspace = componentSource("Sop4FocusedWorkspace");
  const inlineDraft = componentSource("BusinessDocumentDraftInlineAction");
  const contractCard = componentSource("ContractEditorCard");
  const templateResolver = componentSource("resolveContractTemplateAsset");

  assert.match(stage, /<Sop4FocusedWorkspace/);
  assert.doesNotMatch(stage, /<WorkloadEstimateCard/);
  assert.doesNotMatch(stage, /<BusinessDocumentDraftCard/);
  assert.doesNotMatch(stage, /<QuoteEditorCard/);
  assert.doesNotMatch(stage, /<ContractEditorCard/);
  assert.doesNotMatch(stage, /<DeliveryChecklistCard/);
  assert.match(focusedWorkspace, /createSop4FocusedFlowViewModel/);
  assert.doesNotMatch(focusedWorkspace, /flow.currentTask === "upload_template"/);
  assert.doesNotMatch(focusedWorkspace, /<ContractTemplateIntakeCard/);
  assert.doesNotMatch(focusedWorkspace, /hasTemplateAsset/);
  assert.doesNotMatch(focusedWorkspace, /sop4ContractMode/);
  assert.doesNotMatch(focusedWorkspace, /flow.currentTask === "mode_selection"/);
  assert.doesNotMatch(focusedWorkspace, /<ContractModeSelectionCard/);
  assert.match(focusedWorkspace, /flow.currentTask === "workload_estimate"/);
  assert.match(focusedWorkspace, /hasWorkloadEstimate:\s*Boolean\(workloadEstimate && workloadEstimate\.status !== "generated"\)/);
  assert.match(focusedWorkspace, /flow.currentTask === "quote_confirmation"/);
  assert.match(focusedWorkspace, /<BusinessDocumentDraftInlineAction/);
  assert.doesNotMatch(focusedWorkspace, /<BusinessDocumentDraftCard/);
  assert.match(focusedWorkspace, /flow.currentTask === "contract_signing"/);
  assert.match(focusedWorkspace, /<ContractEditorCard/);
  assert.doesNotMatch(focusedWorkspace, /<ClientContractUploadCard/);
  assert.doesNotMatch(focusedWorkspace, /lockedMode/);
  assert.match(focusedWorkspace, /flow.currentTask === "delivery_checklist"/);
  assert.match(focusedWorkspace, /hasDeliveryChecklist: deliveryChecklist\?\.status === "confirmed"/);
  assert.match(focusedWorkspace, /flow.currentTask === "locked"/);
  assert.match(inlineDraft, /生成报价\/合同草稿/);
  assert.match(inlineDraft, /generateDocumentDrafts/);
  assert.match(contractCard, /合同模板解析结果/);
  assert.match(contractCard, /buildContractTemplateOutline/);
  assert.match(contractCard, /!isClientProvidedMode && \(/);
  assert.match(contractCard, /<ContractTemplateIntakeCard/);
  assert.match(templateResolver, /assets\.find\(isExplicitContractAsset\)/);
  assert.doesNotMatch(templateResolver, /buildContractAssetOptions\(assets\)\[0\]/);
  assert.doesNotMatch(sop4FlowSource, /upload_template/);
  assert.doesNotMatch(sop4FlowSource, /showTemplateOnly/);
  assert.doesNotMatch(sop4FlowSource, /hasTemplateAsset/);
  assert.doesNotMatch(sop4FlowSource, /mode_selection/);
  assert.doesNotMatch(sop4FlowSource, /sop4ContractMode/);
  assert.doesNotMatch(sop4FlowSource, /contractMode/);
  assert.match(sop4FlowSource, /progressOrder: Sop4FocusedTask\[] = \[\s*"workload_estimate"/);
  assert.match(sop4FlowSource, /function isContractConfirmed[\s\S]*return status === "signed";/);
  assert.match(source, /buildSop4ContractTemplateContent/);
  assert.match(source, /buildSop4ContractTemplateOutline/);
  assert.match(contractTemplateSource, /合同模板版本：SOP4-五板块商务模板 v1/);
});

test("SOP4 no longer persists a project-level contract mode before commercial steps", () => {
  const focusedWorkspace = componentSource("Sop4FocusedWorkspace");

  assert.doesNotMatch(source, /function ContractModeSelectionCard/);
  assert.doesNotMatch(source, /setSop4ContractMode/);
  assert.doesNotMatch(source, /sop4ContractMode/);
  assert.match(focusedWorkspace, /flow.currentTask === "contract_signing"[\s\S]*<ContractEditorCard/);
  assert.doesNotMatch(focusedWorkspace, /flow\.contractMode/);
});

test("SOP4 commercial workspace follows structured Brief-style hierarchy", () => {
  const shell = componentSource("Sop4CurrentTaskShell");
  const workloadCard = componentSource("WorkloadEstimateCard");
  const quoteCard = componentSource("QuoteEditorCard");
  const contractCard = componentSource("ContractEditorCard");
  const checklistCard = componentSource("DeliveryChecklistCard");
  const contractField = componentSource("ContractField");
  const numberField = componentSource("NumberField");

  assert.match(shell, /text-lg font-semibold tracking-tight text-\[var\(--text-primary\)\]/);
  assert.match(shell, /max-w-3xl text-sm font-medium leading-6 text-\[var\(--text-secondary\)\]/);
  assert.match(workloadCard, /核对工作量、交付版本和价格区间/);
  assert.match(workloadCard, /工作量字段/);
  assert.match(workloadCard, /text-base font-semibold tracking-tight text-\[var\(--text-primary\)\]/);
  assert.match(quoteCard, /报价标题/);
  assert.match(quoteCard, /报价状态/);
  assert.match(quoteCard, /报价备注/);
  assert.match(quoteCard, /核对明细、合计金额和报价状态/);
  assert.match(contractCard, /合同标题/);
  assert.match(contractCard, /合同状态/);
  assert.match(contractCard, /模板拆成五个填写区/);
  assert.match(contractCard, /导出正式文件/);
  assert.match(checklistCard, /核对合同级交付物；确认后锁定 SOP4 的交付承诺/);
  assert.doesNotMatch(checklistCard, /最终是否全部交付/);
  assert.match(contractField, /text-sm font-semibold tracking-tight text-\[var\(--text-secondary\)\]/);
  assert.match(numberField, /text-sm font-semibold tracking-tight text-\[var\(--text-secondary\)\]/);
});

test("SOP4 contract template upload is optional and only appears in vendor-provided mode", () => {
  const templateCard = componentSource("ContractTemplateIntakeCard");
  const contractCard = componentSource("ContractEditorCard");

  assert.match(templateCard, /可选上传我方自定义合同模板/);
  assert.match(templateCard, /使用默认模板/);
  assert.match(templateCard, /没有自定义模板时/);
  assert.match(contractCard, /!isClientProvidedMode && \([\s\S]*<ContractTemplateIntakeCard/);
  assert.match(contractCard, /isClientProvidedMode && \([\s\S]*title="甲方合同文件"/);
});

test("SOP4 contract signing supports vendor and client provided modes with proof asset gate", () => {
  const contractCard = componentSource("ContractEditorCard");
  const assetBindingPanel = componentSource("ContractAssetBindingPanel");
  const modeLabel = componentSource("contractModeLabel");

  assert.doesNotMatch(contractCard, /lockedMode/);
  assert.match(contractCard, /useState<ContractMode>\(contract\?\.mode \?\? "vendor_provided"\)/);
  assert.match(contractCard, /const isClientProvidedMode = contractMode === "client_provided"/);
  assert.match(contractCard, /disabled=\{!canEdit \|\| saving \|\| contract\?\.status === "signed"\}/);
  assert.match(contractCard, /"client_provided"/);
  assert.match(contractCard, /合同来源模式/);
  assert.match(contractCard, /甲方合同文件/);
  assert.match(contractCard, /已签署合同文件/);
  assert.match(contractCard, /signedContractAssetId/);
  assert.match(contractCard, /请先上传已签署的合同文件再标记为已签署/);
  assert.match(contractCard, /<option value="signed" disabled=\{!signedContractAssetId\}>已签约<\/option>/);
  assert.match(contractCard, /isClientProvidedMode && !selectedClientContractAssetId/);
  assert.match(contractCard, /mode: contractMode/);
  assert.match(contractCard, /signedContractAssetId: selectedSignedContractAssetId \|\| null/);
  assert.doesNotMatch(source, /function ClientContractUploadCard/);
  assert.match(assetBindingPanel, /accept="\.pdf,\.doc,\.docx,\.txt,\.md"/);
  assert.match(assetBindingPanel, /上传文件/);
  assert.match(modeLabel, /甲方出合同/);
  assert.match(modeLabel, /我方出合同/);
});

test("SOP4 delivery checklist requires explicit confirmation before advancing", () => {
  const focusedWorkspace = componentSource("Sop4FocusedWorkspace");
  const checklistCard = componentSource("DeliveryChecklistCard");

  assert.match(focusedWorkspace, /hasDeliveryChecklist: deliveryChecklist\?\.status === "confirmed"/);
  assert.match(checklistCard, /存草稿不会推进流程/);
  assert.match(checklistCard, /确认清单/);
  assert.match(checklistCard, /persistChecklist\(formData, "confirmed"\)/);
  assert.match(checklistCard, /保存为草稿/);
});

test("SOP4 workload estimate card exposes an AI draft action before manual confirmation", () => {
  const workloadCard = componentSource("WorkloadEstimateCard");
  const apiSource = readFileSync(new URL("./api.ts", import.meta.url), "utf8");

  assert.match(source, /generateWorkloadEstimateDraft/);
  assert.match(apiSource, /export async function generateWorkloadEstimateDraft/);
  assert.match(apiSource, /\/workload-estimate\/generate/);
  assert.match(workloadCard, /handleGenerateAiEstimate/);
  assert.match(workloadCard, /AI 预估/);
  assert.match(workloadCard, /根据已确认提案生成工作量草稿/);
  assert.match(workloadCard, /setGeneratingEstimate\(true\)/);
  assert.match(workloadCard, /await onRefresh\(\)/);
  assert.match(workloadCard, /name="status" value="draft"/);
  assert.match(workloadCard, /保存工作量估算/);
});
