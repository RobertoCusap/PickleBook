FROM node:24-bookworm-slim
WORKDIR /app
COPY --chown=node:node package.json server.cjs booking-store.cjs booking-rules.js ./
COPY --chown=node:node index.html app.js mock-data.js styles.css ./
RUN mkdir /app/data && chown node:node /app/data
ENV HOST=0.0.0.0 PORT=3000 DB_PATH=/app/data/bookings.sqlite
USER node
EXPOSE 3000
HEALTHCHECK --interval=30s --timeout=5s CMD ["node", "-e", "fetch('http://127.0.0.1:3000/healthz').then(r=>{if(!r.ok)process.exitCode=1}).catch(()=>{process.exitCode=1})"]
CMD ["node", "server.cjs"]
