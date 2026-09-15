# IoT CONTROL · Intelligent Operations Console

<p align="center">

AI-powered IoT Operations Platform<br>
Digital Twin · Incident Intelligence · Knowledge Loop<br>
🚀 Portfolio Project · 2026

</p>

<p align="center">

[简体中文](README.md) | **English**

</p>

<p align="center">

**🌐 [Live Demo](https://khalilyong221.github.io/iot-dashboard-demo/) ·
[3-Minute Walkthrough](https://khalilyong221.github.io/iot-dashboard-demo/demo.html)**

</p>

<p align="center">

<img src="assets/img/banner.png" width="100%">

</p>

---

## Table of Contents

- [Quick Start](#quick-start)
- [Live Demo and Entry Pages](#live-demo-and-entry-pages)
- [Demo Walkthrough](#demo-walkthrough)
- [Overview](#overview)
- [Core Capabilities](#core-capabilities)
- [System Architecture](#system-architecture)
- [About the Demo Data](#about-the-demo-data)
- [Demo Screenshots](#demo-screenshots)
- [Tech Stack](#tech-stack)
- [Project Structure](#project-structure)
- [Roadmap](#roadmap)
- [Author](#author)

---

## Quick Start

No framework, no build step — clone it and serve it:

```bash
python -m http.server 8000
# open http://127.0.0.1:8000/
```

You can also open `index.html` directly. Be aware that work orders and the knowledge base
live in `localStorage`: when the site is opened over `file://`, some browsers restrict local
storage and the pages can no longer share data. **Use a local server if you want to walk the
full closed loop.**

If it is your first visit, start from
[`demo.html`](https://khalilyong221.github.io/iot-dashboard-demo/demo.html) —
8 steps that take you from one faulty device to a captured piece of knowledge.

---

## Live Demo and Entry Pages

**🌐 https://khalilyong221.github.io/iot-dashboard-demo/**

| Entry | Page | Purpose |
|---|---|---|
| `index.html` | Operations Console | Main entry: 1,000-device picture, scenario switching, live incidents, daily snapshot, AI assistant |
| `demo.html` | From anomaly to knowledge: a complete IoT loop | 3-minute route: anomaly → diagnosis → work order → knowledge capture |
| `iot-monitor-center.html` | YunShu IoT · Monitoring Center | Single-page monitoring center, handy for sharing as one link |
| `pages/china-map.html` | Nationwide Device Map | China map with **province / city / county** drill-down, 1,000 devices placed by administrative region and coloured by status; click a device to jump to its record |
| `pages/device-detail.html` | Device Detail | Single asset record: live parameters, 8-hour trend, peer groups by site and by gateway, health score, AI diagnosis, one-click work order |
| `pages/user.html` | HomeFlow · Smart Home (user side) | Home view: 92 devices / 10 rooms / 10 one-tap scenes |
| `pages/portfolio.html` | Portfolio | Ties the pages above into one shareable portfolio |

**Deep links**: every device-related page accepts `?device=<device-id>`, so you can send a single
device to someone else. For example `index.html?device=IOT-0445#ai-section` opens that device's
record and expands the AI root-cause panel; `pages/alerts.html?device=…`,
`pages/topology.html?device=…` and `pages/maintenance.html?device=…` land on incident context,
blast radius and work orders respectively (`device-detail.html` uses `?id=` as its main parameter
and also accepts `?device=`).

**Demo case device**: the 8 steps in `demo.html` hard-code no device id. At runtime it picks the
device that is genuinely offline right now and has been offline the longest. Change the data and
the walkthrough follows — you will never "click through the demo and land on a healthy device".

---

## Demo Walkthrough

The 8 steps in `demo.html`, each mapped to a real page and a deep link:

| # | Step | Lands on |
|---|---|---|
| 01 | Establish the global picture | `index.html` |
| 02 | Locate it on the nationwide map | `pages/china-map.html?scene=field` |
| 03 | Pin down the faulty asset | `index.html?device=…#devices` |
| 04 | Confirm the incident context | `pages/alerts.html?device=…` |
| 05 | Let AI explain it | `index.html?device=…#ai-section` |
| 06 | Check the blast radius | `pages/topology.html?device=…` |
| 07 | Move to field work | `pages/maintenance.html?device=…&from=demo` |
| 08 | Capture the knowledge afterwards | `pages/maintenance.html?device=…` |

---

## Overview

An **IoT + AI operations platform prototype** for industrial equipment maintenance, plus a
smart-home user console as a second branch.

The point is not "one more dashboard". It is to push conventional monitoring three steps further:
**anomalies can be explained, actions reach closure, and experience is retained**. Beyond device
status there is a complete chain — offline device → AI hypotheses and evidence → P1/P2 work order →
result written into the knowledge base → the next diagnosis prefers solutions already proven.

面向工业设备运维场景的 IoT + AI 智能运营平台原型：把传统设备监控从"看得见"推进到
"解释得清、处置得掉、沉淀得下"，以纯静态站点实现，无后端。

---

## Core Capabilities

| Module | Capability | Entry |
|---|---|---|
| Device Monitoring | 1,000-device picture; switch between Industrial Internet / Building Automation / Smart Home / All devices; live incident feed and daily snapshot | `index.html` |
| Digital Twin Topology | Four-level asset tree (park → zone → gateway → device) linked to a force-directed graph; node inspector shows health, online count, last signal and blast radius | `pages/topology.html` |
| Alerts and Incidents | Incident context sorted by risk score; reachable directly via `?device=` deep links | `pages/alerts.html` |
| AI Root-Cause Analysis | Hypotheses ranked by probability + confidence + evidence chain (RSSI / temperature / last report / health); offline devices take a link-troubleshooting branch | `index.html#ai-section` |
| Work Orders and Field Work | P1/P2 work-order state machine (In progress → Pending verification → Done), with totals, open count and average MTTR | `pages/maintenance.html` |
| Knowledge Loop | Results (root cause / fix / priority / hours) are written to the knowledge base; diagnosis recalls historical cases from the same zone and the same root cause | `pages/maintenance.html` |
| Operations Analytics | Health trend, energy consumption, risk ranking | `pages/analytics.html` |
| Nationwide Device Map | Province / city / county drill-down, devices coloured by status, click through to the record | `pages/china-map.html` |
| Device Record | Live parameters, 8-hour trend, peer groups by site and by gateway, health score, AI diagnosis, one-click work order | `pages/device-detail.html` |
| Smart Home Console | Home view: 92 devices / 10 rooms / 10 one-tap scenes, plus a summary of devices needing attention | `pages/user.html` |

---

## System Architecture

<p align="center">

<img src="assets/img/architecture.png" width="100%">

</p>

Three layers: views (one set of pages shared by three front ends) → shared data model → operations loop.

```text
Device Layer
 ↓
IoT Gateway
 ↓
Telemetry Pipeline
 ↓
Operations Center
 ↓
AI Diagnosis Engine
 ↓
Knowledge Loop
```

---

## About the Demo Data

This is a **backend-free** prototype: devices, telemetry and incidents are all generated in the
browser by `assets/js/shared-data.js`. It is worth spelling out, because these are exactly the
parts that look like "made-up dummy data":

- **Deterministic pseudo-randomness**: `mulberry32` plus slot shuffling (`slotPool`). The same seed
  always yields the same result, so screenshots, demos and regression runs all see the same devices —
  nothing "changes completely on refresh".
- **Online rate matched to a real fleet**: 930 online / 45 warning / 25 offline in the industrial
  domain (**93.0%**). An earlier version used a 400 / 200 / 400 split, which was far away from a real
  fleet's online rate.
- **Model, zone and status are independent**: originally all three were derived from the same
  `index % 5` step, so "every device in one zone shared one model and was offline". Model and status
  now each use their own shuffled slot table, while the overall ratio is preserved (so the headline
  numbers on the console do not drift).
- **The AI is a rule-driven inference chain, not an LLM call**: status / RSSI / temperature / gateway
  relationship → ranked hypotheses + confidence + recommended actions, then knowledge-base recall on
  top. Every conclusion is therefore reproducible and explainable.
- **Local storage**: the device model (storageKey `v6`), work orders (`iot-work-orders-v2`) and the
  knowledge base (`iot-knowledge-base-v2`) all live in `localStorage`; clearing it resets the demo.

---

## Demo Screenshots

The product UI and all screenshots below are in Chinese; each caption explains what the view shows.

### IoT Operations Dashboard

1,000 devices at 93.0% online, switchable between Industrial Internet / Building Automation /
Smart Home / All devices; park-level device map, live incident feed, device asset table and the
daily operations snapshot all fit on one screen.

<p align="center">

<img src="screenshots/dashboard.png" width="850">

</p>

### Digital Twin Topology

Four-level asset tree (park → zone → gateway → device) linked to a force-directed graph; the node
inspector on the right shows health, online count and last signal, with blast radius at the bottom.

<p align="center">

<img src="screenshots/topology.png" width="850">

</p>

### AI Diagnosis Assistant

A genuinely offline device as an example: 78% confidence, three root-cause hypotheses ranked by
probability (gateway link down / wireless coverage degraded / device power loss), four recommended
actions and an evidence chain — plus a recall of 1 historical case with the same root cause and a
14-minute average MTTR.

<p align="center">

<img src="screenshots/ai-diagnosis.png" width="850">

</p>

### Smart Home User Console

The home user's overview: 92 devices, 10 room zones, with energy and air quality at a glance.

<p align="center">

<img src="screenshots/user-hero.png" width="850">

</p>

### One-tap Scenes and Cross-device Automation

10 one-tap scenes (Coming home / Leaving / Good night / Movie / Wake up / Guests / Gaming /
Eco / Cooking / Bedtime reading). Each scene drives multiple devices and rolls up the device
anomalies that need attention.

<p align="center">

<img src="screenshots/user-scenes.png" width="850">

</p>

### Nationwide Device Map · Province / City / County Drill-down

1,000 devices spread across the China map: the national view is shaded by province density with a
TOP ranking, click a province for cities and a city for counties, devices are plotted as
online / warning / offline dots.

<p align="center">

<img src="screenshots/china-map-nation.png" width="850">

</p>

Province view (Guangdong): device dots across 21 cities, city ranking and device list.

<p align="center">

<img src="screenshots/china-map-province.png" width="850">

</p>

City → county drill-down (Guangzhou): 11 districts and where each device belongs.

<p align="center">

<img src="screenshots/china-map-city.png" width="850">

</p>

### Device Detail · From Map Pin to Asset

Any device on the map jumps straight to its record: site semantics (park / factory / home), live
parameters, 8-hour trend, peer groups by site and by gateway, health score and AI advice.

Diagnosis is differentiated by device state: offline devices get a fault reason plus three
remediation steps; devices in a warning state are told "still reporting, but link quality has
degraded"; healthy devices are given no fault reason at all. Any device can **generate a work
order** — id / date / type / owner / hours go into the local work-order history, which also rolls
up total orders, open count and average MTTR.

<p align="center">

<img src="screenshots/china-map-device-card.png" width="850">

</p>

<p align="center">

<img src="screenshots/device-detail.png" width="850">

</p>

---

## Tech Stack

- **Front end**: HTML5 / CSS3 / vanilla JavaScript — no framework, no build step, clone and run
- **Charts**: ECharts (nationwide map, operations analytics)
- **Map data**: public administrative boundary data, simplified and packed into 35 `.js` files
  (build script in `tools/build-geo.py`)
- **Storage**: `localStorage` (device model / work orders / knowledge base)
- **Deployment**: GitHub Pages

Details: device table rows open with keyboard `Enter` / `Space`, map pins and key controls carry
`aria-label`; the illustrations (banner, architecture diagram) are generated from HTML sources under
`tools/` with headless Chrome, so they are easy to regenerate and edit.

---

## Project Structure

```text
iot-dashboard-demo
│
├── README.md                   Chinese version (default)
├── README.en.md                English version
│
├── index.html                  Main entry · operations console
├── demo.html                   3-minute walkthrough
├── iot-monitor-center.html     Single-page monitoring center
│
├── pages/                      Feature pages (each with its own .css / .js)
│   ├── alerts.html             Alert center
│   ├── analytics.html          Operations analytics
│   ├── topology.html           Digital twin topology
│   ├── maintenance.html        Work orders and field service
│   ├── user.html               Smart home console (92 devices / 10 scenes)
│   ├── china-map.html          Nationwide device map (province / city / county)
│   ├── device-detail.html      Device detail (site / home / factory + AI + work orders)
│   └── portfolio.html          Portfolio page
│
├── assets/
│   ├── css/                    Shared styles
│   │   ├── base.css            Base layer (@import-ed by dashboard-v2.css)
│   │   ├── dashboard-v2.css    Console theme
│   │   ├── ai-operations.css   AI assistant panel
│   │   └── knowledge-loop.css  Knowledge loop
│   ├── js/                     Shared scripts
│   │   ├── shared-data.js      Device data model (used by every page)
│   │   ├── dashboard-app.js    Console logic
│   │   ├── dashboard-enhance.js
│   │   ├── ai-operations.js    AI operations analysis
│   │   ├── knowledge-loop.js   Knowledge loop
│   │   └── iot-center.js       Monitoring center logic
│   ├── data/geo/               Administrative boundary data (35 .js files, see build-geo.py)
│   ├── vendor/echarts.min.js   Charting library
│   └── img/                    README illustrations
│
├── tools/
│   ├── build-geo.py            Boundary data build script (fetch → simplify → pack)
│   ├── banner.html             Source of the README banner (headless Chrome → banner.png)
│   └── architecture.html       Source of the architecture diagram (same method)
│
├── docs/                       Design documents
│   ├── architecture.md
│   ├── ai-agent-comparison.md
│   └── development-log.md
│
└── screenshots/                README screenshots
```

---

## Roadmap

- Real MQTT ingestion and a time-series database, replacing the local deterministic data
- From "has happened" to "is about to happen": a predictive maintenance model
- 3D digital twin visualisation
- Multi-tenancy, roles and an operation audit trail
- From rule-based inference to explainable model-assisted diagnosis

---

## Author

**Khalil Zheng** · IoT Project Manager

Working in HVAC/building intelligence and IoT system integration, from a project management background.
This is a personal portfolio prototype; all data is for demonstration only.
