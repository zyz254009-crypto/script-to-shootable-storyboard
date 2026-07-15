# 来源目录与证据治理

> 本文件规定如何登记、核验和引用来源。目录中的链接或摘要不构成法律意见，也不保证来源在未来仍有效。任何快速变化的模型能力、价格、平台政策和地区规则都必须在实际项目中重新核验。

## 目录

- [目标](#目标)
- [证据等级](#证据等级)
- [来源记录契约](#来源记录契约)
- [Canonical ID](#canonical-id)
- [身份核验](#身份核验)
- [内容哈希与版本固定](#内容哈希与版本固定)
- [可借鉴与不可借鉴](#可借鉴与不可借鉴)
- [生命周期与陈旧策略](#生命周期与陈旧策略)
- [引用规则](#引用规则)
- [发布前审计](#发布前审计)
- [核心来源种子目录](#核心来源种子目录)
- [计划来源迁移队列](#计划来源迁移队列)

## 目标

使用来源目录回答四个问题：

1. 这份资料到底是谁发布的？
2. 当前引用的是哪个确定版本？
3. 它能支持什么结论，不能支持什么结论？
4. 将来如何发现内容漂移、链接替换或身份错配？

不要把“链接能打开”当作身份核验完成。

## 证据等级

| 等级 | 定义 | 可支持的结论 |
|---|---|---|
| `S` | 官方法规、官方标准、官方产品文档、原始论文、官方仓库或正式规范 | 对应版本的明示规则、规格或方法 |
| `A` | 论文作者项目页、维护者仓库、专业机构培训或一手生产资料 | 方法实现、工作流与专业职责 |
| `B` | 可信生产工具、成熟开源项目、行业实践资料 | 工程组织、接口和可参考做法 |
| `C` | 聚合站、Skill 市场、博客、媒体报道、社区讨论 | 发现线索，不单独支持关键事实 |
| `R` | 身份错配、内容不可访问、来源被替换或用途误导 | 拒绝使用 |

执行规则：

- 用 `S` 级来源确认模型能力、法律文本、标准版本和官方平台规则。
- 用 `A` 或 `B` 级来源参考工作流，但不要将项目自述当作效果证明。
- 只用 `C` 级来源发现候选资料，随后找到原始来源。
- 将研究论文的实验结论与供应商生产稳定性分开。
- 将官方演示与普通用户成功率分开。
- 将电影语法、软件数据模型、短剧经验和 AI 模型能力分开引用。

## 来源记录契约

为每条来源保存：

```yaml
source_id: src-0001
title:
category: regulation | standard | official_product_doc | research_paper |
  official_repository | maintainer_repository | professional_training |
  production_tool | discovery_only

identity:
  authors: []
  publishing_organization:
  canonical_identifier:
  canonical_url:
  alternate_urls: []
  source_level: S | A | B | C | R
  identity_status: discovered | identity_verified | rejected
  identity_check_method: []
  identity_checked_by:
  identity_checked_at:

version:
  version_label:
  publication_date:
  revision_date:
  commit_or_tag:
  supersedes_source_id:
  superseded_by_source_id:

fetch:
  fetched_at:
  final_resolved_url:
  http_status:
  mime_type:
  content_length:
  etag:
  last_modified:
  archive_uri:

hashes:
  raw_content_hash_algorithm: sha256
  raw_content_hash:
  normalized_text_hash_algorithm: sha256
  normalized_text_hash:
  hash_scope:

evidence_scope:
  direct_relevance:
  usable_for: []
  not_evidence_for: []
  quoted_claims: []
  limitations: []

license:
  license_id:
  license_url:
  redistribution_allowed:
  quotation_constraints:

governance:
  status: active | stale | superseded | unreachable | disputed | rejected
  review_interval_days:
  next_review_at:
  notes:
```

不要使用标题或 URL 作为唯一主键。

## Canonical ID

按来源类型生成稳定标识：

| 来源类型 | Canonical ID 格式 |
|---|---|
| arXiv 论文 | `arxiv:<编号>@<版本>`，例如 `arxiv:2604.14148@v1` |
| DOI 论文 | `doi:<小写 DOI>` |
| GitHub 仓库 | `github:<owner>/<repo>@<commit-sha-or-tag>` |
| 官方网页文档 | `<机构域名>:<产品或文档路径>@<页面版本或抓取日期>` |
| 法规 | `<发布机关>:<正式标题>@<公布日期或文号>` |
| 标准 | `<标准组织>:<标准编号>@<版本>` |
| 软件文档 | `<vendor>:<product>:<doc-id>@<product-version>` |
| 训练课程 | `<机构>:<课程标识>@<发布日期或版本>` |

执行规则：

- 优先使用 DOI、arXiv ID、标准编号、法规文号、仓库 commit 等非标题标识。
- 对会重定向的网页同时记录初始 URL 和最终 URL。
- 对 Git 仓库固定 commit 或 release tag；不要只记录默认分支。
- 对动态官方文档缺少版本号时，将抓取日期写入 Canonical ID，并保存内容哈希。
- 对同名项目先核对作者、机构、论文链接和仓库归属，再建立 ID。
- 发现链接被出售、重定向到其他项目或仓库改名时，不要静默替换；建立新记录并将旧记录设为 `disputed` 或 `superseded`。

## 身份核验

至少完成以下检查：

1. 打开来源并记录最终解析 URL、HTTP 状态和 MIME 类型。
2. 核对页面标题、作者、发布机构、发布日期和版本。
3. 对论文核对摘要页、PDF 首页、作者和 DOI/arXiv ID。
4. 对 GitHub 核对 owner、仓库描述、论文/项目页互链、release 和 commit。
5. 对法规核对发布机关、正式标题、公布日期、施行日期和附件。
6. 对标准核对标准组织、版本、发布日期和规范状态。
7. 对产品文档核对产品入口、地区、账号级别和模型版本。
8. 检查来源能否支持拟引用的具体结论。
9. 记录核验人、核验时间和使用的核验方法。
10. 对身份或用途不一致的来源设为 `R`，不要为了保留数量而降格使用。

推荐 `identity_check_method`：

```yaml
- official_domain_match
- canonical_id_match
- title_match
- author_match
- organization_match
- cross_link_match
- repository_owner_match
- pdf_front_page_match
- regulation_metadata_match
- standard_version_match
```

仅通过下列检查仍不算完成身份核验：

- URL 返回 200。
- 搜索结果标题相似。
- README 自称官方。
- 同名仓库星标很多。
- 聚合站提供了下载链接。

## 内容哈希与版本固定

至少保存 SHA-256 原始内容哈希：

```text
raw_content_hash = SHA256(实际抓取并保存的原始字节)
```

可同时保存规范化文本哈希：

```text
normalized_text_hash = SHA256(明确记录规范化步骤后的文本)
```

执行规则：

- 不要计算 URL 字符串的哈希来冒充内容哈希。
- 对 PDF 保存原始 PDF 字节哈希。
- 对 Git 仓库优先保存 commit SHA，并对关键文件另存内容哈希。
- 对动态网页保存 HTML、打印版、官方 PDF 或受控快照；记录哈希范围。
- 记录重定向后的 URL、抓取时间、ETag、Last-Modified 和 MIME 类型。
- 将页面导航、广告或个性化区域排除在规范化文本前，必须记录规范化算法版本。
- 当内容哈希变化时，重新进行身份与用途审核；不要只更新哈希。
- 若无法合法保存原文，保存受控引用、元数据、哈希和可验证的抓取记录。

建议 `hash_scope` 使用：

```yaml
hash_scope:
  raw: full_response_body
  normalized: main_article_text
  normalization_version: text-normalizer-1
```

没有实际抓取字节时，将哈希字段设为 `pending-fetch`，不要伪造值。`pending-fetch` 来源不得支撑发布门禁中的关键事实。

## 可借鉴与不可借鉴

每条来源必须同时填写 `usable_for` 与 `not_evidence_for`。

示例：

```yaml
usable_for:
  - 确认 Seedance 2.0 在该版本报告中声明的输入类型
  - 设计模型注册表字段
not_evidence_for:
  - 独立第三方生产成功率
  - 所有账号和地区均已开放
  - 专业短剧镜头语法
```

常见边界：

- 官方产品页可证明官方声明，不能证明普通任务稳定成功。
- 原始论文可证明方法与实验设置，不能直接证明商业入口规格。
- GitHub README 可证明项目自述，不能证明独立效果或长期维护。
- 生产工具可参考流水线，不能证明电影理论或短剧留存规律。
- 电影培训资料可支持专业流程，不能证明 AI 模型能力。
- 平台政策可支持该平台规则，不能外推到其他平台或地区。
- 法规文本可支持适用规则内容，不能由 SKILL 自动判断复杂案件的法律结论。
- C2PA 可支持来源凭证结构，不能证明内容真实或已获得权利。

## 生命周期与陈旧策略

使用以下状态转换：

```text
discovered
→ identity_verified
→ content_pinned
→ active
→ stale / superseded / unreachable / disputed / rejected
```

建议复核间隔：

| 类型 | 默认复核间隔 |
|---|---:|
| 模型能力、价格、账号和平台政策 | 30 天以内 |
| 软件文档、仓库默认分支 | 90 天以内 |
| 标准和法规 | 180 天以内，并在重大修订时立即复核 |
| 固定论文版本和固定 commit | 身份固定；用途在模型升级或流程改变时复核 |

执行规则：

- 到达 `next_review_at` 后标记 `stale`。
- `stale` 来源可保留历史解释，但不得作为当前规格或价格的唯一依据。
- 发现新版本时保留旧记录，使用 `superseded_by_source_id` 关联。
- 失效链接不要自动换成搜索结果中的同名页面。
- 将供应商入口、地区和账号能力放入运行快照，不只放在全局目录。

## 引用规则

- 对每个可变数字附来源 ID、版本和核验日期。
- 对推断明确标记“推断”，不要写成来源原话。
- 对同一结论优先引用原始来源；二手来源只补充背景。
- 不要长段复制受版权保护的内容；保存短引用和自己的摘要。
- 引用法规或标准时保留正式标题、版本和适用地区。
- 引用仓库时固定 commit/tag；引用论文时固定版本。
- 不要用 Skill 市场页面代替技能作者仓库或官方文档。

## 发布前审计

发布前执行：

1. 检查所有主 URL 和备用 URL 的可访问性。
2. 检查重定向是否改变身份。
3. 核对 Canonical ID、标题、作者、机构和版本。
4. 核对内容哈希是否与固定快照一致。
5. 确认关键结论均由足够等级的来源支持。
6. 确认每条来源填写 `not_evidence_for`。
7. 将过期、不可访问、身份漂移和用途错配列为阻断问题。
8. 确认许可证与引用方式允许当前使用。
9. 计算 `source_catalog_hash` 并写入项目运行快照。
10. 让人工复核法律、模型规格、价格和高风险生产结论。

## 核心来源种子目录

以下是待固化到项目目录的种子记录。`核验状态` 仅描述本参考文件的初始登记状态；发布前必须抓取实际内容、生成哈希并重新核验。

| Source ID | 等级 | Canonical ID | 用于 | 不可用于 | 核验状态 |
|---|---:|---|---|---|---|
| `src-seedance-official` | S | `seed.bytedance.com:seedance2_0@2026-06-25` | 官方产品能力声明、入口说明 | 独立成功率、所有地区可用性 | `identity_verified; content_hash_pending` |
| `src-seedance-report` | S | `arxiv:2604.14148@v1` | Seedance 2.0 方法、评测、声明能力和限制 | 第三方生产稳定性、永久产品规格 | `identity_verified; version_pinned; content_hash_pending` |
| `src-openai-codex-skills` | S | `developers.openai.com:codex/skills@2026-06-24` | SKILL 结构、触发描述、渐进披露 | 影视专业规则 | `identity_verified; content_hash_pending` |
| `src-json-schema-2020-12` | S | `json-schema.org:draft-2020-12@2020-12` | JSON Schema 数据契约 | 剧情语义、权利判断 | `identity_verified; content_hash_pending` |
| `src-c2pa` | S | `c2pa:c2pa-specification@pinned-version` | 内容凭证、来源和编辑历史结构 | 内容真实性、版权或授权证明 | `identity_verified; version_and_hash_pending` |
| `src-cn-aigc-label` | S | `cac.gov.cn:人工智能生成合成内容标识办法@2025-03-14` | 中国 AIGC 标识制度和施行信息 | 其他地区规则、个案法律意见 | `identity_verified; content_hash_pending` |
| `src-usco-ai-copyrightability` | S | `copyright.gov:ai-report-part-2-copyrightability@pinned-edition` | 美国版权局关于 AI 生成内容可版权性的官方分析 | 全球版权结论、个案权属判断 | `identity_verified; version_and_hash_pending` |
| `src-movielabs-omc` | S | `movielabs.com:ontology-for-media-creation@pinned-version` | 媒体对象、任务、版本和可追溯关系 | 短剧钩子和 Seedance 提示词 | `identity_recheck_required` |
| `src-opentimelineio` | S | `github:AcademySoftwareFoundation/OpenTimelineIO@commit-to-pin` | Clip、Track、Timeline 数据模型 | 剧情语义和生成稳定性 | `identity_verified; commit_and_hash_pending` |
| `src-screenskills-script-supervisor` | A | `screenskills.com:script-supervisor@2026-06-24` | 连戏职责、对白、动作、服装和道具记录 | AI 模型能力、法律结论 | `identity_recheck_required` |
| `src-blackmagic-training` | S | `blackmagicdesign.com:davinci-resolve-training@2026-06-24` | 剪辑、声音和后期流程 | 自动剧本转分镜效果 | `identity_recheck_required` |
| `src-vbench` | S | `github:Vchitect/VBench@commit-to-pin` | 视频生成质量评价维度 | 剧情保真、短剧留存和法律合规 | `identity_verified; commit_and_hash_pending` |

### 关键来源地址

- Seedance 2.0 官方页：<https://seed.bytedance.com/en/seedance2_0>
- Seedance 2.0 Technical Report：<https://arxiv.org/abs/2604.14148>
- OpenAI Codex Skills：<https://developers.openai.com/codex/skills>
- JSON Schema Draft 2020-12：<https://json-schema.org/draft/2020-12/json-schema-core>
- C2PA 规范入口：<https://spec.c2pa.org/>
- 中国 AIGC 标识办法：<https://www.cac.gov.cn/2025-03/14/c_1743654684782215.htm>
- 美国版权局 AI 专题：<https://www.copyright.gov/ai/>
- MovieLabs Ontology for Media Creation：<https://movielabs.com/prod-tech/ontology-for-media-creation/>
- OpenTimelineIO：<https://github.com/AcademySoftwareFoundation/OpenTimelineIO>
- ScreenSkills Script Supervisor：<https://www.screenskills.com/job-profiles/browse/film-and-tv-drama/technical/script-supervisor/>
- Blackmagic Design Training：<https://www.blackmagicdesign.com/products/davinciresolve/training>
- VBench：<https://github.com/Vchitect/VBench>

## 计划来源迁移队列

将建设计划中的其余来源按以下批次迁移，不要直接继承“已核验”结论：

### 剧本、叙事与分镜

```text
FilmAgent
MovieAgent
DirectorLLM
Story2Board
GenMAC
Camera Artist
Dramatron
Storyboarder
Fountain Syntax
AutoStudio
```

### AI 视频与跨镜连续性

```text
StoryDiffusion
SkyReels-V2
LTX-Video
HunyuanVideo
Wan2.1
CogVideo
```

### 视频质量与组合评估

```text
VBench-2.0
EvalCrafter
T2V-CompBench
```

### 短视频与后期工具

```text
MoneyPrinterTurbo
ShortGPT
NarratoAI
Remotion
MoviePy
FFmpeg
```

### SKILL、制作规范与治理

```text
OpenAI Plugins
Anthropic Skills
Adobe 180-degree rule
Semantic Versioning 2.0.0
```

对每条迁移记录执行：

1. 找到原始来源，不以聚合页作为主来源。
2. 验证 Canonical ID、作者、机构和用途。
3. 固定论文版本、仓库 commit 或文档抓取日期。
4. 保存原始内容哈希。
5. 填写可借鉴项与不可作为证据项。
6. 检查许可证和引用限制。
7. 发现编号、标题、仓库或用途错配时设为 `rejected`，不要静默纠正后沿用旧 ID。
8. 完成后才将状态从 `pending` 改为 `active`。
