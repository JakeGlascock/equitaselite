import SigninForm from './SigninForm'

// Without this, Next.js statically renders /signin at `next build` time
// (the page has no dynamic data sources to opt itself out). The Docker
// build doesn't pass COGNITO_USER_POOL_ID as a build arg, so the
// baked-in poolId would be "" and the client SRP path silently falls
// back to USER_PASSWORD_AUTH — defeating Phase D. Forcing dynamic
// means the env var is read at request time, when it actually exists.
export const dynamic = 'force-dynamic'

// Server component wrapper. Reads the Cognito user pool ID from the
// server-only env var at request time and hands it to the client form,
// so the browser can run client-side SRP (Phase D) without the value
// being baked into the next-build output.
export default function SigninPage() {
  return <SigninForm poolId={process.env.COGNITO_USER_POOL_ID ?? ''} />
}
