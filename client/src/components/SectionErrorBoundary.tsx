import React from "react";

interface Props {
  sectionName?: string;
  children: React.ReactNode;
}

interface State {
  hasError: boolean;
  error: Error | null;
}

/**
 * Wraps a coach panel section so that a runtime error in one section
 * does not crash the entire CoachPanel.
 */
export class SectionErrorBoundary extends React.Component<Props, State> {
  constructor(props: Props) {
    super(props);
    this.state = { hasError: false, error: null };
  }

  static getDerivedStateFromError(error: Error): State {
    return { hasError: true, error };
  }

  componentDidCatch(error: Error, info: React.ErrorInfo) {
    console.error(`[SectionErrorBoundary] Error in ${this.props.sectionName ?? "section"}:`, error, info);
  }

  render() {
    if (this.state.hasError) {
      return (
        <div className="flex flex-col items-center justify-center h-40 gap-3 border border-destructive/30 rounded-xl bg-destructive/5">
          <p className="text-sm font-medium text-destructive">
            Something went wrong in {this.props.sectionName ?? "this section"}.
          </p>
          <p className="text-xs text-muted-foreground max-w-sm text-center">
            {this.state.error?.message ?? "An unexpected error occurred."}
          </p>
          <button
            onClick={() => this.setState({ hasError: false, error: null })}
            className="text-xs px-3 py-1.5 rounded-lg border border-border hover:border-primary/40 transition-colors text-muted-foreground hover:text-foreground"
          >
            Try again
          </button>
        </div>
      );
    }
    return this.props.children;
  }
}
