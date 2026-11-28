FROM debian:bookworm-slim

ENV DEBIAN_FRONTEND=noninteractive

ARG OPERA_VERSION=12.16-1860
ARG OPERA_TARBALL=opera-${OPERA_VERSION}.x86_64.linux.tar.xz
ARG OPERA_URL=https://get.opera.com/pub/opera/linux/1216/${OPERA_TARBALL}
ARG OPERA_MD5=ead647964ace52f44ced98adbc568ae7

RUN apt-get update && apt-get install -y --no-install-recommends \
    ca-certificates \
    curl \
    xz-utils \
    xvfb \
    x11vnc \
    novnc \
    websockify \
    openbox \
    libx11-6 \
    libxext6 \
    libxft2 \
    libxrender1 \
    libxt6 \
    libxi6 \
    libxrandr2 \
    libxinerama1 \
    libice6 \
    libsm6 \
    libfontconfig1 \
    libfreetype6 \
    libglib2.0-0 \
    libstdc++6 \
    zlib1g \
    fonts-dejavu-core \
    && rm -rf /var/lib/apt/lists/*

# Download Opera 12.16 at build time (not redistributed in the repository/image source).
RUN curl -fsSL "${OPERA_URL}" -o "/tmp/${OPERA_TARBALL}" \
    && echo "${OPERA_MD5}  /tmp/${OPERA_TARBALL}" | md5sum -c - \
    && mkdir -p /opt/opera \
    && tar -xJf "/tmp/${OPERA_TARBALL}" -C /opt/opera --strip-components=1 \
    && rm -f "/tmp/${OPERA_TARBALL}"

COPY entrypoint.sh /entrypoint.sh
RUN chmod +x /entrypoint.sh

ENV DISPLAY=:1 \
    SCREEN_WIDTH=1280 \
    SCREEN_HEIGHT=900 \
    SCREEN_DEPTH=24 \
    NOVNC_PORT=6080 \
    VNC_PORT=5900 \
    TARGET_URL=http://localhost:8080/jci/gui/index.html \
    OPERA_ARGS="-noargb -nohwaccel -nosession -noraise -nomail"

EXPOSE 6080 5900

ENTRYPOINT ["/entrypoint.sh"]
