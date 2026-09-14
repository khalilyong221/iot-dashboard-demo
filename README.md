# IoT 智能运维与设备管理平台

> IoT + AI Product Case · Portfolio Demo · 2026

一个用于展示 **IoT 产品设计、系统抽象、项目交付思维与 AI 协作开发能力** 的 Web 作品。

## ✦ 作品入口

- **Portfolio / 项目案例页**：`portfolio.html`
- **管理端 Demo**：`index.html`
- **用户端 Demo**：`user.html`

## 产品定位

从“设备监控大屏”升级为一套完整的 IoT 智能运维产品概念：

`设备监控 → 设备中心 → 告警闭环 → 能耗分析 → AI 运维助手`

## 核心模块

1. 总览驾驶舱：设备规模、在线率、告警、网络健康、园区拓扑
2. 设备中心：设备、区域、网关、遥测、历史数据
3. 告警中心：异常发现、分级、处理、恢复的运维闭环
4. 能耗分析：电 / 水 / HVAC 等运营数据分析入口
5. AI 运维助手：根据设备状态、信号、网关与时间窗口辅助异常诊断
6. 用户端：家庭设备查看、控制与场景联动

## 系统思路

```text
设备 / 传感器
      ↓
Modbus / RS485 / BACnet / OPC UA
      ↓
IoT Gateway
      ↓
MQTT / HTTP / WebSocket
      ↓
IoT 数据平台
      ↓
管理端 / 用户端 / AI 运维助手
```

当前 Demo 使用浏览器模拟数据，重点验证产品结构与交互；真实项目可进一步接入 MQTT、WebSocket、HTTP API、数据库和 AI 服务。

## 技术栈

HTML5 · CSS3 · JavaScript · GitHub · AI-assisted development

## 我的角色

- 需求场景抽象
- 产品信息架构与交互设计
- IoT 设备与业务流程建模
- Demo 快速验证
- AI 辅助开发与迭代
- 面向技术团队的方案表达

## 开发记录

见 `docs/development-log.md`。

---

本项目为个人作品集 Demo，数据均为演示数据。