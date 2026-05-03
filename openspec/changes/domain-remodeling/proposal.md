# Change Proposal: Domain Remodeling

## Summary
Refactor the domain model to move remote configuration from individual Items to Projects, introduce a "Default Local Project," and simplify the relationship between Items and TimeEntries.

## Problem Statement
The current model (MVP) associates remote configuration (Target, BaseUrl) with individual Items. This leads to configuration duplication and makes it harder to manage multiple issues under the same remote project. Additionally, the boundary between "local-only" and "remote-mapped" items is too rigid.

## Proposed Changes
- **Project-Centric Configuration**: Remote Target and BaseUrl are moved to the `Project` entity.
- **System Anchor**: Introduce an `IsDefault` flag for Projects (only one can be default). A "Local" project is created by default and cannot be deleted.
- **Fluid Items**: Items act as grouping containers. They can be local-only or mapped to a remote ID.
- **Title Inheritance**: `Item.Title` caches the remote issue title when matched, or copies the initial `TimeEntry.Title` for local items.
- **Simplified Entries**: Remove the `Note` field from `TimeEntry`; the `Title` is sufficient for a single task.
- **Token Security**: API keys/tokens remain in browser `localStorage`, mapped by Project ID.

## Goals
- Centralize remote system configuration.
- Support seamless transition from "local tracking" to "remote matching."
- Simplify the data model for better performance and maintainability.

## Non-Goals
- Server-side token storage (Security requirement).
- Automated background synchronization (Still client-triggered).
