# GitHub Repository Setup & Configuration Guide

This document outlines the required manual configuration steps to be performed in the GitHub Repository Settings UI for the **OSI Time Tracker** project. These settings enforce continuous integration, security policies, and branch integrity on the `main` branch.

---

## 1. Secrets Configuration

To enable the automated end-to-end (E2E) testing job, you must add the required session password secret to your repository.

### Steps:

1. Navigate to your repository on GitHub.
2. Click on the **Settings** tab.
3. In the left sidebar, expand **Secrets and variables** and click on **Actions**.
4. Click the **New repository secret** button.
5. Enter the following details:
   - **Name:** `NUXT_SESSION_PASSWORD`
   - **Secret:** A 32+ character secure, random string (used by `nuxt-auth-utils` to seal session cookies).
6. Click **Add secret**.

---

## 2. CodeQL Static Analysis Setup

We utilize CodeQL to scan our TypeScript and JavaScript codebase for potential security vulnerabilities and bugs.

### Steps:

1. Navigate to the **Security** tab of your repository on GitHub.
2. In the left sidebar under **Vulnerability alerts**, click on **Code scanning**.
3. Click on the **Set up code scanning** button (or **Configure** under CodeQL analysis).
4. Select **Default** configuration.
5. Review the settings (it will scan on pushes to `main` and on pull requests) and click **Enable CodeQL**.

---

## 3. Pull Request Merge Options

To maintain a clean, linear, and comprehensible commit history on `main`, we enforce squash merges where the PR title becomes the sole merge commit message.

### Steps:

1. Navigate to the **Settings** tab of your repository.
2. On the **General** settings page, scroll down to the **Pull Requests** section.
3. Apply the following settings:
   - [x] **Allow squash merging**
   - [ ] **Allow merge commits** (disabled)
   - [ ] **Allow rebase merging** (disabled)
4. Under squash merging, configure the default commit message to **Pull request title** or **Pull request title and description** (ensures Conventional Commits enforced at the PR title level are preserved on the `main` branch).

---

## 4. Branch Ruleset for `main`

To keep the `main` branch green and stable, a ruleset is enforced on `main`. This requires all continuous integration status checks to pass and blocks unverified code from being merged.

### Note on Check Selection (Important!)

> **Status checks are only selectable in the ruleset UI after they have executed at least once** on a branch in the repository. Before configuring the rules, you must:
>
> 1. Push the workflow files (`.github/workflows/ci.yml` and `.github/workflows/pr-title.yml`) to a branch.
> 2. Open a throwaway Pull Request targeting `main`.
> 3. Let all jobs run to completion once.
> 4. Go back to Settings and select these checks in your ruleset.

### Ruleset Steps:

1. Go to the **Settings** tab of your repository.
2. In the left sidebar, click on **Rules** -> **Rulesets**.
3. Click **New ruleset** and select **New branch ruleset**.
4. Enter the following details:
   - **Ruleset Name:** `Enforce CI & Branch Integrity`
   - **Enforcement status:** `Active`
5. Under **Target branches**, select **Add target** -> **Include by name** and enter `main` (or click `default branch`).
6. Under **Branch rules**, enable and configure the following rules:

   - **Require a pull request before merging:**
     - Enable this rule.
     - [ ] **Require approvals** (disabled/unchecked, as this is a solo developer project; reviews stay off).
     - [ ] **Require review from Code Owners** (disabled).
     - [ ] **Restrict dismissals** (disabled).
     - [ ] **Require post-resolve review** (disabled).
     - [ ] **Require approval of the most recent reviewable push** (disabled).

   - **Require status checks to pass before merging:**
     - Enable this rule.
     - [x] **Require branches to be up to date before merging** (forces branch up-to-date with `main` before merging, preserving linear history).
     - Search for and add the following **Status checks** (must exact-match our GitHub Actions jobs):
       1. `lint` (defined in `ci.yml`)
       2. `format` (defined in `ci.yml`)
       3. `type-check` (defined in `ci.yml`)
       4. `unit` (defined in `ci.yml`)
       5. `nuxt` (defined in `ci.yml`)
       6. `build` (defined in `ci.yml`)
       7. `e2e` (defined in `ci.yml`)
       8. `Validate PR title` (defined in `pr-title.yml`)

   - **Require conversation resolution before merging:**
     - Enable this rule (requires all comments and discussions on the PR to be resolved before merge).

7. Keep the **Merge queue** turned **off** (reviews and merge queue stay off for solo development).
8. Click **Create** or **Save changes**.
