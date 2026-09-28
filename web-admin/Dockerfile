# Independent web artifact for FacturaOF1 product frontends.
# The Django backend and production compose remain outside this build.
FROM node:22-alpine AS build

WORKDIR /app/web-admin

COPY web-admin/package*.json ./
RUN npm ci

COPY web-admin/ ./

ARG VITE_API_URL=http://localhost:8000/api
ARG VITE_APP_TARGET=facturaof1
ARG VITE_ENABLE_PWA=false
ARG VITE_FACTURAOF1_URL=http://localhost:5176
ARG VITE_OF1_ADMIN_URL=http://localhost:5177
ARG VITE_FIRMADOR_URL=http://localhost:5178
ENV VITE_API_URL=${VITE_API_URL}
ENV VITE_APP_TARGET=${VITE_APP_TARGET}
ENV VITE_ENABLE_PWA=${VITE_ENABLE_PWA}
ENV VITE_FACTURAOF1_URL=${VITE_FACTURAOF1_URL}
ENV VITE_OF1_ADMIN_URL=${VITE_OF1_ADMIN_URL}
ENV VITE_FIRMADOR_URL=${VITE_FIRMADOR_URL}

RUN npm run build

FROM nginx:1.27-alpine AS runtime

COPY web-admin/docker/nginx.conf /etc/nginx/conf.d/default.conf
COPY --from=build /app/web-admin/dist /usr/share/nginx/html

EXPOSE 80

HEALTHCHECK --interval=30s --timeout=5s --retries=3 \
  CMD wget --no-verbose --tries=1 --spider http://127.0.0.1/ || exit 1

CMD ["nginx", "-g", "daemon off;"]
