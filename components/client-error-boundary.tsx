"use client";

import Link from "next/link";
import type { ErrorInfo, ReactNode } from "react";
import { Component } from "react";

type ClientErrorBoundaryProps = {
  children: ReactNode;
  title: string;
  description: string;
  homeHref?: string;
};

type ClientErrorBoundaryState = {
  hasError: boolean;
};

export class ClientErrorBoundary extends Component<
  ClientErrorBoundaryProps,
  ClientErrorBoundaryState
> {
  state: ClientErrorBoundaryState = {
    hasError: false
  };

  static getDerivedStateFromError() {
    return {
      hasError: true
    };
  }

  componentDidCatch(error: Error, errorInfo: ErrorInfo) {
    console.error("Client boundary captured an error", error, errorInfo);
  }

  reset = () => {
    this.setState({
      hasError: false
    });
  };

  render() {
    if (!this.state.hasError) {
      return this.props.children;
    }

    return (
      <div className="rounded-3xl border border-red-100 bg-white/90 p-8 shadow-lg shadow-red-100/40">
        <p className="text-sm font-semibold uppercase tracking-[0.24em] text-brand-red/80">
          UI Recovery
        </p>
        <h2 className="mt-3 text-2xl font-semibold text-brand-ink">
          {this.props.title}
        </h2>
        <p className="mt-3 max-w-2xl text-sm text-slate-600">
          {this.props.description}
        </p>
        <div className="mt-6 flex flex-wrap gap-3">
          <button
            className="rounded-full bg-brand-ink px-5 py-3 text-sm font-medium text-white transition hover:bg-slate-800"
            onClick={this.reset}
            type="button"
          >
            Retry screen
          </button>
          <Link
            className="rounded-full border border-slate-200 bg-white px-5 py-3 text-sm font-medium text-brand-ink transition hover:border-slate-300 hover:bg-slate-50"
            href={this.props.homeHref ?? "/"}
          >
            Back to dashboard
          </Link>
        </div>
      </div>
    );
  }
}
