# Flowbit Memory-Driven Agent 🧠

![TypeScript](https://img.shields.io/badge/TypeScript-Strict_Mode-blue)
![SQLite](https://img.shields.io/badge/SQLite-Hybrid_Schema-003B57)


---

## 📖 Overview

This project is a technical implementation of a "Memory-Driven" AI agent. Unlike standard OCR tools that make the same mistake repeatedly, this agent **learns from human corrections**.

It uses a local **SQLite** database to store "Memories" (rules/patterns) and assigns them a **Confidence Score**. As the agent successfully applies memories, their confidence increases (Reinforcement). If a rule is unused, it decays.

## ✨ Key Features

* **Vendor-specific learning:** Automatically learns context such as field mappings, VAT correction rules, currency recovery, and SKU mapping.
* **Confidence-based memory recall:** Uses a weighted confidence matrix (OCR score × Memory score) to decide when to trust a rule.
* **Time-based memory decay:** Automatically lowers the confidence of stale or unused rules to prevent outdated behavior.
* **Full audit trail:** Logs every step (Recall → Apply → Decide) for complete transparency.
* **Duplicate invoice detection:** Uses fuzzy date matching and hash checks to reject duplicate submissions instantly.
* **Deterministic, explainable logic:** No "black-box" AI hallucinations; every decision is traceable to a specific, stored rule.

---

## 🛠️ Core Components

* **`recall.ts` — Memory Retrieval**
  * Fetches vendor-specific rules from the database.
  * Filters by minimum confidence.
  * Applies time-based confidence decay to avoid stale rules.
  * Returns only trusted, eligible memories.

* **`apply.ts` — Rule Application**
  * Applies recalled memories deterministically to the invoice.
  * Only fills missing or uncertain fields.
  * Produces explicit, explainable corrections.
  * Tracks which memories were actually used.

* **`decide.ts` — Decision Logic**
  * Evaluates risk based on: Applied corrections, Memory confidence, and Extraction confidence.
  * Determines auto-approval vs human review.
  * Outputs a final confidence score and reasoning.

* **`learn.ts` — Memory Evolution**
  * Updates memory confidence only after human feedback.
  * Reinforces correct rules and decays incorrect ones.
  * Records resolution outcomes for traceability.
  * Skips learning for duplicate invoices.

* **`engine.ts` — Orchestration Layer**
  * Controls the full invoice lifecycle.
  * Enforces duplicate detection.
  * Coordinates recall, apply, decide, and learn phases.
  * Aggregates audit logs into a single traceable result.


---

## 🔄 System Architecture

The agent follows a strict **Event-Driven Pipeline**:

```mermaid
graph LR
    A[Raw Invoice] --> B(Recall)
    B --> C(Apply)
    C --> D{Decide}
    D -- High Confidence --> E[Auto-Approve]
    D -- Low Confidence --> F[Human Review]
    F --> G(Learn)
    G --> H[(Memory DB)]
    H --> B
