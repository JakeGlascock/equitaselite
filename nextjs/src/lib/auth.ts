import {
  InitiateAuthCommand,
  RespondToAuthChallengeCommand,
  GlobalSignOutCommand,
  GetUserCommand,
  AdminCreateUserCommand,
  AdminDeleteUserCommand,
  AdminResetUserPasswordCommand,
  AssociateSoftwareTokenCommand,
  VerifySoftwareTokenCommand,
  ConfirmDeviceCommand,
  UpdateDeviceStatusCommand,
  ForgotPasswordCommand,
  ConfirmForgotPasswordCommand,
  ListUsersCommand,
  type AuthenticationResultType,
  type NewDeviceMetadataType,
  type UserType,
} from '@aws-sdk/client-cognito-identity-provider'
import {
  createSrpSession,
  signSrpSession,
  signSrpSessionWithDevice,
  wrapInitiateAuth,
  wrapAuthChallenge,
  createDeviceVerifier,
} from 'cognito-srp-helper'
import { cognitoClient } from './aws'

// Server-side only — not exposed to the browser
const CLIENT_ID = (process.env.COGNITO_CLIENT_ID ?? process.env.NEXT_PUBLIC_COGNITO_CLIENT_ID)!

// cognito-srp-helper's createSrpSession expects the FULL pool ID
// (e.g. "us-east-1_AbCdEfGhI") — it internally splits on "_" and
// takes index [1] to derive the pool abbreviation for the SRP
// password-hash input. Passing just the abbreviation silently breaks
// SRP because [1] of a one-element split is undefined, which then
// hashes as "undefined<user>:<password>" — Cognito rejects the
// password verifier, signInWithDevice throws, and the signin route
// falls back to plain USER_PASSWORD_AUTH (MFA prompts again).
function fullPoolId(): string {
  return process.env.COGNITO_USER_POOL_ID ?? ''
}

export interface AuthTokens {
  accessToken: string
  idToken: string
  refreshToken: string
  expiresIn: number
}

/**
 * Cognito's NewDeviceMetadata, surfaced when the user signs in from
 * a device that hasn't been confirmed yet. The signin handler stores
 * these (plus the random device password we generate at confirm time)
 * as HttpOnly cookies so future signins can take the device-trusted
 * SRP path that skips MFA.
 */
export interface DeviceMetadata {
  deviceKey:      string
  deviceGroupKey: string
}

export interface SignInResult {
  tokens?:           AuthTokens
  challengeName?:   string
  session?:         string
  newDeviceMetadata?: DeviceMetadata
}

export async function signIn(email: string, password: string): Promise<SignInResult> {
  const { AuthenticationResult, ChallengeName, Session } = await cognitoClient.send(
    new InitiateAuthCommand({
      AuthFlow: 'USER_PASSWORD_AUTH',
      ClientId: CLIENT_ID,
      AuthParameters: { USERNAME: email, PASSWORD: password },
    })
  )

  if (ChallengeName) {
    return { challengeName: ChallengeName, session: Session }
  }

  return {
    tokens:            toTokens(AuthenticationResult!),
    newDeviceMetadata: toDeviceMetadata(AuthenticationResult?.NewDeviceMetadata),
  }
}

/**
 * Browser-driven SRP signin (Phase D).
 *
 * The client owns the password and computes the SRP_A ephemeral
 * locally before calling us, so the password never leaves the browser
 * in any form — even encrypted inside an HTTPS body. We relay the
 * SRP_A to Cognito's USER_SRP_AUTH flow and return the resulting
 * PASSWORD_VERIFIER challenge for the client to finish.
 */
export async function srpInit(
  email:     string,
  srpA:      string,
  deviceKey: string | undefined,
): Promise<{ session: string; challengeParameters: Record<string, string> }> {
  const authParameters: Record<string, string> = { USERNAME: email, SRP_A: srpA }
  if (deviceKey) authParameters.DEVICE_KEY = deviceKey

  const res = await cognitoClient.send(new InitiateAuthCommand({
    AuthFlow:       'USER_SRP_AUTH',
    ClientId:       CLIENT_ID,
    AuthParameters: authParameters,
  }))

  if (!res.Session) {
    throw new Error('Cognito SRP init did not return a session')
  }
  return {
    session:             res.Session,
    challengeParameters: (res.ChallengeParameters ?? {}) as Record<string, string>,
  }
}

/**
 * Complete the SRP signin by relaying the client-computed password
 * proof to Cognito. If the device is confirmed and the cookie-stored
 * device password is supplied, Cognito skips MFA — we then drive the
 * DEVICE_SRP_AUTH dance server-side because the device password lives
 * in HttpOnly cookies the browser can't read.
 */
export interface SrpVerifyClaim {
  signature:   string  // PASSWORD_CLAIM_SIGNATURE (HMAC base64)
  secretBlock: string  // PASSWORD_CLAIM_SECRET_BLOCK (passthrough from init)
  timestamp:   string  // TIMESTAMP used in the signature
  largeA:      string  // SRP_A (public, hex) — same value sent to srp_init
  smallA:      string  // srp_a (private ephemeral, hex). Sharing this is fine —
                       // it's a one-time random value, not the password. Needed
                       // server-side only when the user has device cookies, so
                       // we can drive the DEVICE_SRP_AUTH dance whose math
                       // requires the same ephemeral that signed PASSWORD_VERIFIER.
}

export async function srpVerify(
  email:          string,
  session:        string,
  claim:          SrpVerifyClaim,
  deviceKey:      string | undefined,
  deviceGroupKey: string | undefined,
  devicePassword: string | undefined,
): Promise<SignInResult> {
  const challengeResponses: Record<string, string> = {
    USERNAME:                       email,
    PASSWORD_CLAIM_SECRET_BLOCK:    claim.secretBlock,
    PASSWORD_CLAIM_SIGNATURE:       claim.signature,
    TIMESTAMP:                      claim.timestamp,
    SRP_A:                          claim.largeA,
  }
  if (deviceKey) challengeResponses.DEVICE_KEY = deviceKey

  const passwordRes = await cognitoClient.send(new RespondToAuthChallengeCommand({
    ClientId:           CLIENT_ID,
    ChallengeName:      'PASSWORD_VERIFIER',
    Session:            session,
    ChallengeResponses: challengeResponses,
  }))

  // No further challenge — tokens immediately.
  if (!passwordRes.ChallengeName) {
    return {
      tokens:            toTokens(passwordRes.AuthenticationResult!),
      newDeviceMetadata: toDeviceMetadata(passwordRes.AuthenticationResult?.NewDeviceMetadata),
    }
  }

  // Device-trusted path: finish the device-SRP exchange server-side
  // using the cookie-stored device password. The client never sees
  // the device password.
  if (passwordRes.ChallengeName === 'DEVICE_SRP_AUTH'
      && deviceKey && deviceGroupKey && devicePassword) {
    return finishDeviceSrp(email, passwordRes.Session!, claim, deviceKey, deviceGroupKey, devicePassword)
  }

  // MFA, new-password, or any other challenge — bubble up so the
  // signin route surfaces the right UI step.
  return { challengeName: passwordRes.ChallengeName, session: passwordRes.Session }
}

/**
 * Finish the DEVICE_SRP_AUTH → DEVICE_PASSWORD_VERIFIER exchange after
 * the user proved their password. The device password lives in the
 * HttpOnly cookie set at confirm-time, so the SRP proof for the
 * device step lives server-side. The same SRP ephemeral (smallA +
 * largeA + timestamp) from the user-SRP step is reused — Cognito ties
 * password-verifier and device-srp together via SRP_A under one Session.
 */
async function finishDeviceSrp(
  email:           string,
  challengeSession: string,
  claim:           SrpVerifyClaim,
  deviceKey:       string,
  deviceGroupKey:  string,
  devicePassword:  string,
): Promise<SignInResult> {
  const deviceSrpRes = await cognitoClient.send(new RespondToAuthChallengeCommand({
    ClientId:           CLIENT_ID,
    ChallengeName:      'DEVICE_SRP_AUTH',
    Session:            challengeSession,
    ChallengeResponses: { USERNAME: email, DEVICE_KEY: deviceKey, SRP_A: claim.largeA },
  }))

  // Rebuild a minimal SrpSession from the client-supplied ephemeral so
  // signSrpSessionWithDevice() has the smallA/largeA/timestamp inputs
  // it needs. The session's `password`/`username`/`poolId` fields are
  // unused on the device path (the device password + group key are
  // what feed the SRP math).
  const rebuiltSession = {
    username:     email,
    password:     '',
    poolId:       fullPoolId(),
    poolIdAbbr:   fullPoolId().split('_')[1] ?? '',
    isHashed:     true,
    timestamp:    claim.timestamp,
    smallA:       claim.smallA,
    largeA:       claim.largeA,
  }
  // cognito-srp-helper.signSrpSessionWithDevice() throws
  // MissingDeviceKeyError if ChallengeParameters.DEVICE_KEY isn't
  // present. Cognito's docs say it returns DEVICE_KEY in the
  // DEVICE_PASSWORD_VERIFIER challenge, but real-world responses
  // sometimes omit it — and we already have the value from the cookie.
  // Inject it defensively so the lib's check is satisfied either way.
  const augmentedRes = {
    ...deviceSrpRes,
    ChallengeParameters: {
      ...(deviceSrpRes.ChallengeParameters ?? {}),
      DEVICE_KEY: deviceSrpRes.ChallengeParameters?.DEVICE_KEY ?? deviceKey,
    },
  }
  const signed = signSrpSessionWithDevice(rebuiltSession, augmentedRes, deviceGroupKey, devicePassword)

  const finalRes = await cognitoClient.send(new RespondToAuthChallengeCommand({
    ClientId:           CLIENT_ID,
    ChallengeName:      'DEVICE_PASSWORD_VERIFIER',
    Session:            deviceSrpRes.Session,
    ChallengeResponses: {
      USERNAME:                    email,
      DEVICE_KEY:                  deviceKey,
      PASSWORD_CLAIM_SECRET_BLOCK: signed.secret,
      PASSWORD_CLAIM_SIGNATURE:    signed.passwordSignature,
      TIMESTAMP:                   signed.timestamp,
      SRP_A:                       signed.largeA,
    },
  }))

  return { tokens: toTokens(finalRes.AuthenticationResult!) }
}

export async function respondToMfaChallenge(
  email: string,
  code: string,
  session: string
): Promise<{ tokens: AuthTokens; newDeviceMetadata?: DeviceMetadata }> {
  const { AuthenticationResult } = await cognitoClient.send(
    new RespondToAuthChallengeCommand({
      ClientId: CLIENT_ID,
      ChallengeName: 'SOFTWARE_TOKEN_MFA',
      Session: session,
      ChallengeResponses: { USERNAME: email, SOFTWARE_TOKEN_MFA_CODE: code },
    })
  )
  return {
    tokens:            toTokens(AuthenticationResult!),
    newDeviceMetadata: toDeviceMetadata(AuthenticationResult?.NewDeviceMetadata),
  }
}

/**
 * Confirm a freshly-issued device with Cognito and mark it remembered.
 *
 * Returns the device password we generated and persisted to Cognito as
 * the SRP verifier. The CALLER must store deviceKey + deviceGroupKey +
 * devicePassword (and the user's email/sub) in HttpOnly cookies — those
 * three values together let `signInWithDevice` skip MFA on subsequent
 * sign-ins. Without the password the device key is useless; without the
 * device key the password is useless.
 */
export async function confirmAndRememberDevice(
  accessToken:    string,
  deviceKey:      string,
  deviceGroupKey: string,
  deviceName:     string,
): Promise<{ devicePassword: string }> {
  const { DeviceSecretVerifierConfig, DeviceRandomPassword } =
    createDeviceVerifier(deviceKey, deviceGroupKey)

  await cognitoClient.send(new ConfirmDeviceCommand({
    AccessToken:                accessToken,
    DeviceKey:                  deviceKey,
    DeviceName:                 deviceName,
    DeviceSecretVerifierConfig,
  }))

  await cognitoClient.send(new UpdateDeviceStatusCommand({
    AccessToken:            accessToken,
    DeviceKey:              deviceKey,
    DeviceRememberedStatus: 'remembered',
  }))

  return { devicePassword: DeviceRandomPassword }
}

/**
 * Sign in via USER_SRP_AUTH carrying a trusted device key. On
 * success Cognito skips the SOFTWARE_TOKEN_MFA challenge and goes
 * straight into DEVICE_SRP_AUTH → DEVICE_PASSWORD_VERIFIER, which
 * the device password (stored locally) proves possession of without
 * any user interaction.
 *
 * If Cognito ever rejects the device (rotated keys, server-side
 * forget, etc.) it falls back to SOFTWARE_TOKEN_MFA — the caller
 * surfaces that as the standard MFA challenge so the user re-pairs.
 */
export async function signInWithDevice(
  email:          string,
  password:       string,
  deviceKey:      string,
  deviceGroupKey: string,
  devicePassword: string,
): Promise<SignInResult> {
  const srpSession = createSrpSession(email, password, fullPoolId(), false)

  // Step 1: SRP_A
  const initRes = await cognitoClient.send(new InitiateAuthCommand(
    wrapInitiateAuth(srpSession, {
      ClientId:       CLIENT_ID,
      AuthFlow:       'USER_SRP_AUTH',
      AuthParameters: { USERNAME: email, DEVICE_KEY: deviceKey },
    }),
  ))

  // Step 2: PASSWORD_VERIFIER proof
  const signed = signSrpSession(srpSession, initRes)
  const passwordRes = await cognitoClient.send(new RespondToAuthChallengeCommand(
    wrapAuthChallenge(signed, {
      ClientId:           CLIENT_ID,
      ChallengeName:      'PASSWORD_VERIFIER',
      Session:            initRes.Session,
      ChallengeResponses: { USERNAME: email, DEVICE_KEY: deviceKey },
    }),
  ))

  // After password is accepted Cognito routes us through the device
  // SRP challenge instead of MFA. If it does NOT (challenge name comes
  // back as SOFTWARE_TOKEN_MFA), the device has been forgotten on the
  // server — surface the MFA challenge so the user re-pairs.
  if (passwordRes.ChallengeName === 'SOFTWARE_TOKEN_MFA') {
    return { challengeName: 'SOFTWARE_TOKEN_MFA', session: passwordRes.Session }
  }
  if (passwordRes.ChallengeName !== 'DEVICE_SRP_AUTH') {
    return {
      tokens:            toTokens(passwordRes.AuthenticationResult!),
      newDeviceMetadata: toDeviceMetadata(passwordRes.AuthenticationResult?.NewDeviceMetadata),
    }
  }

  // Step 3: DEVICE_SRP_AUTH — re-send SRP_A (same ephemeral)
  const deviceSrpRes = await cognitoClient.send(new RespondToAuthChallengeCommand(
    wrapAuthChallenge(signed, {
      ClientId:           CLIENT_ID,
      ChallengeName:      'DEVICE_SRP_AUTH',
      Session:            passwordRes.Session,
      ChallengeResponses: { USERNAME: email, DEVICE_KEY: deviceKey },
    }),
  ))

  // Step 4: DEVICE_PASSWORD_VERIFIER proof
  const deviceSigned = signSrpSessionWithDevice(
    srpSession, deviceSrpRes, deviceGroupKey, devicePassword,
  )
  const finalRes = await cognitoClient.send(new RespondToAuthChallengeCommand(
    wrapAuthChallenge(deviceSigned, {
      ClientId:           CLIENT_ID,
      ChallengeName:      'DEVICE_PASSWORD_VERIFIER',
      Session:            deviceSrpRes.Session,
      ChallengeResponses: { USERNAME: email, DEVICE_KEY: deviceKey },
    }),
  ))

  return { tokens: toTokens(finalRes.AuthenticationResult!) }
}

export async function signOut(accessToken: string): Promise<void> {
  await cognitoClient.send(new GlobalSignOutCommand({ AccessToken: accessToken }))
}

/**
 * User-initiated password reset (step 1). Cognito emails the user a
 * one-time confirmation code. Throws on rate-limit / unknown errors;
 * NEVER throws on unknown-user to avoid email enumeration — Cognito
 * silently returns success.
 */
export async function forgotPassword(email: string): Promise<void> {
  await cognitoClient.send(new ForgotPasswordCommand({
    ClientId: CLIENT_ID,
    Username: email,
  }))
}

/**
 * User-initiated password reset (step 2). Sets the new password if
 * the confirmation code from the email matches.
 */
export async function confirmForgotPassword(
  email:       string,
  code:        string,
  newPassword: string,
): Promise<void> {
  await cognitoClient.send(new ConfirmForgotPasswordCommand({
    ClientId:         CLIENT_ID,
    Username:         email,
    ConfirmationCode: code,
    Password:         newPassword,
  }))
}

export async function getCurrentUser(accessToken: string) {
  const { UserAttributes } = await cognitoClient.send(
    new GetUserCommand({ AccessToken: accessToken })
  )
  return Object.fromEntries(
    (UserAttributes ?? []).map(a => [a.Name!.replace('custom:', ''), a.Value])
  )
}

export async function refreshTokens(refreshToken: string): Promise<AuthTokens> {
  const { AuthenticationResult } = await cognitoClient.send(
    new InitiateAuthCommand({
      AuthFlow: 'REFRESH_TOKEN_AUTH',
      ClientId: CLIENT_ID,
      AuthParameters: { REFRESH_TOKEN: refreshToken },
    })
  )
  return toTokens(AuthenticationResult!)
}

export interface CognitoUserRow {
  email:      string
  sub:        string | null  // Cognito sub from UserAttributes (null if unreadable)
  status:     string  // FORCE_CHANGE_PASSWORD | CONFIRMED | ARCHIVED | ...
  enabled:    boolean
  createdAt:  string  // ISO
}

export async function listCognitoUsers(): Promise<CognitoUserRow[]> {
  const out: CognitoUserRow[] = []
  let paginationToken: string | undefined
  do {
    const res = await cognitoClient.send(new ListUsersCommand({
      UserPoolId:      process.env.COGNITO_USER_POOL_ID!,
      Limit:           60,
      PaginationToken: paginationToken,
    }))
    for (const u of (res.Users ?? []) as UserType[]) {
      const email = u.Attributes?.find(a => a.Name === 'email')?.Value
                 ?? u.Username
                 ?? ''
      const sub   = u.Attributes?.find(a => a.Name === 'sub')?.Value ?? null
      out.push({
        email:     email.toLowerCase(),
        sub,
        status:    u.UserStatus ?? 'UNKNOWN',
        enabled:   u.Enabled ?? true,
        createdAt: u.UserCreateDate?.toISOString() ?? '',
      })
    }
    paginationToken = res.PaginationToken
  } while (paginationToken)
  return out
}

export async function inviteUser(email: string): Promise<{ sub: string }> {
  const res = await cognitoClient.send(new AdminCreateUserCommand({
    UserPoolId: process.env.COGNITO_USER_POOL_ID!,
    Username: email,
    UserAttributes: [
      { Name: 'email',          Value: email },
      { Name: 'email_verified', Value: 'true' },
    ],
    DesiredDeliveryMediums: ['EMAIL'],
  }))
  // Cognito returns the sub as the "sub" attribute on the new user. The
  // sub is what every authenticated request later carries in x-user-id
  // (via the middleware JWT decode), so it's the right primary key for
  // the placeholder profile row.
  const sub = res.User?.Attributes?.find(a => a.Name === 'sub')?.Value
  if (!sub) {
    throw new Error('Cognito AdminCreateUser response did not include sub')
  }
  return { sub }
}

// Look up the canonical Cognito Username for an email — case-insensitive
// match on the email *attribute*, returning the exact-case Username Cognito
// has stored. Cognito's AdminDeleteUser / AdminResetUserPassword /
// AdminCreateUser with RESEND all match Username case-sensitively, so we
// can't pass the user-supplied email directly. Returns null when the user
// doesn't exist.
async function resolveCognitoUsername(email: string): Promise<string | null> {
  // Filter strings are quoted; escape any embedded quotes just in case.
  const safe = email.replace(/"/g, '\\"')
  const res = await cognitoClient.send(new ListUsersCommand({
    UserPoolId: process.env.COGNITO_USER_POOL_ID!,
    Filter:     `email = "${safe}"`,
    Limit:      1,
  }))
  return res.Users?.[0]?.Username ?? null
}

function userNotFound(email: string): Error {
  const err = new Error(`User does not exist (email=${email})`)
  err.name = 'UserNotFoundException'
  return err
}

// Resend the Cognito invitation email for a user who hasn't yet completed
// first-time sign-in (status FORCE_CHANGE_PASSWORD). Generates a fresh
// temporary password and emails it. Fails if the user is already CONFIRMED
// — use resetUserPassword in that case.
export async function resendInvite(email: string): Promise<void> {
  const username = await resolveCognitoUsername(email)
  if (!username) throw userNotFound(email)
  await cognitoClient.send(new AdminCreateUserCommand({
    UserPoolId:             process.env.COGNITO_USER_POOL_ID!,
    Username:               username,
    MessageAction:          'RESEND',
    DesiredDeliveryMediums: ['EMAIL'],
  }))
}

// Send a password-reset email for a CONFIRMED Cognito user. They receive a
// code and use the standard "forgot password" flow to set a new one.
export async function resetUserPassword(email: string): Promise<void> {
  const username = await resolveCognitoUsername(email)
  if (!username) throw userNotFound(email)
  await cognitoClient.send(new AdminResetUserPasswordCommand({
    UserPoolId: process.env.COGNITO_USER_POOL_ID!,
    Username:   username,
  }))
}

// Hard-delete a user from Cognito. Used by the admin "Delete user" action.
// Throws UserNotFoundException if the user doesn't exist — callers can
// catch and continue when it's acceptable for the user to already be gone.
export async function deleteCognitoUser(email: string): Promise<void> {
  const username = await resolveCognitoUsername(email)
  if (!username) throw userNotFound(email)
  await cognitoClient.send(new AdminDeleteUserCommand({
    UserPoolId: process.env.COGNITO_USER_POOL_ID!,
    Username:   username,
  }))
}

export async function respondToNewPassword(
  username: string,
  newPassword: string,
  session: string,
): Promise<SignInResult> {
  const { AuthenticationResult, ChallengeName, Session } = await cognitoClient.send(
    new RespondToAuthChallengeCommand({
      ClientId: CLIENT_ID,
      ChallengeName: 'NEW_PASSWORD_REQUIRED',
      Session: session,
      ChallengeResponses: { USERNAME: username, NEW_PASSWORD: newPassword },
    })
  )
  if (ChallengeName) return { challengeName: ChallengeName, session: Session }
  return {
    tokens:            toTokens(AuthenticationResult!),
    newDeviceMetadata: toDeviceMetadata(AuthenticationResult?.NewDeviceMetadata),
  }
}

export async function getMfaSetupSecret(
  session: string,
): Promise<{ secretCode: string; session: string }> {
  const { SecretCode, Session } = await cognitoClient.send(
    new AssociateSoftwareTokenCommand({ Session: session })
  )
  return { secretCode: SecretCode!, session: Session! }
}

export async function verifyMfaSetup(
  session: string,
  userCode: string,
): Promise<{ session: string }> {
  const { Session } = await cognitoClient.send(
    new VerifySoftwareTokenCommand({
      Session: session,
      UserCode: userCode,
      FriendlyDeviceName: 'Authenticator App',
    })
  )
  return { session: Session! }
}

// Finish the original auth flow after a successful VerifySoftwareToken.
// Cognito expects RespondToAuthChallenge with ChallengeName='MFA_SETUP'
// and just a USERNAME in the responses — the verification state is carried
// in the session from VerifySoftwareToken. No TOTP code re-entry needed.
//
// The previous implementation re-sent the TOTP code under
// ChallengeName='SOFTWARE_TOKEN_MFA', which Cognito frequently rejected
// (one-time-use enforcement on the code that was just consumed by
// VerifySoftwareToken, plus clock-skew edge cases) — triggering the
// "second 2FA prompt" fallback path.
export async function completeMfaSetup(
  username: string,
  session: string,
): Promise<{ tokens: AuthTokens; newDeviceMetadata?: DeviceMetadata }> {
  const { AuthenticationResult } = await cognitoClient.send(
    new RespondToAuthChallengeCommand({
      ClientId:           CLIENT_ID,
      ChallengeName:      'MFA_SETUP',
      Session:            session,
      ChallengeResponses: { USERNAME: username },
    })
  )
  return {
    tokens:            toTokens(AuthenticationResult!),
    newDeviceMetadata: toDeviceMetadata(AuthenticationResult?.NewDeviceMetadata),
  }
}

function toTokens(result: AuthenticationResultType): AuthTokens {
  return {
    accessToken:  result.AccessToken!,
    idToken:      result.IdToken!,
    refreshToken: result.RefreshToken!,
    expiresIn:    result.ExpiresIn!,
  }
}

function toDeviceMetadata(meta: NewDeviceMetadataType | undefined): DeviceMetadata | undefined {
  if (!meta?.DeviceKey || !meta?.DeviceGroupKey) return undefined
  return { deviceKey: meta.DeviceKey, deviceGroupKey: meta.DeviceGroupKey }
}
