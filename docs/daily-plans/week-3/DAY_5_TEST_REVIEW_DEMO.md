# Week 3 Day 5：测试、审查与演示

## 当天目标

确认 Week 3 核心职责已经完成，并为 Week 4 端到端集成提供稳定前端基线。

## 上午任务：完整测试

1. [x] 运行 Schema、Adapter、过滤、选择和 Diff 单元测试；
2. [x] 运行函数选择、Pass 导航、过滤和 Diff 组件测试；
3. [x] 测试所有 Fixture 和真实回归 Payload；
4. [x] 测试加载、空数据、错误、无变化和部分数据；
5. [x] 检查长列表、长 IR、窄屏和键盘操作；
6. [x] 运行格式、Lint、类型和生产构建；
7. [x] 修复 Week 3 P0 问题；已补充路由级 `loading.tsx`。

上午验证结果：完整优化测试 74/74 通过；功能范围 Prettier、ESLint、
TypeScript 和生产构建通过。浏览器覆盖所有 Fixture、真实回归 Payload、空数据、
无效数据、无变化、部分数据、60 Pass 长列表、333 字符 IR 行、390×844 窄屏和
键盘组合过滤；生产浏览器控制台为 0 error、0 warning。全仓 Prettier 仍报告
16 个功能范围外的既有文件，未为避免无关改动而批量重写。

## 下午任务：审查和演示

1. [x] 确认 PR 小型且职责清晰；Week 3 拆为 3 个单一职责的堆叠 Draft PR；
2. [x] 更新截图、测试结果和已知限制；
3. [x] 邀请 Jason 使用真实 Payload 验证；PR #3–#5 均已请求 `jpersonn` 审查；
4. [x] 演示函数、过滤、导航、Diff 和指标；
5. [x] 演示错误 Payload 被拒绝；Schema 字段路径错误可见且 Workspace 不渲染；
6. [x] 与团队确认 Week 4 上传、tRPC、部署和测试责任；责任确认表已发布到 PR #5，等待团队回复或修正；
7. [x] 为每个阻塞项指定负责人；详见下方责任与阻塞表。

## PR 审查拆分

| 顺序 | PR | 单一职责 | 请求审查 |
| --- | --- | --- | --- |
| 1 | [#3 Add optimisation navigation and filters](https://github.com/RichardLi88/ENG4701/pull/3) | 函数/Pass 选择、组合过滤、上下导航、60 Pass 长列表 | Jason、Richard |
| 2 | [#4 Add IR diff and optimisation details](https://github.com/RichardLi88/ENG4701/pull/4) | 行级 Diff、无变化状态、详情和指标 | Jason、Richard |
| 3 | [#5 Add real payload regression and QA evidence](https://github.com/RichardLi88/ENG4701/pull/5) | 真实回归 Payload、临时 tRPC、Loading、截图和 QA | Jason、Richard |

PR #3 基于 `joshua/compiler-data-contract`，PR #4 基于 PR #3，PR #5 基于 PR #4。
审查和合并顺序为 #3 → #4 → #5；环境、忽略规则、Next 配置和启动脚本改动均未
进入这些 PR。Week 4 责任确认见
[PR #5 评论](https://github.com/RichardLi88/ENG4701/pull/5#issuecomment-5230124089)。

## 下午演示结果

1. `?fixture=real` 加载脱敏 LLVM 14 回归 Payload，摘要显示 2 个函数、4 个 Pass、
   3 个变化和 1 个未变化事件；
2. 从 `sum_to_n` 切换到 `main` 后，Pass 列表和详情同步切换到 `sroa`；
3. 在 `sum_to_n` 组合 `Transform + Changed`，时间线只保留 2 个 Pass；
4. Next 从 `simplifycfg` 前进到 `sroa`，Previous 返回，位置从 1/2 到 2/2 再回到 1/2；
5. 组合 `Analysis + Unchanged` 后选择 `invalidate-aa`，显示明确的 `No IR changes`；
6. 多函数 Fixture 的 `instcombine` 展示新增/删除 Diff，以及 Instructions `2 → 1`
   和 Delta `-1`，估算与实测标志均可见；
7. 无效 Fixture 被 Schema 拒绝，显示 `schemaVersion` 和 `passes.0.order` 精确路径，
   不进入 Workspace；
8. 桌面与 390×844 窄屏均无页面级横向溢出，演示全程控制台无错误或警告。

### 截图

- [真实 Payload](../../../public/qa/week-3-day-5/desktop-real-payload.png)
- [组合过滤与无变化 Diff](../../../public/qa/week-3-day-5/desktop-filtered-no-change.png)
- [指标与变化 Diff](../../../public/qa/week-3-day-5/desktop-metrics-diff.png)
- [无效 Payload 拒绝](../../../public/qa/week-3-day-5/desktop-invalid-payload.png)
- [窄屏真实 Payload](../../../public/qa/week-3-day-5/mobile-real-payload.png)

## 已知限制

1. `compiler.getRealOptimisationPayload` 当前读取已保存的真实回归 Payload，尚未连接
   实时结构化 LLVM 响应；
2. 原始 `/optimise` 仍返回 `optimisedIr` 和 `beforeAfterLog`，Week 4 必须由后端直接
   输出版本化 `OptimisationResult`；
3. 真实后端尚未提供指标、CFG、转换摘要和依赖关系；UI 会明确显示不可用且不伪造值；
4. 全量 152 个快照的响应大小、超时、压缩和持久化策略尚未冻结；
5. 组件行为以纯状态/展示函数测试和真实生产浏览器演示覆盖，项目尚未引入独立 DOM
   组件测试框架；
6. 全仓 Prettier 的 16 个功能范围外既有格式问题仍保留。

## Week 4 责任与阻塞项

| 阻塞项/范围 | 主要负责人 | 支持/验收 | Week 4 交付结果 |
| --- | --- | --- | --- |
| 上传后端接口和输入验证 | Jason | Richard/上传 UI | 冻结 `.c`/`.cpp`、空文件和错误扩展名行为 |
| 版本化 `OptimisationResult` 生成 | Jason | Joshua/Schema 审查 | 前端不再解析文本日志 |
| 稳定 Pass ID 和重复 Pass 身份 | Jason | Joshua/回归测试 | 单次 Payload 唯一且测试可复现 |
| 实时 tRPC Mutation 和结果替换 | Joshua | Jason/后端端点 | 新运行结果进入 Schema 并完整替换旧状态 |
| 五项指标定义与不可用原因 | Jason | Joshua/UI | 定义 before/after/delta、estimated 和缺失规则 |
| 大 Payload 超时、压缩和持久化 | Jason | Richard/基础设施；Joshua/客户端限制 | 152 快照可可靠传输 |
| 部署环境和环境变量 | Richard/团队 | Jason/LLVM；Joshua/前端冒烟 | 部署 Next.js 可连接 LLVM 服务 |
| 自动化和集成测试 | Joshua/前端，Richard/集成 | Jason/测试程序与后端失败场景 | 成功路径和 P0 失败路径可重复 |
| PR 审查与 MVP 验收 | Richard/团队 | Jason/协议；Joshua/前端 | 按 #3 → #4 → #5 完成审查和验收 |

## 完成清单

- [x] Week 3 P0 功能全部完成；
- [x] 真实或等价 Payload 可完整浏览；
- [x] 核心测试通过；完整优化测试 74/74；
- [x] 生产构建通过；
- [x] PR 已提交并请求审查；Draft PR #3、#4、#5 已请求 Jason 和 Richard；
- [x] 演示成功；真实 Payload、函数、过滤、导航、Diff、指标和错误拒绝全部通过；
- [x] Week 4 责任和阻塞项明确；责任确认表已发布，等待团队确认或修正。

## 演示顺序

1. 加载真实/等价 Payload；
2. 展示摘要；
3. 切换函数；
4. 组合过滤 Pass；
5. 使用时间线和上下按钮；
6. 展示变化及无变化 Diff；
7. 展示核心指标；
8. 展示无效数据错误；
9. 说明 Week 4 完整链路。

## 下一周交接

Week 4 Day 1 已获得堆叠前端分支、脱敏真实回归 Payload、端到端缺口和逐项负责人。
仍需团队在 PR #5 确认责任表，并由 Richard/团队补充目标部署环境、环境变量和部署入口。
