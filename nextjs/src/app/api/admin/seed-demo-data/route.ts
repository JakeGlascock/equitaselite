import { NextRequest, NextResponse } from 'next/server'
import { query, queryOne } from '@/lib/db'
import { isUserAdmin } from '@/lib/admin'

interface DemoProfile {
  id: string
  email: string
  role: 'angel' | 'family_office'
  full_name: string
  title: string
  firm_name: string
  location: string
  aum: string | null
  sectors: string[]
  stages: string[]
  geography: string[]
  check_size_min: number
  check_size_max: number
  risk_tolerance: 'Conservative' | 'Moderate' | 'Aggressive'
  expected_return: string | null
  timeline: string | null
  mandate_type: string | null
  concentration: string | null
}

const DEMO_PROFILES: DemoProfile[] = [
  // ───── Angel Investors ─────
  {
    id: 'demo_angel_sarah_chen', email: 'sarah.chen@demo.equitaselite.com',
    role: 'angel', full_name: 'Sarah Chen', title: 'Former VP Product, Stripe',
    firm_name: 'Chen Ventures', location: 'San Francisco, CA', aum: null,
    sectors: ['FinTech', 'SaaS', 'AI / ML'], stages: ['Pre-Seed', 'Seed'],
    geography: ['North America'], check_size_min: 0.25, check_size_max: 2,
    risk_tolerance: 'Aggressive', expected_return: '10x+', timeline: '5-7 years',
    mandate_type: null, concentration: null,
  },
  {
    id: 'demo_angel_david_patel', email: 'david.patel@demo.equitaselite.com',
    role: 'angel', full_name: 'David Patel', title: 'Cardiologist & Investor',
    firm_name: 'Patel Capital', location: 'Boston, MA', aum: null,
    sectors: ['Healthcare', 'Life Sciences', 'Deep Tech'], stages: ['Seed', 'Series A'],
    geography: ['North America', 'Europe'], check_size_min: 0.5, check_size_max: 5,
    risk_tolerance: 'Moderate', expected_return: '5x-10x', timeline: '7-10 years',
    mandate_type: null, concentration: null,
  },
  {
    id: 'demo_angel_marcus_williams', email: 'marcus.williams@demo.equitaselite.com',
    role: 'angel', full_name: 'Marcus Williams', title: 'Founder & CEO, Halcyon (acquired)',
    firm_name: 'Williams Holdings', location: 'Austin, TX', aum: null,
    sectors: ['Consumer', 'AI / ML', 'SaaS'], stages: ['Pre-Seed', 'Seed'],
    geography: ['North America', 'Global'], check_size_min: 0.25, check_size_max: 1,
    risk_tolerance: 'Aggressive', expected_return: '10x+', timeline: '5-7 years',
    mandate_type: null, concentration: null,
  },
  {
    id: 'demo_angel_jennifer_okonkwo', email: 'jennifer.okonkwo@demo.equitaselite.com',
    role: 'angel', full_name: 'Jennifer Okonkwo', title: 'Climate Tech Advisor, Former Tesla',
    firm_name: 'Okonkwo Partners', location: 'Seattle, WA', aum: null,
    sectors: ['Clean Energy', 'Deep Tech'], stages: ['Seed', 'Series A'],
    geography: ['North America', 'Europe'], check_size_min: 0.5, check_size_max: 3,
    risk_tolerance: 'Moderate', expected_return: '5x-10x', timeline: '7-10 years',
    mandate_type: null, concentration: null,
  },
  {
    id: 'demo_angel_robert_lin', email: 'robert.lin@demo.equitaselite.com',
    role: 'angel', full_name: 'Robert Lin', title: 'Managing Partner, Lin Capital',
    firm_name: 'Lin Capital', location: 'Singapore', aum: null,
    sectors: ['FinTech', 'AI / ML', 'SaaS'], stages: ['Series A', 'Series B'],
    geography: ['Asia-Pacific', 'Global'], check_size_min: 1, check_size_max: 10,
    risk_tolerance: 'Moderate', expected_return: '5x-10x', timeline: '5-7 years',
    mandate_type: null, concentration: null,
  },
  {
    id: 'demo_angel_alexandra_romanov', email: 'alexandra.romanov@demo.equitaselite.com',
    role: 'angel', full_name: 'Alexandra Romanov', title: 'Defense Tech Advisor, Ex-Palantir',
    firm_name: 'Romanov & Co.', location: 'Arlington, VA', aum: null,
    sectors: ['Defense Tech', 'Deep Tech', 'AI / ML'], stages: ['Seed', 'Series A'],
    geography: ['North America'], check_size_min: 0.5, check_size_max: 5,
    risk_tolerance: 'Aggressive', expected_return: '10x+', timeline: '7-10 years',
    mandate_type: null, concentration: null,
  },
  {
    id: 'demo_angel_priya_sharma', email: 'priya.sharma@demo.equitaselite.com',
    role: 'angel', full_name: 'Priya Sharma', title: 'GP, Sharma Seed Fund',
    firm_name: 'Sharma Seed', location: 'New York, NY', aum: null,
    sectors: ['SaaS', 'FinTech', 'AI / ML'], stages: ['Seed', 'Series A'],
    geography: ['North America', 'Global'], check_size_min: 0.5, check_size_max: 3,
    risk_tolerance: 'Moderate', expected_return: '5x-10x', timeline: '5-7 years',
    mandate_type: null, concentration: null,
  },
  {
    id: 'demo_angel_james_thompson', email: 'james.thompson@demo.equitaselite.com',
    role: 'angel', full_name: 'James Thompson', title: 'Independent Investor',
    firm_name: 'Thompson Holdings', location: 'London, UK', aum: null,
    sectors: ['Life Sciences', 'Healthcare'], stages: ['Pre-Seed', 'Seed'],
    geography: ['Europe', 'North America'], check_size_min: 0.25, check_size_max: 1,
    risk_tolerance: 'Conservative', expected_return: '2x-5x', timeline: '7-10 years',
    mandate_type: null, concentration: null,
  },

  // ───── Family Offices ─────
  {
    id: 'demo_fo_hartwell', email: 'invest@hartwellcapital.demo',
    role: 'family_office', full_name: 'Catherine Hartwell', title: 'Chief Investment Officer',
    firm_name: 'Hartwell Capital', location: 'Greenwich, CT', aum: '$50M–$250M',
    sectors: ['Real Estate', 'FinTech', 'Consumer'], stages: ['Series B+', 'Growth'],
    geography: ['North America', 'Europe'], check_size_min: 2, check_size_max: 10,
    risk_tolerance: 'Conservative', expected_return: null, timeline: null,
    mandate_type: 'Balanced', concentration: 'Direct',
  },
  {
    id: 'demo_fo_stein', email: 'investments@steinfo.demo',
    role: 'family_office', full_name: 'Michael Stein', title: 'Managing Director',
    firm_name: 'Stein Family Office', location: 'New York, NY', aum: '$250M–$1B',
    sectors: ['FinTech', 'SaaS', 'AI / ML'], stages: ['Series B', 'Series B+'],
    geography: ['North America', 'Global'], check_size_min: 5, check_size_max: 25,
    risk_tolerance: 'Moderate', expected_return: null, timeline: null,
    mandate_type: 'Growth', concentration: 'Direct',
  },
  {
    id: 'demo_fo_patel_holdings', email: 'office@patelholdings.demo',
    role: 'family_office', full_name: 'Anish Patel', title: 'Head of Investments',
    firm_name: 'Patel Holdings', location: 'Mumbai, India', aum: '$50M–$250M',
    sectors: ['Healthcare', 'Life Sciences', 'Deep Tech'], stages: ['Series A', 'Series B'],
    geography: ['Asia-Pacific', 'Global'], check_size_min: 1, check_size_max: 5,
    risk_tolerance: 'Moderate', expected_return: null, timeline: null,
    mandate_type: 'Venture', concentration: 'Syndicated',
  },
  {
    id: 'demo_fo_ridgemont', email: 'investments@ridgemont.demo',
    role: 'family_office', full_name: 'Charles Ridgemont III', title: 'Principal',
    firm_name: 'Ridgemont Partners', location: 'Dallas, TX', aum: '$250M–$1B',
    sectors: ['Real Estate', 'Clean Energy', 'Consumer'], stages: ['Series B+', 'Growth'],
    geography: ['North America'], check_size_min: 5, check_size_max: 15,
    risk_tolerance: 'Conservative', expected_return: null, timeline: null,
    mandate_type: 'Value', concentration: 'Direct',
  },
  {
    id: 'demo_fo_yamada', email: 'family@yamada-investments.demo',
    role: 'family_office', full_name: 'Hiroshi Yamada', title: 'Principal',
    firm_name: 'Yamada Investments', location: 'Tokyo, Japan', aum: '$50M–$250M',
    sectors: ['Deep Tech', 'AI / ML', 'Defense Tech'], stages: ['Series A', 'Series B'],
    geography: ['Asia-Pacific', 'North America'], check_size_min: 2, check_size_max: 10,
    risk_tolerance: 'Aggressive', expected_return: null, timeline: null,
    mandate_type: 'Venture', concentration: 'Direct',
  },
  {
    id: 'demo_fo_vasquez', email: 'principal@vasquezcapital.demo',
    role: 'family_office', full_name: 'Isabella Vasquez', title: 'Managing Principal',
    firm_name: 'Vasquez Capital Group', location: 'Miami, FL', aum: '$50M–$250M',
    sectors: ['Consumer', 'SaaS', 'FinTech'], stages: ['Seed', 'Series A'],
    geography: ['North America', 'Latin America'], check_size_min: 1, check_size_max: 5,
    risk_tolerance: 'Aggressive', expected_return: null, timeline: null,
    mandate_type: 'Venture', concentration: 'Syndicated',
  },
  {
    id: 'demo_fo_mountain_peak', email: 'office@mountainpeak.demo',
    role: 'family_office', full_name: 'Rebecca Lin-Anderson', title: 'Chief Investment Officer',
    firm_name: 'Mountain Peak Holdings', location: 'Denver, CO', aum: '>$1B',
    sectors: ['Defense Tech', 'AI / ML', 'Deep Tech'], stages: ['Series B', 'Series B+', 'Growth'],
    geography: ['North America', 'Global'], check_size_min: 10, check_size_max: 50,
    risk_tolerance: 'Moderate', expected_return: null, timeline: null,
    mandate_type: 'Growth', concentration: 'Direct',
  },
  {
    id: 'demo_fo_lakeside', email: 'office@lakesidefamilytrust.demo',
    role: 'family_office', full_name: 'Edward Lakeside', title: 'Trustee',
    firm_name: 'Lakeside Family Trust', location: 'Zurich, Switzerland', aum: '$250M–$1B',
    sectors: ['SaaS', 'Healthcare', 'Clean Energy'], stages: ['Series A', 'Series B', 'Growth'],
    geography: ['Europe', 'Global'], check_size_min: 2, check_size_max: 10,
    risk_tolerance: 'Conservative', expected_return: null, timeline: null,
    mandate_type: 'Balanced', concentration: 'Both',
  },
]

export async function POST(req: NextRequest) {
  const userId    = req.headers.get('x-user-id')
  const userEmail = req.headers.get('x-user-email')
  if (!(await isUserAdmin(userId, userEmail))) {
    return NextResponse.json({ error: 'Forbidden' }, { status: 403 })
  }

  const existing = await queryOne<{ count: string }>(
    "SELECT COUNT(*)::text AS count FROM profiles WHERE id LIKE 'demo_%'",
  )
  const existingCount = Number(existing?.count ?? 0)

  let inserted = 0
  for (const p of DEMO_PROFILES) {
    await query(
      `INSERT INTO profiles (
         id, email, role, full_name, title, firm_name, location, aum,
         sectors, stages, geography,
         check_size_min, check_size_max, risk_tolerance,
         expected_return, timeline, mandate_type, concentration,
         onboarding_completed
       ) VALUES (
         $1,$2,$3,$4,$5,$6,$7,$8,
         $9,$10,$11,
         $12,$13,$14,
         $15,$16,$17,$18,
         TRUE
       )
       ON CONFLICT (id) DO NOTHING`,
      [
        p.id, p.email, p.role, p.full_name, p.title,
        p.firm_name, p.location, p.aum,
        p.sectors, p.stages, p.geography,
        p.check_size_min, p.check_size_max, p.risk_tolerance,
        p.expected_return, p.timeline, p.mandate_type, p.concentration,
      ]
    )
    inserted++
  }

  return NextResponse.json({
    ok:               true,
    totalDemoProfiles: DEMO_PROFILES.length,
    rowsBefore:       existingCount,
    upserted:         inserted,
  })
}
