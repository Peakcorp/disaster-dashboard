// Supabase/PostgREST sends .in("col", ids) filters as a query string, which
// has no chunking of its own — with the live event count now in the
// thousands, an .in() built from every active event id produces a
// 30-40KB+ URL that the server flatly rejects with a 400 (previously seen
// on SupplyX/Insurance Claims, which passed *every* active event's id
// unfiltered). This splits the id list into requests under the URL-length
// ceiling and merges the results, firing all chunks concurrently since
// each one is an independent, cheap lookup.
export async function fetchByIdsChunked<T>(
  queryFn: (chunk: string[]) => PromiseLike<{ data: T[] | null; error: { message: string } | null }>,
  ids: string[],
  chunkSize = 150
): Promise<T[]> {
  const chunks: string[][] = [];
  for (let i = 0; i < ids.length; i += chunkSize) {
    chunks.push(ids.slice(i, i + chunkSize));
  }
  if (chunks.length === 0) return [];

  const results = await Promise.all(chunks.map((chunk) => queryFn(chunk)));

  const merged: T[] = [];
  for (const { data, error } of results) {
    if (error) {
      console.error("Chunked fetch failed for one batch", error);
      continue;
    }
    if (data) merged.push(...data);
  }
  return merged;
}

// PostgREST's project-level "max rows" setting caps every response at 1000
// regardless of a client-side .limit() — a plain .select("*") on `events`
// silently truncated once the live feed passed 1000 active rows. Pages
// through with .range() to actually get everything.
export async function fetchAllPages<T>(
  queryFn: (from: number, to: number) => PromiseLike<{ data: T[] | null; error: { message: string } | null }>,
  pageSize = 1000
): Promise<T[]> {
  const all: T[] = [];
  for (let page = 0; ; page++) {
    const { data, error } = await queryFn(page * pageSize, page * pageSize + pageSize - 1);
    if (error) {
      console.error("Paginated fetch failed", error);
      break;
    }
    if (!data || data.length === 0) break;
    all.push(...data);
    if (data.length < pageSize) break;
  }
  return all;
}
