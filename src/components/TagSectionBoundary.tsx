import React, { type ErrorInfo, type ReactNode } from "react";

export class TagSectionBoundary extends React.Component<
  { children: ReactNode; resetKey?: string; onReset?: () => void },
  { failed: boolean }
> {
  state = { failed: false };

  static getDerivedStateFromError() {
    return { failed: true };
  }

  componentDidCatch(error: Error, info: ErrorInfo) {
    console.error("TimeSlice tag section failed", error, info);
  }

  componentDidUpdate(previous: Readonly<{ resetKey?: string }>) {
    if (this.state.failed && previous.resetKey !== this.props.resetKey) {
      this.setState({ failed: false });
    }
  }

  render() {
    if (!this.state.failed) return this.props.children;
    return (
      <div
        role="alert"
        className="rounded-lg border border-amber-200 bg-amber-50 p-3 text-sm text-amber-900"
      >
        <p className="font-semibold">Tag view is temporarily unavailable.</p>
        <p className="mt-1 text-xs">
          Your activities and timer are still safe. Reset the tag view to try
          again.
        </p>
        <button
          type="button"
          className="mt-2 min-h-11 rounded-lg border border-amber-300 bg-white px-3 font-semibold"
          onClick={() => {
            this.props.onReset?.();
            this.setState({ failed: false });
          }}
        >
          Reset tag view
        </button>
      </div>
    );
  }
}
