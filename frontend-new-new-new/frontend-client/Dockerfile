# StackMind frontend — static files served by nginx. No build step, no Node.
FROM nginx:stable-alpine

# Our server config (replaces the default one).
COPY nginx.conf /etc/nginx/conf.d/default.conf

# The static frontend itself.
COPY index.html styles.css retro.css app.js retro.js /usr/share/nginx/html/

# nginx:alpine already EXPOSEs 80 and runs nginx in the foreground.
