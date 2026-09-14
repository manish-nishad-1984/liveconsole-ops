/**
 * End-to-end smoke test against a running API.
 *
 * Exercises the paths a boilerplate has to get right before anyone builds on it:
 * login, refresh rotation with reuse detection, the users CRUD + status +
 * password-reset actions, and the roles CRUD including the permission catalog.
 *
 *   node prisma/smoke.mjs            (API must already be listening)
 */

const BASE = process.env.SMOKE_BASE ?? 'http://localhost:4100/api/v1';
const EMAIL = process.env.SEED_ADMIN_EMAIL ?? 'admin@example.com';
const PASSWORD = process.env.SEED_ADMIN_PASSWORD ?? 'ChangeMe@123';

let passed = 0;
let failed = 0;

const check = (label, condition, detail) => {
  if (condition) {
    passed += 1;
    console.log(`  PASS  ${label}`);
  } else {
    failed += 1;
    console.log(`  FAIL  ${label}${detail ? ` — ${JSON.stringify(detail)}` : ''}`);
  }
};

/** Minimal cookie jar, so refresh rotation can actually be exercised. */
let cookie = '';

const call = async (method, path, body, token) => {
  const headers = { Accept: 'application/json' };
  if (body !== undefined) headers['Content-Type'] = 'application/json';
  if (token) headers.Authorization = `Bearer ${token}`;
  if (cookie) headers.Cookie = cookie;

  const response = await fetch(`${BASE}${path}`, {
    method,
    headers,
    body: body === undefined ? undefined : JSON.stringify(body),
  });

  const setCookie = response.headers.get('set-cookie');
  if (setCookie) cookie = setCookie.split(';')[0];

  const text = await response.text();
  let payload = null;
  try {
    payload = text ? JSON.parse(text) : null;
  } catch {
    payload = { raw: text };
  }

  return { status: response.status, payload };
};

const run = async () => {
  console.log(`Smoke test against ${BASE}\n`);

  /* --- auth ---------------------------------------------------------- */
  console.log('auth');
  const login = await call('POST', '/auth/login', { identifier: EMAIL, password: PASSWORD });
  check('login returns 200', login.status === 200, login.payload);
  check('access token issued', Boolean(login.payload?.data?.tokens?.accessToken));
  check('refresh token is NOT in the body', login.payload?.data?.tokens?.refreshToken === undefined);
  check('refresh cookie set', cookie.startsWith('lcops_refresh_token='));

  const token = login.payload?.data?.tokens?.accessToken;
  const permissions = login.payload?.data?.user?.permissions ?? [];
  for (const required of ['dashboard:view', 'users:view', 'roles:view', 'audit_logs:view']) {
    check(`permission ${required} granted`, permissions.includes(required));
  }

  const badLogin = await call('POST', '/auth/login', { identifier: EMAIL, password: 'nope' });
  check('wrong password rejected', badLogin.status === 401);

  const unauthenticated = await call('GET', '/users');
  check('protected route rejects a missing token', unauthenticated.status === 401);

  const me = await call('GET', '/auth/me', undefined, token);
  check('/auth/me resolves the account', me.payload?.data?.email === EMAIL);

  /* --- refresh rotation ---------------------------------------------- */
  console.log('\nrefresh rotation');
  const firstCookie = cookie;
  const refreshed = await call('POST', '/auth/refresh', {});
  check('refresh succeeds', refreshed.status === 200);
  check('refresh rotates the cookie', cookie !== firstCookie);

  // Replaying the rotated token must revoke the whole family, not just fail.
  const replayCookie = cookie;
  cookie = firstCookie;
  const replay = await call('POST', '/auth/refresh', {});
  check('replaying a rotated refresh token is rejected', replay.status === 401, replay.payload);
  cookie = replayCookie;
  const afterReplay = await call('POST', '/auth/refresh', {});
  check('reuse detection revokes the whole family', afterReplay.status === 401, afterReplay.payload);
  cookie = '';

  /* --- users ---------------------------------------------------------- */
  console.log('\nusers');
  const roles = await call('GET', '/roles?pageSize=100', undefined, token);
  const viewerRole = roles.payload?.data?.items?.find((role) => role.slug === 'viewer');
  check('seeded roles are listable', Boolean(viewerRole), roles.payload);

  const stamp = Date.now();
  const created = await call(
    'POST',
    '/users',
    {
      fullName: 'Smoke Test User',
      email: `smoke.${stamp}@example.com`,
      roleIds: [viewerRole.id],
    },
    token,
  );
  check('user created', created.status === 201, created.payload);
  check('invite returns a one-time temporary password', Boolean(created.payload?.data?.temporaryPassword));
  check('invited user starts as INVITED', created.payload?.data?.status === 'INVITED');

  const userId = created.payload?.data?.id;
  const temporaryPassword = created.payload?.data?.temporaryPassword;

  const duplicate = await call(
    'POST',
    '/users',
    { fullName: 'Dupe', email: `smoke.${stamp}@example.com`, roleIds: [viewerRole.id] },
    token,
  );
  check('duplicate email rejected with 409', duplicate.status === 409, duplicate.payload);

  const noRole = await call(
    'POST',
    '/users',
    { fullName: 'No role', email: `smoke.norole.${stamp}@example.com`, roleIds: [] },
    token,
  );
  check('a user with no role is rejected', noRole.status === 422, noRole.payload);

  // The invited account must be able to sign in with its temporary password.
  const savedCookie = cookie;
  cookie = '';
  const inviteeLogin = await call('POST', '/auth/login', {
    identifier: `smoke.${stamp}@example.com`,
    password: temporaryPassword,
  });
  check('invited user can sign in', inviteeLogin.status === 200, inviteeLogin.payload);
  check(
    'invited user is forced to change the password',
    inviteeLogin.payload?.data?.user?.mustChangePassword === true,
  );
  check('first sign-in activates the account', inviteeLogin.payload?.data?.user?.status === 'ACTIVE');
  const inviteeToken = inviteeLogin.payload?.data?.tokens?.accessToken;

  const inviteeForbidden = await call(
    'POST',
    '/users',
    { fullName: 'x', email: `x.${stamp}@example.com`, roleIds: [viewerRole.id] },
    inviteeToken,
  );
  check('viewer cannot create users (403)', inviteeForbidden.status === 403, inviteeForbidden.payload);
  cookie = savedCookie;

  const updated = await call('PATCH', `/users/${userId}`, { designation: 'Tester' }, token);
  check('user updated', updated.payload?.data?.designation === 'Tester', updated.payload);

  const suspended = await call('POST', `/users/${userId}/status`, { status: 'SUSPENDED' }, token);
  check('user suspended', suspended.payload?.data?.status === 'SUSPENDED', suspended.payload);

  // Suspension must take effect immediately, not when the token expires.
  const suspendedCall = await call('GET', '/auth/me', undefined, inviteeToken);
  check('suspension invalidates a live access token', suspendedCall.status === 401);

  const reset = await call('POST', `/users/${userId}/password`, {}, token);
  check('admin password reset returns a new temporary password', Boolean(reset.payload?.data?.temporaryPassword));

  const removed = await call('DELETE', `/users/${userId}`, undefined, token);
  check('user soft-deleted', removed.payload?.data?.isActive === false, removed.payload);

  const gone = await call('GET', `/users/${userId}`, undefined, token);
  check('soft-deleted user is still readable by id', gone.status === 200);

  /* --- roles ---------------------------------------------------------- */
  console.log('\nroles');
  const catalog = await call('GET', '/roles/permission-catalog', undefined, token);
  check('permission catalog served', Array.isArray(catalog.payload?.data), catalog.payload);
  check(
    'catalog includes the users module',
    catalog.payload?.data?.some((group) => group.module === 'users'),
  );

  const newRole = await call(
    'POST',
    '/roles',
    {
      name: `Smoke Role ${stamp}`,
      description: 'Created by the smoke test.',
      permissions: ['dashboard:view', 'users:view'],
    },
    token,
  );
  check('role created', newRole.status === 201, newRole.payload);
  check('permission count computed', newRole.payload?.data?.permissionCount === 2);

  const roleId = newRole.payload?.data?.id;

  const roleUpdated = await call(
    'PATCH',
    `/roles/${roleId}`,
    { permissions: ['dashboard:view'] },
    token,
  );
  check('role permissions diffed down to one', roleUpdated.payload?.data?.permissionCount === 1, roleUpdated.payload);

  const bogus = await call(
    'PATCH',
    `/roles/${roleId}`,
    { permissions: ['not_a_module:view'] },
    token,
  );
  check('unknown permission key rejected', bogus.status === 422, bogus.payload);

  const superAdminRole = roles.payload?.data?.items?.find((role) => role.slug === 'super_admin');
  const editSuper = await call(
    'PATCH',
    `/roles/${superAdminRole.id}`,
    { permissions: ['dashboard:view'] },
    token,
  );
  check('super_admin permissions cannot be edited', editSuper.status === 422, editSuper.payload);

  const deleteSystem = await call('DELETE', `/roles/${superAdminRole.id}`, undefined, token);
  check('system role cannot be deleted', deleteSystem.status === 422, deleteSystem.payload);

  const roleDeleted = await call('DELETE', `/roles/${roleId}`, undefined, token);
  check('custom role deleted', roleDeleted.status === 204, roleDeleted.payload);

  /* --- audit ---------------------------------------------------------- */
  console.log('\naudit');
  const audit = await call('GET', '/audit-logs?pageSize=50', undefined, token);
  const actions = new Set((audit.payload?.data?.items ?? []).map((entry) => entry.action));
  check('audit entries are scoped to the tenant and visible', (audit.payload?.data?.pagination?.total ?? 0) > 0);
  for (const action of ['LOGIN', 'LOGIN_FAILED', 'CREATE', 'STATUS_CHANGE', 'DELETE']) {
    check(`audit records ${action}`, actions.has(action));
  }

  console.log(`\n${passed} passed, ${failed} failed`);
  process.exit(failed === 0 ? 0 : 1);
};

run().catch((error) => {
  console.error(error);
  process.exit(1);
});
