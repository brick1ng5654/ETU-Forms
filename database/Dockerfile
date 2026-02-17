FROM postgres:15.10-alpine

COPY init/ /docker-entrypoint-initdb.d/

RUN chmod +x /docker-entrypoint-initdb.d/*.sql
