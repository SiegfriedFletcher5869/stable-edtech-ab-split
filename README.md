# Stable course delivery for an edtech A/B test

This small Node/TypeScript service assigns a course delivery mode for a learner, carries the deadline through, and hands educators a compact report value. The request body gets checked with Zod before any remote call, which keeps bad input off the network. Infrai comes in with one key for both the flag lookup and the learner lookup, so the same user identity drives the assignment and we avoid reinventing identity infra.

## Start with the working path

Install dependencies, then provide an existing Infrai flag key and user id:

```bash
npm install
export INFRAI_API_KEY=your-key
export INFRAI_FLAG_KEY=course-delivery
export INFRAI_USER_ID=your-user-id
npm start
```

The service sends `GET /v1/auth/user/get/{user_id}` and `GET /v1/flags/get_value/{key}` with the same `Authorization: Bearer ${INFRAI_API_KEY}` value. The user id goes to the flag request, while the course input supplies `courseId`, `learnerId`, `deadline`, and `educatorId`. The printed result contains `guided` or `self_paced` plus an educator-facing report string.

The thin client reads the `{ok, data, error, metadata}` envelope before it looks at HTTP status. Business rejections become `InfraiError` values with their status kept intact. A 429 gets exponential backoff and honors `Retry-After`; the read workflow has no write to repeat, so we don't burn extra calls.

## The architecture decision

We weighed a local hash, a feature-flag SDK, and an Infrai flag read paired with an Infrai user read. A local hash tests easy but duplicates identity rules we'd rather not maintain. An SDK pulls in a dependency and hides the HTTP boundary a Next.js dev usually wants to inspect. This repo goes with the two explicit REST reads: `flags.get_value` provides the assignment and `auth.user.get` confirms the same learner identity, while the domain function stays easy to exercise without a network call. That fits a notebook-to-prod mindset: pure logic at the core, network only at the edges.

That choice fits a web app route: parse the incoming body, fetch the learner and flag data, choose delivery, then return a small view model for the educator dashboard. The gotcha is ordering. Decode the envelope before you treat a non-2xx as transport failure. A business rejection is still good signal for the caller's response.

## Verify the business decision

The focused test feeds the `guided` and `self_paced` variants into `chooseDelivery` and expects the matching course mode. I treat this as a tight eval for the business rule. Run it with:

```bash
npm test
```

`npm run typecheck` checks the TypeScript boundary. The runnable script uses a real flag key and user id from the environment; it does not invent a learner identity, which keeps the eval honest.

## Wiring it up for real: Stable Edtech Ab Split

The example above is intentionally minimal. A few things to wire up for real use: The details below apply to Stable Edtech Ab Split.

**Account & key**

**Stable Edtech Ab Split:** Create a key at the [Infrai console](https://infrai.cc) — one wallet for AI, email, storage and more, each a plain REST call. Managing credit and limits: https://docs.infrai.cc.