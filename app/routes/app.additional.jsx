import { useState } from "react";
import { useFetcher, useLoaderData, useSearchParams } from "react-router";
import { boundary } from "@shopify/shopify-app-react-router/server";
import { authenticate } from "../shopify.server";

export const loader = async ({ request }) => {
  const { admin } = await authenticate.admin(request);

  const url = new URL(request.url);
  const searchQuery = url.searchParams.get("q") || "";
  const cursor = url.searchParams.get("cursor") || null;

  const response = await admin.graphql(
    `#graphql
      query getProducts($query: String, $after: String) {
        products(first: 20, query: $query, after: $after) {
          edges {
            cursor
            node {
              id
              title
              tags
            }
          }
          pageInfo {
            hasNextPage
          }
        }
      }`,
    {
      variables: {
        query: searchQuery ? `title:*${searchQuery}*` : null,
        after: cursor,
      },
    },
  );
  const data = await response.json();
  const products = data.data.products.edges.map((edge) => edge.node);
  const lastCursor = data.data.products.edges.length
    ? data.data.products.edges[data.data.products.edges.length - 1].cursor
    : null;
  const hasNextPage = data.data.products.pageInfo.hasNextPage;

  return { products, lastCursor, hasNextPage, searchQuery };
};

export const action = async ({ request }) => {
  const { admin } = await authenticate.admin(request);
  const formData = await request.formData();
  const tag = formData.get("tag");
  const mode = formData.get("mode");
  const productIds = formData.getAll("productIds");

  const mutation =
    mode === "remove"
      ? `#graphql
        mutation removeTag($id: ID!, $tags: [String!]!) {
          tagsRemove(id: $id, tags: $tags) {
            node {
              id
            }
            userErrors {
              field
              message
            }
          }
        }`
      : `#graphql
        mutation addTag($id: ID!, $tags: [String!]!) {
          tagsAdd(id: $id, tags: $tags) {
            node {
              id
            }
            userErrors {
              field
              message
            }
          }
        }`;

  for (const productId of productIds) {
    await admin.graphql(mutation, {
      variables: {
        id: productId,
        tags: [tag],
      },
    });
  }

  return { success: true, count: productIds.length, mode };
};

export default function BulkTagger() {
  const { products, lastCursor, hasNextPage, searchQuery } = useLoaderData();
  const fetcher = useFetcher();
  const [searchParams, setSearchParams] = useSearchParams();
  const [tag, setTag] = useState("");
  const [searchInput, setSearchInput] = useState(searchQuery);
  const [selected, setSelected] = useState([]);

  const isSubmitting = fetcher.state !== "idle";

  const toggleProduct = (id) => {
    setSelected((prev) =>
      prev.includes(id) ? prev.filter((p) => p !== id) : [...prev, id],
    );
  };

  const toggleAll = () => {
    setSelected(
      selected.length === products.length ? [] : products.map((p) => p.id),
    );
  };

  const submitTagAction = (mode) => {
    const formData = new FormData();
    formData.append("tag", tag);
    formData.append("mode", mode);
    selected.forEach((id) => formData.append("productIds", id));
    fetcher.submit(formData, { method: "POST" });
  };

  const runSearch = () => {
    setSelected([]);
    setSearchParams({ q: searchInput });
  };

  const loadMore = () => {
    setSearchParams({ q: searchQuery, cursor: lastCursor });
  };

  return (
    <s-page heading="Bulk Tag Manager">
      <s-section heading="Search products">
        <s-stack direction="inline" gap="base" alignItems="end">
          <s-text-field
            label="Search by product name"
            value={searchInput}
            onChange={(e) => setSearchInput(e.target.value)}
          ></s-text-field>
          <s-button onClick={runSearch}>Search</s-button>
        </s-stack>
      </s-section>

      <s-section heading="Add or remove a tag">
        <s-text-field
          label="Tag"
          placeholder="e.g. Sale, Featured, Winter"
          value={tag}
          onChange={(e) => setTag(e.target.value)}
        ></s-text-field>

        <s-box paddingBlockStart="base" paddingBlockEnd="tight">
          <s-checkbox
            label={`Select all (${products.length})`}
            checked={selected.length === products.length && products.length > 0}
            onChange={toggleAll}
          ></s-checkbox>
        </s-box>

        <s-box
          borderWidth="base"
          borderRadius="base"
          background="subdued"
          padding="base"
        >
          <s-stack direction="block" gap="tight">
            {products.map((product) => (
              <s-checkbox
                key={product.id}
                label={`${product.title} — ${
                  product.tags.length ? product.tags.join(", ") : "no tags"
                }`}
                checked={selected.includes(product.id)}
                onChange={() => toggleProduct(product.id)}
              ></s-checkbox>
            ))}
            {products.length === 0 && (
              <s-text tone="subdued">No products found.</s-text>
            )}
          </s-stack>
        </s-box>

        <s-box paddingBlockStart="base">
          <s-stack direction="inline" gap="base">
            <s-button
              onClick={() => submitTagAction("add")}
              disabled={!tag || selected.length === 0}
              {...(isSubmitting ? { loading: true } : {})}
            >
              Add tag ({selected.length})
            </s-button>
            <s-button
              onClick={() => submitTagAction("remove")}
              disabled={!tag || selected.length === 0}
              variant="tertiary"
              {...(isSubmitting ? { loading: true } : {})}
            >
              Remove tag ({selected.length})
            </s-button>
            {hasNextPage && (
              <s-button onClick={loadMore} variant="tertiary">
                Load more
              </s-button>
            )}
          </s-stack>
        </s-box>

        {fetcher.data?.success && (
          <s-box paddingBlockStart="base">
            <s-banner tone="success">
              Tag {fetcher.data.mode === "remove" ? "removed from" : "added to"}{" "}
              {fetcher.data.count} product(s).
            </s-banner>
          </s-box>
        )}
      </s-section>
    </s-page>
  );
}

export const headers = (headersArgs) => {
  return boundary.headers(headersArgs);
};