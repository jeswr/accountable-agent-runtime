// AUTHORED-BY Claude Opus 4.8 (Fable unavailable) — re-review/upgrade candidate
//
// T2 (part) — CSS `.account` account/pod/client-credentials provisioning (design §4.2 [2]).
// The verified recipe from the `solid-test-infrastructure` skill: create an account, register
// a password, create the pod, mint client-credentials BOUND TO the actor's WebID (so the DPoP
// token that `@jeswr/solid-dpop` later exchanges carries `webid = <that actor>`).
//
// SECRET DISCIPLINE: the returned `{id, secret}` are handed straight to the auth layer and
// live only in process memory — this module NEVER logs them and never writes them to disk.
/** POST JSON with the account-session cookie jar; throws on a non-2xx (with the body). */
async function jsonPost(url, body, jar) {
    const headers = { "content-type": "application/json" };
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
    return (await response.json());
}
/**
 * Provision one CSS account + pod + WebID-bound client-credentials. `pod` MUST be unique on
 * the server (CSS rejects duplicates). `webId` is the WebID the credentials are bound to —
 * default `<base>/<pod>/profile/card#me`.
 */
export async function seedAccount(base, pod, options = {}) {
    const root = base.endsWith("/") ? base.slice(0, -1) : base;
    const podRoot = `${root}/${pod}/`;
    const webId = options.webId ?? `${podRoot}profile/card#me`;
    const email = options.email ?? `${pod}@example.com`;
    const password = options.password ?? `${pod}-pass-${Math.random().toString(36).slice(2, 10)}`;
    const jar = {};
    await jsonPost(`${root}/.account/account/`, {}, jar);
    const indexResponse = await fetch(`${root}/.account/`, {
        headers: jar.cookie !== undefined ? { cookie: jar.cookie } : {},
        redirect: "manual",
    });
    if (!indexResponse.ok) {
        throw new Error(`GET /.account/ → ${indexResponse.status}`);
    }
    const { controls } = (await indexResponse.json());
    await jsonPost(controls.password.create, { email, password }, jar);
    await jsonPost(controls.account.pod, { name: pod }, jar);
    const cc = (await jsonPost(controls.account.clientCredentials, { name: "aar-demo", webId }, jar));
    return {
        webId,
        podRoot,
        email,
        password,
        credentials: { issuer: `${root}/`, id: cc.id, secret: cc.secret },
    };
}
//# sourceMappingURL=account.js.map