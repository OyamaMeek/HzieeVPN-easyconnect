# syntax=docker/dockerfile:1
FROM --platform=$BUILDPLATFORM golang:1.27.4 AS build
WORKDIR /src
COPY go.mod go.sum ./
RUN go mod download
COPY . .
ARG TARGETOS TARGETARCH
ARG VERSION=hziee
ARG COMMIT_ID
RUN CGO_ENABLED=0 GOOS=$TARGETOS GOARCH=$TARGETARCH go build -mod=readonly -trimpath \
    -ldflags "-s -w -X main.zjuConnectVersion=${VERSION} -X main.CommitID=${COMMIT_ID}" \
    -o /out/zju-connect .

FROM gcr.io/distroless/static-debian12:latest
WORKDIR /home/nonroot
COPY --from=build /out/zju-connect ./zju-connect
COPY LICENSE /usr/share/licenses/zju-connect/LICENSE
LABEL org.opencontainers.image.source="https://github.com/OyamaMeek/HzieeVPN-easyconnect"
LABEL org.opencontainers.image.licenses="AGPL-3.0-only"
ENTRYPOINT ["/home/nonroot/zju-connect", "-config", "/home/nonroot/config.toml"]
