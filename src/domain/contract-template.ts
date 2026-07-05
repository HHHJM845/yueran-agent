export type Sop4ContractTemplateFields = {
  partyAName: string;
  partyBName: string;
  projectName: string;
  quoteTitle: string;
  quoteTotalAmount: number;
  quoteCurrency: string;
  deliveryScope: string;
  paymentTerms: string;
  effectiveDate: string;
};

export type Sop4ContractTemplateOutlineItem = {
  title: string;
  detail: string;
};

export function buildSop4ContractTemplateContent(input: { title: string } & Sop4ContractTemplateFields) {
  const quoteTitle = input.quoteTitle || "待确认报价";

  return [
    input.title,
    "",
    "合同模板版本：SOP4-五板块商务模板 v1",
    "模板说明：本模板根据 SOP 4 的五个业务板块生成，所有金额、交付范围、签署状态和锁定结论均以系统保存版本为准。",
    "",
    `甲方：${input.partyAName}`,
    `乙方：${input.partyBName}`,
    `项目名称：${input.projectName}`,
    `关联报价：${quoteTitle}`,
    `报价金额：${formatContractMoney(input.quoteTotalAmount, input.quoteCurrency)}`,
    `生效日期：${input.effectiveDate}`,
    "",
    "一、工作量估算生成商务草稿",
    "1. 双方确认，本项目的工作量估算包含角色、场景、镜头、图片、视频数量、修改轮次、交付版本和复杂度判断。",
    "2. 工作量估算用于形成商务草稿与报价依据；最终承诺以本合同、已确认报价和交付清单为准。",
    "3. 如估算依据发生变化，应登记需求变更，并重新确认交付范围、周期和费用。",
    "",
    "二、报价编辑与甲方确认",
    `1. 本合同引用的报价为：${quoteTitle}。`,
    `2. 报价金额为：${formatContractMoney(input.quoteTotalAmount, input.quoteCurrency)}。`,
    "3. 报价包含的服务范围、修改轮次、第三方费用排除项和备注，以系统保存的报价版本为准。",
    "4. 甲方确认报价后，合同进入合同编辑与签署环节。",
    "",
    "三、合同编辑和签署",
    "1. 甲乙双方确认合同主体、项目名称、交付范围、付款条款和补充约定如下。",
    `2. 交付范围：${input.deliveryScope}`,
    `3. 付款条款：${input.paymentTerms}`,
    `4. 生效日期：${input.effectiveDate}`,
    "5. 合同签署后，双方按本合同及系统保存快照执行；未签署前不得视为正式开工依据。",
    "",
    "四、确认交付清单",
    "1. 本合同交付清单用于锁定“承诺交付什么”，包括但不限于横版成片、竖版成片、无字幕版、封面图、项目文件、生成素材及其他约定版本。",
    "2. 交付清单应在签署前完成核对并保存版本；签署后新增或减少交付物应登记需求变更。",
    "3. 最终交付核对在 B-copy 定稿确认与结算归档阶段完成。",
    "",
    "五、锁定",
    "1. 当报价、合同正文、签署状态和交付清单均确认后，SOP 4 视为锁定。",
    "2. SOP 4 锁定后，项目进入脚本、人物/场景设定与文字分镜确认环节。",
    "3. 锁定后如需变更范围、费用或周期，应通过需求变更流程记录原因、影响和确认结果。",
  ].join("\n");
}

export function buildSop4ContractTemplateOutline(source: string): Sop4ContractTemplateOutlineItem[] {
  return [
    {
      title: "工作量估算生成商务草稿",
      detail: `${source} 将承接项目范围、制作数量、复杂度和建议报价区间；保存估算后可生成商务草稿。`,
    },
    {
      title: "报价编辑与甲方确认",
      detail: "报价明细、总价、币种、备注和甲方确认状态需要人工填写并保存版本。",
    },
    {
      title: "合同编辑和签署",
      detail: "合同主体、甲乙方、付款条款、交付范围和正文会进入合同快照，并支持 PDF / Word 导出。",
    },
    {
      title: "确认交付清单",
      detail: "按合同承诺拆出横版、竖版、封面、项目文件和生成资产等交付物，签约前核对保存。",
    },
    {
      title: "锁定",
      detail: "报价、合同和交付清单确认后，签署状态会推动项目进入脚本、人物场景和文字分镜环节。",
    },
  ];
}

export function formatContractMoney(amount: number, currency: string) {
  return `${currency} ${amount.toLocaleString("zh-CN", { maximumFractionDigits: 2 })}`;
}
