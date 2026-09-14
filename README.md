# IoT 智能运维与设备管理平台

> IoT + AI Product Case · Portfolio Demo · 2026

一个用于展示 **IoT 产品设计、系统抽象、项目交付思维与 AI 协作开发能力** 的 Web 作品。

## ✦ 作品入口

- **Portfolio / 项目案例页**：`portfolio.html`
- **管理端 / IoT Operations Center**：`index.html`
- **告警中心 / Incident Center**：`alerts.html`
- **资产拓扑 / Digital Twin**：`topology.html`
- **运营分析 / Analytics**：`analytics.html`
- **维护工单 / Maintenance**：`maintenance.html`
- **用户端 Demo**：`user.html`

## 产品定位

从“设备监控大屏”升级为围绕 **Asset → Status → Incident → Diagnosis → Action → Learning** 的 IoT 智能运维产品概念。

## 核心模块

1. **总览驾驶舱**：设备规模、在线率、告警、网络健康、运营指标
2. **资产拓扑**：园区 → 区域 → 网关 → 设备，展示状态与故障影响范围
3. **告警中心**：异常发现、分级、确认、诊断、处置、恢复
4. **运营分析**：Availability、OEE、MTBF、MTTR、Energy 趋势与对比
5. **AI 根因诊断**：基于设备状态、RSSI、温度、网关、时间窗口等证据形成根因假设与建议
6. **维护工单**：Incident → Diagnosis → Work Order → Field Action → Verification
7. **AI Knowledge Loop**：完成工单后沉淀根因、处置方案、优先级、MTTR；历史案例反向辅助下一次诊断
8. **用户端**：家庭设备查看、控制与场景联动

## 运维闭环

```text
Detect
  ↓
Acknowledge
  ↓
Diagnose  ← AI + telemetry + topology + historical cases
  ↓
Act       → Work Order
  ↓
Recover   → Verification
  ↓
Learn     → Knowledge Base
  ↺
下一次异常继续复用历史经验
```

## 系统思路

```text
园区 / 区域
      ↓
IoT Gateway
      ↓
设备 / 传感器 / 控制器
      ↓
Telemetry + Event
      ↓
IoT Operations Platform
      ├── Asset Topology
      ├── Incident Center
      ├── Analytics
      ├── Maintenance
      └── Knowledge Loop
                ↕
            AI Copilot
```

## 数据与实现

当前 Demo 使用浏览器模拟 IoT 数据，并通过共享数据模型驱动多个页面；核心状态可在页面间同步。真实项目可进一步接入 MQTT、WebSocket、HTTP API、时序数据库、关系数据库和 AI 服务。

## 技术栈

HTML5 · CSS3 · JavaScript · LocalStorage / CustomEvent · GitHub · AI-assisted development

## 我的角色

- 需求场景抽象
- 产品信息架构与交互设计
- IoT 资产、事件与业务流程建模
- 运维闭环设计
- Demo 快速验证
- AI 辅助开发、重构与调试
- 面向技术团队的方案表达

## 开发记录

见 `docs/development-log.md`。

---

本项目为个人作品集 Demo，数据均为演示数据。