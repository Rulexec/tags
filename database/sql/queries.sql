--##-- is info_int exists
SELECT COUNT(table_name) AS "isExists"
    FROM information_schema.tables
    WHERE table_name = 'info_int';

--##-- create db
CREATE TABLE info_int (
    key character varying(16) NOT NULL,
    value integer,
    CONSTRAINT info_int_pkey PRIMARY KEY (key)
) WITH (
    OIDS=FALSE
);

-- version
INSERT INTO info_int (key, value) VALUES ('version', '1');

-- session_users
CREATE TABLE session_users
(
   id character(32), 
   authorized_user integer, 
   "when" timestamp with time zone DEFAULT NOW(), 
   PRIMARY KEY (id)
) 
WITH (
  OIDS = FALSE
)
;

-- tags-users
CREATE TABLE "tags-users"
(
  tag character varying(32) COLLATE pg_catalog."C.UTF-8" NOT NULL,
  "user" integer NOT NULL,
  CONSTRAINT "tags-users_pkey" PRIMARY KEY (tag, "user")
)
WITH (
  OIDS=FALSE
);

CREATE INDEX "tags-users_user_idx"
  ON "tags-users"
  USING hash
  ("user");

-- users
CREATE TABLE public.users
(
   id serial,
   name character varying(96) COLLATE pg_catalog."C.UTF-8",
   about text COLLATE pg_catalog."C.UTF-8",
   email character varying(64) COLLATE pg_catalog."C.UTF-8",
   passhash character(32),
   show_email boolean DEFAULT true,
   PRIMARY KEY (id)
) 
WITH (
  OIDS = FALSE
);

CREATE INDEX users_email_idx
  ON users
  USING hash
  (email);

-- users_email_auth
CREATE TABLE users_email_auth
(
  "user" integer NOT NULL,
  auth_key character(32),
  CONSTRAINT users_email_auth_pkey PRIMARY KEY ("user")
)
WITH (
  OIDS=FALSE
);

--##-- get example
SELECT a.tag FROM "tags-users" a INNER JOIN (SELECT "user" FROM "tags-users" ORDER BY random() LIMIT 1) AS b ON a.user = b.user ORDER BY random() LIMIT 3

--##-- create user
INSERT INTO users (email) (SELECT CAST($1 AS character varying(64)) WHERE NOT EXISTS (SELECT * FROM users WHERE email = $1)) RETURNING id

--##-- update user
UPDATE users SET name = $2, about = $3, show_email = $4 WHERE id = $1

--##-- get user
SELECT name, about, passhash, email, show_email FROM users WHERE id = $1

--##-- save email auth key
INSERT INTO users_email_auth ("user", auth_key) VALUES ($1, $2)

--##-- get email auth key
SELECT a.id, b.auth_key FROM users a JOIN users_email_auth b ON a.id = b.user AND b.auth_key = $2 WHERE a.email = $1

--##-- remove email auth key
DELETE FROM users_email_auth WHERE "user" = $1 AND auth_key = $2;

--##-- set email validated
UPDATE users SET passhash = 'validated' WHERE id = $1;

--##-- check email validation
SELECT id FROM users WHERE id = $1 AND (passhash = 'validated' OR passhash != '');

--##-- update password
UPDATE users SET passhash = $2 WHERE id = $1;

--##-- save session
INSERT INTO session_users (id, authorized_user) VALUES ($1, $2)

--##-- get session user_id
SELECT authorized_user AS "user_id" FROM session_users WHERE id = $1 AND "when" >= (NOW() - interval '7' day)

--##-- delete session
DELETE FROM session_users WHERE id = $1

--##-- get user tags
SELECT tag FROM "tags-users" WHERE "user" = $1

--##-- delete tag
DELETE FROM "tags-users" WHERE tag = $2 AND "user" = $1

--##-- auth by password
SELECT id FROM users WHERE email = $1 AND passhash = $2
