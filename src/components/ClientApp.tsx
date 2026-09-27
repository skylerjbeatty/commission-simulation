"use client";

import dynamic from "next/dynamic";

// The simulator keeps all state in the browser (localStorage), so it renders client-side only.
const App = dynamic(() => import("./App"), {
  ssr: false,
  loading: () => <div className="p-8 text-sm text-stone-500">Loading simulator…</div>,
});

export default function ClientApp() {
  return <App />;
}
