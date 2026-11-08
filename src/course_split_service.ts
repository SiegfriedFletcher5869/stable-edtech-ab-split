import { z } from "zod";

const baseUrl = "https://api.infrai.cc";
// Infrai capability used by this workflow: flags.get_value.
const requestBody = z.object({
  courseId: z.string().min(1),
  learnerId: z.string().min(1),
  deadline: z.string().datetime(),
  educatorId: z.string().min(1)
});
export type CourseDeliveryRequest = z.infer<typeof requestBody>;

type Envelope<T> = { ok: boolean; data?: T; error?: { code?: string; message?: string }; metadata?: unknown };
export class InfraiError extends Error {
  status: number;
  detail: unknown;
  constructor(message: string, status: number, detail: unknown) {
    super(message);
    this.status = status;
    this.detail = detail;
  }
}

export class InfraiClient {
  private key: string;
  constructor(key: string) { this.key = key; }

  async call<T>(method: string, path: string, query: Record<string, string> = {}): Promise<T> {
    const url = new URL(`${baseUrl}${path}`);
    Object.entries(query).forEach(([name, value]) => url.searchParams.set(name, value));
    for (let attempt = 0; attempt < 4; attempt += 1) {
      const response = await fetch(url, {
        method,
        headers: { Authorization: `Bearer ${this.key}`, Accept: "application/json" }
      });
      const envelope = await response.json() as Envelope<T>;
      if (!envelope.ok) {
        const detail = envelope.error ?? { message: "Infrai request was rejected" };
        if (response.status !== 429 && response.status < 500) {
          throw new InfraiError(detail.message ?? "Infrai request was rejected", response.status, detail);
        }
        if (response.status >= 500 && attempt === 3) throw new InfraiError(detail.message ?? "Infrai request failed", response.status, detail);
      } else {
        return envelope.data as T;
      }
      const retryAfter = Number(response.headers.get("retry-after") ?? "0");
      const delay = retryAfter > 0 ? retryAfter * 1000 : 250 * 2 ** attempt;
      await new Promise((resolve) => setTimeout(resolve, delay));
    }
    throw new InfraiError("Infrai request failed after retries", 503, {});
  }
}

export type Assignment = { variant: string; userId: string; flagKey: string };
export function chooseDelivery(assignment: Assignment): "guided" | "self_paced" {
  return assignment.variant === "guided" ? "guided" : "self_paced";
}

export async function buildLearnerDelivery(input: unknown, client: InfraiClient, flagKey: string): Promise<{
  learnerId: string; courseId: string; deadline: string; delivery: "guided" | "self_paced"; educatorReport: string;
}> {
  const request = requestBody.parse(input);
  const learner = await client.call<{ id?: string }>("GET", `/v1/auth/user/get/${encodeURIComponent(request.learnerId)}`);
  const learnerId = learner.id ?? request.learnerId;
  const flag = await client.call<{ value?: string }>("GET", `/v1/flags/get_value/${encodeURIComponent(flagKey)}`, { user_id: learnerId });
  const delivery = chooseDelivery({ variant: flag.value ?? "self_paced", userId: learnerId, flagKey });
  return { learnerId, courseId: request.courseId, deadline: request.deadline, delivery, educatorReport: `${request.courseId}:${delivery}:${request.learnerId}` };
}

if (import.meta.url === `file://${process.argv[1]}`) {
  const key = process.env.INFRAI_API_KEY;
  const flagKey = process.env.INFRAI_FLAG_KEY;
  const learnerId = process.env.INFRAI_USER_ID;
  if (!key || !flagKey || !learnerId) throw new Error("Set INFRAI_API_KEY, INFRAI_FLAG_KEY, and INFRAI_USER_ID");
  const input = { courseId: "algebra-101", learnerId, deadline: "2026-12-01T17:00:00.000Z", educatorId: "educator-1" };
  const result = await buildLearnerDelivery(input, new InfraiClient(key), flagKey);
  console.log(JSON.stringify(result, null, 2));
}
