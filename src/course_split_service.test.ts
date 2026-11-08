import assert from "node:assert/strict";
import { chooseDelivery } from "./course_split_service.ts";

assert.equal(chooseDelivery({ variant: "guided", userId: "learner-7", flagKey: "course-delivery" }), "guided");
assert.equal(chooseDelivery({ variant: "self_paced", userId: "learner-7", flagKey: "course-delivery" }), "self_paced");
console.log("stable course delivery decision: passed");
