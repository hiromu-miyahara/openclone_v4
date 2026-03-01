FROM node:22-slim AS build
WORKDIR /app
COPY backend/package.json ./package.json
RUN npm install
COPY backend/tsconfig.json ./tsconfig.json
COPY backend/src ./src
COPY docs/contracts ./docs/contracts
RUN npm run build

FROM node:22-slim AS runtime
WORKDIR /app
ENV NODE_ENV=production
COPY backend/package.json ./package.json
RUN npm install --omit=dev
COPY --from=build /app/dist ./dist
COPY --from=build /app/docs/contracts ./docs/contracts
EXPOSE 8080
CMD ["node", "dist/index.js"]
