FROM blakeblackshear/frigate-nginx:1.0.2 as nginx

FROM node:16 as web

WORKDIR /opt/frigate

COPY web/ .

RUN npm install && npm run build

FROM debian:11 as wheels
ARG TARGETARCH

ENV DEBIAN_FRONTEND=noninteractive

# Use a separate container to build wheels to prevent build dependencies in final image
RUN apt-get -qq update \
    && apt-get -qq install -y \
    apt-transport-https \
    gnupg \
    wget \
    && wget -O - http://archive.raspberrypi.org/debian/raspberrypi.gpg.key | apt-key add - \
    && echo "deb http://archive.raspberrypi.org/debian/ bullseye main" | tee /etc/apt/sources.list.d/raspi.list \
    && apt-get -qq update \
    && apt-get -qq install -y \
    python3 \
    python3-dev \
    wget \
    # opencv dependencies
    build-essential cmake git pkg-config libgtk-3-dev \
    libavcodec-dev libavformat-dev libswscale-dev libv4l-dev \
    libxvidcore-dev libx264-dev libjpeg-dev libpng-dev libtiff-dev \
    gfortran openexr libatlas-base-dev libssl-dev\
    libtbb2 libtbb-dev libdc1394-22-dev libopenexr-dev \
    libgstreamer-plugins-base1.0-dev libgstreamer1.0-dev \
    # scipy dependencies
    gcc gfortran libopenblas-dev liblapack-dev

RUN wget -q https://bootstrap.pypa.io/get-pip.py -O get-pip.py \
    && python3 get-pip.py "pip"

RUN if [ "${TARGETARCH}" = "arm" ]; \
    then echo "[global]" > /etc/pip.conf \
    && echo "extra-index-url=https://www.piwheels.org/simple" >> /etc/pip.conf; \
    fi

COPY requirements.txt /requirements.txt
RUN pip3 install -r requirements.txt

COPY requirements-wheels.txt /requirements-wheels.txt
RUN pip3 wheel --wheel-dir=/wheels -r requirements-wheels.txt

# Frigate Container
FROM debian:11-slim
ARG TARGETARCH

ENV DEBIAN_FRONTEND=noninteractive
ENV FLASK_ENV=development

COPY --from=wheels /wheels /wheels

# Install ffmpeg
RUN apt-get -qq update \
    && apt-get -qq install --no-install-recommends -y \
    apt-transport-https \
    gnupg \
    wget \
    unzip tzdata libxml2 xz-utils \
    python3-pip \
    # add raspberry pi repo
    && wget -O - http://archive.raspberrypi.org/debian/raspberrypi.gpg.key | apt-key add - \
    && echo "deb http://archive.raspberrypi.org/debian/ bullseye main" | tee /etc/apt/sources.list.d/raspi.list \
    # add coral repo
    && APT_KEY_DONT_WARN_ON_DANGEROUS_USAGE=DontWarn apt-key adv --fetch-keys https://packages.cloud.google.com/apt/doc/apt-key.gpg \
    && echo "deb https://packages.cloud.google.com/apt coral-edgetpu-stable main" > /etc/apt/sources.list.d/coral-edgetpu.list \
    && echo "libedgetpu1-max libedgetpu/accepted-eula select true" | debconf-set-selections \
    && apt-get -qq update \
    && apt-get -qq install --no-install-recommends -y \
    ffmpeg \
    # coral drivers
    libedgetpu1-max python3-tflite-runtime python3-pycoral \
    && pip3 install -U /wheels/*.whl \
    && rm -rf /var/lib/apt/lists/* /wheels \
    && (apt-get autoremove -y; apt-get autoclean -y)

# AMD64 specific packages
RUN if [ "${TARGETARCH}" = "amd64" ]; \
    then \
    wget -qO - https://repositories.intel.com/graphics/intel-graphics.key | apt-key add - \
    && echo 'deb [arch=amd64] https://repositories.intel.com/graphics/ubuntu focal main' > /etc/apt/sources.list.d/intel-graphics.list \
    && apt-get -qq update \
    && apt-get -qq install --no-install-recommends -y \
    # VAAPI drivers for Intel hardware accel
    libva-drm2 libva2 libmfx1 i965-va-driver vainfo intel-media-va-driver-non-free mesa-vdpau-drivers mesa-va-drivers mesa-vdpau-drivers libdrm-radeon1 \
    && rm -rf /var/lib/apt/lists/* \
    && (apt-get autoremove -y; apt-get autoclean -y) \
    fi

COPY --from=nginx /usr/local/nginx/ /usr/local/nginx/

# get model and labels
COPY labelmap.txt /labelmap.txt
RUN wget -q https://github.com/google-coral/test_data/raw/release-frogfish/ssdlite_mobiledet_coco_qat_postprocess_edgetpu.tflite -O /edgetpu_model.tflite
RUN wget -q https://github.com/google-coral/test_data/raw/release-frogfish/ssdlite_mobiledet_coco_qat_postprocess.tflite -O /cpu_model.tflite

WORKDIR /opt/frigate/
ADD frigate frigate/
ADD migrations migrations/

COPY --from=web /opt/frigate/dist web/

COPY docker/rootfs/ /

# s6-overlay
RUN S6_ARCH="${TARGETARCH}" \
    && if [ "${TARGETARCH}" = "amd64" ]; then S6_ARCH="amd64"; fi \
    && if [ "${TARGETARCH}" = "arm" ]; then S6_ARCH="armhf"; fi \
    && if [ "${TARGETARCH}" = "arm64" ]; then S6_ARCH="aarch64"; fi \
    && wget -O /tmp/s6-overlay-installer "https://github.com/just-containers/s6-overlay/releases/download/v2.2.0.3/s6-overlay-${S6_ARCH}-installer" \
    && chmod +x /tmp/s6-overlay-installer && /tmp/s6-overlay-installer /

EXPOSE 5000
EXPOSE 1935

ENTRYPOINT ["/init"]

CMD ["python3", "-u", "-m", "frigate"]
