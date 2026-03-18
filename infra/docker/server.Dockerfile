FROM node:22-alpine
WORKDIR /app
COPY package*.json ./
COPY apps/server/package*.json apps/server/
COPY packages/shared/package*.json packages/shared/
RUN npm install
COPY . .
RUN npm run build --workspace @rideforge/shared && npm run build --workspace @rideforge/server
EXPOSE 4000
CMD ["npm", "run", "start", "--workspace", "@rideforge/server"]
