# TheOpenHub Skills Studio 开发计划

## Summary

- 基于 `references/deep-research-report.md` 制定全路线图，但采用报告中的备选栈：Electron + React + Node + SQLite。
- 当前仓库是空仓库，只有研究报告；本计划按“从零建立本地优先桌面 Skills 管理器”推进。
- 核心原则：SQLite 是本地事实源，Agent skills 目录只是安装投影；默认离线，不建强制账号或云市场。

## Approach

- 选定方案：Electron 模块化单体。Electron main process 承载 Node 服务、SQLite、文件系统和安全边界；React renderer 只通过 typed preload IPC 调用能力。
- 备选但不采用：独立 Node daemon + Electron shell。更利于远期自动化，但首期生命周期、端口、安全面更重。
- 不采用：OpenSkills CLI + 薄 GUI。原型快，但难支撑本地 DB、历史、安全中心、同步和插件路线图。

## Key Changes

- 建立 pnpm TypeScript workspace：`apps/desktop` 放 Electron/Vite/React，`packages/core` 放领域服务，`packages/db` 放 SQLite migrations，`packages/adapters` 放 Agent adapters，`packages/shared` 放 IPC/types。
- 数据模型首批覆盖：`Skill`、`SkillVersion`、`SkillFile`、`BlobObject`、`Agent`、`AgentRoot`、`Installation`、`Source`、`Collection`、`SecurityScan`、`SyncProfile`、`PluginManifest`。
- 稳定接口：`AgentAdapter.detect/list/install/uninstall/verify`、`Importer.import`、`SecurityRule.scan`、`SyncDriver.push/pull/resolve`、typed IPC channels：`library.*`、`import.*`、`install.*`、`security.*`、`sync.*`、`plugins.*`。
- UI 信息架构：Dashboard、Library、Skill Detail、Import、Install Plan、Security Center、Sync Center、Settings、Plugins。
- 安全默认值：renderer 禁用 Node integration；所有路径 canonicalize；ZIP/Git 导入先进入临时隔离区；高危安全扫描可阻断安装；凭证只进 OS keychain，不写 SQLite。

## Roadmap

- P0 基础闭环：Electron app shell、SQLite schema/migrations、本地库、Codex/Claude/Gemini/OpenCode adapters、首次启动检测、导入本地目录/Git/ZIP、安装/卸载、导出包、路径安全。
- P1 治理能力：版本历史、content-addressed blob store、diff/rollback、集合、批量操作、安全中心、存量巡检、风险豁免。
- P2 离线优先同步：outbox/inbox、共享文件夹同步、Git sync、自托管 REST sync、冲突中心；默认关闭，用户显式启用。
- P3 插件生态：插件 manifest、权限声明、adapter/importer/security-rule/sync-driver 扩展点、签名校验、插件目录管理。
- P4 发布与团队分发：macOS/Windows/Linux packaging、签名、公测更新通道、团队基线包、审批/审计导出。

## Test Plan

- Unit：SKILL.md parser、SQLite migrations、path sanitizer、adapter path rules、diff engine、security rules、IPC schema validation。
- Integration：真实目录夹具扫描、Git/ZIP/local import、install/uninstall/rollback、导出再导入、大规模 skills 索引。
- E2E：首次启动、Agent 检测、导入一个 skill、安全扫描阻断高危 skill、安装到个人/项目 scope、同步冲突解决。
- Security：path traversal、symlink escape、zip slip、命令注入规则、无明文 token、renderer 不能直接访问 fs/Node。
- Release：每个平台 smoke test，验证安装包启动、数据库迁移、自动更新关闭默认联网、崩溃日志不含 skill 内容。

## Assumptions

- 产品工作名默认用 TheOpenHub Skills Studio；后续可单独改品牌，不影响架构。
- 虽然研究报告首选 Tauri，当前计划按指定采用 Electron 备选方案。
- 全路线图会写进计划，但实现应按 P0 到 P4 逐阶段验收，不能把同步和插件提前混进 P0。
- 本文件是开发计划来源文档；后续进入实现前，应再拆成可执行 SPEC 和阶段性 PLAN。
