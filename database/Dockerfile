FROM postgres:17-alpine AS extension
ARG PGVECTOR_VERSION=0.8.2
RUN apk add --no-cache build-base clang llvm-dev wget \
    && wget -qO /tmp/vector.tar.gz https://github.com/pgvector/pgvector/archive/refs/tags/v${PGVECTOR_VERSION}.tar.gz \
    && tar -xzf /tmp/vector.tar.gz -C /tmp \
    && cd /tmp/pgvector-${PGVECTOR_VERSION} \
    && make OPTFLAGS="" with_llvm=no \
    && make install with_llvm=no
FROM postgres:17-alpine
COPY --from=extension /usr/local/lib/postgresql/vector.so /usr/local/lib/postgresql/vector.so
COPY --from=extension /usr/local/share/postgresql/extension/vector* /usr/local/share/postgresql/extension/
