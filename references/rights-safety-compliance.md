# 权利、安全与合规

> 本文件提供制作治理清单和风险路由，不构成法律意见，也不替代目标地区律师、平台审核、保险方、安全指导或主管机关的判断。法律、平台规则和模型条款会变化；始终加载目标地区与平台的当前版本，并保留核验记录。

## 目录

- [使用时机](#使用时机)
- [强制工作流](#强制工作流)
- [Rights Manifest](#rights-manifest)
- [证据与状态](#证据与状态)
- [最严格约束合并](#最严格约束合并)
- [权利继承与撤回](#权利继承与撤回)
- [专项检查](#专项检查)
- [现场与生成安全](#现场与生成安全)
- [AIGC 标识](#aigc-标识)
- [C2PA 内容凭证](#c2pa-内容凭证)
- [隐私与敏感证据处理](#隐私与敏感证据处理)
- [阻断与升级规则](#阻断与升级规则)
- [输出要求](#输出要求)

## 使用时机

在出现以下任一情况时加载本文件：

- 使用外部剧本、音乐、图片、视频、字体、商标或影视素材。
- 使用真人肖像、声音、表演、动作参考或数字替身。
- 涉及未成年人、公众人物、真实事件、私人场所或公共空间拍摄。
- 涉及生物特征、身份识别、敏感个人信息或跨境数据处理。
- 涉及武器、车辆、火焰、水下、高空、动物、群演或特技。
- 输出将公开、商业化、投放广告或提交平台审核。
- 使用生成式模型制作、编辑或传播视听内容。

不要仅因素材“可下载”“可搜索”“由用户提供”或“已经生成”就推定拥有使用权。

## 强制工作流

1. 记录目标地区、受众地区、发布平台、商业用途和预计发布日期。
2. 为每一项权利主体建立独立 `rights_subject_id`，不要只给媒体文件建记录。
3. 将剧本权、演员同意、场地许可、商标许可等非媒体权利纳入 Manifest。
4. 为每项权利附上可核验的授权证据、版本、有效期和证据哈希。
5. 区分所有权、许可证、同意、场地许可、平台条款和法定例外；不要混写。
6. 将上游限制传播到 Generation Task、Take、Attempt、Media Asset、Timeline Clip 和 Final Export。
7. 对多来源合成执行“最严格约束合并”。
8. 对真人拍摄和高风险动作执行独立安全审查。
9. 按地区与平台检查 AIGC 标识、广告披露、年龄分级和敏感内容规则。
10. 在最终导出前重新检查到期、撤回、删除请求和平台条款变化。

使用以下状态：

| 状态 | 含义 | 是否允许进入最终导出 |
|---|---|---|
| `cleared` | 证据完整，范围覆盖当前用途 | 允许 |
| `conditional` | 仅在满足署名、地区、平台或技术条件后允许 | 条件满足后允许 |
| `pending` | 正在核验或等待授权 | 不允许 |
| `unknown` | 无法确认权利或规则 | 不允许 |
| `expired` | 授权已过期 | 不允许 |
| `withdrawn` | 同意或许可已撤回 | 不允许 |
| `restricted` | 当前用途不在许可范围内 | 不允许 |
| `blocked` | 存在明确冲突或禁止 | 不允许 |
| `counsel_review` | 需要专业法律判断 | 不允许自动放行 |

## Rights Manifest

为每个权利主体使用以下最小契约。Schema 可以增加字段，但不得删除这些语义。

```yaml
rights_subject_id: rights-0001
subject_type: script | adaptation | performance | likeness | voice | digital_replica |
  minor_guardian | location | music_composition | sound_recording | sound_effect |
  image | video | font | trademark | artwork | archival_material |
  reference_asset | model_input | model_output | privacy_data | biometric_data
subject_name:
related_asset_ids: []
related_person_ids: []
related_location_ids: []
upstream_rights_subject_ids: []

rights_basis:
  basis_type: ownership | license | consent | release | permit | public_domain |
    statutory_exception | platform_terms | unknown
  owner_or_grantor:
  licensee_or_recipient:
  agreement_id:
  agreement_version:
  signed_at:
  effective_at:
  expires_at:
  source_url:

permissions:
  commercial_use: allowed | prohibited | unknown
  derivative_use: allowed | prohibited | unknown
  ai_training: allowed | prohibited | unknown
  ai_reference_input: allowed | prohibited | unknown
  ai_generation_or_transformation: allowed | prohibited | unknown
  voice_clone_or_synthesis: allowed | prohibited | unknown
  digital_replica: allowed | prohibited | unknown
  advertising_use: allowed | prohibited | unknown
  sublicensing: allowed | prohibited | unknown
  edit_or_crop: allowed | prohibited | unknown

scope:
  purposes: []
  platforms: []
  media: []
  territories: []
  languages: []
  audience_limits: []
  exclusivity: exclusive | nonexclusive | unknown

obligations:
  attribution_required: false
  attribution_texts: []
  approval_required: false
  approval_contact:
  approval_status:
  disclosure_requirements: []
  takedown_requirements: []
  deletion_deadline_days:
  royalty_or_fee_terms:

privacy:
  personal_data_present: false
  sensitive_data_present: false
  biometric_data_present: false
  purpose_limitation: []
  storage_regions: []
  retention_until:
  access_roles: []
  transfer_restrictions: []
  withdrawal_process:
  deletion_process:

evidence:
  evidence_type:
  evidence_uri:
  evidence_hash_algorithm: sha256
  evidence_hash:
  verified_by:
  verified_at:
  verification_method:

governance:
  status: pending
  target_region_profiles: []
  platform_terms_versions: []
  regional_rule_versions: []
  last_reviewed_at:
  next_review_at:
  notes:
```

不要在 Manifest 中存储不必要的身份证号码、家庭住址、完整合同正文或未脱敏证件。优先保存受控证据引用、哈希和核验结论。

## 证据与状态

按以下顺序验证证据：

1. 确认授权人或机构有权授予该项权利。
2. 确认被授权主体、作品、人物、场地或素材准确匹配。
3. 确认用途覆盖商业发布、广告、AI 参考、AI 转化、数字替身或声音合成等实际行为。
4. 确认地区、平台、语言、期限和受众范围覆盖当前项目。
5. 确认署名、审核、版税、标识、删除和撤回义务可以执行。
6. 计算证据文件哈希，记录核验时间和核验人。
7. 将任何含糊、缺页、过期、签署主体不明或权限范围不清的记录设为 `pending`、`unknown` 或 `counsel_review`。

不得将下列内容单独视为充分授权：

- 网页上没有版权声明。
- 搜索引擎结果、社交媒体转发或截图。
- “仅供学习”“非商业使用”但项目实际商业发布。
- 模型已经成功接受输入。
- 供应商允许生成，但上游素材权利未知。
- 演员同意出镜，但没有同意声音克隆或数字替身。
- 监护人同意拍摄，但没有覆盖投放地区、期限或敏感场景。

## 最严格约束合并

合成、混剪、训练参考或派生输出涉及多个上游时，使用以下合并规则。任何字段为 `unknown` 都不得被其他来源的宽松许可覆盖。

```text
merge(rights_1 ... rights_n) -> effective_rights
```

| 约束 | 合并算法 |
|---|---|
| 允许地域 | 取集合交集；交集为空即阻断 |
| 允许平台、媒介、用途、语言、受众 | 分别取集合交集 |
| 有效期限 | 取最晚生效日与最早到期日组成的交集 |
| 商用、改编、AI 输入、AI 转化、声音合成、数字替身 | 使用逻辑 AND；任一禁止或未知即不允许 |
| 署名 | 合并全部必需署名，不得互相抵消 |
| 审批 | 只要一项要求审批，就必须完成该项审批 |
| 版税或费用 | 累积所有兼容义务；冲突时升级人工处理 |
| 数据保存 | 采用最短允许保存期限 |
| 删除或撤回 SLA | 采用最短处理期限 |
| 存储地区 | 取允许地区交集 |
| 访问角色 | 取满足所有上游限制的最小权限集合 |
| 年龄、内容等级和受众限制 | 采用最严格限制 |
| 平台披露与 AIGC 标识 | 合并全部适用要求 |

执行合并时：

1. 记录所有上游 `rights_subject_id`。
2. 生成可重放的合并报告，逐字段列出输入、规则和结果。
3. 保留冲突，不要用自由文本“综合判断”覆盖结构化禁止。
4. 禁止通过改名、转码、裁切、合成或重新生成来清除上游限制。
5. 将未成年人、肖像、声音、隐私和生物特征限制视为不可被其他许可稀释的独立约束。
6. 在交集为空、义务互相冲突或无法技术执行时阻断 Composite Recipe 与 Final Export。

## 权利继承与撤回

传播以下谱系：

```text
Rights Subject / Consent / Permit / License
→ Reference Asset or Live Production Input
→ Generation Task or Camera Take
→ Generation Attempt
→ Media Asset
→ Composite Recipe
→ Timeline Clip
→ Final Export
```

对每个下游对象保存：

```yaml
effective_rights_subject_ids: []
rights_merge_report_id:
rights_status:
rights_checked_at:
```

收到撤回、到期、下架或删除要求时：

1. 将源权利状态改为 `withdrawn`、`expired` 或 `restricted`。
2. 沿谱系查找全部下游对象。
3. 阻断新的生成、渲染和发布。
4. 对已发布版本执行项目政策与适用规则要求的下架、替换或法律升级。
5. 记录处理时间、负责人、影响资产和完成证据。
6. 不要仅删除源文件而保留下游派生物。

## 专项检查

### 剧本、改编与真实事件

- 确认原剧本所有权、改编权、续作权和商业发行范围。
- 区分公共领域事实与受保护的具体表达。
- 对真实人物、真实案件、隐私、名誉和误导性再现升级地区专项审核。
- 不要因“根据真实故事改编”就推定可以使用姓名、形象、病史、住址或私人通信。

### 肖像、表演、声音与数字替身

- 分别取得出镜、录音、剪辑、配音、声音合成、声音克隆、面部替换和数字替身授权。
- 明确用途、角色、台词范围、地区、期限、平台和是否允许广告使用。
- 禁止将普通表演授权自动扩展为声音克隆或数字替身授权。
- 对公众人物、已故人物和高度相似的仿冒形象加载地区专项规则。
- 在输出可能误导观众认为真人说过或做过某事时，要求清晰披露并升级审核。

### 未成年人

- 记录监护关系和监护人授权证据。
- 检查劳动、工时、教育、收入托管、隐私、广告和平台年龄规则。
- 禁止收集超出制作必要范围的身份、学校、住址、健康或家庭信息。
- 对危险动作、成人化表演、羞辱、裸露、性暗示和高强度情绪场景直接升级安全与法律审核。
- 不要让生成内容规避本应适用的儿童安全要求。

### 场地与公共空间

- 确认场地所有者许可、拍摄时段、人数、设备、噪声、无人机、布景、烟火和保险要求。
- 检查公共空间许可、路权、交通控制、第三人肖像和可见商标。
- 记录限制区域、撤场要求、恢复原状和场地损害责任。

### 音乐、录音与音效

- 分别检查词曲权、录音版权、同步权、母带使用权、表演权和平台音乐库条款。
- 不要把“免版税”理解为“无条件、无署名、永久、可转授权”。
- 对 AI 生成音乐记录供应商条款、训练/参考输入权利和相似性风险。
- 对可识别采样、翻唱、改编或风格模仿升级人工审核。

### 商标、产品与艺术品

- 区分偶然入镜、编辑性使用、广告性使用和暗示背书。
- 对品牌为剧情核心、负面描绘、仿冒包装或投放广告的情况升级审核。
- 检查海报、雕塑、画作、建筑设计和屏幕内容等嵌套作品。
- 不要用模糊、遮挡或生成替换作为自动法律清除手段。

### 隐私与生物特征

- 将人脸模板、声纹、虹膜、步态和用于身份识别的特征标记为潜在生物特征数据。
- 明确处理目的、合法依据、告知、同意、存储地区、保留期限、访问控制和删除流程。
- 使用最少数据；能用非识别参考就不要保存身份模板。
- 禁止把制作素材转用于模型训练、身份识别或新的商业用途，除非取得独立授权。
- 对跨境传输、敏感个人信息、儿童数据和大规模识别处理升级地区专项审核。

## 现场与生成安全

分别评估真人现场风险和生成内容传播风险。

### 真人现场

对以下项目要求合格负责人、风险评估、保险和应急方案：

- 武器、仿真武器、爆炸物和烟火。
- 车辆、道路封控、追逐和特技驾驶。
- 火焰、烟雾、高温、电气和易燃材料。
- 高空、吊挂、坠落、楼顶和临边作业。
- 水下、开放水域、雨戏和湿滑环境。
- 动物、儿童、群演、拥挤空间和夜间外景。
- 打斗、亲密戏、裸露、血浆、破坏效果和危险道具。

不要让分镜用“演员自行完成”“后期处理”替代具体安全方案。无法安全实拍时，改用生成、合成、替身、插入镜头或声音方案。

### 生成内容

- 检查是否生成违法、危险示范、仇恨、性剥削、未成年人伤害或误导性身份内容。
- 检查供应商使用政策和目标平台规则。
- 对逼真公众人物、新闻式画面、医疗/金融/法律陈述和灾难事件增加披露与事实审核。
- 不要将“纯生成”视为不存在伤害、名誉、隐私或平台风险。

## AIGC 标识

不要建立一套全球通用标识规则。按目标地区、平台、内容类型和发布时间加载版本化 Profile。

面向中国发布时：

- 检查《人工智能生成合成内容标识办法》及配套要求的当前版本。
- 分别检查显式标识、文件或元数据中的隐式标识、平台传播义务和用户声明。
- 记录适用规则版本、核验日期、实施方式和导出验证结果。
- 不要把中国规则直接外推到其他地区。

对所有地区：

- 检查平台是否要求 AI 标签、合成内容披露、广告披露或公众人物提示。
- 确保转码、剪辑、截图和二次上传不会无意丢失必需标识。
- 将披露文字、位置、持续时间、语言和元数据要求写入 Final Export Profile。
- 若规则不清或平台入口与公开文档不一致，设为 `counsel_review` 或 `platform_review`。

## C2PA 内容凭证

可使用 C2PA 记录来源、生成与编辑链，但不要声称 C2PA 能证明内容真实、合法或已取得全部权利。

执行时：

1. 固定所采用的 C2PA 规范版本。
2. 记录生成工具、编辑步骤、输入资产引用、签名主体和断言。
3. 在转码、合成和导出时验证凭证是否保留。
4. 记录凭证丢失、签名无效或链不完整的原因。
5. 将 C2PA Manifest 与项目 Rights Manifest 分开：前者记录来源声明，后者记录许可与同意。
6. 不要把内容凭证当作授权合同、事实核查或版权登记。

## 隐私与敏感证据处理

- 只保存完成制作、核验和审计所必需的数据。
- 将授权证据与公开制作资产分开存储。
- 对合同、证件、联系方式、儿童信息和生物特征信息实行最小权限访问。
- 为每类数据设置保留期限、删除责任人和撤回流程。
- 使用哈希或受控 URI 指向证据，不要在普通分镜表中复制敏感正文。
- 不要把私密证据发送给不需要访问的模型、子 Agent 或第三方服务。
- 在输出给用户或评审时默认脱敏。

## 阻断与升级规则

出现以下任一情况时阻断最终导出：

- 必需权利状态为 `pending`、`unknown`、`expired`、`withdrawn`、`restricted` 或 `blocked`。
- 多来源许可交集为空或义务冲突。
- 缺少未成年人监护授权、数字替身授权或声音克隆授权。
- 隐私或生物特征处理目的、保存期限、访问控制或删除流程缺失。
- 高风险实拍没有合格安全负责人和可执行方案。
- AIGC 标识或平台披露要求无法确认或无法技术实现。
- 证据无法匹配主体、用途、地区、期限或版本。

以下情况必须升级专业法律或平台审核，不得自动批准：

- 依赖合理使用、法定例外、新闻价值、戏仿或公共利益。
- 公众人物、真实案件、诽谤、隐私、误导性数字替身。
- 儿童敏感内容、跨境生物特征数据或大规模身份识别。
- 许可条款含糊、权利链断裂、多个地区规则冲突。
- 商标背书、政治广告、医疗/金融/法律高风险陈述。

## 输出要求

输出以下对象：

```text
Rights Manifest
Effective Rights Merge Report
Safety Risk Register
Regional and Platform Compliance Checklist
AIGC Labeling Plan
C2PA Provenance Plan（如采用）
Blocked Items and Required Evidence
Human/Counsel Review Queue
```

每条问题至少包含：

```yaml
issue_id:
severity: blocker | error | warning | suggestion
artifact_id:
rights_subject_ids: []
rule_profile_id:
evidence:
required_action:
owner:
automatic_fix_allowed: false
status:
```

除纯格式补全外，不要自动生成授权事实、签名、许可范围、监护关系或法律结论。
