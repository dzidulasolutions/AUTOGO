-- Active l'extension trigram (une fois par base)
CREATE EXTENSION IF NOT EXISTS pg_trgm;

-- Index GIN trigram sur les champs recherchables
CREATE INDEX IF NOT EXISTS clients_first_name_trgm_idx ON clients USING GIN ("firstName" gin_trgm_ops);
CREATE INDEX IF NOT EXISTS clients_last_name_trgm_idx ON clients USING GIN ("lastName" gin_trgm_ops);
CREATE INDEX IF NOT EXISTS clients_phone_trgm_idx ON clients USING GIN (phone gin_trgm_ops);
CREATE INDEX IF NOT EXISTS clients_client_number_trgm_idx ON clients USING GIN ("clientNumber" gin_trgm_ops);