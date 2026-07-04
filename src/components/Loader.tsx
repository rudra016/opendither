interface Props {
  size?: number
  className?: string
}

export function Loader({ size = 56, className = '' }: Props) {
  return (
    <div
      className={className}
      role="status"
      aria-live="polite"
      aria-label="Loading"
    >
      <svg
        xmlns="http://www.w3.org/2000/svg"
        viewBox="0 0 200 200"
        width={size}
        height={size}
        aria-hidden
      >
        <g fill="#2ED938" stroke="#2ED938" strokeWidth="8">
          <rect width="30" height="30" x="125" y="45">
            <animateTransform
              attributeName="transform"
              type="translate"
              calcMode="spline"
              dur="2s"
              values="0 0;0 80;0 80;0 80;-80 80;"
              keySplines=".5 0 .5 1;.5 0 .5 1;.5 0 .5 1;.5 0 .5 1"
              repeatCount="indefinite"
            />
          </rect>
          <rect width="30" height="30" x="45" y="45">
            <animateTransform
              attributeName="transform"
              type="translate"
              calcMode="spline"
              dur="2s"
              values="0 0;0 0;80 0;80 0;80 0;"
              keySplines=".5 0 .5 1;.5 0 .5 1;.5 0 .5 1;.5 0 .5 1"
              repeatCount="indefinite"
            />
          </rect>
          <rect width="30" height="30" x="45" y="125">
            <animateTransform
              attributeName="transform"
              type="translate"
              calcMode="spline"
              dur="2s"
              values="0 0;0 0;0 0;0 -80;0 -80;"
              keySplines=".5 0 .5 1;.5 0 .5 1;.5 0 .5 1;.5 0 .5 1"
              repeatCount="indefinite"
            />
          </rect>
        </g>
      </svg>
    </div>
  )
}
