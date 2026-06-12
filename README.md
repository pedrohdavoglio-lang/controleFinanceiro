# Painel Financeiro Moni

MVP estático de uma aplicação web financeira pessoal.

## O que tem nesta versão

- Dashboard visual
- Cadastro de lançamentos
- Edição e exclusão de lançamentos
- Controle de parcelamento
- Controle de reembolso
- Compras por impulso
- Importação de base JSON
- Exportação de base JSON
- Exportação CSV simples
- Persistência local via `localStorage`

## Como rodar localmente

Abra o arquivo `index.html` no navegador.

Se o navegador bloquear alguma função ao abrir direto, rode um servidor local simples:

```bash
python3 -m http.server 8000
```

Depois acesse:

```text
http://localhost:8000
```

## Como hospedar rapidamente

### GitHub Pages

1. Criar um repositório no GitHub.
2. Subir estes arquivos na raiz do repositório.
3. Ativar GitHub Pages em `Settings > Pages`.
4. Escolher a branch principal e a pasta `/root`.

### Vercel

1. Criar repositório no GitHub.
2. Importar o projeto na Vercel.
3. Deploy sem build command.
4. Output directory: raiz do projeto.

## Observação importante

Esta versão não usa banco de dados. Os dados ficam salvos no navegador da usuária via `localStorage`.

Para trocar dados com o chat, use:

- `Exportar base JSON`
- Enviar o arquivo exportado no chat
- Receber de volta uma base ajustada
- Importar a base JSON atualizada no app

## Próxima evolução técnica

Quando a versão hospedada/banco for criada, substituir o `localStorage` por uma API.

Sugestão de arquitetura futura:

```text
Front-end estático
       ↓
API
       ↓
Supabase ou outro banco online
```

Tabelas sugeridas:

- `cycles`
- `transactions`
- `categories`
- `refunds`
- `installments`

## Estrutura da base JSON

```json
{
  "version": "1.0",
  "cycle": {
    "start": "2026-06-15",
    "end": "2026-07-15",
    "initialBalance": 0
  },
  "transactions": []
}
```

Cada transação segue o formato:

```json
{
  "id": "uuid",
  "date": "2026-06-12",
  "description": "Táxi Syngenta",
  "value": 12.47,
  "category": "Transporte",
  "type": "Reembolso",
  "payment": "À vista",
  "installments": 1,
  "currentInstallment": 1,
  "refundStatus": "Pendente",
  "refundCompany": "Syngenta",
  "notes": "Corrida por conta de trabalho."
}
```
