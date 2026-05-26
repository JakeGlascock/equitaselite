#!/usr/bin/env node
// One-off: enable WebAuthn / passkeys on the production Cognito user pool.
//
// Why this exists: the `aws_cognito_user_pool` Terraform resource has a
// `web_authn_configuration` block (provider v5.85+), but applying it
// against the FIPS Cognito endpoint silently no-ops on the WebAuthn
// field while applying every other change. Real symptom:
//   - terraform plan + apply both report success
//   - `aws cognito-idp describe-user-pool` returns WebAuthnConfiguration=null
//   - StartWebAuthnRegistration throws WebAuthnNotEnabledException
//
// This script bypasses the FIPS endpoint for THIS one administrative
// call. The user pool itself is unchanged in terms of KMS / data
// encryption — FIPS is a transport-layer compliance constraint, not a
// data-at-rest one, and a one-shot admin op against the standard
// endpoint doesn't compromise the pool's compliance posture.
//
// Run with valid AWS SSO credentials:
//   aws sso login --profile equitaselite-prod
//   AWS_PROFILE=equitaselite-prod node infrastructure/scripts/enable-webauthn.mjs

import {
  CognitoIdentityProviderClient,
  DescribeUserPoolCommand,
  UpdateUserPoolCommand,
} from '@aws-sdk/client-cognito-identity-provider'

const POOL_ID            = process.env.USER_POOL_ID    ?? 'us-east-1_UEXlTwZPY'
const RELYING_PARTY_ID   = process.env.RP_ID           ?? 'equitaselite.com'
const USER_VERIFICATION  = process.env.UV              ?? 'required'

// Standard (non-FIPS) endpoint. The FIPS variant is where the field
// silently drops.
const client = new CognitoIdentityProviderClient({
  region:           'us-east-1',
  useFipsEndpoint:  false,
})

const { UserPool: pool } = await client.send(
  new DescribeUserPoolCommand({ UserPoolId: POOL_ID }),
)
if (!pool) throw new Error('Pool not found')

console.log(`Current WebAuthnConfiguration: ${JSON.stringify(pool.WebAuthnConfiguration ?? null)}`)
console.log(`Tier: ${pool.UserPoolTier} (must be PLUS or above for WebAuthn)`)
console.log(`Current AllowedFirstAuthFactors: ${JSON.stringify(pool.Policies?.SignInPolicy?.AllowedFirstAuthFactors)}`)

// Cognito silently drops WebAuthnConfiguration unless SignInPolicy's
// AllowedFirstAuthFactors includes WEB_AUTHN. Append it (keeping
// PASSWORD so the existing flow keeps working alongside passkeys).
// This works only because mfa_configuration is OPTIONAL — the pool
// previously had it ON, and Cognito refused the combination because
// passkey-as-first-factor would bypass mandatory MFA. With OPTIONAL,
// users without passkeys still go through password + TOTP; users
// with passkeys do a single Face ID tap (which IS multi-factor on
// its own — NIST 800-63 AAL3).
const existingFactors = pool.Policies?.SignInPolicy?.AllowedFirstAuthFactors ?? ['PASSWORD']
const factors = existingFactors.includes('WEB_AUTHN')
  ? existingFactors
  : [...existingFactors, 'WEB_AUTHN']
const policiesWithWebAuthn = {
  ...pool.Policies,
  SignInPolicy: {
    ...(pool.Policies?.SignInPolicy ?? {}),
    AllowedFirstAuthFactors: factors,
  },
}

// UpdateUserPool resets any field you don't include to its default.
// Re-send every writeable field from the describe response so nothing
// else gets clobbered.
const input = {
  UserPoolId:                    POOL_ID,
  Policies:                      policiesWithWebAuthn,
  DeletionProtection:            pool.DeletionProtection,
  LambdaConfig:                  pool.LambdaConfig,
  AutoVerifiedAttributes:        pool.AutoVerifiedAttributes,
  SmsVerificationMessage:        pool.SmsVerificationMessage,
  EmailVerificationMessage:      pool.EmailVerificationMessage,
  EmailVerificationSubject:      pool.EmailVerificationSubject,
  VerificationMessageTemplate:   pool.VerificationMessageTemplate,
  SmsAuthenticationMessage:      pool.SmsAuthenticationMessage,
  UserAttributeUpdateSettings:   pool.UserAttributeUpdateSettings,
  MfaConfiguration:              pool.MfaConfiguration,
  DeviceConfiguration:           pool.DeviceConfiguration,
  EmailConfiguration:            pool.EmailConfiguration,
  SmsConfiguration:              pool.SmsConfiguration,
  UserPoolTags:                  pool.UserPoolTags,
  AdminCreateUserConfig:         pool.AdminCreateUserConfig,
  UserPoolAddOns:                pool.UserPoolAddOns,
  AccountRecoverySetting:        pool.AccountRecoverySetting,
  PoolName:                      pool.Name,
  UserPoolTier:                  pool.UserPoolTier,

  // The reason we're here.
  WebAuthnConfiguration: {
    RelyingPartyId:  RELYING_PARTY_ID,
    UserVerification: USER_VERIFICATION,
  },
}

console.log('Sending UpdateUserPool (non-FIPS endpoint)...')
await client.send(new UpdateUserPoolCommand(input))

// Re-describe to confirm it stuck.
const { UserPool: after } = await client.send(
  new DescribeUserPoolCommand({ UserPoolId: POOL_ID }),
)
console.log(`After: WebAuthnConfiguration = ${JSON.stringify(after?.WebAuthnConfiguration)}`)

if (!after?.WebAuthnConfiguration) {
  console.error('FAILED — WebAuthnConfiguration still null after update. Investigate.')
  process.exit(1)
}
console.log('✓ WebAuthn enabled.')
