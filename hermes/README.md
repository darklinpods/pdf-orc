# Hermes 项目文档

本目录采用 Hermes 范式保存 `pdf-orc` 的长期项目记忆与交接上下文。目标是让开发者或 AI 在开始施工前，先恢复产品目标、系统边界、工程约束、当前状态和历史决策。

## 阅读顺序

1. [project.md](./project.md)：产品目标、用户、核心能力与范围边界。
2. [architecture.md](./architecture.md)：技术结构、关键数据流与边界。
3. [conventions.md](./conventions.md)：实现、交互与验证约定。
4. [current.md](./current.md)：当前工作区状态、待确认决策和下一步。
5. [decisions/README.md](./decisions/README.md)：重要技术决策及其原因。

## 维护规则

- 文档描述当前事实，不复制容易过期的大段代码。
- 新功能或行为变化先更新 `current.md`；形成长期约束后同步到对应主题文档。
- 影响架构、兼容性或用户数据的取舍，以 ADR 记录到 `decisions/`。
- 每个结论尽量包含相关文件路径和可执行的验证方式。
- 工作完成后清理 `current.md` 中的临时事项，保留可追溯的决策记录。

## Hermes 交接清单

- 确认 `git status --short`，不要覆盖不属于当前任务的本地改动。
- 阅读 `current.md`，区分已实现、待验证与待决策事项。
- 修改文档核心时，同时考虑命令可逆性、撤销语义与导出映射。
- 至少执行 `npm run test`、`npm run build`、`npm run lint`、`git diff --check`。
- 涉及 pdf.js / pdf-lib 的行为，登记为手工验证项（扫描件兼容性、200+ 页性能）。
- 发布前同步 `current.md` 的测试数字、分支状态和未完成验证，不留下已过期结论。
