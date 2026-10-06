## applyTo: "**"

# VPOS1 Safety Rules

## Database and User Data

The existing SQLite database contains important application data.

Treat existing data as protected.

NEVER casually:

* delete the database
* recreate the database
* drop existing tables
* delete existing records
* replace the existing database
* reset production data
* change database initialization without understanding its effect
* change migrations without checking their effect on existing data

Before making database-related changes:

1. Inspect the current implementation.
2. Determine the effect on existing data.
3. Explain the risk.
4. Propose the safest solution.
5. Only then implement the change when appropriate.

Prefer additive and backward-compatible database changes.

## Database Initialization

Do not assume that copying, seeding, or initializing the database is harmless.

Existing user data must survive application updates.

Never replace an existing production database simply because a new schema or database file is available.

## Printing

Printing is an existing production feature.

Before changing printing:

* inspect the current print flow
* identify the source of receipt data
* distinguish print preview from actual printer output
* identify shared printing functions
* determine whether the change affects Sales, Purchase, Reprint, or other print functions

Do not replace the printing architecture unnecessarily.

Do not modify unrelated printing behavior.

## Android

The application must continue to build for Android.

Do not change the following without a clear reason:

* Gradle configuration
* Java/JDK configuration
* Android SDK configuration
* Capacitor configuration
* Android build configuration

A successful existing Android build should be preserved.

## Dependencies

Do not install or replace dependencies without justification.

Before adding a dependency, explain:

* why it is necessary
* why existing functionality is insufficient
* whether it affects build size
* whether it introduces maintenance or compatibility concerns

## Shared Code

Before changing a shared function, service, utility, or database method:

* determine where it is used
* consider its other callers
* avoid changing behavior globally when the request is local

## High-Risk Changes

Treat these as high-risk:

* database changes
* migrations
* authentication
* printing
* Android configuration
* dependency changes
* major refactoring
* shared services
* data deletion
* changes affecting multiple modules

For high-risk changes, explain the proposed change and impact before implementation.

## Regression Protection

Do not fix one feature by knowingly breaking another.

When a change could affect existing functionality, identify what should be retested.
