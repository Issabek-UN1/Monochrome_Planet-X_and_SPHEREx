import { afterEach, describe, expect, it } from 'vitest'
import { cleanup, fireEvent, render, screen } from '@testing-library/react'
import { I18nProvider, useI18n } from './index'
import { Header } from '../components/layout/Header'

function TestComponent() {
  const { lang, setLang, t } = useI18n()
  return (
    <div>
      <span data-testid="current-lang">{lang}</span>
      <span data-testid="hero-eyebrow">{t('hero.eyebrow')}</span>
      <span data-testid="mode-vault">{t('modes.vault')}</span>
      <button onClick={() => setLang('ru')}>Set Russian</button>
      <button onClick={() => setLang('en')}>Set English</button>
      <p data-testid="target-summary">{t('target.wise-0855.desc')}</p>
      <p data-testid="target-notes">{t('target.barnards-star.notes')}</p>
      <p data-testid="science-notice">{t('comparator.scienceNotice')}</p>
      <p data-testid="quality-summary">{t('explorer.qualityNotesSummary')}</p>
    </div>
  )
}

describe('i18n Localization and Language Switcher', () => {
  afterEach(cleanup)

  it('renders English by default and switches to Russian and back', () => {
    render(
      <I18nProvider>
        <TestComponent />
      </I18nProvider>,
    )

    expect(screen.getByTestId('current-lang').textContent).toBe('en')
    expect(screen.getByTestId('hero-eyebrow').textContent).toBe(
      'TIME-DOMAIN SKY EXPLORER',
    )
    expect(screen.getByTestId('mode-vault').textContent).toBe('Orbital vault')
    expect(screen.getByTestId('target-summary').textContent).toContain(
      'The coldest known sub-stellar brown dwarf',
    )
    expect(screen.getByTestId('science-notice').textContent).toContain(
      'A difference is exploratory',
    )

    // Switch to Russian
    fireEvent.click(screen.getByText('Set Russian'))

    expect(screen.getByTestId('current-lang').textContent).toBe('ru')
    expect(screen.getByTestId('hero-eyebrow').textContent).toBe(
      'ИССЛЕДОВАТЕЛЬ НЕБА ВО ВРЕМЕННОЙ ОБЛАСТИ',
    )
    expect(screen.getByTestId('mode-vault').textContent).toBe('Орбитальный свод')
    expect(screen.getByTestId('target-summary').textContent).toContain(
      'Самый холодный из известных субзвёздных коричневых карликов',
    )
    expect(screen.getByTestId('target-notes').textContent).toContain(
      'Опорный центр поля для звезды с наибольшим собственным движением',
    )
    expect(screen.getByTestId('science-notice').textContent).toContain(
      'Разностное изображение носит исследовательский характер',
    )
    expect(screen.getByTestId('quality-summary').textContent).toBe(
      'СВОДКА КАЧЕСТВА ДАННЫХ И ПРИМЕЧАНИЯ К ОБРАБОТКЕ',
    )

    // Switch back to English
    fireEvent.click(screen.getByText('Set English'))

    expect(screen.getByTestId('current-lang').textContent).toBe('en')
    expect(screen.getByTestId('hero-eyebrow').textContent).toBe(
      'TIME-DOMAIN SKY EXPLORER',
    )
    expect(screen.getByTestId('quality-summary').textContent).toBe(
      'DATA QUALITY & PROCESSING NOTES',
    )
  })

  it('toggles language when clicking the header language toggle button', () => {
    render(
      <I18nProvider>
        <Header
          mode="vault"
          onMode={() => {}}
          sound={false}
          onSound={() => {}}
          grid={true}
          onGrid={() => {}}
        />
      </I18nProvider>,
    )

    const toggleBtn = screen.getByRole('button', {
      name: /Переключить на русский язык/i,
    })
    expect(toggleBtn).toBeTruthy()

    // Click toggle to switch to Russian
    fireEvent.click(toggleBtn)

    // Now button should offer to switch to English
    expect(
      screen.getByRole('button', {
        name: /Switch to English/i,
      }),
    ).toBeTruthy()

    // Click again to switch back to English
    fireEvent.click(
      screen.getByRole('button', {
        name: /Switch to English/i,
      }),
    )

    expect(
      screen.getByRole('button', {
        name: /Переключить на русский язык/i,
      }),
    ).toBeTruthy()
  })
})
