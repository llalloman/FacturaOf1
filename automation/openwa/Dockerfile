FROM openwa/wa-automate:latest

USER root

RUN (apt-get update && apt-get install -y procps && rm -rf /var/lib/apt/lists/*) \
    || (apk add --no-cache procps) \
    || (yum install -y procps-ng)

USER node