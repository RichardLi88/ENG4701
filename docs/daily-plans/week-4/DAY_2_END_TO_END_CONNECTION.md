# Week 4 Day 2：完成端到端连接

## 当天目标

在本地实现至少一个有效 C 程序从输入到完整结果工作区的真实链路。

## 开始条件

- 上传/输入组件可用；
- LLVM 服务可以本地启动；
- 结构化 tRPC 接口已明确；
- P0 阻塞项有负责人。

## 上午任务：工作流状态

1. 连接输入组件和 `compiler.compile`；
2. 连接编译结果和结构化优化 Procedure；
3. 实现 `idle/validating/compiling/optimising/processing/success/failure`；
4. 提交期间禁用重复操作；
5. 编译或优化失败后结束加载；
6. 可恢复错误保留用户输入。

## 下午任务：结果连接

1. 将 tRPC 响应送入 Schema；
2. 将验证结果送入 Adapter；
3. 成功后加载 Workspace；
4. 新运行时清理旧函数、Pass、过滤和 Diff；
5. 区分编译、服务、超时和 Schema 错误；
6. 使用一个有效 C 示例完成全流程；
7. 保存当天真实 Payload 作为回归 Fixture。

## 测试

- 有效 C 输入；
- 重复点击提交；
- 编译错误；
- LLVM 服务停止；
- 无效结构化响应；
- 连续运行两个不同输入；
- 错误后修改并重试。

## 完成清单

- [x] 有效 C 可端到端运行；
- [x] 所有异步状态可见；
- [x] 重复提交被阻止；
- [x] 错误后可以恢复；
- [x] 新结果完全替换旧结果；
- [x] 真实响应经过 Schema/Adapter；
- [x] 回归 Fixture 已保存。

## 执行记录

- 本地 LLVM 14 `/compile` 和 `/optimise-structured` 已使用
  `e2e-multi-function.c` 跑通，真实响应包含 2 个函数和 153 个配对 Pass，
  其中 18 个 Pass 改变了 IR；
- tRPC `compiler.optimiseStructured` 在服务边界验证 v1 Schema，客户端再次通过
  Schema/Adapter 后才加载 Workspace；
- 浏览器验证覆盖有效 C、同步重复点击、编译错误、服务停止、连续两个不同输入以及
  错误后修改重试；新运行开始时旧 Workspace 被清除，第二次结果不保留第一次函数；
- 编译、服务不可用、超时和 Schema 错误使用独立的安全用户消息，服务内部路径仅写入
  服务器技术日志；
- 真实回归数据保存在
  `src/test-data/compiler-optimisation/day2-real-backend.json`，临时路径已清理。

## 风险与处理

- 接口尚不稳定：只在集成入口做临时 Adapter，不修改展示组件；
- 服务耗时长：显示阶段状态并保持后端超时；
- 错误文本包含内部路径：用户消息与技术日志分离。

## 下一日交接

提供成功 C 路径、失败复现步骤、真实回归 Fixture和仍待解决的 C++/边界问题。
