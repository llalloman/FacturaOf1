FROM openwa/wa-automate:latest

USER root

RUN rm -f /etc/apt/sources.list.d/google-chrome.list \
    && apt-get update \
    && apt-get install -y procps \
    && rm -rf /var/lib/apt/lists/*

# Importante:
# No volver a USER node porque OpenWA intenta escribir en node_modules al iniciar.
USER root