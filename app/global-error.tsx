"use client";

// Catches errors in the root layout itself. It replaces the whole document,
// so it carries its own minimal styling.
export default function GlobalError({ reset }: { reset: () => void }) {
  return (
    <html lang="en">
      <body
        style={{
          margin: 0,
          minHeight: "100vh",
          display: "flex",
          alignItems: "center",
          justifyContent: "center",
          background: "#0a0812",
          color: "#f2eefb",
          fontFamily: "system-ui, -apple-system, Segoe UI, Roboto, sans-serif",
        }}
      >
        <div style={{ maxWidth: 420, padding: 32, textAlign: "center" }}>
          <div style={{ fontSize: 32 }}>⚠️</div>
          <h1 style={{ fontSize: 20, margin: "12px 0 6px" }}>Something went wrong</h1>
          <p style={{ color: "#b3aac9", fontSize: 14, lineHeight: 1.5, margin: "0 0 24px" }}>
            An unexpected error occurred. Please try again in a moment.
          </p>
          <button
            onClick={reset}
            style={{
              border: "none",
              borderRadius: 10,
              padding: "10px 18px",
              fontSize: 14,
              fontWeight: 600,
              color: "#fff",
              cursor: "pointer",
              background: "linear-gradient(120deg,#7c3aed,#b83ad1 55%,#ec4899)",
            }}
          >
            Try again
          </button>
        </div>
      </body>
    </html>
  );
}
