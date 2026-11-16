#!/usr/bin/env bun
console.log("1: before imports");
const { Surreal } = await import("surrealdb");
console.log("2: imported surrealdb");
const { createNodeEngines } = await import("@surrealdb/node");
console.log("3: imported @surrealdb/node");
const db = new Surreal({ engines: { ...createNodeEngines() } });
console.log("4: built Surreal");
await db.connect("mem://");
console.log("5: connected mem");
await db.use({ namespace: "x", database: "y" });
console.log("6: used ns/db");
await db.query("DEFINE TABLE foo;");
console.log("7: defined table");
await db.close();
console.log("8: closed");
