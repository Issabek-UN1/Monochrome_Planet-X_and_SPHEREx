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
