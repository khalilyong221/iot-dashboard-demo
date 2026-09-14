# AIoT Operations Platform 系统架构说明

## 1. 项目定位

AIoT Operations Platform 是一个面向工业物联网场景的智能运维平台 Demo。

项目围绕：

设备接入（Device）
→ 状态监控（Status）
→ 异常检测（Incident）
→ AI诊断（Diagnosis）
→ 运维闭环（Action）
→ 知识沉淀（Learning）

构建设备智能运营体系。

---

# 2. 整体架构
┌────────────────────────────┐
│ User Interface │
│ Web Dashboard / Console │
└──────────────┬─────────────┘
│
▼
┌────────────────────────────┐
│ IoT Operation Layer │
│ │
│ Device Monitor │
│ Alarm Center │
│ Analytics Center │
│ Maintenance Workflow │
└──────────────┬─────────────┘
│
▼
┌────────────────────────────┐
│ AI Intelligence │
│ │
│ Fault Diagnosis │
│ Root Cause Analysis │
│ Maintenance Recommendation │
│ Knowledge Loop │
└──────────────┬─────────────┘
│
▼
┌────────────────────────────┐
│ Device Layer │
│ │
│ Sensors │
│ Gateway │
│ Industrial Equipment │
└────────────────────────────┘

---

# 3. 核心模块

## 3.1 设备监控中心

功能：

- 在线设备统计
- 实时状态展示
- 设备健康度分析
- 数据趋势查看


---

## 3.2 告警中心

功能：

- 异常事件发现
- 告警等级管理
- 事件确认
- 处理闭环


告警流程：
Detection
↓
Alarm
↓
Diagnosis
↓
Action
↓
Verification

---

## 3.3 AI 运维助手

AI能力：

- 异常原因分析
- 历史案例匹配
- 运维建议生成
- 维修知识推荐


---

## 3.4 Knowledge Loop

知识闭环：
设备异常
↓
人工处理
↓
形成案例
↓
AI学习
↓
下一次快速诊断

---

# 4. 数据流设计
Sensor Data
  ↓
Device Gateway
  ↓
IoT Platform
 ↓

Monitoring Service

  ↓

AI Analysis

  ↓

Operation Decision

---

# 5. 技术实现

当前 Demo：

Frontend:

- HTML
- CSS
- JavaScript
- ECharts


Future Extension:

Backend:

- Node.js / Python
- MQTT
- REST API

Data:

- Time Series Database
- Device Metadata

AI:

- LLM Diagnosis
- RAG Knowledge Base

---

# 6. 项目目标

打造一个具备：

- IoT设备管理能力
- 实时数据可视化能力
- AI辅助运维能力
- 工业场景产品设计能力

的完整 AIoT 产品 Demo。
