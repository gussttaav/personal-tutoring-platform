-- La tienda inventada del artículo «Cómo ejecuta la base de datos un JOIN, y por qué a veces
-- ignora tu índice» (https://gustavoai.dev/blog/como-ejecuta-un-join).
--
-- Genera, con semillas fijas, exactamente las mismas filas con las que están medidos todos los
-- números del artículo:
--   clientes        200 000 filas. Provincia repartida según la población (millones de habitantes,
--                   aproximados, de 2024). 4000 empresas: los id múltiplos de 50.
--   pedidos       3 000 000 filas, en orden de fecha (el id crece con la fecha), del 2023-10-01 al
--                   2026-09-30. El 20 % son de empresas: unos 162 pedidos por empresa y 12 por
--                   particular.
--   lineas_pedido 7 498 570 filas, de 1 a 4 por pedido, guardadas en orden de pedido_id.
--
-- Uso, en una base de datos vacía de Postgres 18 (tarda unos tres minutos y ocupa unos 820 MB):
--   createdb tienda && psql -d tienda -f tienda.sql
--
-- Para comprobar que se han generado las mismas filas:
--   SELECT md5(string_agg(id||provincia||tipo||alta||muestra, ',' ORDER BY id)) FROM clientes;
--     -> 5baf20be5c8cc4277e081d94f177da29
--   SELECT md5(string_agg(id||'/'||cliente_id||'/'||fecha||'/'||estado||'/'||importe, ',' ORDER BY id)) FROM pedidos;
--     -> bf9c2030e943c948f20c9bab9bcb4a00
--   SELECT md5(string_agg(pedido_id||'/'||linea||'/'||producto_id||'/'||cantidad||'/'||precio, ','
--                         ORDER BY pedido_id, linea)) FROM lineas_pedido;
--     -> acad7d1c042a5e8bc1e1970dc78ea4e1
--
-- Cómo se midió (Postgres 18.6):
--   - SET max_parallel_workers_per_gather = 0; SET jit = off;  el resto, por defecto.
--   - Algoritmos forzados: SET enable_hashjoin = off; SET enable_mergejoin = off; (nested loop)
--     o SET enable_nestloop = off; SET enable_mergejoin = off; (hash join). En la figura de cruce,
--     además, SET enable_memoize = off, para que el nested loop sea siempre «para cada cliente,
--     buscar sus pedidos».
--   - Las tres situaciones de memoria: en la caché de Postgres, shared_buffers suficiente para
--     todas las tablas y pg_prewarm; en la caché del sistema, shared_buffers = 128MB con los
--     ficheros ya leídos por el sistema operativo; en el SSD, la caché de los ficheros vaciada
--     antes de cada ejecución.
--   - Cada tiempo es la mediana de tres ejecuciones.
-- Para MySQL o DuckDB, basta con exportar las tres tablas a CSV (COPY ... TO STDOUT CSV) y
-- cargarlas con el mismo esquema.

DROP TABLE IF EXISTS lineas_pedido, pedidos, clientes, provincias;
CREATE TABLE provincias (nombre text PRIMARY KEY, poblacion numeric);
INSERT INTO provincias VALUES
('Madrid',7.0),('Barcelona',5.9),('Valencia',2.7),('Alicante',2.0),('Sevilla',1.96),('Málaga',1.78),
('Murcia',1.57),('Cádiz',1.25),('Baleares',1.23),('Vizcaya',1.16),('Las Palmas',1.16),('A Coruña',1.13),
('Santa Cruz de Tenerife',1.08),('Asturias',1.0),('Zaragoza',0.98),('Pontevedra',0.95),('Granada',0.93),
('Tarragona',0.84),('Girona',0.8),('Córdoba',0.77),('Almería',0.75),('Guipúzcoa',0.73),('Toledo',0.72),
('Badajoz',0.67),('Navarra',0.67),('Jaén',0.62),('Castellón',0.6),('Cantabria',0.59),('Huelva',0.53),
('Valladolid',0.52),('Ciudad Real',0.49),('León',0.45),('Lleida',0.45),('Cáceres',0.39),('Albacete',0.39),
('Burgos',0.36),('Álava',0.34),('Salamanca',0.33),('Lugo',0.32),('La Rioja',0.32),('Ourense',0.30),
('Guadalajara',0.27),('Huesca',0.23),('Cuenca',0.2),('Zamora',0.17),('Ávila',0.16),('Palencia',0.16),
('Segovia',0.16),('Teruel',0.13),('Soria',0.09),('Melilla',0.085),('Ceuta',0.083);

SELECT setseed(0.42);

CREATE TEMP TABLE rangos AS
SELECT nombre,
       coalesce(sum(poblacion) OVER (ORDER BY poblacion DESC, nombre ROWS BETWEEN UNBOUNDED PRECEDING AND 1 PRECEDING), 0) / (SELECT sum(poblacion) FROM provincias) AS lo,
       sum(poblacion) OVER (ORDER BY poblacion DESC, nombre) / (SELECT sum(poblacion) FROM provincias) AS hi
FROM provincias;

CREATE TABLE clientes (
  id        integer PRIMARY KEY,
  nombre    text    NOT NULL,
  email     text    NOT NULL,
  provincia text    NOT NULL,
  tipo      text    NOT NULL,   -- 'particular' | 'empresa'
  alta      date    NOT NULL
);
INSERT INTO clientes
SELECT g.i, 'Cliente ' || g.i, 'cliente' || g.i || '@ejemplo.es', r.nombre,
       CASE WHEN g.i % 50 = 0 THEN 'empresa' ELSE 'particular' END,
       date '2020-01-01' + (g.i * 2400 / 200000)
FROM (SELECT i, random() AS u FROM generate_series(1, 200000) i) g
JOIN rangos r ON g.u >= r.lo AND g.u < r.hi
ORDER BY g.i;

CREATE TABLE pedidos (
  id         integer PRIMARY KEY,
  cliente_id integer NOT NULL REFERENCES clientes(id),
  fecha      date    NOT NULL,
  estado     text    NOT NULL,
  importe    numeric(10,2) NOT NULL
);
INSERT INTO pedidos
SELECT i,
       CASE WHEN random() < 0.2 THEN 50 * (1 + floor(random() * 4000))::int
            ELSE (1 + floor(random() * 200000))::int END,
       f,
       CASE WHEN f >= date '2026-09-28' THEN 'pendiente'
            WHEN f >= date '2026-09-21' THEN 'enviado'
            WHEN random() < 0.02 THEN 'devuelto'
            WHEN random() < 0.01 THEN 'cancelado'
            ELSE 'entregado' END,
       round((5 + random() * 495)::numeric, 2)
FROM (SELECT i, date '2023-10-01' + ((i - 1) * 1096::bigint / 3000000)::int AS f
      FROM generate_series(1, 3000000) i) s;

CREATE INDEX pedidos_cliente_id_idx ON pedidos (cliente_id);

CREATE TABLE lineas_pedido (
  pedido_id   integer NOT NULL REFERENCES pedidos(id),
  linea       smallint NOT NULL,
  producto_id integer NOT NULL,
  cantidad    smallint NOT NULL,
  precio      numeric(8,2) NOT NULL,
  PRIMARY KEY (pedido_id, linea)
);
INSERT INTO lineas_pedido
SELECT p.id, l, 1 + floor(random() * 5000)::int, 1 + floor(random() * 4)::int, round((2 + random() * 198)::numeric, 2)
FROM (SELECT id, 1 + floor(random() * 4)::int AS n FROM pedidos ORDER BY id) p, generate_series(1, p.n) l;

-- El «dial» de la figura de cruce: una permutación aleatoria, sin relación con id, para que
-- `c.muestra < N` deje pasar exactamente N clientes.
SELECT setseed(0.7);
ALTER TABLE clientes ADD COLUMN muestra integer;
UPDATE clientes c SET muestra = s.rn
FROM (SELECT id, row_number() OVER (ORDER BY random()) - 1 AS rn FROM clientes) s
WHERE s.id = c.id;
VACUUM FULL clientes;
VACUUM ANALYZE;
