module.exports = {
  apps: [{
    name: "gotham-enterprise",
    script: "/home/ec2-user/Gotham-Enterprise/.next/standalone/server.js",
    env: {
      NODE_ENV: "production",
      PORT: 3000,
      HOSTNAME: "127.0.0.1"
    }
  }]
}
