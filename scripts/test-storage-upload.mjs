import dotenv from "dotenv";
dotenv.config();

const baseUrl = process.env.BUILT_IN_FORGE_API_URL?.replace(/\/+$/, "");
const apiKey = process.env.BUILT_IN_FORGE_API_KEY;

console.log("baseUrl:", baseUrl ? baseUrl.substring(0, 40) + "..." : "MISSING");
console.log("apiKey:", apiKey ? "SET (" + apiKey.substring(0, 8) + "...)" : "MISSING");

// Create a tiny test image (1x1 pixel JPEG)
const tinyJpeg = Buffer.from(
  "/9j/4AAQSkZJRgABAQEASABIAAD/2wBDAAgGBgcGBQgHBwcJCQgKDBQNDAsLDBkSEw8UHRofHh0aHBwgJC4nICIsIxwcKDcpLDAxNDQ0Hyc5PTgyPC4zNDL/2wBDAQkJCQwLDBgNDRgyIRwhMjIyMjIyMjIyMjIyMjIyMjIyMjIyMjIyMjIyMjIyMjIyMjIyMjIyMjIyMjIyMjIyMjL/wAARCAABAAEDASIAAhEBAxEB/8QAFAABAAAAAAAAAAAAAAAAAAAACf/EABQQAQAAAAAAAAAAAAAAAAAAAAD/xAAUAQEAAAAAAAAAAAAAAAAAAAAA/8QAFBEBAAAAAAAAAAAAAAAAAAAAAP/aAAwDAQACEQMRAD8AJQAB/9k=",
  "base64"
);

const key = `test-upload/${Date.now()}-test.jpg`;
const uploadUrl = new URL("v1/storage/upload", baseUrl.endsWith("/") ? baseUrl : baseUrl + "/");
uploadUrl.searchParams.set("path", key);

console.log("\nUploading to:", uploadUrl.toString());

const blob = new Blob([tinyJpeg], { type: "image/jpeg" });
const form = new FormData();
form.append("file", blob, "test.jpg");

const response = await fetch(uploadUrl, {
  method: "POST",
  headers: { Authorization: `Bearer ${apiKey}` },
  body: form,
});

console.log("Status:", response.status, response.statusText);
const body = await response.text();
console.log("Response:", body.substring(0, 500));
