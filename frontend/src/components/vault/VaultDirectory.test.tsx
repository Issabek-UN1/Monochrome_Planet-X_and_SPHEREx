import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { cleanup, fireEvent, render, screen } from '@testing-library/react'
import { VaultDirectory } from './VaultDirectory'

describe('VaultDirectory', () => {
  const mockOnSelectMode = vi.fn()

  beforeEach(() => {
    vi.clearAllMocks()
    window.scrollTo = vi.fn()
    Object.defineProperty(HTMLElement.prototype, 'scrollTo', {
      configurable: true,
      value: vi.fn(),
    })
  })

  afterEach(() => {
    cleanup()
  })

  it('renders directory rows 02, 03, 04 and excludes row 01 and badges', () => {
    render(
      <VaultDirectory
        onSelectMode={mockOnSelectMode}
      />,
    )

    // Row 01 must NOT be in the directory on this page
    expect(screen.queryByText('ORBITAL VAULT')).toBeNull()
    expect(screen.queryByText('01')).toBeNull()

    // Badges must NOT be present
    expect(screen.queryByText(/Core Benchmark/i)).toBeNull()
    expect(screen.queryByText(/Blink \/ Difference/i)).toBeNull()
    expect(screen.queryByText(/spectroscopy/i)).toBeNull()
    expect(screen.queryByText(/Time-Domain Search/i)).toBeNull()

    // Verify row 02
    expect(screen.getByText('02')).toBeTruthy()
    expect(screen.getByText('TARGET COMPARATOR')).toBeTruthy()
    expect(
      screen.getByText(
        'Multi-epoch blink comparison & Planet X hypothesis sliders',
      ),
    ).toBeTruthy()

    // Verify row 03
    expect(screen.getByText('03')).toBeTruthy()
    expect(screen.getByText('SPECTRAL LAB')).toBeTruthy()
    expect(
      screen.getByText(
        'SPHEREx infrared spectral energy distribution analysis',
      ),
    ).toBeTruthy()

    // Verify row 04
    expect(screen.getByText('04')).toBeTruthy()
    expect(screen.getByText('LIVE EXPLORER')).toBeTruthy()
    expect(
      screen.getByText(
        'Real-time IRSA sky coordinate & proper motion lookup',
      ),
    ).toBeTruthy()
  })

  it('switches to respective mode when clicking rows 02, 03, 04', () => {
    render(
      <VaultDirectory
        onSelectMode={mockOnSelectMode}
      />
    )

    fireEvent.click(screen.getByText('TARGET COMPARATOR'))
    expect(mockOnSelectMode).toHaveBeenCalledWith('comparator')

    fireEvent.click(screen.getByText('SPECTRAL LAB'))
    expect(mockOnSelectMode).toHaveBeenCalledWith('spectral')

    fireEvent.click(screen.getByText('LIVE EXPLORER'))
    expect(mockOnSelectMode).toHaveBeenCalledWith('explorer')
  })
})
