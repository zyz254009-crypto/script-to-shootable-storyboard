# 成本、复杂度与制作方式

> 本文件用于制作规划和风险估算，不是供应商报价、财务承诺或保险意见。价格、汇率、税费、账号能力和成功率会变化；始终记录来源、地区、币种、核验时间和不确定性。

## 目录

- [使用时机](#使用时机)
- [估算原则](#估算原则)
- [成本对象](#成本对象)
- [成本范围](#成本范围)
- [重试概率与分布](#重试概率与分布)
- [复杂度评分](#复杂度评分)
- [真人、生成与混合制作决策](#真人生成与混合制作决策)
- [币种、税费与汇率](#币种税费与汇率)
- [场景化估算](#场景化估算)
- [预算门禁与降级](#预算门禁与降级)
- [实际成本回写](#实际成本回写)
- [输出契约](#输出契约)

## 使用时机

在以下情况加载本文件：

- 项目给出预算上限或要求估算成本。
- Shot 含多人物、复杂动作、口型、手部交互、特效或高风险实拍。
- 需要在真人、Seedance 或混合制作之间选择。
- 需要预估多次生成、人工复核、后期修复或替代镜头。
- 价格、地区、税费、汇率或模型入口可能影响决策。

不要把“镜头数量 × 单次价格”当作完整成本。

## 估算原则

1. 区分计划成本、承诺成本、实际成本和沉没成本。
2. 分别输出低位、预期和高失败率情景，不输出伪精确单点数字。
3. 使用实测 Attempt 数据估计重试分布；没有数据时使用明确标记的假设。
4. 将相同提示词的重复尝试视为可能相关，不默认每次独立同分布。
5. 将人工复核、后期修复、素材、声音、合成、真人资源和管理开销纳入。
6. 对价格、税费、汇率和平台区域加时间戳。
7. 将超过 30 天未核验的快速变化价格标记为 `stale`。
8. 对未知价格输出范围或 `待确认`，不要填造数字。
9. 将预算门禁放在冻结 Shot 和提交 Attempt 之前。
10. 保存降级前后成本、质量影响和剧情影响。

## 成本对象

使用以下最小结构：

```yaml
cost_estimate_id:
project_id:
estimate_version:
base_currency:
target_region:
pricing_as_of:
generated_at:
generated_by:

assumptions:
  production_days:
  shot_count:
  generation_task_count:
  review_rounds:
  contingency_policy:
  excluded_costs: []

line_items:
  - line_item_id:
    artifact_ids: []
    category:
    vendor_or_source:
    region:
    pricing_source_id:
    pricing_verified_at:
    pricing_status: verified | stale | quoted | assumed | unknown
    pricing_unit:
    unit_price:
    quantity_distribution:
      low:
      expected:
      high:
    source_currency:
    tax_included:
    tax_rate:
    exchange_rate_id:
    subtotal_distribution:
      low:
      expected:
      high:
    confidence:
    notes:

totals:
  low:
  expected:
  high_failure:
  contingency:
  taxes:
  grand_total_low:
  grand_total_expected:
  grand_total_high:

budget:
  hard_limit:
  soft_limit:
  status: within | near_limit | over_limit | unknown
  over_budget_artifact_ids: []
  downgrade_plan_ids: []
```

不要把 `low` 命名为“绝对最低”，除非所有固定费用和最小购买量都已确认。

## 成本范围

至少检查以下类别。

### AI 生成

- Generation Task 请求费。
- 每个任务的 Attempt 数量分布。
- 高清、延长、补帧、超分、去水印或重新编码。
- 参考图片、参考视频、参考音频的制作或授权。
- 失败结果的存储、下载和审阅成本。
- 供应商套餐、最低购买量、积分过期和区域差异。

### 真人拍摄

- 演员、群演、替身、配音和经纪费用。
- 导演、摄影、灯光、录音、美术、化妆、服装和制片。
- Camera Setup 数量、换机时间、灯光重置和走戏。
- 场地、交通、食宿、器材、保险、许可和安全人员。
- 动物、车辆、武器、火焰、水下、高空和特技。
- 加班、天气、补拍、撤场和场地恢复。

### 混合制作与后期

- Clean plate、跟踪、遮罩、抠像、合成和色彩匹配。
- 剪辑、调色、降噪、口型修复、字幕、图形和母版。
- 配音、拟音、环境声、音乐、混音和响度交付。
- 人工 QA、权利审核、安全审核、平台审核和返工。
- C2PA 或其他内容凭证生成、签名和验证。
- 多画幅、多语言、多平台和无障碍版本。

### 管理与不可见成本

- 项目管理、数据传输、存储、备份和归档。
- 法律、保险、隐私和合同审查。
- 汇率、支付手续费、税费和发票成本。
- 失败探索、排队延迟、账号限额和供应商不可用。
- 上线后替换、下架、撤回或重新标识。

## 重试概率与分布

优先使用按风险类型分层的历史 Attempt 数据：

```yaml
retry_model:
  model_profile_id:
  region:
  task_class:
  risk_band:
  sample_size:
  observation_window:
  attempts_distribution:
    "1": 0.40
    "2": 0.30
    "3": 0.18
    "4+": 0.12
  pass_probability_by_attempt: []
  conditional_failure_reasons: {}
  abandonment_probability:
  fallback_probability:
  confidence_interval:
  calibration_status:
```

若只有单次成功概率 `p`，且每次尝试成本相同、最多尝试 `K` 次，可以用截断几何分布作临时近似：

```text
E[N] = Σ(k=1..K) P(N ≥ k)
P(N ≥ k) = (1 - p)^(k - 1)
```

同时遵守：

- 标记该模型是假设，不是实测。
- 不要在相同提示词、相同参考和相同模型缺陷下默认独立性。
- 对系统性失败使用条件概率：如果第一次出现身份漂移，原样重试的成功率可能更低。
- 将“原样重试”“修改提示词”“增加参考”“拆镜”“转真人/合成”建成不同分支。
- 将审阅淘汰、供应商错误、内容审核拒绝和技术失败分别建模。
- 对样本不足的风险组使用更宽区间和更高 contingency。

建议输出：

| 情景 | 建议含义 |
|---|---|
| `low` | 较少重试且无重大返工的可实现低位 |
| `expected` | 基于当前风险分布的期望或 P50 附近 |
| `high_failure` | 包含高重试、拆镜、后期修复或转制的 P80/P90 情景 |
| `worst_case_bounded` | 在明确最大 Attempt、最大补拍天数和停止规则下的上界 |

不要输出无界“最坏情况”。

## 复杂度评分

分别计算生成复杂度、真人执行复杂度、后期复杂度和合规复杂度。不要用一个总分掩盖不同风险。

### 生成复杂度

按 0–3 评分：

- 主要人物数量。
- 同时运动主体数量。
- 动作链长度和动作精度。
- 手部、小道具、文字和屏幕内容。
- 口型、对白长度和多人声音对应。
- 遮挡、镜面、玻璃、透明材质和反射。
- 运镜、焦点变化、构图漂移和首尾帧约束。
- 水、火、烟、布料、头发、车辆、动物和破坏效果。
- 跨镜人物、服装、道具和空间连续性。

### 真人执行复杂度

按 0–3 评分：

- 演员人数、走位、表演重复和对白重叠。
- Camera Setup、灯光重置、焦点和收音难度。
- 场地限制、夜戏、外景、天气和交通。
- 群演、儿童、动物、车辆、武器、火焰、水下和特技。
- 服装、化妆、伤效、道具和连续性负担。
- 许可、保险、安全人员和拍摄时限。

### 后期复杂度

按 0–3 评分：

- 抠像、跟踪、遮罩、Clean plate 和合成层数。
- 身份、手部、口型、物理和构图修复。
- 多语言、字幕、配音、拟音和音乐。
- 多画幅重构、平台版本和内容标识。
- 素材格式、帧率、色彩空间和音频交接差异。

### 合规复杂度

按 0–3 评分：

- 权利主体数量和许可差异。
- 未成年人、公众人物、真实事件和敏感内容。
- 肖像、声音、数字替身、生物特征和跨境数据。
- 多地区、多平台、多语言和广告用途。
- AIGC 标识、内容凭证、撤回和删除义务。

每个维度同时输出：

```yaml
score:
evidence:
dominant_risks: []
uncertainties: []
cost_effects: []
recommended_controls: []
```

## 真人、生成与混合制作决策

逐 Shot 决策，不要只给项目打一个 `production_mode` 标签。

优先考虑 AI 生成：

- 场景难以取得、危险或成本远高于生成。
- 画面不依赖精确口型、复杂手部或多人物连续表演。
- 可接受一定非确定性，并有多 Attempt 预算。
- 上游参考权利允许 AI 使用。

优先考虑真人：

- 依赖自然长对白、精确表演、复杂多人互动或可重复连续动作。
- 品牌、产品、服装、道具或法律证据必须准确。
- 生成失败率和返工成本超过实拍。
- 需要可靠口型、可控声音或可审计表演同意。

考虑混合制作：

- 真人表演必须保留，但背景、危险元素或环境需要生成。
- 需要替换屏幕、天空、场景扩展、群演或特效。
- 有 Clean plate、跟踪、遮罩、帧率、色彩和声音交接能力。

对每个 Shot 保存：

```yaml
production_decision:
  shot_id:
  selected_method: live | seedance | hybrid
  compared_options: []
  expected_costs: {}
  quality_risks: []
  rights_and_safety_risks: []
  schedule_effects: []
  switch_threshold:
  final_fallback:
```

当生成 Attempt 达到停止阈值时，必须允许转真人、合成、静态插入、反应镜头或声音方案，而不是无限重试。

## 币种、税费与汇率

为每项价格记录：

```yaml
currency:
pricing_unit:
region:
tax_included:
tax_type:
tax_rate:
payment_fee:
minimum_purchase:
exchange_rate:
exchange_rate_pair:
exchange_rate_source_id:
exchange_rate_timestamp:
rounding_policy:
```

执行规则：

- 保留原始币种金额，再转换到项目基准币种。
- 不要先转换单价再多次四舍五入；在约定层级统一舍入。
- 区分含税价、不含税价、可抵扣税和不可抵扣税。
- 对未来支付使用汇率区间或波动缓冲，不假定当前汇率固定。
- 不同地区、账号级别和支付渠道的价格不得混用。
- 税务处理不明确时标记 `tax_review_required`，不要自行给出税务结论。

## 场景化估算

使用以下公式作为结构，不把所有项目机械相加成同一时刻发生：

```text
项目成本情景 =
固定成本
+ Σ(数量情景 × 单价情景)
+ 相关重试与返工分支
+ 税费和支付费用
+ 风险准备金
```

为关键不确定项建立至少三种情景：

```yaml
scenario:
  name: low | expected | high_failure
  assumptions: []
  attempt_counts: {}
  live_days:
  post_hours:
  review_rounds:
  fallback_events: []
  subtotal:
  taxes:
  contingency:
  total:
```

风险准备金应基于风险登记表，不要统一拍脑袋加固定百分比。对高度相关风险避免重复计算。

## 预算门禁与降级

使用以下门禁：

| 状态 | 条件 | 动作 |
|---|---|---|
| `within` | 预期和高失败率情景均在批准范围 | 继续 |
| `near_limit` | 预期成本接近软上限 | 冻结新增范围，准备降级 |
| `over_expected` | 预期成本超过软上限 | 用户批准或执行降级 |
| `over_hard_limit` | 任一承诺动作将超过硬上限 | 阻断提交或拍摄 |
| `unknown` | 关键价格、汇率或成功率未知 | 补证据后再承诺 |

按以下顺序降低成本：

1. 删除不影响剧情的背景动作和装饰性生成。
2. 减少同时运动主体和高精度交互。
3. 固定摄影机或缩短动作链。
4. 拆镜并复用反应镜头、插入镜头或声音。
5. 复用合规的场景、道具、Setup 和参考资产。
6. 改用后期配音、拟音或静态图形承载次要信息。
7. 在 AI、真人和混合之间重新比较总成本。
8. 缩减平台版本、语言版本或交付范围，但必须获得授权。

不得通过删除安全人员、权利授权、必要审核、无障碍要求或法定标识来降本。

## 实际成本回写

对每次 Attempt、Take、后期任务和审核回写：

```yaml
actual_cost_record:
  artifact_id:
  activity_type:
  started_at:
  completed_at:
  source_currency:
  gross_cost:
  tax:
  payment_fee:
  converted_cost:
  exchange_rate_id:
  labor_hours:
  attempt_number:
  outcome:
  failure_codes: []
  selected_or_rejected:
```

每个里程碑比较：

```text
估算偏差 = (实际累计成本 - 计划累计成本) / 计划累计成本
```

同时检查：

- 哪些风险组的 Attempt 分布失准。
- 哪些失败原因具有相关性。
- 哪些降级真正节省成本。
- 哪些人工工时被遗漏。
- 供应商价格、税费或汇率是否变化。

只有在样本定义一致时才更新概率模型。不要把不同模型、地区、时长和任务类型混成一个成功率。

## 输出契约

至少输出：

```text
Cost Estimate
Complexity Report
Retry Probability Model
Per-Shot Production Decision
Budget Gate Report
Downgrade Options
Actual-vs-Estimate Report（生产后）
```

每个超预算 Shot 提供：

```yaml
shot_id:
current_method:
current_expected_cost:
current_high_cost:
dominant_cost_drivers: []
downgrade_options:
  - option_id:
    change:
    expected_saving:
    quality_impact:
    story_impact:
    rights_or_safety_impact:
    approval_required:
recommended_option:
```

禁止自动选择会改变剧情事实、降低安全标准、违反授权或省略合规义务的降级方案。
