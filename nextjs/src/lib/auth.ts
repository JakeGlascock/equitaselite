import {
  InitiateAuthCommand,
  RespondToAuthChallengeCommand,
  GlobalSignOutCommand,
  GetUserCommand,
  AdminCreateUserCommand,
  AssociateSoftwareTokenCommand,
  VerifySoftwareTokenCommand,
  ListUsersCommand,
  type AuthenticationResultType,
  type UserType,
} from '@aws-sdk/client-cognito-identity-provider'
import { cognitoClient } from './aws'

// Server-side only — not exposed to the browser
const CLIENT_ID = (process.env.COGNITO_CLIENT_ID ?? process.env.NEXT_PUBLIC_COGNITO_CLIENT_ID)!

export interface AuthTokens {
  accessToken: string
  idToken: string
  refreshToken: string
  expiresIn: number
}

export async function signIn(email: string, password: string): Promise<{
  tokens?: AuthTokens
  challengeName?: string
  session?: string
}> {
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

  return { tokens: toTokens(AuthenticationResult!) }
}

export async function respondToMfaChallenge(
  email: string,
  code: string,
  session: string
): Promise<AuthTokens> {
  const { AuthenticationResult } = await cognitoClient.send(
    new RespondToAuthChallengeCommand({
      ClientId: CLIENT_ID,
      ChallengeName: 'SOFTWARE_TOKEN_MFA',
      Session: session,
      ChallengeResponses: { USERNAME: email, SOFTWARE_TOKEN_MFA_CODE: code },
    })
  )
  return toTokens(AuthenticationResult!)
}

export async function signOut(accessToken: string): Promise<void> {
  await cognitoClient.send(new GlobalSignOutCommand({ AccessToken: accessToken }))
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
      out.push({
        email:     email.toLowerCase(),
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

export async function respondToNewPassword(
  username: string,
  newPassword: string,
  session: string,
): Promise<{ tokens?: AuthTokens; challengeName?: string; session?: string }> {
  const { AuthenticationResult, ChallengeName, Session } = await cognitoClient.send(
    new RespondToAuthChallengeCommand({
      ClientId: CLIENT_ID,
      ChallengeName: 'NEW_PASSWORD_REQUIRED',
      Session: session,
      ChallengeResponses: { USERNAME: username, NEW_PASSWORD: newPassword },
    })
  )
  if (ChallengeName) return { challengeName: ChallengeName, session: Session }
  return { tokens: toTokens(AuthenticationResult!) }
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

function toTokens(result: AuthenticationResultType): AuthTokens {
  return {
    accessToken:  result.AccessToken!,
    idToken:      result.IdToken!,
    refreshToken: result.RefreshToken!,
    expiresIn:    result.ExpiresIn!,
  }
}
