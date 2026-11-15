import type { ReactNode } from 'react'
export function Panel({
  number,
  title,
  meta,
  children,
  className = '',
}: {
  number: string
  title: string
  meta?: string
  children: ReactNode
  className?: string
}) {
  return (
    <section className={`hud-panel ${className}`}>
      <span className="panel-corner corner-tl" aria-hidden="true">+</span>
      <span className="panel-corner corner-tr" aria-hidden="true">+</span>
      <span className="panel-corner corner-bl" aria-hidden="true">+</span>
      <span className="panel-corner corner-br" aria-hidden="true">+</span>
      <div className="panel-heading">
        <h2>
          <span>{number}</span>
          {title}
        </h2>
        {meta && <small>{meta}</small>}
      </div>
      {children}
    </section>
  )
}
export function ErrorNotice({ message }: { message: string | null }) {
  return message ? (
    <div className="error-notice" role="alert">
      {message}
    </div>
  ) : null
}
