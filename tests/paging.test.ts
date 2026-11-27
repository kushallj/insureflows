import { test } from "node:test";
import assert from "node:assert/strict";
import { clampPageSize, lastPage, pageLabel, pageRange } from "../src/lib/paging.ts";

test("page range maps 1-based pages to inclusive offsets", () => {
  assert.deepEqual(pageRange(1, 100), { page: 1, from: 0, to: 99 });
  assert.deepEqual(pageRange(3, 100), { page: 3, from: 200, to: 299 });
  assert.deepEqual(pageRange(0, 100), { page: 1, from: 0, to: 99 });
  assert.deepEqual(pageRange(undefined, 50), { page: 1, from: 0, to: 49 });
});

test("page size is clamped", () => {
  assert.equal(clampPageSize(undefined), 100);
  assert.equal(clampPageSize(5000), 200);
  assert.equal(clampPageSize(-3), 1);
});

test("last page and label", () => {
  assert.equal(lastPage(0, 100), 1);
  assert.equal(lastPage(3607, 100), 37);
  assert.equal(pageLabel(1, 100, 3607), "1–100 of 3,607");
  assert.equal(pageLabel(37, 100, 3607), "3,601–3,607 of 3,607");
  assert.equal(pageLabel(1, 100, 0), "0 of 0");
});
