import React from "react";
import Link from "next/link";

export default function HomePage(): React.JSX.Element {
  return (
    <main>
      <h1>Voya</h1>
      <nav>
        <Link href="/search">Search</Link>
        <Link href="/profile">Profile</Link>
      </nav>
    </main>
  );
}
