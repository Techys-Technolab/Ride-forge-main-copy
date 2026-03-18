FROM node:22-alpine
WORKDIR /app
COPY package*.json ./
COPY apps/mobile/package*.json apps/mobile/
COPY packages/shared/package*.json packages/shared/
RUN npm install
COPY . .
EXPOSE 19006
CMD ["npm", "run", "start", "--workspace", "@rideforge/mobile"]
