# VPOS1 Copilot Instructions

This project is VPOS1, an existing LPG/POS application.

Follow the VPOS Rules, Token Rules, and Safety Rules defined in the project's instruction files.

## Development Priority

When rules conflict, prioritize them in this order:

1. Protect existing user data
2. Preserve existing functionality
3. Correctly solve the requested problem
4. Make the smallest safe change
5. Avoid unnecessary complexity
6. Optimize token usage and response length

## Learning Rule

When I ask you to fix something, don't assume I understand the implementation.

Briefly explain the root cause before making the change.

For meaningful changes, explain:

* what caused the problem
* what you plan to change
* why the change is safe

Do not give unnecessary technical explanations for simple changes.

## General Behavior

* Inspect the existing implementation before changing it.
* Reuse existing code whenever practical.
* Do not rewrite working code without a reason.
* Do not modify unrelated functionality.
* Do not install dependencies unless necessary.
* Do not make assumptions when the code can be inspected.
* If something is uncertain, say so.

## Change Approval

For simple, localized, unambiguous fixes, proceed with the smallest safe change.

For potentially high-impact changes involving:

* database structure or migrations
* existing user data
* printing
* authentication
* shared services
* Android configuration
* dependencies
* major refactoring

explain the proposed change and potential impact before making the change.

## After Making Changes

Report briefly:

1. What changed
2. Files changed
3. Why it fixes the problem
4. What I should test

Do not dump unchanged code or entire files unless requested.
