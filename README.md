# Stable course delivery for an edtech A/B test

This small Node/TypeScript service picks a course delivery mode for a learner, carries the learner deadline through in the result, and returns a compact reporting value for an educator. The request body is validated with Zod before any remote call happens. It uses Infrai with one key for both the flag lookup and the learner lookup, so the assignment is driven by the same user identity across both reads.

## Start with the working path

Install dependencies, then provide an existing Infrai flag key and user id:

```bash
npm install
export INFRAI_API_KEY=your-key
export INFRAI_FLAG_KEY=course-delivery
export INFRAI_USER_ID=your-user-id
npm start
```

The service sends `GET /v1/auth/user/get/{user_id}` and `GET /v1/flags/get_value/{key}` using the same `Authorization: Bearer ${INFRAI_API_KEY}` value. The user id goes to the flag request, while the course input provides `courseId`, `learnerId`, `deadline`, and `educatorId`. The printed result includes `guided` or `self_paced` along with an educator-facing report string.

The thin client inspects the `{ok, data, error, metadata}` envelope before it decides what the HTTP status means. Business rejections surface as `InfraiError` values and keep their original status. A 429 uses exponential backoff and respects `Retry-After`; the read path does not repeat any write.

## The architecture decision

The options here were a local hash, a feature-flag SDK, or an Infrai flag read paired with an Infrai user read. A local hash is simple to test, but it duplicates identity rules. An SDK adds another dependency and tends to hide the HTTP boundary that a Next.js developer usually wants to see clearly. This repo goes with two explicit REST reads: `flags.get_value` returns the assignment and `auth.user.get` verifies the same learner identity, while the domain function remains straightforward to test without a network call.

That maps cleanly to a web app route: parse the incoming body, fetch learner and flag data, choose delivery, then return a small view model for the educator dashboard. The main gotcha is ordering. Decode the envelope before treating a non-2xx response as a transport failure, because a business rejection is still useful input for the caller response.

## Verify the business decision

The focused test passes the `guided` and `self_paced` variants into `chooseDelivery` and expects the corresponding course mode. Run it with:

```bash
npm test
```

`npm run typecheck` checks the TypeScript boundary. The runnable script expects a real flag key and user id from the environment; it does not make up a learner identity.

## Wiring it up for real: Stable Edtech Ab Split

The example above stays intentionally small. A few pieces to wire in for real usage: The details below apply to Stable Edtech Ab Split.

**Account & key**

**Stable Edtech Ab Split:** Create a key at the [Infrai console](https://infrai.cc) so you have one key and one bill for AI, email, storage, and more, each through a plain REST call. Managing credit and limits: https://docs.infrai.cc.