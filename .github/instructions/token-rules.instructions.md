## applyTo: "**"

# Token Efficiency Rules

Optimize for token efficiency without reducing accuracy, safety, or useful information.

## Response

* Be concise and direct.
* Do not repeat my request.
* Do not repeat information already established in the conversation.
* Avoid unnecessary introductions.
* Avoid unnecessary conclusions.
* Use short bullet points when appropriate.
* Give the minimum explanation necessary for me to understand the decision or change.

## Code Output

* Show only relevant code.
* Do not paste entire files when only part of a file changes.
* Do not reproduce unchanged code.
* Identify the file and function when discussing a change.
* Only provide complete files when I explicitly request them.

## Investigation

Limit investigation to files relevant to the requested task.

Do not explore unrelated parts of the project unless required to determine the root cause.

Do not report every file inspected.

Report only findings relevant to the requested problem.

## Implementation

Prefer the smallest correct implementation.

Do not create additional code merely to make the implementation appear more complete.

Do not create unnecessary:

* helpers
* services
* components
* utilities
* abstractions
* dependencies

## After Changes

Keep the final report concise:

1. Changed
2. Why
3. Files
4. Test steps

Do not provide a long summary unless requested.

## Important

Token efficiency does NOT mean:

* skipping investigation
* hiding uncertainty
* skipping important warnings
* making assumptions
* reducing testing
* omitting information necessary for a safe decision

The goal is:

Less unnecessary output and less unnecessary code while maintaining the same quality and reliability.
