# Human-Safe Build Contract

This repository is built for the human receiving the product, not merely for code completion.

## Core rule

A user-facing component, screen, route gate, checkout step, or workflow must not resolve to silence when the system knows enough to show a state.

Do not use `return null` for loading, error, empty, denied, offline, unavailable, recovery, or transitional states that can block understanding or action.

## Required human-facing states

Every customer or operator flow must provide the applicable state with clear language and an honest next action:

- loading or checking;
- success;
- empty;
- denied or permission-limited;
- offline or degraded;
- error;
- recovery, retry, back, contact support, or safe exit.

Use accessible status semantics and preserve the existing product language and visual system.

## Where `null` remains valid

`null` may remain in data, parser, service, storage, cache, and optional-value contracts when it explicitly means `not found`, `not configured`, or `not applicable`.

That contract must be typed or tested. A human-facing caller must translate it into a visible state whenever the absence affects comprehension, trust, safety, checkout confidence, or the next action.

Optional decorative elements may render nothing only when their absence cannot hide progress, failure, denial, important data, or a required action.

## Safe implementation loop

### Observe

Inspect the active route, component, caller, exact branch head, existing tests, and rendered behavior. Distinguish a valid data sentinel from a blank-screen defect.

### Orient

Identify the human consequence. Red-team slow storage, missing configuration, denied access, stale sessions, empty data, malformed input, payment redirects, network failure, and narrow/mobile layouts.

### Decide

Choose the smallest proven repair. Prefer platform primitives and existing components. Do not add a dependency when plain React, browser, Worker, or server behavior is sufficient.

### Act

Render the missing state, preserve privacy, payment, authorization, and order boundaries, add a focused regression test, and run the exact applicable proof gates.

## Proof requirements

- Unit or source-contract proof for the state decision.
- Type and build proof where applicable.
- Playwright proof for changed storefront or admin behavior.
- Exact-head CI evidence before merge.

A screenshot, design mock, or green unrelated workflow is not runtime proof.

## Red-team constraints

Never replace `null` mechanically across a repository. Blind replacement can expose private data, weaken denied states, invent false order status, or break optional component contracts.

Never show an order, payment, contact, or account success state when the underlying operation is unknown or failed. Never hide an error merely to avoid a blank screen.

## Definition of done

The change is complete when the human can tell:

1. what the system is doing;
2. what happened;
3. whether their data, order, or action is safe;
4. what they can do next;
5. how to recover when recovery is possible.

Build the smallest safe thing, prove it at the exact head, and leave no human staring into an empty frame.
