// AUTHORED-BY Claude Opus 4.8 (Fable unavailable) — re-review/upgrade candidate
//
// T2 (part) — CSS `.account` account/pod/client-credentials provisioning (design §4.2 [2]).
// The verified recipe from the `solid-test-infrastructure` skill: create an account, register
// a password, create the pod, mint client-credentials BOUND TO the actor's WebID (so the DPoP
// token that `@jeswr/solid-dpop` later exchanges carries `webid = <that actor>`).
//
// SECRET DISCIPLINE: the returned `{id, secret}` are handed straight to the auth layer and
// live only in process memory — this module NEVER logs them and never writes them to disk.

import type { ClientCredentials } from "@jeswr/solid-dpop";

/** A provisioned actor account. */
export interface SeededAccount {
  /** The actor's WebID (`<podRoot>profile/card#me`). */
  readonly webId: string;
  /** The pod root container. */
  readonly podRoot: string;
  /** The client-credentials + issuer for `@jeswr/solid-dpop`'s client-credentials grant. */
  readonly credentials: ClientCredentials;
  /** The account email (deterministic, per-pod). */
  readonly email: string;
  /** The account password (ephemeral, per-run). */
  readonly password: string;
}

interface CookieJar {
  cookie?: string;
}

interface AccountControls {
  readonly controls: {
    readonly password: { readonly create: string };
    readonly account: { readonly pod: string; readonly clientCredentials: string };
  };
}

/** POST JSON with the account-session cookie jar; throws on a non-2xx (with the body). */
async function jsonPost(
  url: string,
  body: unknown,
  jar: CookieJar,
): Promise<Record<string, unknown>> {
  const headers: Record<string, string> = { "content-type": "application/json" };
  if (jar.cookie !== undefined) {
    headers.cookie = jar.cookie;
  }
  // The account root wants `{}` with a JSON content-type — an EMPTY body 500s.
  const response = await fetch(url, {
    method: "POST",
    headers,
    body: JSON.stringify(body ?? {}),
    redirect: "manual",
  });
  const setCookie = response.headers.get("set-cookie");
  if (setCookie !== null) {
    jar.cookie = setCookie.split(";")[0];
  }
  if (!response.ok) {
    throw new Error(`${url} → ${response.status}: ${await response.text()}`);
  }
  return (await response.json()) as Record<string, unknown>;
}

/**
 * Provision one CSS account + pod + WebID-bound client-credentials. `pod` MUST be unique on
 * the server (CSS rejects duplicates). `webId` is the WebID the credentials are bound to —
 * default `<base>/<pod>/profile/card#me`.
 */
export async function seedAccount(
  base: string,
  pod: string,
  options: { readonly webId?: string; readonly email?: string; readonly password?: string } = {},
): Promise<SeededAccount> {
  const root = base.endsWith("/") ? base.slice(0, -1) : base;
  const podRoot = `${root}/${pod}/`;
  const webId = options.webId ?? `${podRoot}profile/card#me`;
  const email = options.email ?? `${pod}@example.com`;
  const password = options.password ?? `${pod}-pass-${Math.random().toString(36).slice(2, 10)}`;

  const jar: CookieJar = {};
  await jsonPost(`${root}/.account/account/`, {}, jar);
  const indexResponse = await fetch(`${root}/.account/`, {
    headers: jar.cookie !== undefined ? { cookie: jar.cookie } : {},
    redirect: "manual",
  });
  if (!indexResponse.ok) {
    throw new Error(`GET /.account/ → ${indexResponse.status}`);
  }
  const { controls } = (await indexResponse.json()) as AccountControls;
  await jsonPost(controls.password.create, { email, password }, jar);
  await jsonPost(controls.account.pod, { name: pod }, jar);
  const cc = (await jsonPost(
    controls.account.clientCredentials,
    { name: "aar-demo", webId },
    jar,
  )) as {
    id: string;
    secret: string;
  };

  return {
    webId,
    podRoot,
    email,
    password,
    credentials: { issuer: `${root}/`, id: cc.id, secret: cc.secret },
  };
}
