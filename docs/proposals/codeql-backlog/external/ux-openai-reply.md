## 1. What breaks if every response becomes `{ error: "Internal server error" }`

### Immediate impact of the seven flagged functions

For the seven currently flagged functions, direct customer impact is likely **low**:

- The HMAC ingest and three cron Workers have no customer UI.
- The blog-blast and translation functions are administrative/background flows.
- The DUPR admin/test-fire endpoints affect internal or low-volume tooling.

However, operational diagnosis will get worse unless the helper still:

- Logs the original exception and stack server-side.
- Adds a random `requestId` to both the log and response.
- Identifies the function and operation in the log.

Cron monitoring must use logs/alerts rather than depend on an HTTP body containing the exception.

### Impact if this helper is applied broadly

Dropping `code` is a **high-severity UX regression** in event registration and any other code-aware flow.

| Existing response | Current UX | After dropping `code` |
|---|---|---|
| `event_full` | “Giải đã đủ người” | “Lỗi mạng” or generic server error |
| `slot_required` | Tells the user to select a slot | Generic error with no corrective action |
| Known invite conflict | Can explain that the invite already exists | Generic failure |
| Auth/session error | Can request sign-in again | Looks like a server/network outage |

The app would not crash, but users would take the wrong action:

- Repeatedly retry a full event.
- Fail to select a required slot because the app never tells them what is missing.
- Assume their 4G connection is the problem.
- Abandon a registration or invitation flow unnecessarily.

The manually parsed **team invite dialog** will also break if it expects a body message. That dialog must switch to reading `code`, not receive a sanitized English `error` string.

Also, do not turn all errors into HTTP 500 responses. Preserve meaningful status classes:

- `400` for invalid/missing input.
- `401` for expired or missing authentication.
- `403` for permission failures.
- `409` for conflicts such as `event_full` or duplicate invites.
- `429` for rate limits.
- `500` only for unexpected failures.

**Recommendation:** Every error response should retain a safe machine code. Even an unexpected exception should return:

```json
{
  "code": "unexpected_error",
  "requestId": "f92d..."
}
```

Avoid `"error": "Internal server error"` as the primary contract. It is English display text masquerading as an API field.

---

## 2. Separate deliberate errors from unexpected exceptions

Yes. The sanitization must distinguish them.

A deliberate validation or business error is part of the product contract. An unexpected exception is not. They should not use one helper with a boolean such as `safe: true`, and the helper should not accept an arbitrary public message.

### Use two explicitly named functions

```ts
const PUBLIC_ERROR_STATUS = {
  event_full: 409,
  slot_required: 400,
  team_already_invited: 409,
  auth_required: 401,
  forbidden: 403,
  rate_limited: 429,
} as const;

type PublicErrorCode = keyof typeof PUBLIC_ERROR_STATUS;

type ErrorResponseContext = {
  corsHeaders: HeadersInit;
  functionName: string;
  requestId?: string;
};

export function respondWithPublicError(
  code: PublicErrorCode,
  context: ErrorResponseContext,
): Response {
  return Response.json(
    { code },
    {
      status: PUBLIC_ERROR_STATUS[code],
      headers: context.corsHeaders,
    },
  );
}

export function respondWithUnexpectedError(
  error: unknown,
  context: ErrorResponseContext,
): Response {
  const requestId = context.requestId ?? crypto.randomUUID();

  console.error("Unexpected edge-function error", {
    requestId,
    functionName: context.functionName,
    error,
  });

  return Response.json(
    {
      code: "unexpected_error",
      requestId,
    },
    {
      status: 500,
      headers: context.corsHeaders,
    },
  );
}
```

Usage:

```ts
if (!slotId) {
  return respondWithPublicError("slot_required", context);
}

if (eventIsFull) {
  return respondWithPublicError("event_full", context);
}

try {
  // Unexpected work
} catch (error) {
  return respondWithUnexpectedError(error, context);
}
```

### Why this signature is safer

`respondWithPublicError`:

- Accepts only an allowlisted code.
- Does not accept `Error`.
- Does not accept an arbitrary `message`.
- Derives the HTTP status from the code, preventing `event_full` from accidentally becoming a 500.

`respondWithUnexpectedError`:

- Accepts the caught exception for logging only.
- Has no argument that could expose its message in the response.
- Always returns `unexpected_error`.
- Correlates a generic customer-facing failure with a detailed server-side log.

Avoid this API:

```ts
safeErrorResponse(error, {
  exposeMessage: true,
  code: maybeCode,
  status: maybeStatus,
});
```

That design makes the unsafe path one optional property away, especially during rushed maintenance.

If known errors must be thrown rather than returned, introduce a typed `PublicError` containing only an allowlisted code—not a public message—and handle it explicitly:

```ts
catch (error) {
  if (error instanceof PublicError) {
    return respondWithPublicError(error.code, context);
  }

  return respondWithUnexpectedError(error, context);
}
```

Prefer early returns for ordinary validation; throwing should be reserved for cases where it materially simplifies control flow.

---

## 3. Introduce client-side code-to-copy mapping now, but do not migrate all 83 sites in this PR

This security change establishes or changes the API error contract, so adding the centralized client parser is **not scope creep**. Migrating all 83 toast sites in the same blocking security PR would be.

### Security PR scope

Include these changes now:

1. Preserve existing safe business codes.
2. Return `unexpected_error` for sanitized exceptions.
3. Add a centralized Supabase function error parser.
4. Replace the team invite dialog’s manual message parsing.
5. Ensure the event-registration code switch continues to work unchanged.
6. Update any direct client of the seven modified functions.
7. Add tests proving stack traces and raw messages are absent.

### Follow-up UX migration

Create a separate follow-up to migrate the remaining customer-facing calls, in this order:

1. Schedule livestream.
2. Team invitation.
3. Delete account.
4. DUPR link and submit.
5. Remaining 83 generic toast sites.

The event-registration flow already has the correct model; reuse it rather than redesign it.

### Centralize Supabase error extraction

The UI must stop using `error.message` as display copy. For `FunctionsHttpError`, read and validate the body from `error.context`, then convert it into an app-level error:

```ts
type AppErrorCode =
  | "event_full"
  | "slot_required"
  | "team_already_invited"
  | "auth_required"
  | "forbidden"
  | "rate_limited"
  | "unexpected_error"
  | "network_error";

type AppError = {
  code: AppErrorCode;
  requestId?: string;
};

async function normalizeFunctionError(error: unknown): Promise<AppError> {
  if (error instanceof FunctionsHttpError) {
    const response = error.context;

    try {
      const body = await response.clone().json();

      if (isKnownAppErrorCode(body?.code)) {
        return {
          code: body.code,
          requestId:
            typeof body.requestId === "string" ? body.requestId : undefined,
        };
      }
    } catch {
      // Invalid or absent response body.
    }

    return { code: "unexpected_error" };
  }

  if (isNetworkFailure(error)) {
    return { code: "network_error" };
  }

  return { code: "unexpected_error" };
}
```

Then the toast component receives localized copy only:

```ts
toast({
  description: getErrorCopy(appError.code, locale),
});
```

It should never receive:

```ts
toast({
  description: error.message,
});
```

### Keep network and server failures separate

The current registration fallback `"Lỗi mạng"` is inaccurate for HTTP 500 responses. Use:

- `network_error` only when no usable HTTP response exists.
- `unexpected_error` when the server responded but failed unexpectedly.
- The specific business code for known 4xx conditions.

This matters on court-side 4G: users need to know whether checking their connection could actually help.

---

## 4. Recommended VI and EN microcopy

### Unexpected server failure

For the existing toast `description`:

- **VI:** `Hệ thống đang gặp sự cố. Vui lòng thử lại sau ít phút.`
- **EN:** `Something went wrong on our side. Please try again in a few minutes.`

This avoids blaming the user’s connection and avoids technical terms such as “Edge Function,” “non-2xx,” or “internal server error.”

If the toast supports a title:

- **VI title:** `Chưa thể hoàn tất`
- **EN title:** `Couldn’t complete the request`

### Actual network failure

Use different copy only when there was no usable server response:

- **VI:** `Kết nối không ổn định. Vui lòng kiểm tra mạng và thử lại.`
- **EN:** `Your connection appears unstable. Check your network and try again.`

### Useful code mappings

| Code | VI primary | EN secondary |
|---|---|---|
| `event_full` | `Giải đã đủ người.` | `This event is full.` |
| `slot_required` | `Vui lòng chọn hạng mục thi đấu.` | `Please select a competition category.` |
| `team_already_invited` | `Đội này đã được mời trước đó.` | `This team has already been invited.` |
| `auth_required` | `Phiên đăng nhập đã hết hạn. Vui lòng đăng nhập lại.` | `Your session has expired. Please sign in again.` |
| `forbidden` | `Bạn không có quyền thực hiện thao tác này.` | `You don’t have permission to do this.` |
| `rate_limited` | `Bạn thao tác quá nhanh. Vui lòng thử lại sau ít phút.` | `Too many attempts. Please try again in a few minutes.` |
| `unexpected_error` | `Hệ thống đang gặp sự cố. Vui lòng thử lại sau ít phút.` | `Something went wrong on our side. Please try again in a few minutes.` |
| `network_error` | `Kết nối không ổn định. Vui lòng kiểm tra mạng và thử lại.` | `Your connection appears unstable. Check your network and try again.` |

Show only the active locale, with Vietnamese as the default. Do not display both languages in the same mobile toast; it adds height and delays scanning.

## Bottom line

- Sanitize unexpected exception details.
- Do **not** drop safe business codes.
- Return `unexpected_error`, not English display copy, for unknown failures.
- Use two separate server helpers so arbitrary exception messages cannot enter public responses.
- Add the central client parser in the security work, then migrate the 83 toast sites incrementally.
- Keep server failures distinct from actual network failures in Vietnamese copy.