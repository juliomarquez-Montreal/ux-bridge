# UX Bridge

UX Bridge transforma uma transcrição bruta em documentos estruturados (BDD ou PBI) e, depois, em wireframes visuais. Cada etapa prevê aprovação humana: PO aprova o documento e UX aprova o wireframe.

## Rodar localmente

1. Instale as dependências: `npm install`.
2. Preencha os valores do arquivo `.env` com as suas credenciais.
3. Aplique o schema no banco Supabase/Postgres: `npm run db:push`.
4. Inicie o ambiente local: `npm run dev`.

## Estrutura de pastas

- `app/`: páginas, rotas e estilos globais do App Router.
- `components/`: componentes visuais reutilizáveis.
- `lib/`: clientes e funções auxiliares, como a conexão Prisma.
- `prisma/`: schema do banco de dados PostgreSQL.
- `public/`: imagens e outros arquivos estáticos.

## Scripts de banco

- `npm run db:push`: sincroniza o schema Prisma com o banco.
- `npm run db:studio`: abre a interface visual do Prisma.
