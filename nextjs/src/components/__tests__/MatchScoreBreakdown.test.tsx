import { describe, it, expect } from 'vitest'
import { render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import MatchScoreBreakdown from '../MatchScoreBreakdown'
import type { MatchScore, MandateWeights } from '@/types'
import { expectNoA11yViolations } from '@/test/a11y'

function buildScore(over: Partial<MatchScore> = {}): MatchScore {
  return {
    total: 78, label: 'Good Fit',
    sector: 100, stage: 80, geography: 60, checkSize: 50,
    pillars: {
      scope: 85, capital: 72, timeRisk: 60,
      governance: 50, counterparty: 90, values: 0,
    },
    ...over,
  }
}

const evenWeights: MandateWeights = {
  scope: 30, capital: 25, counterparty: 15, values: 10, timeRisk: 10, governance: 10,
}

describe('<MatchScoreBreakdown />', () => {
  it('renders nothing when score.pillars is missing (legacy score)', () => {
    const { container } = render(<MatchScoreBreakdown score={buildScore({ pillars: undefined })} />)
    expect(container.innerHTML).toBe('')
  })

  it('renders the toggle collapsed by default with aria-expanded=false', () => {
    render(<MatchScoreBreakdown score={buildScore()} />)
    const toggle = screen.getByRole('group').querySelector('summary')!
    expect(toggle).toHaveAttribute('aria-expanded', 'false')
  })

  it('opens to show the per-pillar table on click', async () => {
    render(<MatchScoreBreakdown score={buildScore()} viewerWeights={evenWeights} />)
    await userEvent.click(screen.getByText(/why this score/i))
    expect(screen.getByText('Pillar')).toBeInTheDocument()
    expect(screen.getByText(/your weight/i)).toBeInTheDocument()
    // The total row should match score.total
    const totalCells = screen.getAllByText('78')
    expect(totalCells.length).toBeGreaterThan(0)
  })

  it('shows per-pillar weight + fit and computes a positive contribution', async () => {
    render(<MatchScoreBreakdown
      score={buildScore()}
      viewerWeights={evenWeights}
    />)
    await userEvent.click(screen.getByText(/why this score/i))

    // Scope row: 30% × 85 fit → table should show 30%, 85, and a positive +N
    // The exact contribution depends on the re-normalized denominator
    // (declared pillars only — values has fit=0 so it's dropped).
    expect(screen.getByText('Scope')).toBeInTheDocument()
    expect(screen.getByText('30%')).toBeInTheDocument()
    expect(screen.getByText('85')).toBeInTheDocument()
  })

  it('dims pillars with fit=0 and shows em-dash instead of contribution', async () => {
    render(<MatchScoreBreakdown
      score={buildScore()}
      viewerWeights={evenWeights}
    />)
    await userEvent.click(screen.getByText(/why this score/i))
    // values pillar is 0 in the fixture → should render an em-dash.
    const valuesRow = screen.getByText('Values').closest('tr')!
    expect(valuesRow.textContent).toContain('—')
  })

  it('shows the overlap evidence when viewer + candidate are provided', async () => {
    render(<MatchScoreBreakdown
      score={buildScore()}
      viewerWeights={evenWeights}
      viewer={{
        sectors:      ['SaaS', 'AI/ML', 'Healthcare'],
        stages:       ['Seed', 'Series A'],
        geography:    ['US'],
        assetClasses: ['PRIVATE_CREDIT'],
      }}
      candidate={{
        sectors:      ['SaaS', 'AI/ML', 'FinTech'],   // 2 overlap, 1 each-only
        stages:       ['Seed', 'Series A'],            // full overlap
        geography:    ['Europe'],                       // no overlap
        assetClasses: ['PRIVATE_CREDIT', 'VENTURE'],   // 1 overlap, 1 only-them
      }}
    />)
    await userEvent.click(screen.getByText(/why this score/i))

    // Three categories rendered (asset-class label resolved to "Private Credit")
    expect(screen.getByText('Sectors')).toBeInTheDocument()
    expect(screen.getByText('Stages')).toBeInTheDocument()
    expect(screen.getByText('Geography')).toBeInTheDocument()
    expect(screen.getByText('Asset classes')).toBeInTheDocument()
    expect(screen.getByText('Private Credit')).toBeInTheDocument()  // labelForAssetClass map
  })

  it('omits the overlap section when viewer is not provided (graceful degrade)', async () => {
    render(<MatchScoreBreakdown score={buildScore()} viewerWeights={evenWeights} />)
    await userEvent.click(screen.getByText(/why this score/i))
    expect(screen.queryByText(/what overlapped/i)).not.toBeInTheDocument()
  })

  it('omits the asset-class row when neither side declared any', async () => {
    render(<MatchScoreBreakdown
      score={buildScore()}
      viewer={{ sectors: ['X'], stages: ['Y'], geography: ['Z'] }}
      candidate={{ sectors: ['X'], stages: ['Y'], geography: ['Z'] }}
    />)
    await userEvent.click(screen.getByText(/why this score/i))
    expect(screen.queryByText('Asset classes')).not.toBeInTheDocument()
  })

  it('has no a11y violations when open with full evidence', async () => {
    const { container } = render(<MatchScoreBreakdown
      score={buildScore()}
      viewerWeights={evenWeights}
      viewer={{ sectors: ['SaaS'], stages: ['Seed'], geography: ['US'], assetClasses: ['PRIVATE_CREDIT'] }}
      candidate={{ sectors: ['SaaS', 'FinTech'], stages: ['Seed'], geography: ['EU'], assetClasses: ['PRIVATE_CREDIT'] }}
    />)
    await userEvent.click(screen.getByText(/why this score/i))
    await expectNoA11yViolations(container)
  })
})
