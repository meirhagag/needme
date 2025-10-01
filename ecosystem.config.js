// ecosystem.config.js
module.exports = {
  apps: [{
    name: "needme",
    cwd: "C:/Users/P0027112/needme",
    script: "./node_modules/next/dist/bin/next",
    args: "start -p 3000",
    env: { NODE_ENV: "production" }
  }]
}
