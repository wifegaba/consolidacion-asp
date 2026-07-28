'use client'

interface PremiumPaginationProps {
  page: number
  totalPages: number
  onPageChange: (page: number) => void
  label?: string
  alwaysVisible?: boolean
}

export default function PremiumPagination({
  page,
  totalPages,
  onPageChange,
  label = 'Página',
  alwaysVisible = false,
}: PremiumPaginationProps) {
  if (totalPages <= 1 && !alwaysVisible) return null

  const pages = Array.from({ length: totalPages }, (_, index) => index + 1)
  const visiblePages = pages.filter(candidate =>
    totalPages <= 7 ||
    candidate === 1 ||
    candidate === totalPages ||
    Math.abs(candidate - page) <= 1
  )

  return (
    <nav className="premium-pagination" aria-label={`Paginación de ${label.toLowerCase()}`}>
      <button
        type="button"
        className="premium-pagination__arrow"
        onClick={() => onPageChange(page - 1)}
        disabled={page === 1}
        aria-label="Página anterior"
      >
        ‹
      </button>

      <div className="premium-pagination__pages">
        {visiblePages.map((candidate, index) => {
          const previous = visiblePages[index - 1]
          const hasGap = previous != null && candidate - previous > 1
          return (
            <span className="premium-pagination__slot" key={candidate}>
              {hasGap && <span className="premium-pagination__ellipsis">•••</span>}
              <button
                type="button"
                className={`premium-pagination__page ${candidate === page ? 'is-active' : ''}`}
                onClick={() => onPageChange(candidate)}
                aria-current={candidate === page ? 'page' : undefined}
                aria-label={`${label} ${candidate}`}
              >
                {candidate}
              </button>
            </span>
          )
        })}
      </div>

      <button
        type="button"
        className="premium-pagination__arrow"
        onClick={() => onPageChange(page + 1)}
        disabled={page === totalPages}
        aria-label="Página siguiente"
      >
        ›
      </button>
      <span className="premium-pagination__status">{page} / {totalPages}</span>
    </nav>
  )
}
