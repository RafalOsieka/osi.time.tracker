# Spec Delta

## ADDED Requirements

### Requirement: REQ-530 Production deploys are explicit and gated
A production deploy SHALL start only by an explicit operator action on `main`, and SHALL publish that commit only after every quality gate has passed for it. Merging to `main` SHALL NOT deploy.

#### Scenario: Merge does not deploy
- **WHEN** a pull request is merged to `main`
- **THEN** the quality gates SHALL run and nothing SHALL be published or deployed

#### Scenario: Deploy requested on main with passing gates
- **WHEN** the operator requests a deploy on `main` and every quality gate passes
- **THEN** that commit SHALL be published and handed to production

#### Scenario: Failing gate stops the deploy
- **WHEN** the operator requests a deploy and any quality gate fails
- **THEN** nothing SHALL be published and production SHALL keep running the same build

#### Scenario: Deploy requested from another branch
- **WHEN** the operator requests a deploy on a branch other than `main`
- **THEN** nothing SHALL be published or deployed

### Requirement: REQ-531 A deploy succeeds only when production reports its commit
A deploy SHALL be reported successful only once the running production instance reports the deployed commit, and SHALL be reported failed when it does not do so within 15 minutes.

#### Scenario: Production reports the deployed commit
- **WHEN** production starts reporting the deployed commit within 15 minutes
- **THEN** the deploy SHALL be reported successful

#### Scenario: Production never reports the commit
- **WHEN** production is unreachable or still reports another commit after 15 minutes
- **THEN** the deploy SHALL be reported failed

### Requirement: REQ-532 Deployment details stay private
The repository and its public workflow logs SHALL NOT disclose the production address, access credentials or specifics of the hosting infrastructure. Those values SHALL exist only as masked secrets or on the host.

#### Scenario: Deploy logs mask the address
- **WHEN** a deploy runs and its logs are read publicly
- **THEN** the production address and access credentials SHALL NOT appear in them

#### Scenario: Deployment files carry no private values
- **WHEN** the committed deployment files are inspected
- **THEN** they SHALL contain only placeholders and variable names for the production address, credentials and hosting details
