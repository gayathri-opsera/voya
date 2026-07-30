"use client";

import * as React from "react";
import { useSearchParams } from "next/navigation";
import { Card, CardContent } from "../../components/ui/Card.js";
import { Badge } from "../../components/ui/Badge.js";
import { Button } from "../../components/ui/Button.js";
import { Skeleton } from "../../components/ui/Skeleton.js";
import { Input } from "../../components/ui/Input.js";
import { EmptyState } from "../../components/ui/EmptyState.js";
import { apiGet } from "../../lib/api/client.js";
import { ApiError } from "../../lib/api/errors.js";

interface SearchResult {
  id: string;
  provenance: string;
  type: "flight" | "hotel" | "car";
  title: string;
  description: string;
  price: number;
  currency: string;
  expiresAt: string;
  tags: string[];
}

interface SearchResponse {
  results: SearchResult[];
  totalCount: number;
  page: number;
}

const SORT_OPTIONS = [
  { value: "price_asc", label: "Price: Low to High" },
  { value: "price_desc", label: "Price: High to Low" },
  { value: "relevance", label: "Best Match" },
];

const TYPE_FILTERS = [
  { value: "flight", label: "Flights" },
  { value: "hotel", label: "Hotels" },
  { value: "car", label: "Cars" },
];

function formatPrice(amount: number, currency: string) {
  return new Intl.NumberFormat("en-US", { style: "currency", currency }).format(amount);
}

function ResultCard({ result }: { result: SearchResult }) {
  return (
    <Card variant="bordered" className="hover:shadow-md transition-shadow">
      <CardContent className="flex items-start justify-between gap-4 p-4">
        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-2 mb-1">
            <Badge variant={result.type === "flight" ? "info" : result.type === "hotel" ? "success" : "warning"}>
              {result.type}
            </Badge>
            {result.provenance === "ILLUSTRATIVE" && (
              <Badge variant="outline">Sample</Badge>
            )}
          </div>
          <h3 className="font-semibold text-text-primary truncate">{result.title}</h3>
          <p className="text-sm text-text-secondary mt-0.5 line-clamp-2">{result.description}</p>
          <div className="flex gap-2 mt-2 flex-wrap">
            {result.tags.map((tag) => (
              <span key={tag} className="text-xs text-text-tertiary bg-surface-secondary px-2 py-0.5 rounded-full">
                {tag}
              </span>
            ))}
          </div>
        </div>
        <div className="flex flex-col items-end gap-2 shrink-0">
          <div className="text-right">
            <div className="text-xl font-bold text-brand-600">
              {formatPrice(result.price, result.currency)}
            </div>
            <div className="text-xs text-text-secondary">per person</div>
          </div>
          <Button size="sm" as="a" href={`/listings/${result.id}`}>
            View details
          </Button>
        </div>
      </CardContent>
    </Card>
  );
}

export default function SearchPage() {
  const searchParams = useSearchParams();
  const query = searchParams.get("q") ?? "";
  const [results, setResults] = React.useState<SearchResult[]>([]);
  const [loading, setLoading] = React.useState(false);
  const [error, setError] = React.useState<string | null>(null);
  const [sort, setSort] = React.useState("relevance");
  const [typeFilter, setTypeFilter] = React.useState<string[]>([]);
  const [searchInput, setSearchInput] = React.useState(query);

  const fetchResults = React.useCallback(async (q: string) => {
    if (!q.trim()) return;
    setLoading(true);
    setError(null);
    try {
      const data = await apiGet<SearchResponse>("/search", {
        q,
        sort,
        types: typeFilter.join(",") || undefined,
      });
      setResults(data.results);
    } catch (err) {
      if (err instanceof ApiError) {
        setError(err.message);
      } else {
        setError("Search failed. Please try again.");
      }
    } finally {
      setLoading(false);
    }
  }, [sort, typeFilter]);

  React.useEffect(() => {
    fetchResults(query);
  }, [query, fetchResults]);

  const handleSearch = (e: React.FormEvent) => {
    e.preventDefault();
    fetchResults(searchInput);
  };

  return (
    <div className="mx-auto max-w-5xl px-4 py-8">
      <div className="mb-6">
        <form onSubmit={handleSearch} className="flex gap-2">
          <Input
            value={searchInput}
            onChange={(e) => setSearchInput(e.target.value)}
            placeholder="Search destinations, hotels, flights..."
            className="flex-1"
          />
          <Button type="submit" loading={loading}>Search</Button>
        </form>
      </div>

      <div className="flex gap-6">
        {/* Filters sidebar */}
        <aside className="w-48 shrink-0 space-y-4">
          <div>
            <h3 className="text-sm font-semibold text-text-primary mb-2">Type</h3>
            {TYPE_FILTERS.map((f) => (
              <label key={f.value} className="flex items-center gap-2 text-sm text-text-secondary cursor-pointer mb-1">
                <input
                  type="checkbox"
                  checked={typeFilter.includes(f.value)}
                  onChange={(e) =>
                    setTypeFilter((prev) =>
                      e.target.checked ? [...prev, f.value] : prev.filter((v) => v !== f.value),
                    )
                  }
                  className="accent-brand-500"
                />
                {f.label}
              </label>
            ))}
          </div>
          <div>
            <h3 className="text-sm font-semibold text-text-primary mb-2">Sort by</h3>
            {SORT_OPTIONS.map((o) => (
              <label key={o.value} className="flex items-center gap-2 text-sm text-text-secondary cursor-pointer mb-1">
                <input
                  type="radio"
                  name="sort"
                  value={o.value}
                  checked={sort === o.value}
                  onChange={() => setSort(o.value)}
                  className="accent-brand-500"
                />
                {o.label}
              </label>
            ))}
          </div>
        </aside>

        {/* Results */}
        <main className="flex-1 space-y-3">
          {loading ? (
            Array.from({ length: 4 }).map((_, i) => (
              <Skeleton key={i} variant="rectangular" height={120} className="rounded-lg" />
            ))
          ) : error ? (
            <EmptyState title="Search failed" description={error} />
          ) : results.length === 0 && query ? (
            <EmptyState
              title="No results found"
              description={`We couldn't find anything matching "${query}". Try a different search.`}
            />
          ) : (
            results.map((r) => <ResultCard key={r.id} result={r} />)
          )}
        </main>
      </div>
    </div>
  );
}
