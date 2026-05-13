import { CognitoIdentityProviderClient } from '@aws-sdk/client-cognito-identity-provider'
import { S3Client } from '@aws-sdk/client-s3'
import { SecretsManagerClient } from '@aws-sdk/client-secrets-manager'

const region = process.env.AWS_REGION ?? 'us-east-1'

// All clients use FIPS endpoints to satisfy FIPS 140-2 boundary requirement.
// When AWS upgrades KMS/Cognito HSM firmware to FIPS 140-3, no client-side
// changes are needed — the endpoint contract is identical.
const fipsConfig = { region, useFipsEndpoint: true } as const

export const cognitoClient = new CognitoIdentityProviderClient(fipsConfig)
export const s3Client       = new S3Client(fipsConfig)
export const secretsClient  = new SecretsManagerClient(fipsConfig)
