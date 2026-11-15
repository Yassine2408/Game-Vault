/** Verify the realtime hub end-to-end: connect, receive snapshot, catch activity. */
import { io } from "socket.io-client";

const socket = io("http://127.0.0.1:3003", { path: "/", transports: ["websocket"], timeout: 8000 });

let snapshot = null;
let activitySeen = 0;
let trendingSeen = 0;

socket.on("connect", () => console.log("connected:", socket.id));
socket.on("connect_error", (e) => { console.error("connect_error:", e.message); process.exit(1); });
socket.on("live:snapshot", (d) => {
  snapshot = d;
  console.log("live:snapshot →", JSON.stringify({
    presence: d.presence,
    stats: d.stats ? { tracked: d.stats.gamesTracked, finished: d.stats.finished, hours: d.stats.totalHours } : null,
    activityEvents: d.activity?.length ?? 0,
    trending: d.trending?.length ?? 0,
  }));
});
socket.on("activity:new", () => activitySeen++);
socket.on("live:trending", (d) => { trendingSeen = d.trending.length; });

// also fire a ping-live roundtrip
const pingStart = Date.now();
socket.emit("ping-live", (t) => console.log("ping-live RTT:", Date.now() - t, "ms"));

setTimeout(() => {
  console.log("--- after 10s ---");
  console.log("snapshot received:", !!snapshot, "| new activity events:", activitySeen, "| trending items:", trendingSeen);
  socket.close();
  process.exit(snapshot ? 0 : 1);
}, 10_000);
