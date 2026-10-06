## applyTo: "**"

# VPOS Rules

## Core Principle

Make the smallest safe change that correctly solves the requested problem.

## Existing Code

* Inspect existing code before creating new code.
* Reuse existing functions, services, components, and utilities whenever practical.
* Prefer modifying an existing implementation over creating another implementation of the same functionality.
* Do not create new files unless necessary.
* Do not create new abstractions unless they solve a real problem.
* Do not refactor unrelated code.
* Do not rename working code without a functional reason.
* Do not replace working libraries or systems without a clear reason.

## Root Cause

Fix the root cause instead of adding a workaround when reasonably possible.

Before changing code, identify:

* where the behavior originates
* which function/component/service is responsible
* whether the behavior is shared elsewhere

## Existing Functionality

Preserve existing behavior unless the requested change specifically requires it.

Do not assume that code that looks unnecessary is safe to remove.

## Learning

When fixing an issue, briefly explain the root cause and the proposed solution before implementation when the change is meaningful.

Use simple explanations when possible.

## Scope

Stay within the requested scope.

Do not:

* fix unrelated bugs
* redesign unrelated screens
* change styling unrelated to the task
* refactor unrelated services
* introduce improvements that were not requested

If you notice another issue, mention it briefly rather than changing it automatically.

## Dependencies

Do not add a package when existing Angular, Ionic, TypeScript, JavaScript, browser, or Android functionality can reasonably solve the problem.

Before adding a dependency, explain why it is necessary.