import type { ErrorEnvelope } from "@travel/contracts";

interface ErrorBannerProps {
  envelope: ErrorEnvelope;
  className?: string;
}

/**
 * Renders a standard error envelope as a user-visible banner.
 * Always surfaces the reference identifier for support quoting.
 */
export function ErrorBanner({ envelope, className }: ErrorBannerProps): React.JSX.Element {
  return (
    <div role="alert" data-testid="error-banner" className={className}>
      <p data-testid="error-message">{envelope.error.message}</p>
      {envelope.error.field && (
        <p data-testid="error-field">Field: {envelope.error.field}</p>
      )}
      <small data-testid="error-reference">
        Reference: {envelope.reference}
      </small>
    </div>
  );
}
