import mysql from "mysql2/promise";
import dotenv from "dotenv";
dotenv.config();

const conn = await mysql.createConnection(process.env.DATABASE_URL);

// Get Jake's user ID
const [users] = await conn.execute("SELECT id, name FROM users WHERE name LIKE '%Jake%' LIMIT 5");
console.log("Users:", users);

// Get Jake's meal logs from the last 28 days (meal type only, not treats)
const [logs] = await conn.execute(`
  SELECT loggedAt, utcOffsetMins, mealType
  FROM meal_logs
  WHERE userId = 1
    AND mealType = 'meal'
    AND loggedAt >= DATE_SUB(NOW(), INTERVAL 28 DAY)
  ORDER BY loggedAt
`);

console.log(`\nTotal meal logs (last 28 days): ${logs.length}`);

// Convert to local minutes
const toLocalMins = (row) => {
  const d = new Date(row.loggedAt);
  const utcMins = d.getUTCHours() * 60 + d.getUTCMinutes();
  const offset = row.utcOffsetMins ?? 0;
  return ((utcMins + offset) % 1440 + 1440) % 1440;
};

const allMins = logs.map(toLocalMins).filter(t => t >= 240).sort((a, b) => a - b);
console.log("\nAll meal times (local mins since midnight):");
allMins.forEach(m => {
  const h = Math.floor(m / 60);
  const min = Math.round(m % 60);
  const ampm = h >= 12 ? 'pm' : 'am';
  const h12 = h % 12 === 0 ? 12 : h % 12;
  console.log(`  ${h12}:${String(min).padStart(2,'0')} ${ampm} (${m} mins)`);
});

// Simulate k-means for k=4 and k=5 to compare WCSS
const circDist = (a, b) => { const d = Math.abs(a - b) % 1440; return Math.min(d, 1440 - d); };
const circularMean = (vals) => {
  const TWO_PI = 2 * Math.PI;
  const sinSum = vals.reduce((s, v) => s + Math.sin(v / 1440 * TWO_PI), 0);
  const cosSum = vals.reduce((s, v) => s + Math.cos(v / 1440 * TWO_PI), 0);
  let angle = Math.atan2(sinSum / vals.length, cosSum / vals.length);
  if (angle < 0) angle += TWO_PI;
  return (angle / TWO_PI) * 1440;
};
const runKMeans = (pts, k) => {
  if (pts.length < k) return { wcss: Infinity, centroids: [], clusters: [] };
  let centroids = Array.from({ length: k }, (_, i) => 360 + (i * (1200 - 360) / Math.max(k - 1, 1)));
  let clusters = [];
  for (let iter = 0; iter < 100; iter++) {
    clusters = Array.from({ length: k }, () => []);
    for (const p of pts) {
      const nearest = centroids.reduce((best, c, i) => circDist(p, c) < circDist(p, centroids[best]) ? i : best, 0);
      clusters[nearest].push(p);
    }
    const newCentroids = clusters.map((cl, i) => cl.length > 0 ? circularMean(cl) : centroids[i]);
    if (newCentroids.every((c, i) => Math.abs(c - centroids[i]) < 0.5)) break;
    centroids = newCentroids;
  }
  const wcss = clusters.reduce((sum, cl, i) => sum + cl.reduce((s, p) => s + Math.pow(circDist(p, centroids[i]), 2), 0), 0);
  return { wcss, centroids, clusters };
};

console.log("\n--- WCSS by k ---");
const wcssValues = [];
for (let k = 1; k <= 6; k++) {
  const r = runKMeans(allMins, k);
  wcssValues.push(r.wcss);
  console.log(`k=${k}: WCSS=${r.wcss.toFixed(0)}`);
}

console.log("\n--- Improvements ---");
for (let i = 1; i < wcssValues.length; i++) {
  const imp = wcssValues[i-1] - wcssValues[i];
  const ratio = i > 1 && (wcssValues[i-2] - wcssValues[i-1]) > 0 ? imp / (wcssValues[i-2] - wcssValues[i-1]) : null;
  console.log(`k=${i}->${i+1}: improvement=${imp.toFixed(0)}${ratio !== null ? `, ratio=${ratio.toFixed(3)}` : ''}`);
}

console.log("\n--- k=5 clusters ---");
const r5 = runKMeans(allMins, 5);
r5.clusters.forEach((cl, i) => {
  const c = r5.centroids[i];
  const h = Math.floor(c / 60) % 24;
  const m = Math.round(c % 60);
  const ampm = h >= 12 ? 'pm' : 'am';
  const h12 = h % 12 === 0 ? 12 : h % 12;
  const drift = cl.length > 0 ? cl.reduce((s, p) => s + circDist(p, c), 0) / cl.length : 0;
  console.log(`  Cluster ${i+1}: centroid=${h12}:${String(m).padStart(2,'0')} ${ampm}, size=${cl.length}, drift=${drift.toFixed(0)} min`);
  cl.sort((a,b)=>a-b).forEach(p => {
    const ph = Math.floor(p/60)%24, pm2 = Math.round(p%60);
    const pa = ph>=12?'pm':'am', ph12=ph%12===0?12:ph%12;
    console.log(`    ${ph12}:${String(pm2).padStart(2,'0')} ${pa}`);
  });
});

console.log("\n--- k=4 clusters ---");
const r4 = runKMeans(allMins, 4);
r4.clusters.forEach((cl, i) => {
  const c = r4.centroids[i];
  const h = Math.floor(c / 60) % 24;
  const m = Math.round(c % 60);
  const ampm = h >= 12 ? 'pm' : 'am';
  const h12 = h % 12 === 0 ? 12 : h % 12;
  const drift = cl.length > 0 ? cl.reduce((s, p) => s + circDist(p, c), 0) / cl.length : 0;
  console.log(`  Cluster ${i+1}: centroid=${h12}:${String(m).padStart(2,'0')} ${ampm}, size=${cl.length}, drift=${drift.toFixed(0)} min`);
});

await conn.end();
