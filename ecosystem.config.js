export default {
  apps: [{
    name: "dc-park-speaker",
    script: "bun",
    args: "start",
    autorestart: true,
    restart_delay: 5000,
  }]
}