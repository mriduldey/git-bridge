import { ConfigurationError } from "@repoferry/errors";
import { describe, expect, expectTypeOf, it } from "vitest";

import {
  REDACTED_SECRET,
  anonymousAuth,
  applicationTokenAuth,
  authKindToAuthenticationType,
  bearerTokenAuth,
  createAuthContext,
  createCredentials,
  isAuthConfig,
  isAuthenticationContext,
  isTokenBackedAuthConfig,
  isTokenCredentials,
  oauthTokenAuth,
  redactCredentials,
  redactToken,
  sanitizeDiagnosticValue,
  serializeAuthContext,
  tokenAuth,
  type AuthConfig,
  type AuthContext,
  type BearerTokenAuthConfig,
  type SerializedAuthContext,
  type TokenBackedAuthConfig
} from "../src/index.js";

describe("auth config factories", () => {
  it("creates anonymous auth without credentials", () => {
    const config = anonymousAuth({ provider: "public" });
    const credentials = createCredentials(config);
    const context = createAuthContext(config);

    expect(config).toEqual({ kind: "anonymous", provider: "public" });
    expect(credentials).toEqual({ kind: "anonymous", provider: "public" });
    expect(context).toEqual({
      credentials,
      provider: "public",
      type: "anonymous"
    });
    expect(Object.isFrozen(config)).toBe(true);
    expect(Object.isFrozen(credentials)).toBe(true);
    expect(Object.isFrozen(context)).toBe(true);
  });

  it("creates token auth credentials and context", () => {
    const config = tokenAuth({
      metadata: {
        scopes: ["repo:read"]
      },
      provider: "provider",
      token: "pat-secret"
    });

    expect(createCredentials(config)).toEqual({
      kind: "access-token",
      metadata: {
        extra: {
          authScheme: "token"
        },
        scopes: ["repo:read"]
      },
      provider: "provider",
      token: "pat-secret"
    });
    expect(createAuthContext(config).type).toBe("token");
  });

  it("creates bearer token auth without introducing a provider-specific credential kind", () => {
    const config = bearerTokenAuth({
      metadata: {
        expiresAt: "2026-07-04T00:00:00.000Z"
      },
      token: "bearer-secret"
    });
    const credentials = createCredentials(config);

    expect(credentials).toEqual({
      kind: "access-token",
      metadata: {
        expiresAt: "2026-07-04T00:00:00.000Z",
        extra: {
          authScheme: "bearer"
        }
      },
      token: "bearer-secret"
    });
    expect(createAuthContext(config)).toMatchObject({
      credentials,
      expiresAt: "2026-07-04T00:00:00.000Z",
      type: "token"
    });
  });

  it("supports static OAuth and application token placeholders defined by the ADR contracts", () => {
    expect(createAuthContext(oauthTokenAuth({ accessToken: "oauth-secret" })).type).toBe("oauth");
    expect(createCredentials(applicationTokenAuth({ token: "app-secret" }))).toMatchObject({
      kind: "application-token",
      metadata: {
        extra: {
          authScheme: "application"
        }
      },
      token: "app-secret"
    });
  });

  it("rejects empty token configs", () => {
    expect(() => tokenAuth({ token: " " })).toThrow(ConfigurationError);
    expect(() => bearerTokenAuth({ token: "" })).toThrow("token must be a non-empty string");
    expect(() => oauthTokenAuth({ accessToken: "" })).toThrow(ConfigurationError);
  });
});

describe("auth type guards", () => {
  it("identifies auth configs and token-backed configs", () => {
    const config: unknown = { kind: "bearer-token", token: "secret" };

    expect(isAuthConfig(config)).toBe(true);
    expect(isTokenBackedAuthConfig(config)).toBe(true);
    expect(isAuthConfig({ kind: "token" })).toBe(false);
    expect(isTokenBackedAuthConfig(anonymousAuth())).toBe(false);
  });

  it("identifies token credentials and auth contexts", () => {
    const context = createAuthContext(tokenAuth({ token: "secret" }));

    expect(isTokenCredentials(context.credentials)).toBe(true);
    expect(isAuthenticationContext(context)).toBe(true);
    expect(isAuthenticationContext({ credentials: {} })).toBe(false);
  });
});

describe("credential redaction and diagnostics serialization", () => {
  it("redacts tokens by default and supports bounded visible hints", () => {
    expect(redactToken("secret")).toBe(REDACTED_SECRET);
    expect(redactToken("secret-value", { prefixLength: 2, suffixLength: 3 })).toBe(
      `se${REDACTED_SECRET}lue`
    );
    expect(redactToken("abc", { prefixLength: 2, suffixLength: 2 })).toBe(REDACTED_SECRET);
  });

  it("redacts credential and context serialization", () => {
    const context = createAuthContext(
      bearerTokenAuth({
        metadata: {
          extra: {
            nested: {
              refreshToken: "refresh-secret",
              visible: "safe"
            }
          }
        },
        token: "bearer-secret"
      })
    );
    const serialized = serializeAuthContext(context);

    expect(serialized.credentials).toEqual({
      hasToken: true,
      kind: "access-token",
      metadata: {
        extra: {
          authScheme: "bearer",
          nested: {
            refreshToken: REDACTED_SECRET,
            visible: "safe"
          }
        }
      },
      token: REDACTED_SECRET
    });
    expect(JSON.stringify(serialized)).not.toContain("bearer-secret");
    expect(JSON.stringify(serialized)).not.toContain("refresh-secret");
    expect(Object.isFrozen(serialized)).toBe(true);
  });

  it("sanitizes sensitive diagnostic keys recursively", () => {
    const sanitized = sanitizeDiagnosticValue({
      authorization: "Bearer secret",
      nested: {
        apiKey: "secret",
        ok: true
      },
      values: [{ password: "secret" }]
    });

    expect(sanitized).toEqual({
      authorization: REDACTED_SECRET,
      nested: {
        apiKey: REDACTED_SECRET,
        ok: true
      },
      values: [{ password: REDACTED_SECRET }]
    });
  });

  it("summarizes anonymous credentials without secret fields", () => {
    expect(redactCredentials(createCredentials(anonymousAuth()))).toEqual({
      hasToken: false,
      kind: "anonymous"
    });
  });
});

describe("public exports", () => {
  it("exports runtime helpers from the package entry point", () => {
    expect(authKindToAuthenticationType("bearer-token")).toBe("token");
    expect(anonymousAuth).toBeTypeOf("function");
    expect(tokenAuth).toBeTypeOf("function");
    expect(bearerTokenAuth).toBeTypeOf("function");
    expect(createAuthContext).toBeTypeOf("function");
    expect(serializeAuthContext).toBeTypeOf("function");
  });

  it("exports stable public auth types", () => {
    expectTypeOf<BearerTokenAuthConfig>().toMatchTypeOf<AuthConfig>();
    expectTypeOf<TokenBackedAuthConfig>().toMatchTypeOf<AuthConfig>();
    expectTypeOf(createAuthContext(tokenAuth({ token: "secret" }))).toEqualTypeOf<AuthContext>();
    expectTypeOf(
      serializeAuthContext(createAuthContext(anonymousAuth()))
    ).toEqualTypeOf<SerializedAuthContext>();
  });
});
