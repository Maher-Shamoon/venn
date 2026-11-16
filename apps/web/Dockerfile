# Builds the web app and serves it with nginx. API calls under /api/ go to the api service, so the browser only talks to one address.
FROM node:22-alpine AS build
WORKDIR /app
COPY package.json package-lock.json .npmrc* ./
RUN npm ci
COPY . .
# Public settings only (the anon key is public by design). Never pass a service-role key here.
ARG VITE_SUPABASE_URL=""
ARG VITE_SUPABASE_ANON_KEY=""
ENV VITE_SUPABASE_URL=$VITE_SUPABASE_URL VITE_SUPABASE_ANON_KEY=$VITE_SUPABASE_ANON_KEY
RUN npm run build

FROM nginx:1.27-alpine
COPY nginx.conf /etc/nginx/conf.d/default.conf
COPY --from=build /app/dist /usr/share/nginx/html
EXPOSE 80
