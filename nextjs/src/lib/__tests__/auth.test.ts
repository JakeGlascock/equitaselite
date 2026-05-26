import { describe, it, expect, beforeEach, afterAll, vi } from 'vitest'
import { mockClient } from 'aws-sdk-client-mock'
import {
  CognitoIdentityProviderClient,
  InitiateAuthCommand,
  RespondToAuthChallengeCommand,
  GlobalSignOutCommand,
  ConfirmDeviceCommand,
  UpdateDeviceStatusCommand,
  AssociateSoftwareTokenCommand,
  VerifySoftwareTokenCommand,
  ForgotPasswordCommand,
  ConfirmForgotPasswordCommand,
  GetUserCommand,
  StartWebAuthnRegistrationCommand,
  CompleteWebAuthnRegistrationCommand,
  ListWebAuthnCredentialsCommand,
  DeleteWebAuthnCredentialCommand,
  ListUsersCommand,
  AdminCreateUserCommand,
  AdminDeleteUserCommand,
  AdminResetUserPasswordCommand,
} from '@aws-sdk/client-cognito-identity-provider'

// cognito-srp-helper does real SRP math; we don't want to exercise that
// here. Stub the functions used by signInWithDevice + the device-SRP
// finish so each call returns a deterministic shape.
vi.mock('cognito-srp-helper', () => ({
  createSrpSession:        () => ({ username: '', password: '', poolId: '', poolIdAbbr: '', isHashed: true, timestamp: '', smallA: '', largeA: '' }),
  signSrpSession:          () => ({ secret: 'sec', passwordSignature: 'sig', timestamp: 'ts', largeA: 'A' }),
  signSrpSessionWithDevice: () => ({ secret: 'sec', passwordSignature: 'sig', timestamp: 'ts', largeA: 'A' }),
  wrapInitiateAuth:        (_s: unknown, x: object) => x,
  wrapAuthChallenge:       (_s: unknown, x: object) => x,
  createDeviceVerifier:    () => ({
    DeviceSecretVerifierConfig: { PasswordVerifier: 'v', Salt: 's' },
    DeviceRandomPassword:       'dp',
  }),
}))

const origClient = process.env.COGNITO_CLIENT_ID
const origPool   = process.env.COGNITO_USER_POOL_ID

beforeEach(() => {
  process.env.COGNITO_CLIENT_ID    = 'test-client-id'
  process.env.COGNITO_USER_POOL_ID = 'us-east-1_AbCdEfGhI'
})

afterAll(() => {
  if (origClient === undefined) delete process.env.COGNITO_CLIENT_ID; else process.env.COGNITO_CLIENT_ID = origClient
  if (origPool === undefined)   delete process.env.COGNITO_USER_POOL_ID; else process.env.COGNITO_USER_POOL_ID = origPool
})

// aws-sdk-client-mock returns a mock for the global Cognito client
// constructor — `cognitoClient` in lib/aws.ts is a module-singleton, so
// the mock layer intercepts every .send() call no matter who built the
// client.
const cognitoMock = mockClient(CognitoIdentityProviderClient)

beforeEach(() => cognitoMock.reset())

// Import AFTER mocks are set up (vi.mock is hoisted; the import is fine
// at the top level, but keeping it here makes the dependency clear).
import {
  signIn, signInWithDevice, srpInit, srpVerify,
  respondToMfaChallenge, respondToNewPassword,
  confirmAndRememberDevice,
  getMfaSetupSecret, verifyMfaSetup, completeMfaSetup,
  signOut, forgotPassword, confirmForgotPassword,
  getCurrentUser, refreshTokens,
  startPasskeyRegistration, completePasskeyRegistration,
  listPasskeys, deletePasskey,
  passkeySigninInit, passkeySigninVerify,
  listCognitoUsers, inviteUser,
  resendInvite, resetUserPassword, deleteCognitoUser,
} from '../auth'

const TOKENS_RAW = {
  AccessToken: 'a-jwt', IdToken: 'i-jwt', RefreshToken: 'r-jwt', ExpiresIn: 3600,
}

describe('signIn', () => {
  it('returns tokens when no challenge', async () => {
    cognitoMock.on(InitiateAuthCommand).resolves({ AuthenticationResult: TOKENS_RAW })
    const r = await signIn('a@x.com', 'pw')
    expect(r.tokens?.accessToken).toBe('a-jwt')
  })

  it('bubbles MFA challenge', async () => {
    cognitoMock.on(InitiateAuthCommand).resolves({ ChallengeName: 'SOFTWARE_TOKEN_MFA', Session: 'sess' })
    const r = await signIn('a@x.com', 'pw')
    expect(r.challengeName).toBe('SOFTWARE_TOKEN_MFA')
    expect(r.session).toBe('sess')
  })

  it('surfaces NewDeviceMetadata on first signin', async () => {
    cognitoMock.on(InitiateAuthCommand).resolves({
      AuthenticationResult: { ...TOKENS_RAW, NewDeviceMetadata: { DeviceKey: 'dk', DeviceGroupKey: 'dgk' } },
    })
    const r = await signIn('a@x.com', 'pw')
    expect(r.newDeviceMetadata).toEqual({ deviceKey: 'dk', deviceGroupKey: 'dgk' })
  })
})

describe('srpInit / srpVerify (Phase D + FIPS quirk)', () => {
  it('srpInit returns session + challengeParameters', async () => {
    cognitoMock.on(InitiateAuthCommand).resolves({
      Session: 'sess', ChallengeParameters: { SRP_B: 'B', SALT: 's' },
    })
    const r = await srpInit('a@x.com', 'A', undefined)
    expect(r.session).toBe('sess')
    expect(r.challengeParameters.SRP_B).toBe('B')
  })

  it('srpInit returns empty session when Cognito omits Session (FIPS endpoint quirk)', async () => {
    cognitoMock.on(InitiateAuthCommand).resolves({
      // Session deliberately missing — the bug class the route is hardened against.
      ChallengeParameters: { SRP_B: 'B', SALT: 's' },
    })
    const r = await srpInit('a@x.com', 'A', undefined)
    expect(r.session).toBe('')
  })

  it('srpInit throws when ChallengeParameters is missing', async () => {
    cognitoMock.on(InitiateAuthCommand).resolves({ Session: 'sess' })
    await expect(srpInit('a@x.com', 'A', undefined)).rejects.toThrow(/challenge parameters/)
  })

  it('srpVerify includes Session when present', async () => {
    cognitoMock.on(RespondToAuthChallengeCommand).resolves({ AuthenticationResult: TOKENS_RAW })
    await srpVerify('a@x.com', 'sess', {
      signature: 'sig', secretBlock: 'sb', timestamp: 'ts', largeA: 'A', smallA: 'a',
    }, undefined, undefined, undefined)
    const calls = cognitoMock.commandCalls(RespondToAuthChallengeCommand)
    expect(calls[0].args[0].input.Session).toBe('sess')
  })

  it('srpVerify omits Session when empty (FIPS path)', async () => {
    cognitoMock.on(RespondToAuthChallengeCommand).resolves({ AuthenticationResult: TOKENS_RAW })
    await srpVerify('a@x.com', '', {
      signature: 'sig', secretBlock: 'sb', timestamp: 'ts', largeA: 'A', smallA: 'a',
    }, undefined, undefined, undefined)
    const calls = cognitoMock.commandCalls(RespondToAuthChallengeCommand)
    expect(calls[0].args[0].input.Session).toBeUndefined()
  })

  it('srpVerify bubbles MFA challenge', async () => {
    cognitoMock.on(RespondToAuthChallengeCommand).resolves({
      ChallengeName: 'SOFTWARE_TOKEN_MFA', Session: 'mfa-sess',
    })
    const r = await srpVerify('a@x.com', 'sess', {
      signature: 's', secretBlock: 'sb', timestamp: 'ts', largeA: 'A', smallA: 'a',
    }, undefined, undefined, undefined)
    expect(r.challengeName).toBe('SOFTWARE_TOKEN_MFA')
  })

  it('srpVerify follows DEVICE_SRP_AUTH path when device cookies provided', async () => {
    cognitoMock.on(RespondToAuthChallengeCommand)
      .resolvesOnce({ ChallengeName: 'DEVICE_SRP_AUTH', Session: 'dev-sess', ChallengeParameters: { SRP_B: 'B', SALT: 's', SECRET_BLOCK: 'sb' } })
      .resolvesOnce({ Session: 'dev-sess-2' })   // DEVICE_SRP_AUTH response
      .resolvesOnce({ AuthenticationResult: TOKENS_RAW })   // DEVICE_PASSWORD_VERIFIER

    const r = await srpVerify('a@x.com', 'sess', {
      signature: 'sig', secretBlock: 'sb', timestamp: 'ts', largeA: 'A', smallA: 'a',
    }, 'dk', 'dgk', 'dp')

    expect(r.tokens?.accessToken).toBe('a-jwt')
  })
})

describe('respondToMfaChallenge / new password', () => {
  it('respondToMfaChallenge returns tokens', async () => {
    cognitoMock.on(RespondToAuthChallengeCommand).resolves({ AuthenticationResult: TOKENS_RAW })
    expect((await respondToMfaChallenge('a@x.com', '123', 'sess')).tokens.accessToken).toBe('a-jwt')
  })

  it('respondToNewPassword returns tokens on success', async () => {
    cognitoMock.on(RespondToAuthChallengeCommand).resolves({ AuthenticationResult: TOKENS_RAW })
    const r = await respondToNewPassword('a@x.com', 'newpw', 'sess')
    expect(r.tokens?.accessToken).toBe('a-jwt')
  })

  it('respondToNewPassword bubbles challenge', async () => {
    cognitoMock.on(RespondToAuthChallengeCommand).resolves({ ChallengeName: 'MFA_SETUP', Session: 's' })
    const r = await respondToNewPassword('a@x.com', 'newpw', 'sess')
    expect(r.challengeName).toBe('MFA_SETUP')
  })
})

describe('Device + MFA setup', () => {
  it('confirmAndRememberDevice issues ConfirmDevice + UpdateDeviceStatus', async () => {
    cognitoMock.on(ConfirmDeviceCommand).resolves({})
    cognitoMock.on(UpdateDeviceStatusCommand).resolves({})
    const r = await confirmAndRememberDevice('access', 'dk', 'dgk', 'iPhone')
    expect(r.devicePassword).toBe('dp')   // from the mocked createDeviceVerifier
    expect(cognitoMock.commandCalls(ConfirmDeviceCommand)).toHaveLength(1)
    expect(cognitoMock.commandCalls(UpdateDeviceStatusCommand)).toHaveLength(1)
  })

  it('getMfaSetupSecret returns SecretCode + Session', async () => {
    cognitoMock.on(AssociateSoftwareTokenCommand).resolves({ SecretCode: 'SECRET', Session: 's2' })
    expect(await getMfaSetupSecret('s1')).toEqual({ secretCode: 'SECRET', session: 's2' })
  })

  it('verifyMfaSetup returns new Session', async () => {
    cognitoMock.on(VerifySoftwareTokenCommand).resolves({ Session: 'next' })
    expect(await verifyMfaSetup('s', '123')).toEqual({ session: 'next' })
  })

  it('completeMfaSetup uses MFA_SETUP challenge and returns tokens', async () => {
    cognitoMock.on(RespondToAuthChallengeCommand).resolves({ AuthenticationResult: TOKENS_RAW })
    const r = await completeMfaSetup('a@x.com', 'sess')
    expect(r.tokens.accessToken).toBe('a-jwt')
    const call = cognitoMock.commandCalls(RespondToAuthChallengeCommand)[0]
    expect(call.args[0].input.ChallengeName).toBe('MFA_SETUP')
  })
})

describe('signInWithDevice', () => {
  it('returns SOFTWARE_TOKEN_MFA when Cognito drops back to MFA (device forgotten)', async () => {
    cognitoMock.on(InitiateAuthCommand).resolves({ Session: 's0', ChallengeParameters: {} })
    cognitoMock.on(RespondToAuthChallengeCommand).resolves({
      ChallengeName: 'SOFTWARE_TOKEN_MFA', Session: 'mfa-sess',
    })

    const r = await signInWithDevice('a@x.com', 'pw', 'dk', 'dgk', 'dp')
    expect(r.challengeName).toBe('SOFTWARE_TOKEN_MFA')
  })

  it('returns tokens immediately when password+device proof completes in two hops', async () => {
    cognitoMock.on(InitiateAuthCommand).resolves({ Session: 's0', ChallengeParameters: {} })
    cognitoMock.on(RespondToAuthChallengeCommand).resolves({ AuthenticationResult: TOKENS_RAW })

    const r = await signInWithDevice('a@x.com', 'pw', 'dk', 'dgk', 'dp')
    expect(r.tokens?.accessToken).toBe('a-jwt')
  })
})

describe('Session lifecycle', () => {
  it('signOut sends GlobalSignOut', async () => {
    cognitoMock.on(GlobalSignOutCommand).resolves({})
    await signOut('access')
    expect(cognitoMock.commandCalls(GlobalSignOutCommand)).toHaveLength(1)
  })

  it('refreshTokens returns new tokens', async () => {
    cognitoMock.on(InitiateAuthCommand).resolves({ AuthenticationResult: TOKENS_RAW })
    expect((await refreshTokens('refresh')).accessToken).toBe('a-jwt')
  })

  it('forgotPassword sends ForgotPasswordCommand', async () => {
    cognitoMock.on(ForgotPasswordCommand).resolves({})
    await forgotPassword('a@x.com')
    expect(cognitoMock.commandCalls(ForgotPasswordCommand)).toHaveLength(1)
  })

  it('confirmForgotPassword sends ConfirmForgotPasswordCommand', async () => {
    cognitoMock.on(ConfirmForgotPasswordCommand).resolves({})
    await confirmForgotPassword('a@x.com', '123', 'newpw')
    expect(cognitoMock.commandCalls(ConfirmForgotPasswordCommand)).toHaveLength(1)
  })

  it('getCurrentUser strips custom: prefix from attribute names', async () => {
    cognitoMock.on(GetUserCommand).resolves({
      UserAttributes: [
        { Name: 'email', Value: 'a@x.com' },
        { Name: 'custom:firm', Value: 'Alpha' },
      ],
    })
    const attrs = await getCurrentUser('access')
    expect(attrs).toEqual({ email: 'a@x.com', firm: 'Alpha' })
  })
})

describe('Passkeys (Phase C)', () => {
  it('startPasskeyRegistration returns CredentialCreationOptions', async () => {
    cognitoMock.on(StartWebAuthnRegistrationCommand).resolves({
      CredentialCreationOptions: { rp: { name: 'EE' }, challenge: 'c' } as unknown as never,
    })
    expect(await startPasskeyRegistration('access')).toEqual({ rp: { name: 'EE' }, challenge: 'c' })
  })

  it('completePasskeyRegistration forwards the credential', async () => {
    cognitoMock.on(CompleteWebAuthnRegistrationCommand).resolves({})
    await completePasskeyRegistration('access', { id: 'cred-1' })
    expect(cognitoMock.commandCalls(CompleteWebAuthnRegistrationCommand)).toHaveLength(1)
  })

  it('listPasskeys paginates and maps credentials', async () => {
    // Cast resolved values to `never` so we don't have to spell out the
    // full SDK type (WebAuthnCredentialDescription) for what's structurally
    // a stub.
    cognitoMock.on(ListWebAuthnCredentialsCommand)
      .resolvesOnce({
        Credentials: [{
          CredentialId: 'cred-1', FriendlyCredentialName: 'iPhone',
          RelyingPartyId: 'eq.com', CreatedAt: new Date('2026-01-01T00:00:00Z'),
          AuthenticatorAttachment: 'platform',
        }] as never,
        NextToken: 'cursor',
      })
      .resolvesOnce({
        Credentials: [{
          CredentialId: 'cred-2', FriendlyCredentialName: 'YubiKey',
          RelyingPartyId: 'eq.com', CreatedAt: new Date('2026-01-02T00:00:00Z'),
        }] as never,
      })
    const out = await listPasskeys('access')
    expect(out).toHaveLength(2)
    expect(out[0].credentialId).toBe('cred-1')
    expect(out[1].friendlyCredentialName).toBe('YubiKey')
  })

  it('listPasskeys skips entries without CredentialId', async () => {
    cognitoMock.on(ListWebAuthnCredentialsCommand).resolves({
      Credentials: [{ CredentialId: undefined }, { CredentialId: 'cred-x' }] as never,
    })
    const out = await listPasskeys('access')
    expect(out).toHaveLength(1)
  })

  it('deletePasskey sends DeleteWebAuthnCredentialCommand', async () => {
    cognitoMock.on(DeleteWebAuthnCredentialCommand).resolves({})
    await deletePasskey('access', 'cred-1')
    expect(cognitoMock.commandCalls(DeleteWebAuthnCredentialCommand)).toHaveLength(1)
  })

  it('passkeySigninInit returns session + parameters', async () => {
    cognitoMock.on(InitiateAuthCommand).resolves({
      ChallengeName: 'WEB_AUTHN', Session: 'sess',
      ChallengeParameters: { CREDENTIAL_REQUEST_OPTIONS: '{}' },
    })
    const r = await passkeySigninInit('a@x.com')
    expect(r.session).toBe('sess')
    expect(r.challengeParameters.CREDENTIAL_REQUEST_OPTIONS).toBe('{}')
  })

  it('passkeySigninInit throws if challenge is not WEB_AUTHN', async () => {
    cognitoMock.on(InitiateAuthCommand).resolves({ ChallengeName: 'SOFTWARE_TOKEN_MFA' })
    await expect(passkeySigninInit('a@x.com')).rejects.toThrow(/WEB_AUTHN/)
  })

  it('passkeySigninVerify returns tokens', async () => {
    cognitoMock.on(RespondToAuthChallengeCommand).resolves({ AuthenticationResult: TOKENS_RAW })
    const r = await passkeySigninVerify('a@x.com', 'sess', { id: 'cred' })
    expect(r.tokens.accessToken).toBe('a-jwt')
  })

  it('passkeySigninVerify omits Session when blank', async () => {
    cognitoMock.on(RespondToAuthChallengeCommand).resolves({ AuthenticationResult: TOKENS_RAW })
    await passkeySigninVerify('a@x.com', '', { id: 'cred' })
    const call = cognitoMock.commandCalls(RespondToAuthChallengeCommand)[0]
    expect(call.args[0].input.Session).toBeUndefined()
  })
})

describe('Admin user management', () => {
  it('listCognitoUsers paginates and normalizes emails', async () => {
    cognitoMock.on(ListUsersCommand)
      .resolvesOnce({
        Users: [{
          Username: 'a@x.com',
          Attributes: [
            { Name: 'email', Value: 'A@X.com' },
            { Name: 'sub',   Value: 'sub-1' },
          ],
          UserStatus: 'CONFIRMED', Enabled: true,
          UserCreateDate: new Date('2026-01-01T00:00:00Z'),
        }],
        PaginationToken: 'next',
      })
      .resolvesOnce({
        Users: [{
          Username: 'b@x.com',
          Attributes: [{ Name: 'email', Value: 'b@x.com' }],
          UserStatus: 'FORCE_CHANGE_PASSWORD',
        }],
      })
    const out = await listCognitoUsers()
    expect(out).toHaveLength(2)
    expect(out[0].email).toBe('a@x.com')           // lowercased
    expect(out[0].sub).toBe('sub-1')
    expect(out[1].sub).toBeNull()
  })

  it('inviteUser returns sub from AdminCreateUser response', async () => {
    cognitoMock.on(AdminCreateUserCommand).resolves({
      User: { Attributes: [{ Name: 'sub', Value: 'sub-1' }] },
    })
    expect(await inviteUser('a@x.com')).toEqual({ sub: 'sub-1' })
  })

  it('inviteUser throws when sub is missing in response', async () => {
    cognitoMock.on(AdminCreateUserCommand).resolves({ User: { Attributes: [] } })
    await expect(inviteUser('a@x.com')).rejects.toThrow(/did not include sub/)
  })

  it('resendInvite resolves canonical Username via ListUsers + then AdminCreateUser with RESEND', async () => {
    cognitoMock.on(ListUsersCommand).resolves({ Users: [{ Username: 'CanonicalCase@x.com' }] })
    cognitoMock.on(AdminCreateUserCommand).resolves({ User: { Attributes: [{ Name: 'sub', Value: 's' }] } })
    await resendInvite('canonicalcase@x.com')
    const create = cognitoMock.commandCalls(AdminCreateUserCommand)[0].args[0].input
    expect(create.Username).toBe('CanonicalCase@x.com')
    expect((create as { MessageAction?: string }).MessageAction).toBe('RESEND')
  })

  it('resendInvite throws UserNotFoundException when no canonical username', async () => {
    cognitoMock.on(ListUsersCommand).resolves({ Users: [] })
    await expect(resendInvite('nope@x.com')).rejects.toMatchObject({
      name: 'UserNotFoundException',
    })
  })

  it('resetUserPassword resolves canonical username + AdminResetUserPassword', async () => {
    cognitoMock.on(ListUsersCommand).resolves({ Users: [{ Username: 'CanCase@x.com' }] })
    cognitoMock.on(AdminResetUserPasswordCommand).resolves({})
    await resetUserPassword('cancase@x.com')
    expect(cognitoMock.commandCalls(AdminResetUserPasswordCommand)[0].args[0].input.Username).toBe('CanCase@x.com')
  })

  it('deleteCognitoUser resolves canonical + AdminDeleteUser', async () => {
    cognitoMock.on(ListUsersCommand).resolves({ Users: [{ Username: 'CanCase@x.com' }] })
    cognitoMock.on(AdminDeleteUserCommand).resolves({})
    await deleteCognitoUser('CANCASE@x.com')
    expect(cognitoMock.commandCalls(AdminDeleteUserCommand)[0].args[0].input.Username).toBe('CanCase@x.com')
  })

  it('deleteCognitoUser throws UserNotFoundException when no canonical username found', async () => {
    cognitoMock.on(ListUsersCommand).resolves({ Users: [] })
    await expect(deleteCognitoUser('nope@x.com')).rejects.toMatchObject({
      name: 'UserNotFoundException',
    })
  })
})
