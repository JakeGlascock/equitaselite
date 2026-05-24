import SigninForm from './SigninForm'

// Server component wrapper. Reads the Cognito user pool ID from the
// server-only env var at request time and hands it to the client form,
// so the browser can run client-side SRP (Phase D) without the value
// being baked into the next-build output.
export default function SigninPage() {
  return <SigninForm poolId={process.env.COGNITO_USER_POOL_ID ?? ''} />
}
