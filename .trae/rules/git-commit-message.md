---
alwaysApply: true
scene: git_message
---

提交信息必须遵循以下规范:

格式:
<type>(<scope>): <subject>

<body>

<footer>

说明:
- 标题行为必填
- `scope` 可选，不需要时使用 `<type>: <subject>`
- `body` 和 `footer` 建议填写，但可按实际改动省略
- 冒号后必须保留一个空格

允许的 `type`:
- `feat`: 新功能、新特性
- `fix`: 修复 bug
- `perf`: 性能优化
- `refactor`: 重构，保持外部行为不变
- `docs`: 文档修改
- `style`: 代码格式修改，不含功能改动
- `test`: 测试新增或修改
- `build`: 构建或依赖相关修改
- `revert`: 回滚提交
- `ci`: 持续集成相关修改
- `chore`: 其他杂项修改
- `release`: 发布版本
- `workflow`: 工作流相关修改

`scope` 建议:
- 使用简短、小写、可读的英文标识
- 示例: `global` `common` `route` `component` `utils` `build` `backend` `frontend`

生成提交信息时:
- 优先准确表达本次改动的主要目的
- `subject` 简洁明确，不写句号
- `body` 说明为什么修改、改了什么、是否有兼容性考虑
- `footer` 可写 `Refs: #123`、`Closes: #123` 或 `BREAKING CHANGE: ...`

示例:
- `fix(global): 修复 checkbox 不能复选的问题`
- `fix(common): 修复默认字体过小的问题`
- `feat: 添加网站主页静态页面`
- `chore: 将表格中的查看详情改为详情`
