import { describe, it, expect } from 'vitest'
import { POST } from '../route'

describe('POST /api/concierge/act-as/clear', () => {
  it('returns ok and clears the acting-as cookie', async () => {
    const res = await POST()
    expect(res.status).toBe(200)
    const sc = res.headers.getSetCookie().join('\n')
    // Cookie delete sets an empty value with Max-Age=0.
    expect(sc).toMatch(/ee_acting_as=/i)
    expect(sc.toLowerCase()).toMatch(/max-age=0|expires=thu, 01 jan 1970/)
  })
})
