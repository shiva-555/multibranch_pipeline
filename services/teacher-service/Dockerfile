# Use a lightweight, current Node LTS base image
FROM node:18-alpine

# Set the working directory inside the container
WORKDIR /app

# Copy package.json and package-lock.json (if present) to the working directory
COPY package*.json ./

# Install production dependencies only
RUN npm install --omit=dev

# Copy the rest of the application code
COPY . .

# Run as non-root user (default 'node' user in the alpine image)
USER node

# Expose the port this service listens on
EXPOSE 3502

# Command to run the service
CMD ["node", "server.js"]
