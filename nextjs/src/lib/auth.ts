import {
  InitiateAuthCommand,
  RespondToAuthChallengeCommand,
  GlobalSignOutCommand,
  GetUserCommand,
  type AuthenticationResultType,
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

function toTokens(result: AuthenticationResultType): AuthTokens {
  return {
    accessToken:  result.AccessToken!,
    idToken:      result.IdToken!,
    refreshToken: result.RefreshToken!,
    expiresIn:    result.ExpiresIn!,
  }
}
